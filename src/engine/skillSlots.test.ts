import { describe, expect, it } from 'vitest';
import {
  SKILL_SLOT_CONFIGS,
  SKILL_SLOT_COOLDOWNS,
  SKILL_SLOT_KEYS,
  SKILL_SLOT_ORDER,
  SkillType,
  type ImplementedSkillType,
} from './skillSlots';
import { defaultSkillsState } from '../store/useGameStore';

/**
 * 技能槽位真源的护栏。
 *
 * 这组断言守的是一个**真实发生过的缺陷**：技能 id 与冷却秒数曾经同时存在三套口径 ——
 * 触屏/HUD 传 snake_case 字符串（`'missile_strike'`，还配 `as SkillType` 强转绕开 TS），
 * 键盘传枚举，store 的冷却分母写死 8/10/15/20 而技能真值是 15/20/30/25。
 * 结果是「点 HUD 技能按钮，4 个里 3 个没反应，控制台一声不响」，且冷却环提前转完。
 *
 * 因此这里不测行为，只**锁死结构**：只要有人再往任一处手抄一份词表或数值，测试就红。
 */
describe('技能槽位真源（skillSlots）', () => {
  it('槽位顺序与槽位键一一对应，长度都是 4', () => {
    expect(SKILL_SLOT_ORDER.length).toBe(4);
    expect(SKILL_SLOT_KEYS.length).toBe(SKILL_SLOT_ORDER.length);
  });

  it('4 个槽位的技能 id 互不重复', () => {
    expect(new Set(SKILL_SLOT_ORDER).size).toBe(SKILL_SLOT_ORDER.length);
  });

  it('SKILL_SLOT_CONFIGS 的键恰好是那 4 个已实现技能，不多不少', () => {
    expect(new Set(Object.keys(SKILL_SLOT_CONFIGS))).toEqual(new Set(SKILL_SLOT_ORDER));
  });

  it('每条配置的 type 字段与它所在的键一致（防止整行错位）', () => {
    for (const type of SKILL_SLOT_ORDER) {
      expect(SKILL_SLOT_CONFIGS[type].type).toBe(type);
    }
  });

  it('冷却秒数由 skillSlots 派生，且与 store 默认值一致', () => {
    // 这条是那个缺陷的直接防线：store 曾写死 8/10/15/20，真值是 15/20/30/25。
    // 冷却环的分母（store）与技能自己的 config.cooldown 必须永远相等，
    // 否则玩家会看到"冷却转完了但按下去没反应"。
    expect(defaultSkillsState.maxCooldowns.skill1).toBe(
      SKILL_SLOT_CONFIGS[SkillType.MISSILE_STRIKE].cooldown,
    );
    expect(defaultSkillsState.maxCooldowns.skill2).toBe(
      SKILL_SLOT_CONFIGS[SkillType.SHIELD_BURST].cooldown,
    );
    expect(defaultSkillsState.maxCooldowns.skill3).toBe(
      SKILL_SLOT_CONFIGS[SkillType.TIME_SLOW].cooldown,
    );
    expect(defaultSkillsState.maxCooldowns.skill4).toBe(
      SKILL_SLOT_CONFIGS[SkillType.OVERDRIVE].cooldown,
    );
    expect(defaultSkillsState.maxCooldowns).toEqual(SKILL_SLOT_COOLDOWNS);
  });

  it('冷却与持续时间都是正数', () => {
    for (const type of SKILL_SLOT_ORDER) {
      const cfg = SKILL_SLOT_CONFIGS[type];
      expect(cfg.cooldown).toBeGreaterThan(0);
      expect(cfg.duration).toBeGreaterThan(0);
    }
  });

  it('每个槽位都有名称 / 图标 / 单字符快捷键，且快捷键互不重复', () => {
    const keys = new Set<string>();
    for (const type of SKILL_SLOT_ORDER) {
      const cfg = SKILL_SLOT_CONFIGS[type];
      expect(cfg.name.length).toBeGreaterThan(0);
      expect(cfg.icon.length).toBeGreaterThan(0);
      expect(cfg.keyBinding).toMatch(/^[A-Z]$/);
      keys.add(cfg.keyBinding);
    }
    expect(keys.size).toBe(SKILL_SLOT_ORDER.length);
  });

  it('枚举值是 camelCase（调用方写 snake_case 字符串时 TS 会拦下来）', () => {
    // 这个断言不是形式主义：缺陷的成因就是有人写了 `'missile_strike' as SkillType`。
    // 只要枚举值保持 camelCase，「字符串字面量能蒙混过关」就不可能再发生。
    for (const type of SKILL_SLOT_ORDER) {
      expect(type).toMatch(/^[a-z][a-zA-Z]*$/);
      expect(type).not.toContain('_');
    }
  });

  it('ImplementedSkillType 只覆盖已实现技能（EMP / 维修无人机不在槽位上）', () => {
    const implemented = new Set<SkillType>(SKILL_SLOT_ORDER as readonly SkillType[]);
    expect(implemented.has(SkillType.EMP_BURST)).toBe(false);
    expect(implemented.has(SkillType.REPAIR_DRONE)).toBe(false);
    // 供 TS 收窄，同时确保 ImplementedSkillType 与槽位顺序是同一个集合
    const narrowed: ImplementedSkillType[] = [...SKILL_SLOT_ORDER];
    expect(narrowed.length).toBe(4);
  });
});
