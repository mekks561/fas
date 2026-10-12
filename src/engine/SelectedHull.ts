/**
 * 当前选中的舰体（机库选择结果的唯一真源）。
 *
 * 为什么需要这个模块：`PlayerShip` 一直有 `config.shipModel` 参数，`ModelAssetProvider`
 * 也从 `public/assets/models/ships/` 加载 6 个真实 GLB —— 但**全仓没有任何调用方传这个字段**，
 * 于是永远走 `|| 'fighter'`。舰体系统整个是休眠的，玩家从头到尾开同一艘船，
 * 而关卡奖励里的 `ship-bomber` / `ship-cruiser` / `ship-stealth` / `ship-corvette`
 * 也就没有任何可落地的意义。
 *
 * 本模块补上「玩家选哪艘」，并做两件事：
 *   ① 持久化（localStorage，与 CreditsStore / LevelProgress / OwnedItems 同一选型）；
 *   ② **可用性回落**：存档里的舰体若当前不可用（例如清档重打、或进度被重置），
 *      读取时回落到初始舰体。否则会出现「开着根本没解锁的船」这种脏状态。
 */

import {
  HULL_DEFS,
  HULL_ORDER,
  getGrantedUnlockIds,
  hullUnlockId,
  isHullAvailable,
  type HullId,
} from './UnlockRegistry';

const HULL_KEY = 'selectedHull';

/** 初始舰体 id（`HULL_DEFS` 里有且只有一艘 `starter`，单测锁死）。 */
export const DEFAULT_HULL_ID: HullId = 'fighter';

/** 是否是合法舰体 id。 */
export function isHullId(value: unknown): value is HullId {
  return typeof value === 'string' && (HULL_ORDER as readonly string[]).includes(value);
}

/**
 * 当前选中的舰体。
 *
 * 未设置、值非法、或该舰体当前**不可用**时，一律回落 `DEFAULT_HULL_ID`。
 * 第三种情况是重点：存档是玩家可改可清的，不能拿它当可信输入。
 *
 * @param granted 已授予的解锁集合；缺省现算（测试可注入）
 */
export function getSelectedHull(granted?: ReadonlySet<string>): HullId {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(HULL_KEY);
  } catch {
    return DEFAULT_HULL_ID;
  }
  if (!isHullId(raw)) return DEFAULT_HULL_ID;
  if (!isHullAvailable(raw, granted ?? getGrantedUnlockIds())) return DEFAULT_HULL_ID;
  return raw;
}

/**
 * 选中一艘舰体。**不可用的舰体会被拒绝**（返回实际生效的舰体），
 * 而不是先写进去再由读取侧救回来 —— 写入口也应当拦。
 */
export function setSelectedHull(hull: HullId, granted?: ReadonlySet<string>): HullId {
  const effective = isHullAvailable(hull, granted ?? getGrantedUnlockIds())
    ? hull
    : DEFAULT_HULL_ID;
  try {
    localStorage.setItem(HULL_KEY, effective);
  } catch {
    /* 隐私模式写不进：UI 仍会更新，只是本机不持久化 */
  }
  return effective;
}

/** 清空选择（验证脚本与「重置存档」使用）。 */
export function clearSelectedHull(): void {
  try {
    localStorage.removeItem(HULL_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 存储自检（空数组 = 健康）。
 *
 * 沿用 `OwnedItems.getOwnedItemsStorageIssues()` 的做法：真源模块自带护栏。
 * 这里能抓到「存档里写了个不存在的舰体 id」与「写了个当前不可用的舰体」——
 * 前者是数据损坏，后者是逻辑漏判（说明某处绕过了 `setSelectedHull` 的校验）。
 */
export function getSelectedHullStorageIssues(granted?: ReadonlySet<string>): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(HULL_KEY);
  } catch {
    return ['localStorage 不可读（隐私模式？）'];
  }
  if (raw === null) return [];
  if (!isHullId(raw)) {
    return [`${HULL_KEY} 存的是未知舰体 id "${raw}"（合法值：${HULL_ORDER.join('/')}）`];
  }
  const set = granted ?? getGrantedUnlockIds();
  if (!set.has(hullUnlockId(raw))) {
    return [
      `${HULL_KEY} 存的舰体 "${HULL_DEFS[raw].name}" 当前不可用` +
        `（解锁 id ${hullUnlockId(raw)} 未授予）—— 应当经 setSelectedHull 写入`,
    ];
  }
  return [];
}
