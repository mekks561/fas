import { LuaState, factory } from 'wasmoon';
import type { LuaEngineOptions, LuaScriptModule } from './types';

/**
 * LuaEngine - Lua 脚本引擎封装
 *
 * 提供安全的 Lua 脚本执行环境，支持模块化脚本管理和热更新
 *
 * @example
 * ```typescript
 * const engine = new LuaEngine();
 * await engine.initialize();
 *
 * // 注册脚本模块
 * engine.registerModule({
 *   name: 'math_utils',
 *   script: `
 *     function add(a, b)
 *       return a + b
 *     end
 *   `
 * });
 *
 * // 调用 Lua 函数
 * const result = engine.call('add', 1, 2); // 3
 * ```
 */
export class LuaEngine {
  private lua: LuaState | null = null;
  private initialized = false;
  private debug = false;
  private registeredModules: Map<string, string> = new Map();

  constructor(options: LuaEngineOptions = {}) {
    this.debug = options.debug ?? false;
  }

  /**
   * 初始化 Lua 引擎
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[LuaEngine] Already initialized');
      return;
    }

    try {
      this.lua = await factory.create();
      this.setupDefaultLibs();
      this.setupErrorHandler();
      this.initialized = true;
      console.log('[LuaEngine] Initialized successfully');
    } catch (error) {
      console.error('[LuaEngine] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * 设置默认库
   */
  private setupDefaultLibs(): void {
    if (!this.lua) return;

    // 加载基础库
    this.lua.doString(`
      -- 数学库扩展
      math.clamp = function(val, min, max)
        if val < min then return min end
        if val > max then return max end
        return val
      end

      -- 插值函数
      math.lerp = function(a, b, t)
        return a + (b - a) * t
      end

      -- 距离计算
      math.distance = function(x1, y1, x2, y2)
        local dx = x2 - x1
        local dy = y2 - y1
        return math.sqrt(dx * dx + dy * dy)
      end

      -- 角度转弧度
      math.radians = function(degrees)
        return degrees * 0.017453292519943295
      end

      -- 弧度转角度
      math.degrees = function(radians)
        return radians * 57.29577951308232
      end
    `);
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandler(): void {
    if (!this.lua) return;

    this.lua.onError = (error: Error) => {
      console.error('[LuaEngine] Runtime Error:', error.message);
      if (this.debug) {
        console.error('[LuaEngine] Stack:', error.stack);
      }
    };
  }

  /**
   * 执行 Lua 代码
   */
  doString(script: string): boolean {
    if (!this.lua) {
      console.error('[LuaEngine] Not initialized');
      return false;
    }

    try {
      this.lua.doString(script);
      return true;
    } catch (error) {
      console.error('[LuaEngine] Script execution failed:', error);
      return false;
    }
  }

  /**
   * 注册脚本模块
   */
  registerModule(module: LuaScriptModule): void {
    const { name, script } = module;

    if (this.registeredModules.has(name)) {
      console.warn(`[LuaEngine] Module "${name}" already registered, replacing...`);
    }

    this.registeredModules.set(name, script);

    if (this.initialized) {
      const success = this.doString(script);
      if (success && this.debug) {
        console.log(`[LuaEngine] Module "${name}" registered successfully`);
      }
    }
  }

  /**
   * 调用 Lua 函数
   */
  call<T = unknown>(funcName: string, ...args: unknown[]): T {
    if (!this.lua) {
      throw new Error('[LuaEngine] Not initialized');
    }

    try {
      const func = this.lua.global.get(funcName);
      if (typeof func !== 'function') {
        throw new Error(`[LuaEngine] "${funcName}" is not a function`);
      }

      const result = func(...args);
      return result as T;
    } catch (error) {
      console.error(`[LuaEngine] Failed to call "${funcName}":`, error);
      throw error;
    }
  }

  /**
   * 设置全局变量
   */
  setGlobal(name: string, value: unknown): void {
    if (!this.lua) {
      throw new Error('[LuaEngine] Not initialized');
    }

    this.lua.global.set(name, value);
  }

  /**
   * 获取全局变量
   */
  getGlobal<T = unknown>(name: string): T {
    if (!this.lua) {
      throw new Error('[LuaEngine] Not initialized');
    }

    return this.lua.global.get(name) as T;
  }

  /**
   * 重新加载所有模块
   */
  reloadAllModules(): void {
    if (!this.initialized) {
      console.warn('[LuaEngine] Cannot reload, not initialized');
      return;
    }

    console.log('[LuaEngine] Reloading all modules...');
    for (const [name, script] of this.registeredModules) {
      this.doString(script);
      console.log(`[LuaEngine] Module "${name}" reloaded`);
    }
  }

  /**
   * 销毁引擎
   */
  destroy(): void {
    if (this.lua) {
      this.lua.close();
      this.lua = null;
    }
    this.initialized = false;
    this.registeredModules.clear();
    console.log('[LuaEngine] Destroyed');
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// 导出单例
export const luaEngine = new LuaEngine({ debug: true });
