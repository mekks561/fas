import { z } from 'zod';

export const difficultySchema = z.enum(['easy', 'normal', 'hard', 'expert']);
export type Difficulty = z.infer<typeof difficultySchema>;

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
  difficulty: difficultySchema.optional(),
});
export type LeaderboardEntryDTO = z.infer<typeof leaderboardEntrySchema>;

export const listInputSchema = z.object({
  limit: z.number().min(1).max(500).default(50),
  difficulty: difficultySchema.optional(),
  filter: z.enum(['all', 'daily', 'weekly', 'monthly', 'friends']).default('all'),
});
export type ListInput = z.infer<typeof listInputSchema>;

export const myRankResultSchema = z.object({
  rank: z.number().nullable(),
  entry: leaderboardEntrySchema.nullable(),
});
export type MyRankResult = z.infer<typeof myRankResultSchema>;

export const statsSchema = z.object({
  totalPlayers: z.number().int().min(0),
  topScore: z.number().int().min(0),
  avgScore: z.number().int().min(0),
  difficultyDistribution: z.object({
    easy: z.number().int().min(0),
    normal: z.number().int().min(0),
    hard: z.number().int().min(0),
    expert: z.number().int().min(0),
  }),
});
export type LeaderboardStatsDTO = z.infer<typeof statsSchema>;
