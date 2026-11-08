/**
 * 集群战术网（v2.8 Phase 1）小队管理器测试。
 *
 * SquadManager 是纯逻辑模块（只依赖 pc.Vec3），这里直接构造 Vec3 驱动，
 * 不起 PlayCanvas 场景 —— 覆盖队形几何、队长选举、威胁切换、
 * 战术广播与权重结算 / 序列化这些验收点。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type * as pc from 'playcanvas';
import { SquadManager } from './SquadManager';

/** 与 SquadManager 内部持久化 key 保持一致 */
const WEIGHTS_KEY = 'fighter.squadWeights.v1';

// SquadManager 构造时会从 localStorage 恢复权重，jsdom 里 localStorage 是跨用例共享的，
// 不清理会让前一个用例结算出的权重污染后一个用例（用例必须从默认 0.5/0.5 起步）。
beforeEach(() => {
  try {
    globalThis.localStorage?.removeItem(WEIGHTS_KEY);
  } catch {
    // 用例里可能把 localStorage 替换成不含 removeItem 的桩，清理失败不影响用例本身
  }
});

// 本测试不加载真实 PlayCanvas：SquadManager 只做纯数学，Vec3 用最小替身即可，
// 避免整套测试在 jsdom 里额外拉起引擎（那样每个测试文件都会慢几十秒）。
class TestVec3 {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}

  clone(): TestVec3 {
    return new TestVec3(this.x, this.y, this.z);
  }

  set(x: number, y: number, z: number): TestVec3 {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  normalize(): TestVec3 {
    const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (length > 0) {
      this.x /= length;
      this.y /= length;
      this.z /= length;
    }
    return this;
  }
}

const vec3 = (x = 0, y = 0, z = 0) => new TestVec3(x, y, z) as unknown as pc.Vec3;

const ANCHOR = vec3();
const FORWARD = vec3(0, 0, -1);

/** 取一队所有成员的槽位（要求全部存在） */
function collectSlots(manager: SquadManager, ids: string[]): pc.Vec3[] {
  const slots = ids.map((id) => manager.getSlot(id));
  slots.forEach((slot) => expect(slot).not.toBeNull());
  return slots as pc.Vec3[];
}

/** 任意两槽位的最小间距 */
function minPairDistance(slots: pc.Vec3[]): number {
  let min = Infinity;
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const dx = slots[i].x - slots[j].x;
      const dy = slots[i].y - slots[j].y;
      const dz = slots[i].z - slots[j].z;
      min = Math.min(min, Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
  }
  return min;
}

describe('SquadManager 队形几何', () => {
  it('楔形：首槽在 anchor + forward*8，其余左右交替展开且互不重合', () => {
    const manager = new SquadManager();
    const ids = ['a', 'b', 'c', 'd', 'e'];
    manager.createSquad('hostile', ids);
    manager.update(1 / 60, ANCHOR, FORWARD);

    const slots = collectSlots(manager, ids);
    expect(slots).toHaveLength(5);

    // 队长 a 占据首槽
    expect(slots[0].z).toBeCloseTo(-8, 5);
    // 第二/三级成员左右交替，并逐级后退 2.5
    expect(slots[1].x).toBeCloseTo(-3, 5);
    expect(slots[1].z).toBeCloseTo(-5.5, 5);
    expect(slots[2].x).toBeCloseTo(3, 5);
    expect(slots[2].z).toBeCloseTo(-5.5, 5);
    expect(slots[3].x).toBeCloseTo(-6, 5);
    expect(slots[3].z).toBeCloseTo(-3, 5);
    expect(slots[4].x).toBeCloseTo(6, 5);
    expect(slots[4].z).toBeCloseTo(-3, 5);

    expect(minPairDistance(slots)).toBeGreaterThan(1);
  });

  it('环形：以 anchor 为圆心半径 9，槽位落在同一水平面且互不重合', () => {
    const manager = new SquadManager();
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const squadId = manager.createSquad('hostile', ids);
    manager.setThreat(squadId, 1);
    manager.update(1 / 60, ANCHOR, FORWARD);

    const slots = collectSlots(manager, ids);
    expect(slots).toHaveLength(6);
    slots.forEach((slot) => {
      expect(slot.y).toBeCloseTo(ANCHOR.y, 5);
      expect(Math.hypot(slot.x - ANCHOR.x, slot.z - ANCHOR.z)).toBeCloseTo(9, 4);
    });
    expect(minPairDistance(slots)).toBeGreaterThan(1);
  });

  it('纵队：沿 -forward 排队，间距 3.5 且互不重合', () => {
    const manager = new SquadManager();
    const ids = ['a', 'b', 'c', 'd'];
    const squadId = manager.createSquad('hostile', ids);
    manager.setThreat(squadId, 2);
    manager.update(1 / 60, ANCHOR, FORWARD);

    const slots = collectSlots(manager, ids);
    expect(slots).toHaveLength(4);
    // 队长 a 首槽，其后按加入顺序排队
    const depths = ids.map((id) => (manager.getSlot(id) as pc.Vec3).z);
    expect(depths[0]).toBeCloseTo(3.5, 5);
    expect(depths[1]).toBeCloseTo(7, 5);
    expect(depths[2]).toBeCloseTo(10.5, 5);
    expect(depths[3]).toBeCloseTo(14, 5);
    expect(minPairDistance(slots)).toBeGreaterThan(3);
  });

  it('三种队形都以 anchor / forward 为基准（前向旋转后队形一同旋转）', () => {
    const anchor = vec3(10, 2, 0);
    const forward = vec3(1, 0, 0);
    const manager = new SquadManager();
    const squadId = manager.createSquad('hostile', ['a', 'b', 'c', 'd']);
    manager.update(1 / 60, anchor, forward);

    const leaderSlot = manager.getSlot('a') as pc.Vec3;
    expect(leaderSlot.x).toBeCloseTo(18, 5);
    expect(leaderSlot.y).toBeCloseTo(2, 5);
    expect(leaderSlot.z).toBeCloseTo(0, 5);

    // 环形仍以 anchor 为圆心
    manager.setThreat(squadId, 1);
    manager.update(1 / 60, anchor, forward);
    collectSlots(manager, ['a', 'b', 'c', 'd']).forEach((slot) => {
      expect(slot.y).toBeCloseTo(2, 5);
      expect(Math.hypot(slot.x - 10, slot.z - 0)).toBeCloseTo(9, 4);
    });
  });

  it('update 只重算队内成员槽位，队外 id 返回 null', () => {
    const manager = new SquadManager();
    manager.createSquad('hostile', ['a', 'b']);
    manager.update(1 / 60, ANCHOR, FORWARD);

    expect(manager.getSlot('outsider')).toBeNull();
    expect(manager.getSlot('a')).not.toBeNull();
    expect(manager.getSlot('b')).not.toBeNull();
  });
});

describe('SquadManager 队长选举与威胁切换', () => {
  it('level 最高者优先，同 level 取 id 字典序最小', () => {
    const manager = new SquadManager();
    const squadId = manager.createSquad('hostile', [
      { id: 'alpha', level: 1 },
      { id: 'zeta', level: 2 },
      { id: 'beta', level: 2 },
    ]);

    expect(manager.getLeader(squadId)).toBe('beta');

    // 队长阵亡后重新选举
    manager.broadcastAlert('destroyed', 'beta');
    expect(manager.getMemberCount(squadId)).toBe(2);
    expect(manager.getLeader(squadId)).toBe('zeta');
    expect(manager.getSlot('beta')).toBeNull();
  });

  it('队长被移除后 update 仍能重排槽位（新队长占据首槽）', () => {
    const manager = new SquadManager();
    const squadId = manager.createSquad('hostile', [
      { id: 'a', level: 1 },
      { id: 'z', level: 3 },
      { id: 'b', level: 1 },
    ]);
    manager.update(1 / 60, ANCHOR, FORWARD);
    expect((manager.getSlot('z') as pc.Vec3).z).toBeCloseTo(-8, 5);

    manager.removeMember('z');
    manager.update(1 / 60, ANCHOR, FORWARD);
    expect(manager.getLeader(squadId)).toBe('a');
    expect((manager.getSlot('a') as pc.Vec3).z).toBeCloseTo(-8, 5);
    expect(manager.getSlot('z')).toBeNull();
  });

  it('setThreat 触发队形切换：0 楔形 / 1 环形 / 2 纵队', () => {
    const manager = new SquadManager();
    const squadId = manager.createSquad('hostile', ['a', 'b', 'c', 'd']);

    expect(manager.getFormation(squadId)).toBe('wedge');
    manager.setThreat(squadId, 1);
    expect(manager.getFormation(squadId)).toBe('circle');
    manager.update(1 / 60, ANCHOR, FORWARD);
    expect((manager.getSlot('a') as pc.Vec3).z).toBeCloseTo(-9, 4);

    manager.setThreat(squadId, 2);
    expect(manager.getFormation(squadId)).toBe('column');
    manager.update(1 / 60, ANCHOR, FORWARD);
    expect((manager.getSlot('a') as pc.Vec3).z).toBeCloseTo(3.5, 5);

    manager.setThreat(squadId, 0);
    expect(manager.getFormation(squadId)).toBe('wedge');
  });

  it('broadcastAlert(damaged) 提升威胁等级并上限为 2', () => {
    const manager = new SquadManager();
    const squadId = manager.createSquad('hostile', ['a', 'b']);

    manager.broadcastAlert('damaged', 'a');
    expect(manager.getFormation(squadId)).toBe('circle');
    expect(manager.getMemberCount(squadId)).toBe(2);

    manager.broadcastAlert('damaged', 'b');
    expect(manager.getFormation(squadId)).toBe('column');

    manager.broadcastAlert('damaged', 'a');
    expect(manager.getFormation(squadId)).toBe('column');
  });

  it('未知成员的告警不会影响任何小队', () => {
    const manager = new SquadManager();
    const squadId = manager.createSquad('hostile', ['a']);

    manager.broadcastAlert('damaged', 'ghost');
    manager.broadcastAlert('destroyed', 'ghost');

    expect(manager.getFormation(squadId)).toBe('wedge');
    expect(manager.getMemberCount(squadId)).toBe(1);
  });
});

describe('SquadManager 进化权重', () => {
  it('recordBattleResult 按 0.05/0.03/0.02/0.04 更新权重', () => {
    const manager = new SquadManager();
    expect(manager.getWeights('hostile')).toEqual({ aggression: 0.5, cohesion: 0.5 });

    manager.recordBattleResult({ factionId: 'hostile', kills: 5, losses: 0 });
    const weights = manager.getWeights('hostile');
    expect(weights.aggression).toBeCloseTo(0.75, 6);
    expect(weights.cohesion).toBeCloseTo(0.6, 6);
  });

  it('权重钳制在 [0.1, 1.0]', () => {
    const manager = new SquadManager();

    manager.recordBattleResult({ factionId: 'hostile', kills: 0, losses: 100 });
    expect(manager.getWeights('hostile')).toEqual({ aggression: 0.1, cohesion: 0.1 });

    manager.recordBattleResult({ factionId: 'hostile', kills: 1000, losses: 0 });
    expect(manager.getWeights('hostile')).toEqual({ aggression: 1, cohesion: 1 });
  });

  it('不同派系权重互相独立', () => {
    const manager = new SquadManager();
    manager.recordBattleResult({ factionId: 'hostile', kills: 4, losses: 0 });

    expect(manager.getWeights('hostile').aggression).toBeCloseTo(0.7, 6);
    expect(manager.getWeights('neutral')).toEqual({ aggression: 0.5, cohesion: 0.5 });
  });
});

describe('SquadManager 权重持久化', () => {
  it('recordBattleResult 写入 localStorage，新实例可恢复', () => {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    try {
      const first = new SquadManager();
      first.recordBattleResult({ factionId: 'hostile', kills: 4, losses: 0 });
      const evolved = first.getWeights('hostile');
      expect(store.size).toBe(1);

      const restored = new SquadManager();
      expect(restored.getWeights('hostile')).toEqual(evolved);
    } finally {
      delete (globalThis as any).localStorage;
    }
  });

  it('localStorage 读写抛异常时降级为默认权重，不阻断结算', () => {
    (globalThis as any).localStorage = {
      getItem: () => {
        throw new Error('access denied');
      },
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };

    try {
      const manager = new SquadManager();
      expect(manager.getWeights('hostile')).toEqual({ aggression: 0.5, cohesion: 0.5 });
      manager.recordBattleResult({ factionId: 'hostile', kills: 2, losses: 0 });
      expect(manager.getWeights('hostile').aggression).toBeCloseTo(0.6, 6);
    } finally {
      delete (globalThis as any).localStorage;
    }
  });
});

describe('SquadManager 序列化', () => {
  it('serialize → deserialize 往返一致，并可继续重算槽位', () => {
    const manager = new SquadManager();
    const squadA = manager.createSquad('hostile', [
      { id: 'a', level: 2 },
      { id: 'b', level: 1 },
      { id: 'c', level: 1 },
    ]);
    manager.createSquad('hostile', ['d', 'e']);
    manager.setThreat(squadA, 1);
    manager.broadcastAlert('damaged', 'c');
    manager.recordBattleResult({ factionId: 'hostile', kills: 3, losses: 1 });
    manager.recordBattleResult({ factionId: 'neutral', kills: 0, losses: 2 });
    manager.update(1 / 60, ANCHOR, FORWARD);

    // 走一遍 JSON 深拷贝，确保只依赖可序列化数据
    const snapshot = JSON.parse(JSON.stringify(manager.serialize())) as unknown;

    const restored = new SquadManager();
    restored.deserialize(snapshot);

    expect(restored.serialize()).toEqual(snapshot);
    expect(restored.getLeader(squadA)).toBe('a');
    expect(restored.getWeights('hostile').aggression).toBeCloseTo(0.62, 6);

    // 反序列化后没有槽位，update 应重新生成
    expect(restored.getSlot('a')).toBeNull();
    restored.update(1 / 60, ANCHOR, FORWARD);
    expect(restored.getSlot('a')).not.toBeNull();
    expect(restored.getSlot('d')).not.toBeNull();
  });

  it('deserialize 对脏数据降级而不抛错', () => {
    const manager = new SquadManager();
    const squadId = manager.createSquad('hostile', ['a']);
    const goodSnapshot = manager.serialize();

    manager.deserialize(null);
    expect(manager.getSlot('a')).toBeNull();

    manager.deserialize({ squads: 'not-an-array', weights: [{}] });
    expect(manager.serialize()).toEqual({
      version: 1,
      squadCounter: 0,
      elapsed: 0,
      squads: [],
      weights: [],
    });

    // 恢复有效快照
    manager.deserialize(goodSnapshot);
    expect(manager.getMemberCount(squadId)).toBe(1);
  });

  it('destroy 清空全部状态', () => {
    const manager = new SquadManager();
    manager.createSquad('hostile', ['a', 'b']);
    manager.recordBattleResult({ factionId: 'hostile', kills: 1, losses: 0 });

    manager.destroy();

    expect(manager.getSlot('a')).toBeNull();
    expect(manager.getWeights('hostile')).toEqual({ aggression: 0.5, cohesion: 0.5 });
    expect(manager.serialize()).toMatchObject({ squads: [], weights: [] });
  });
});
