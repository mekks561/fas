import { luaEngine } from '../LuaEngine';

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
export type EffectType = 'damage' | 'dot' | 'heal' | 'hot' | 'buff' | 'debuff' | 'shield' | 'stun' | 'knockback' | 'summon' | 'area';
export type ResourceType = 'mana' | 'energy' | 'health' | 'cooldown' | 'charge';
export type SkillState = 'ready' | 'cooldown' | 'active' | 'disabled' | 'locked';

export class SkillSystemManager {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await luaEngine.initialize();

    const skillScript = await this.loadSkillScript();
    luaEngine.registerModule({ name: 'skill_system', script: skillScript });

    this.initialized = true;
    console.log('[SkillSystemManager] Initialized');
  }

  private async loadSkillScript(): Promise<string> {
    try {
      const response = await fetch('/src/lua/skills/skill-system.lua');
      if (!response.ok) {
        throw new Error(`Failed to load skill-system.lua: ${response.status}`);
      }
      const luaCode = await response.text();

      return `
${luaCode}

local SkillSystem = require("skill_system_module")

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
    } catch (error) {
      console.warn('[SkillSystemManager] Failed to load external lua file, using fallback:', error);
      return `
SkillSystem = {
  VERSION = "1.0.0",
  SkillType = { ACTIVE = "active", PASSIVE = "passive", TOGGLE = "toggle", ULTIMATE = "ultimate" },
  EffectType = { DAMAGE = "damage", DOT = "dot", HEAL = "heal", HOT = "hot", BUFF = "buff", DEBUFF = "debuff", SHIELD = "shield", STUN = "stun", KNOCKBACK = "knockback", SUMMON = "summon", AREA = "area" },
  ResourceType = { MANA = "mana", ENERGY = "energy", HEALTH = "health", COOLDOWN = "cooldown", CHARGE = "charge" },
  SkillState = { READY = "ready", COOLDOWN = "cooldown", ACTIVE = "active", DISABLED = "disabled", LOCKED = "locked" },
  LearnedSkills = {},
  ActiveCombo = { currentSequence = {}, startTime = 0, lastSkillTime = 0 }
}

function SkillSystem.createSkill(skillId)
  if type(skillId) ~= "string" then return nil end
  return { id = skillId, state = SkillSystem.SkillState.LOCKED, currentCooldown = 0, level = 1 }
end

function SkillSystem.learnSkill(skillId, playerLevel, learnedSkillIds)
  SkillSystem.LearnedSkills[skillId] = SkillSystem.createSkill(skillId)
  if SkillSystem.LearnedSkills[skillId] then
    SkillSystem.LearnedSkills[skillId].state = SkillSystem.SkillState.READY
    return true
  end
  return false
end

function SkillSystem.upgradeSkill(skillId)
  local skill = SkillSystem.LearnedSkills[skillId]
  if skill and skill.level < skill.maxLevel then
    skill.level = skill.level + 1
    return true, skill.level
  end
  return false, 0
end

function SkillSystem.canCastSkill(skillId, resources)
  local skill = SkillSystem.LearnedSkills[skillId]
  if not skill then return false, "skill_not_learned" end
  if skill.state ~= SkillSystem.SkillState.READY then return false, "skill_not_ready" end
  return true, "ready"
end

function SkillSystem.castSkill(skillId, caster, target, resources)
  local canCast, reason = SkillSystem.canCastSkill(skillId, resources)
  if not canCast then return { success = false, error = reason } end
  local skill = SkillSystem.LearnedSkills[skillId]
  skill.state = SkillSystem.SkillState.COOLDOWN
  return { success = true, skillId = skillId, effects = {}, remainingCooldown = skill.cooldown or 0, costPaid = 0 }
end

function SkillSystem.updateCooldowns(deltaTime)
  local readySkills = {}
  for skillId, skill in pairs(SkillSystem.LearnedSkills) do
    if skill.state == SkillSystem.SkillState.COOLDOWN then
      skill.currentCooldown = math.max(0, skill.currentCooldown - deltaTime)
      if skill.currentCooldown <= 0 then
        skill.state = SkillSystem.SkillState.READY
        readySkills[#readySkills + 1] = skillId
      end
    end
  end
  return readySkills
end

function SkillSystem.getSkillStatus(skillId)
  local skill = SkillSystem.LearnedSkills[skillId]
  if not skill then return nil end
  return skill
end

function SkillSystem.getAllSkillStatus()
  local statuses = {}
  for skillId, skill in pairs(SkillSystem.LearnedSkills) do
    statuses[#statuses + 1] = skill
  end
  return statuses
end

function SkillSystem.resetCooldown(skillId)
  local skill = SkillSystem.LearnedSkills[skillId]
  if skill then
    skill.currentCooldown = 0
    skill.state = SkillSystem.SkillState.READY
    return true
  end
  return false
end

function SkillSystem.startCombo()
  SkillSystem.ActiveCombo = { currentSequence = {}, startTime = os.time(), lastSkillTime = 0 }
  return true
end

function SkillSystem.addToCombo(skillId)
  SkillSystem.ActiveCombo.currentSequence[#SkillSystem.ActiveCombo.currentSequence + 1] = skillId
  return true, "combo_in_progress"
end

function SkillSystem.checkComboBonus()
  return nil
end
      `;
    }
  }

  learnSkill(skillId: string, playerLevel: number, learnedSkillIds: string[]): boolean {
    if (!this.initialized) {
      console.warn('[SkillSystemManager] Not initialized');
      return false;
    }

    try {
      return luaEngine.call<boolean>('SkillSystem.learnSkill', skillId, playerLevel, learnedSkillIds);
    } catch (error) {
      console.error('[SkillSystemManager] Failed to learn skill:', error);
      return false;
    }
  }

  upgradeSkill(skillId: string): { success: boolean; newLevel: number } {
    if (!this.initialized) return { success: false, newLevel: 0 };

    try {
      const result = luaEngine.call<[boolean, number]>('SkillSystem.upgradeSkill', skillId);
      return { success: result[0], newLevel: result[1] };
    } catch (error) {
      console.error('[SkillSystemManager] Failed to upgrade skill:', error);
      return { success: false, newLevel: 0 };
    }
  }

  canCastSkill(skillId: string, resources: Record<string, number>): { canCast: boolean; reason: string } {
    if (!this.initialized) return { canCast: false, reason: 'not_initialized' };

    try {
      const result = luaEngine.call<[boolean, string]>('SkillSystem.canCastSkill', skillId, resources);
      return { canCast: result[0], reason: result[1] };
    } catch (error) {
      console.error('[SkillSystemManager] Failed to check skill:', error);
      return { canCast: false, reason: 'error' };
    }
  }

  castSkill(skillId: string, caster: { x: number; y: number; stats: Record<string, number> }, target: { x: number; y: number } | null, resources: Record<string, number>): CastResult {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    try {
      return luaEngine.call<CastResult>('SkillSystem.castSkill', skillId, caster, target, resources);
    } catch (error) {
      console.error('[SkillSystemManager] Failed to cast skill:', error);
      return { success: false, error: 'cast_error' };
    }
  }

  updateCooldowns(deltaTime: number): string[] {
    if (!this.initialized) return [];

    try {
      return luaEngine.call<string[]>('SkillSystem.updateCooldowns', deltaTime);
    } catch (error) {
      console.error('[SkillSystemManager] Failed to update cooldowns:', error);
      return [];
    }
  }

  getSkillStatus(skillId: string): SkillInstance | null {
    if (!this.initialized) return null;

    try {
      return luaEngine.call<SkillInstance>('SkillSystem.getSkillStatus', skillId);
    } catch (error) {
      console.error('[SkillSystemManager] Failed to get skill status:', error);
      return null;
    }
  }

  getAllSkillStatus(): SkillInstance[] {
    if (!this.initialized) return [];

    try {
      return luaEngine.call<SkillInstance[]>('SkillSystem.getAllSkillStatus');
    } catch (error) {
      console.error('[SkillSystemManager] Failed to get all skill status:', error);
      return [];
    }
  }

  resetCooldown(skillId: string): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('SkillSystem.resetCooldown', skillId);
    } catch (error) {
      console.error('[SkillSystemManager] Failed to reset cooldown:', error);
      return false;
    }
  }

  startCombo(): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('SkillSystem.startCombo');
    } catch {
      return false;
    }
  }

  addToCombo(skillId: string): { success: boolean; comboName: string } {
    if (!this.initialized) return { success: false, comboName: '' };

    try {
      const result = luaEngine.call<[boolean, string]>('SkillSystem.addToCombo', skillId);
      return { success: result[0], comboName: result[1] };
    } catch {
      return { success: false, comboName: '' };
    }
  }

  checkComboBonus(): { type: string; multiplier: number } | null {
    if (!this.initialized) return null;

    try {
      return luaEngine.call<{ type: string; multiplier: number } | null>('SkillSystem.checkComboBonus');
    } catch {
      return null;
    }
  }

  async reloadScript(): Promise<void> {
    console.log('[SkillSystemManager] Reloading skill script...');
    try {
      const newScript = await this.loadSkillScript();
      luaEngine.registerModule({ name: 'skill_system', script: newScript });
      console.log('[SkillSystemManager] Skill script reloaded');
    } catch (error) {
      console.warn('[SkillSystemManager] Failed to reload script (likely test environment):', error);
    }
  }

  destroy(): void {
    this.initialized = false;
    console.log('[SkillSystemManager] Destroyed');
  }
}

export const skillSystemManager = new SkillSystemManager();