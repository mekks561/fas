/**
 * 母舰子系统模型的纯逻辑测试（v2.8 Phase 2）。
 * 不启动 PlayCanvas：只验证命中路由、护盾吸收、损毁阈值与行为修正。
 */
import { describe, it, expect } from 'vitest';
import {
  CapitalSubsystemModel,
  CAPITAL_SUBSYSTEMS,
  MELTDOWN_SECONDS,
  SHIELD_ABSORB_RATIO,
  type CapitalSubsystemId,
} from './CapitalSubsystems';

/** 取某子系统命中球心（模型内部 offset 与本表一致） */
function centerOf(id: CapitalSubsystemId) {
  const def = CAPITAL_SUBSYSTEMS.find((d) => d.id === id);
  if (!def) throw new Error(`missing subsystem ${id}`);
  return { ...def.offset };
}

describe('CapitalSubsystemModel 初始状态', () => {
  it('5 个子系统全部满血且未瘫痪', () => {
    const model = new CapitalSubsystemModel();
    const states = model.getStates();

    expect(states).toHaveLength(5);
    expect(states.every((s) => !s.isDestroyed && s.health === s.maxHealth)).toBe(true);
    expect(model.getDestroyedCount()).toBe(0);
    expect(model.isParalyzed()).toBe(false);
  });

  it('默认修正值为满状态', () => {
    const mods = new CapitalSubsystemModel().getModifiers();
    expect(mods).toMatchObject({
      speedMultiplier: 1,
      canFire: true,
      canDeployDrones: true,
      trackingAccuracy: 1,
      shieldAbsorb: SHIELD_ABSORB_RATIO,
      isParalyzed: false,
      meltdownRemaining: null,
    });
  });
});

describe('CapitalSubsystemModel 命中路由', () => {
  it('命中点在所有命中球之外时返回 null（只扣结构血量）', () => {
    const model = new CapitalSubsystemModel();
    const result = model.damageFromHit({ x: 0, y: 0, z: 40 }, 100);
    expect(result).toBeNull();
    expect(model.getDestroyedCount()).toBe(0);
  });

  it('命中引擎球心只打引擎', () => {
    const model = new CapitalSubsystemModel();
    const result = model.damageFromHit(centerOf('engine'), 100);

    // 护盾先吸收 60%（60 点），剩余 40 点才进引擎
    expect(result?.id).toBe('engine');
    expect(model.getState('engine')?.health).toBe(960);
    expect(model.getState('weapons')?.health).toBe(1400);
  });

  it('打非护盾子系统时护盾先吸收 60%', () => {
    const model = new CapitalSubsystemModel();
    const result = model.damageFromHit(centerOf('weapons'), 100);

    expect(result?.shieldAbsorbed).toBeCloseTo(100 * SHIELD_ABSORB_RATIO, 6);
    expect(result?.amount).toBeCloseTo(40, 6);
    expect(model.getState('shield')?.health).toBe(800 - 60);
    expect(model.getState('weapons')?.health).toBe(1400 - 40);
  });

  it('直接打护盾发生器不触发吸收', () => {
    const model = new CapitalSubsystemModel();
    const result = model.damageFromHit(centerOf('shield'), 100);

    expect(result?.id).toBe('shield');
    expect(result?.shieldAbsorbed).toBe(0);
    expect(model.getState('shield')?.health).toBe(700);
  });

  it('没有命中点时按注入的 rng 确定性挑选目标', () => {
    const model = new CapitalSubsystemModel(CAPITAL_SUBSYSTEMS, () => 0);
    const result = model.damageFromHit(null, 50);
    expect(result?.id).toBe('reactor'); // 第一个子系统
  });
});

describe('CapitalSubsystemModel 损毁与行为修正', () => {
  it('引擎损毁后机动降至 30%', () => {
    const model = new CapitalSubsystemModel();
    model.damageSubsystem('engine', 9999);
    expect(model.getModifiers().speedMultiplier).toBeCloseTo(0.3, 6);
  });

  it('武器阵列损毁后停止开火', () => {
    const model = new CapitalSubsystemModel();
    model.damageSubsystem('weapons', 9999);
    expect(model.getModifiers().canFire).toBe(false);
  });

  it('舰桥损毁后停止放出无人机且瞄准精度下降', () => {
    const model = new CapitalSubsystemModel();
    model.damageSubsystem('bridge', 9999);
    const mods = model.getModifiers();
    expect(mods.canDeployDrones).toBe(false);
    expect(mods.trackingAccuracy).toBeCloseTo(0.35, 6);
  });

  it('护盾损毁后不再吸收伤害', () => {
    const model = new CapitalSubsystemModel();
    model.damageSubsystem('shield', 9999);
    const result = model.damageFromHit(centerOf('weapons'), 100);

    expect(model.getModifiers().shieldAbsorb).toBe(0);
    expect(result?.shieldAbsorbed).toBe(0);
    expect(result?.amount).toBe(100);
  });

  it('护盾被打穿的那一次会标记 shieldDestroyed', () => {
    const model = new CapitalSubsystemModel();
    // 护盾 800 血，60% 吸收：打 1400 → 吸收 800（打穿），剩余 600 进武器
    const result = model.damageFromHit(centerOf('weapons'), 1400);

    expect(result?.shieldDestroyed).toBe(true);
    expect(model.getState('shield')?.isDestroyed).toBe(true);
    expect(result?.amount).toBeCloseTo(600, 6);
  });

  it('摧毁状态只在状态翻转那一次为 true', () => {
    const model = new CapitalSubsystemModel();
    const first = model.damageSubsystem('bridge', 9999);
    const second = model.damageSubsystem('bridge', 9999);

    expect(first?.destroyed).toBe(true);
    expect(second).toBeNull();
  });

  it('毁满 3 个子系统即瘫痪，停止开火且无法机动', () => {
    const model = new CapitalSubsystemModel();
    model.damageSubsystem('weapons', 9999);
    model.damageSubsystem('engine', 9999);
    expect(model.isParalyzed()).toBe(false);

    model.damageSubsystem('bridge', 9999);
    const mods = model.getModifiers();

    expect(model.getDestroyedCount()).toBe(3);
    expect(mods.isParalyzed).toBe(true);
    expect(mods.canFire).toBe(false);
    expect(mods.canDeployDrones).toBe(false);
    expect(mods.speedMultiplier).toBe(0);
    expect(mods.trackingAccuracy).toBe(0);
  });
});

describe('CapitalSubsystemModel 自毁倒计时', () => {
  it('反应堆被毁触发 5 秒倒计时并逐帧递减', () => {
    const model = new CapitalSubsystemModel();
    expect(model.getModifiers().meltdownRemaining).toBeNull();

    model.damageSubsystem('reactor', 9999);
    expect(model.getModifiers().meltdownRemaining).toBeCloseTo(MELTDOWN_SECONDS, 6);

    expect(model.update(2).meltdownRemaining).toBeCloseTo(3, 6);
    expect(model.update(10).meltdownRemaining).toBe(0);
  });

  it('未触发时 update 返回 null 且不推进', () => {
    const model = new CapitalSubsystemModel();
    expect(model.update(1).meltdownRemaining).toBeNull();
  });
});

describe('CapitalSubsystemModel 存档', () => {
  it('serialize → deserialize 往返保留各子系统血量', () => {
    const model = new CapitalSubsystemModel();
    model.damageSubsystem('engine', 250);
    model.damageSubsystem('shield', 9999);

    const saved = model.serialize();
    const restored = new CapitalSubsystemModel();
    restored.deserialize(saved);

    expect(restored.getState('engine')?.health).toBe(750);
    expect(restored.getState('shield')?.isDestroyed).toBe(true);
  });

  it('脏数据不抛错并保持满血', () => {
    const model = new CapitalSubsystemModel();
    expect(() => model.deserialize('not-an-array')).not.toThrow();
    expect(() => model.deserialize([{ id: 'unknown', health: 10 }, null, 42])).not.toThrow();
    expect(model.getStates().every((s) => s.health === s.maxHealth)).toBe(true);
  });

  it('反序列化已毁反应堆时自毁倒计时立即到期', () => {
    const model = new CapitalSubsystemModel();
    model.deserialize([{ id: 'reactor', health: 0 }]);
    expect(model.getModifiers().meltdownRemaining).toBe(0);
  });
});
