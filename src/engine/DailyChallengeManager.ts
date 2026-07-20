/**
 * 每日挑战系统
 *
 * 基于日期生成固定种子，派生出一组确定的挑战修饰器（modifiers），
 * 让所有玩家在同一天面对相同的挑战条件。
 *
 * 特性：
 * - 种子由 YYYY-MM-DD 字符串哈希得到，同一天全球一致
 * - 挑战修饰器从池中按种子确定性选取（1-3 个）
 * - 每个修饰器有分数倍率加成，总倍率叠加
 * - 记录当日最佳成绩，支持每日排行榜
 */

/** 挑战修饰器类型 */
export type ChallengeModifierType =
  | 'no_shield'        // 禁用护盾
  | 'double_speed'     // 敌人速度翻倍
  | 'one_hit_kill'     // 一击必杀（玩家与敌人皆然）
  | 'boss_rush'        // 全部为 BOSS 波次
  | 'no_powerups'      // 禁用道具掉落
  | 'fog_of_war'       // 视野受限（雾效）
  | 'glass_cannon'     // 玻璃大炮：伤害 x3，生命 x0.5
  | 'time_pressure'    // 每波限时 60 秒
  | 'swarm'            // 敌人数量 x2
  | 'precision';       // 命中率低于 70% 扣分

/** 挑战修饰器定义 */
export interface ChallengeModifier {
  type: ChallengeModifierType;
  name: string;
  description: string;
  icon: string;
  /** 分数倍率加成（叠加） */
  scoreMultiplier: number;
  /** 难度等级（1-3，用于决定选取数量） */
  severity: 1 | 2 | 3;
}

/** 每日挑战配置 */
export interface DailyChallengeConfig {
  /** 日期字符串 YYYY-MM-DD */
  date: string;
  /** 当日种子 */
  seed: number;
  /** 修饰器列表 */
  modifiers: ChallengeModifier[];
  /** 总分数倍率 */
  totalScoreMultiplier: number;
  /** 基础难度 */
  baseDifficulty: 'easy' | 'normal' | 'hard';
  /** 目标波次数 */
  targetWaves: number;
}

/** 每日挑战最佳记录 */
export interface DailyChallengeRecord {
  date: string;
  bestScore: number;
  bestWave: number;
  completed: boolean;
  attempts: number;
  lastPlayed: number;
}

const MODIFIER_POOL: ChallengeModifier[] = [
  {
    type: 'no_shield',
    name: '护盾失效',
    description: '护盾系统完全失效，无法获得护盾',
    icon: '🛡️',
    scoreMultiplier: 1.3,
    severity: 2,
  },
  {
    type: 'double_speed',
    name: '极速敌人',
    description: '所有敌人移动速度翻倍',
    icon: '💨',
    scoreMultiplier: 1.4,
    severity: 2,
  },
  {
    type: 'one_hit_kill',
    name: '一击必杀',
    description: '任何一次碰撞即死亡，敌人也只需一击',
    icon: '💀',
    scoreMultiplier: 2.0,
    severity: 3,
  },
  {
    type: 'boss_rush',
    name: 'BOSS 连战',
    description: '所有波次都是 BOSS 波次',
    icon: '👹',
    scoreMultiplier: 1.8,
    severity: 3,
  },
  {
    type: 'no_powerups',
    name: '无道具',
    description: '敌人不会掉落任何道具',
    icon: '🚫',
    scoreMultiplier: 1.3,
    severity: 1,
  },
  {
    type: 'fog_of_war',
    name: '战争迷雾',
    description: '视野受限，只能看到附近区域',
    icon: '🌫️',
    scoreMultiplier: 1.25,
    severity: 1,
  },
  {
    type: 'glass_cannon',
    name: '玻璃大炮',
    description: '伤害 x3，但生命减半',
    icon: '🎯',
    scoreMultiplier: 1.5,
    severity: 2,
  },
  {
    type: 'time_pressure',
    name: '时间压力',
    description: '每波限时 60 秒，超时即失败',
    icon: '⏱️',
    scoreMultiplier: 1.35,
    severity: 2,
  },
  {
    type: 'swarm',
    name: '虫群来袭',
    description: '每波敌人数量翻倍',
    icon: '🐝',
    scoreMultiplier: 1.4,
    severity: 2,
  },
  {
    type: 'precision',
    name: '精准要求',
    description: '命中率低于 70% 将持续扣分',
    icon: '🏹',
    scoreMultiplier: 1.3,
    severity: 1,
  },
];

class DailyChallengeManager {
  private static instance: DailyChallengeManager | null = null;

  /** 当前激活的挑战配置（null 表示未启动每日挑战模式） */
  private activeChallenge: DailyChallengeConfig | null = null;
  /** 当日记录缓存 */
  private cachedTodayConfig: DailyChallengeConfig | null = null;

  private constructor() {}

  public static getInstance(): DailyChallengeManager {
    if (!DailyChallengeManager.instance) {
      DailyChallengeManager.instance = new DailyChallengeManager();
    }
    return DailyChallengeManager.instance;
  }

  /** 获取今日日期字符串 YYYY-MM-DD（本地时区） */
  public getTodayString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** 基于日期字符串生成确定性种子 */
  public hashDate(dateStr: string): number {
    let hash = 5381;
    for (let i = 0; i < dateStr.length; i++) {
      hash = ((hash << 5) + hash) + dateStr.charCodeAt(i);
      hash = hash & 0xffffffff;
    }
    return Math.abs(hash);
  }

  /** 基于种子的确定性伪随机数生成器（mulberry32） */
  private mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 获取今日挑战配置（同一天结果一致，缓存） */
  public getTodayChallenge(): DailyChallengeConfig {
    if (this.cachedTodayConfig && this.cachedTodayConfig.date === this.getTodayString()) {
      return this.cachedTodayConfig;
    }

    const date = this.getTodayString();
    const seed = this.hashDate(date);
    const rng = this.mulberry32(seed);

    // 选取 1-3 个修饰器（由种子决定数量）
    const count = 1 + Math.floor(rng() * 3); // 1, 2, or 3
    const available = [...MODIFIER_POOL];
    const selected: ChallengeModifier[] = [];

    for (let i = 0; i < count && available.length > 0; i++) {
      const idx = Math.floor(rng() * available.length);
      selected.push(available[idx]);
      available.splice(idx, 1);
    }

    // 总分倍率 = 各修饰器倍率乘积
    const totalScoreMultiplier = selected.reduce((acc, m) => acc * m.scoreMultiplier, 1.0);

    // 基础难度由种子决定
    const difficulties: ('easy' | 'normal' | 'hard')[] = ['easy', 'normal', 'hard'];
    const baseDifficulty = difficulties[Math.floor(rng() * 3)];

    // 目标波次 5-10
    const targetWaves = 5 + Math.floor(rng() * 6);

    this.cachedTodayConfig = {
      date,
      seed,
      modifiers: selected,
      totalScoreMultiplier,
      baseDifficulty,
      targetWaves,
    };

    return this.cachedTodayConfig;
  }

  /** 启动每日挑战模式 */
  public startDailyChallenge(): DailyChallengeConfig {
    this.activeChallenge = this.getTodayChallenge();
    return this.activeChallenge;
  }

  /** 获取当前激活的挑战配置 */
  public getActiveChallenge(): DailyChallengeConfig | null {
    return this.activeChallenge;
  }

  /** 退出每日挑战模式 */
  public stopDailyChallenge(): void {
    this.activeChallenge = null;
  }

  /** 是否处于每日挑战模式 */
  public isDailyChallengeActive(): boolean {
    return this.activeChallenge !== null;
  }

  /** 检查挑战是否包含指定修饰器 */
  public hasModifier(type: ChallengeModifierType): boolean {
    if (!this.activeChallenge) return false;
    return this.activeChallenge.modifiers.some((m) => m.type === type);
  }

  /** 获取今日记录 */
  public getTodayRecord(): DailyChallengeRecord {
    const date = this.getTodayString();
    const key = `daily-challenge-${date}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw) as DailyChallengeRecord;
      }
    } catch {
      // 忽略解析错误
    }
    return {
      date,
      bestScore: 0,
      bestWave: 0,
      completed: false,
      attempts: 0,
      lastPlayed: 0,
    };
  }

  /** 提交一次挑战结果，更新记录 */
  public submitResult(score: number, wave: number, completed: boolean): DailyChallengeRecord {
    const date = this.getTodayString();
    const key = `daily-challenge-${date}`;
    const current = this.getTodayRecord();

    const updated: DailyChallengeRecord = {
      date,
      bestScore: Math.max(current.bestScore, score),
      bestWave: Math.max(current.bestWave, wave),
      completed: current.completed || completed,
      attempts: current.attempts + 1,
      lastPlayed: Date.now(),
    };

    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // 存储失败忽略
    }

    return updated;
  }

  /** 获取最近 N 天的每日挑战记录（用于历史展示） */
  public getRecentRecords(days: number = 7): DailyChallengeRecord[] {
    const records: DailyChallengeRecord[] = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      const key = `daily-challenge-${dateStr}`;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          records.push(JSON.parse(raw) as DailyChallengeRecord);
        } else {
          records.push({
            date: dateStr,
            bestScore: 0,
            bestWave: 0,
            completed: false,
            attempts: 0,
            lastPlayed: 0,
          });
        }
      } catch {
        records.push({
          date: dateStr,
          bestScore: 0,
          bestWave: 0,
          completed: false,
          attempts: 0,
          lastPlayed: 0,
        });
      }
    }
    return records;
  }
}

export const dailyChallengeManager = DailyChallengeManager.getInstance();
