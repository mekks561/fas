import { luaEngine } from '../LuaEngine';

/**
 * 技能系统类型定义
 */
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

/**
 * 技能系统管理器
 *
 * 使用 Lua 脚本管理技能系统，支持热更新和复杂的技能逻辑
 *
 * @example
 * ```typescript
 * const skillManager = new SkillSystemManager();
 * await skillManager.initialize();
 *
 * // 学习技能
 * skillManager.learnSkill('BASIC_ATTACK', 5, ['basic_attack']);
 *
 * // 施放技能
 * const result = skillManager.castSkill('BASIC_ATTACK', caster, target, resources);
 *
 * // 更新冷却
 * skillManager.updateCooldowns(deltaTime);
 * ```
 */
export class SkillSystemManager {
  private initialized = false;

  /**
   * 初始化技能系统
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await luaEngine.initialize();

    // 注册技能系统脚本
    const skillScript = await this.loadSkillScript();
    luaEngine.registerModule({
      name: 'skill_system',
      script: skillScript,
    });

    this.initialized = true;
    console.log('[SkillSystemManager] Initialized');
  }

  /**
   * 加载技能系统脚本
   */
  private async loadSkillScript(): Promise<string> {
    // 返回核心脚本（简化版用于 TypeScript 集成）
    return `
-- 技能系统核心
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
  -- 由 TypeScript 端提供技能定义
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
  
  return {
    success = true,
    skillId = skillId,
    effects = {},
    remainingCooldown = skill.cooldown or 0,
    costPaid = 0
  }
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

  /**
   * 学习技能
   */
  learnSkill(skillId: string, playerLevel: number, learnedSkillIds: string[]): boolean {
    if (!this.initialized) {
      console.warn('[SkillSystemManager] Not initialized');
      return false;
    }

    try {
      return luaEngine.call<boolean>(
        'SkillSystem.learnSkill',
        skillId,
        playerLevel,
        learnedSkillIds,
      );
    } catch (error) {
      console.error('[SkillSystemManager] Failed to learn skill:', error);
      return false;
    }
  }

  /**
   * 升级技能
   */
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

  /**
   * 检查技能是否可用
   */
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
      return { canCast: result[0], reason: result[1] };
    } catch (error) {
      console.error('[SkillSystemManager] Failed to check skill:', error);
      return { canCast: false, reason: 'error' };
    }
  }

  /**
   * 施放技能
   */
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
      return luaEngine.call<CastResult>(
        'SkillSystem.castSkill',
        skillId,
        caster,
        target,
        resources,
      );
    } catch (error) {
      console.error('[SkillSystemManager] Failed to cast skill:', error);
      return { success: false, error: 'cast_error' };
    }
  }

  /**
   * 更新冷却时间
   */
  updateCooldowns(deltaTime: number): string[] {
    if (!this.initialized) return [];

    try {
      return luaEngine.call<string[]>('SkillSystem.updateCooldowns', deltaTime);
    } catch (error) {
      console.error('[SkillSystemManager] Failed to update cooldowns:', error);
      return [];
    }
  }

  /**
   * 获取技能状态
   */
  getSkillStatus(skillId: string): SkillInstance | null {
    if (!this.initialized) return null;

    try {
      return luaEngine.call<SkillInstance>('SkillSystem.getSkillStatus', skillId);
    } catch (error) {
      console.error('[SkillSystemManager] Failed to get skill status:', error);
      return null;
    }
  }

  /**
   * 获取所有技能状态
   */
  getAllSkillStatus(): SkillInstance[] {
    if (!this.initialized) return [];

    try {
      return luaEngine.call<SkillInstance[]>('SkillSystem.getAllSkillStatus');
    } catch (error) {
      console.error('[SkillSystemManager] Failed to get all skill status:', error);
      return [];
    }
  }

  /**
   * 重置技能冷却
   */
  resetCooldown(skillId: string): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('SkillSystem.resetCooldown', skillId);
    } catch (error) {
      console.error('[SkillSystemManager] Failed to reset cooldown:', error);
      return false;
    }
  }

  /**
   * 开始连招
   */
  startCombo(): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('SkillSystem.startCombo');
    } catch {
      return false;
    }
  }

  /**
   * 添加技能到连招
   */
  addToCombo(skillId: string): { success: boolean; comboName: string } {
    if (!this.initialized) return { success: false, comboName: '' };

    try {
      const result = luaEngine.call<[boolean, string]>('SkillSystem.addToCombo', skillId);
      return { success: result[0], comboName: result[1] };
    } catch {
      return { success: false, comboName: '' };
    }
  }

  /**
   * 检查连招奖励
   */
  checkComboBonus(): { type: string; multiplier: number } | null {
    if (!this.initialized) return null;

    try {
      return luaEngine.call<{ type: string; multiplier: number } | null>(
        'SkillSystem.checkComboBonus',
      );
    } catch {
      return null;
    }
  }

  /**
   * 重新加载技能脚本（热更新）
   */
  async reloadScript(): Promise<void> {
    console.log('[SkillSystemManager] Reloading skill script...');
    const newScript = await this.loadSkillScript();
    luaEngine.registerModule({
      name: 'skill_system',
      script: newScript,
    });
    console.log('[SkillSystemManager] Skill script reloaded');
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.initialized = false;
    console.log('[SkillSystemManager] Destroyed');
  }
}

// 导出单例
export const skillSystemManager = new SkillSystemManager();
