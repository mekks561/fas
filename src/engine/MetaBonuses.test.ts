import { describe, it, expect } from 'vitest';
import {
  IDENTITY_META_BONUSES,
  META_MULTIPLIER_MAX,
  META_MULTIPLIER_MIN,
  applyMetaBonusesToMaxBoostEnergy,
  applyMetaBonusesToPlayer,
  applyMetaBonusesToShield,
  applyMetaBonusesToWeapon,
  computeMetaBonuses,
  describeMetaBonuses,
  getOwnedHullTint,
  isIdentityMetaBonuses,
  itemToMetaBonuses,
  HULL_TINT_BY_TEXTURE,
} from './MetaBonuses';
import type { OwnedItemRecord } from './OwnedItems';
import { BuildSystem } from './BuildSystem';

const ship = (over: Partial<OwnedItemRecord> = {}): OwnedItemRecord => ({
  id: 'shop-item-01',
  name: '重型巡洋舰',
  type: 'ship',
  subtype: 'cruiser',
  price: 15000,
  attributes: { health: 200, shield: 100, speed: 50, damage: 30, weaponSlots: 4 },
  purchasedAt: 1,
  ...over,
});

describe('MetaBonuses 单件换算', () => {
  it('恒等元：什么都没买时所有倍率为 1、增量为 0', () => {
    expect(isIdentityMetaBonuses(IDENTITY_META_BONUSES)).toBe(true);
    expect(isIdentityMetaBonuses(itemToMetaBonuses({ ...ship(), attributes: {} }))).toBe(true);
  });

  it('飞船：生命/护盾是绝对值，速度/伤害是百分比', () => {
    const meta = itemToMetaBonuses(ship());
    expect(meta.maxHealthBonus).toBe(200);
    expect(meta.maxShieldBonus).toBe(100);
    expect(meta.maxSpeedMultiplier).toBeCloseTo(1.5, 6); // speed 50 → +50%
    expect(meta.damageMultiplier).toBeCloseTo(1.3, 6); // damage 30 → +30%
    expect(meta.weaponSlotsBonus).toBe(4);
  });

  it('武器：射速是「每秒发数」，1 为中性 → 间隔取倒数', () => {
    const plasma = itemToMetaBonuses({
      ...ship(),
      type: 'weapon',
      attributes: { damage: 35, fireRate: 2 },
    });
    expect(plasma.fireRateMultiplier).toBeCloseTo(0.5, 6); // 2 发/秒 = 间隔减半

    const sniper = itemToMetaBonuses({
      ...ship(),
      type: 'weapon',
      attributes: { damage: 80, fireRate: 0.5 },
    });
    expect(sniper.fireRateMultiplier).toBeCloseTo(2, 6); // 0.5 发/秒 = 间隔翻倍
  });

  it('升级模块：`*Bonus` 是分数（0.1 = +10%）', () => {
    const damage = itemToMetaBonuses({
      ...ship(),
      id: 'shop-item-17',
      type: 'upgrade',
      attributes: { damageBonus: 0.1, permanent: true },
    });
    expect(damage.damageMultiplier).toBeCloseTo(1.1, 6);

    const shield = itemToMetaBonuses({
      ...ship(),
      id: 'shop-item-18',
      type: 'upgrade',
      attributes: { shieldBonus: 0.2, permanent: true },
    });
    expect(shield.maxShieldMultiplier).toBeCloseTo(1.2, 6);
  });

  it('消耗品不参与加成（本期没有消费方，商店里也标为即将开放）', () => {
    const consumable = itemToMetaBonuses({
      ...ship(),
      id: 'shop-item-09',
      type: 'consumable',
      attributes: { healAmount: 50, count: 5 },
    });
    expect(isIdentityMetaBonuses(consumable)).toBe(true);
    expect(consumable.itemCount).toBe(1); // 仍计入「已购件数」
  });

  it('迁移来的 unknown 记录不凭空发属性', () => {
    const legacy = itemToMetaBonuses({
      id: 'shop-item-01',
      name: 'x',
      type: 'unknown',
      price: 0,
      purchasedAt: 0,
    });
    expect(isIdentityMetaBonuses(legacy)).toBe(true);
  });

  it('未知字段（stealth / texture / permanent）被忽略，不崩', () => {
    const meta = itemToMetaBonuses({
      ...ship(),
      attributes: {
        speed: 50,
        stealth: true,
        texture: 'tex-hull-red',
        permanent: true,
        unknownKey: 999,
      },
    });
    expect(meta.maxSpeedMultiplier).toBeCloseTo(1.5, 6);
  });

  it('策划写错数量级时被夹取，不会出现荒谬属性', () => {
    const absurd = itemToMetaBonuses({ ...ship(), attributes: { damage: 1e6, speed: 1e6 } });
    expect(absurd.damageMultiplier).toBe(META_MULTIPLIER_MAX);
    expect(absurd.maxSpeedMultiplier).toBe(META_MULTIPLIER_MAX);

    const zero = itemToMetaBonuses({ ...ship(), attributes: { fireRate: 0 } });
    expect(zero.fireRateMultiplier).toBe(1); // 0 发/秒没有意义 → 视为中性，不产生除零
  });
});

describe('MetaBonuses 多件合并', () => {
  it('绝对值相加、倍率相乘', () => {
    const cruiser = ship(); // health +200, shield +100, speed ×1.5, damage ×1.3
    const module = {
      ...ship(),
      id: 'shop-item-17',
      type: 'upgrade' as const,
      attributes: { damageBonus: 0.1 },
    };
    const meta = computeMetaBonuses([cruiser, module]);
    expect(meta.maxHealthBonus).toBe(200);
    expect(meta.maxShieldBonus).toBe(100);
    expect(meta.damageMultiplier).toBeCloseTo(1.3 * 1.1, 6);
    expect(meta.itemCount).toBe(2);
  });

  it('空列表 = 恒等元', () => {
    expect(computeMetaBonuses([])).toEqual(IDENTITY_META_BONUSES);
  });
});

describe('MetaBonuses 合并进战斗修饰符', () => {
  it('生命与速度合并进 PlayerModifiers，其余通道不动', () => {
    const base = new BuildSystem().getPlayerModifiers();
    const merged = applyMetaBonusesToPlayer(base, itemToMetaBonuses(ship()));
    expect(merged.maxHealthBonus).toBe(200);
    expect(merged.maxSpeedMultiplier).toBeCloseTo(1.5, 6);
    // 未涉及的通道必须原样保留（防止「顺手改坏」）
    expect(merged.shieldRechargeRateMultiplier).toBe(base.shieldRechargeRateMultiplier);
    expect(merged.cooldownMultiplier).toBe(base.cooldownMultiplier);
    expect(merged.damageTakenMultiplier).toBe(base.damageTakenMultiplier);
  });

  it('伤害与射速合并进 WeaponModifiers，其余通道不动', () => {
    const base = new BuildSystem().getWeaponModifiers();
    const merged = applyMetaBonusesToWeapon(
      base,
      itemToMetaBonuses({ ...ship(), type: 'weapon', attributes: { damage: 35, fireRate: 2 } }),
    );
    expect(merged.damageMultiplier).toBeCloseTo(1.35, 6);
    expect(merged.fireRateMultiplier).toBeCloseTo(0.5, 6);
    expect(merged.critDamageMultiplier).toBe(base.critDamageMultiplier);
    expect(merged.pierceBonus).toBe(base.pierceBonus);
  });

  it('护盾：先加舰体绝对值，再乘模块倍率', () => {
    const base = 50;
    expect(applyMetaBonusesToShield(base, itemToMetaBonuses(ship()))).toBeCloseTo(150, 6);
    expect(
      applyMetaBonusesToShield(base, { ...IDENTITY_META_BONUSES, maxShieldMultiplier: 1.2 }),
    ).toBeCloseTo(60, 6);
    expect(
      applyMetaBonusesToShield(base, {
        ...IDENTITY_META_BONUSES,
        maxShieldBonus: 100,
        maxShieldMultiplier: 1.2,
      }),
    ).toBeCloseTo(180, 6);
  });

  it('加速能量上限倍率', () => {
    expect(applyMetaBonusesToMaxBoostEnergy(100, IDENTITY_META_BONUSES)).toBe(100);
    expect(
      applyMetaBonusesToMaxBoostEnergy(100, {
        ...IDENTITY_META_BONUSES,
        maxBoostEnergyMultiplier: 1.3,
      }),
    ).toBeCloseTo(130, 6);
  });
});

describe('MetaBonuses 涂装', () => {
  it('已购涂装给出主色，未登记贴图名返回 null（不猜）', () => {
    const red = getOwnedHullTint([
      { ...ship(), id: 'shop-item-13', type: 'cosmetic', attributes: { texture: 'tex-hull-red' } },
    ]);
    expect(red).toEqual(HULL_TINT_BY_TEXTURE['tex-hull-red']);

    const unknown = getOwnedHullTint([
      { ...ship(), id: 'x', type: 'cosmetic', attributes: { texture: 'tex-hull-unknown' } },
    ]);
    expect(unknown).toBeNull();
  });

  it('没有涂装时返回 null（沿用 PlayerShip 的默认主色）', () => {
    expect(getOwnedHullTint([ship()])).toBeNull();
    expect(getOwnedHullTint([])).toBeNull();
  });

  it('多件涂装以最后购买的为准', () => {
    const tint = getOwnedHullTint([
      {
        ...ship(),
        id: 'a',
        type: 'cosmetic',
        attributes: { texture: 'tex-hull-red' },
        purchasedAt: 1,
      },
      {
        ...ship(),
        id: 'b',
        type: 'cosmetic',
        attributes: { texture: 'tex-hull-blue' },
        purchasedAt: 2,
      },
    ]);
    expect(tint).toEqual(HULL_TINT_BY_TEXTURE['tex-hull-blue']);
  });

  it('涂装颜色都在合法区间内', () => {
    for (const [texture, tint] of Object.entries(HULL_TINT_BY_TEXTURE)) {
      expect(texture.startsWith('tex-hull-'), `${texture} 命名不符合约定`).toBe(true);
      tint.forEach((c) => {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      });
    }
  });
});

describe('MetaBonuses 文案', () => {
  it('只列出实际生效的通道', () => {
    expect(describeMetaBonuses(IDENTITY_META_BONUSES)).toEqual([]);
    const text = describeMetaBonuses(itemToMetaBonuses(ship()));
    expect(text).toContain('生命 +200');
    expect(text).toContain('护盾 +100');
    expect(text).toContain('速度 +50%');
    expect(text).toContain('伤害 +30%');
  });

  it('射速文案的方向正确（间隔减半 = 射速 +100%）', () => {
    const text = describeMetaBonuses(
      itemToMetaBonuses({ ...ship(), type: 'weapon', attributes: { fireRate: 2 } }),
    );
    expect(text).toContain('射速 +100%');
  });

  it('夹取区间本身合法（min < 1 < max）', () => {
    expect(META_MULTIPLIER_MIN).toBeLessThan(1);
    expect(META_MULTIPLIER_MAX).toBeGreaterThan(1);
  });
});
