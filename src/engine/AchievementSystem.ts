import { useGameStore } from '../store/useGameStore';

export enum AchievementCategory {
  COMBAT = 'combat',
  SURVIVAL = 'survival',
  COLLECTION = 'collection',
  SKILL = 'skill',
  SPECIAL = 'special',
}

export enum AchievementRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  requirement: number;
  reward?: {
    score?: number;
    experience?: number;
  };
}

export interface AchievementProgress {
  current: number;
  isUnlocked: boolean;
  unlockedAt?: number;
  notificationShown: boolean;
}

export interface AchievementStats {
  totalKills: number;
  totalDeaths: number;
  highestWave: number;
  highestScore: number;
  totalPlayTime: number;
  enemiesKilledByType: Record<string, number>;
  powerupsCollected: number;
  skillsUsed: Record<string, number>;
  distanceTraveled: number;
  shotsFired: number;
  shotsHit: number;
}

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Combat Achievements
  {
    id: 'first_blood',
    name: '初出茅庐',
    description: '击败第一个敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.COMMON,
    icon: '⚔️',
    requirement: 1,
    reward: { score: 100 },
  },
  {
    id: 'killer_10',
    name: '新晋杀手',
    description: '击败10个敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.COMMON,
    icon: '🗡️',
    requirement: 10,
    reward: { score: 500 },
  },
  {
    id: 'killer_50',
    name: '沙场老将',
    description: '击败50个敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.UNCOMMON,
    icon: '⚔️',
    requirement: 50,
    reward: { score: 2000 },
  },
  {
    id: 'killer_100',
    name: '杀戮机器',
    description: '击败100个敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.RARE,
    icon: '💀',
    requirement: 100,
    reward: { score: 5000 },
  },
  {
    id: 'killer_500',
    name: '死亡使者',
    description: '击败500个敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.EPIC,
    icon: '☠️',
    requirement: 500,
    reward: { score: 20000 },
  },
  {
    id: 'elite_hunter',
    name: '精英猎手',
    description: '击败10个精英敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.RARE,
    icon: '🏆',
    requirement: 10,
    reward: { score: 3000 },
  },
  {
    id: 'boss_slayer',
    name: 'Boss克星',
    description: '击败5个Boss',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.EPIC,
    icon: '👹',
    requirement: 5,
    reward: { score: 10000 },
  },

  // Survival Achievements
  {
    id: 'survivor_30s',
    name: '初生牛犊',
    description: '存活30秒',
    category: AchievementCategory.SURVIVAL,
    rarity: AchievementRarity.COMMON,
    icon: '⏱️',
    requirement: 30,
    reward: { score: 100 },
  },
  {
    id: 'survivor_5min',
    name: '久经沙场',
    description: '存活5分钟',
    category: AchievementCategory.SURVIVAL,
    rarity: AchievementRarity.UNCOMMON,
    icon: '🛡️',
    requirement: 300,
    reward: { score: 1000 },
  },
  {
    id: 'survivor_10min',
    name: '铁壁防御',
    description: '存活10分钟且未受伤',
    category: AchievementCategory.SURVIVAL,
    rarity: AchievementRarity.RARE,
    icon: '🏰',
    requirement: 600,
    reward: { score: 3000 },
  },
  {
    id: 'wave_5',
    name: '波次先锋',
    description: '到达第5波',
    category: AchievementCategory.SURVIVAL,
    rarity: AchievementRarity.UNCOMMON,
    icon: '🌊',
    requirement: 5,
    reward: { score: 2000 },
  },
  {
    id: 'wave_10',
    name: '波次领主',
    description: '到达第10波',
    category: AchievementCategory.SURVIVAL,
    rarity: AchievementRarity.RARE,
    icon: '👑',
    requirement: 10,
    reward: { score: 5000 },
  },

  // Collection Achievements
  {
    id: 'collector_10',
    name: '拾取达人',
    description: '拾取10个道具',
    category: AchievementCategory.COLLECTION,
    rarity: AchievementRarity.COMMON,
    icon: '📦',
    requirement: 10,
    reward: { score: 500 },
  },
  {
    id: 'collector_50',
    name: '收藏家',
    description: '拾取50个道具',
    category: AchievementCategory.COLLECTION,
    rarity: AchievementRarity.UNCOMMON,
    icon: '🎁',
    requirement: 50,
    reward: { score: 2000 },
  },
  {
    id: 'health_collector',
    name: '生命汲取',
    description: '通过道具恢复100次生命',
    category: AchievementCategory.COLLECTION,
    rarity: AchievementRarity.UNCOMMON,
    icon: '❤️',
    requirement: 100,
    reward: { score: 1500 },
  },

  // Skill Achievements
  {
    id: 'skill_master',
    name: '技能大师',
    description: '使用技能50次',
    category: AchievementCategory.SKILL,
    rarity: AchievementRarity.UNCOMMON,
    icon: '✨',
    requirement: 50,
    reward: { score: 2500 },
  },
  {
    id: 'missile_master',
    name: '导弹专家',
    description: '使用导弹技能20次',
    category: AchievementCategory.SKILL,
    rarity: AchievementRarity.RARE,
    icon: '🚀',
    requirement: 20,
    reward: { score: 3000 },
  },
  {
    id: 'shield_master',
    name: '护盾大师',
    description: '使用护盾技能30次',
    category: AchievementCategory.SKILL,
    rarity: AchievementRarity.RARE,
    icon: '🛡️',
    requirement: 30,
    reward: { score: 3000 },
  },

  // Special Achievements
  {
    id: 'high_score_1000',
    name: '初露锋芒',
    description: '获得1000分',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.COMMON,
    icon: '⭐',
    requirement: 1000,
    reward: { score: 200 },
  },
  {
    id: 'high_score_10000',
    name: '声名鹊起',
    description: '获得10000分',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.UNCOMMON,
    icon: '🌟',
    requirement: 10000,
    reward: { score: 1000 },
  },
  {
    id: 'high_score_50000',
    name: '名震四方',
    description: '获得50000分',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.RARE,
    icon: '💫',
    requirement: 50000,
    reward: { score: 5000 },
  },
  {
    id: 'high_score_100000',
    name: '传奇之路',
    description: '获得100000分',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.EPIC,
    icon: '🔥',
    requirement: 100000,
    reward: { score: 10000 },
  },
  {
    id: 'perfectionist',
    name: '完美主义者',
    description: '单次游戏命中率达到100%',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.LEGENDARY,
    icon: '🎯',
    requirement: 100,
    reward: { score: 20000 },
  },
];

class AchievementSystem {
  private achievements: Map<string, AchievementProgress> = new Map();
  private stats: AchievementStats = {
    totalKills: 0,
    totalDeaths: 0,
    highestWave: 0,
    highestScore: 0,
    totalPlayTime: 0,
    enemiesKilledByType: {},
    powerupsCollected: 0,
    skillsUsed: {},
    distanceTraveled: 0,
    shotsFired: 0,
    shotsHit: 0,
  };
  private listeners: ((achievement: AchievementDefinition) => void)[] = [];
  private initialized: boolean = false;

  constructor() {
    this.loadProgress();
  }

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    ACHIEVEMENT_DEFINITIONS.forEach((def) => {
      if (!this.achievements.has(def.id)) {
        this.achievements.set(def.id, {
          current: 0,
          isUnlocked: false,
          notificationShown: false,
        });
      }
    });

    this.saveProgress();
  }

  public updateStats(updates: Partial<AchievementStats>): void {
    const _oldStats = { ...this.stats };

    Object.keys(updates).forEach((key) => {
      const k = key as keyof AchievementStats;
      const value = updates[k];
      if (typeof value === 'number') {
        (this.stats[k] as number) += value;
      } else if (typeof value === 'object' && value !== null) {
        this.stats[k] = { ...this.stats[k], ...value } as AchievementStats[typeof k];
      }
    });

    // Update highest values
    if (this.stats.highestWave < this.stats.totalKills) {
      // Check wave achievements
    }

    this.checkAchievements();
    this.saveProgress();
  }

  public setStats(updates: Partial<AchievementStats>): void {
    Object.keys(updates).forEach((key) => {
      const k = key as keyof AchievementStats;
      const value = updates[k];
      if (typeof value === 'number') {
        (this.stats[k] as number) = value;
      } else if (typeof value === 'object' && value !== null) {
        this.stats[k] = value as unknown as AchievementStats[keyof AchievementStats];
      }
    });

    this.checkAchievements();
    this.saveProgress();
  }

  private checkAchievements(): void {
    ACHIEVEMENT_DEFINITIONS.forEach((def) => {
      const progress = this.achievements.get(def.id);
      if (!progress || progress.isUnlocked) return;

      let currentValue = 0;

      switch (def.id) {
        case 'first_blood':
        case 'killer_10':
        case 'killer_50':
        case 'killer_100':
        case 'killer_500':
          currentValue = this.stats.totalKills;
          break;
        case 'elite_hunter':
          currentValue = this.stats.enemiesKilledByType['elite'] || 0;
          break;
        case 'boss_slayer':
          currentValue = this.stats.enemiesKilledByType['boss'] || 0;
          break;
        case 'survivor_30s':
        case 'survivor_5min':
        case 'survivor_10min':
          currentValue = this.stats.totalPlayTime;
          break;
        case 'wave_5':
        case 'wave_10':
          currentValue = this.stats.highestWave;
          break;
        case 'collector_10':
        case 'collector_50':
          currentValue = this.stats.powerupsCollected;
          break;
        case 'health_collector':
          currentValue = this.stats.enemiesKilledByType['health'] || 0;
          break;
        case 'skill_master':
          currentValue = Object.values(this.stats.skillsUsed).reduce((a, b) => a + b, 0);
          break;
        case 'missile_master':
          currentValue = this.stats.skillsUsed['missileStrike'] || 0;
          break;
        case 'shield_master':
          currentValue = this.stats.skillsUsed['shieldBurst'] || 0;
          break;
        case 'high_score_1000':
        case 'high_score_10000':
        case 'high_score_50000':
        case 'high_score_100000':
          currentValue = this.stats.highestScore;
          break;
        case 'perfectionist':
          if (this.stats.shotsFired > 0) {
            currentValue = (this.stats.shotsHit / this.stats.shotsFired) * 100;
          }
          break;
      }

      progress.current = currentValue;

      if (currentValue >= def.requirement && !progress.isUnlocked) {
        this.unlockAchievement(def);
      }
    });
  }

  private unlockAchievement(definition: AchievementDefinition): void {
    const progress = this.achievements.get(definition.id);
    if (!progress) return;

    progress.isUnlocked = true;
    progress.unlockedAt = Date.now();

    // Apply rewards
    if (definition.reward?.score) {
      useGameStore.getState().addScore(definition.reward.score);
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener(definition));

    this.saveProgress();
  }

  public onAchievementUnlocked(callback: (achievement: AchievementDefinition) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public getAchievement(id: string): AchievementDefinition | undefined {
    return ACHIEVEMENT_DEFINITIONS.find((a) => a.id === id);
  }

  public getAchievementProgress(id: string): AchievementProgress | undefined {
    return this.achievements.get(id);
  }

  public getAllAchievements(): (AchievementDefinition & { progress: AchievementProgress })[] {
    return ACHIEVEMENT_DEFINITIONS.map((def) => ({
      ...def,
      progress: this.achievements.get(def.id) || { current: 0, isUnlocked: false },
    }));
  }

  public getAchievementsByCategory(
    category: AchievementCategory,
  ): (AchievementDefinition & { progress: AchievementProgress })[] {
    return this.getAllAchievements().filter((a) => a.category === category);
  }

  public getUnlockedCount(): number {
    let count = 0;
    this.achievements.forEach((progress) => {
      if (progress.isUnlocked) count++;
    });
    return count;
  }

  public getTotalCount(): number {
    return ACHIEVEMENT_DEFINITIONS.length;
  }

  public getCompletionPercentage(): number {
    return (this.getUnlockedCount() / this.getTotalCount()) * 100;
  }

  public getStats(): AchievementStats {
    return { ...this.stats };
  }

  public resetProgress(): void {
    this.achievements.clear();
    this.stats = {
      totalKills: 0,
      totalDeaths: 0,
      highestWave: 0,
      highestScore: 0,
      totalPlayTime: 0,
      enemiesKilledByType: {},
      powerupsCollected: 0,
      skillsUsed: {},
      distanceTraveled: 0,
      shotsFired: 0,
      shotsHit: 0,
    };
    this.initialize();
  }

  private saveProgress(): void {
    const data = {
      achievements: Array.from(this.achievements.entries()),
      stats: this.stats,
    };
    localStorage.setItem('achievementProgress', JSON.stringify(data));
  }

  private loadProgress(): void {
    const saved = localStorage.getItem('achievementProgress');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.achievements = new Map(data.achievements);
        this.stats = data.stats;
      } catch {
        console.warn('Failed to load achievement progress');
      }
    }
  }
}

export const achievementSystem = new AchievementSystem();
export default achievementSystem;
