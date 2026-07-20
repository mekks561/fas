import { luaEngine } from '../LuaEngine';

const powerupScriptModules = import.meta.glob('./powerup-system.lua', { as: 'raw', eager: true });
const powerupSystemScript = powerupScriptModules['./powerup-system.lua'] || '';

export interface PowerupConfig {
  name: string;
  displayName: string;
  description: string;
  type: string;
  value?: number;
  multiplier?: number;
  duration: number;
  stackRule: string;
  maxStacks: number;
}

export interface ActivePowerup {
  id: number;
  type: string;
  displayName: string;
  duration: number;
  remainingDuration: number;
  stacks: number;
  multiplier: number;
  progress: number;
}

export interface PowerupEffect {
  type: string;
  effectType: string;
  stat: string;
  value?: number;
  multiplier?: number;
  duration?: number;
  powerupId?: number;
}

export type PowerupType = 'health' | 'shield' | 'speed' | 'damage' | 'triple_shot' | 'invincible' | 'magnet' | 'slow_time';

export class PowerupSystemManager {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await luaEngine.initialize();

    const powerupScript = await this.loadPowerupScript();
    luaEngine.registerModule({ name: 'powerup_system', script: powerupScript });

    this.initialized = true;
    console.log('[PowerupSystemManager] Initialized');
  }

  private async loadPowerupScript(): Promise<string> {
    if (powerupSystemScript) {
      return `
${powerupSystemScript}

local PowerupSystem = require("powerup_system_module")

function getPowerupTypes()
  return PowerupSystem.getPowerupTypes().types
end

function getPowerupConfig(powerupType)
  local result = PowerupSystem.getPowerupConfig(powerupType)
  if result.success then
    return result.config
  end
  return nil
end

function applyPowerup(powerupType)
  local result = PowerupSystem.applyPowerup(powerupType, {})
  if result.success then
    return {
      success = true,
      powerupType = result.powerupType,
      config = result.config,
      effects = result.effects,
      powerupId = result.powerupId
    }
  end
  return { success = false, error = result.error }
end

function getActivePowerups()
  local result = PowerupSystem.getActivePowerups()
  if result.success then
    return result.powerups
  end
  return {}
end

function updatePowerups(deltaTime)
  local result = PowerupSystem.update(deltaTime)
  if result.success then
    return {
      expired = result.expired,
      activeCount = result.activeCount
    }
  end
  return { expired = {}, activeCount = 0 }
end

function removePowerup(powerupId)
  local result = PowerupSystem.removePowerup(powerupId)
  return result.success
end

function removeAllPowerups()
  local result = PowerupSystem.removeAllPowerups()
  return result.success
end

function hasActivePowerup(powerupType)
  local result = PowerupSystem.hasActivePowerup(powerupType)
  if result.success then
    return result.has
  end
  return false
end

function getPowerupMultiplier(powerupType)
  local result = PowerupSystem.getPowerupMultiplier(powerupType)
  if result.success then
    return { multiplier = result.multiplier, stacks = result.stacks }
  end
  return { multiplier = 1.0, stacks = 0 }
end

function getPowerupRemainingDuration(powerupType)
  local result = PowerupSystem.getPowerupRemainingDuration(powerupType)
  if result.success then
    return {
      remainingDuration = result.remainingDuration,
      totalDuration = result.totalDuration,
      progress = result.progress
    }
  end
  return { remainingDuration = 0, totalDuration = 0, progress = 0 }
end

function generateRandomPowerup()
  local result = PowerupSystem.generateRandomPowerup()
  if result.success then
    return { powerupType = result.powerupType, config = result.config }
  end
  return { powerupType = "health", config = nil }
end

function resetPowerupSystem()
  local result = PowerupSystem.reset()
  return result.success
end
      `;
    }

    console.warn('[PowerupSystemManager] Failed to load lua file, using fallback');
    return `
PowerupSystem = {
  activePowerups = {},
  powerupConfigs = {
    health = { name = "health", displayName = "Health", type = "instant", value = 25, duration = 0 },
    shield = { name = "shield", displayName = "Shield", type = "duration", value = 50, duration = 10.0 },
    speed = { name = "speed", displayName = "Speed", type = "duration", multiplier = 2.0, duration = 8.0 },
    damage = { name = "damage", displayName = "Damage", type = "duration", multiplier = 2.0, duration = 8.0 }
  }
}

function getPowerupTypes()
  local types = {}
  for key, config in pairs(PowerupSystem.powerupConfigs) do
    types[#types + 1] = config
  end
  return types
end

function getPowerupConfig(powerupType)
  return PowerupSystem.powerupConfigs[powerupType]
end

function applyPowerup(powerupType)
  return { success = true, powerupType = powerupType, effects = {} }
end

function getActivePowerups()
  return PowerupSystem.activePowerups
end

function updatePowerups(deltaTime)
  return { expired = {}, activeCount = #PowerupSystem.activePowerups }
end

function removePowerup(powerupId)
  return true
end

function removeAllPowerups()
  PowerupSystem.activePowerups = {}
  return true
end

function hasActivePowerup(powerupType)
  return false
end

function getPowerupMultiplier(powerupType)
  return { multiplier = 1.0, stacks = 0 }
end

function getPowerupRemainingDuration(powerupType)
  return { remainingDuration = 0, totalDuration = 0, progress = 0 }
end

function generateRandomPowerup()
  return { powerupType = "health" }
end

function resetPowerupSystem()
  PowerupSystem.activePowerups = {}
  return true
end
      `;
  }

  getPowerupTypes(): PowerupConfig[] {
    if (!this.initialized) return [];

    try {
      return luaEngine.call<PowerupConfig[]>('getPowerupTypes');
    } catch {
      return [];
    }
  }

  getPowerupConfig(powerupType: PowerupType): PowerupConfig | null {
    if (!this.initialized) return null;

    try {
      return luaEngine.call<PowerupConfig>('getPowerupConfig', powerupType);
    } catch {
      return null;
    }
  }

  applyPowerup(powerupType: PowerupType): { success: boolean; powerupType: string; config?: PowerupConfig; effects?: PowerupEffect[]; powerupId?: number } | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const stubModule = luaEngine.getStubModule('powerup_system_module');
      if (stubModule) {
        const applyPowerupFunc = (stubModule as Record<string, unknown>)['applyPowerup'] as (...args: unknown[]) => unknown;
        if (applyPowerupFunc) {
          return applyPowerupFunc(powerupType, {}) as { success: boolean; powerupType: string; config?: PowerupConfig; effects?: PowerupEffect[]; powerupId?: number } | { success: boolean; error: string };
        }
      }
      return luaEngine.call<{ success: boolean; powerupType: string; config?: PowerupConfig; effects?: PowerupEffect[]; powerupId?: number } | { success: boolean; error: string }>('applyPowerup', powerupType);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  getActivePowerups(): ActivePowerup[] {
    if (!this.initialized) return [];

    try {
      const stubModule = luaEngine.getStubModule('powerup_system_module');
      if (stubModule) {
        const getActivePowerupsFunc = (stubModule as Record<string, unknown>)['getActivePowerups'] as (...args: unknown[]) => unknown;
        if (getActivePowerupsFunc) {
          const result = getActivePowerupsFunc();
          if (result && typeof result === 'object') {
            const resultObj = result as Record<string, unknown>;
            return (resultObj.powerups as ActivePowerup[]) || (resultObj as unknown as ActivePowerup[]) || [];
          }
        }
      }
      return luaEngine.call<ActivePowerup[]>('getActivePowerups') || [];
    } catch {
      return [];
    }
  }

  update(deltaTime: number): { expired: { id: number; type: string; expired: boolean }[]; activeCount: number } {
    if (!this.initialized) {
      return { expired: [], activeCount: 0 };
    }

    try {
      return luaEngine.call<{ expired: { id: number; type: string; expired: boolean }[]; activeCount: number }>('updatePowerups', deltaTime);
    } catch {
      return { expired: [], activeCount: 0 };
    }
  }

  removePowerup(powerupId: number): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('removePowerup', powerupId);
    } catch {
      return false;
    }
  }

  removeAllPowerups(): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('removeAllPowerups');
    } catch {
      return false;
    }
  }

  hasActivePowerup(powerupType: PowerupType): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('hasActivePowerup', powerupType);
    } catch {
      return false;
    }
  }

  getPowerupMultiplier(powerupType: PowerupType): { multiplier: number; stacks: number } {
    if (!this.initialized) {
      return { multiplier: 1.0, stacks: 0 };
    }

    try {
      return luaEngine.call<{ multiplier: number; stacks: number }>('getPowerupMultiplier', powerupType);
    } catch {
      return { multiplier: 1.0, stacks: 0 };
    }
  }

  getPowerupRemainingDuration(powerupType: PowerupType): { remainingDuration: number; totalDuration: number; progress: number } {
    if (!this.initialized) {
      return { remainingDuration: 0, totalDuration: 0, progress: 0 };
    }

    try {
      return luaEngine.call<{ remainingDuration: number; totalDuration: number; progress: number }>('getPowerupRemainingDuration', powerupType);
    } catch {
      return { remainingDuration: 0, totalDuration: 0, progress: 0 };
    }
  }

  generateRandomPowerup(): { powerupType: string; config?: PowerupConfig } {
    if (!this.initialized) {
      return { powerupType: 'health' };
    }

    try {
      return luaEngine.call<{ powerupType: string; config?: PowerupConfig }>('generateRandomPowerup');
    } catch {
      return { powerupType: 'health' };
    }
  }

  reset(): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('resetPowerupSystem');
    } catch {
      return false;
    }
  }

  async reloadScript(): Promise<void> {
    console.log('[PowerupSystemManager] Reloading powerup script...');
    const newScript = await this.loadPowerupScript();
    luaEngine.registerModule({ name: 'powerup_system', script: newScript });
    console.log('[PowerupSystemManager] Powerup script reloaded');
  }

  destroy(): void {
    this.initialized = false;
    console.log('[PowerupSystemManager] Destroyed');
  }
}

export const powerupSystemManager = new PowerupSystemManager();