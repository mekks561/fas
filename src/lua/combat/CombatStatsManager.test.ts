import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CombatStatsManager } from './CombatStatsManager';
import { luaEngine } from '../LuaEngine';

describe('CombatStatsManager Lua 模式', () => {
  let csm: CombatStatsManager;

  beforeEach(async () => {
    csm = new CombatStatsManager();
    await csm.initialize();
  });

  it('registerModule 时 host 标记应为 false', async () => {
    const spy = vi.spyOn(luaEngine, 'registerModule');
    const newCsm = new CombatStatsManager();
    await newCsm.initialize();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'combat_stats',
        host: false,
      }),
    );
    spy.mockRestore();
  });

  it('getStats 调用 Lua 引擎', () => {
    const mockStats = {
      kills: 10,
      score: 1000,
      rank: 'C'
    };
    const spy = vi.spyOn(luaEngine, 'call').mockReturnValue({ success: true, stats: mockStats });

    const stats = csm.getStats();
    expect(spy).toHaveBeenCalledWith('getStats');
    expect(stats).toMatchObject(mockStats);
    spy.mockRestore();
  });

  it('onKill 调用 Lua 引擎的 onKill', () => {
    const mockResult = {
      success: true,
      kills: 5,
      comboCurrent: 2
    };
    const spy = vi.spyOn(luaEngine, 'call').mockReturnValue(mockResult);

    const result = csm.onKill('basic', false, false);
    expect(spy).toHaveBeenCalledWith('onKill', 'basic', false, false);
    expect(result).toMatchObject(mockResult);
    spy.mockRestore();
  });

  it('addScore 调用 Lua 引擎的 addScore', () => {
    const mockResult = {
      success: true,
      score: 500,
      rank: 'D'
    };
    const spy = vi.spyOn(luaEngine, 'call').mockReturnValue(mockResult);

    const result = csm.addScore(100);
    expect(spy).toHaveBeenCalledWith('addScore', 100);
    expect(result).toMatchObject(mockResult);
    spy.mockRestore();
  });
});
