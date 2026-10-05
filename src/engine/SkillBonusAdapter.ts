/**
 * 技能树加成适配器
 *
 * 背景：`SkillTreeManager` 产出的 `SkillTreeStats` 与 `BuildSystem` 的
 * `PlayerModifiers` / `WeaponModifiers` 是两套互不相干的数据结构。
 * 在接通之前，技能树是「两端全断」的半成品——玩家等级永远涨不上去（没有任何
 * 生产代码调用 `setPlayerLevel`），`getStats()` 也没有任何战斗代码消费，
 * 等于 670 行实现 + 344 行 UI 全部空转。
 *
 * 本模块只做一件事：把天赋加成**合并**进战斗系统已有的修饰符里
 * （不是覆盖），让「局内三选一强化」与「跨局技能树」两条强化线同时生效。
 *
 * 单位约定（必须与消费端实现对齐，勿凭直觉改）：
 * - `SkillTreeStats` 里所有百分比字段都是「百分点」：`15` 表示 +15%。
 * - `WeaponModifiers.critChanceBonus` 是**概率**（0-1），消费端写法是
 *   `Math.random() < critChanceBonus`，所以百分比要除以 100。
 * - `WeaponModifiers.critDamageMultiplier` 是**倍率**，默认 `2` 即 200%。
 * - `WeaponModifiers.fireRateMultiplier` 语义特殊：**大于 1 表示更慢**。
 *   见 `WeaponSystem`：`effectiveFireRate = fireRate * fireRateMultiplier`，
 *   而它是「射击间隔」，所以射速加成必须取**倒数**。
 * - `PlayerModifiers.maxHealthBonus` 是**绝对值增量**，且
 *   `PlayerShip.setBuildModifiers` 按「与上一帧的差值」处理（新增上限并回血）。
 *   因此这里用基线生命值 × 百分比换算成绝对值，合并结果每帧稳定，
 *   增量逻辑只在第一次加上天赋时触发一次。
 */

import type { PlayerModifiers, WeaponModifiers } from './BuildSystem';
import type { SkillTreeStats } from './SkillTreeManager';

/** 玩家生命基线。与 `PlayerShip` 构造函数 `config.health || 100` 保持一致。 */
export const BASE_MAX_HEALTH = 100;

/** 护盾基线。与 `PlayerShip` 构造函数 `config.shield || 50` 保持一致。 */
export const BASE_MAX_SHIELD = 50;

const pct = (points: number): number => points / 100;

/**
 * 把技能树加成合并进玩家修饰符。
 *
 * @param base 来自 BuildSystem（局内三选一强化）的玩家修饰符
 * @param stats 技能树聚合加成
 * @param baseMaxHealth 生命基线，用于把百分比加成换算成绝对值
 */
export function applySkillBonusesToPlayer(
  base: PlayerModifiers,
  stats: SkillTreeStats,
  baseMaxHealth: number = BASE_MAX_HEALTH,
): PlayerModifiers {
  return {
    ...base,
    // 生命上限：绝对值增量（绝对值 + 基线 × 百分比）
    maxHealthBonus: base.maxHealthBonus + baseMaxHealth * pct(stats.healthBonus),
    // 移动速度
    maxSpeedMultiplier: base.maxSpeedMultiplier * (1 + pct(stats.speedBonus)),
    // 护盾恢复速率：护盾效果提升体现为回得更快
    shieldRechargeRateMultiplier:
      base.shieldRechargeRateMultiplier * (1 + pct(stats.shieldEffectiveness)),
    // 加速能量回复：加速效果与能量回复两项天赋合并到这一条通道上
    boostEnergyRechargeMultiplier:
      base.boostEnergyRechargeMultiplier * (1 + pct(stats.boostEffectiveness + stats.energyRegen)),
    // 冷却缩减：下限 0.1，避免叠满后除零/负值
    cooldownMultiplier: base.cooldownMultiplier * Math.max(0.1, 1 - pct(stats.cooldownReduction)),
  };
}

/**
 * 把技能树加成合并进武器修饰符。
 *
 * @param base 来自 BuildSystem（局内三选一强化）的武器修饰符
 * @param stats 技能树聚合加成
 */
export function applySkillBonusesToWeapon(
  base: WeaponModifiers,
  stats: SkillTreeStats,
): WeaponModifiers {
  return {
    ...base,
    // 伤害倍率：+15% 表示 ×1.15
    damageMultiplier: base.damageMultiplier * (1 + pct(stats.damageBonus)),
    // 射速：消费端是「射击间隔」，间隔变小才是更快 → 取倒数
    fireRateMultiplier: base.fireRateMultiplier / (1 + pct(stats.fireRateBonus)),
    // 暴击率：百分数转成概率
    critChanceBonus: base.critChanceBonus + pct(stats.criticalChance),
    // 暴击伤害：+50% 表示 ×1.5
    critDamageMultiplier: base.critDamageMultiplier * (1 + pct(stats.criticalDamage)),
  };
}

/**
 * 计算护盾上限。
 *
 * `PlayerModifiers` 没有护盾上限字段（它只描述回复速率），所以护盾上限
 * 需要单独推给 `PlayerShip.setMaxShield`。
 *
 * @param baseMaxShield 护盾基线
 * @param stats 技能树聚合加成
 */
export function computeSkillMaxShield(baseMaxShield: number, stats: SkillTreeStats): number {
  return baseMaxShield * (1 + pct(stats.shieldBonus));
}
