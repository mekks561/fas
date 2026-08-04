import { prisma } from './prisma/client.js';
import type { SubmitScoreInput, Difficulty } from './schemas/leaderboard.js';

export interface StoredEntry {
  id: string;
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
  difficulty: string;
  timestamp: Date;
}

export async function insertEntry(input: SubmitScoreInput): Promise<StoredEntry> {
  const created = await prisma.leaderboardEntry.create({
    data: {
      playerId: input.playerId,
      playerName: input.playerName,
      score: input.score,
      wave: input.wave,
      kills: input.kills,
      accuracy: input.accuracy ?? null,
      maxCombo: input.maxCombo ?? null,
      bossesKilled: input.bossesKilled ?? null,
      elitesKilled: input.elitesKilled ?? null,
      playTime: input.playTime ?? null,
      powerupsCollected: input.powerupsCollected ?? null,
      damageDealt: input.damageDealt ?? null,
      damageTaken: input.damageTaken ?? null,
      rankGrade: input.rankGrade ?? null,
      difficulty: input.difficulty ?? 'normal',
    },
  });
  return created as StoredEntry;
}

export async function listEntries(limit: number, difficulty?: Difficulty): Promise<StoredEntry[]> {
  const entries = await prisma.leaderboardEntry.findMany({
    where: difficulty ? { difficulty } : undefined,
    orderBy: { score: 'desc' },
    take: limit,
  });
  return entries as StoredEntry[];
}

export async function findBestByPlayer(playerId: string): Promise<StoredEntry | null> {
  const entries = await prisma.leaderboardEntry.findMany({
    where: { playerId },
    orderBy: { score: 'desc' },
    take: 1,
  });
  return (entries[0] as StoredEntry | undefined) ?? null;
}

export async function countHigherThan(score: number): Promise<number> {
  return prisma.leaderboardEntry.count({
    where: { score: { gt: score } },
  });
}

export async function totalCount(): Promise<number> {
  return prisma.leaderboardEntry.count();
}

export async function seedIfEmpty(): Promise<void> {
  const count = await totalCount();
  if (count > 0) return;

  const names = ['星际猎人', '银河守卫', '宇宙战神', '光速战士', '暗夜游侠'];
  const difficulties: Difficulty[] = ['easy', 'normal', 'hard', 'expert'];
  const data = Array.from({ length: 20 }, (_, i) => ({
    playerId: `seed_${i}`,
    playerName: `${names[i % names.length]!}_${i}`,
    score: 10000 + Math.floor(Math.random() * 200000),
    wave: 5 + Math.floor(Math.random() * 30),
    kills: 20 + Math.floor(Math.random() * 200),
    accuracy: Math.random(),
    maxCombo: Math.floor(Math.random() * 100),
    difficulty: difficulties[i % difficulties.length]!,
  }));
  await prisma.leaderboardEntry.createMany({ data });
}
