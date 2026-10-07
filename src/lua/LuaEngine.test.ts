/**
 * LuaEngine 运行时接线测试
 *
 * 背景（2026-10-07）：改造前 `LuaEngine` 找的是 wasmoon 1.12 以前才有的 `wasmoon.factory`
 * 单例，而依赖装的是 1.16（只导出 `LuaFactory`）→ 初始化**恒定落到 stub**，
 * `doString` 是空函数，`src/lua/**\/*.lua` 从未被执行过。
 *
 * 本测试锁定改造后的不变量（两种运行模式下都必须成立）：
 *  1. initialize() 永不抛错 —— Node 下 wasm 的 environ 断言会 Aborted，必须被吞掉并回落
 *  2. .lua 源码注册表非空且能按名取到（真实 Lua 模式下这是 require 的数据源）
 *  3. `host: true` 的模块脚本在任何模式下都**不执行**（迁移期行为等价的前提）
 *  4. 宿主模块在两种模式下都可取（getStubModule）—— 这是既有四个管理器的取数路径
 *  5. 运行时模式可观测，且 lua 模式必须报告真实版本号
 */

import { describe, it, expect } from 'vitest';
import { LuaEngine } from './LuaEngine';
import {
  getLuaSource,
  getLuaSourceMap,
  getLuaSourceRegistryErrors,
  listLuaModuleNames,
} from './luaSources';

describe('luaSources 源码注册表', () => {
  it('能按全路径名与不冲突短名取到 enemy-ai.lua', () => {
    const full = getLuaSource('ai/enemy-ai');
    const short = getLuaSource('enemy-ai');
    expect(full).toBeTruthy();
    expect(full).toContain('EnemyAI.updateAI');
    expect(short).toBe(full);
  });

  it('注册表覆盖 src/lua 下的模块，且不含 tests/*.lua', () => {
    const names = listLuaModuleNames();
    expect(names.length).toBeGreaterThanOrEqual(5);
    expect(names).toContain('ai/enemy-ai');
    expect(names).toContain('wave/wave-manager');
    expect(names.some((n) => n.includes('tests/'))).toBe(false);
  });

  it('getLuaSourceMap 与源码一致（供注入 Lua 装载器）', () => {
    const map = getLuaSourceMap();
    expect(Object.keys(map).length).toBe(listLuaModuleNames().length);
    expect(map['ai/enemy-ai']).toBe(getLuaSource('ai/enemy-ai'));
  });

  it('未知模块返回 null（装载器据此报错，而不是静默给空表）', () => {
    expect(getLuaSource('not-a-real-module')).toBeNull();
  });

  it('注册表里全是真实源码，没有「资源路径冒充源码」的条目', () => {
    // 回归护栏：import.meta.glob 若退化成 `as: 'raw'`（Vite 8 下已失效），
    // 取到的会是 '/assets/enemy-ai-xxxx.lua' 这种单行路径 —— dev 下能跑、生产下必炸。
    expect(getLuaSourceRegistryErrors()).toEqual([]);
    for (const [name, source] of Object.entries(getLuaSourceMap())) {
      // 源码必含换行；资源路径是单行 —— 这就是两条路的分野
      expect(source, `模块 ${name} 疑为资源路径而非源码`).toContain('\n');
    }
  });
});

describe('LuaEngine 运行时', () => {
  it('initialize 不抛错，且运行时模式可观测', async () => {
    const engine = new LuaEngine();
    await expect(engine.initialize()).resolves.toBeUndefined();

    expect(engine.isInitialized()).toBe(true);

    const info = engine.getRuntimeInfo();
    expect(['lua', 'stub']).toContain(info.mode);
    expect(info.availableLuaModules).toBeGreaterThan(0);
    expect(engine.getRuntimeMode()).toBe(info.mode);
    expect(engine.isRealRuntime()).toBe(info.mode === 'lua');

    // 真实 Lua 模式必须报出真实版本号（Lua 5.x），否则就是"假接线"
    if (info.mode === 'lua') {
      expect(info.version.startsWith('Lua ')).toBe(true);
      const runtimeInfo = engine.call<{ version?: string }>('__luaRuntimeInfo');
      expect(runtimeInfo?.version).toBe(info.version);
    }

    engine.destroy();
  });

  it('forceStub 时确定为宿主实现，且 initialize 不抛错', async () => {
    const engine = new LuaEngine({ forceStub: true });
    await engine.initialize();
    expect(engine.getRuntimeMode()).toBe('stub');
    expect(engine.isRealRuntime()).toBe(false);
    engine.destroy();
  });

  it('宿主模块在两种模式下都取得到（既有四个管理器的取数路径）', async () => {
    for (const forceStub of [true, false]) {
      const engine = new LuaEngine({ forceStub });
      await engine.initialize();

      const waveModule = engine.getStubModule('wave_manager_module') as
        Record<string, unknown> | undefined;
      expect(waveModule, `forceStub=${forceStub}`).toBeTruthy();
      expect(typeof waveModule?.['getWaveState']).toBe('function');

      // 调用面：宿主全局可直接 call（stub 走宿主；真实 Lua 走注入的宿主全局）
      expect(engine.call<boolean>('setDifficulty', 'hard')).toBe(true);

      engine.destroy();
    }
  });

  it('host: true 的模块脚本在任何模式下都不执行（迁移期行为等价的前提）', async () => {
    const engine = new LuaEngine();
    await engine.initialize();

    // 脚本本身是错的 Lua：只要它被执行，真实 Lua 模式下必然抛错
    expect(() =>
      engine.registerModule({
        name: 'legacy_host_module',
        script: 'error("should not run")',
        host: true,
      }),
    ).not.toThrow();

    engine.destroy();
  });

  it('destroy 之后可重新 initialize（不残留状态）', async () => {
    const engine = new LuaEngine();
    await engine.initialize();
    engine.destroy();
    expect(engine.isInitialized()).toBe(false);
    await expect(engine.initialize()).resolves.toBeUndefined();
    expect(engine.isInitialized()).toBe(true);
    engine.destroy();
  });
});
