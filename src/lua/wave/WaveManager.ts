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

export class WaveManager {
  private initialized = false;

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

  getWaveState(): WaveState {
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
        progress: 0
      };
    }

    try {
      const stubModule = luaEngine.getStubModule('wave_manager_module');
      if (stubModule) {
        const getWaveStateFunc = (stubModule as Record<string, unknown>)['getWaveState'] as (...args: unknown[]) => unknown;
        if (getWaveStateFunc) {
          const result = getWaveStateFunc();
          if (result && typeof result === 'object') {
            return (result as Record<string, unknown>).state as WaveState;
          }
        }
      }
      return luaEngine.call<WaveState>('getWaveState');
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
        progress: 0
      };
    }
  }

  setDifficulty(difficulty: DifficultyLevel): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('setDifficulty', difficulty);
    } catch {
      return false;
    }
  }

  setMaxWaves(maxWaves: number): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('setMaxWaves', maxWaves);
    } catch {
      return false;
    }
  }

  calculateEnemyCount(waveNumber: number): number {
    if (!this.initialized) return 5;

    try {
      return luaEngine.call<number>('calculateEnemyCount', waveNumber);
    } catch {
      return 5;
    }
  }

  isBossWave(waveNumber: number): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('isBossWave', waveNumber);
    } catch {
      return false;
    }
  }

  isEliteWave(waveNumber: number): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('isEliteWave', waveNumber);
    } catch {
      return false;
    }
  }

  generateEnemyTypes(waveNumber: number): string[] {
    if (!this.initialized) return [];

    try {
      return luaEngine.call<string[]>('generateEnemyTypes', waveNumber);
    } catch {
      return [];
    }
  }

  getEnemyConfig(enemyType: string): EnemyConfig | null {
    if (!this.initialized) return null;

    try {
      return luaEngine.call<EnemyConfig>('getEnemyConfig', enemyType);
    } catch {
      return null;
    }
  }

  startWave(waveNumber: number): { success: boolean; waveNumber: number; enemyCount: number; isBossWave: boolean; isEliteWave: boolean; enemyTypes: string[] } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const stubModule = luaEngine.getStubModule('wave_manager_module');
      if (stubModule) {
        const startWaveFunc = (stubModule as Record<string, unknown>)['startWave'] as (...args: unknown[]) => unknown;
        if (startWaveFunc) {
          const result = startWaveFunc(waveNumber);
          return result as { success: boolean; waveNumber: number; enemyCount: number; isBossWave: boolean; isEliteWave: boolean; enemyTypes: string[] } | { success: boolean; error: string };
        }
      }
      return luaEngine.call<{ success: boolean; waveNumber: number; enemyCount: number; isBossWave: boolean; isEliteWave: boolean; enemyTypes: string[] } | { success: boolean; error: string }>('startWave', waveNumber);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  spawnNextEnemy(): { success: boolean; enemy: EnemyConfig; spawnIndex: number; totalToSpawn: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<{ success: boolean; enemy: EnemyConfig; spawnIndex: number; totalToSpawn: number } | { success: boolean; error: string }>('spawnNextEnemy');
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  onEnemyDefeated(enemyType: string): { success: boolean; enemiesDefeated: number; enemiesRemaining: number; isWaveComplete: boolean; score: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const stubModule = luaEngine.getStubModule('wave_manager_module');
      if (stubModule) {
        const onEnemyDefeatedFunc = (stubModule as Record<string, unknown>)['onEnemyDefeated'] as (...args: unknown[]) => unknown;
        if (onEnemyDefeatedFunc) {
          return onEnemyDefeatedFunc(enemyType) as { success: boolean; enemiesDefeated: number; enemiesRemaining: number; isWaveComplete: boolean; score: number } | { success: boolean; error: string };
        }
      }
      return luaEngine.call<{ success: boolean; enemiesDefeated: number; enemiesRemaining: number; isWaveComplete: boolean; score: number } | { success: boolean; error: string }>('onEnemyDefeated', enemyType);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  pauseWave(): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('pauseWave');
    } catch {
      return false;
    }
  }

  resumeWave(): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('resumeWave');
    } catch {
      return false;
    }
  }

  update(deltaTime: number): { elapsedTime: number; state: string; enemiesRemaining: number } {
    if (!this.initialized) {
      return { elapsedTime: 0, state: 'waiting', enemiesRemaining: 0 };
    }

    try {
      return luaEngine.call<{ elapsedTime: number; state: string; enemiesRemaining: number }>('updateWave', deltaTime);
    } catch {
      return { elapsedTime: 0, state: 'waiting', enemiesRemaining: 0 };
    }
  }

  reset(): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('resetWaveManager');
    } catch {
      return false;
    }
  }

  getNextWaveNumber(): number | null {
    if (!this.initialized) return null;

    try {
      return luaEngine.call<number | null>('getNextWaveNumber');
    } catch {
      return null;
    }
  }

  getWaveScoreMultiplier(): number {
    if (!this.initialized) return 1.0;

    try {
      return luaEngine.call<number>('getWaveScoreMultiplier');
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