/**
 * 已购物品（商店购买结果）的唯一真源。
 *
 * 背景：ShopPanel 原本自己读写 localStorage 的 `purchasedItems`，而**该字段的唯一
 * 读取方就是 ShopPanel 自己**（只够把按钮变成「已购买 ✓」）。于是整条消费链是断的：
 * 花了 15000 信用点买下重型巡洋舰，下一局什么也不会发生。
 *
 * 本模块补齐「有下游读取方」的存储：
 * - **写入侧**：ShopPanel 购买成功 → `grantOwnedItem(快照)`（与 `spendCredits` 同一条流程）
 * - **读取侧**：GameScene 开局 → `computeMetaBonuses(getOwnedItems())` → 合并进
 *   `PlayerShip` / `WeaponSystem` 的修饰符（见 `MetaBonuses.ts`）
 *
 * 为什么存**属性快照**而不是只存 id：
 * 1. 加成换算发生在每局开局，若只存 id 就得在游戏里 fetch `/assets/shop/*.json`，
 *    把网络请求塞进开局路径；快照让读取是同步的。
 * 2. 快照 = 「你当初买的是什么」，之后策划改商店数值不会追溯篡改已有存档。
 *
 * 存储选型与 `CreditsStore` / `LevelProgress` 一致：localStorage（本机），清缓存会丢。
 */

const OWNED_KEY = 'ownedItems';

/**
 * 旧 key。此前的 ShopPanel 只写它、没有任何下游读取方。
 * 首次读取时做一次性迁移（只迁 id，属性未知 → 标记为 `unknown` 类型，
 * 不参与加成换算，避免凭空给老存档发属性）。迁移完成后删除旧 key，
 * 保证「已购物品」只有一个存储真源。
 */
const LEGACY_KEY = 'purchasedItems';

/** 物品类型。`unknown` 只可能来自旧存档迁移。 */
export type OwnedItemType = 'ship' | 'weapon' | 'consumable' | 'cosmetic' | 'upgrade' | 'unknown';

/** 商店物品的属性快照（值域同时含数值、字符串与布尔，见 shop-item-*.json）。 */
export type ItemAttributes = Record<string, number | string | boolean>;

export interface OwnedItemRecord {
  /** 商店物品 id（`shop-item-NN`）。 */
  id: string;
  /** 显示名，供 UI / 日志使用。 */
  name: string;
  type: OwnedItemType;
  subtype?: string;
  price: number;
  /** 购买时的属性快照。加成换算只认它，不再回读 JSON。 */
  attributes?: ItemAttributes;
  /** 购买时间戳（ms）。 */
  purchasedAt: number;
}

/** 购买时要落库的字段（时间戳由本模块生成）。 */
export type OwnedItemInput = Omit<OwnedItemRecord, 'purchasedAt'> & { purchasedAt?: number };

const asType = (value: unknown): OwnedItemType => {
  switch (value) {
    case 'ship':
    case 'weapon':
    case 'consumable':
    case 'cosmetic':
    case 'upgrade':
      return value;
    default:
      return 'unknown';
  }
};

const normalizeRecord = (raw: unknown): OwnedItemRecord | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<OwnedItemRecord>;
  if (typeof r.id !== 'string' || r.id.length === 0) return null;
  const attributes =
    r.attributes && typeof r.attributes === 'object' ? (r.attributes as ItemAttributes) : undefined;
  return {
    id: r.id,
    name: typeof r.name === 'string' && r.name ? r.name : r.id,
    type: asType(r.type),
    subtype: typeof r.subtype === 'string' ? r.subtype : undefined,
    price: typeof r.price === 'number' && Number.isFinite(r.price) ? r.price : 0,
    attributes,
    purchasedAt: typeof r.purchasedAt === 'number' && r.purchasedAt > 0 ? r.purchasedAt : 0,
  };
};

/**
 * 把旧 `purchasedItems`（纯 id 数组）迁进新 key。
 * @returns 是否发生了迁移
 */
function migrateLegacy(): boolean {
  let legacyRaw: string | null = null;
  try {
    legacyRaw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return false;
  }
  if (legacyRaw === null) return false;

  let ids: unknown = null;
  try {
    ids = JSON.parse(legacyRaw);
  } catch {
    ids = null;
  }

  const records: OwnedItemRecord[] = Array.isArray(ids)
    ? ids
        .map((id) => normalizeRecord({ id, type: 'unknown' }))
        .filter((r): r is OwnedItemRecord => r !== null)
    : [];

  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify(records));
    // 迁移完成即删旧 key：留着它就是第二个（永远不更新的）真源
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* 隐私模式下写入会抛：迁移失败不算致命，下一次读取会再试 */
  }
  return true;
}

/** 读取已购物品（幂等；首次调用会顺带完成旧 key 迁移）。 */
export function getOwnedItems(): OwnedItemRecord[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(OWNED_KEY);
  } catch {
    return [];
  }
  if (raw === null && migrateLegacy()) {
    try {
      raw = localStorage.getItem(OWNED_KEY);
    } catch {
      return [];
    }
  }
  if (raw === null) return [];

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeRecord).filter((r): r is OwnedItemRecord => r !== null);
}

/** 已购物品 id 列表。 */
export function getOwnedItemIds(): string[] {
  return getOwnedItems().map((i) => i.id);
}

/** 是否已拥有某物品。 */
export function isItemOwned(id: string): boolean {
  return getOwnedItems().some((i) => i.id === id);
}

/**
 * 记录一次购买（幂等：同一 id 重复调用不会产生第二条记录）。
 * @returns 写入后的完整列表
 */
export function grantOwnedItem(input: OwnedItemInput): OwnedItemRecord[] {
  const record: OwnedItemRecord = {
    id: input.id,
    name: input.name || input.id,
    type: asType(input.type),
    subtype: input.subtype,
    price: input.price,
    attributes: input.attributes,
    purchasedAt: input.purchasedAt ?? Date.now(),
  };
  const next = getOwnedItems().filter((i) => i.id !== record.id);
  next.push(record);
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify(next));
  } catch {
    /* 写不进去也不该打断购买流程：UI 状态仍会更新，只是本机不持久化 */
  }
  return next;
}

/** 清空已购物品（验证脚本与「重置存档」使用）。 */
export function clearOwnedItems(): void {
  try {
    localStorage.removeItem(OWNED_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 存储自检：返回发现的问题清单（空数组 = 健康）。
 *
 * 沿用 `luaSources.getLuaSourceRegistryErrors()` 的思路 —— 真源模块自带护栏，
 * 单测里断言它为空，防止「旧 key 复活」或「记录缺属性快照」这类问题悄悄回来。
 */
export function getOwnedItemsStorageIssues(): string[] {
  const issues: string[] = [];
  let owned: string | null = null;
  let legacy: string | null = null;
  try {
    owned = localStorage.getItem(OWNED_KEY);
    legacy = localStorage.getItem(LEGACY_KEY);
  } catch {
    return ['localStorage 不可读（隐私模式？）'];
  }

  if (owned === null) {
    if (legacy !== null) issues.push(`新 key 缺失但旧 key ${LEGACY_KEY} 还在：迁移未生效`);
    return issues;
  }
  if (legacy !== null) {
    issues.push(`旧 key ${LEGACY_KEY} 仍存在：已购物品出现了第二个真源`);
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(owned);
  } catch {
    return [...issues, `${OWNED_KEY} 不是合法 JSON`];
  }
  if (!Array.isArray(parsed)) return [...issues, `${OWNED_KEY} 不是数组`];
  parsed.forEach((raw, index) => {
    const r = normalizeRecord(raw);
    if (!r) {
      issues.push(`第 ${index} 条记录缺少 id`);
      return;
    }
    if (r.type === 'unknown') {
      // 迁移来的旧记录没有快照，属已知情况，不算问题
      return;
    }
    if (!r.attributes || Object.keys(r.attributes).length === 0) {
      issues.push(`${r.id} 缺少属性快照（加成无法换算）`);
    }
  });
  return issues;
}
