import { luaEngine } from '../LuaEngine';
import { getLuaSource } from '../luaSources';

export interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  type: SkillType;
  effects: SkillEffect[];
  cost: SkillCost;
  cooldown: number;
  range: number;
  duration: number;
  level: number;
  maxLevel: number;
  unlockLevel: number;
  prerequisites: string[];
}

export interface SkillEffect {
  type: EffectType;
  value: number;
  scaling: number;
  radius?: number;
  angle?: number;
  count?: number;
  ticks?: number;
  interval?: number;
  stat?: string;
  unit?: string;
}

export interface SkillCost {
  type: ResourceType;
  value: number;
}

export interface SkillInstance extends SkillTemplate {
  state: SkillState;
  currentCooldown: number;
  castTime: number;
  lastCastTime: number;
}

export interface CastResult {
  success: boolean;
  skillId?: string;
  skillName?: string;
  effects?: EffectResult[];
  remainingCooldown?: number;
  costPaid?: number;
  error?: string;
}

export interface EffectResult {
  type: string;
  value: number;
  isCritical: boolean;
  ticks?: number;
  interval?: number;
  tickValue?: number;
  radius?: number;
  angle?: number;
  stat?: string;
  unit?: string;
  duration?: number;
}

export type SkillType = 'active' | 'passive' | 'toggle' | 'ultimate';
export type EffectType =
  | 'damage'
  | 'dot'
  | 'heal'
  | 'hot'
  | 'buff'
  | 'debuff'
  | 'shield'
  | 'stun'
  | 'knockback'
  | 'summon'
  | 'area';
export type ResourceType = 'mana' | 'energy' | 'health' | 'cooldown' | 'charge';
export type SkillState = 'ready' | 'cooldown' | 'active' | 'disabled' | 'locked';

export class SkillSystemManager {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await luaEngine.initialize();

    const skillScript = await this.loadSkillScript();
    luaEngine.registerModule({ name: 'skill_system', script: skillScript, host: false });

    this.initialized = true;
    console.log('[SkillSystemManager] Initialized');
  }

  private async loadSkillScript(): Promise<string> {
    const luaCode = getLuaSource('skills/skill-system');
    if (!luaCode) {
      throw new Error('skill-system.lua 不在 luaSources 注册表中');
    }

    return `
local SkillSystem = require("skills/skill-system")

function SkillSystem.learnSkill(skillId, playerLevel, learnedSkillIds)
  local result = SkillSystem.learnSkill(skillId, playerLevel, learnedSkillIds)
  return result.success
end

function SkillSystem.upgradeSkill(skillId)
  local result = SkillSystem.upgradeSkill(skillId)
  return result.success, result.level
end

function SkillSystem.canCastSkill(skillId, resources)
  local result = SkillSystem.canCastSkill(skillId, resources)
  return result.success, result.error
end

function SkillSystem.castSkill(skillId, caster, target, resources)
  local result = SkillSystem.castSkill(skillId, caster, target, resources)
  return result
end

function SkillSystem.updateCooldowns(deltaTime)
  return SkillSystem.updateCooldowns(deltaTime)
end

function SkillSystem.getSkillStatus(skillId)
  return SkillSystem.getSkillStatus(skillId)
end

function SkillSystem.getAllSkillStatus()
  return SkillSystem.getAllSkillStatus()
end

function SkillSystem.resetCooldown(skillId)
  return SkillSystem.resetCooldown(skillId)
end

function SkillSystem.startCombo()
  return SkillSystem.startCombo()
end

function SkillSystem.addToCombo(skillId)
  local result = SkillSystem.addToCombo(skillId)
  return result.success, result.name
end

function SkillSystem.checkComboBonus()
  return SkillSystem.checkComboBonus()
end

function SkillSystem.createSkill(skillId)
  return SkillSystem.createSkill(skillId)
end
`;
  }

  learnSkill(skillId: string, playerLevel: number, learnedSkillIds: string[]): boolean {
    if (!this.initialized) {
      console.warn('[SkillSystemManager] Not initialized');
      return false;
    }

    try {
      const result = luaEngine.call<boolean>(
        'SkillSystem.learnSkill',
        skillId,
        playerLevel,
        learnedSkillIds,
      );
      return result ?? false;
    } catch (error) {
      console.error('[SkillSystemManager] Failed to learn skill:', error);
      return false;
    }
  }

  upgradeSkill(skillId: string): { success: boolean; newLevel: number } {
    if (!this.initialized) return { success: false, newLevel: 0 };

    try {
      const result = luaEngine.call<[boolean, number]>('SkillSystem.upgradeSkill', skillId);
      if (!result) return { success: false, newLevel: 0 };
      return { success: result[0], newLevel: result[1] };
    } catch (error) {
      console.error('[SkillSystemManager] Failed to upgrade skill:', error);
      return { success: false, newLevel: 0 };
    }
  }

  canCastSkill(
    skillId: string,
    resources: Record<string, number>,
  ): { canCast: boolean; reason: string } {
    if (!this.initialized) return { canCast: false, reason: 'not_initialized' };

    try {
      const result = luaEngine.call<[boolean, string]>(
        'SkillSystem.canCastSkill',
        skillId,
        resources,
      );
      if (!result) return { canCast: false, reason: 'lua_call_failed' };
      return { canCast: result[0], reason: result[1] };
    } catch (error) {
      console.error('[SkillSystemManager] Failed to check skill:', error);
      return { canCast: false, reason: 'error' };
    }
  }

  castSkill(
    skillId: string,
    caster: { x: number; y: number; stats: Record<string, number> },
    target: { x: number; y: number } | null,
    resources: Record<string, number>,
  ): CastResult {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      const result = luaEngine.call<CastResult>(
        'SkillSystem.castSkill',
        skillId,
        caster,
        target,
        resources,
      );
      if (!result) return { success: false, error: 'lua_call_failed' };
      return result;
    } catch (error) {
      console.error('[SkillSystemManager] Failed to cast skill:', error);
      return { success: false, error: 'cast_error' };
    }
  }

  updateCooldowns(deltaTime: number): string[] {
    if (!this.initialized) return [];

    try {
      const result = luaEngine.call<string[]>('SkillSystem.updateCooldowns', deltaTime);
      return result ?? [];
    } catch (error) {
      console.error('[SkillSystemManager] Failed to update cooldowns:', error);
      return [];
    }
  }

  getSkillStatus(skillId: string): SkillInstance | null {
    if (!this.initialized) return null;

    try {
      const result = luaEngine.call<SkillInstance>('SkillSystem.getSkillStatus', skillId);
      return result ?? null;
    } catch (error) {
      console.error('[SkillSystemManager] Failed to get skill status:', error);
      return null;
    }
  }

  getAllSkillStatus(): SkillInstance[] {
    if (!this.initialized) return [];

    try {
      const result = luaEngine.call<SkillInstance[]>('SkillSystem.getAllSkillStatus');
      return result ?? [];
    } catch (error) {
      console.error('[SkillSystemManager] Failed to get all skill status:', error);
      return [];
    }
  }

  resetCooldown(skillId: string): boolean {
    if (!this.initialized) return false;

    try {
      const result = luaEngine.call<boolean>('SkillSystem.resetCooldown', skillId);
      return result ?? false;
    } catch (error) {
      console.error('[SkillSystemManager] Failed to reset cooldown:', error);
      return false;
    }
  }

  startCombo(): boolean {
    if (!this.initialized) return false;

    try {
      const result = luaEngine.call<boolean>('SkillSystem.startCombo');
      return result ?? false;
    } catch {
      return false;
    }
  }

  addToCombo(skillId: string): { success: boolean; comboName: string } {
    if (!this.initialized) return { success: false, comboName: '' };

    try {
      const result = luaEngine.call<[boolean, string]>('SkillSystem.addToCombo', skillId);
      if (!result) return { success: false, comboName: '' };
      return { success: result[0], comboName: result[1] };
    } catch {
      return { success: false, comboName: '' };
    }
  }

  checkComboBonus(): { type: string; multiplier: number } | null {
    if (!this.initialized) return null;

    try {
      const result = luaEngine.call<{ type: string; multiplier: number } | null>(
        'SkillSystem.checkComboBonus',
      );
      return result ?? null;
    } catch {
      return null;
    }
  }

  async reloadScript(): Promise<void> {
    console.log('[SkillSystemManager] Reloading skill script...');
    try {
      const newScript = await this.loadSkillScript();
      luaEngine.registerModule({ name: 'skill_system', script: newScript, host: false });
      console.log('[SkillSystemManager] Skill script reloaded');
    } catch (error) {
      console.warn(
        '[SkillSystemManager] Failed to reload script (likely test environment):',
        error,
      );
    }
  }

  destroy(): void {
    this.initialized = false;
    console.log('[SkillSystemManager] Destroyed');
  }
}

export const skillSystemManager = new SkillSystemManager();
