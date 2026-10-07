/**
 * Lua 引擎类型定义
 */
/**
 * Lua 运行时模式。
 * - `lua`：真实 Lua（wasmoon / Lua 5.4），`doString` 真的执行脚本
 * - `stub`：宿主 JS 复刻实现（无真实 Lua，`doString` 为空操作，仅作兜底）
 */
export type LuaRuntimeMode = 'lua' | 'stub';

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
  /**
   * 实现由宿主 JS 提供（迁移期遗留模块）。
   *
   * 置 true 时：真实 Lua 模式下**不执行** script，改用引擎注入的宿主实现全局
   * （与 stub 模式走同一份 JS 实现，行为逐字节等价）。
   * 这些模块的 `.lua` 源码是「目标实现」，逐个迁移完成后去掉此标记即可切到真实 Lua。
   */
  host?: boolean;
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
