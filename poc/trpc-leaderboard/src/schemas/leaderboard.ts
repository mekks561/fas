// ===================================================================
// 共享 Zod Schema - tRPC 端到端类型安全的核心
// 这些 schema 同时作为：服务端输入校验 + 输出验证 + 客户端类型推导来源
// 与 Neon POC 的 schema 保持一致，确保两个 POC 可合并
// ===================================================================

import { z } from 'zod';

export const difficultySchema = z.enum(['easy', 'normal', 'hard', 'expert']);
export type Difficulty = z.infer<typeof difficultySchema>;

// 提交分数输入 - 对齐前端 Omit<LeaderboardEntry, 'rank' | 'timestamp'>
export const submitScoreSchema = z.object({
  playerId: z.string().min(1).max(64),
  playerName: z.string().min(1).max(32),
  score: z.number().int().min(0).max(1_000_000_000),
  wave: z.number().int().min(0).max(999),
  kills: z.number().int().min(0).max(99_999),
  accuracy: z.number().min(0).max(1).optional(),
  maxCombo: z.number().int().min(0).max(99_999).optional(),
  bossesKilled: z.number().int().min(0).max(999).optional(),
  elitesKilled: z.number().int().min(0).max(9_999).optional(),
  playTime: z.number().int().min(0).max(86_400).optional(),
  powerupsCollected: z.number().int().min(0).max(9_999).optional(),
  damageDealt: z.number().int().min(0).max(99_999_999).optional(),
  damageTaken: z.number().int().min(0).max(99_999_999).optional(),
  rankGrade: z.string().max(4).optional(),
  difficulty: difficultySchema.optional(),
});
export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;

// 排行榜条目输出 - 对齐前端 LeaderboardEntry
// 注意：timestamp 用 Date，依赖 superjson transformer 自动序列化为 ISO 字符串
export const leaderboardEntrySchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  score: z.number(),
  wave: z.number(),
  kills: z.number(),
  timestamp: z.date(),
  rank: z.number(),
  accuracy: z.number().optional(),
  maxCombo: z.number().optional(),
  bossesKilled: z.number().optional(),
  elitesKilled: z.number().optional(),
  playTime: z.number().optional(),
  powerupsCollected: z.number().optional(),
  damageDealt: z.number().optional(),
  damageTaken: z.number().optional(),
  rankGrade: z.string().optional(),
});
export type LeaderboardEntryDTO = z.infer<typeof leaderboardEntrySchema>;

// 个人排名输出
export const myRankSchema = z.object({
  rank: z.number().nullable(),
  entry: leaderboardEntrySchema.nullable(),
});
export type MyRankDTO = z.infer<typeof myRankSchema>;

// list 查询输入
export const listInputSchema = z.object({
  limit: z.number().min(1).max(500).default(50),
  difficulty: difficultySchema.optional(),
});
