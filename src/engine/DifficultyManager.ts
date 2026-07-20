/** 难度自适应系统
 *
 * 根据玩家实时表现（击杀速率、受伤速率、生命比例、存活时间、波次进度）
 * 动态计算一个平滑的难度倍率，用于缩放敌人的生命/速度/伤害/生成频率。
 *
 * 设计目标：
 * - 表现优异时逐步提升难度（最高 1.4 倍，受强度配置影响）
 * - 表现挣扎时适度降低难度（最低 0.75 倍，受强度配置影响）
 * - 使用平滑过渡避免突变，保持体验连贯
 * - 支持开关控制与强度调节（弱/中/强）
 */

/** 难度趋势 */
export type DifficultyTrend = 'rising' | 'stable' | 'falling';

/** 难度档位标签（用于 UI 展示） */
export type DifficultyTier = '放松' | '普通' | '紧张' | '极限';

/** 自适应强度等级 */
export type AdaptiveIntensity = 'low' | 'medium' | 'high';

/** 难度自适应配置 */
export interface DifficultyAdaptiveConfig {
  /** 是否启用自适应难度 */
  enabled: boolean;
  /** 自适应强度：低/中/高 */
  intensity: AdaptiveIntensity;
}

/** 难度快照（供 UI 使用） */
export interface DifficultySnapshot {
  /** 当前难度倍率（0.75 - 1.4） */
  multiplier: number;
  /** 目标倍率（未平滑） */
  targetMultiplier: number;
  /** 玩家表现分（0 - 1，越高表示表现越好） */
  performanceScore: number;
  /** 趋势 */
  trend: DifficultyTrend;
  /** 档位标签 */
  tier: DifficultyTier;
  /** 每分钟击杀数（滚动平均） */
  killsPerMinute: number;
  /** 每分钟受伤量（滚动平均） */
  damageTakenPerMinute: number;
  /** 是否启用自适应 */
  adaptiveEnabled: boolean;
}

interface DamageEvent {
  time: number;
  amount: number;
}

/** 平滑速率：每秒接近目标倍率的比例 */
const SMOOTHING_RATE = 0.4;
/** 滚动窗口长度（毫秒） */
const ROLLING_WINDOW_MS = 60_000;
/** 趋势判定阈值 */
const TREND_THRESHOLD = 0.02;

/**
 * 强度 -> 倍率范围映射
 * - low:    0.90 ~ 1.10
 * - medium: 0.80 ~ 1.25
 * - high:   0.75 ~ 1.40
 */
const INTENSITY_RANGES: Record<AdaptiveIntensity, { min: number; max: number }> = {
  low: { min: 0.90, max: 1.10 },
  medium: { min: 0.80, max: 1.25 },
  high: { min: 0.75, max: 1.40 },
};

class DifficultyManager {
  private static instance: DifficultyManager | null = null;

  /** 击杀时间戳（滚动窗口） */
  private killTimestamps: number[] = [];
  /** 受伤事件（滚动窗口） */
  private damageEvents: DamageEvent[] = [];
  /** 最近一次上报的玩家生命 */
  private lastHealth: number = 100;
  /** 最近一次上报的玩家最大生命 */
  private maxHealth: number = 100;
  /** 会话开始时间 */
  private sessionStartTime: number = 0;
  /** 已完成波次数 */
  private wavesCompleted: number = 0;
  /** 上一帧的倍率（用于趋势判定） */
  private previousMultiplier: number = 1.0;

  /** 表现分（0 - 1） */
  private performanceScore: number = 0.5;
  /** 目标倍率（未平滑） */
  private targetMultiplier: number = 1.0;
  /** 当前倍率（平滑后） */
  private currentMultiplier: number = 1.0;
  /** 趋势 */
  private trend: DifficultyTrend = 'stable';

  /** 是否已启动 */
  private active: boolean = false;

  /** 自适应配置 */
  private config: DifficultyAdaptiveConfig = {
    enabled: true,
    intensity: 'medium',
  };

  private constructor() {}

  public static getInstance(): DifficultyManager {
    if (!DifficultyManager.instance) {
      DifficultyManager.instance = new DifficultyManager();
    }
    return DifficultyManager.instance;
  }

  /** 设置自适应配置（可在会话中随时切换） */
  public setConfig(config: Partial<DifficultyAdaptiveConfig>): void {
    this.config = { ...this.config, ...config };
    // 如果从关闭切换到启用，从当前倍率 1.0 开始过渡
    if (config.enabled && !this.config.enabled === false) {
      this.currentMultiplier = 1.0;
      this.targetMultiplier = 1.0;
    }
  }

  /** 获取当前配置 */
  public getConfig(): DifficultyAdaptiveConfig {
    return { ...this.config };
  }

  /** 获取当前强度的倍率范围 */
  public getRange(): { min: number; max: number } {
    return INTENSITY_RANGES[this.config.intensity];
  }

  /** 启动/重置一次会话 */
  public start(initialMaxHealth: number = 100): void {
    this.killTimestamps = [];
    this.damageEvents = [];
    this.lastHealth = initialMaxHealth;
    this.maxHealth = initialMaxHealth;
    this.sessionStartTime = Date.now();
    this.wavesCompleted = 0;
    this.previousMultiplier = 1.0;
    this.performanceScore = 0.5;
    this.targetMultiplier = 1.0;
    this.currentMultiplier = 1.0;
    this.trend = 'stable';
    this.active = true;
  }

  /** 停止会话 */
  public stop(): void {
    this.active = false;
  }

  /** 是否处于活跃状态 */
  public isActive(): boolean {
    return this.active;
  }

  /**
   * 每帧更新：清理过期窗口数据、重算表现分与目标倍率、平滑当前倍率。
   * @param dt 帧间隔（秒）
   */
  public update(dt: number): void {
    if (!this.active) return;

    // 若自适应关闭，倍率固定为 1.0
    if (!this.config.enabled) {
      this.previousMultiplier = this.currentMultiplier;
      if (Math.abs(this.currentMultiplier - 1.0) > 0.001) {
        const lerp = Math.min(1, SMOOTHING_RATE * dt);
        this.currentMultiplier += (1.0 - this.currentMultiplier) * lerp;
      }
      this.trend = 'stable';
      this.targetMultiplier = 1.0;
      return;
    }

    const now = Date.now();
    this.pruneWindow(now);

    // 计算表现分
    this.performanceScore = this.calculatePerformanceScore(now);

    // 表现分 -> 目标倍率（线性映射），使用当前强度对应的范围
    this.targetMultiplier = this.mapPerformanceToMultiplier(this.performanceScore);

    // 平滑当前倍率
    const lerp = Math.min(1, SMOOTHING_RATE * dt);
    this.previousMultiplier = this.currentMultiplier;
    this.currentMultiplier += (this.targetMultiplier - this.currentMultiplier) * lerp;

    // 趋势判定
    const delta = this.currentMultiplier - this.previousMultiplier;
    if (delta > TREND_THRESHOLD) {
      this.trend = 'rising';
    } else if (delta < -TREND_THRESHOLD) {
      this.trend = 'falling';
    } else {
      this.trend = 'stable';
    }
  }

  /** 记录一次击杀 */
  public recordKill(): void {
    if (!this.active) return;
    this.killTimestamps.push(Date.now());
  }

  /** 记录玩家受伤量 */
  public recordDamageTaken(amount: number): void {
    if (!this.active || amount <= 0) return;
    this.damageEvents.push({ time: Date.now(), amount });
  }

  /**
   * 上报玩家当前生命值（用于生命比例评估与受伤检测）。
   * @param health 当前生命
   * @param maxHealth 最大生命
   */
  public recordPlayerHealth(health: number, maxHealth: number): void {
    if (!this.active) return;
    // 检测生命下降（受伤），记录受伤量
    const drop = this.lastHealth - health;
    if (drop > 0) {
      this.recordDamageTaken(drop);
    }
    this.lastHealth = health;
    this.maxHealth = maxHealth || this.maxHealth;
  }

  /** 记录完成一个波次 */
  public recordWaveCompleted(): void {
    if (!this.active) return;
    this.wavesCompleted++;
  }

  /** 获取当前难度倍率 */
  public getMultiplier(): number {
    return this.currentMultiplier;
  }

  /** 获取玩家表现分（0 - 1） */
  public getPerformanceScore(): number {
    return this.performanceScore;
  }

  /** 获取趋势 */
  public getTrend(): DifficultyTrend {
    return this.trend;
  }

  /** 获取档位标签 */
  public getTier(): DifficultyTier {
    return this.multiplierToTier(this.currentMultiplier);
  }

  /** 获取完整快照 */
  public getSnapshot(): DifficultySnapshot {
    return {
      multiplier: this.currentMultiplier,
      targetMultiplier: this.targetMultiplier,
      performanceScore: this.performanceScore,
      trend: this.trend,
      tier: this.getTier(),
      killsPerMinute: this.killsPerMinute(),
      damageTakenPerMinute: this.damagePerMinute(),
      adaptiveEnabled: this.config.enabled,
    };
  }

  // ===== 内部计算 =====

  private pruneWindow(now: number): void {
    const cutoff = now - ROLLING_WINDOW_MS;
    this.killTimestamps = this.killTimestamps.filter((t) => t >= cutoff);
    this.damageEvents = this.damageEvents.filter((e) => e.time >= cutoff);
  }

  private killsPerMinute(): number {
    return this.killTimestamps.length;
  }

  private damagePerMinute(): number {
    return this.damageEvents.reduce((sum, e) => sum + e.amount, 0);
  }

  /**
   * 计算表现分（0 - 1）。
   * 综合考虑：击杀速率、受伤速率、生命比例、存活时间、波次进度。
   */
  private calculatePerformanceScore(now: number): number {
    const kpm = this.killsPerMinute();
    const dpm = this.damagePerMinute();
    const healthRatio = this.maxHealth > 0 ? this.lastHealth / this.maxHealth : 1;
    const survivalSec = (now - this.sessionStartTime) / 1000;
    const survivalMin = survivalSec / 60;

    // 击杀速率分：0 -> 0，30+ -> 1
    const killScore = Math.min(1, kpm / 30);

    // 受伤速率分：0 受伤 -> 1，300+ 受伤/分钟 -> 0
    const damageScore = Math.max(0, 1 - dpm / 300);

    // 生命比例分
    const healthScore = Math.max(0, Math.min(1, healthRatio));

    // 存活时间分：存活越久表现越好（0 -> 0.3，5分钟+ -> 1）
    const survivalScore = Math.min(1, 0.3 + survivalMin / 5 * 0.7);

    // 波次进度分：每完成 1 波 +0.15，封顶 1
    const waveScore = Math.min(1, this.wavesCompleted * 0.15);

    // 加权综合
    const composite =
      killScore * 0.30 +
      damageScore * 0.25 +
      healthScore * 0.20 +
      survivalScore * 0.15 +
      waveScore * 0.10;

    return Math.max(0, Math.min(1, composite));
  }

  /** 表现分（0-1）线性映射为倍率，使用当前强度对应的范围 */
  private mapPerformanceToMultiplier(performance: number): number {
    const range = INTENSITY_RANGES[this.config.intensity];
    if (performance <= 0.5) {
      // 0.0 -> range.min, 0.5 -> 1.0
      return range.min + (1.0 - range.min) * (performance / 0.5);
    }
    // 0.5 -> 1.0, 1.0 -> range.max
    return 1.0 + (range.max - 1.0) * ((performance - 0.5) / 0.5);
  }

  private multiplierToTier(m: number): DifficultyTier {
    if (m < 0.9) return '放松';
    if (m < 1.1) return '普通';
    if (m < 1.25) return '紧张';
    return '极限';
  }
}

export const difficultyManager = DifficultyManager.getInstance();
