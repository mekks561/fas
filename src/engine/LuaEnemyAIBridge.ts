/**
 * 敌机 AI 的 Lua 适配器 + TS/Lua 运行模式开关
 *
 * 模块定位：把 `enemy-ai.lua`（2D 模型：x/y 平面 + 行为状态机）接成 PlayCanvas 3D 实体
 * 的行为来源，并与原生 TS AI 形成 **A/B 对照**。
 *
 * 坐标映射（唯一一处，别在别处再换算）：
 *   Lua x → 世界 X，Lua y → 世界 Z；Y 轴由本适配器用「高度跟随」补上，
 *   因为 Lua 模块本身没有 Y 轴概念 —— 这是**显式补全**，不是假装 Lua 有 3D 能力。
 *
 * 权限边界：
 *   - 位置：Lua 给方向与位移，本适配器负责钳制到与 `EnemyAI.moveTowards` 相同的边界
 *   - 状态：Lua 的 state 字符串 → `AIState`（供 UI / 调试观测）
 *   - 攻击：Lua 的 action 只作**攻击意图**；伤害数值仍由 `Enemy.stats`（含难度缩放）决定，
 *     保证切换 AI 不改数值平衡。模块返回的 damage 记进统计供对照观察。
 */

import * as pc from 'playcanvas';
import { AIState, type EnemyAI, type ExternalAIBrain } from './EnemyAI';
// 只引类型：Enemy.ts ↔ EnemyAI.ts ↔ 本文件 存在既有的 value 循环，
// 若在这里 value-import EnemyType，映射表会在模块求值期读到未初始化枚举。
import type { PlayerShip } from './PlayerShip';
import type { EnemyType } from './Enemy';
import { enemyAIManager, type AIType } from '../lua/ai/EnemyAIManager';

export type EnemyAIMode = 'ts' | 'lua';

/**
 * EnemyType → Lua AI 类型：**唯一换算处**（同「配置词表 → 运行时词表」的治理口径）。
 *
 * 映射依据 = 交战风格，不是名字相似度：
 *  - AGGRESSIVE（chase，近身 2.0 内出手，detect 20）→ 追击型近战
 *  - SNIPER（ranged，维持 15~25 距离，detect 30）→ 中远距离输出
 *  - BOSS（mixed，血量过半后边退边打）→ 有阶段变化的 Boss
 *  - PATROL（只巡逻、**模块里不返回任何攻击动作**）→ 无人机：A/B 对照中可观测的
 *    行为差异之一（Lua 模式下无人机不主动开火），已在文档中写明
 *
 * 键用 EnemyType 的字符串字面量（string enum 的 Record 键就是字面量），避免运行期依赖枚举对象。
 */
export const ENEMY_TYPE_TO_LUA_AI: Record<EnemyType, AIType> = {
  scout: 'AGGRESSIVE',
  fighter: 'AGGRESSIVE',
  bomber: 'SNIPER',
  tank: 'SNIPER',
  assassin: 'AGGRESSIVE',
  drone: 'PATROL',
  elite: 'AGGRESSIVE',
  corvette: 'SNIPER',
  destroyer: 'SNIPER',
  boss_sentinel: 'BOSS',
  boss_overlord: 'BOSS',
  boss: 'BOSS',
};

/** 与 EnemyAI.moveTowards 一致的场地边界（两处必须同步） */
export const AI_WORLD_BOUNDS = { x: 30, y: 15, z: 30 };

const ALTITUDE_FOLLOW_SPEED = 4;
const MOVEMENT_EPSILON = 0.01;

let currentMode: EnemyAIMode = readModeFromUrl();

function readModeFromUrl(): EnemyAIMode {
  if (typeof window === 'undefined' || !window.location) return 'ts';
  try {
    const requested = new URLSearchParams(window.location.search).get('ai');
    return requested === 'lua' ? 'lua' : 'ts';
  } catch {
    return 'ts';
  }
}

/** 当前敌机 AI 后端（默认 ts；`?ai=lua` 或 __aiDebug.setMode 切换） */
export function getEnemyAIMode(): EnemyAIMode {
  return currentMode;
}

/** 切换后端。只影响**之后生成**的敌机；已生成的敌机保持创建时的后端 */
export function setEnemyAIMode(mode: EnemyAIMode): EnemyAIMode {
  currentMode = mode === 'lua' ? 'lua' : 'ts';
  return currentMode;
}

/** 适配器聚合统计（供 __aiDebug 观测，与 EnemyAIManager 的统计分开：这里是"接线侧"） */
const bridgeStats = {
  created: 0,
  /** 因构造失败（Lua 未就绪）而从未接管的敌机数 */
  rejected: 0,
  /** 运行中被判为不可用后回落 TS 的敌机数 */
  fallbacks: 0,
  disposed: 0,
  lastFallbackReason: '',
};

export function getLuaAIBridgeStats(): typeof bridgeStats & { mode: EnemyAIMode } {
  return { ...bridgeStats, mode: currentMode };
}

export function resetLuaAIBridgeStats(): void {
  bridgeStats.created = 0;
  bridgeStats.rejected = 0;
  bridgeStats.fallbacks = 0;
  bridgeStats.disposed = 0;
  bridgeStats.lastFallbackReason = '';
}

/** Lua 状态字符串 → 引擎 AIState（Lua 模块的行为状态机词表） */
export function luaStateToAIState(luaState: string): AIState {
  switch (luaState) {
    case 'patrolling':
      return AIState.PATROL;
    case 'chasing':
      return AIState.CHASE;
    case 'attacking':
    case 'aggressive':
    case 'aiming':
    case 'shooting':
      return AIState.ATTACK;
    case 'retreating':
      return AIState.RETREAT;
    case 'idle':
    default:
      return AIState.IDLE;
  }
}

/**
 * 单架敌机的 Lua 大脑。
 *
 * 生命周期：`Enemy` 创建 → 构造（spawn 句柄）→ 每帧 update → 敌机销毁时 dispose。
 */
export class LuaEnemyAIBridge implements ExternalAIBrain {
  private handle = -1;
  private failed = false;
  private attackIntent = false;
  private state: AIState = AIState.IDLE;
  private lastAction: string | null = null;
  private lastDamage = 0;
  private lastSyncHealth: number;
  private readonly aiType: AIType;

  constructor(
    private readonly entity: pc.Entity,
    private readonly player: PlayerShip,
    type: EnemyType,
    initialPosition: pc.Vec3,
    health: number,
    maxHealth: number,
    /** 感知半径：由原生 AI 的追击半径注入（模块自带值是通用示例，会把敌机钉在出生点） */
    detectRange: number,
  ) {
    this.aiType = ENEMY_TYPE_TO_LUA_AI[type] ?? 'AGGRESSIVE';
    this.lastSyncHealth = health;

    if (!enemyAIManager.isReady()) {
      this.failed = true;
      bridgeStats.rejected += 1;
      bridgeStats.lastFallbackReason = 'lua-ai-not-ready';
      return;
    }

    const handle = enemyAIManager.spawn(
      this.aiType,
      initialPosition.x,
      initialPosition.z,
      health,
      maxHealth,
      detectRange,
    );
    if (handle < 1) {
      this.failed = true;
      bridgeStats.rejected += 1;
      bridgeStats.lastFallbackReason = 'spawn-failed';
      return;
    }

    this.handle = handle;
    bridgeStats.created += 1;
  }

  /** 本帧是否由 Lua 接管 */
  update(dt: number): boolean {
    if (this.failed || this.handle < 1) return false;

    const position = this.entity.getPosition();
    const playerPosition = this.player.getPosition();

    // 位置真值同步进 Lua：Lua 的积分因此只是"本帧位移"，不会与钳制后的实体位置漂移
    enemyAIManager.sync(this.handle, position.x, position.z, this.lastSyncHealth);

    const step = enemyAIManager.step(this.handle, playerPosition.x, playerPosition.z, dt);
    if (!step) {
      this.fallback('step-failed');
      return false;
    }

    this.state = luaStateToAIState(step.state);
    this.lastAction = step.action;
    this.lastDamage = step.damage;
    this.attackIntent = step.action !== null;

    this.applyPosition(position, playerPosition, step.x, step.z, dt);
    return true;
  }

  /** 把 Lua 的 XZ 决策落到实体上（含边界钳制与高度跟随） */
  private applyPosition(
    from: pc.Vec3,
    playerPosition: pc.Vec3,
    luaX: number,
    luaZ: number,
    dt: number,
  ): void {
    const next = from.clone();
    next.x = Math.max(-AI_WORLD_BOUNDS.x, Math.min(AI_WORLD_BOUNDS.x, luaX));
    next.z = Math.max(-AI_WORLD_BOUNDS.z, Math.min(AI_WORLD_BOUNDS.z, luaZ));

    // Y 轴补全：Lua 是 2D 模型，这里让它向玩家高度缓动（限幅），
    // 否则敌机会被永久钉在出生平面上，看起来像"没接进去"。
    const dy = playerPosition.y - next.y;
    const maxStep = ALTITUDE_FOLLOW_SPEED * dt;
    next.y += Math.max(-maxStep, Math.min(maxStep, dy));
    next.y = Math.max(-AI_WORLD_BOUNDS.y, Math.min(AI_WORLD_BOUNDS.y, next.y));

    this.entity.setPosition(next);

    // 朝向：有位移则朝位移方向，静止则看向玩家
    const moveX = next.x - from.x;
    const moveZ = next.z - from.z;
    if (Math.abs(moveX) > MOVEMENT_EPSILON || Math.abs(moveZ) > MOVEMENT_EPSILON) {
      this.entity.lookAt(new pc.Vec3(next.x + moveX, next.y, next.z + moveZ));
    } else {
      this.entity.lookAt(playerPosition);
    }
  }

  private fallback(reason: string): void {
    this.failed = true;
    this.attackIntent = false;
    bridgeStats.fallbacks += 1;
    bridgeStats.lastFallbackReason = reason;
    enemyAIManager.noteError(reason);
    if (this.handle >= 1) {
      enemyAIManager.despawn(this.handle);
      this.handle = -1;
    }
  }

  consumeAttackIntent(): boolean {
    const intent = this.attackIntent;
    this.attackIntent = false;
    return intent;
  }

  getState(): AIState {
    return this.state;
  }

  /** 观测用：Lua 侧最近一次动作与伤害（damage 不参与结算，仅供对照） */
  getLuaDecision(): { type: AIType; action: string | null; damage: number; failed: boolean } {
    return {
      type: this.aiType,
      action: this.lastAction,
      damage: this.lastDamage,
      failed: this.failed,
    };
  }

  dispose(): void {
    if (this.handle >= 1) {
      enemyAIManager.despawn(this.handle);
      bridgeStats.disposed += 1;
      this.handle = -1;
    }
  }
}

/**
 * 按当前运行模式给敌机挂上 Lua 大脑。
 *
 * 返回 true = 已接管；false = 保持原生 TS 行为（模式为 ts / Lua 未就绪 / 生成失败）。
 * 调用点在 `Enemy` 构造器里 —— 原生 TS AI（EnemyAIFactory）**先创建**，Lua 只是可选接管，
 * 所以兜底是结构性存在的，而不是靠 try/catch 兜。
 */
export function attachLuaBrain(
  ai: EnemyAI,
  entity: pc.Entity,
  player: PlayerShip,
  type: EnemyType,
  initialPosition: pc.Vec3,
  health: number,
  maxHealth: number,
): boolean {
  if (currentMode !== 'lua') return false;

  const bridge = new LuaEnemyAIBridge(
    entity,
    player,
    type,
    initialPosition,
    health,
    maxHealth,
    // 感知半径取自原生 AI（外部大脑接管前已按敌人类型初始化好）
    ai.getDetectionRadius(),
  );
  if (bridge.getLuaDecision().failed) {
    bridge.dispose();
    return false;
  }

  ai.attachExternalBrain(bridge);
  return true;
}
