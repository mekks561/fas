import { luaEngine } from '../LuaEngine';
import type { DifficultyLevel } from '../types';

const waveScriptModules = import.meta.glob('./wave-manager.lua', { as: 'raw', eager: true });
const waveManagerScript = waveScriptModules['./wave-manager.lua'] || '';

export interface EnemyConfig {
  type: string;
  health: number;
  damage: number;
  speed: number;
  score: number;
  isBoss: boolean;
  isElite: boolean;
}

export interface WaveState {
  waveNumber: number;
  maxWaves: number;
  currentState: string;
  enemiesSpawned: number;
  enemiesDefeated: number;
  enemiesRemaining: number;
  elapsedTime: number;
  difficulty: string;
  isBossWave: boolean;
  isEliteWave: boolean;
  progress: number;
}

/**
 * 关卡显式波次计划（由 levels 派生层 buildWavePlans 产出）。
 * 注入后波次的敌人数量/类型/boss 判定全部由关卡数据决定（「计划模式」），
 * 不再走 Lua 的公式生成；不注入（生存模式等）则保持 Lua 公式路径不变。
 */
export interface WavePlan {
  waveNumber: number;
  /** 运行时敌人类型 id（EnemySystem.enemyTypeFromString 词表），按生成顺序展开。 */
  enemyTypes: string[];
}

interface PlanState {
  waveNumber: number;
  maxWaves: number;
  currentState: 'waiting' | 'active' | 'paused' | 'completed' | 'failed';
  enemiesSpawned: number;
  enemiesDefeated: number;
  enemiesRemaining: number;
  elapsedTime: number;
  difficulty: string;
  isBossWave: boolean;
  isEliteWave: boolean;
  spawnedTypes: string[];
}

const initialPlanState = (): PlanState => ({
  waveNumber: 1,
  maxWaves: 10,
  currentState: 'waiting',
  enemiesSpawned: 0,
  enemiesDefeated: 0,
  enemiesRemaining: 0,
  elapsedTime: 0,
  difficulty: 'normal',
  isBossWave: false,
  isEliteWave: false,
  spawnedTypes: [],
});

export class WaveManager {
  private initialized = false;
  /** 非空 = 计划模式：显式波次表优先于 Lua 公式。 */
  private wavePlans: WavePlan[] | null = null;
  private planState: PlanState = initialPlanState();

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await luaEngine.initialize();

    const waveScript = await this.loadWaveScript();
    luaEngine.registerModule({ name: 'wave_manager', script: waveScript });

    this.initialized = true;
    console.log('[WaveManager] Initialized');
  }

  private async loadWaveScript(): Promise<string> {
    if (waveManagerScript) {
      return `
${waveManagerScript}

local WaveManager = require("wave_manager_module")

function getWaveState()
  return WaveManager.getWaveState().state
end

function setDifficulty(difficulty)
  local result = WaveManager.setDifficulty(difficulty)
  return result.success
end

function setMaxWaves(maxWaves)
  local result = WaveManager.setMaxWaves(maxWaves)
  return result.success
end

function calculateEnemyCount(waveNumber)
  local result = WaveManager.calculateEnemyCount(waveNumber)
  if result.success then
    return result.count
  end
  return 5
end

function isBossWave(waveNumber)
  local result = WaveManager.isBossWave(waveNumber)
  if result.success then
    return result.isBoss
  end
  return false
end

function isEliteWave(waveNumber)
  local result = WaveManager.isEliteWave(waveNumber)
  if result.success then
    return result.isElite
  end
  return false
end

function generateEnemyTypes(waveNumber)
  local result = WaveManager.generateEnemyTypes(waveNumber)
  if result.success then
    return result.enemyTypes
  end
  return {}
end

function getEnemyConfig(enemyType)
  local result = WaveManager.getEnemyConfig(enemyType)
  if result.success then
    return result.config
  end
  return nil
end

function startWave(waveNumber)
  local result = WaveManager.startWave(waveNumber)
  if result.success then
    return {
      success = true,
      waveNumber = result.waveNumber,
      enemyCount = result.enemyCount,
      isBossWave = result.isBossWave,
      isEliteWave = result.isEliteWave,
      enemyTypes = result.enemyTypes
    }
  end
  return { success = false, error = result.error }
end

function spawnNextEnemy()
  local result = WaveManager.spawnNextEnemy()
  if result.success then
    return {
      success = true,
      enemy = result.enemy,
      spawnIndex = result.spawnIndex,
      totalToSpawn = result.totalToSpawn
    }
  end
  return { success = false, error = result.error }
end

function onEnemyDefeated(enemyType)
  local result = WaveManager.onEnemyDefeated(enemyType)
  if result.success then
    return {
      success = true,
      enemiesDefeated = result.enemiesDefeated,
      enemiesRemaining = result.enemiesRemaining,
      isWaveComplete = result.isWaveComplete,
      score = result.score
    }
  end
  return { success = false, error = result.error }
end

function completeWave()
  local result = WaveManager.completeWave()
  if result.success then
    return {
      success = true,
      waveNumber = result.waveNumber,
      enemiesDefeated = result.enemiesDefeated,
      elapsedTime = result.elapsedTime,
      isLastWave = result.isLastWave
    }
  end
  return { success = false }
end

function failWave()
  local result = WaveManager.failWave()
  if result.success then
    return {
      success = true,
      waveNumber = result.waveNumber,
      enemiesRemaining = result.enemiesRemaining
    }
  end
  return { success = false }
end

function pauseWave()
  local result = WaveManager.pauseWave()
  return result.success
end

function resumeWave()
  local result = WaveManager.resumeWave()
  return result.success
end

function updateWave(deltaTime)
  local result = WaveManager.update(deltaTime)
  if result.success then
    return {
      elapsedTime = result.elapsedTime,
      state = result.state,
      enemiesRemaining = result.enemiesRemaining
    }
  end
  return { elapsedTime = 0, state = 'waiting', enemiesRemaining = 0 }
end

function resetWaveManager()
  local result = WaveManager.reset()
  return result.success
end

function getNextWaveNumber()
  local result = WaveManager.getNextWaveNumber()
  if result.success then
    return result.waveNumber
  end
  return nil
end

function getWaveScoreMultiplier()
  local result = WaveManager.getWaveScoreMultiplier()
  if result.success then
    return result.multiplier
  end
  return 1.0
end
      `;
    }

    console.warn('[WaveManager] Failed to load lua file, using fallback');
    return `
WaveManager = {
  waveNumber = 1,
  maxWaves = 10,
  state = "waiting",
  enemiesSpawned = 0,
  enemiesDefeated = 0,
  enemiesRemaining = 0,
  elapsedTime = 0,
  difficulty = "normal",
  isBossWave = false,
  isEliteWave = false
}

function getWaveState()
  return WaveManager
end

function setDifficulty(difficulty)
  WaveManager.difficulty = difficulty
  return true
end

function setMaxWaves(maxWaves)
  WaveManager.maxWaves = maxWaves
  return true
end

function calculateEnemyCount(waveNumber)
  local baseCount = 5
  local growthFactor = 1.1
  return math.floor(baseCount * math.pow(growthFactor, waveNumber - 1))
end

function isBossWave(waveNumber)
  return waveNumber % 5 == 0
end

function isEliteWave(waveNumber)
  return waveNumber % 3 == 0 and not isBossWave(waveNumber)
end

function generateEnemyTypes(waveNumber)
  local types = {}
  local count = calculateEnemyCount(waveNumber)
  for i = 1, count do
    types[i] = "basic"
  end
  return types
end

function getEnemyConfig(enemyType)
  return { type = enemyType, health = 50, damage = 10, speed = 2.0, score = 100, isBoss = false, isElite = false }
end

function startWave(waveNumber)
  WaveManager.waveNumber = waveNumber
  WaveManager.state = "active"
  WaveManager.enemiesSpawned = 0
  WaveManager.enemiesDefeated = 0
  WaveManager.enemiesRemaining = calculateEnemyCount(waveNumber)
  WaveManager.isBossWave = isBossWave(waveNumber)
  WaveManager.isEliteWave = isEliteWave(waveNumber)
  WaveManager.enemyTypes = generateEnemyTypes(waveNumber)
  return { success = true, waveNumber = waveNumber, enemyCount = WaveManager.enemiesRemaining, isBossWave = WaveManager.isBossWave, isEliteWave = WaveManager.isEliteWave, enemyTypes = WaveManager.enemyTypes }
end

function spawnNextEnemy()
  if WaveManager.enemiesSpawned >= WaveManager.enemiesRemaining then
    return { success = false }
  end
  WaveManager.enemiesSpawned = WaveManager.enemiesSpawned + 1
  return { success = true, enemy = getEnemyConfig("basic"), spawnIndex = WaveManager.enemiesSpawned }
end

function onEnemyDefeated(enemyType)
  WaveManager.enemiesDefeated = WaveManager.enemiesDefeated + 1
  WaveManager.enemiesRemaining = WaveManager.enemiesRemaining - 1
  return { success = true, isWaveComplete = WaveManager.enemiesRemaining <= 0 }
end

function pauseWave()
  WaveManager.state = "paused"
  return true
end

function resumeWave()
  WaveManager.state = "active"
  return true
end

function updateWave(deltaTime)
  if WaveManager.state == "active" then
    WaveManager.elapsedTime = WaveManager.elapsedTime + deltaTime
  end
  return { elapsedTime = WaveManager.elapsedTime, state = WaveManager.state, enemiesRemaining = WaveManager.enemiesRemaining }
end

function resetWaveManager()
  WaveManager = { waveNumber = 1, maxWaves = 10, state = "waiting", enemiesSpawned = 0, enemiesDefeated = 0, enemiesRemaining = 0, elapsedTime = 0, difficulty = "normal" }
  return true
end

function getNextWaveNumber()
  return WaveManager.waveNumber + 1
end

function getWaveScoreMultiplier()
  return 1.0 + WaveManager.waveNumber * 0.1
end
      `;
  }

  // -------------------------------------------------------------------------
  // 计划模式：关卡显式波次表（WavePlan[]）优先于 Lua 公式。
  // 设计要点：
  //  - 计划模式下**完全不触碰 Lua**（Lua 侧状态可能是 waiting/stale），波次
  //    状态由 planState 本地维护 —— 因此这些方法不要求 initialized（不依赖 Lua）。
  //  - boss/elite 判定由数据决定：该波 enemyTypes 含 boss*/elite 即为对应波。
  //    这同时修掉了「3 波关卡永不出现 boss」（旧公式 boss = wave % 5 == 0，
  //    而战役波数常 < 5，boss 波根本轮不到）。
  //  - 未注入计划（生存模式等）时所有方法保持原 Lua 公式路径，行为不变。
  // -------------------------------------------------------------------------

  /**
   * 注入/清除关卡显式波次表。传 null 回落 Lua 公式（生存模式）。
   * 注入时 maxWaves 同步取计划波数 —— 此前 GameScene 先 setMaxWaves(3)（走 Lua）、
   * 再注入计划，planState 保留的却是 Lua 侧陈旧的 maxWaves，末波判定永不成立。
   */
  setLevelWaves(plans: WavePlan[] | null): void {
    this.wavePlans = plans;
    if (plans) {
      const maxWaves = plans.length;
      this.planState = initialPlanState();
      this.planState.maxWaves = maxWaves;
    } else {
      const maxWaves = this.planState.maxWaves;
      this.planState = initialPlanState();
      this.planState.maxWaves = maxWaves;
    }
    console.log(
      `[WaveManager] ${plans ? `已注入 ${plans.length} 波显式计划（共 ${plans.reduce((s, p) => s + p.enemyTypes.length, 0)} 敌人，maxWaves=${this.planState.maxWaves}）` : '已清除波次计划，回落 Lua 公式'}`,
    );
  }

  private getPlanFor(waveNumber: number): WavePlan | null {
    if (!this.wavePlans) return null;
    return this.wavePlans.find((p) => p.waveNumber === waveNumber) ?? null;
  }

  /** 观测用：当前注入的计划波数（未注入计划模式返回 0）。 */
  getWavePlanCount(): number {
    return this.wavePlans?.length ?? 0;
  }

  private planStartWave(waveNumber: number):
    | {
        success: boolean;
        waveNumber: number;
        enemyCount: number;
        isBossWave: boolean;
        isEliteWave: boolean;
        enemyTypes: string[];
      }
    | { success: boolean; error: string } {
    const plan = this.getPlanFor(waveNumber);
    if (!plan) {
      return { success: false, error: 'waveNumber exceeds maxWaves' };
    }
    const isBoss = plan.enemyTypes.some((t) => t.startsWith('boss'));
    const isElite = !isBoss && plan.enemyTypes.some((t) => t === 'elite');
    this.planState.waveNumber = waveNumber;
    this.planState.currentState = 'active';
    this.planState.enemiesSpawned = 0;
    this.planState.enemiesDefeated = 0;
    this.planState.enemiesRemaining = plan.enemyTypes.length;
    this.planState.elapsedTime = 0;
    this.planState.isBossWave = isBoss;
    this.planState.isEliteWave = isElite;
    this.planState.spawnedTypes = [...plan.enemyTypes];
    return {
      success: true,
      waveNumber,
      enemyCount: plan.enemyTypes.length,
      isBossWave: isBoss,
      isEliteWave: isElite,
      enemyTypes: [...plan.enemyTypes],
    };
  }

  private planWaveState(): WaveState {
    const s = this.planState;
    const total = s.enemiesDefeated + s.enemiesRemaining;
    return {
      waveNumber: s.waveNumber,
      maxWaves: s.maxWaves,
      currentState: s.currentState,
      enemiesSpawned: s.enemiesSpawned,
      enemiesDefeated: s.enemiesDefeated,
      enemiesRemaining: s.enemiesRemaining,
      elapsedTime: s.elapsedTime,
      difficulty: s.difficulty,
      isBossWave: s.isBossWave,
      isEliteWave: s.isEliteWave,
      progress: total === 0 ? 0 : s.enemiesDefeated / total,
    };
  }

  getWaveState(): WaveState {
    if (this.wavePlans) {
      return this.planWaveState();
    }
    if (!this.initialized) {
      console.warn('[WaveManager] Not initialized');
      return {
        waveNumber: 1,
        maxWaves: 10,
        currentState: 'waiting',
        enemiesSpawned: 0,
        enemiesDefeated: 0,
        enemiesRemaining: 0,
        elapsedTime: 0,
        difficulty: 'normal',
        isBossWave: false,
        isEliteWave: false,
        progress: 0,
      };
    }

    try {
      const stubModule = luaEngine.getStubModule('wave_manager_module');
      if (stubModule) {
        const getWaveStateFunc = (stubModule as Record<string, unknown>)['getWaveState'] as (
          ...args: unknown[]
        ) => unknown;
        if (getWaveStateFunc) {
          const result = getWaveStateFunc();
          if (result && typeof result === 'object') {
            return (result as Record<string, unknown>)['state'] as WaveState;
          }
        }
      }
      return (
        luaEngine.call<WaveState>('getWaveState') ?? {
          waveNumber: 1,
          maxWaves: 10,
          currentState: 'waiting',
          enemiesSpawned: 0,
          enemiesDefeated: 0,
          enemiesRemaining: 0,
          elapsedTime: 0,
          difficulty: 'normal',
          isBossWave: false,
          isEliteWave: false,
          progress: 0,
        }
      );
    } catch (error) {
      console.error('[WaveManager] Failed to get wave state:', error);
      return {
        waveNumber: 1,
        maxWaves: 10,
        currentState: 'waiting',
        enemiesSpawned: 0,
        enemiesDefeated: 0,
        enemiesRemaining: 0,
        elapsedTime: 0,
        difficulty: 'normal',
        isBossWave: false,
        isEliteWave: false,
        progress: 0,
      };
    }
  }

  setDifficulty(difficulty: DifficultyLevel): boolean {
    if (this.wavePlans) {
      this.planState.difficulty = difficulty;
      return true;
    }
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('setDifficulty', difficulty) ?? false;
    } catch {
      return false;
    }
  }

  setMaxWaves(maxWaves: number): boolean {
    if (this.wavePlans) {
      this.planState.maxWaves = Math.max(1, Math.floor(maxWaves));
      return true;
    }
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('setMaxWaves', maxWaves) ?? false;
    } catch {
      return false;
    }
  }

  calculateEnemyCount(waveNumber: number): number {
    if (this.wavePlans) {
      return this.getPlanFor(waveNumber)?.enemyTypes.length ?? 0;
    }
    if (!this.initialized) return 5;

    try {
      return luaEngine.call<number>('calculateEnemyCount', waveNumber) ?? 5;
    } catch {
      return 5;
    }
  }

  isBossWave(waveNumber: number): boolean {
    if (this.wavePlans) {
      return this.getPlanFor(waveNumber)?.enemyTypes.some((t) => t.startsWith('boss')) ?? false;
    }
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('isBossWave', waveNumber) ?? false;
    } catch {
      return false;
    }
  }

  isEliteWave(waveNumber: number): boolean {
    if (this.wavePlans) {
      const plan = this.getPlanFor(waveNumber);
      if (!plan) return false;
      const isBoss = plan.enemyTypes.some((t) => t.startsWith('boss'));
      return !isBoss && plan.enemyTypes.some((t) => t === 'elite');
    }
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('isEliteWave', waveNumber) ?? false;
    } catch {
      return false;
    }
  }

  generateEnemyTypes(waveNumber: number): string[] {
    if (this.wavePlans) {
      const plan = this.getPlanFor(waveNumber);
      return plan ? [...plan.enemyTypes] : [];
    }
    if (!this.initialized) return [];

    try {
      return luaEngine.call<string[]>('generateEnemyTypes', waveNumber) ?? [];
    } catch {
      return [];
    }
  }

  getEnemyConfig(enemyType: string): EnemyConfig | null {
    if (!this.initialized) return null;

    try {
      return luaEngine.call<EnemyConfig>('getEnemyConfig', enemyType) ?? null;
    } catch {
      return null;
    }
  }

  startWave(waveNumber: number):
    | {
        success: boolean;
        waveNumber: number;
        enemyCount: number;
        isBossWave: boolean;
        isEliteWave: boolean;
        enemyTypes: string[];
      }
    | { success: boolean; error: string } {
    if (this.wavePlans) {
      return this.planStartWave(waveNumber);
    }
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const stubModule = luaEngine.getStubModule('wave_manager_module');
      if (stubModule) {
        const startWaveFunc = (stubModule as Record<string, unknown>)['startWave'] as (
          ...args: unknown[]
        ) => unknown;
        if (startWaveFunc) {
          const result = startWaveFunc(waveNumber);
          return result as
            | {
                success: boolean;
                waveNumber: number;
                enemyCount: number;
                isBossWave: boolean;
                isEliteWave: boolean;
                enemyTypes: string[];
              }
            | { success: boolean; error: string };
        }
      }
      const result = luaEngine.call<
        | {
            success: boolean;
            waveNumber: number;
            enemyCount: number;
            isBossWave: boolean;
            isEliteWave: boolean;
            enemyTypes: string[];
          }
        | { success: boolean; error: string }
      >('startWave', waveNumber);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  spawnNextEnemy():
    | { success: boolean; enemy: EnemyConfig; spawnIndex: number; totalToSpawn: number }
    | { success: boolean; error: string } {
    if (this.wavePlans) {
      const s = this.planState;
      if (s.currentState !== 'active') {
        return { success: false, error: 'wave is not active' };
      }
      if (s.enemiesSpawned >= s.spawnedTypes.length) {
        return { success: false, error: 'no more enemies to spawn' };
      }
      s.enemiesSpawned++;
      const type = s.spawnedTypes[s.enemiesSpawned - 1];
      // 数值字段不会被消费（EnemySystem.spawnEnemy 只读 type，敌人属性由
      // Enemy.ts 按类型内置），返回 0 防止误用出假数据。
      return {
        success: true,
        enemy: {
          type,
          health: 0,
          damage: 0,
          speed: 0,
          score: 0,
          isBoss: type.startsWith('boss'),
          isElite: type === 'elite',
        },
        spawnIndex: s.enemiesSpawned,
        totalToSpawn: s.spawnedTypes.length,
      };
    }
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const stubModule = luaEngine.getStubModule('wave_manager_module');
      if (stubModule) {
        const spawnNextEnemyFunc = (stubModule as Record<string, unknown>)['spawnNextEnemy'] as (
          ...args: unknown[]
        ) => unknown;
        if (spawnNextEnemyFunc) {
          return spawnNextEnemyFunc() as
            | { success: boolean; enemy: EnemyConfig; spawnIndex: number; totalToSpawn: number }
            | { success: boolean; error: string };
        }
      }
      const result = luaEngine.call<
        | { success: boolean; enemy: EnemyConfig; spawnIndex: number; totalToSpawn: number }
        | { success: boolean; error: string }
      >('spawnNextEnemy');
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onEnemyDefeated(enemyType: string):
    | {
        success: boolean;
        enemiesDefeated: number;
        enemiesRemaining: number;
        isWaveComplete: boolean;
        score: number;
      }
    | { success: boolean; error: string } {
    if (this.wavePlans) {
      const s = this.planState;
      if (s.currentState !== 'active') {
        return { success: false, error: 'wave is not active' };
      }
      s.enemiesDefeated++;
      s.enemiesRemaining--;
      const isWaveComplete = s.enemiesRemaining <= 0;
      if (isWaveComplete) s.currentState = 'completed';
      return {
        success: true,
        enemiesDefeated: s.enemiesDefeated,
        enemiesRemaining: s.enemiesRemaining,
        isWaveComplete,
        score: enemyType.startsWith('boss') ? 2000 : enemyType === 'elite' ? 500 : 100,
      };
    }
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const stubModule = luaEngine.getStubModule('wave_manager_module');
      if (stubModule) {
        const onEnemyDefeatedFunc = (stubModule as Record<string, unknown>)['onEnemyDefeated'] as (
          ...args: unknown[]
        ) => unknown;
        if (onEnemyDefeatedFunc) {
          return onEnemyDefeatedFunc(enemyType) as
            | {
                success: boolean;
                enemiesDefeated: number;
                enemiesRemaining: number;
                isWaveComplete: boolean;
                score: number;
              }
            | { success: boolean; error: string };
        }
      }
      const result = luaEngine.call<
        | {
            success: boolean;
            enemiesDefeated: number;
            enemiesRemaining: number;
            isWaveComplete: boolean;
            score: number;
          }
        | { success: boolean; error: string }
      >('onEnemyDefeated', enemyType);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  pauseWave(): boolean {
    if (this.wavePlans) {
      if (this.planState.currentState !== 'active') return false;
      this.planState.currentState = 'paused';
      return true;
    }
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('pauseWave') ?? false;
    } catch {
      return false;
    }
  }

  resumeWave(): boolean {
    if (this.wavePlans) {
      if (this.planState.currentState !== 'paused') return false;
      this.planState.currentState = 'active';
      return true;
    }
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('resumeWave') ?? false;
    } catch {
      return false;
    }
  }

  update(deltaTime: number): { elapsedTime: number; state: string; enemiesRemaining: number } {
    if (this.wavePlans) {
      if (this.planState.currentState === 'active') {
        this.planState.elapsedTime += deltaTime;
      }
      return {
        elapsedTime: this.planState.elapsedTime,
        state: this.planState.currentState,
        enemiesRemaining: this.planState.enemiesRemaining,
      };
    }
    if (!this.initialized) {
      return { elapsedTime: 0, state: 'waiting', enemiesRemaining: 0 };
    }

    try {
      return (
        luaEngine.call<{ elapsedTime: number; state: string; enemiesRemaining: number }>(
          'updateWave',
          deltaTime,
        ) ?? { elapsedTime: 0, state: 'waiting', enemiesRemaining: 0 }
      );
    } catch {
      return { elapsedTime: 0, state: 'waiting', enemiesRemaining: 0 };
    }
  }

  reset(): boolean {
    if (this.wavePlans) {
      // 保留波次计划（关卡重开时复用），只重置波次状态；maxWaves 同样保留。
      const { maxWaves } = this.planState;
      this.planState = initialPlanState();
      this.planState.maxWaves = maxWaves;
      return true;
    }
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('resetWaveManager') ?? false;
    } catch {
      return false;
    }
  }

  getNextWaveNumber(): number | null {
    if (this.wavePlans) {
      const next = this.planState.waveNumber + 1;
      return next <= this.planState.maxWaves ? next : null;
    }
    if (!this.initialized) return null;

    try {
      return luaEngine.call<number | null>('getNextWaveNumber') ?? null;
    } catch {
      return null;
    }
  }

  getWaveScoreMultiplier(): number {
    if (this.wavePlans) {
      const difficultyBonus: Record<string, number> = {
        easy: 0.5,
        normal: 1.0,
        hard: 1.5,
        nightmare: 2.0,
      };
      return (
        1.0 + this.planState.waveNumber * 0.1 + (difficultyBonus[this.planState.difficulty] ?? 1.0)
      );
    }
    if (!this.initialized) return 1.0;

    try {
      return luaEngine.call<number>('getWaveScoreMultiplier') ?? 1.0;
    } catch {
      return 1.0;
    }
  }

  async reloadScript(): Promise<void> {
    console.log('[WaveManager] Reloading wave script...');
    const newScript = await this.loadWaveScript();
    luaEngine.registerModule({ name: 'wave_manager', script: newScript });
    console.log('[WaveManager] Wave script reloaded');
  }

  destroy(): void {
    this.initialized = false;
    console.log('[WaveManager] Destroyed');
  }
}

export const waveManager = new WaveManager();
