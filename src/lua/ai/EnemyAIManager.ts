/**
 * 敌机 AI 的 Lua 桥接管理器
 *
 * 历史（2026-10-07 查实并修正）：
 *  - 本文件此前用 `fetch('/src/lua/ai/enemy-ai.lua')` 取源码 —— dev 能跑、生产构建必然 404，
 *    会静默退化成内联兜底脚本（等于「假接线」）；现已改为构建期内联（luaSources 注册表）。
 *  - 更根本的是：LuaEngine 一直在 stub 模式（wasmoon 1.16 不再导出 `factory`），
 *    `doString` 是空函数 —— 也就是说 `enemy-ai.lua` **从未被执行过**。
 *    现在真实 Lua 运行时已接通，本模块是它第一个真实消费者。
 *
 * 桥接形态：**句柄常驻 Lua 侧**。
 *   JS 只跨边界传数字/字符串，敌机 AI 的完整状态（patrolTimer / attackCooldown / state …）
 *  保存在 Lua 的注册表里，键是自增整数句柄。每帧 `sync → step → 读回 x/z/state/action`，
 *   于是位置真值始终是实体（经边界钳制后）的位置，Lua 的积分表现为"本帧位移"。
 *   这样做的原因：直接跨边界传表对象并依赖写回语义在不同 wasmoon 版本上不可靠，
 *   而句柄方案只依赖基本类型往返，可移植且零 GC 抖动。
 */

import { luaEngine } from '../LuaEngine';
import type { AIConfig } from '../types';

export type AIType = 'PATROL' | 'AGGRESSIVE' | 'SNIPER' | 'BOSS';

/** 一帧的 Lua 决策结果 */
export interface LuaAIStepResult {
  /** Lua 侧的 X（映射到世界 X） */
  x: number;
  /** Lua 侧的 Y（映射到世界 Z） */
  z: number;
  /** Lua 状态机状态：idle / patrolling / chasing / attacking / aiming / shooting / aggressive / retreating */
  state: string;
  behavior: string;
  /** 本帧动作：melee / shoot / ranged，未触发则为 null */
  action: string | null;
  /** 模块给出的伤害值（仅作对照观测，不直接改平衡，见 LuaEnemyAIBridge） */
  damage: number;
  /** 动作的方向向量（Lua 坐标系） */
  dirX: number;
  dirZ: number;
}

export interface LuaAIStats {
  /** 模块是否真的可用（真实 Lua 已启用 + enemy-ai.lua 加载成功） */
  ready: boolean;
  runtime: string;
  spawned: number;
  despawned: number;
  steps: number;
  /** 模块返回动作（发起攻击意图）的帧数 */
  actions: number;
  /** 跨边界调用出错次数（出错后该敌机永久回落 TS 行为） */
  errors: number;
  /** 句柄查不到（重复 despawn / 泄漏检测） */
  notFound: number;
  /** Lua 侧注册表当前存活数 —— 应恒等于场上存活敌机数 */
  registrySize: number;
  lastError: string;
  loadError: string;
}

/**
 * 桥接脚本：追加在 enemy-ai.lua **之外**（模块源码由 require 装载）。
 *
 * 注意这里刻意不 `load` 源码文本，而是 `require("ai/enemy-ai")`，
 * 走 LuaEngine 注入的真实 Lua 模块装载器 —— 同一条路径以后迁移其余模块时复用。
 */
const ENEMY_AI_BRIDGE = `
local EnemyAI = require("ai/enemy-ai")

local __registry = {}
local __nextId = 0
local __forceError = false

--[[ 诊断 / 测试开关：置真后所有 __ai* 调用抛错，用于验证兜底路径 ]]
function __aiSetForceError(flag)
  __forceError = flag and true or false
  return __forceError
end

--[[ 探针：真实 Lua 下应返回模块版本；stub 下这个全局根本不存在 ]]
function __aiProbe()
  return { ok = true, version = EnemyAI.VERSION, author = EnemyAI.AUTHOR }
end

--[[ 生成敌机 AI 实例，返回整数句柄（<1 表示失败）

  detectRange 由宿主注入：enemy-ai.lua 是"通用行为模板"，它自带的 detectRange
  （20/25/30）是模块示例值，小于本作的刷怪半径（20~30），直接用会让敌机在出生点
  原地发呆。感知范围属于"敌人属性"，应当由宿主按实际数值给。
]]
function __aiSpawn(typeKey, x, z, health, maxHealth, detectRange)
  if __forceError then error("forced error (__aiSpawn)") end
  local r = EnemyAI.createEnemyAI(typeKey, x, z)
  if not r.success then return -1 end
  local e = r.enemy
  if type(health) == "number" and health > 0 then
    e.health = health
    e.maxHealth = (type(maxHealth) == "number" and maxHealth > 0) and maxHealth or health
  end
  if type(detectRange) == "number" and detectRange > 0 then
    e.detectRange = detectRange
  end
  __nextId = __nextId + 1
  __registry[__nextId] = e
  return __nextId
end

--[[ 把宿主侧的真值（实体位置 / 当前血量）同步进 Lua，Lua 的积分因此只是"本帧位移" ]]
function __aiSync(id, x, z, health)
  local e = __registry[id]
  if not e then return false end
  e.x = x
  e.y = z
  if type(health) == "number" then e.health = health end
  return true
end

--[[ 推进一帧。返回扁平表（只含数字/字符串，跨边界安全） ]]
function __aiStep(id, px, pz, dt)
  if __forceError then error("forced error (__aiStep)") end
  local e = __registry[id]
  if not e then return nil end

  local r = EnemyAI.updateAI(e, px, pz, dt)
  if not r.success then return nil end

  local a = r.action
  return {
    x = e.x,
    z = e.y,
    state = e.state,
    behavior = e.behavior,
    action = a and a.action or false,
    damage = (a and a.damage) or 0,
    dirX = (a and a.x) or 0,
    dirZ = (a and a.y) or 0
  }
end

function __aiDespawn(id)
  if __registry[id] == nil then return false end
  __registry[id] = nil
  return true
end

function __aiRegistrySize()
  local n = 0
  for _ in pairs(__registry) do n = n + 1 end
  return n
end

function __aiStatus(id)
  local e = __registry[id]
  if not e then return nil end
  return EnemyAI.getEnemyStatus(e).status
end
`;

interface RawStepResult {
  x?: number;
  z?: number;
  state?: string;
  behavior?: string;
  action?: string | boolean;
  damage?: number;
  dirX?: number;
  dirZ?: number;
}

export class EnemyAIManager {
  private initialized = false;
  private scriptLoaded = false;
  private loadError = '';
  private stats = {
    spawned: 0,
    despawned: 0,
    steps: 0,
    actions: 0,
    errors: 0,
    notFound: 0,
    lastError: '',
  };

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await luaEngine.initialize();

    // Lua 脚本里任何错误都不能把游戏初始化整个带下去：装载失败只降级本模块
    try {
      luaEngine.registerModule({ name: 'enemy_ai', script: ENEMY_AI_BRIDGE });
      this.scriptLoaded = true;
    } catch (error) {
      this.scriptLoaded = false;
      this.loadError = error instanceof Error ? error.message : String(error);
      console.warn('[EnemyAIManager] enemy-ai.lua 装载失败:', this.loadError);
    }

    this.initialized = true;

    if (this.isReady()) {
      const probe = luaEngine.call<{ version?: string }>('__aiProbe');
      console.log(
        `[EnemyAIManager] 已接通 enemy-ai.lua v${probe?.version ?? '?'}` +
          `（运行时 ${luaEngine.getRuntimeMode()}）`,
      );
    } else {
      console.warn(
        '[EnemyAIManager] Lua AI 不可用 —— 敌机 AI 全程回落 TS 实现' +
          (this.loadError ? `（装载错误：${this.loadError}）` : '（运行时非真实 Lua）'),
      );
    }
  }

  /** 模块是否真的可用：探针可调用即真（stub 模式下 __aiProbe 不存在） */
  isReady(): boolean {
    if (!this.scriptLoaded) return false;
    const probe = luaEngine.call<{ ok?: boolean } | undefined>('__aiProbe');
    return probe?.ok === true;
  }

  /** 生成敌机 AI，返回句柄；< 1 表示失败（调用方应回落 TS 行为） */
  spawn(
    type: AIType,
    x: number,
    z: number,
    health: number,
    maxHealth: number,
    detectRange: number,
  ): number {
    const id = luaEngine.call<number>('__aiSpawn', type, x, z, health, maxHealth, detectRange);
    if (typeof id !== 'number' || id < 1) {
      this.stats.errors += 1;
      this.stats.lastError = 'spawn failed';
      return -1;
    }
    this.stats.spawned += 1;
    return id;
  }

  /** 把实体真值同步进 Lua（位置 + 当前血量） */
  sync(id: number, x: number, z: number, health: number): boolean {
    return luaEngine.call<boolean>('__aiSync', id, x, z, health) === true;
  }

  /** 推进一帧；返回 null 表示本帧不可用（调用方应回落 TS 行为） */
  step(id: number, playerX: number, playerZ: number, deltaTime: number): LuaAIStepResult | null {
    const raw = luaEngine.call<RawStepResult | undefined>(
      '__aiStep',
      id,
      playerX,
      playerZ,
      deltaTime,
    );
    if (!raw || typeof raw.x !== 'number' || typeof raw.z !== 'number') {
      this.stats.notFound += 1;
      return null;
    }

    this.stats.steps += 1;
    const action = typeof raw.action === 'string' && raw.action.length > 0 ? raw.action : null;
    if (action) this.stats.actions += 1;

    return {
      x: raw.x,
      z: raw.z,
      state: typeof raw.state === 'string' ? raw.state : 'idle',
      behavior: typeof raw.behavior === 'string' ? raw.behavior : 'unknown',
      action,
      damage: typeof raw.damage === 'number' ? raw.damage : 0,
      dirX: typeof raw.dirX === 'number' ? raw.dirX : 0,
      dirZ: typeof raw.dirZ === 'number' ? raw.dirZ : 0,
    };
  }

  despawn(id: number): void {
    const ok = luaEngine.call<boolean>('__aiDespawn', id);
    if (ok === true) this.stats.despawned += 1;
  }

  /** Lua 侧注册表存活数（泄漏检查：应等于场上存活敌机数） */
  getRegistrySize(): number {
    const size = luaEngine.call<number>('__aiRegistrySize');
    return typeof size === 'number' ? size : -1;
  }

  /** 测试 / 排障开关：强制 Lua 侧抛错，用于验证兜底路径 */
  setForceError(on: boolean): void {
    luaEngine.call('__aiSetForceError', on);
  }

  noteError(message: string): void {
    this.stats.errors += 1;
    this.stats.lastError = message;
  }

  getStats(): LuaAIStats {
    return {
      ready: this.isReady(),
      runtime: luaEngine.getRuntimeMode(),
      spawned: this.stats.spawned,
      despawned: this.stats.despawned,
      steps: this.stats.steps,
      actions: this.stats.actions,
      errors: this.stats.errors,
      notFound: this.stats.notFound,
      registrySize: this.getRegistrySize(),
      lastError: this.stats.lastError,
      loadError: this.loadError,
    };
  }

  resetStats(): void {
    this.stats = {
      spawned: 0,
      despawned: 0,
      steps: 0,
      actions: 0,
      errors: 0,
      notFound: 0,
      lastError: '',
    };
  }

  async reloadScript(): Promise<void> {
    await this.initialize();
    luaEngine.registerModule({ name: 'enemy_ai', script: ENEMY_AI_BRIDGE });
    console.log('[EnemyAIManager] AI script reloaded');
  }

  /** 兼容旧 API：按类型取一份配置快照（不含运行时状态） */
  getAITypeConfig(type: AIType): AIConfig | null {
    const info = luaEngine.call<{ success?: boolean; config?: Record<string, unknown> }>(
      'getAIType',
      type,
    );
    if (!info?.success || !info.config) return null;
    const c = info.config;
    return {
      type: String(c['name'] ?? type).toUpperCase(),
      speed: Number(c['speed'] ?? 0),
      detectRange: Number(c['detectRange'] ?? 0),
      damage: Number(c['damage'] ?? 0),
      health: Number(c['health'] ?? 0),
      behavior: String(c['behavior'] ?? ''),
    };
  }

  destroy(): void {
    this.initialized = false;
    this.scriptLoaded = false;
    console.log('[EnemyAIManager] Destroyed');
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const enemyAIManager = new EnemyAIManager();
