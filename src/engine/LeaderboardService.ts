import type { LeaderboardEntry } from './CloudSaveSystem';

export interface LeaderboardEntryWithRank extends LeaderboardEntry {
  rank: number;
}

export type LeaderboardFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'friends';

export interface LeaderboardStats {
  totalPlayers: number;
  yourRank: number;
  yourScore: number;
  topScore: number;
  avgScore: number;
}

export class LeaderboardService {
  private entries: LeaderboardEntryWithRank[] = [];
  private filter: LeaderboardFilter = 'all';
  private isLoading: boolean = false;
  private listeners: Set<() => void> = new Set();
  private currentPlayerId: string = 'default_player';
  private currentPlayerName: string = 'Player';

  constructor(playerId?: string, playerName?: string) {
    if (playerId) this.currentPlayerId = playerId;
    if (playerName) this.currentPlayerName = playerName;
    this.loadLocalLeaderboard();
  }

  private loadLocalLeaderboard(): void {
    const saved = localStorage.getItem('leaderboard');
    if (saved) {
      try {
        const data: LeaderboardEntry[] = JSON.parse(saved);
        this.entries = this.assignRanks(data.sort((a, b) => b.score - a.score));
      } catch (e) {
        console.warn('Failed to load local leaderboard:', e);
      }
    }
  }

  private assignRanks(entries: LeaderboardEntry[]): LeaderboardEntryWithRank[] {
    return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  async fetchLeaderboard(filter: LeaderboardFilter = 'all', limit: number = 50): Promise<void> {
    this.isLoading = true;
    this.filter = filter;
    this.notify();

    try {
      const mockEntries = this.generateMockEntries(limit, filter);
      this.entries = this.assignRanks(mockEntries);
    } catch (error) {
      console.warn('Failed to fetch leaderboard, using local data:', error);
    }

    this.isLoading = false;
    this.notify();
  }

  private generateMockEntries(count: number, filter: LeaderboardFilter): LeaderboardEntry[] {
    const names = [
      '星际猎人', '银河守卫', '宇宙战神', '光速战士', '暗夜游侠',
      '雷霆指挥官', '风暴使者', '烈焰骑士', '冰霜刺客', '暗影杀手',
      '星辰主宰', '虚空行者', '量子战士', '时空猎人', '永恒守护者',
      '无尽探索者', '银河霸主', '宇宙先锋', '星际王牌', '绝对王者',
      '狂暴战士', '沉默猎手', '迅捷刺客', '重装炮手', '致命狙击手',
      '闪电侠', '火焰风暴', '冰霜女王', '暗影领主', '光明使者',
      '战神', '剑圣', '魔法师', '弓箭手', '刺客',
      '圣骑士', '德鲁伊', '萨满', '猎人', '术士',
      '战士', '牧师', '法师', '盗贼', '死亡骑士',
      '恶魔猎手', '武僧', '恶魔战士', '幽灵', '亡灵'
    ];

    const entries: LeaderboardEntry[] = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      let baseScore: number;
      switch (filter) {
        case 'daily':
          baseScore = Math.floor(10000 + Math.random() * 50000);
          break;
        case 'weekly':
          baseScore = Math.floor(50000 + Math.random() * 200000);
          break;
        case 'monthly':
          baseScore = Math.floor(200000 + Math.random() * 500000);
          break;
        default:
          baseScore = Math.floor(1000 + Math.random() * 999000);
      }

      const entry: LeaderboardEntry = {
        playerId: `player_${i}`,
        playerName: names[i % names.length] + (i >= names.length ? `_${i}` : ''),
        score: Math.floor(baseScore),
        wave: Math.floor(5 + Math.random() * 30),
        kills: Math.floor(20 + Math.random() * 200),
        timestamp: now - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
      };
      entries.push(entry);
    }

    entries.push({
      playerId: this.currentPlayerId,
      playerName: this.currentPlayerName,
      score: Math.floor(80000 + Math.random() * 150000),
      wave: Math.floor(15 + Math.random() * 10),
      kills: Math.floor(80 + Math.random() * 100),
      timestamp: now,
    });

    return entries.sort((a, b) => b.score - a.score);
  }

  async submitScore(
    score: number,
    wave: number,
    kills: number,
    details?: {
      accuracy?: number;
      maxCombo?: number;
      bossesKilled?: number;
      elitesKilled?: number;
      playTime?: number;
      powerupsCollected?: number;
      damageDealt?: number;
      damageTaken?: number;
      rankGrade?: string;
    },
  ): Promise<number> {
    const entry: LeaderboardEntry = {
      playerId: this.currentPlayerId,
      playerName: this.currentPlayerName,
      score,
      wave,
      kills,
      timestamp: Date.now(),
      ...details,
    };

    const updated = [...this.entries, entry].sort((a, b) => b.score - a.score);
    const ranked = this.assignRanks(updated);

    this.entries = ranked.slice(0, 100);
    localStorage.setItem('leaderboard', JSON.stringify(this.entries));
    this.notify();

    const yourRank = this.entries.findIndex((e) => e.playerId === this.currentPlayerId) + 1;
    return yourRank;
  }

  getEntries(): LeaderboardEntryWithRank[] {
    return [...this.entries];
  }

  getTopEntries(count: number = 10): LeaderboardEntryWithRank[] {
    return this.entries.slice(0, count);
  }

  getYourRank(): number {
    const idx = this.entries.findIndex(e => e.playerId === this.currentPlayerId);
    return idx >= 0 ? idx + 1 : -1;
  }

  getYourEntry(): LeaderboardEntryWithRank | undefined {
    return this.entries.find(e => e.playerId === this.currentPlayerId);
  }

  getStats(): LeaderboardStats {
    const totalPlayers = this.entries.length;
    const yourEntry = this.getYourEntry();
    const topScore = this.entries.length > 0 ? this.entries[0].score : 0;
    
    let avgScore = 0;
    if (this.entries.length > 0) {
      avgScore = Math.floor(this.entries.reduce((sum, e) => sum + e.score, 0) / this.entries.length);
    }

    return {
      totalPlayers,
      yourRank: yourEntry?.rank || -1,
      yourScore: yourEntry?.score || 0,
      topScore,
      avgScore,
    };
  }

  getFilter(): LeaderboardFilter {
    return this.filter;
  }

  isLoadingEntries(): boolean {
    return this.isLoading;
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    this.listeners.forEach(cb => cb());
  }

  formatScore(score: number): string {
    return score.toLocaleString();
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    if (days < 30) return `${Math.floor(days / 7)}周前`;
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  destroy(): void {
    this.listeners.clear();
  }
}
