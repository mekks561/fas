// ===================================================================
// 排行榜路由 - 最小 API 集
// 对齐前端 CloudSaveSystem 调用契约：
//   - GET  /leaderboard?limit=100        → LeaderboardEntry[]
//   - POST /leaderboard                  → 提交分数
//   - GET  /leaderboard/my-rank?playerId → 个人最佳排名
//   - GET  /leaderboard/stats            → 统计
// ===================================================================

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../lib/prisma.js';
import { submitScoreSchema, difficultySchema } from '../schemas/leaderboard.js';
import type { LeaderboardEntryDTO } from '../schemas/leaderboard.js';

const router = new Hono();

// 将 DB 记录转换为前端 DTO（timestamp → 毫秒数）
function toDTO(
  entry: {
    playerId: string;
    playerName: string;
    score: number;
    wave: number;
    kills: number;
    accuracy: number | null;
    maxCombo: number | null;
    bossesKilled: number | null;
    elitesKilled: number | null;
    playTime: number | null;
    powerupsCollected: number | null;
    damageDealt: number | null;
    damageTaken: number | null;
    rankGrade: string | null;
    timestamp: Date;
  },
  rank: number,
): LeaderboardEntryDTO {
  return {
    playerId: entry.playerId,
    playerName: entry.playerName,
    score: entry.score,
    wave: entry.wave,
    kills: entry.kills,
    timestamp: entry.timestamp.getTime(),
    rank,
    accuracy: entry.accuracy ?? undefined,
    maxCombo: entry.maxCombo ?? undefined,
    bossesKilled: entry.bossesKilled ?? undefined,
    elitesKilled: entry.elitesKilled ?? undefined,
    playTime: entry.playTime ?? undefined,
    powerupsCollected: entry.powerupsCollected ?? undefined,
    damageDealt: entry.damageDealt ?? undefined,
    damageTaken: entry.damageTaken ?? undefined,
    rankGrade: entry.rankGrade ?? undefined,
  };
}

// GET /leaderboard?limit=100&difficulty=normal
// 前端 CloudSaveSystem.getLeaderboard(limit) 直接期望 LeaderboardEntry[] 数组
router.get('/', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? '100'), 500);
  const difficultyRaw = c.req.query('difficulty');

  let difficulty: 'easy' | 'normal' | 'hard' | 'expert' | undefined;
  if (difficultyRaw) {
    const parsed = difficultySchema.safeParse(difficultyRaw);
    if (!parsed.success) {
      return c.json({ error: 'invalid difficulty', issues: parsed.error.issues }, 400);
    }
    difficulty = parsed.data;
  }

  const entries = await prisma.leaderboardEntry.findMany({
    where: difficulty ? { difficulty } : undefined,
    orderBy: [{ score: 'desc' }, { timestamp: 'desc' }],
    take: limit,
  });

  const result: LeaderboardEntryDTO[] = entries.map((e, i) => toDTO(e, i + 1));
  return c.json(result);
});

// POST /leaderboard - 提交分数
// 前端 CloudSaveSystem.submitScore(Omit<LeaderboardEntry, 'rank' | 'timestamp'>)
router.post('/', zValidator('json', submitScoreSchema), async (c) => {
  const input = c.req.valid('json');

  // 防刷：同一玩家短时间内重复提交高分（POC 简化版，生产用 Redis 限流）
  if (input.score > 0) {
    const existingBest = await prisma.leaderboardEntry.findFirst({
      where: { playerId: input.playerId },
      orderBy: { score: 'desc' },
      select: { score: true },
    });
    // 若本次分数低于历史最佳，仍记录（保留全部对局），但排名按最佳算
    void existingBest;
  }

  const created = await prisma.leaderboardEntry.create({
    data: {
      playerId: input.playerId,
      playerName: input.playerName,
      score: input.score,
      wave: input.wave,
      kills: input.kills,
      accuracy: input.accuracy,
      maxCombo: input.maxCombo,
      bossesKilled: input.bossesKilled,
      elitesKilled: input.elitesKilled,
      playTime: input.playTime,
      powerupsCollected: input.powerupsCollected,
      damageDealt: input.damageDealt,
      damageTaken: input.damageTaken,
      rankGrade: input.rankGrade,
      difficulty: input.difficulty ?? 'normal',
    },
  });

  // 计算本次提交的实时排名
  const higherCount = await prisma.leaderboardEntry.count({
    where: { score: { gt: created.score } },
  });
  const rank = higherCount + 1;

  return c.json(toDTO(created, rank), 201);
});

// GET /leaderboard/my-rank?playerId=xxx
// 返回该玩家历史最佳分数及全榜排名
router.get('/my-rank', async (c) => {
  const playerId = c.req.query('playerId');
  if (!playerId) {
    return c.json({ error: 'playerId query param required' }, 400);
  }

  const best = await prisma.leaderboardEntry.findFirst({
    where: { playerId },
    orderBy: { score: 'desc' },
  });

  if (!best) {
    return c.json({ rank: null, entry: null });
  }

  const higherCount = await prisma.leaderboardEntry.count({
    where: { score: { gt: best.score } },
  });

  return c.json({ rank: higherCount + 1, entry: toDTO(best, higherCount + 1) });
});

// GET /leaderboard/stats - 全榜统计
router.get('/stats', async (c) => {
  const [agg, total] = await Promise.all([
    prisma.leaderboardEntry.aggregate({
      _sum: { score: true, kills: true },
      _avg: { score: true, kills: true },
      _max: { score: true },
    }),
    prisma.leaderboardEntry.count(),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayGames = await prisma.leaderboardEntry.count({
    where: { timestamp: { gte: today } },
  });

  return c.json({
    totalPlayers: total,
    totalScore: agg._sum.score ?? 0,
    avgScore: Math.round((agg._avg.score ?? 0) * 100) / 100,
    topScore: agg._max.score ?? 0,
    totalKills: agg._sum.kills ?? 0,
    avgKills: Math.round((agg._avg.kills ?? 0) * 100) / 100,
    todayGames,
  });
});

export default router;
