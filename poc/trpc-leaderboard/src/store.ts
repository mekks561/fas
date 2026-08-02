// ===================================================================
// 内存存储 - POC 用，避免依赖外部数据库
// 专注验证 tRPC 类型安全，数据持久化不是本 POC 重点
// ===================================================================

import type { SubmitScoreInput, Difficulty } from './schemas/leaderboard.js';

interface StoredEntry extends SubmitScoreInput {
  id: string;
  timestamp: Date;
  difficulty: Difficulty;
}

const store = new Map<string, StoredEntry>();
let counter = 0;

function nextId(): string {
  counter++;
  return `entry_${counter}`;
}

export function insertEntry(input: SubmitScoreInput): StoredEntry {
  const entry: StoredEntry = {
    ...input,
    id: nextId(),
    timestamp: new Date(),
    difficulty: input.difficulty ?? 'normal',
  };
  store.set(entry.id, entry);
  return entry;
}

export function listEntries(limit: number, difficulty?: Difficulty): StoredEntry[] {
  const all = Array.from(store.values());
  const filtered = difficulty ? all.filter((e) => e.difficulty === difficulty) : all;
  return filtered.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function findBestByPlayer(playerId: string): StoredEntry | undefined {
  const playerEntries = Array.from(store.values()).filter((e) => e.playerId === playerId);
  return playerEntries.sort((a, b) => b.score - a.score)[0];
}

export function countHigherThan(score: number): number {
  let count = 0;
  for (const entry of store.values()) {
    if (entry.score > score) count++;
  }
  return count;
}

export function totalCount(): number {
  return store.size;
}

export function seedIfEmpty(): void {
  if (store.size > 0) return;
  const names = ['星际猎人', '银河守卫', '宇宙战神', '光速战士', '暗夜游侠'];
  const difficulties: Difficulty[] = ['easy', 'normal', 'hard', 'expert'];
  for (let i = 0; i < 20; i++) {
    const diff = difficulties[i % difficulties.length]!;
    insertEntry({
      playerId: `seed_${i}`,
      playerName: `${names[i % names.length]!}_${i}`,
      score: 10000 + Math.floor(Math.random() * 200000),
      wave: 5 + Math.floor(Math.random() * 30),
      kills: 20 + Math.floor(Math.random() * 200),
      accuracy: Math.random(),
      maxCombo: Math.floor(Math.random() * 100),
      difficulty: diff,
    });
  }
}
