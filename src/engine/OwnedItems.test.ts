import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearOwnedItems,
  getOwnedItemIds,
  getOwnedItems,
  getOwnedItemsStorageIssues,
  grantOwnedItem,
  isItemOwned,
} from './OwnedItems';

const cruiser = {
  id: 'shop-item-01',
  name: '重型巡洋舰',
  type: 'ship' as const,
  subtype: 'cruiser',
  price: 15000,
  attributes: { health: 200, shield: 100, speed: 50, damage: 30, weaponSlots: 4 },
};

describe('OwnedItems 已购物品真源', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('初始为空', () => {
    expect(getOwnedItems()).toEqual([]);
    expect(getOwnedItemIds()).toEqual([]);
    expect(isItemOwned('shop-item-01')).toBe(false);
  });

  it('grantOwnedItem 写入后可读回（含属性快照）', () => {
    grantOwnedItem(cruiser);
    const items = getOwnedItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('shop-item-01');
    expect(items[0].type).toBe('ship');
    expect(items[0].attributes).toEqual(cruiser.attributes);
    expect(items[0].purchasedAt).toBeGreaterThan(0);
    expect(isItemOwned('shop-item-01')).toBe(true);
  });

  it('幂等：同一 id 重复购买不会产生第二条记录', () => {
    grantOwnedItem(cruiser);
    grantOwnedItem(cruiser);
    grantOwnedItem(cruiser);
    expect(getOwnedItemIds()).toEqual(['shop-item-01']);
  });

  it('购买顺序无关，读取按写入顺序返回', () => {
    grantOwnedItem(cruiser);
    grantOwnedItem({
      ...cruiser,
      id: 'shop-item-17',
      name: '伤害强化模块',
      type: 'upgrade',
      attributes: { damageBonus: 0.1 },
    });
    expect(getOwnedItemIds()).toEqual(['shop-item-01', 'shop-item-17']);
  });

  it('存储损坏（非 JSON / 非数组）时回落到空列表，不抛错', () => {
    localStorage.setItem('ownedItems', '{ 不是数组 }');
    expect(getOwnedItems()).toEqual([]);
    localStorage.setItem('ownedItems', '42');
    expect(getOwnedItems()).toEqual([]);
  });

  it('丢弃缺 id 的脏记录，保留合法记录', () => {
    localStorage.setItem(
      'ownedItems',
      JSON.stringify([
        { name: '没有 id' },
        { id: 'shop-item-01', type: 'ship', attributes: { health: 10 } },
      ]),
    );
    const items = getOwnedItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('shop-item-01');
  });

  it('未登记的类型回落到 unknown（不猜）', () => {
    localStorage.setItem('ownedItems', JSON.stringify([{ id: 'x', type: 'spaceship' }]));
    expect(getOwnedItems()[0].type).toBe('unknown');
  });
});

describe('OwnedItems 旧 key 迁移', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('把旧 purchasedItems 的 id 迁进新 key，并删掉旧 key', () => {
    localStorage.setItem('purchasedItems', JSON.stringify(['shop-item-01', 'shop-item-13']));

    const items = getOwnedItems();
    expect(items.map((i) => i.id)).toEqual(['shop-item-01', 'shop-item-13']);
    // 旧记录没有属性快照 → 标为 unknown，不参与加成换算（不凭空给老存档发属性）
    expect(items.every((i) => i.type === 'unknown')).toBe(true);
    expect(items.every((i) => i.attributes === undefined)).toBe(true);
    // 迁移后必须只剩一个真源
    expect(localStorage.getItem('purchasedItems')).toBeNull();
    expect(getOwnedItemsStorageIssues()).toEqual([]);
  });

  it('旧 key 内容不是数组时，迁成空列表并清掉旧 key', () => {
    localStorage.setItem('purchasedItems', '{"broken":true}');
    expect(getOwnedItems()).toEqual([]);
    expect(localStorage.getItem('purchasedItems')).toBeNull();
  });

  it('新 key 已存在时不做迁移（新真源优先），但旧 key 会被自检报出来', () => {
    localStorage.setItem(
      'ownedItems',
      JSON.stringify([{ id: 'shop-item-01', type: 'ship', attributes: { health: 200 } }]),
    );
    localStorage.setItem('purchasedItems', JSON.stringify(['shop-item-99']));

    // 只读新真源，不把旧 key 的内容并进来（否则等于两个真源求并集）
    expect(getOwnedItemIds()).toEqual(['shop-item-01']);
    // 保留旧 key 不静默删除（可能含新 key 没有的信息），但自检必须报出来
    expect(getOwnedItemsStorageIssues().join()).toContain('第二个真源');
  });

  it('grantOwnedItem 之前的首次读取会先完成迁移，不丢老存档', () => {
    localStorage.setItem('purchasedItems', JSON.stringify(['shop-item-99']));
    grantOwnedItem(cruiser);
    expect(getOwnedItemIds()).toEqual(['shop-item-99', 'shop-item-01']);
    expect(localStorage.getItem('purchasedItems')).toBeNull();
  });
});

describe('OwnedItems 存储自检（护栏）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('健康状态无 issue', () => {
    grantOwnedItem(cruiser);
    expect(getOwnedItemsStorageIssues()).toEqual([]);
  });

  it('旧 key 复活会被抓到', () => {
    grantOwnedItem(cruiser);
    localStorage.setItem('purchasedItems', JSON.stringify(['shop-item-01']));
    expect(getOwnedItemsStorageIssues().join()).toContain('第二个真源');
  });

  it('有类型但缺属性快照会被抓到（否则加成就静默消失）', () => {
    localStorage.setItem('ownedItems', JSON.stringify([{ id: 'shop-item-17', type: 'upgrade' }]));
    expect(getOwnedItemsStorageIssues().join()).toContain('缺少属性快照');
  });

  it('迁移遗留的 unknown 记录不算问题', () => {
    localStorage.setItem('purchasedItems', JSON.stringify(['shop-item-01']));
    getOwnedItems();
    expect(getOwnedItemsStorageIssues()).toEqual([]);
  });

  it('清空后回到初始状态', () => {
    grantOwnedItem(cruiser);
    clearOwnedItems();
    expect(getOwnedItems()).toEqual([]);
    expect(localStorage.getItem('purchasedItems')).toBeNull();
  });
});
