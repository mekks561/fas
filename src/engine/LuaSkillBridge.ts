/**
 * Lua 技能系统集成器
 *
 * 将 Lua 技能系统与游戏引擎集成的桥接模块
 *
 * 使用方式：
 * ```typescript
 * import { LuaSkillBridge } from './engine/LuaSkillBridge';
 *
 * // 在游戏初始化时
 * const luaBridge = new LuaSkillBridge(game);
 * await luaBridge.initialize();
 *
 * // 游戏循环中更新
 * luaBridge.update(deltaTime);
 *
 * // 施放技能
 * luaBridge.castSkill('BASIC_ATTACK', player, target);
 * ```
 */

import { skillSystemManager } from '../lua';
import type { CastResult } from '../lua';

export class LuaSkillBridge {
  private initialized = false;

  constructor() {}

  /**
   * 初始化 Lua 技能系统
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[LuaSkillBridge] Initializing...');

    // 初始化 Lua 技能管理器
    await skillSystemManager.initialize();

    this.initialized = true;
    console.log('[LuaSkillBridge] Initialized successfully');
  }

  /**
   * 更新 Lua 技能系统
   */
  update(deltaTime: number): void {
    if (!this.initialized) return;

    // 更新冷却时间
    skillSystemManager.updateCooldowns(deltaTime);
  }

  /**
   * 学习技能
   */
  learnSkill(skillId: string, playerLevel: number, learnedSkills: string[]): boolean {
    if (!this.initialized) {
      console.warn('[LuaSkillBridge] Not initialized');
      return false;
    }

    return skillSystemManager.learnSkill(skillId, playerLevel, learnedSkills);
  }

  /**
   * 施放技能
   */
  castSkill(
    skillId: string,
    player: { x: number; y: number; stats: Record<string, number> },
    target: { x: number; y: number } | null,
    resources: Record<string, number>,
  ): CastResult {
    if (!this.initialized) {
      return { success: false, error: 'not_initialized' };
    }

    return skillSystemManager.castSkill(skillId, player, target, resources);
  }

  /**
   * 检查技能是否可用
   */
  canCastSkill(
    skillId: string,
    resources: Record<string, number>,
  ): { canCast: boolean; reason: string } {
    if (!this.initialized) {
      return { canCast: false, reason: 'not_initialized' };
    }

    return skillSystemManager.canCastSkill(skillId, resources);
  }

  /**
   * 获取技能状态
   */
  getSkillStatus(skillId: string) {
    if (!this.initialized) return null;
    return skillSystemManager.getSkillStatus(skillId);
  }

  /**
   * 获取所有技能状态
   */
  getAllSkills() {
    if (!this.initialized) return [];
    return skillSystemManager.getAllSkillStatus();
  }

  /**
   * 开始连招
   */
  startCombo(): boolean {
    if (!this.initialized) return false;
    return skillSystemManager.startCombo();
  }

  /**
   * 添加技能到连招
   */
  addToCombo(skillId: string): { success: boolean; comboName: string } {
    if (!this.initialized) return { success: false, comboName: '' };
    return skillSystemManager.addToCombo(skillId);
  }

  /**
   * 检查连招奖励
   */
  checkComboBonus(): { type: string; multiplier: number } | null {
    if (!this.initialized) return null;
    return skillSystemManager.checkComboBonus();
  }

  /**
   * 重置冷却（特殊情况使用）
   */
  resetCooldown(skillId: string): boolean {
    if (!this.initialized) return false;
    return skillSystemManager.resetCooldown(skillId);
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.initialized) {
      skillSystemManager.destroy();
      this.initialized = false;
    }
  }
}

// 导出单例
export const luaSkillBridge = LuaSkillBridge;
