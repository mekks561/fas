import React, { useState, useEffect, useMemo } from 'react';
import './ShopPanel.css';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: string;
  subtype?: string;
  price: number;
  currency: string;
  attributes?: Record<string, number>;
  icon: string;
  rarity: string;
  level?: number;
}

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
  capacity: '容量',
  duration: '时长',
};

export const ShopPanel: React.FC<ShopPanelProps> = ({ onBack }) => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const loadItems = async () => {
      const loaded: ShopItem[] = [];
      for (let i = 1; i <= 20; i++) {
        const id = `shop-item-${String(i).padStart(2, '0')}`;
        try {
          const resp = await fetch(`/assets/shop/${id}.json`);
          if (resp.ok) loaded.push(await resp.json());
        } catch (e) { /* skip */ }
      }
      setItems(loaded);
      // 从localStorage读取已购买物品和信用点
      const savedPurchases = localStorage.getItem('purchasedItems');
      if (savedPurchases) setPurchasedIds(new Set(JSON.parse(savedPurchases)));
      setCredits(parseInt(localStorage.getItem('credits') || '10000'));
      setLoading(false);
    };
    loadItems();
  }, []);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(i => i.type === filter);
  }, [items, filter]);

  const handlePurchase = (item: ShopItem) => {
    if (purchasedIds.has(item.id)) return;
    if (credits < item.price) {
      showToast('信用点不足！');
      return;
    }

    const newCredits = credits - item.price;
    const newPurchased = new Set(purchasedIds);
    newPurchased.add(item.id);

    setCredits(newCredits);
    setPurchasedIds(newPurchased);
    localStorage.setItem('credits', String(newCredits));
    localStorage.setItem('purchasedItems', JSON.stringify(Array.from(newPurchased)));
    showToast(`购买成功：${item.name}`);
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
        <button className="shop-back-btn" onClick={onBack}>← 返回</button>
        <h1 className="shop-title">商店</h1>
        <div className="shop-credits">
          <span className="shop-credits-icon">💰</span>
          <span className="shop-credits-value">{credits.toLocaleString()}</span>
        </div>
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
        {filteredItems.map(item => {
          const isPurchased = purchasedIds.has(item.id);
          const canAfford = credits >= item.price;
          const rarity = rarityConfig[item.rarity] || rarityConfig.common;
          return (
            <div
              key={item.id}
              className={`shop-card ${isPurchased ? 'purchased' : ''}`}
              style={{ borderColor: rarity.color }}
            >
              <div className="shop-card-icon" style={{ color: rarity.color }}>
                {typeIcons[item.type] || '📦'}
              </div>
              <div className="shop-card-info">
                <div className="shop-card-header">
                  <span className="shop-card-name">{item.name}</span>
                  <span
                    className="shop-card-rarity"
                    style={{ backgroundColor: rarity.color }}
                  >
                    {rarity.label}
                  </span>
                </div>
                <p className="shop-card-desc">{item.description}</p>
                {item.attributes && (
                  <div className="shop-card-attrs">
                    {Object.entries(item.attributes).map(([key, val]) => (
                      <span key={key} className="shop-attr">
                        {attrLabels[key] || key}: +{val}
                      </span>
                    ))}
                  </div>
                )}
                {item.level && (
                  <div className="shop-card-level">要求等级: {item.level}</div>
                )}
              </div>
              <div className="shop-card-action">
                {isPurchased ? (
                  <span className="shop-purchased-label">已购买 ✓</span>
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
