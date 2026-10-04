// ===================================================================
// Zod Schema - 对齐前端 src/engine/CloudSaveSystem.ts 的 LeaderboardEntry
// 作为运行时校验 + 类型推导的唯一来源（端到端类型安全的基础）
// ===================================================================

import { z } from 'zod';

// 难度枚举 - 对齐前端 GameSettings.difficulty
export const difficultySchema = z.enum(['easy', 'normal', 'hard', 'expert']);

// 提交分数 body schema - 对齐前端 Omit<LeaderboardEntry, 'rank' | 'timestamp'>
// 前端 CloudSaveSystem.submitScore(entry: Omit<LeaderboardEntry, 'rank' | 'timestamp'>)
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
  // difficulty 不属于 LeaderboardEntry，但 POC 支持按难度分榜，可选传入
  difficulty: difficultySchema.optional(),
});

export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;

// 响应中的条目 schema - 对齐前端 LeaderboardEntry（timestamp 转为 number 毫秒）
export const leaderboardEntrySchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  score: z.number(),
  wave: z.number(),
  kills: z.number(),
  timestamp: z.number(),
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
