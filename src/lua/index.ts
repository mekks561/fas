/**
 * Lua 集成模块导出
 *
 * @example
 * ```typescript
 * import { luaEngine, EnemyAIManager, GameConfigManager } from './lua';
 *
 * // 初始化
 * await EnemyAIManager.initialize();
 * await GameConfigManager.initialize();
 *
 * // 使用 AI
 * const enemy = EnemyAIManager.createEnemy('AGGRESSIVE');
 *
 * // 使用配置
 * const config = GameConfigManager.getDifficultyConfig('hard');
 * ```
 */

// 核心引擎
export { LuaEngine, luaEngine } from './LuaEngine';
export type {
  LuaEngineOptions,
  LuaFunction,
  LuaTable,
  LuaScriptModule,
  AIConfig,
  GameConfig,
  DifficultyLevel,
} from './types';

// AI 管理
export { EnemyAIManager, enemyAIManager } from './ai/EnemyAIManager';
export type { AIType } from './ai/EnemyAIManager';

// 配置管理
export { GameConfigManager, gameConfigManager } from './config/GameConfigManager';
export type {
  DifficultyConfig,
  WeaponConfig,
  GamePowerupConfig,
  WeaponType,
} from './config/GameConfigManager';

// 技能系统
export { SkillSystemManager, skillSystemManager } from './skills/SkillSystemManager';
export type {
  SkillTemplate,
  SkillEffect,
  SkillCost,
  SkillInstance,
  CastResult,
  EffectResult,
  SkillType,
  EffectType,
  ResourceType,
  SkillState,
} from './skills/SkillSystemManager';
export { runSkillSystemTests } from './skills/SkillSystem.test';

// 波次管理
export { WaveManager, waveManager } from './wave/WaveManager';
export type { EnemyConfig, WaveState } from './wave/WaveManager';

// 道具增益系统
export { PowerupSystemManager, powerupSystemManager } from './powerup/PowerupSystemManager';
export type { PowerupConfig, ActivePowerup, PowerupEffect, PowerupType } from './powerup/PowerupSystemManager';

// 战斗统计系统
export { CombatStatsManager, combatStatsManager } from './combat/CombatStatsManager';
export type { CombatStatsData, ComboInfo, ScoreBreakdown } from './combat/CombatStatsManager';
