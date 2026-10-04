/**
 * Lua 引擎类型定义
 */
export interface LuaEngineOptions {
  /** 是否开启调试模式 */
  debug?: boolean;
  /** 最大栈大小 */
  stackSize?: number;
  /** 是否强制使用 stub 模式(不加载真实 Lua 运行时) */
  forceStub?: boolean;
}

export interface LuaFunction {
  (...args: unknown[]): unknown;
}

export interface LuaTable {
  [key: string]: unknown;
}

/**
 * Lua 脚本模块
 */
export interface LuaScriptModule {
  /** 模块名称 */
  name: string;
  /** Lua 脚本内容 */
  script: string;
  /** 脚本代码别名(兼容字段,等同于 script) */
  code?: string;
  /** 模块路径 */
  path?: string;
  /** 加载优先级 */
  priority?: number;
}

/**
 * AI 配置接口
 */
export interface AIConfig {
  type: string;
  speed: number;
  detectRange: number;
  damage: number;
  health: number;
  behavior?: string;
}

/**
 * 游戏配置接口
 */
export interface GameConfig {
  difficulty: number;
  waveInterval: number;
  enemySpawnRate: number;
  playerSpeed: number;
  playerHealth: number;
}

export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'nightmare';
