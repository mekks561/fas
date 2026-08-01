import { describe, it, expect } from 'vitest';
import {
  difficultySchema,
  submitScoreSchema,
  leaderboardEntrySchema,
  listInputSchema,
  myRankResultSchema,
  statsSchema,
} from '../leaderboard';

describe('difficultySchema', () => {
  it('接受四种合法难度', () => {
    expect(difficultySchema.parse('easy')).toBe('easy');
    expect(difficultySchema.parse('normal')).toBe('normal');
    expect(difficultySchema.parse('hard')).toBe('hard');
    expect(difficultySchema.parse('expert')).toBe('expert');
  });

  it('拒绝非法难度字符串', () => {
    expect(() => difficultySchema.parse('insane')).toThrow();
    expect(() => difficultySchema.parse('')).toThrow();
    expect(() => difficultySchema.parse(123)).toThrow();
  });
});

describe('submitScoreSchema', () => {
  const valid = {
    playerId: 'p_001',
    playerName: 'StarPilot',
    score: 95000,
    wave: 25,
    kills: 150,
  };

  it('接受合法必填字段', () => {
    const r = submitScoreSchema.parse(valid);
    expect(r.score).toBe(95000);
    expect(r.accuracy).toBeUndefined();
  });

  it('接受完整可选字段（accuracy, maxCombo, difficulty 等）', () => {
    const full = {
      ...valid,
      accuracy: 0.87,
      maxCombo: 120,
      bossesKilled: 3,
      elitesKilled: 25,
      playTime: 1800,
      powerupsCollected: 15,
      damageDealt: 250000,
      damageTaken: 45000,
      rankGrade: 'S',
      difficulty: 'hard' as const,
    };
    const r = submitScoreSchema.parse(full);
    expect(r.accuracy).toBe(0.87);
    expect(r.difficulty).toBe('hard');
  });

  it('拒绝负数 score', () => {
    expect(() => submitScoreSchema.parse({ ...valid, score: -1 })).toThrow();
  });

  it('拒绝超界 score (十亿零一)', () => {
    expect(() => submitScoreSchema.parse({ ...valid, score: 1_000_000_001 })).toThrow();
  });

  it('拒绝非整数 wave', () => {
    expect(() => submitScoreSchema.parse({ ...valid, wave: 5.7 })).toThrow();
  });

  it('拒绝超界 kills (十万)', () => {
    expect(() => submitScoreSchema.parse({ ...valid, kills: 100_000 })).toThrow();
  });

  it('拒绝空字符串 playerId', () => {
    expect(() => submitScoreSchema.parse({ ...valid, playerId: '' })).toThrow();
  });

  it('拒绝缺失必填字段（无 playerName）', () => {
    const { playerName: _skip, ...rest } = valid;
    expect(() => submitScoreSchema.parse(rest)).toThrow();
  });

  it('拒绝 accuracy > 1 或 < 0', () => {
    expect(() => submitScoreSchema.parse({ ...valid, accuracy: 1.5 })).toThrow();
    expect(() => submitScoreSchema.parse({ ...valid, accuracy: -0.1 })).toThrow();
  });

  it('拒绝 playerName 超长 (33+ chars)', () => {
    expect(() => submitScoreSchema.parse({ ...valid, playerName: 'A'.repeat(33) })).toThrow();
  });
});

describe('leaderboardEntrySchema', () => {
  it('接受合法条目（含 Date timestamp）', () => {
    const entry = {
      playerId: 'p_001',
      playerName: 'StarPilot',
      score: 95000,
      wave: 25,
      kills: 150,
      timestamp: new Date('2026-08-02T00:00:00Z'),
      rank: 1,
      accuracy: 0.87,
    };
    const r = leaderboardEntrySchema.parse(entry);
    expect(r.rank).toBe(1);
    expect(r.timestamp).toBeInstanceOf(Date);
  });

  it('拒绝 timestamp 不是 Date', () => {
    const bad = {
      playerId: 'p_001',
      playerName: 'A',
      score: 1,
      wave: 1,
      kills: 1,
      timestamp: Date.now(),
      rank: 1,
    };
    expect(() => leaderboardEntrySchema.parse(bad)).toThrow();
  });

  it('拒绝缺失 rank 字段', () => {
    const bad = {
      playerId: 'p_001',
      playerName: 'A',
      score: 1,
      wave: 1,
      kills: 1,
      timestamp: new Date(),
    };
    expect(() => leaderboardEntrySchema.parse(bad)).toThrow();
  });
});

describe('listInputSchema', () => {
  it('接受 limit + difficulty + filter 全参数', () => {
    const r = listInputSchema.parse({ limit: 25, difficulty: 'hard', filter: 'weekly' });
    expect(r.limit).toBe(25);
    expect(r.filter).toBe('weekly');
  });

  it('默认 limit=50', () => {
    const r = listInputSchema.parse({});
    expect(r.limit).toBe(50);
  });

  it('拒绝 limit < 1 或 > 500', () => {
    expect(() => listInputSchema.parse({ limit: 0 })).toThrow();
    expect(() => listInputSchema.parse({ limit: 501 })).toThrow();
  });

  it('拒绝非法 filter', () => {
    expect(() => listInputSchema.parse({ filter: 'yearly' })).toThrow();
  });
});

describe('myRankResultSchema', () => {
  it('接受 rank=null + entry=null（未上榜）', () => {
    const r = myRankResultSchema.parse({ rank: null, entry: null });
    expect(r.rank).toBeNull();
  });

  it('接受合法 rank + entry', () => {
    const entry = {
      playerId: 'me',
      playerName: 'Me',
      score: 1000,
      wave: 5,
      kills: 20,
      timestamp: new Date(),
      rank: 10,
    };
    const r = myRankResultSchema.parse({ rank: 10, entry });
    expect(r.rank).toBe(10);
  });
});

describe('statsSchema', () => {
  it('接受完整 stats', () => {
    const r = statsSchema.parse({
      totalPlayers: 150,
      topScore: 999_999,
      avgScore: 150_000,
      difficultyDistribution: { easy: 10, normal: 80, hard: 50, expert: 10 },
    });
    expect(r.totalPlayers).toBe(150);
  });

  it('拒绝 negative topScore', () => {
    expect(() =>
      statsSchema.parse({
        totalPlayers: 1,
        topScore: -1,
        avgScore: 0,
        difficultyDistribution: { easy: 0, normal: 1, hard: 0, expert: 0 },
      }),
    ).toThrow();
  });
});
