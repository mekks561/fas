import React, { useState, useEffect, useMemo } from 'react';
import { AssetIcon } from './AssetIcon';
import { getCredits, spendCredits } from '../engine/CreditsStore';
import {
  getOwnedItems,
  grantOwnedItem,
  type ItemAttributes,
  type OwnedItemType,
} from '../engine/OwnedItems';
import {
  computeMetaBonuses,
  describeMetaBonuses,
  getOwnedHullTint,
  IDENTITY_META_BONUSES,
  type MetaBonuses,
} from '../engine/MetaBonuses';
import './ShopPanel.css';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: string;
  subtype?: string;
  price: number;
  currency: string;
  attributes?: ItemAttributes;
  icon: string;
  rarity: string;
  level?: number;
}

/**
 * 购买后不生效的商品类型。
 *
 * 消耗品需要「背包 + 使用时机」这套系统：本作没有局内道具栏，买了也无处可用。
 * 与其让它看起来能买、买完什么也不发生，不如在货架上直接标明「即将开放」。
 * （`MetaBonuses.itemToMetaBonuses` 同样跳过 `consumable`，两处口径一致。）
 */
const NOT_PURCHASABLE_TYPES = new Set<string>(['consumable']);

const asOwnedType = (type: string): OwnedItemType => {
  switch (type) {
    case 'ship':
    case 'weapon':
    case 'consumable':
    case 'cosmetic':
    case 'upgrade':
      return type;
    default:
      return 'unknown';
  }
};

interface ShopPanelProps {
  onBack: () => void;
}

const rarityConfig: Record<string, { color: string; label: string }> = {
  common: { color: '#9ca3af', label: '普通' },
  rare: { color: '#3b82f6', label: '稀有' },
  epic: { color: '#a855f7', label: '史诗' },
  legendary: { color: '#f59e0b', label: '传说' },
};

const typeLabels: Record<string, string> = {
  ship: '飞船',
  weapon: '武器',
  consumable: '消耗品',
  cosmetic: '外观',
  upgrade: '升级模块',
};

const typeIcons: Record<string, string> = {
  ship: '🚀',
  weapon: '⚡',
  consumable: '💊',
  cosmetic: '🎨',
  upgrade: '🔧',
};

const attrLabels: Record<string, string> = {
  health: '生命',
  shield: '护盾',
  speed: '速度',
  damage: '伤害',
  weaponSlots: '武器槽',
  fireRate: '射速',
  range: '射程',
  accuracy: '精准',
  energyCost: '能耗',
  capacity: '容量',
  duration: '时长',
  healAmount: '回复量',
  shieldAmount: '护盾量',
  energyAmount: '能量值',
  count: '数量',
  damageBonus: '伤害',
  shieldBonus: '护盾',
  speedBonus: '速度',
  energyBonus: '能量',
};

/**
 * 属性的**单位**，必须与 `MetaBonuses` 的换算表一致 ——
 * 商店卡片写「速度: +50」而实际生效是「+50%」，就是界面在骗人。
 * 百分比类在这里补 `%`，绝对值类不加后缀。
 */
const attrUnits: Record<string, string> = {
  speed: '%',
  damage: '%',
  damageBonus: '',
  shieldBonus: '',
  speedBonus: '',
  energyBonus: '',
};

/** `*Bonus` 字段在 JSON 里是分数（0.1 = +10%），展示时换算成百分数。 */
const ATTR_FRACTION_KEYS = new Set(['damageBonus', 'shieldBonus', 'speedBonus', 'energyBonus']);

const formatAttrValue = (key: string, raw: unknown): string => {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return typeof raw === 'string' ? raw : String(raw);
  }
  if (ATTR_FRACTION_KEYS.has(key)) return `${Math.round(raw * 100)}%`;
  if (key === 'fireRate') return `${raw}/秒`;
  return `${raw}${attrUnits[key] ?? ''}`;
};

export const ShopPanel: React.FC<ShopPanelProps> = ({ onBack }) => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  /**
   * 已购物品折算出的永久加成。**这里不是装饰**：同一个
   * `computeMetaBonuses` 会在 GameScene 开局被调用，结果合并进
   * PlayerShip / WeaponSystem（见 `MetaBonuses.ts` 文件头）。
   */
  const [bonuses, setBonuses] = useState<MetaBonuses>(IDENTITY_META_BONUSES);
  const [hullTintLabel, setHullTintLabel] = useState<string | null>(null);

  const refreshOwned = () => {
    // 已购物品的唯一真源是 OwnedItems（旧 purchasedItems 会在首次读取时迁移）
    const owned = getOwnedItems();
    setPurchasedIds(new Set(owned.map((i) => i.id)));
    setBonuses(computeMetaBonuses(owned));
    const tint = getOwnedHullTint(owned);
    setHullTintLabel(tint ? `rgb(${tint.map((c) => Math.round(c * 255)).join(', ')})` : null);
  };

  useEffect(() => {
    const loadItems = async () => {
      const loaded: ShopItem[] = [];
      for (let i = 1; i <= 20; i++) {
        const id = `shop-item-${String(i).padStart(2, '0')}`;
        try {
          const resp = await fetch(`/assets/shop/${id}.json`);
          if (resp.ok) loaded.push(await resp.json());
        } catch {
          /* skip */
        }
      }
      setItems(loaded);
      refreshOwned();
      // 信用点统一走 CreditsStore（与关卡奖励同一真源）
      setCredits(getCredits());
      setLoading(false);
    };
    loadItems();
  }, []);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.type === filter);
  }, [items, filter]);

  /** 已购加成的可读文本（「生命 +200 / 伤害 +10%」），与 GameScene 日志同源。 */
  const bonusSummary = useMemo(() => describeMetaBonuses(bonuses), [bonuses]);

  const handlePurchase = (item: ShopItem) => {
    if (purchasedIds.has(item.id)) return;
    if (NOT_PURCHASABLE_TYPES.has(item.type)) {
      showToast('该商品尚未开放（需要背包系统）');
      return;
    }
    if (credits < item.price) {
      showToast('信用点不足！');
      return;
    }

    // 先扣款，扣款失败就不发货（spendCredits 余额不足时返回 false）
    if (!spendCredits(item.price)) {
      showToast('信用点不足！');
      return;
    }
    // 落库：写的是**属性快照**，供下一局开局同步读取（不再回读 JSON）
    grantOwnedItem({
      id: item.id,
      name: item.name,
      type: asOwnedType(item.type),
      subtype: item.subtype,
      price: item.price,
      attributes: item.attributes,
    });

    setCredits(getCredits());
    refreshOwned();
    showToast(`购买成功：${item.name} · 下一局自动生效`);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  if (loading) {
    return (
      <div className="shop-panel">
        <div className="shop-loading">加载商店中...</div>
      </div>
    );
  }

  return (
    <div className="shop-panel">
      <div className="shop-header">
        <button className="shop-back-btn" onClick={onBack}>
          ← 返回
        </button>
        <h1 className="shop-title">商店</h1>
        <div className="shop-credits">
          <span className="shop-credits-icon">💰</span>
          <span className="shop-credits-value">{credits.toLocaleString()}</span>
        </div>
      </div>

      {/*
        已购加成条：把「买了什么」直接换算成「下一局会多什么」。
        数字来自 computeMetaBonuses —— 与 GameScene 开局用的是同一个函数。
      */}
      <div className="shop-bonus-strip" data-testid="shop-bonus-strip">
        <span className="shop-bonus-title">已购 {bonuses.itemCount} 件</span>
        {bonusSummary.length > 0 ? (
          <span className="shop-bonus-list">
            {bonusSummary.map((text) => (
              <span key={text} className="shop-bonus-chip">
                {text}
              </span>
            ))}
          </span>
        ) : (
          <span className="shop-bonus-empty">暂无永久加成 —— 购买后自动带入下一局</span>
        )}
        {hullTintLabel && <span className="shop-bonus-chip">涂装 {hullTintLabel}</span>}
      </div>

      <div className="shop-filters">
        <button
          className={`shop-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          全部
        </button>
        {Object.entries(typeLabels).map(([key, label]) => (
          <button
            key={key}
            className={`shop-filter-btn ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {typeIcons[key]} {label}
          </button>
        ))}
      </div>

      <div className="shop-grid">
        {filteredItems.map((item) => {
          const isPurchased = purchasedIds.has(item.id);
          const notOpen = NOT_PURCHASABLE_TYPES.has(item.type);
          const canAfford = credits >= item.price && !notOpen;
          const rarity = rarityConfig[item.rarity] || rarityConfig['common'];
          return (
            <div
              key={item.id}
              className={`shop-card ${isPurchased ? 'purchased' : ''}`}
              style={{ borderColor: rarity.color }}
            >
              <div className="shop-card-icon" style={{ color: rarity.color }}>
                <AssetIcon
                  name={item.icon}
                  fallback={typeIcons[item.type] || '📦'}
                  size={34}
                  title={item.name}
                />
              </div>
              <div className="shop-card-info">
                <div className="shop-card-header">
                  <span className="shop-card-name">{item.name}</span>
                  <span className="shop-card-rarity" style={{ backgroundColor: rarity.color }}>
                    {rarity.label}
                  </span>
                </div>
                <p className="shop-card-desc">{item.description}</p>
                {item.attributes && (
                  <div className="shop-card-attrs">
                    {Object.entries(item.attributes)
                      .filter(([, val]) => typeof val === 'number' || typeof val === 'string')
                      .map(([key, val]) => (
                        <span key={key} className="shop-attr">
                          {attrLabels[key] || key}: +{formatAttrValue(key, val)}
                        </span>
                      ))}
                  </div>
                )}
                {item.level && <div className="shop-card-level">要求等级: {item.level}</div>}
                {notOpen && (
                  <div className="shop-card-level">消耗品需背包系统，本版暂不开放购买</div>
                )}
              </div>
              <div className="shop-card-action">
                {isPurchased ? (
                  <span className="shop-purchased-label">已购买 ✓</span>
                ) : notOpen ? (
                  <span className="shop-purchased-label">即将开放</span>
                ) : (
                  <button
                    className={`shop-buy-btn ${!canAfford ? 'disabled' : ''}`}
                    onClick={() => handlePurchase(item)}
                    disabled={!canAfford}
                  >
                    <span className="shop-price">{item.price.toLocaleString()}</span>
                    <span className="shop-currency">信用</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {toast && <div className="shop-toast">{toast}</div>}
    </div>
  );
};
