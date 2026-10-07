/**
 * 敌机 AI 的 Lua 适配层测试
 *
 * 覆盖三类风险：
 *  1. 换算表漂移：EnemyType 新增成员却忘了给 Lua AI 类型映射
 *  2. 挂载点行为：外部大脑接管时原生行为必须让位、状态要回写、攻击意图要能取走
 *  3. 优雅降级：真实 Lua 不可用时（Node 测试环境就是这种情况）敌机必须原样走 TS 行为，
 *     而不是挂个空壳变成"站着不动的靶子"
 *
 * 本文件不 import playcanvas：EnemyAI/桥接层都是"引擎无关"的行为逻辑，
 * 用假实体即可驱动（PlayCanvas 的大依赖只在真正的渲染路径上需要）。
 */

import { describe, it, expect } from 'vitest';
import type * as pc from 'playcanvas';
import { EnemyAI, AIState, type ExternalAIBrain } from './EnemyAI';
import { EnemyType } from './Enemy';
import type { PlayerShip } from './PlayerShip';
import {
  ENEMY_TYPE_TO_LUA_AI,
  attachLuaBrain,
  luaStateToAIState,
  getEnemyAIMode,
  setEnemyAIMode,
  getLuaAIBridgeStats,
  resetLuaAIBridgeStats,
  AI_WORLD_BOUNDS,
} from './LuaEnemyAIBridge';
import { ENEMY_BOUNDS, PLAYER_BOUNDS } from './arena';

/** 最小 Vec3 替身（EnemyAI 只用 clone） */
const vec3 = (x = 0, y = 0, z = 0) => {
  const v = {
    x,
    y,
    z,
    clone: () => vec3(v.x, v.y, v.z),
  };
  return v as unknown as pc.Vec3;
};

const makeEntity = () =>
  ({
    getPosition: () => vec3(0, 0, 0),
    setPosition: () => {},
    lookAt: () => {},
    enabled: true,
    name: 'fake-enemy',
    destroy: () => {},
  }) as unknown as pc.Entity;

const makePlayer = () => ({ getPosition: () => vec3(0, 0, 0) }) as unknown as PlayerShip;

/** 最小 EnemyAI 实现：只记录原生行为是否被调用 */
class ProbeAI extends EnemyAI {
  public nativeFrames = 0;

  protected executeBehavior(): void {
    this.nativeFrames += 1;
  }

  public getState(): AIState {
    return this.aiConfig.state;
  }
}

/** 假外部大脑 */
class FakeBrain implements ExternalAIBrain {
  public frames = 0;
  public intent = false;
  public disposed = false;
  constructor(private readonly available: boolean = true) {}

  update(): boolean {
    if (!this.available) return false;
    this.frames += 1;
    this.intent = true;
    return true;
  }

  getState(): AIState {
    return AIState.ATTACK;
  }

  consumeAttackIntent(): boolean {
    const value = this.intent;
    this.intent = false;
    return value;
  }

  dispose(): void {
    this.disposed = true;
  }
}

const makeProbeAI = () => new ProbeAI(makeEntity(), makePlayer(), vec3(1, 0, 1));

describe('ENEMY_TYPE_TO_LUA_AI 换算表', () => {
  it('覆盖全部 EnemyType 成员（新增敌人类型必须显式给映射）', () => {
    const allTypes = Object.values(EnemyType) as EnemyType[];
    expect(allTypes.length).toBeGreaterThanOrEqual(12);
    for (const type of allTypes) {
      expect(ENEMY_TYPE_TO_LUA_AI[type], `缺少 ${type} 的 Lua AI 映射`).toBeTruthy();
    }
    // 反向：映射表不应残留已删除的类型
    for (const key of Object.keys(ENEMY_TYPE_TO_LUA_AI)) {
      expect(allTypes).toContain(key as EnemyType);
    }
  });

  it('只用 enemy-ai.lua 里真实存在的四种 AI 类型', () => {
    const valid = ['PATROL', 'AGGRESSIVE', 'SNIPER', 'BOSS'];
    for (const [type, aiType] of Object.entries(ENEMY_TYPE_TO_LUA_AI)) {
      expect(valid, `${type} 映射到了未知类型 ${aiType}`).toContain(aiType);
    }
  });

  it('Boss 系列统一走 mixed（血量过半会换行为）', () => {
    expect(ENEMY_TYPE_TO_LUA_AI[EnemyType.BOSS]).toBe('BOSS');
    expect(ENEMY_TYPE_TO_LUA_AI[EnemyType.BOSS_SENTINEL]).toBe('BOSS');
    expect(ENEMY_TYPE_TO_LUA_AI[EnemyType.BOSS_OVERLORD]).toBe('BOSS');
  });

  it('世界边界与 EnemyAI.moveTowards 同源（都取自 arena.ts，物理上不可能漂移）', () => {
    // 之前这是一对「两处必须手工同步」的常量，改场地大小必然有一处漏改。
    // 现在 AI_WORLD_BOUNDS 就是 ENEMY_BOUNDS 本身（同一对象引用）。
    expect(AI_WORLD_BOUNDS).toBe(ENEMY_BOUNDS);
    expect(AI_WORLD_BOUNDS).toEqual({ x: ENEMY_BOUNDS.x, y: ENEMY_BOUNDS.y, z: ENEMY_BOUNDS.z });
  });

  it('Lua 模式的钳制边界不小于玩家可达范围（否则敌机追不出边界）', () => {
    expect(AI_WORLD_BOUNDS.x).toBeGreaterThanOrEqual(PLAYER_BOUNDS.x);
    expect(AI_WORLD_BOUNDS.z).toBeGreaterThanOrEqual(PLAYER_BOUNDS.z);
    expect(AI_WORLD_BOUNDS.y).toBeGreaterThanOrEqual(PLAYER_BOUNDS.y);
  });
});

describe('luaStateToAIState 词表映射', () => {
  it('覆盖 enemy-ai.lua 会产出的全部状态', () => {
    expect(luaStateToAIState('patrolling')).toBe(AIState.PATROL);
    expect(luaStateToAIState('chasing')).toBe(AIState.CHASE);
    expect(luaStateToAIState('attacking')).toBe(AIState.ATTACK);
    expect(luaStateToAIState('aggressive')).toBe(AIState.ATTACK);
    expect(luaStateToAIState('aiming')).toBe(AIState.ATTACK);
    expect(luaStateToAIState('shooting')).toBe(AIState.ATTACK);
    expect(luaStateToAIState('retreating')).toBe(AIState.RETREAT);
    expect(luaStateToAIState('idle')).toBe(AIState.IDLE);
  });

  it('未知状态回落 IDLE（不崩）', () => {
    expect(luaStateToAIState('')).toBe(AIState.IDLE);
    expect(luaStateToAIState('nonsense')).toBe(AIState.IDLE);
  });
});

describe('EnemyAI 外部大脑挂载点', () => {
  it('挂脑之后原生行为让位，状态回写，攻击意图可消费一次', () => {
    const ai = makeProbeAI();
    const brain = new FakeBrain();

    ai.attachExternalBrain(brain);
    expect(ai.isExternalBrainActive()).toBe(true);

    ai.update(0.016);
    expect(brain.frames).toBe(1);
    expect(ai.getExternalBrainFrames()).toBe(1);
    expect(ai.getAIState()).toBe(AIState.ATTACK);
    expect(ai.getState()).toBe(AIState.ATTACK);
    // 原生 executeBehavior 一帧都没跑
    expect(ai.nativeFrames).toBe(0);

    // 攻击意图取走即清零
    expect(ai.consumeAttackIntent()).toBe(true);
    expect(ai.consumeAttackIntent()).toBe(false);

    ai.detachExternalBrain();
    expect(brain.disposed).toBe(true);
    expect(ai.isExternalBrainActive()).toBe(false);

    // 摘掉之后原生行为恢复
    ai.update(0.016);
    expect(ai.nativeFrames).toBe(1);
  });

  it('大脑不可用（返回 false）时永久摘掉并回落原生行为', () => {
    const ai = makeProbeAI();
    const brain = new FakeBrain(false);

    ai.attachExternalBrain(brain);
    ai.update(0.016);

    expect(ai.isExternalBrainActive()).toBe(false);
    expect(brain.disposed).toBe(true);
    expect(ai.nativeFrames).toBe(1);

    // 后续帧不再尝试外部大脑
    ai.update(0.016);
    expect(ai.nativeFrames).toBe(2);
  });

  it('detach 幂等，且对没有大脑的 AI 调用无害', () => {
    const ai = makeProbeAI();
    expect(ai.consumeAttackIntent()).toBe(false);
    ai.detachExternalBrain();
    ai.detachExternalBrain();
    expect(ai.isExternalBrainActive()).toBe(false);
  });

  it('眩晕时不执行外部大脑（技能控制对敌人的约束不受 AI 后端影响）', () => {
    const ai = makeProbeAI();
    const brain = new FakeBrain();
    ai.attachExternalBrain(brain);
    // 注意：updateStatusEffects 里是 `remainingTime -= dt * 1000`，
    // 所以 duration 的口径是**毫秒**，不是秒（传 5 会当 5ms 立刻过期）。
    ai.addStatusEffect('stun', 5000, 1);

    ai.update(0.016);
    expect(brain.frames).toBe(0);
    expect(ai.nativeFrames).toBe(0);
    expect(ai.isExternalBrainActive()).toBe(true);
  });

  it('没有实现 getLuaDecision 的大脑，诊断接口返回 null 而不是抛错', () => {
    const ai = makeProbeAI();
    ai.attachExternalBrain(new FakeBrain());
    expect(ai.getExternalBrainDiagnostics()).toBeNull();
  });
});

describe('LuaEnemyAIBridge 降级路径', () => {
  it('ts 模式不挂脑', () => {
    const previous = getEnemyAIMode();
    setEnemyAIMode('ts');
    resetLuaAIBridgeStats();

    const ai = makeProbeAI();
    const attached = attachLuaBrain(
      ai,
      makeEntity(),
      makePlayer(),
      EnemyType.FIGHTER,
      vec3(1, 0, 1),
      40,
      40,
    );

    expect(attached).toBe(false);
    expect(ai.isExternalBrainActive()).toBe(false);
    expect(getLuaAIBridgeStats().created).toBe(0);
    setEnemyAIMode(previous);
  });

  it('lua 模式但真实 Lua 不可用时必须优雅拒绝（不许挂空壳）', () => {
    const previous = getEnemyAIMode();
    setEnemyAIMode('lua');
    resetLuaAIBridgeStats();

    const ai = makeProbeAI();
    const attached = attachLuaBrain(
      ai,
      makeEntity(),
      makePlayer(),
      EnemyType.FIGHTER,
      vec3(1, 0, 1),
      40,
      40,
    );

    if (attached) {
      // 某些环境（浏览器 / 可跑 wasm 的 Node）真实 Lua 可用，此时应真的挂上并可推进
      expect(ai.isExternalBrainActive()).toBe(true);
    } else {
      // jsdom 环境起不了 wasm Lua：必须明确拒绝，而不是"返回 true 却什么都不做"
      expect(ai.isExternalBrainActive()).toBe(false);
      const stats = getLuaAIBridgeStats();
      expect(stats.rejected).toBe(1);
      expect(stats.created).toBe(0);
      // 拒绝后原生行为照旧可跑（敌机不会变成不动的靶子）
      ai.update(0.016);
      expect(ai.nativeFrames).toBe(1);
    }

    setEnemyAIMode(previous);
  });
});
