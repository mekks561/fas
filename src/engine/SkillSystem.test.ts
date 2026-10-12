import { describe, expect, it } from 'vitest';
import { MissileStrikeSkill, applyExplosionDamage } from './SkillSystem';
import type { SkillDamageTarget } from './SkillSystem';

/**
 * 只测**纯逻辑**，不构造任何 PlayCanvas 实体。
 *
 * `explodeMissile` 里满是 `new pc.Entity()`，出了浏览器就跑不了；但「谁挨打、挨几点」
 * 这段判定不该被浏览器绑死 —— 所以它被抽成了 `applyExplosionDamage`。
 * 特效与几何那部分由 `scripts/verify-skill-damage.mjs` 在真实浏览器里验。
 */
interface FakeTarget extends SkillDamageTarget {
  health: number;
  damageTaken: number;
  alive: boolean;
}

function makeTarget(health = 100, alive = true): FakeTarget {
  const target: FakeTarget = {
    health,
    damageTaken: 0,
    alive,
    isAlive: () => target.alive,
    // 用 ReturnType 取类型，避免在这里 import playcanvas（Node 下没必要拉起它）
    getPosition: () => ({ x: 0, y: 0, z: 0 }) as ReturnType<SkillDamageTarget['getPosition']>,
    takeDamage(amount: number) {
      target.damageTaken += amount;
      target.health -= amount;
    },
  };
  return target;
}

describe('applyExplosionDamage', () => {
  it('命中全部存活目标，发放伤害 = 命中数 × 单发伤害', () => {
    const targets = [makeTarget(), makeTarget(), makeTarget()];
    const result = applyExplosionDamage(targets, 7.5);

    expect(result.hits).toBe(3);
    expect(result.damage).toBe(22.5);
    targets.forEach((t) => expect(t.damageTaken).toBe(7.5));
  });

  it('跳过已死亡目标（不把伤害打在正在爆炸的尸体上）', () => {
    const alive = makeTarget();
    const dead = makeTarget(0, false);
    const result = applyExplosionDamage([alive, dead], 7.5);

    expect(result.hits).toBe(1);
    expect(result.damage).toBe(7.5);
    expect(alive.damageTaken).toBe(7.5);
    expect(dead.damageTaken).toBe(0);
  });

  it('空目标列表不产生伤害，也不报错', () => {
    expect(applyExplosionDamage([], 7.5)).toEqual({ hits: 0, damage: 0 });
  });

  it('每个目标只结算一次（同一枚导弹不会对同一敌人重复扣血）', () => {
    const target = makeTarget();
    applyExplosionDamage([target], 7.5);

    expect(target.damageTaken).toBe(7.5);
    expect(target.health).toBe(92.5);
  });
});

describe('导弹打击的伤害真值', () => {
  /**
   * 这条断言的是**用户指定的平衡值**，不是实现细节。
   * 改伤害必须同时改 HUD/文档的说明 —— 让它在测试里挂掉，比让玩家发现好。
   */
  it('单发爆炸伤害 = 7.5', () => {
    expect(MissileStrikeSkill.EXPLOSION_DAMAGE).toBe(7.5);
  });

  it('爆炸半径为正且能覆盖相邻导弹的落点铺开宽度（±10）', () => {
    // 半径若小于横向铺开的一半，一次施放的导弹就会各炸各的、打不成片。
    expect(MissileStrikeSkill.EXPLOSION_RADIUS).toBeGreaterThan(10);
  });
});
