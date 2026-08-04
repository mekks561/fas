// ===================================================================
// tRPC Leaderboard Router
// 每个 procedure 的 .input(zodSchema) 同时提供：
//   1. 运行时校验（拒绝非法输入）
//   2. 编译期类型（客户端自动推导，无需手写类型）
// .output(zodSchema) 校验响应结构，防止服务端返回脏数据
// ===================================================================

import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import {
  submitScoreSchema,
  leaderboardEntrySchema,
  myRankSchema,
  listInputSchema,
} from '../schemas/leaderboard.js';
import {
  insertEntry,
  listEntries,
  findBestByPlayer,
  countHigherThan,
  totalCount,
} from '../store.js';

// Prisma StoredEntry (null) → Zod optional (undefined) 的转换辅助
function toDTO(
  e: {
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
) {
  return {
    playerId: e.playerId,
    playerName: e.playerName,
    score: e.score,
    wave: e.wave,
    kills: e.kills,
    timestamp: e.timestamp,
    rank,
    accuracy: e.accuracy ?? undefined,
    maxCombo: e.maxCombo ?? undefined,
    bossesKilled: e.bossesKilled ?? undefined,
    elitesKilled: e.elitesKilled ?? undefined,
    playTime: e.playTime ?? undefined,
    powerupsCollected: e.powerupsCollected ?? undefined,
    damageDealt: e.damageDealt ?? undefined,
    damageTaken: e.damageTaken ?? undefined,
    rankGrade: e.rankGrade ?? undefined,
  };
}

export const leaderboardRouter = router({
  // 查询排行榜 - query
  list: publicProcedure
    .input(listInputSchema)
    .output(z.array(leaderboardEntrySchema))
    .query(async ({ input }) => {
      const { limit, difficulty } = input;
      const entries = await listEntries(limit, difficulty);
      return entries.map((e, i) => toDTO(e, i + 1));
    }),

  // 提交分数 - mutation
  submit: publicProcedure
    .input(submitScoreSchema)
    .output(leaderboardEntrySchema)
    .mutation(async ({ input }) => {
      const stored = await insertEntry(input);
      const rank = (await countHigherThan(stored.score)) + 1;
      return toDTO(stored, rank);
    }),

  // 个人最佳排名 - query
  myRank: publicProcedure
    .input(z.object({ playerId: z.string().min(1) }))
    .output(myRankSchema)
    .query(async ({ input }) => {
      const best = await findBestByPlayer(input.playerId);
      if (!best) return { rank: null, entry: null };
      const rank = (await countHigherThan(best.score)) + 1;
      return {
        rank,
        entry: toDTO(best, rank),
      };
    }),

  // 统计 - query
  stats: publicProcedure.query(async () => {
    const entries = await listEntries(500);
    const total = await totalCount();
    const scores = entries.map((e) => e.score);
    const sum = scores.reduce((a, b) => a + b, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayGames = entries.filter((e) => e.timestamp >= today).length;
    return {
      totalPlayers: total,
      avgScore: total > 0 ? Math.round(sum / total) : 0,
      topScore: scores[0] ?? 0,
      todayGames,
    };
  }),
});
