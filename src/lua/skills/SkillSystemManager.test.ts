import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillSystemManager } from './SkillSystemManager';
import { luaEngine } from '../LuaEngine';

describe('SkillSystemManager Lua 模式', () => {
  let ssm: SkillSystemManager;

  beforeEach(async () => {
    ssm = new SkillSystemManager();
    await ssm.initialize();
  });

  it('registerModule 时 host 标记应为 false', async () => {
    const spy = vi.spyOn(luaEngine, 'registerModule');
    const newSsm = new SkillSystemManager();
    await newSsm.initialize();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'skill_system',
        host: false,
      }),
    );
    spy.mockRestore();
  });

  it('learnSkill 调用 Lua 引擎', () => {
    const spy = vi.spyOn(luaEngine, 'call').mockReturnValue(true);

    const result = ssm.learnSkill('missile_strike', 1, []);
    expect(spy).toHaveBeenCalledWith('SkillSystem.learnSkill', 'missile_strike', 1, []);
    expect(result).toBe(true);
    spy.mockRestore();
  });

  it('castSkill 调用 Lua 引擎的 castSkill', () => {
    const mockResult = {
      success: true,
      skillId: 'missile_strike',
      remainingCooldown: 15.0
    };
    const spy = vi.spyOn(luaEngine, 'call').mockReturnValue(mockResult);

    const result = ssm.castSkill('missile_strike', { x: 0, y: 0, stats: {} }, null, {});
    expect(spy).toHaveBeenCalledWith('SkillSystem.castSkill', 'missile_strike', expect.any(Object), null, {});
    expect(result).toMatchObject(mockResult);
    spy.mockRestore();
  });

  it('updateCooldowns 调用 Lua 引擎', () => {
    const mockReady = ['missile_strike'];
    const spy = vi.spyOn(luaEngine, 'call').mockReturnValue(mockReady);

    const result = ssm.updateCooldowns(1.0);
    expect(spy).toHaveBeenCalledWith('SkillSystem.updateCooldowns', 1.0);
    expect(result).toEqual(mockReady);
    spy.mockRestore();
  });
});
