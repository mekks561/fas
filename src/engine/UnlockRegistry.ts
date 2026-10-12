/**
 * 通关解锁内容的**唯一真源**。
 *
 * ── 接线前的事实（又一次典型的「数据齐了、没有任何下游」） ──────────────
 *
 * 10 个关卡里逐条写着 `rewards.unlocks`（`ship-fighter` / `skill-missile-strike` …），
 * 而全项目唯一的读取方式是 GameScene 结算时的一句 `console.log`：把数组 `join('/')`
 * 打出来。它不改任何状态，也不存在任何判定函数 —— 玩家通关后什么也没发生。
 *
 * 更糟的是三处「看起来能拦、其实都没拦」的地方，各自独立地把解锁架空了：
 *
 * | 解锁类别 | 表面上的消费方 | 真相 |
 * |---|---|---|
 * | `skill-*` | `SkillSystem` 构造 | 无条件注册 4 个技能，`activateSkill` 从不问解锁 |
 * | `ship-*`  | `PlayerShip` 的 `config.shipModel` | **全仓零调用方传这个字段**，永远回落 `'fighter'` |
 * | 商店门槛 | 商店卡片的「要求等级: N」 | 只是渲染 `item.level`，`handlePurchase` 里没有任何校验 |
 *
 * 还有一条悬空数据：`level-10` 的 `achievement-master` 在成就表里不存在
 * （成就是 `skill_master` / `mission_master` / `legendary_pilot`…）。而
 * `StoryMissionManager.ChapterRewards` 把 `unlocks: string[]` 与 `achievement?: string`
 * 写成**两个字段**，说明 `unlocks` 本就不该放成就 id。
 *
 * ── 现在的口径 ────────────────────────────────────────────────────
 *
 * 1. **一个词表**：解锁 id 全部登记在此（6 舰体 + 4 技能 = 与 10 关一一对应）；
 * 2. **一个派生**：「已授予」集合由 `LevelProgress` 的**通关记录**现算，而不是
 *    靠「通关那一刻发一次」的事件。好处是天然幂等：清完第 5 关后，无论何时读
 *    （换设备重开、清缓存后重打、老存档直接打开）都得到同一组解锁，不会漏发；
 * 3. **三类真消费方**：技能门控（`SkillSystem`）、舰体可选（机库面板 + `PlayerShip`）、
 *    商店货架门槛（`ShopPanel` 用真解锁替掉假的 `level` 显示）；
 * 4. **护栏**：`getUnlockRegistryErrors()` —— 关卡数据里出现的 id 必须全部登记，
 *    登记过的 id 也必须真的有某一关授予它（这条会直接把悬空 id 钉死在单测里）。
 *
 * ── 舰体为什么只是「外观 + 进度」，不带属性 ──────────────────────────
 *
 * 商店已经在卖「舰体 + 属性」的东西（`shop-item-01/02/03` 分别是重型巡洋舰 / 隐形战机 /
 * 无畏舰，各带一套生命/护盾/速度/伤害加成），那条链路是通的（`OwnedItems` →
 * `MetaBonuses` → 每局开局合并）。若舰体再自带一套属性，同一件事就有了两个真源，
 * 而且名字还重（巡洋舰 / 隐形战机 / 无畏舰）——「我买的那艘巡洋舰」和「我开的那艘巡洋舰」
 * 会变成两个不同的东西。
 *
 * 所以这里划清：**属性归商店，外观与解锁进度归本模块**。反过来，买了商店的船也
 * 顺带解锁对应外观（`HULL_BY_SHOP_SUBTYPE`），避免「买了一艘船却还开着初始机」。
 * 若将来要给舰体加属性，唯一入口是本文件的 `HULL_DEFS`。
 *
 * ── 依赖纪律 ──────────────────────────────────────────────────────
 *
 * 只 import 纯数据 / 零依赖叶子：`skillSlots`（零依赖）、`LevelProgress`（只碰
 * localStorage）、`OwnedItems`（同上）、`../levels`（关卡配置**零 import**，纯字面量）。
 * 绝不 import 引擎实现，否则本模块会把 PlayCanvas / wasmoon 拖进 zustand store 与 Node 单测。
 */

import { getLevelProgress, type LevelProgressMap } from './LevelProgress';
import { getOwnedItems } from './OwnedItems';
import {
  SKILL_SLOT_CONFIGS,
  SKILL_SLOT_ORDER,
  SkillType,
  type ImplementedSkillType,
} from './skillSlots';
import { getAllLevels } from '../levels';

/** 舰体 id。**必须与 `ProceduralModelGenerator.ShipModelType` 同词表** ——
 * 那个类型所在模块 import 了 PlayCanvas，不能在这里**运行时**引用，
 * 所以改用 `import type`（编译后被完全擦除，不会产生任何运行时依赖）
 * 在文件末尾做一次双向编译期断言，两边的词表一旦漂移就直接编译不过。
 */
export type HullId = 'fighter' | 'bomber' | 'cruiser' | 'stealth' | 'corvette' | 'dreadnought';

export type UnlockKind = 'hull' | 'skill';

export interface HullDef {
  id: HullId;
  /** 显示名（机库面板）。 */
  name: string;
  /** 一句话介绍。 */
  description: string;
  /** 初始舰体：无需任何通关记录即可使用（否则新玩家无船可开）。 */
  starter: boolean;
}

export const HULL_DEFS: Record<HullId, HullDef> = {
  fighter: {
    id: 'fighter',
    name: '标准战机',
    description: '均衡的初始舰体，各项表现中规中矩。',
    starter: true,
  },
  bomber: {
    id: 'bomber',
    name: '轰炸机',
    description: '厚重的突击舰体，轮廓低矮，像是为正面推进造的。',
    starter: false,
  },
  cruiser: {
    id: 'cruiser',
    name: '重型巡洋舰',
    description: '体量明显更大的正面战舰。',
    starter: false,
  },
  stealth: {
    id: 'stealth',
    name: '隐形战机',
    description: '线条锋利的轻型机，为潜行与高速掠过而造。',
    starter: false,
  },
  corvette: {
    id: 'corvette',
    name: '护卫舰',
    description: '紧凑灵活的快速舰体。',
    starter: false,
  },
  dreadnought: {
    id: 'dreadnought',
    name: '无畏舰',
    description: '联邦最强的旗舰舰体，整个战役的终点奖励。',
    starter: false,
  },
};

/** 机库面板的展示顺序（初始舰体排最前）。 */
export const HULL_ORDER: readonly HullId[] = [
  'fighter',
  'bomber',
  'cruiser',
  'stealth',
  'corvette',
  'dreadnought',
];

/**
 * 解锁 id → 舰体。**键要与关卡数据里的 `ship-*` 逐字一致**，
 * 拼错不会有编译错误 —— 所以 `getUnlockRegistryErrors()` 会把它抓出来。
 */
export const HULL_UNLOCK_IDS: Record<string, HullId> = {
  'ship-fighter': 'fighter',
  'ship-bomber': 'bomber',
  'ship-cruiser': 'cruiser',
  'ship-stealth': 'stealth',
  'ship-corvette': 'corvette',
  'ship-dreadnought': 'dreadnought',
};

/** 解锁 id → 技能。**键要与关卡数据里的 `skill-*` 逐字一致**。 */
export const SKILL_UNLOCK_IDS: Record<string, ImplementedSkillType> = {
  'skill-missile-strike': SkillType.MISSILE_STRIKE,
  'skill-shield-burst': SkillType.SHIELD_BURST,
  'skill-time-slow': SkillType.TIME_SLOW,
  'skill-overdrive': SkillType.OVERDRIVE,
};

/**
 * 商店 `type: 'ship'` 物品的 `subtype` → 舰体。
 * 买下商店的船也解锁对应外观，避免「买了巡洋舰却还开着初始机」。
 * 未登记的子类型视为「没有对应外观」，不影响属性加成那条链路。
 */
export const HULL_BY_SHOP_SUBTYPE: Record<string, HullId> = {
  fighter: 'fighter',
  bomber: 'bomber',
  cruiser: 'cruiser',
  stealth: 'stealth',
  corvette: 'corvette',
  dreadnought: 'dreadnought',
};

export interface UnlockDef {
  id: string;
  kind: UnlockKind;
  /** 解锁内容的人类可读名（与 HULL_DEFS / SKILL_SLOT_CONFIGS 同源，不另抄一份）。 */
  name: string;
}

/** 全量词表：解锁 id → 类别 + 显示名。合并自上面两张目标表。 */
export const UNLOCK_DEFS: Record<string, UnlockDef> = (() => {
  const defs: Record<string, UnlockDef> = {};
  for (const [id, hull] of Object.entries(HULL_UNLOCK_IDS)) {
    defs[id] = { id, kind: 'hull', name: HULL_DEFS[hull].name };
  }
  for (const [id, skill] of Object.entries(SKILL_UNLOCK_IDS)) {
    defs[id] = { id, kind: 'skill', name: SKILL_SLOT_CONFIGS[skill].name };
  }
  return defs;
})();

/**
 * 解锁 id → 授予它的关卡（1 基）。**由 `src/levels` 派生，不手抄第二份**。
 * 同一个 id 若被多关授予，取**最早**的那一关（先到先解锁）。
 */
export const UNLOCK_ORIGIN: Readonly<Record<string, number>> = (() => {
  const origin: Record<string, number> = {};
  getAllLevels().forEach((level, index) => {
    for (const id of level.rewards.unlocks) {
      if (!(id in origin)) origin[id] = index + 1;
    }
  });
  return origin;
})();

/** 某关（1 基）授予的解锁 id。 */
export function getUnlocksForLevel(levelId: number): string[] {
  const level = getAllLevels()[levelId - 1];
  return level ? [...level.rewards.unlocks] : [];
}

/** 授予某解锁 id 的关卡（1 基）；未登记返回 0。 */
export function getUnlockLevel(unlockId: string): number {
  return UNLOCK_ORIGIN[unlockId] ?? 0;
}

/** 人类可读的解锁内容名；未登记返回 id 本身（不猜）。 */
export function getUnlockName(unlockId: string): string {
  return UNLOCK_DEFS[unlockId]?.name ?? unlockId;
}

export interface UnlockSnapshot {
  /** 已授予的解锁 id 集合。 */
  granted: ReadonlySet<string>;
  /** 已解锁的舰体，按 `HULL_ORDER` 排序。 */
  hulls: HullId[];
  /** 已解锁的技能，按 `SKILL_SLOT_ORDER` 排序。 */
  skills: ImplementedSkillType[];
  /** 尚未解锁的条目（含授予关卡），用于「通关第 N 关解锁」提示。 */
  pending: Array<{ id: string; level: number; name: string; kind: UnlockKind }>;
}

/**
 * 已授予的解锁 id。
 *
 * 派生自**通关记录**而非「通关事件」，因此幂等、可补发：
 * 清完第 5 关之后任何时候读都得到 `ship-cruiser`，包括清缓存重打、换浏览器、
 * 以及本功能上线前就已经通关的老存档。
 *
 * @param progress 关卡进度；缺省读 localStorage（测试可注入）
 * @param ownedShipSubtypes 已购商店船的 subtype；缺省读 OwnedItems
 */
export function getGrantedUnlockIds(
  progress: LevelProgressMap = getLevelProgress(),
  ownedShipSubtypes?: readonly string[],
): Set<string> {
  const granted = new Set<string>();

  // ① 关卡奖励：该关已通关则其 unlocks 全部授予
  for (const [unlockId, levelId] of Object.entries(UNLOCK_ORIGIN)) {
    if (progress[String(levelId)]?.cleared) granted.add(unlockId);
  }

  // ② 初始舰体无条件可用 —— 否则全新存档没有任何舰体
  for (const [unlockId, hull] of Object.entries(HULL_UNLOCK_IDS)) {
    if (HULL_DEFS[hull].starter) granted.add(unlockId);
  }

  // ③ 商店买到的舰体（属性链路在 MetaBonuses，这里只认外观）
  const subtypes =
    ownedShipSubtypes ??
    getOwnedItems()
      .filter((item) => item.type === 'ship' && item.subtype)
      .map((item) => item.subtype as string);
  for (const subtype of subtypes) {
    const hull = HULL_BY_SHOP_SUBTYPE[subtype];
    if (hull) granted.add(hullUnlockId(hull));
  }

  return granted;
}

/** 舰体 → 它的解锁 id（每艘船恰好一个，`getUnlockRegistryErrors` 会校验）。 */
export function hullUnlockId(hull: HullId): string {
  const entry = Object.entries(HULL_UNLOCK_IDS).find(([, h]) => h === hull);
  return entry ? entry[0] : '';
}

/** 技能 → 它的解锁 id；未登记返回空串。 */
export function skillUnlockId(type: SkillType): string {
  const entry = Object.entries(SKILL_UNLOCK_IDS).find(([, s]) => s === type);
  return entry ? entry[0] : '';
}

/**
 * 一次性读出 UI 需要的全部解锁信息。
 * 面板每帧/每次渲染只读一次 localStorage，而不是每艘船、每个技能各读一遍。
 */
export function getUnlockSnapshot(
  progress: LevelProgressMap = getLevelProgress(),
  ownedShipSubtypes?: readonly string[],
): UnlockSnapshot {
  const granted = getGrantedUnlockIds(progress, ownedShipSubtypes);

  const hulls = HULL_ORDER.filter((hull) => granted.has(hullUnlockId(hull)));
  const skills = SKILL_SLOT_ORDER.filter((type) => granted.has(skillUnlockId(type)));

  const pending = Object.keys(UNLOCK_DEFS)
    .filter((id) => !granted.has(id))
    .map((id) => ({
      id,
      level: getUnlockLevel(id),
      name: UNLOCK_DEFS[id].name,
      kind: UNLOCK_DEFS[id].kind,
    }))
    .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));

  return { granted, hulls, skills, pending };
}

/** 某解锁 id 是否已授予。 */
export function isUnlocked(unlockId: string, granted?: ReadonlySet<string>): boolean {
  return (granted ?? getGrantedUnlockIds()).has(unlockId);
}

/** 某技能是否已解锁（`SkillSystem` 的技能门控入口）。 */
export function isSkillUnlocked(type: SkillType, granted?: ReadonlySet<string>): boolean {
  const id = skillUnlockId(type);
  // 没有登记解锁 id 的技能（如尚未实现的 EMP_BURST）不参与门控 —— 视为可用，
  // 免得将来新增技能时忘了登记就永远打不开。
  if (!id) return true;
  return isUnlocked(id, granted);
}

/** 某舰体是否可用。 */
export function isHullAvailable(hull: HullId, granted?: ReadonlySet<string>): boolean {
  return isUnlocked(hullUnlockId(hull), granted);
}

/**
 * 注册表自检：返回发现的问题清单（空数组 = 健康）。
 *
 * 沿用 `OwnedItems.getOwnedItemsStorageIssues()` / `luaSources.getLuaSourceRegistryErrors()`
 * 的思路 —— 真源模块自带护栏，单测里断言为空。它会抓到：
 * 关卡写了没登记的 id（悬空奖励，就是 `achievement-master` 那一类）、
 * 登记了但没有任何关卡授予（永远拿不到）、
 * 一个目标配了多个/零个解锁 id、以及键名拼写漂移。
 */
export function getUnlockRegistryErrors(): string[] {
  const issues: string[] = [];

  const declared = new Set([...Object.keys(HULL_UNLOCK_IDS), ...Object.keys(SKILL_UNLOCK_IDS)]);

  const inLevels = new Set<string>();
  getAllLevels().forEach((level) => {
    for (const id of level.rewards.unlocks) inLevels.add(id);
  });

  for (const id of inLevels) {
    if (!declared.has(id))
      issues.push(`关卡奖励里的解锁 id "${id}" 未在 UnlockRegistry 登记（悬空奖励）`);
  }
  for (const id of declared) {
    if (!inLevels.has(id))
      issues.push(`解锁 id "${id}" 已登记，但没有任何关卡授予它（永远拿不到）`);
  }

  // 同一 id 不能同时映射到舰体与技能
  for (const id of Object.keys(HULL_UNLOCK_IDS)) {
    if (id in SKILL_UNLOCK_IDS) issues.push(`解锁 id "${id}" 同时映射到了舰体与技能`);
  }

  // id 前缀与目标类别必须一致（防把 skill-* 写进 HULL_UNLOCK_IDS）
  for (const id of Object.keys(HULL_UNLOCK_IDS)) {
    if (!id.startsWith('ship-')) issues.push(`舰体解锁 id "${id}" 前缀不是 ship-`);
  }
  for (const id of Object.keys(SKILL_UNLOCK_IDS)) {
    if (!id.startsWith('skill-')) issues.push(`技能解锁 id "${id}" 前缀不是 skill-`);
  }

  // 每个舰体 / 技能恰好一个解锁 id
  for (const hull of HULL_ORDER) {
    const count = Object.values(HULL_UNLOCK_IDS).filter((h) => h === hull).length;
    if (count === 0) issues.push(`舰体 "${hull}" 没有对应的解锁 id`);
    if (count > 1) issues.push(`舰体 "${hull}" 对应了 ${count} 个解锁 id`);
  }
  for (const skill of SKILL_SLOT_ORDER) {
    const count = Object.values(SKILL_UNLOCK_IDS).filter((s) => s === skill).length;
    if (count === 0) issues.push(`技能 "${SKILL_SLOT_CONFIGS[skill].name}" 没有对应的解锁 id`);
    if (count > 1)
      issues.push(`技能 "${SKILL_SLOT_CONFIGS[skill].name}" 对应了 ${count} 个解锁 id`);
  }

  // 恰好一艘初始舰体
  const starters = HULL_ORDER.filter((hull) => HULL_DEFS[hull].starter);
  if (starters.length !== 1) {
    issues.push(
      `初始舰体应当恰好 1 艘，实际 ${starters.length} 艘（${starters.join('/') || '无'}）`,
    );
  }

  return issues;
}

// ───────────────────────── 编译期护栏 ─────────────────────────
//
// `HullId` 与引擎的 `ShipModelType` 是同一套词表（fighter/bomber/cruiser/stealth/
// corvette/dreadnought），但分处两个模块 —— 引擎那份 import 了 PlayCanvas，本模块
// 不能引入它（见文件头「依赖纪律」）。
//
// 用 `import type` 做双向断言：type-only import 编译后被完全擦除，不产生运行时依赖，
// 但两边的词表一旦漂移（谁加了一艘船、谁改了个名字），这里就会直接**编译不过**。
// 这比在 e2e 里断言「GLB 文件存在」更早暴露问题（那是资源层，这是词表层，两者互补）。

import type { ShipModelType } from './ProceduralModelGenerator';

type AssertTrue<T extends true> = T;
/** HullId ⊆ ShipModelType */
export type HullIdIsSubsetOfShipModelType = AssertTrue<HullId extends ShipModelType ? true : false>;
/** ShipModelType ⊆ HullId */
export type ShipModelTypeIsSubsetOfHullId = AssertTrue<ShipModelType extends HullId ? true : false>;
