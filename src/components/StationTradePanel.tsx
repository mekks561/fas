import React from 'react';
import type { UpgradeChoice, UpgradeTag, Rarity } from '../engine/BuildSystem';
import './StationTradePanel.css';

interface StationTradePanelProps {
  choices: (UpgradeChoice & { price: number })[];
  onBuy: (id: string, price: number) => void;
  onClose: () => void;
  currency: number;
}

const TAG_LABELS: Record<UpgradeTag, string> = {
  firepower: '火力',
  mobility: '机动',
  defense: '防御',
  special: '特殊',
};

const TAG_COLORS: Record<UpgradeTag, string> = {
  firepower: '#ff6b35',
  mobility: '#4ecdc4',
  defense: '#45b7d1',
  special: '#a855f7',
};

const RARITY_LABELS: Record<Rarity, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

export const StationTradePanel: React.FC<StationTradePanelProps> = ({
  choices,
  onBuy,
  onClose,
  currency,
}) => {
  return (
    <div className="station-trade">
      <div className="station-trade__backdrop" onClick={onClose} />
      <div className="station-trade__container">
        <div className="station-trade__header">
          <h2 className="station-trade__title">空间站交易所</h2>
          <div className="station-trade__currency">
            <span className="currency-icon">💰</span>
            <span className="currency-value">{currency.toLocaleString()}</span>
          </div>
          <button className="station-trade__close" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="station-trade__subtitle">
          欢迎来到星际交易所。在这里你可以使用信用点购买最新的战斗插件。
        </p>

        <div className="station-trade__cards">
          {choices.map((choice) => {
            const tagColor = TAG_COLORS[choice.tag];
            const canAfford = currency >= choice.price;
            const isMaxed = choice.currentStacks >= choice.maxStacks && !choice.stackable;

            return (
              <div
                key={choice.id}
                className={`trade-card trade-card--${choice.rarity} ${!canAfford ? 'trade-card--disabled' : ''}`}
                style={{ '--tag-color': tagColor } as React.CSSProperties}
              >
                <div className="trade-card__tag-bar" style={{ backgroundColor: tagColor }}>
                  {TAG_LABELS[choice.tag]}
                </div>
                <div className="trade-card__body">
                  <div className="trade-card__header">
                    <span className="trade-card__rarity">{RARITY_LABELS[choice.rarity]}</span>
                  </div>
                  <h3 className="trade-card__name">{choice.name}</h3>
                  <p className="trade-card__desc">{choice.description}</p>
                  <div className="trade-card__footer">
                    <div className="trade-card__price">
                      <span className="price-label">价格:</span>
                      <span
                        className={`price-value ${!canAfford ? 'price-value--insufficient' : ''}`}
                      >
                        {choice.price}
                      </span>
                    </div>
                    <button
                      className={`trade-card__buy-btn ${!canAfford || isMaxed ? 'disabled' : ''}`}
                      onClick={() => !isMaxed && canAfford && onBuy(choice.id, choice.price)}
                      disabled={!canAfford || isMaxed}
                    >
                      {isMaxed ? '已满级' : '购买'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
