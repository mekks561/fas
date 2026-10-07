import * as pc from 'playcanvas';
// 只引类型：Enemy.ts 会（经 ProceduralModelGenerator 等）拖进整个引擎图，
// 而这里只在运行期用到 EnemyType 的取值。改成 type-only 后，本模块是"引擎无关"的
// 纯行为逻辑 —— 单测可以直接构造它，不必起 WebGL。
import type { PlayerShip } from './PlayerShip';
import type { EnemyType } from './Enemy';

export enum AIState {
  IDLE = 'idle',
  PATROL = 'patrol',
  CHASE = 'chase',
  ATTACK = 'attack',
  RETREAT = 'retreat',
  EVADE = 'evade',
  STUNNED = 'stunned',
  DEAD = 'dead',
}

export interface AIConfig {
  state: AIState;
  targetPosition?: pc.Vec3;
  patrolRadius: number;
  chaseRadius: number;
  attackRadius: number;
  retreatRadius: number;
  strafeDirection: number;
  strafeTimer: number;
}

export interface StatusEffect {
  type: 'burn' | 'freeze' | 'stun' | 'slow' | 'poison';
  duration: number;
  remainingTime: number;
  intensity: number;
  lastTick: number;
}

/**
 * 外部大脑（Lua）契约。
 *
 * 由 `LuaEnemyAIBridge` 实现：Lua 侧决策接管行为，但状态效果 / 眩晕 / 速度倍率
 * 仍走本基类（技能对敌人的控制不会因为换 AI 后端而失效）。
 */
export interface ExternalAIBrain {
  /** 返回 true = 本帧由外部大脑接管；false = 本帧不可用（调用方回落原生行为） */
  update(dt: number): boolean;
  getState(): AIState;
  /** 取走一次攻击意图（由 Enemy 的攻击判定消费） */
  consumeAttackIntent(): boolean;
  dispose(): void;
}

export abstract class EnemyAI {
  protected entity: pc.Entity;
  protected player: PlayerShip;
  protected aiConfig: AIConfig;
  protected statusEffects: StatusEffect[] = [];
  protected lastUpdateTime: number = 0;
  protected patrolCenter: pc.Vec3;
  /** 外部大脑（Lua AI）；空 = 走原生 TS 行为 */
  private externalBrain: ExternalAIBrain | null = null;
  /** 外部大脑实际接管的帧数（诊断用：证明"真的接管了"而不是挂了个空壳） */
  private externalBrainFrames: number = 0;

  constructor(entity: pc.Entity, player: PlayerShip, initialPosition: pc.Vec3) {
    this.entity = entity;
    this.player = player;
    this.patrolCenter = initialPosition.clone();

    this.aiConfig = {
      state: AIState.PATROL,
      patrolRadius: 10,
      chaseRadius: 25,
      attackRadius: 3,
      retreatRadius: 5,
      strafeDirection: 1,
      strafeTimer: 0,
    };
  }

  public update(dt: number): void {
    this.lastUpdateTime += dt;

    this.updateStatusEffects(dt);

    if (this.isStunned()) {
      return;
    }

    if (this.externalBrain) {
      if (this.externalBrain.update(dt)) {
        this.externalBrainFrames += 1;
        this.aiConfig.state = this.externalBrain.getState();
        return;
      }
      // 外部大脑本帧起不可用（Lua 报错 / 运行时未就绪）→ 永久摘掉，回落到原生 TS 行为。
      // 不做每帧重试：失败后重试只会持续产生同样的错误日志。
      this.detachExternalBrain();
    }

    this.executeBehavior(dt);
  }

  /** 挂载外部大脑（Lua）。原生 TS 行为仍完整保留作兜底 */
  public attachExternalBrain(brain: ExternalAIBrain): void {
    this.externalBrain = brain;
    this.externalBrainFrames = 0;
  }

  public detachExternalBrain(): void {
    if (!this.externalBrain) return;
    this.externalBrain.dispose();
    this.externalBrain = null;
  }

  /** 当前是否由外部大脑接管（Enemy 据此决定攻击判定走哪条路） */
  public isExternalBrainActive(): boolean {
    return this.externalBrain !== null;
  }

  /** 外部大脑本帧是否有攻击意图（取走后清零） */
  public consumeAttackIntent(): boolean {
    return this.externalBrain?.consumeAttackIntent() ?? false;
  }

  /** 诊断：外部大脑接管帧数 */
  public getExternalBrainFrames(): number {
    return this.externalBrainFrames;
  }

  /**
   * 感知半径 = 原生 AI 的追击半径。
   *
   * 外部大脑（Lua 的 enemy-ai.lua）是通用行为模板，自带的 detectRange 只是示例值；
   * 感知范围属于「敌人属性」，由宿主按这个值注入，避免通用模板的默认值把敌机
   * 钉在出生点（本作刷怪半径 20~30 > 模块默认 20）。
   */
  public getDetectionRadius(): number {
    return this.aiConfig.chaseRadius;
  }

  /**
   * 外部大脑的可选诊断信息（Lua 桥接实现了 `getLuaDecision` 时返回，
   * 否则 null）。仅用于调试钩子，不参与任何行为决策。
   */
  public getExternalBrainDiagnostics(): Record<string, unknown> | null {
    const brain = this.externalBrain as unknown as {
      getLuaDecision?: () => Record<string, unknown>;
    } | null;
    if (!brain?.getLuaDecision) return null;
    return brain.getLuaDecision();
  }

  /** 直接设置 AI 状态（外部大脑回写状态用） */
  public setAIState(state: AIState): void {
    this.aiConfig.state = state;
  }

  public getAIState(): AIState {
    return this.aiConfig.state;
  }

  protected abstract executeBehavior(dt: number): void;

  protected updateStatusEffects(dt: number): void {
    this.statusEffects = this.statusEffects.filter((effect) => {
      effect.remainingTime -= dt * 1000;

      if (effect.remainingTime <= 0) {
        return false;
      }

      return true;
    });
  }

  protected isStunned(): boolean {
    return this.statusEffects.some((e) => e.type === 'stun' && e.remainingTime > 0);
  }

  protected getSpeedMultiplier(): number {
    let multiplier = 1;

    this.statusEffects.forEach((effect) => {
      if (effect.type === 'slow' && effect.remainingTime > 0) {
        multiplier *= 1 - effect.intensity;
      }
      if (effect.type === 'freeze' && effect.remainingTime > 0) {
        multiplier *= 0.1;
      }
    });

    return multiplier;
  }

  protected applyStatusEffectToSelf(effect: StatusEffect): void {
    const existingIndex = this.statusEffects.findIndex((e) => e.type === effect.type);

    if (existingIndex >= 0) {
      this.statusEffects[existingIndex].remainingTime = effect.duration;
      this.statusEffects[existingIndex].intensity = effect.intensity;
    } else {
      this.statusEffects.push({ ...effect, lastTick: Date.now() });
    }
  }

  public addStatusEffect(type: StatusEffect['type'], duration: number, intensity: number): void {
    this.applyStatusEffectToSelf({
      type,
      duration,
      remainingTime: duration,
      intensity,
      lastTick: Date.now(),
    });
  }

  public getStatusEffects(): StatusEffect[] {
    return [...this.statusEffects];
  }

  public clearStatusEffects(): void {
    this.statusEffects = [];
  }

  public getDistanceToPlayer(): number {
    const playerPos = this.player.getPosition();
    const enemyPos = this.entity.getPosition();
    return playerPos.clone().sub(enemyPos).length();
  }

  /**
   * 同步 AI 的 attackRadius 与 Enemy 的 attackRange
   * 确保 attackRadius <= attackRange，这样敌人进入 ATTACK 状态时一定在攻击范围内，
   * 避免出现"敌人在 attackRadius 停下但 distance > attackRange 导致永不攻击"的问题
   * （FighterAI 被多种敌人复用，各敌人 attackRange 不同，必须动态同步）
   */
  public syncAttackRange(attackRange: number): void {
    if (attackRange > 0 && this.aiConfig.attackRadius > attackRange) {
      this.aiConfig.attackRadius = attackRange;
    }
  }

  protected getDirectionToPlayer(): pc.Vec3 {
    const playerPos = this.player.getPosition();
    const enemyPos = this.entity.getPosition();
    return playerPos.clone().sub(enemyPos).normalize();
  }

  protected getDirectionToPatrolCenter(): pc.Vec3 {
    const enemyPos = this.entity.getPosition();
    return this.patrolCenter.clone().sub(enemyPos).normalize();
  }

  /**
   * 计算 3D 垂直向量：用世界 up 与 direction 叉乘
   * 替代旧的 `new pc.Vec3(-direction.z, 0, direction.x)`（y 硬编码 0 的 2D 写法）
   * 这样敌人的 zigzag/strafe 机动在 Y 轴也有分量，实现真正的 3D 空间行为
   */
  protected getPerpendicular(direction: pc.Vec3): pc.Vec3 {
    const worldUp = new pc.Vec3(0, 1, 0);
    return new pc.Vec3().cross(direction, worldUp).normalize();
  }

  protected moveTowards(direction: pc.Vec3, speed: number, dt: number): void {
    // Engine 2 的 getPosition() 返回 Readonly<Vec3>，就地改 x/y/z 会被拒；clone() 出一份可写副本
    const currentPos = this.entity.getPosition().clone();
    const movement = direction.normalize().scale(speed * dt);
    currentPos.add(movement);

    currentPos.x = Math.max(-30, Math.min(30, currentPos.x));
    currentPos.y = Math.max(-15, Math.min(15, currentPos.y));
    currentPos.z = Math.max(-30, Math.min(30, currentPos.z));

    this.entity.setPosition(currentPos);
  }

  public abstract getState(): AIState;
}

export class ScoutAI extends EnemyAI {
  private zigzagTimer: number = 0;
  private zigzagAmplitude: number = 3;
  // 俯冲攻击模式：当敌人在玩家上方时强烈向下冲刺
  private diveMode: boolean = false;
  private diveCooldown: number = 0;

  constructor(entity: pc.Entity, player: PlayerShip, initialPosition: pc.Vec3) {
    super(entity, player, initialPosition);
    this.aiConfig.patrolRadius = 8;
    this.aiConfig.chaseRadius = 35;
    this.aiConfig.attackRadius = 2;
  }

  protected executeBehavior(dt: number): void {
    const distance = this.getDistanceToPlayer();

    if (distance > this.aiConfig.chaseRadius) {
      this.aiConfig.state = AIState.PATROL;
      this.executePatrol(dt);
    } else if (distance <= this.aiConfig.attackRadius) {
      this.aiConfig.state = AIState.ATTACK;
      this.executeAttack(dt);
    } else {
      this.aiConfig.state = AIState.CHASE;
      this.executeChase(dt);
    }
  }

  private executePatrol(dt: number): void {
    this.zigzagTimer += dt;

    const centerDir = this.getDirectionToPatrolCenter();
    // 使用 3D 垂直向量（替代旧的 2D 硬编码 y=0）
    const perpendicular = this.getPerpendicular(centerDir);

    const zigzagOffset = Math.sin(this.zigzagTimer * 2) * this.zigzagAmplitude;
    const movement = centerDir.clone().add(perpendicular.clone().scale(zigzagOffset));

    const speed = 3 * this.getSpeedMultiplier();
    this.moveTowards(movement, speed, dt);

    this.entity.lookAt(this.entity.getPosition().clone().add(movement));
  }

  private executeChase(dt: number): void {
    this.zigzagTimer += dt;
    this.diveCooldown -= dt;

    const direction = this.getDirectionToPlayer();
    const enemyPos = this.entity.getPosition();
    const playerPos = this.player.getPosition();
    const aboveBy = enemyPos.y - playerPos.y; // 敌人高于玩家的距离

    // 俯冲模式：当敌人在玩家上方且冷却结束时触发
    if (!this.diveMode && aboveBy > 4 && this.diveCooldown <= 0) {
      this.diveMode = true;
    }

    if (this.diveMode) {
      // 强烈向下冲向玩家（增加 Y 轴速度分量）
      direction.y = Math.min(direction.y, -1) * 1.5;
      // 到达玩家高度时结束俯冲，进入冷却
      if (aboveBy <= 0.5) {
        this.diveMode = false;
        this.diveCooldown = 3; // 3 秒俯冲冷却
      }
    } else {
      // 正常 XZ 平面 zigzag 机动（使用 3D 垂直向量）
      const perpendicular = this.getPerpendicular(direction);
      const zigzagOffset = Math.sin(this.zigzagTimer * 4) * this.zigzagAmplitude;
      direction.add(perpendicular.scale(zigzagOffset * 0.5));
    }

    const speed = 8 * this.getSpeedMultiplier();
    this.moveTowards(direction, speed, dt);

    this.entity.lookAt(this.player.getPosition());
  }

  private executeAttack(dt: number): void {
    const direction = this.getDirectionToPlayer();
    const backward = direction.clone().scale(-1);

    this.moveTowards(backward, 5, dt);
    this.entity.lookAt(this.player.getPosition());
  }

  public getState(): AIState {
    return this.aiConfig.state;
  }
}

export class FighterAI extends EnemyAI {
  private strafeTimer: number = 0;
  private strafeDuration: number = 2;

  constructor(entity: pc.Entity, player: PlayerShip, initialPosition: pc.Vec3) {
    super(entity, player, initialPosition);
    this.aiConfig.patrolRadius = 12;
    this.aiConfig.chaseRadius = 35;
    this.aiConfig.attackRadius = 4;
    this.aiConfig.retreatRadius = 2;
  }

  protected executeBehavior(dt: number): void {
    const distance = this.getDistanceToPlayer();

    if (distance > this.aiConfig.chaseRadius) {
      this.aiConfig.state = AIState.PATROL;
      this.executePatrol(dt);
    } else if (distance <= this.aiConfig.attackRadius) {
      this.aiConfig.state = AIState.ATTACK;
      this.executeAttack(dt);
    } else {
      this.aiConfig.state = AIState.CHASE;
      this.executeChase(dt);
    }
  }

  private executePatrol(dt: number): void {
    const centerDir = this.getDirectionToPatrolCenter();
    const speed = 2 * this.getSpeedMultiplier();

    this.moveTowards(centerDir, speed, dt);

    const lookTarget = this.entity.getPosition().clone().add(centerDir);
    this.entity.lookAt(lookTarget);
  }

  private executeChase(dt: number): void {
    this.strafeTimer += dt;

    if (this.strafeTimer >= this.strafeDuration) {
      this.strafeTimer = 0;
      this.aiConfig.strafeDirection *= -1;
    }

    const direction = this.getDirectionToPlayer();
    const perpendicular = this.getPerpendicular(direction);

    const movement = direction
      .clone()
      .scale(0.6)
      .add(perpendicular.clone().scale(this.aiConfig.strafeDirection * 0.4));

    const speed = 5 * this.getSpeedMultiplier();
    this.moveTowards(movement, speed, dt);

    this.entity.lookAt(this.player.getPosition());
  }

  private executeAttack(dt: number): void {
    const direction = this.getDirectionToPlayer();

    if (this.getDistanceToPlayer() < this.aiConfig.retreatRadius) {
      const retreat = direction.clone().scale(-1);
      this.moveTowards(retreat, 3, dt);
    }

    this.entity.lookAt(this.player.getPosition());
  }

  public getState(): AIState {
    return this.aiConfig.state;
  }
}

export class TankAI extends EnemyAI {
  private chargeTimer: number = 0;
  private isCharging: boolean = false;

  constructor(entity: pc.Entity, player: PlayerShip, initialPosition: pc.Vec3) {
    super(entity, player, initialPosition);
    this.aiConfig.patrolRadius = 5;
    this.aiConfig.chaseRadius = 35;
    this.aiConfig.attackRadius = 5;
  }

  protected executeBehavior(dt: number): void {
    const distance = this.getDistanceToPlayer();

    if (distance > this.aiConfig.chaseRadius) {
      this.aiConfig.state = AIState.PATROL;
      this.executePatrol(dt);
    } else if (this.isCharging) {
      this.executeCharge(dt);
    } else if (distance <= this.aiConfig.attackRadius) {
      this.aiConfig.state = AIState.ATTACK;
      this.executeAttack(dt);
    } else {
      this.aiConfig.state = AIState.CHASE;
      this.executeChase(dt);
    }
  }

  private executePatrol(dt: number): void {
    const centerDir = this.getDirectionToPatrolCenter();
    const speed = 1 * this.getSpeedMultiplier();

    this.moveTowards(centerDir, speed, dt);
    this.entity.lookAt(this.entity.getPosition().clone().add(centerDir));
  }

  private executeChase(dt: number): void {
    this.chargeTimer += dt;

    if (this.chargeTimer >= 3) {
      this.isCharging = true;
      this.chargeTimer = 0;
    }

    const direction = this.getDirectionToPlayer();
    const speed = 2 * this.getSpeedMultiplier();

    this.moveTowards(direction, speed, dt);
    this.entity.lookAt(this.player.getPosition());
  }

  private executeCharge(dt: number): void {
    const direction = this.getDirectionToPlayer();
    const speed = 10 * this.getSpeedMultiplier();

    this.moveTowards(direction, speed, dt);
    this.entity.lookAt(this.player.getPosition());

    this.chargeTimer += dt;
    if (this.chargeTimer >= 1) {
      this.isCharging = false;
      this.chargeTimer = 0;
    }
  }

  private executeAttack(dt: number): void {
    this.entity.lookAt(this.player.getPosition());

    if (this.getDistanceToPlayer() < 3) {
      const direction = this.getDirectionToPlayer().clone().scale(-1);
      this.moveTowards(direction, 2, dt);
    }
  }

  public getState(): AIState {
    return this.aiConfig.state;
  }
}

export class EliteAI extends EnemyAI {
  constructor(entity: pc.Entity, player: PlayerShip, initialPosition: pc.Vec3) {
    super(entity, player, initialPosition);
    this.aiConfig.patrolRadius = 15;
    this.aiConfig.chaseRadius = 35;
    this.aiConfig.attackRadius = 8;
  }

  protected executeBehavior(dt: number): void {
    const distance = this.getDistanceToPlayer();

    if (distance > this.aiConfig.chaseRadius) {
      this.aiConfig.state = AIState.PATROL;
      this.executePatrol(dt);
    } else if (distance <= this.aiConfig.attackRadius) {
      this.aiConfig.state = AIState.ATTACK;
      this.executeAttack(dt);
    } else {
      this.aiConfig.state = AIState.CHASE;
      this.executeChase(dt);
    }
  }

  private executePatrol(dt: number): void {
    const centerDir = this.getDirectionToPatrolCenter();
    const speed = 3 * this.getSpeedMultiplier();

    this.moveTowards(centerDir, speed, dt);
    this.entity.lookAt(this.entity.getPosition().clone().add(centerDir));
  }

  private executeChase(dt: number): void {
    const direction = this.getDirectionToPlayer();
    const speed = 6 * this.getSpeedMultiplier();

    this.moveTowards(direction, speed, dt);
    this.entity.lookAt(this.player.getPosition());
  }

  private executeAttack(dt: number): void {
    const direction = this.getDirectionToPlayer();
    const perpendicular = this.getPerpendicular(direction);

    this.aiConfig.strafeTimer += dt;
    if (this.aiConfig.strafeTimer >= 1.5) {
      this.aiConfig.strafeTimer = 0;
      this.aiConfig.strafeDirection *= -1;
    }

    const strafeDir = perpendicular.clone().scale(this.aiConfig.strafeDirection);
    const movement = direction.clone().scale(0.3).add(strafeDir.scale(0.7));

    const speed = 4 * this.getSpeedMultiplier();
    this.moveTowards(movement, speed, dt);
    this.entity.lookAt(this.player.getPosition());
  }

  public getState(): AIState {
    return this.aiConfig.state;
  }
}

export class BossAI extends EnemyAI {
  private phase: number = 1;
  private attackPattern: number = 0;
  private patternTimer: number = 0;
  private isEnraged: boolean = false;

  constructor(entity: pc.Entity, player: PlayerShip, initialPosition: pc.Vec3) {
    super(entity, player, initialPosition);
    this.aiConfig.patrolRadius = 20;
    this.aiConfig.chaseRadius = 35;
    this.aiConfig.attackRadius = 6;
  }

  protected executeBehavior(dt: number): void {
    const distance = this.getDistanceToPlayer();

    if (distance > this.aiConfig.chaseRadius) {
      this.aiConfig.state = AIState.PATROL;
      this.executePatrol(dt);
    } else if (distance <= this.aiConfig.attackRadius) {
      this.aiConfig.state = AIState.ATTACK;
      this.executeAttack(dt);
    } else {
      this.aiConfig.state = AIState.CHASE;
      this.executeChase(dt);
    }
  }

  private executePatrol(dt: number): void {
    const centerDir = this.getDirectionToPatrolCenter();
    const speed = 2 * this.getSpeedMultiplier();

    this.moveTowards(centerDir, speed, dt);
    this.entity.lookAt(this.entity.getPosition().clone().add(centerDir));
  }

  private executeChase(dt: number): void {
    this.patternTimer += dt;

    if (this.patternTimer >= 3) {
      this.patternTimer = 0;
      this.attackPattern = (this.attackPattern + 1) % 3;
    }

    const direction = this.getDirectionToPlayer();

    switch (this.attackPattern) {
      case 0:
        this.executeChargeAttack(dt, direction);
        break;
      case 1:
        this.executeCircleAttack(dt, direction);
        break;
      case 2:
        this.executeFlankAttack(dt, direction);
        break;
    }

    this.entity.lookAt(this.player.getPosition());
  }

  private executeChargeAttack(dt: number, direction: pc.Vec3): void {
    const speed = this.isEnraged ? 8 : 5;

    this.moveTowards(direction, speed, dt);
  }

  private executeCircleAttack(dt: number, direction: pc.Vec3): void {
    const perpendicular = this.getPerpendicular(direction);

    this.aiConfig.strafeTimer += dt * 0.5;
    const strafeAmount = Math.sin(this.aiConfig.strafeTimer) * 0.7;

    const movement = direction.clone().scale(0.3).add(perpendicular.clone().scale(strafeAmount));

    const speed = this.isEnraged ? 6 : 4;
    this.moveTowards(movement, speed, dt);
  }

  private executeFlankAttack(dt: number, direction: pc.Vec3): void {
    const perpendicular = this.getPerpendicular(direction);

    const flankDir =
      this.aiConfig.strafeDirection > 0 ? perpendicular : perpendicular.clone().scale(-1);

    const movement = flankDir.clone().scale(0.8).add(direction.clone().scale(0.2));

    const speed = this.isEnraged ? 7 : 5;
    this.moveTowards(movement, speed, dt);

    if (this.aiConfig.strafeTimer >= 2) {
      this.aiConfig.strafeDirection *= -1;
      this.aiConfig.strafeTimer = 0;
    }
  }

  private executeAttack(dt: number): void {
    const direction = this.getDirectionToPlayer();
    const backward = direction.clone().scale(-1);

    this.moveTowards(backward, 3, dt);
    this.entity.lookAt(this.player.getPosition());
  }

  public getState(): AIState {
    return this.aiConfig.state;
  }

  public getPhase(): number {
    return this.phase;
  }

  public isEnragedBoss(): boolean {
    return this.isEnraged;
  }
}

/**
 * 敌人类型 → 原生 AI 的实现表。
 *
 * 键用 EnemyType 的字符串字面量（string enum 的 Record 键就是字面量），
 * 于是既能拿到编译期的完整性检查，又不必在运行期 import 枚举对象
 * （Enemy.ts ↔ EnemyAI.ts 的运行期循环就此消除）。
 *
 * 注意：这里**刻意保持**改造前 switch 的映射结果（原 switch 只显式列了
 * SCOUT/FIGHTER/TANK/ELITE/BOSS，其余一律落到 default 的 FighterAI），
 * 不要"顺手"把 bomber/assassin/destroyer 等映射到更贴合名字的 AI ——
 * 那是行为改动，不属于本次接线范围。
 */
const NATIVE_AI_FACTORY: Record<EnemyType, (e: pc.Entity, p: PlayerShip, pos: pc.Vec3) => EnemyAI> =
  {
    scout: (e, p, pos) => new ScoutAI(e, p, pos),
    fighter: (e, p, pos) => new FighterAI(e, p, pos),
    bomber: (e, p, pos) => new FighterAI(e, p, pos),
    tank: (e, p, pos) => new TankAI(e, p, pos),
    assassin: (e, p, pos) => new FighterAI(e, p, pos),
    drone: (e, p, pos) => new FighterAI(e, p, pos),
    elite: (e, p, pos) => new EliteAI(e, p, pos),
    corvette: (e, p, pos) => new FighterAI(e, p, pos),
    destroyer: (e, p, pos) => new FighterAI(e, p, pos),
    boss_sentinel: (e, p, pos) => new FighterAI(e, p, pos),
    boss_overlord: (e, p, pos) => new FighterAI(e, p, pos),
    boss: (e, p, pos) => new BossAI(e, p, pos),
  };

export class EnemyAIFactory {
  public static createAI(
    type: EnemyType,
    entity: pc.Entity,
    player: PlayerShip,
    initialPosition: pc.Vec3,
  ): EnemyAI {
    const make = NATIVE_AI_FACTORY[type];
    return make
      ? make(entity, player, initialPosition)
      : new FighterAI(entity, player, initialPosition);
  }
}
