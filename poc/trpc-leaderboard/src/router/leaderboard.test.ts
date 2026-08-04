import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../prisma/client.js';
import { appRouter } from './index.js';
import { createContext } from '../context.js';

const caller = appRouter.createCaller(createContext());

beforeEach(async () => {
  await prisma.leaderboardEntry.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('router - list procedure', () => {
  it('返回按 rank 排序的列表', async () => {
    await prisma.leaderboardEntry.createMany({
      data: [
        { playerId: 'p1', playerName: 'A', score: 100, wave: 1, kills: 0 },
        { playerId: 'p2', playerName: 'B', score: 300, wave: 1, kills: 0 },
      ],
    });
    const list = await caller.leaderboard.list({ limit: 10 });
    expect(list).toHaveLength(2);
    expect(list[0]!.rank).toBe(1);
    expect(list[0]!.score).toBe(300);
    expect(list[1]!.rank).toBe(2);
    expect(list[1]!.score).toBe(100);
  });

  it('limit 生效', async () => {
    await prisma.leaderboardEntry.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        playerId: `p${i}`,
        playerName: `P${i}`,
        score: 100 - i,
        wave: 1,
        kills: 0,
      })),
    });
    const list = await caller.leaderboard.list({ limit: 2 });
    expect(list).toHaveLength(2);
  });
});

describe('router - submit procedure', () => {
  it('提交后返回带 rank 的 entry', async () => {
    await prisma.leaderboardEntry.create({
      data: { playerId: 'p1', playerName: 'A', score: 500, wave: 1, kills: 0 },
    });
    const result = await caller.leaderboard.submit({
      playerId: 'p2',
      playerName: 'B',
      score: 1000,
      wave: 5,
      kills: 10,
    });
    expect(result.rank).toBe(1);
    expect(result.score).toBe(1000);
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('可选字段正确返回', async () => {
    const result = await caller.leaderboard.submit({
      playerId: 'p1',
      playerName: 'A',
      score: 100,
      wave: 1,
      kills: 0,
      accuracy: 0.9,
      maxCombo: 50,
      difficulty: 'hard',
    });
    expect(result.accuracy).toBe(0.9);
    expect(result.maxCombo).toBe(50);
  });
});

describe('router - myRank procedure', () => {
  it('返回玩家最佳成绩的排名', async () => {
    await prisma.leaderboardEntry.create({
      data: { playerId: 'p1', playerName: 'A', score: 200, wave: 1, kills: 0 },
    });
    await prisma.leaderboardEntry.create({
      data: { playerId: 'p2', playerName: 'B', score: 500, wave: 1, kills: 0 },
    });
    const result = await caller.leaderboard.myRank({ playerId: 'p1' });
    expect(result.rank).toBe(2);
    expect(result.entry?.score).toBe(200);
  });

  it('玩家不存在返回 null', async () => {
    const result = await caller.leaderboard.myRank({ playerId: 'nobody' });
    expect(result.rank).toBeNull();
    expect(result.entry).toBeNull();
  });
});

describe('router - stats procedure', () => {
  it('返回正确的统计数据', async () => {
    await prisma.leaderboardEntry.createMany({
      data: [
        { playerId: 'p1', playerName: 'A', score: 100, wave: 1, kills: 0 },
        { playerId: 'p2', playerName: 'B', score: 300, wave: 1, kills: 0 },
      ],
    });
    const stats = await caller.leaderboard.stats();
    expect(stats.totalPlayers).toBe(2);
    expect(stats.topScore).toBe(300);
    expect(stats.avgScore).toBe(200);
  });
});
