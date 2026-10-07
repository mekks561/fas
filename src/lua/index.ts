/**
 * Lua 集成模块导出
 *
 * @example
 * ```typescript
 * import { luaEngine, enemyAIManager, EnemyAIManager } from './lua';
 *
 * // 初始化（会尝试启动真实 Lua 运行时；失败则回落宿主 JS 实现）
 * await luaEngine.initialize();
 * await enemyAIManager.initialize();
 *
 * // 运行时诊断：mode === 'lua' 才是真的在跑 Lua 脚本
 * luaEngine.getRuntimeInfo();
 *
 * // 敌机 AI：句柄常驻 Lua 侧
 * const handle = enemyAIManager.spawn('AGGRESSIVE', x, z, health, maxHealth);
 * enemyAIManager.step(handle, playerX, playerZ, dt);
 * ```
 */

// 核心引擎
export { LuaEngine, luaEngine } from './LuaEngine';
export type {
  LuaEngineOptions,
  LuaFunction,
  LuaTable,
  LuaScriptModule,
  LuaRuntimeMode,
  AIConfig,
  GameConfig,
  DifficultyLevel,
} from './types';

// 真实 Lua 模块源码注册表
export {
  getLuaSource,
  getLuaSourceMap,
  getLuaSourceRegistryErrors,
  listLuaModuleNames,
} from './luaSources';

// AI 管理
export { EnemyAIManager, enemyAIManager } from './ai/EnemyAIManager';
export type { AIType, LuaAIStepResult, LuaAIStats } from './ai/EnemyAIManager';

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

// 波次管理
export { WaveManager, waveManager } from './wave/WaveManager';
export type { EnemyConfig, WaveState } from './wave/WaveManager';

// 道具增益系统
export { PowerupSystemManager, powerupSystemManager } from './powerup/PowerupSystemManager';
export type {
  PowerupConfig,
  ActivePowerup,
  PowerupEffect,
  PowerupType,
} from './powerup/PowerupSystemManager';

// 战斗统计系统
export { CombatStatsManager, combatStatsManager } from './combat/CombatStatsManager';
export type { CombatStatsData, ComboInfo, ScoreBreakdown } from './combat/CombatStatsManager';
