/**
 * 技能槽位唯一真源（零依赖叶子，不得 import 任何东西）。
 *
 * 为什么单独成文件：这套「槽位顺序 / 技能 id / 冷却秒数」原先散在三处，
 * 而三处口径**互不相同**，导致一个从来没人发现过的静默失效：
 *
 *   ① `SkillSystem.ts` 的技能枚举值 = camelCase（`missileStrike` / `shieldBurst` / `timeSlow`）
 *   ② `GameScene.tsx` 的触屏按钮与 HUD 槽位表 = snake_case 字符串（`missile_strike` …），
 *      并用 `as SkillType` 强转**绕过类型检查** → `skills.get()` 恒 miss、返回 false，
 *      4 个技能里有 3 个点了没反应（键盘路径写的是枚举，所以只有点按钮/触屏的人中招）。
 *   ③ `useGameStore.ts` 的 `maxCooldowns` = 8/10/15/20，而技能真实冷却 = 15/20/30/25
 *      → HUD 冷却环提前转完，玩家以为好了，按下去还是没反应。
 *
 * 这三处只要有一处单独改，就会再次错开。**要改冷却 / 顺序 / 名称 / 图标，只改这个文件。**
 *
 * 与 `src/engine/arena.ts` 同一套做法：真源必须是零依赖叶子，不能留在 `SkillSystem.ts`
 * —— 那会把 PlayCanvas 拖进 zustand store 与 Node 单测（后者连 wasmoon 都会炸）。
 * 本文件只依赖 TS 语法，浏览器 / Node / 构建期三边都能安全 import。
 */

/** 技能 id 词表。**唯一真源** —— 调用方一律用枚举成员，禁止再写字符串字面量 + `as SkillType`。 */
export enum SkillType {
  MISSILE_STRIKE = 'missileStrike',
  SHIELD_BURST = 'shieldBurst',
  TIME_SLOW = 'timeSlow',
  EMP_BURST = 'empBurst',
  REPAIR_DRONE = 'repairDrone',
  OVERDRIVE = 'overdrive',
}

export interface SkillConfig {
  type: SkillType;
  name: string;
  description: string;
  cooldown: number;
  duration: number;
  icon: string;
  keyBinding: string;
}

export interface SkillState {
  isActive: boolean;
  cooldownRemaining: number;
  durationRemaining: number;
  level: number;
  maxLevel: number;
}

/**
 * 槽位顺序 = 键盘 `Q / E / T / G` = HUD 技能条从左到右 = store 的 `skill1..skill4`。
 * 这三个「同一个顺序」此前是各写各的，现在只有一个来源。
 */
export const SKILL_SLOT_ORDER = [
  SkillType.MISSILE_STRIKE,
  SkillType.SHIELD_BURST,
  SkillType.TIME_SLOW,
  SkillType.OVERDRIVE,
] as const;

/** 已实现的技能 id（`EMP_BURST` / `REPAIR_DRONE` 有枚举值但还没有技能类）。 */
export type ImplementedSkillType = (typeof SKILL_SLOT_ORDER)[number];

/** store 里 4 个槽位的键，顺序与 `SKILL_SLOT_ORDER` 一一对应。 */
export const SKILL_SLOT_KEYS = ['skill1', 'skill2', 'skill3', 'skill4'] as const;

export type SkillSlotKey = (typeof SKILL_SLOT_KEYS)[number];

/**
 * 四个技能的全部数值与文案。技能类的构造函数、HUD 的冷却环、store 的冷却上限
 * 全部从这里取 —— 改冷却只改这一处，三边自动一致。
 *
 * 类型写成 `Record<ImplementedSkillType, SkillConfig>`：键必须恰好是那 4 个已实现的
 * 技能，少一个、多一个、写错大小写都是编译错误（`config.type` 与键不符也会被抓到，
 * 见 `skillSlots.test.ts`）。
 */
export const SKILL_SLOT_CONFIGS: Record<ImplementedSkillType, SkillConfig> = {
  [SkillType.MISSILE_STRIKE]: {
    type: SkillType.MISSILE_STRIKE,
    name: '导弹打击',
    description: '发射多枚导弹攻击前方敌人',
    cooldown: 15,
    duration: 2,
    icon: 'missile',
    keyBinding: 'Q',
  },
  [SkillType.SHIELD_BURST]: {
    type: SkillType.SHIELD_BURST,
    name: '护盾爆发',
    description: '瞬间恢复护盾并释放冲击波',
    cooldown: 20,
    duration: 0.5,
    icon: 'shield',
    keyBinding: 'E',
  },
  [SkillType.TIME_SLOW]: {
    type: SkillType.TIME_SLOW,
    name: '时间减缓',
    description: '减缓所有敌人的移动和攻击速度',
    cooldown: 30,
    duration: 5,
    icon: 'time',
    keyBinding: 'T',
  },
  [SkillType.OVERDRIVE]: {
    type: SkillType.OVERDRIVE,
    name: '过载驱动',
    description: '大幅提升移动速度和武器射速',
    cooldown: 25,
    duration: 4,
    icon: 'overdrive',
    keyBinding: 'G',
  },
};

/** store `skills.maxCooldowns` 的初值：由真源派生，杜绝再手写一份 8/10/15/20。 */
export const SKILL_SLOT_COOLDOWNS: Record<SkillSlotKey, number> = {
  skill1: SKILL_SLOT_CONFIGS[SkillType.MISSILE_STRIKE].cooldown,
  skill2: SKILL_SLOT_CONFIGS[SkillType.SHIELD_BURST].cooldown,
  skill3: SKILL_SLOT_CONFIGS[SkillType.TIME_SLOW].cooldown,
  skill4: SKILL_SLOT_CONFIGS[SkillType.OVERDRIVE].cooldown,
};
