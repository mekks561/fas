/**
 * 游戏核心模块导出
 */

export type { GameState } from './GameStateMachine';
export { GameStateMachine } from './GameStateMachine';
export type {
  DamageType,
  StatusEffect,
  StatusEffectType,
  DamageResult,
  CombatEntity,
} from './CombatSystem';
export { CombatSystem } from './CombatSystem';
export type {
  Achievement,
  AchievementCategory,
  AchievementReward,
  AchievementProgress,
} from './AchievementSystem';
export { AchievementSystem } from './AchievementSystem';
export type { GameEvent, GameEventData } from './GameEventBus';
export { GameEventBus, gameEventBus, createGameEventSubscription } from './GameEventBus';
