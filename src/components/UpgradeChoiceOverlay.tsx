import React, { useEffect, useRef } from 'react';
import type { UpgradeChoice, UpgradeTag, Rarity } from '../engine/BuildSystem';
import './UpgradeChoiceOverlay.css';

interface UpgradeChoiceOverlayProps {
  choices: UpgradeChoice[];
  timer: number;
  onSelect: (id: string) => void;
  resonances?: string[];
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

export const UpgradeChoiceOverlay: React.FC<UpgradeChoiceOverlayProps> = ({
  choices,
  timer,
  onSelect,
  resonances = [],
}) => {
  const selectedRef = useRef(false);

  // 倒计时：到时自动选第一项
  useEffect(() => {
    selectedRef.current = false;
  }, [choices]);

  useEffect(() => {
    if (timer <= 0 && choices.length > 0 && !selectedRef.current) {
      selectedRef.current = true;
      onSelect(choices[0].id);
    }
  }, [timer, choices, onSelect]);

  const handleSelect = (id: string) => {
    if (selectedRef.current) return;
    selectedRef.current = true;
    onSelect(id);
  };

  const timerPercent = Math.max(0, (timer / 10) * 100);

  return (
    <div className="upgrade-overlay">
      <div className="upgrade-overlay__backdrop" />
      <div className="upgrade-overlay__container">
        <h2 className="upgrade-overlay__title">选择强化</h2>
        <p className="upgrade-overlay__subtitle">波次完成！选择一项强化来提升你的战力</p>

        {/* 倒计时进度条 */}
        <div className="upgrade-overlay__timer-bar">
          <div className="upgrade-overlay__timer-fill" style={{ width: `${timerPercent}%` }} />
          <span className="upgrade-overlay__timer-text">{Math.ceil(timer)}s</span>
        </div>

        {/* 三选一卡片 */}
        <div className="upgrade-overlay__cards">
          {choices.map((choice) => {
            const tagColor = TAG_COLORS[choice.tag];
            const stackInfo = choice.stackable
              ? choice.currentStacks > 0
                ? `已强化 ${choice.currentStacks}/${choice.maxStacks} 层`
                : `可叠加 (最多 ${choice.maxStacks} 层)`
              : '不可叠加';
            return (
              <div
                key={choice.id}
                className={`upgrade-card upgrade-card--${choice.rarity}`}
                onClick={() => handleSelect(choice.id)}
                style={{ '--tag-color': tagColor } as React.CSSProperties}
              >
                <div className="upgrade-card__tag-bar" style={{ backgroundColor: tagColor }}>
                  {TAG_LABELS[choice.tag]}
                </div>
                <div className="upgrade-card__body">
                  <div className="upgrade-card__header">
                    <span className="upgrade-card__rarity">{RARITY_LABELS[choice.rarity]}</span>
                  </div>
                  <h3 className="upgrade-card__name">{choice.name}</h3>
                  <p className="upgrade-card__name-en">{choice.nameEn}</p>
                  <p className="upgrade-card__desc">{choice.description}</p>
                  <p className="upgrade-card__stack">{stackInfo}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 已激活共振提示 */}
        {resonances.length > 0 && (
          <div className="upgrade-overlay__resonances">
            <span className="upgrade-overlay__resonance-label">已激活共振：</span>
            {resonances.map((name, i) => (
              <span key={i} className="upgrade-overlay__resonance-tag">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
