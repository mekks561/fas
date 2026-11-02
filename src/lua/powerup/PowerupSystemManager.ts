import { luaEngine } from '../LuaEngine';
import { getLuaSource } from '../luaSources';

// 取源码统一走 luaSources（构建期内联）——理由见 luaSources.ts 头注释。
const powerupSystemScript = getLuaSource('powerup/powerup-system') ?? '';

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

export type PowerupType =
  'health' | 'shield' | 'speed' | 'damage' | 'triple_shot' | 'invincible' | 'magnet' | 'slow_time';

export class PowerupSystemManager {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await luaEngine.initialize();

    const powerupScript = await this.loadPowerupScript();
    luaEngine.registerModule({ name: 'powerup_system', script: powerupScript, host: false });

    this.initialized = true;
    console.log('[PowerupSystemManager] Initialized');
  }

  private async loadPowerupScript(): Promise<string> {
    return `
local PowerupSystem = require("powerup/powerup-system")

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

  getPowerupTypes(): PowerupConfig[] {
    if (!this.initialized) return [];

    try {
      const result = luaEngine.call<PowerupConfig[]>('getPowerupTypes');
      return result ?? [];
    } catch {
      return [];
    }
  }

  getPowerupConfig(powerupType: PowerupType): PowerupConfig | null {
    if (!this.initialized) return null;

    try {
      const result = luaEngine.call<PowerupConfig>('getPowerupConfig', powerupType);
      return result ?? null;
    } catch {
      return null;
    }
  }

  applyPowerup(powerupType: PowerupType):
    | {
        success: boolean;
        powerupType: string;
        config?: PowerupConfig;
        effects?: PowerupEffect[];
        powerupId?: number;
      }
    | { success: boolean; error: string } {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<
        | {
            success: boolean;
            powerupType: string;
            config?: PowerupConfig;
            effects?: PowerupEffect[];
            powerupId?: number;
          }
        | { success: boolean; error: string }
      >('applyPowerup', powerupType);
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown_error' };
    }
  }

  getActivePowerups(): ActivePowerup[] {
    if (!this.initialized) return [];

    try {
      return luaEngine.call<ActivePowerup[]>('getActivePowerups') || [];
    } catch {
      return [];
    }
  }

  update(deltaTime: number): {
    expired: { id: number; type: string; expired: boolean }[];
    activeCount: number;
  } {
    if (!this.initialized) {
      return { expired: [], activeCount: 0 };
    }

    try {
      const result = luaEngine.call<{
        expired: { id: number; type: string; expired: boolean }[];
        activeCount: number;
      }>('updatePowerups', deltaTime);
      if (!result) return { expired: [], activeCount: 0 };
      return result;
    } catch {
      return { expired: [], activeCount: 0 };
    }
  }

  removePowerup(powerupId: number): boolean {
    if (!this.initialized) return false;

    try {
      const result = luaEngine.call<boolean>('removePowerup', powerupId);
      return result ?? false;
    } catch {
      return false;
    }
  }

  removeAllPowerups(): boolean {
    if (!this.initialized) return false;

    try {
      const result = luaEngine.call<boolean>('removeAllPowerups');
      return result ?? false;
    } catch {
      return false;
    }
  }

  hasActivePowerup(powerupType: PowerupType): boolean {
    if (!this.initialized) return false;

    try {
      const result = luaEngine.call<boolean>('hasActivePowerup', powerupType);
      return result ?? false;
    } catch {
      return false;
    }
  }

  getPowerupMultiplier(powerupType: PowerupType): { multiplier: number; stacks: number } {
    if (!this.initialized) {
      return { multiplier: 1.0, stacks: 0 };
    }

    try {
      const result = luaEngine.call<{ multiplier: number; stacks: number }>(
        'getPowerupMultiplier',
        powerupType,
      );
      if (!result) return { multiplier: 1.0, stacks: 0 };
      return result;
    } catch {
      return { multiplier: 1.0, stacks: 0 };
    }
  }

  getPowerupRemainingDuration(powerupType: PowerupType): {
    remainingDuration: number;
    totalDuration: number;
    progress: number;
  } {
    if (!this.initialized) {
      return { remainingDuration: 0, totalDuration: 0, progress: 0 };
    }

    try {
      const result = luaEngine.call<{
        remainingDuration: number;
        totalDuration: number;
        progress: number;
      }>('getPowerupRemainingDuration', powerupType);
      if (!result) return { remainingDuration: 0, totalDuration: 0, progress: 0 };
      return result;
    } catch {
      return { remainingDuration: 0, totalDuration: 0, progress: 0 };
    }
  }

  generateRandomPowerup(): { powerupType: string; config?: PowerupConfig } {
    if (!this.initialized) {
      return { powerupType: 'health' };
    }

    try {
      const result = luaEngine.call<{ powerupType: string; config?: PowerupConfig }>(
        'generateRandomPowerup',
      );
      if (!result) return { powerupType: 'health' };
      return result;
    } catch {
      return { powerupType: 'health' };
    }
  }

  reset(): boolean {
    if (!this.initialized) return false;

    try {
      const result = luaEngine.call<boolean>('resetPowerupSystem');
      return result ?? false;
    } catch {
      return false;
    }
  }

  async reloadScript(): Promise<void> {
    console.log('[PowerupSystemManager] Reloading powerup script...');
    const newScript = await this.loadPowerupScript();
    luaEngine.registerModule({ name: 'powerup_system', script: newScript, host: false });
    console.log('[PowerupSystemManager] Powerup script reloaded');
  }

  destroy(): void {
    this.initialized = false;
    console.log('[PowerupSystemManager] Destroyed');
  }
}

export const powerupSystemManager = new PowerupSystemManager();
