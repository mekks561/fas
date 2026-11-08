/**
 * 派系进化权重对 AI 决策参数的影响测试。
 *
 * 注意：全局 setupTests 把 playcanvas 整体 mock 成了不带 lengthSq/scale 的桩，
 * 所以这里不测「真实 Vec3 几何运算」（那由浏览器实机覆盖），只断言
 * 「权重 → 决策参数」的数值映射：感知半径随 aggression 变化、编队交接距离随 cohesion 变化。
 */
import { describe, it, expect } from 'vitest';
import * as pc from 'playcanvas';
import { FighterAI } from './EnemyAI';

function makePlayer(pos: pc.Vec3) {
  return { getPosition: () => pos } as unknown as import('./PlayerShip').PlayerShip;
}

function makeEntity(pos: pc.Vec3) {
  let current = pos.clone();
  return {
    getPosition: () => current,
    setPosition: (p: pc.Vec3) => {
      current = p.clone();
    },
    lookAt: () => undefined,
  } as unknown as pc.Entity;
}

/** 打开 protected 接口，直接验证权重映射到的决策参数 */
class ProbeFighterAI extends FighterAI {
  public exposeHandoffDistanceSq(): number {
    return this.formationHandoffDistanceSq();
  }
}

function makeAI(enemyPos: pc.Vec3, playerPos: pc.Vec3): ProbeFighterAI {
  return new ProbeFighterAI(makeEntity(enemyPos), makePlayer(playerPos), enemyPos.clone());
}

describe('EnemyAI 派系权重 → 决策参数', () => {
  it('默认权重 0.5 时感知半径等于基准追击半径（行为不变）', () => {
    const ai = makeAI(new pc.Vec3(0, 0, 0), new pc.Vec3(0, 0, -10));
    expect(ai.getDetectionRadius()).toBeCloseTo(35, 6);
  });

  it('aggression 越高，感知半径越大（越远就开始接敌）', () => {
    const ai = makeAI(new pc.Vec3(0, 0, 0), new pc.Vec3(0, 0, -10));

    ai.setWeights({ aggression: 1.0, cohesion: 0.5 });
    // 35 * (0.7 + 0.6 * 1.0) = 45.5
    expect(ai.getDetectionRadius()).toBeCloseTo(45.5, 6);

    ai.setWeights({ aggression: 0.1, cohesion: 0.5 });
    // 35 * (0.7 + 0.6 * 0.1) = 35 * 0.76 = 26.6
    expect(ai.getDetectionRadius()).toBeCloseTo(26.6, 6);
  });

  it('cohesion 越高，编队交接距离越大（越晚交还常规追击）', () => {
    const ai = makeAI(new pc.Vec3(0, 0, 0), new pc.Vec3(0, 0, -10));

    ai.setWeights({ aggression: 0.5, cohesion: 0.1 });
    // r = 8 + 8*0.1 = 8.8 → sq = 77.44
    expect(ai.exposeHandoffDistanceSq()).toBeCloseTo(77.44, 4);

    ai.setWeights({ aggression: 0.5, cohesion: 0.5 });
    // r = 12 → sq = 144
    expect(ai.exposeHandoffDistanceSq()).toBeCloseTo(144, 4);

    ai.setWeights({ aggression: 0.5, cohesion: 1.0 });
    // r = 16 → sq = 256
    expect(ai.exposeHandoffDistanceSq()).toBeCloseTo(256, 4);
  });
});
