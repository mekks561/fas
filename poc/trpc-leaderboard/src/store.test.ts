import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from './prisma/client.js';
import {
  insertEntry,
  listEntries,
  findBestByPlayer,
  countHigherThan,
  totalCount,
  seedIfEmpty,
} from './store.js';

beforeEach(async () => {
  await prisma.leaderboardEntry.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('store - insertEntry', () => {
  it('插入一条记录，返回完整字段', async () => {
    const entry = await insertEntry({
      playerId: 'p1',
      playerName: 'Alice',
      score: 1000,
      wave: 5,
      kills: 10,
    });
    expect(entry.id).toBeDefined();
    expect(entry.playerId).toBe('p1');
    expect(entry.score).toBe(1000);
    expect(entry.difficulty).toBe('normal');
    expect(entry.timestamp).toBeInstanceOf(Date);
  });

  it('可选字段为 null (未提供时)', async () => {
    const entry = await insertEntry({
      playerId: 'p1',
      playerName: 'Alice',
      score: 1000,
      wave: 5,
      kills: 10,
    });
    expect(entry.accuracy).toBeNull();
    expect(entry.maxCombo).toBeNull();
    expect(entry.bossesKilled).toBeNull();
  });

  it('可选字段有值 (提供时)', async () => {
    const entry = await insertEntry({
      playerId: 'p1',
      playerName: 'Alice',
      score: 1000,
      wave: 5,
      kills: 10,
      accuracy: 0.85,
      maxCombo: 50,
      difficulty: 'hard',
    });
    expect(entry.accuracy).toBe(0.85);
    expect(entry.maxCombo).toBe(50);
    expect(entry.difficulty).toBe('hard');
  });
});

describe('store - listEntries', () => {
  it('按 score 降序返回，limit 生效', async () => {
    await insertEntry({ playerId: 'p1', playerName: 'A', score: 100, wave: 1, kills: 0 });
    await insertEntry({ playerId: 'p2', playerName: 'B', score: 300, wave: 1, kills: 0 });
    await insertEntry({ playerId: 'p3', playerName: 'C', score: 200, wave: 1, kills: 0 });
    const list = await listEntries(2);
    expect(list).toHaveLength(2);
    expect(list[0]!.score).toBe(300);
    expect(list[1]!.score).toBe(200);
  });

  it('difficulty filter 生效', async () => {
    await insertEntry({
      playerId: 'p1',
      playerName: 'A',
      score: 100,
      wave: 1,
      kills: 0,
      difficulty: 'hard',
    });
    await insertEntry({
      playerId: 'p2',
      playerName: 'B',
      score: 200,
      wave: 1,
      kills: 0,
      difficulty: 'easy',
    });
    const list = await listEntries(10, 'hard');
    expect(list).toHaveLength(1);
    expect(list[0]!.playerId).toBe('p1');
  });
});

describe('store - findBestByPlayer', () => {
  it('返回该玩家最高分记录', async () => {
    await insertEntry({ playerId: 'p1', playerName: 'A', score: 100, wave: 1, kills: 0 });
    await insertEntry({ playerId: 'p1', playerName: 'A', score: 300, wave: 1, kills: 0 });
    await insertEntry({ playerId: 'p1', playerName: 'A', score: 200, wave: 1, kills: 0 });
    const best = await findBestByPlayer('p1');
    expect(best?.score).toBe(300);
  });

  it('玩家不存在返回 null', async () => {
    const best = await findBestByPlayer('nobody');
    expect(best).toBeNull();
  });
});

describe('store - countHigherThan + totalCount', () => {
  it('统计高于分数的记录数', async () => {
    await insertEntry({ playerId: 'p1', playerName: 'A', score: 100, wave: 1, kills: 0 });
    await insertEntry({ playerId: 'p2', playerName: 'B', score: 300, wave: 1, kills: 0 });
    await insertEntry({ playerId: 'p3', playerName: 'C', score: 200, wave: 1, kills: 0 });
    expect(await countHigherThan(150)).toBe(2);
    expect(await totalCount()).toBe(3);
  });
});

describe('store - seedIfEmpty', () => {
  it('空表时插入 20 条种子', async () => {
    await seedIfEmpty();
    expect(await totalCount()).toBe(20);
  });

  it('非空表时不重复插入 (幂等)', async () => {
    await insertEntry({ playerId: 'manual', playerName: 'M', score: 1, wave: 1, kills: 0 });
    await seedIfEmpty();
    expect(await totalCount()).toBe(1);
  });
});
