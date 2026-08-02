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

export const leaderboardRouter = router({
  // 查询排行榜 - query
  list: publicProcedure
    .input(listInputSchema)
    .output(z.array(leaderboardEntrySchema))
    .query(({ input }) => {
      const { limit, difficulty } = input;
      const entries = listEntries(limit, difficulty);
      return entries.map((e, i) => ({
        playerId: e.playerId,
        playerName: e.playerName,
        score: e.score,
        wave: e.wave,
        kills: e.kills,
        timestamp: e.timestamp,
        rank: i + 1,
        accuracy: e.accuracy,
        maxCombo: e.maxCombo,
        bossesKilled: e.bossesKilled,
        elitesKilled: e.elitesKilled,
        playTime: e.playTime,
        powerupsCollected: e.powerupsCollected,
        damageDealt: e.damageDealt,
        damageTaken: e.damageTaken,
        rankGrade: e.rankGrade,
      }));
    }),

  // 提交分数 - mutation
  submit: publicProcedure
    .input(submitScoreSchema)
    .output(leaderboardEntrySchema)
    .mutation(({ input }) => {
      const stored = insertEntry(input);
      const rank = countHigherThan(stored.score) + 1;
      return {
        playerId: stored.playerId,
        playerName: stored.playerName,
        score: stored.score,
        wave: stored.wave,
        kills: stored.kills,
        timestamp: stored.timestamp,
        rank,
        accuracy: stored.accuracy,
        maxCombo: stored.maxCombo,
        bossesKilled: stored.bossesKilled,
        elitesKilled: stored.elitesKilled,
        playTime: stored.playTime,
        powerupsCollected: stored.powerupsCollected,
        damageDealt: stored.damageDealt,
        damageTaken: stored.damageTaken,
        rankGrade: stored.rankGrade,
      };
    }),

  // 个人最佳排名 - query
  myRank: publicProcedure
    .input(z.object({ playerId: z.string().min(1) }))
    .output(myRankSchema)
    .query(({ input }) => {
      const best = findBestByPlayer(input.playerId);
      if (!best) return { rank: null, entry: null };
      const rank = countHigherThan(best.score) + 1;
      return {
        rank,
        entry: {
          playerId: best.playerId,
          playerName: best.playerName,
          score: best.score,
          wave: best.wave,
          kills: best.kills,
          timestamp: best.timestamp,
          rank,
          accuracy: best.accuracy,
          maxCombo: best.maxCombo,
          bossesKilled: best.bossesKilled,
          elitesKilled: best.elitesKilled,
          playTime: best.playTime,
          powerupsCollected: best.powerupsCollected,
          damageDealt: best.damageDealt,
          damageTaken: best.damageTaken,
          rankGrade: best.rankGrade,
        },
      };
    }),

  // 统计 - query
  stats: publicProcedure.query(() => {
    const entries = listEntries(500);
    const total = totalCount();
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
