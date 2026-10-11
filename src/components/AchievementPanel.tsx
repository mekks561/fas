import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Share2 } from 'lucide-react';
import { AssetIcon } from './AssetIcon';
import './AchievementPanel.css';
import { ShareService, ShareOptions } from '../engine/ShareService';
import { ShareModal } from './ShareModal';
import {
  achievementSystem,
  ACHIEVEMENT_CATEGORY_LABELS,
  ACHIEVEMENT_RARITY_META,
  type AchievementSnapshot,
  type AchievementSnapshotEntry,
} from '../engine/AchievementSystem';

interface AchievementPanelProps {
  onBack: () => void;
}

const shareService = new ShareService();

/**
 * 成就面板 —— `achievementSystem` 的**只读视图**。
 *
 * 接线前后最关键的一句差别：面板不再有自己的数据源。
 *
 * 之前它做两件事，两件都是错的：
 * 1. `fetch('/assets/achievements/achievement-01..15.json')` —— 一套与运行时
 *    `AchievementSystem` **并行**的成就定义（不同 id 词表、不同分类、不同奖励字段）；
 * 2. 读 `localStorage.unlockedAchievements` —— 这个 key **全仓没有任何写入方**
 *    （唯一读它的就是这里）。所以面板永远显示 0/15 全锁，哪怕玩家刚在战斗里
 *    解锁了三条。
 *
 * 现在它只读 `achievementSystem.getSnapshot()`（同一份定义 + 同一份存储），
 * 并且在收到解锁事件时刷新。面板自己不解释任何条件 —— 每条成就的
 * `progress.current / requirement` 由系统算好，面板只负责画。
 */
export const AchievementPanel: React.FC<AchievementPanelProps> = ({ onBack }) => {
  const [snapshot, setSnapshot] = useState<AchievementSnapshot | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [currentShareOptions, setCurrentShareOptions] = useState<ShareOptions | null>(null);

  const refresh = useCallback(() => {
    setSnapshot(achievementSystem.getSnapshot());
  }, []);

  useEffect(() => {
    // 面板可能在任何一局开始前被打开（主菜单入口），此时 GameplayManager 还没
    // 调过 initialize()。initialize() 幂等，这里补一次，保证定义齐、老存档已加载。
    achievementSystem.initialize();
    refresh();
    // 战斗中的解锁要能立刻反映到已打开的面板上
    const unsubscribe = achievementSystem.onAchievementUnlocked(() => refresh());
    return unsubscribe;
  }, [refresh]);

  const handleShare = (achievement: AchievementSnapshotEntry) => {
    const options = shareService.generateAchievementShareText({
      name: achievement.name,
      description: achievement.description,
      icon: achievement.glyph,
      rarity: ACHIEVEMENT_RARITY_META[achievement.rarity].label,
    });
    setCurrentShareOptions(options);
    setShareModalOpen(true);
  };

  const filtered = useMemo(() => {
    const entries = snapshot?.entries ?? [];
    if (filter === 'all') return entries;
    if (filter === 'unlocked') return entries.filter((a) => a.progress.isUnlocked);
    if (filter === 'locked') return entries.filter((a) => !a.progress.isUnlocked);
    return entries.filter((a) => a.category === filter);
  }, [snapshot, filter]);

  if (!snapshot) {
    return (
      <div className="achievement-panel">
        <div className="achievement-loading">加载成就中...</div>
      </div>
    );
  }

  return (
    <div className="achievement-panel">
      <div className="achievement-header">
        <button className="achievement-back-btn" onClick={onBack}>
          ← 返回
        </button>
        <h1 className="achievement-title">成就</h1>
        <div className="achievement-stats-bar">
          <span className="achievement-stat">
            {snapshot.unlocked}/{snapshot.total}
          </span>
          {/* 「已获得」而不是「总数」：这两个数字与成就系统的发放口径一致（已解锁的合计） */}
          <span className="achievement-stat">已获得 +{snapshot.earnedExperience} EXP</span>
          <span className="achievement-stat">+{snapshot.earnedCredits} 信用</span>
        </div>
      </div>

      <div className="achievement-progress-bar">
        <div className="achievement-progress-fill" style={{ width: `${snapshot.completion}%` }} />
      </div>

      <div className="achievement-filters">
        <button
          className={`achievement-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          全部
        </button>
        <button
          className={`achievement-filter-btn ${filter === 'unlocked' ? 'active' : ''}`}
          onClick={() => setFilter('unlocked')}
        >
          已解锁
        </button>
        <button
          className={`achievement-filter-btn ${filter === 'locked' ? 'active' : ''}`}
          onClick={() => setFilter('locked')}
        >
          未解锁
        </button>
        {Object.entries(ACHIEVEMENT_CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`achievement-filter-btn ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="achievement-grid">
        {filtered.map((ach) => {
          const isUnlocked = ach.progress.isUnlocked;
          const rarity = ACHIEVEMENT_RARITY_META[ach.rarity];
          const ratio =
            ach.requirement > 0 ? Math.min(1, ach.progress.current / ach.requirement) : 0;
          return (
            <div
              key={ach.id}
              className={`achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`}
              style={{
                borderColor: rarity.color,
                boxShadow: isUnlocked ? `0 0 15px ${rarity.glow}` : 'none',
              }}
            >
              <div className="achievement-card-icon" style={{ color: rarity.color }}>
                <AssetIcon
                  name={ach.icon}
                  fallback={ach.glyph}
                  size={34}
                  title={ach.name}
                  className="achievement-icon-img"
                />
              </div>
              <div className="achievement-card-info">
                <div className="achievement-card-header">
                  <span className="achievement-card-name">{ach.name}</span>
                  <span
                    className="achievement-card-rarity"
                    style={{ backgroundColor: rarity.color }}
                  >
                    {rarity.label}
                  </span>
                </div>
                <p className="achievement-card-desc">{ach.description}</p>

                {/* 进度：数字直接来自成就系统的条件求值（唯一真源），面板不自己算 */}
                <div className="achievement-card-progress">
                  <div className="achievement-card-progress-track">
                    <div
                      className="achievement-card-progress-fill"
                      style={{
                        width: `${ratio * 100}%`,
                        backgroundColor: rarity.color,
                      }}
                    />
                  </div>
                  <span className="achievement-card-progress-text">
                    {Math.min(ach.progress.current, ach.requirement)}/{ach.requirement}
                  </span>
                </div>

                <div className="achievement-card-rewards">
                  <span className="achievement-reward">+{ach.rewards.experience} EXP</span>
                  <span className="achievement-reward">+{ach.rewards.credits} 信用</span>
                  {ach.rewards.score ? (
                    <span className="achievement-reward">+{ach.rewards.score} 分</span>
                  ) : null}
                </div>
              </div>
              <div className="achievement-card-actions">
                {isUnlocked && (
                  <button
                    className="achievement-share-btn"
                    onClick={() => handleShare(ach)}
                    title="分享成就"
                  >
                    <Share2 size={16} />
                  </button>
                )}
                <div className="achievement-card-status">{isUnlocked ? '✓' : '🔒'}</div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && <div className="achievement-empty">暂无成就</div>}

      {shareModalOpen && currentShareOptions && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          shareOptions={currentShareOptions}
          service={shareService}
        />
      )}
    </div>
  );
};
