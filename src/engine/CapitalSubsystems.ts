/**
 * 巨型母舰子系统损毁模型（v2.8 Phase 2）。
 *
 * 纯逻辑、零 PlayCanvas 依赖：渲染与实体由 `CapitalShip` 负责，
 * 这里只决定「打中哪里 / 打坏了什么 / 行为怎么变」，因此可以脱离 WebGL 单测。
 *
 * 设计要点：
 * - 5 个子系统：舰桥、主引擎、武器阵列、反应堆、护盾发生器。
 * - 命中路由按「命中点到子系统球心 / 半径」的归一化距离取最近者；
 *   都打不中就是打在舰体上（返回 null，由外层只扣结构血量）。
 * - 毁 3 个子系统即瘫痪（停止开火、失去机动）。
 * - 反应堆被毁触发 5 秒自毁倒计时。
 */

export type CapitalSubsystemId = 'bridge' | 'engine' | 'weapons' | 'reactor' | 'shield';

export interface Point3Like {
  x: number;
  y: number;
  z: number;
}

export interface SubsystemDef {
  id: CapitalSubsystemId;
  name: string;
  maxHealth: number;
  /** 命中球心（舰体本地单位，未乘整体缩放） */
  offset: Point3Like;
  /** 命中球半径（舰体本地单位） */
  radius: number;
}

export interface SubsystemState {
  id: CapitalSubsystemId;
  name: string;
  health: number;
  maxHealth: number;
  isDestroyed: boolean;
}

export interface DamageResult {
  /** 实际承伤（护盾吸收后）的子系统 */
  id: CapitalSubsystemId;
  /** 打进子系统的伤害 */
  amount: number;
  /** 被护盾发生器吸收的伤害 */
  shieldAbsorbed: number;
  /** 该子系统是否**本次**刚刚被摧毁（只在状态翻转时为 true） */
  destroyed: boolean;
  /** 护盾是否**本次**刚刚被击穿 */
  shieldDestroyed: boolean;
}

export interface CapitalModifiers {
  speedMultiplier: number;
  canFire: boolean;
  canDeployDrones: boolean;
  /** 炮塔瞄准精度 0–1；舰桥被毁后大幅下降 */
  trackingAccuracy: number;
  /** 护盾吸收比例 0–1；护盾被毁后为 0 */
  shieldAbsorb: number;
  isParalyzed: boolean;
  /** 反应堆被毁后的自毁倒计时（秒）；未触发为 null */
  meltdownRemaining: number | null;
}

/** 5 个子系统的基准配置（血量与命中球按母舰整体尺寸设计） */
export const CAPITAL_SUBSYSTEMS: readonly SubsystemDef[] = [
  {
    id: 'reactor',
    name: '聚变反应堆',
    maxHealth: 1200,
    offset: { x: 0, y: 0, z: 0 },
    radius: 3.5,
  },
  {
    id: 'weapons',
    name: '武器阵列',
    maxHealth: 1400,
    offset: { x: 0, y: 1, z: 4 },
    radius: 5.5,
  },
  {
    id: 'engine',
    name: '主推进器组',
    maxHealth: 1000,
    offset: { x: 0, y: 0, z: -8 },
    radius: 3.5,
  },
  {
    id: 'bridge',
    name: '指挥塔',
    maxHealth: 500,
    offset: { x: 0, y: 5, z: -4 },
    radius: 2.5,
  },
  {
    id: 'shield',
    name: '护盾发生器',
    maxHealth: 800,
    offset: { x: 0, y: -3, z: 2 },
    radius: 3,
  },
];

/** 护盾在被打穿前吸收的伤害比例 */
export const SHIELD_ABSORB_RATIO = 0.6;
/** 反应堆被毁后的自毁倒计时（秒） */
export const MELTDOWN_SECONDS = 5;
/** 损坏子系统数达到该值即瘫痪 */
export const PARALYSIS_THRESHOLD = 3;

/** 虚空之主的毁伤组合输入 */
export interface VoidPhaseInput {
  /** 已毁子系统数量 */
  destroyedCount: number;
  /** 反应堆是否已毁 */
  reactorDestroyed: boolean;
  /** 武器阵列剩余血量比例 0–1 */
  weaponsHealthRatio: number;
}

/**
 * 虚空之主的阶段由「毁伤组合」解锁，而不是纯血量阈值：
 * - 阶段 1：重型虚空射线
 * - 阶段 2：任意子系统被毁，或武器阵列血量低于 60% → 弹幕散射
 * - 阶段 3：反应堆被毁，或毁满 3 个子系统 → 引力坍缩
 */
export function resolveVoidPhase(input: VoidPhaseInput): 1 | 2 | 3 {
  if (input.reactorDestroyed || input.destroyedCount >= PARALYSIS_THRESHOLD) return 3;
  if (input.destroyedCount >= 1 || input.weaponsHealthRatio < 0.6) return 2;
  return 1;
}

export class CapitalSubsystemModel {
  private readonly defs: Map<CapitalSubsystemId, SubsystemDef> = new Map();
  private readonly states: Map<CapitalSubsystemId, SubsystemState> = new Map();
  private readonly rng: () => number;
  private meltdownStarted: boolean = false;
  private meltdownElapsed: number = 0;

  constructor(defs: readonly SubsystemDef[] = CAPITAL_SUBSYSTEMS, rng: () => number = Math.random) {
    this.rng = rng;
    defs.forEach((def) => {
      this.defs.set(def.id, def);
      this.states.set(def.id, {
        id: def.id,
        name: def.name,
        health: def.maxHealth,
        maxHealth: def.maxHealth,
        isDestroyed: false,
      });
    });
  }

  public getStates(): SubsystemState[] {
    return Array.from(this.states.values(), (s) => ({ ...s }));
  }

  public getState(id: CapitalSubsystemId): SubsystemState | null {
    const state = this.states.get(id);
    return state ? { ...state } : null;
  }

  public getDestroyedCount(): number {
    let count = 0;
    this.states.forEach((s) => {
      if (s.isDestroyed) count += 1;
    });
    return count;
  }

  public isParalyzed(): boolean {
    return this.getDestroyedCount() >= PARALYSIS_THRESHOLD;
  }

  /**
   * 按命中点结算伤害。
   * @param hitPoint 舰体本地坐标（未乘整体缩放）；传 null 表示没有精确命中点
   *                 （老调用点 / 范围伤害），此时按 rng 随机挑一个存活子系统。
   * @returns null 表示打空（落在所有命中球之外，只应扣结构血量）
   */
  public damageFromHit(hitPoint: Point3Like | null, amount: number): DamageResult | null {
    if (!this.isPositive(amount)) return null;

    const target = this.pickTarget(hitPoint);
    if (!target) return null;

    let shieldAbsorbed = 0;
    let shieldDestroyed = false;
    const shield = this.states.get('shield');
    if (shield && !shield.isDestroyed && target !== 'shield') {
      shieldAbsorbed = Math.min(amount * SHIELD_ABSORB_RATIO, shield.health);
      shield.health = Math.max(0, shield.health - shieldAbsorbed);
      if (shield.health <= 0) {
        shield.isDestroyed = true;
        shieldDestroyed = true;
      }
    }

    const remaining = amount - shieldAbsorbed;
    if (remaining <= 0) {
      return { id: target, amount: 0, shieldAbsorbed, destroyed: false, shieldDestroyed };
    }

    const result = this.applyDamage(target, remaining, shieldAbsorbed);
    if (!result) return null;
    return { ...result, shieldDestroyed };
  }

  /** 直接对指定子系统结算（脚本/调试用），不经命中路由、不走护盾吸收 */
  public damageSubsystem(id: CapitalSubsystemId, amount: number): DamageResult | null {
    if (!this.isPositive(amount)) return null;
    return this.applyDamage(id, amount, 0);
  }

  /** 推进自毁倒计时；返回剩余秒数（未触发为 null） */
  public update(dt: number): { meltdownRemaining: number | null } {
    if (!this.meltdownStarted) return { meltdownRemaining: null };
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    this.meltdownElapsed = Math.min(MELTDOWN_SECONDS, this.meltdownElapsed + step);
    return { meltdownRemaining: MELTDOWN_SECONDS - this.meltdownElapsed };
  }

  public getModifiers(): CapitalModifiers {
    const isDestroyed = (id: CapitalSubsystemId): boolean =>
      this.states.get(id)?.isDestroyed === true;

    const paralyzed = this.isParalyzed();
    const reactorDestroyed = isDestroyed('reactor');

    return {
      speedMultiplier: paralyzed ? 0 : isDestroyed('engine') ? 0.3 : 1,
      canFire: !isDestroyed('weapons') && !paralyzed,
      canDeployDrones: !isDestroyed('bridge') && !paralyzed,
      trackingAccuracy: paralyzed ? 0 : isDestroyed('bridge') ? 0.35 : 1,
      shieldAbsorb: isDestroyed('shield') ? 0 : SHIELD_ABSORB_RATIO,
      isParalyzed: paralyzed,
      meltdownRemaining: reactorDestroyed
        ? Math.max(0, MELTDOWN_SECONDS - this.meltdownElapsed)
        : null,
    };
  }

  /** 调试/清场用：把所有子系统标记为摧毁（不触发额外效果） */
  public destroyAll(): void {
    this.states.forEach((state) => {
      state.health = 0;
      state.isDestroyed = true;
    });
    this.meltdownStarted = true;
    this.meltdownElapsed = MELTDOWN_SECONDS;
  }

  public serialize(): { id: CapitalSubsystemId; health: number }[] {
    return Array.from(this.states.values(), (s) => ({ id: s.id, health: s.health }));
  }

  /** 老存档缺字段 / 脏数据时静默回落满血，不抛错 */
  public deserialize(data: unknown): void {
    if (!Array.isArray(data)) return;

    data.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const record = entry as Record<string, unknown>;
      const id = record.id;
      const health = Number(record.health);
      if (typeof id !== 'string' || !Number.isFinite(health)) return;

      const state = this.states.get(id as CapitalSubsystemId);
      if (!state) return;

      state.health = Math.max(0, Math.min(state.maxHealth, health));
      state.isDestroyed = state.health <= 0;
    });

    const reactor = this.states.get('reactor');
    if (reactor?.isDestroyed) {
      this.meltdownStarted = true;
      this.meltdownElapsed = MELTDOWN_SECONDS;
    }
  }

  private applyDamage(
    id: CapitalSubsystemId,
    amount: number,
    shieldAbsorbed: number,
  ): DamageResult | null {
    const state = this.states.get(id);
    if (!state || state.isDestroyed) return null;

    state.health = Math.max(0, state.health - amount);

    let destroyed = false;
    if (state.health <= 0) {
      state.isDestroyed = true;
      destroyed = true;
      if (id === 'reactor' && !this.meltdownStarted) {
        this.meltdownStarted = true;
        this.meltdownElapsed = 0;
      }
    }

    return { id, amount, shieldAbsorbed, destroyed, shieldDestroyed: false };
  }

  private pickTarget(point: Point3Like | null): CapitalSubsystemId | null {
    const alive: SubsystemState[] = [];
    this.states.forEach((s) => {
      if (!s.isDestroyed) alive.push(s);
    });
    if (alive.length === 0) return null;

    if (!this.isFinitePoint(point)) {
      const index = Math.min(alive.length - 1, Math.floor(this.rng() * alive.length));
      return alive[index]?.id ?? null;
    }

    let bestId: CapitalSubsystemId | null = null;
    let bestRatio = Number.POSITIVE_INFINITY;

    for (const state of alive) {
      const def = this.defs.get(state.id);
      if (!def) continue;

      const dx = point.x - def.offset.x;
      const dy = point.y - def.offset.y;
      const dz = point.z - def.offset.z;
      const ratio = Math.sqrt(dx * dx + dy * dy + dz * dz) / def.radius;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        bestId = state.id;
      }
    }

    // 归一化距离 > 1 说明点不在任何命中球内 → 打在舰体上
    return bestRatio <= 1 ? bestId : null;
  }

  private isPositive(value: number): boolean {
    return Number.isFinite(value) && value > 0;
  }

  private isFinitePoint(point: Point3Like | null): point is Point3Like {
    return (
      point !== null &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      Number.isFinite(point.z)
    );
  }
}
