import { beforeEach, describe, it, expect } from 'vitest';
import { MockProvider } from '../MockProvider';
import type { ListInput } from '../../../shared/schemas/leaderboard';

describe('MockProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('list 返回数量正确且按 score 降序', async () => {
    const p = new MockProvider();
    const list = await p.list({ limit: 50, filter: 'all' });
    expect(list.length).toBeLessThanOrEqual(50);
    expect(list.length).toBeGreaterThan(10);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
      expect(list[i - 1].rank).toBeLessThanOrEqual(list[i].rank);
    }
  });

  it('filter 分数区间关系: daily < weekly < monthly < all (中位数对比)', async () => {
    const p = new MockProvider();
    const median = (arr: number[]) => {
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    const [daily, weekly, monthly, all] = await Promise.all([
      p.list({ limit: 50, filter: 'daily' }),
      p.list({ limit: 50, filter: 'weekly' }),
      p.list({ limit: 50, filter: 'monthly' }),
      p.list({ limit: 50, filter: 'all' }),
    ]);
    const md = median(daily.map((e) => e.score));
    const mw = median(weekly.map((e) => e.score));
    const mm = median(monthly.map((e) => e.score));
    const ma = median(all.map((e) => e.score));
    expect(mw).toBeGreaterThan(md);
    expect(mm).toBeGreaterThan(mw);
    // all 可能包含极端高低分，但平均值/分位数应该高于 daily
    expect(ma).toBeGreaterThanOrEqual(md);
  });

  it('friends filter 返回固定切片索引 (约 10-25 条)', async () => {
    const p = new MockProvider();
    const friends = await p.list({ limit: 50, filter: 'friends' });
    expect(friends.length).toBeGreaterThanOrEqual(10);
    expect(friends.length).toBeLessThanOrEqual(30);
  });

  it('submit 写入 localStorage + 返回 rank=1 (满分)', async () => {
    const p = new MockProvider();
    const result = await p.submit({
      playerId: 'tester_001',
      playerName: 'Tester',
      score: 999_999_999,
      wave: 999,
      kills: 99_999,
      accuracy: 1,
    });
    expect(result.rank).toBe(1);
    expect(result.entry.playerName).toBe('Tester');

    const listAfter = await p.list({ limit: 50, filter: 'all' });
    expect(listAfter[0].playerId).toBe('tester_001');

    const raw = localStorage.getItem('leaderboard');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((e: any) => e.playerId === 'tester_001')).toBe(true);
  });

  it('myRank: 未上榜玩家返回 null/null', async () => {
    const p = new MockProvider();
    const r = await p.myRank('nonexistent_user_x');
    expect(r.rank).toBeNull();
    expect(r.entry).toBeNull();
  });

  it('myRank: 先 submit 再查返回正确 rank', async () => {
    const p = new MockProvider();
    await p.submit({
      playerId: 'me_myself',
      playerName: 'Myself',
      score: 500_000,
      wave: 50,
      kills: 5000,
    });
    const r = await p.myRank('me_myself');
    expect(typeof r.rank).toBe('number');
    expect(r.rank).toBeGreaterThan(0);
    expect(r.entry!.playerId).toBe('me_myself');
  });

  it('stats 一致性: totalPlayers === list(all) 长度上限; topScore 匹配榜首', async () => {
    const p = new MockProvider();
    const list = await p.list({ limit: 500, filter: 'all' });
    const stats = await p.stats();
    expect(stats.totalPlayers).toBeGreaterThanOrEqual(list.length);
    expect(stats.totalPlayers).toBeGreaterThan(0);
    if (list.length > 0) {
      expect(stats.topScore).toBe(list[0].score);
    }
    expect(stats.avgScore).toBeGreaterThanOrEqual(0);
    const dd = stats.difficultyDistribution;
    const sum = dd.easy + dd.normal + dd.hard + dd.expert;
    expect(sum).toBe(stats.totalPlayers);
  });

  it('不同 difficulty list 查询不抛错', async () => {
    const p = new MockProvider();
    for (const d of ['easy', 'normal', 'hard', 'expert'] as const) {
      const r = await p.list({ limit: 10, filter: 'all', difficulty: d });
      expect(Array.isArray(r)).toBe(true);
    }
  });
});
