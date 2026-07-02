/**
 * 游戏核心模块导出
 */

export { GameState, GameStateMachine } from './GameStateMachine';
export {
  CombatSystem,
  DamageType,
  StatusEffect,
  StatusEffectType,
  DamageResult,
  CombatEntity,
} from './CombatSystem';
export {
  AchievementSystem,
  Achievement,
  AchievementCategory,
  AchievementReward,
  AchievementProgress,
} from './AchievementSystem';
export { GameEventBus, gameEventBus, GameEvent, GameEventData, useGameEvent } from './GameEventBus';
