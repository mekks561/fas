/**
 * 元进度加成：把「已购物品」折算成玩家属性，并合并进战斗系统的修饰符。
 *
 * 一句话规则（本作元进度的口径）：
 * **商店里买到的东西，是永久全局加成 —— 买完自动生效，下一局就带上。**
 * 不做装备栏（没有「选择当前船」的 UI），不做一次性消耗。
 *
 * 与技能树的关系：两者是**两条独立乘区**，在这一层外面依次相乘
 * （GameScene 的合并点：BuildSystem → 技能树 → 元进度）。
 * 顺序只影响浮点误差，但固定下来才好推理，所以写死为「元进度在最外层」。
 *
 * ── 换算表（唯一真源，改数值只改这里） ─────────────────────────────
 *
 * | 商店字段        | 通道                          | 语义        | 换算                |
 * | --------------- | ----------------------------- | ----------- | ------------------- |
 * | `health`        | `maxHealthBonus`              | 生命上限    | **绝对值** `+= v`   |
 * | `shield`        | 护盾上限                      | 护盾上限    | **绝对值** `+= v`   |
 * | `speed`         | `maxSpeedMultiplier`          | 移动速度    | 百分比 `×(1+v/100)` |
 * | `damage`        | `damageMultiplier`            | 武器伤害    | 百分比 `×(1+v/100)` |
 * | `fireRate`      | `fireRateMultiplier`          | 射击间隔    | `÷v`（v=2 → 快一倍）|
 * | `weaponSlots`   | `weaponSlotsBonus`            | 武器槽位    | `+= v`（仅记录）    |
 * | `damageBonus`   | `damageMultiplier`            | 伤害        | 分数 `×(1+v)`       |
 * | `shieldBonus`   | `maxShieldMultiplier`         | 护盾上限    | 分数 `×(1+v)`       |
 * | `speedBonus`    | `maxSpeedMultiplier`          | 速度        | 分数 `×(1+v)`       |
 * | `energyBonus`   | `maxBoostEnergyMultiplier`    | 加速能量    | 分数 `×(1+v)`       |
 *
 * 说明：
 * - 生命/护盾走**绝对值**，因为商店卡片上写的就是「生命: +200」「护盾: +100」，
 *   按字面兑现；速度/伤害没有可加的标量，故按百分比理解（UI 会显示 `%`）。
 * - `fireRate` 是**每秒射速**（`shop-item-04` plasma=2、`shop-item-05` sniper=0.5），
 *   1 为中性。所以「射速加倍」＝间隔减半；这与 `WeaponModifiers.fireRateMultiplier`
 *   的极性一致（见 `SkillBonusAdapter` 的注释）。
 * - `weaponSlots` 只记录：本作 `WeaponSystem` 没有槽位概念（单炮口 + 分裂弹），
 *   不假装它能生效。
 * - 字符串/布尔属性（`texture` / `stealth` / `homing` …）不进入数值换算；
 *   `texture` 由 `getHullTint()` 单独消费（涂装）。
 */

import type { PlayerModifiers, WeaponModifiers } from './BuildSystem';
import type { ItemAttributes, OwnedItemRecord } from './OwnedItems';

/** 折算结果：恒等元 = 全部为 0 / 1。 */
export interface MetaBonuses {
  /** 生命上限绝对值增量。 */
  maxHealthBonus: number;
  /** 护盾上限绝对值增量（在倍率之前相加）。 */
  maxShieldBonus: number;
  /** 护盾上限倍率。 */
  maxShieldMultiplier: number;
  /** 移动速度倍率。 */
  maxSpeedMultiplier: number;
  /** 武器伤害倍率。 */
  damageMultiplier: number;
  /** 射击间隔倍率（> 1 = 更慢）。 */
  fireRateMultiplier: number;
  /** 加速能量上限倍率。 */
  maxBoostEnergyMultiplier: number;
  /** 武器槽位增量（仅记录，见文件头说明）。 */
  weaponSlotsBonus: number;
  /** 参与折算的物品件数（含无数值贡献的，用于「已购 N 件」展示）。 */
  itemCount: number;
}

export const IDENTITY_META_BONUSES: MetaBonuses = {
  maxHealthBonus: 0,
  maxShieldBonus: 0,
  maxShieldMultiplier: 1,
  maxSpeedMultiplier: 1,
  damageMultiplier: 1,
  fireRateMultiplier: 1,
  maxBoostEnergyMultiplier: 1,
  weaponSlotsBonus: 0,
  itemCount: 0,
};

/**
 * 倍率夹取区间。商店数据是可编辑的策划数据，夹取是为了保证
 * 「策划写错一个 0」时玩家不会得到荒谬属性（或除零）。
 */
export const META_MULTIPLIER_MIN = 0.1;
export const META_MULTIPLIER_MAX = 10;

const clampMultiplier = (v: number): number =>
  Math.min(META_MULTIPLIER_MAX, Math.max(META_MULTIPLIER_MIN, v));

const finite = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** 单件物品 → 加成。 */
export function itemToMetaBonuses(item: OwnedItemRecord): MetaBonuses {
  const out: MetaBonuses = { ...IDENTITY_META_BONUSES, itemCount: 1 };

  // 迁移来的旧记录没有属性快照 —— 不凭空发属性
  if (item.type === 'unknown' || !item.attributes) return out;

  // 消耗品需要背包/使用时机，本期没有消费方，明确不参与加成（商店里标为「即将开放」）
  if (item.type === 'consumable') return out;

  const attrs: ItemAttributes = item.attributes;

  const flat = (key: string, apply: (v: number) => void) => {
    const v = finite(attrs[key]);
    if (v !== null) apply(v);
  };
  const percent = (key: string, apply: (factor: number) => void) => {
    const v = finite(attrs[key]);
    if (v !== null) apply(1 + v / 100);
  };
  const fraction = (key: string, apply: (factor: number) => void) => {
    const v = finite(attrs[key]);
    if (v !== null) apply(1 + v);
  };

  // 生命 / 护盾：绝对值
  flat('health', (v) => (out.maxHealthBonus += v));
  flat('shield', (v) => (out.maxShieldBonus += v));
  flat('weaponSlots', (v) => (out.weaponSlotsBonus += v));

  // 速度 / 伤害：百分比
  percent('speed', (f) => (out.maxSpeedMultiplier *= clampMultiplier(f)));
  percent('damage', (f) => (out.damageMultiplier *= clampMultiplier(f)));

  // 射速：每秒发数，1 为中性 → 间隔取倒数
  flat('fireRate', (v) => {
    if (v > 0) out.fireRateMultiplier *= clampMultiplier(1 / v);
  });

  // 升级模块的 `*Bonus` 字段是分数（0.1 = +10%）
  fraction('damageBonus', (f) => (out.damageMultiplier *= clampMultiplier(f)));
  fraction('shieldBonus', (f) => (out.maxShieldMultiplier *= clampMultiplier(f)));
  fraction('speedBonus', (f) => (out.maxSpeedMultiplier *= clampMultiplier(f)));
  fraction('energyBonus', (f) => (out.maxBoostEnergyMultiplier *= clampMultiplier(f)));

  out.maxSpeedMultiplier = clampMultiplier(out.maxSpeedMultiplier);
  out.damageMultiplier = clampMultiplier(out.damageMultiplier);
  out.fireRateMultiplier = clampMultiplier(out.fireRateMultiplier);
  out.maxShieldMultiplier = clampMultiplier(out.maxShieldMultiplier);
  out.maxBoostEnergyMultiplier = clampMultiplier(out.maxBoostEnergyMultiplier);

  return out;
}

/** 多件物品 → 合并加成（乘区相乘、绝对值相加）。 */
export function computeMetaBonuses(items: readonly OwnedItemRecord[]): MetaBonuses {
  const total: MetaBonuses = { ...IDENTITY_META_BONUSES };
  for (const item of items) {
    const one = itemToMetaBonuses(item);
    total.maxHealthBonus += one.maxHealthBonus;
    total.maxShieldBonus += one.maxShieldBonus;
    total.weaponSlotsBonus += one.weaponSlotsBonus;
    total.maxShieldMultiplier *= one.maxShieldMultiplier;
    total.maxSpeedMultiplier *= one.maxSpeedMultiplier;
    total.damageMultiplier *= one.damageMultiplier;
    total.fireRateMultiplier *= one.fireRateMultiplier;
    total.maxBoostEnergyMultiplier *= one.maxBoostEnergyMultiplier;
    total.itemCount += one.itemCount;
  }
  total.maxShieldMultiplier = clampMultiplier(total.maxShieldMultiplier);
  total.maxSpeedMultiplier = clampMultiplier(total.maxSpeedMultiplier);
  total.damageMultiplier = clampMultiplier(total.damageMultiplier);
  total.fireRateMultiplier = clampMultiplier(total.fireRateMultiplier);
  total.maxBoostEnergyMultiplier = clampMultiplier(total.maxBoostEnergyMultiplier);
  return total;
}

/** 是否完全没有加成（用于「本局无元进度加成」分支与日志）。 */
export function isIdentityMetaBonuses(meta: MetaBonuses): boolean {
  return (
    meta.maxHealthBonus === 0 &&
    meta.maxShieldBonus === 0 &&
    meta.weaponSlotsBonus === 0 &&
    meta.maxShieldMultiplier === 1 &&
    meta.maxSpeedMultiplier === 1 &&
    meta.damageMultiplier === 1 &&
    meta.fireRateMultiplier === 1 &&
    meta.maxBoostEnergyMultiplier === 1
  );
}

/** 把元进度加成合并进玩家修饰符（在技能树之后调用，即最外层乘区）。 */
export function applyMetaBonusesToPlayer(
  base: PlayerModifiers,
  meta: MetaBonuses,
): PlayerModifiers {
  return {
    ...base,
    maxHealthBonus: base.maxHealthBonus + meta.maxHealthBonus,
    maxSpeedMultiplier: base.maxSpeedMultiplier * meta.maxSpeedMultiplier,
  };
}

/** 把元进度加成合并进武器修饰符。 */
export function applyMetaBonusesToWeapon(
  base: WeaponModifiers,
  meta: MetaBonuses,
): WeaponModifiers {
  return {
    ...base,
    damageMultiplier: base.damageMultiplier * meta.damageMultiplier,
    fireRateMultiplier: base.fireRateMultiplier * meta.fireRateMultiplier,
  };
}

/**
 * 护盾上限：先加绝对值（舰体），再乘倍率（升级模块）。
 * 顺序有意为之 —— 「买船给的护盾也享受护盾模块加成」比反过来更符合直觉。
 */
export function applyMetaBonusesToShield(baseShield: number, meta: MetaBonuses): number {
  return (baseShield + meta.maxShieldBonus) * meta.maxShieldMultiplier;
}

/** 加速能量上限倍率。 */
export function applyMetaBonusesToMaxBoostEnergy(
  baseMaxBoostEnergy: number,
  meta: MetaBonuses,
): number {
  return baseMaxBoostEnergy * meta.maxBoostEnergyMultiplier;
}

/**
 * 涂装：`cosmetic` 物品的 `texture` → 舰体主色。
 *
 * 为什么不加载贴图：`public/assets` 里没有 `tex-hull-*` 这些贴图
 * （见 `scripts/audit-asset-usage.mjs`），而且 `ProceduralModelGenerator`
 * 本来就是按主色生成的。这里给程序化模型与 GLB tint 同一个颜色，涂装立刻可见。
 * 未登记的贴图名 → null（不变色），不猜。
 */
export const HULL_TINT_BY_TEXTURE: Record<string, [number, number, number]> = {
  'tex-hull-red': [0.78, 0.18, 0.18],
  'tex-hull-blue': [0.18, 0.4, 0.85],
  'tex-hull-purple': [0.55, 0.25, 0.8],
  'tex-hull-camo': [0.35, 0.42, 0.28],
};

/**
 * 取已购涂装的主色；没有可识别的涂装时返回 null。
 * 「默认主色」由 `PlayerShip` 自己拥有（它才是渲染侧的真源），此模块只负责
 * 「已购物品 → 主色」，null 表示沿用默认。
 */
export function getOwnedHullTint(
  items: readonly OwnedItemRecord[],
): [number, number, number] | null {
  let tint: [number, number, number] | null = null;
  for (const item of items) {
    if (item.type !== 'cosmetic') continue;
    const texture = item.attributes?.['texture'];
    if (typeof texture === 'string' && HULL_TINT_BY_TEXTURE[texture]) {
      // 后买的覆盖先买的（「当前涂装 = 最后一次购买」）
      tint = HULL_TINT_BY_TEXTURE[texture];
    }
  }
  return tint;
}

/** 人类可读的加成摘要，供商店面板与日志使用。 */
export function describeMetaBonuses(meta: MetaBonuses): string[] {
  const parts: string[] = [];
  if (meta.maxHealthBonus) parts.push(`生命 +${Math.round(meta.maxHealthBonus)}`);
  if (meta.maxShieldBonus) parts.push(`护盾 +${Math.round(meta.maxShieldBonus)}`);
  if (meta.maxShieldMultiplier !== 1)
    parts.push(`护盾 +${Math.round((meta.maxShieldMultiplier - 1) * 100)}%`);
  if (meta.maxSpeedMultiplier !== 1)
    parts.push(`速度 +${Math.round((meta.maxSpeedMultiplier - 1) * 100)}%`);
  if (meta.damageMultiplier !== 1)
    parts.push(`伤害 +${Math.round((meta.damageMultiplier - 1) * 100)}%`);
  if (meta.fireRateMultiplier !== 1) {
    const pct = Math.round((1 / meta.fireRateMultiplier - 1) * 100);
    parts.push(`射速 ${pct >= 0 ? '+' : ''}${pct}%`);
  }
  if (meta.maxBoostEnergyMultiplier !== 1)
    parts.push(`能量 +${Math.round((meta.maxBoostEnergyMultiplier - 1) * 100)}%`);
  if (meta.weaponSlotsBonus) parts.push(`武器槽 +${meta.weaponSlotsBonus}`);
  return parts;
}
