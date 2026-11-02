import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PowerupSystemManager } from './PowerupSystemManager';
import { luaEngine } from '../LuaEngine';

describe('PowerupSystemManager Lua 模式', () => {
  let psm: PowerupSystemManager;

  beforeEach(async () => {
    psm = new PowerupSystemManager();
    await psm.initialize();
  });

  it('registerModule 时 host 标记应为 false', async () => {
    const spy = vi.spyOn(luaEngine, 'registerModule');
    const newPsm = new PowerupSystemManager();
    await newPsm.initialize();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'powerup_system',
        host: false,
      }),
    );
    spy.mockRestore();
  });

  it('getPowerupTypes 调用 Lua 引擎', () => {
    const mockTypes = [
      { name: 'health', displayName: 'Health', type: 'instant', duration: 0 },
      { name: 'speed', displayName: 'Speed', type: 'duration', duration: 8.0 }
    ];
    const spy = vi.spyOn(luaEngine, 'call').mockReturnValue(mockTypes);

    const types = psm.getPowerupTypes();
    expect(spy).toHaveBeenCalledWith('getPowerupTypes');
    expect(types).toEqual(mockTypes);
    spy.mockRestore();
  });

  it('applyPowerup 调用 Lua 引擎的 applyPowerup', () => {
    const mockResult = {
      success: true,
      powerupType: 'health',
      powerupId: 123
    };
    const spy = vi.spyOn(luaEngine, 'call').mockReturnValue(mockResult);

    const result = psm.applyPowerup('health');
    expect(spy).toHaveBeenCalledWith('applyPowerup', 'health');
    expect(result).toMatchObject(mockResult);
    spy.mockRestore();
  });

  it('update 调用 Lua 引擎的 updatePowerups', () => {
    const mockUpdateResult = {
      expired: [{ id: 1, type: 'speed', expired: true }],
      activeCount: 2
    };
    const spy = vi.spyOn(luaEngine, 'call').mockReturnValue(mockUpdateResult);

    const result = psm.update(1.0);
    expect(spy).toHaveBeenCalledWith('updatePowerups', 1.0);
    expect(result).toEqual(mockUpdateResult);
    spy.mockRestore();
  });
});
