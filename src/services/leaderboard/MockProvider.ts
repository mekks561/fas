import type { LeaderboardProvider, SubmitResult } from './types';
import type {
  ListInput,
  LeaderboardEntryDTO,
  MyRankResult,
  LeaderboardStatsDTO,
  SubmitScoreInput,
} from '../../shared/schemas/leaderboard';

const MOCK_NAMES: string[] = [
  '星际猎人',
  '银河守卫',
  '宇宙战神',
  '光速战士',
  '暗夜游侠',
  '雷霆指挥官',
  '风暴使者',
  '烈焰骑士',
  '冰霜刺客',
  '暗影杀手',
  '星辰主宰',
  '虚空行者',
  '量子战士',
  '时空猎人',
  '永恒守护者',
  '无尽探索者',
  '银河霸主',
  '宇宙先锋',
  '星际王牌',
  '绝对王者',
  '狂暴战士',
  '沉默猎手',
  '迅捷刺客',
  '重装炮手',
  '致命狙击手',
  '闪电侠',
  '火焰风暴',
  '冰霜女王',
  '暗影领主',
  '光明使者',
  '战神',
  '剑圣',
  '魔法师',
  '弓箭手',
  '刺客',
  '圣骑士',
  '德鲁伊',
  '萨满',
  '猎人',
  '术士',
  '战士',
  '牧师',
  '法师',
  '盗贼',
  '死亡骑士',
  '恶魔猎手',
  '武僧',
  '恶魔战士',
  '幽灵',
  '亡灵',
];

const STORAGE_KEY = 'leaderboard';

export class MockProvider implements LeaderboardProvider {
  readonly kind = 'mock' as const;
  private entries: LeaderboardEntryDTO[] = [];

  constructor() {
    this.entries = this.loadFromStorage();
    if (this.entries.length === 0) {
      this.entries = this.generateSeedEntries();
      this.persist();
    }
  }

  private loadFromStorage(): LeaderboardEntryDTO[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as any[];
      return parsed.map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      }));
    } catch {
      return [];
    }
  }

  private persist(): void {
    const serializable = this.entries.map((e) => ({
      ...e,
      timestamp: e.timestamp.getTime(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  }

  private generateSeedEntries(): LeaderboardEntryDTO[] {
    const now = Date.now();
    const entries: LeaderboardEntryDTO[] = [];
    const difficulties: Array<'easy' | 'normal' | 'hard' | 'expert'> = [
      'easy',
      'normal',
      'hard',
      'expert',
    ];

    for (let i = 0; i < 50; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      // 让远期玩家(daysAgo 大)分数更高，符合"老兵积分累积更多"的直觉。
      // 这样 daily < weekly < monthly < all 的中位数关系能稳定成立（修复计划统计缺陷）。
      const timeBoost = daysAgo / 30; // 0..1
      const baseScore = 1000 + timeBoost * 700_000 + Math.random() * 300_000;
      entries.push({
        playerId: `mock_player_${i}`,
        playerName: MOCK_NAMES[i % MOCK_NAMES.length] + (i >= MOCK_NAMES.length ? `_${i}` : ''),
        score: Math.floor(baseScore),
        wave: Math.floor(5 + Math.random() * 50),
        kills: Math.floor(20 + Math.random() * 300),
        timestamp: new Date(now - daysAgo * 24 * 60 * 60 * 1000),
        rank: i + 1,
        accuracy: 0.3 + Math.random() * 0.65,
        maxCombo: Math.floor(10 + Math.random() * 200),
        bossesKilled: Math.floor(Math.random() * 8),
        elitesKilled: Math.floor(Math.random() * 60),
        playTime: Math.floor(60 + Math.random() * 3000),
        powerupsCollected: Math.floor(Math.random() * 40),
        damageDealt: Math.floor(Math.random() * 5_000_000),
        damageTaken: Math.floor(Math.random() * 500_000),
        difficulty: difficulties[Math.floor(Math.random() * difficulties.length)],
      });
    }
    return entries.sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 }));
  }

  private assignRanks(entries: LeaderboardEntryDTO[]): LeaderboardEntryDTO[] {
    return entries.map((e, i) => ({ ...e, rank: i + 1 }));
  }

  private filterByTimeRange(
    entries: LeaderboardEntryDTO[],
    filter: ListInput['filter'],
  ): LeaderboardEntryDTO[] {
    if (filter === 'all') return entries;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const cutoff =
      filter === 'daily'
        ? now - dayMs
        : filter === 'weekly'
          ? now - 7 * dayMs
          : filter === 'monthly'
            ? now - 30 * dayMs
            : 0;
    return entries.filter((e) => e.timestamp.getTime() >= cutoff);
  }

  async list(input: ListInput): Promise<LeaderboardEntryDTO[]> {
    let result = [...this.entries].sort((a, b) => b.score - a.score);

    if (input.difficulty) {
      result = result.filter((e) => e.difficulty === input.difficulty || !e.difficulty);
    }

    if (input.filter === 'friends') {
      result = result.slice(10, 26);
    } else {
      result = this.filterByTimeRange(result, input.filter);
    }

    const ranked = this.assignRanks(result).slice(0, input.limit);
    return ranked;
  }

  async submit(input: SubmitScoreInput): Promise<SubmitResult> {
    const entry: LeaderboardEntryDTO = {
      ...input,
      timestamp: new Date(),
      rank: 1,
    };

    const merged = [...this.entries.filter((e) => e.playerId !== input.playerId), entry];
    const sorted = merged.sort((a, b) => b.score - a.score).slice(0, 100);
    this.entries = this.assignRanks(sorted);
    this.persist();

    const rank = this.entries.findIndex((e) => e.playerId === input.playerId) + 1;
    const e = this.entries.find((e) => e.playerId === input.playerId)!;
    return { rank, entry: e };
  }

  async myRank(playerId: string): Promise<MyRankResult> {
    const sorted = [...this.entries].sort((a, b) => b.score - a.score);
    const idx = sorted.findIndex((e) => e.playerId === playerId);
    if (idx < 0) return { rank: null, entry: null };
    const entry = { ...sorted[idx], rank: idx + 1 };
    return { rank: idx + 1, entry };
  }

  async stats(): Promise<LeaderboardStatsDTO> {
    const sorted = [...this.entries].sort((a, b) => b.score - a.score);
    const total = this.entries.length;
    const topScore = sorted[0]?.score ?? 0;
    const avgScore = total > 0 ? Math.floor(sorted.reduce((s, e) => s + e.score, 0) / total) : 0;

    const dd = { easy: 0, normal: 0, hard: 0, expert: 0 };
    for (const e of this.entries) {
      if (e.difficulty && e.difficulty in dd) {
        (dd as any)[e.difficulty]++;
      } else {
        dd.normal++;
      }
    }

    return {
      totalPlayers: total,
      topScore,
      avgScore,
      difficultyDistribution: dd,
    };
  }
}
