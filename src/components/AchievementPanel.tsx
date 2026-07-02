import React, { useState, useEffect, useMemo } from 'react';
import './AchievementPanel.css';

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  condition: { type: string; target?: string };
  rewards: { experience: number; credits: number; icon: string };
  icon: string;
  rarity: string;
}

interface AchievementPanelProps {
  onBack: () => void;
}

const rarityConfig: Record<string, { color: string; label: string; glow: string }> = {
  common: { color: '#9ca3af', label: '普通', glow: 'rgba(156,163,175,0.3)' },
  rare: { color: '#3b82f6', label: '稀有', glow: 'rgba(59,130,246,0.4)' },
  epic: { color: '#a855f7', label: '史诗', glow: 'rgba(168,85,247,0.5)' },
  legendary: { color: '#f59e0b', label: '传说', glow: 'rgba(245,158,11,0.6)' },
};

const categoryLabels: Record<string, string> = {
  story: '剧情',
  combat: '战斗',
  exploration: '探索',
  collection: '收集',
  special: '特殊',
};

export const AchievementPanel: React.FC<AchievementPanelProps> = ({ onBack }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAchievements = async () => {
      const loaded: Achievement[] = [];
      for (let i = 1; i <= 15; i++) {
        const id = `achievement-${String(i).padStart(2, '0')}`;
        try {
          const resp = await fetch(`/assets/achievements/${id}.json`);
          if (resp.ok) loaded.push(await resp.json());
        } catch {
          /* skip */
        }
      }
      setAchievements(loaded);
      // 从localStorage读取已解锁成就
      const saved = localStorage.getItem('unlockedAchievements');
      if (saved) {
        setUnlockedIds(new Set(JSON.parse(saved)));
      }
      setLoading(false);
    };
    loadAchievements();
  }, []);

  const filteredAchievements = useMemo(() => {
    if (filter === 'all') return achievements;
    if (filter === 'unlocked') return achievements.filter((a) => unlockedIds.has(a.id));
    if (filter === 'locked') return achievements.filter((a) => !unlockedIds.has(a.id));
    return achievements.filter((a) => a.category === filter);
  }, [achievements, filter, unlockedIds]);

  const stats = useMemo(() => {
    const total = achievements.length;
    const unlocked = unlockedIds.size;
    const pct = total > 0 ? (unlocked / total) * 100 : 0;
    const totalExp = achievements
      .filter((a) => unlockedIds.has(a.id))
      .reduce((sum, a) => sum + a.rewards.experience, 0);
    const totalCredits = achievements
      .filter((a) => unlockedIds.has(a.id))
      .reduce((sum, a) => sum + a.rewards.credits, 0);
    return { total, unlocked, pct, totalExp, totalCredits };
  }, [achievements, unlockedIds]);

  if (loading) {
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
            {stats.unlocked}/{stats.total}
          </span>
          <span className="achievement-stat">+{stats.totalExp} EXP</span>
          <span className="achievement-stat">+{stats.totalCredits} 信用</span>
        </div>
      </div>

      <div className="achievement-progress-bar">
        <div className="achievement-progress-fill" style={{ width: `${stats.pct}%` }} />
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
        {Object.entries(categoryLabels).map(([key, label]) => (
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
        {filteredAchievements.map((ach) => {
          const isUnlocked = unlockedIds.has(ach.id);
          const rarity = rarityConfig[ach.rarity] || rarityConfig.common;
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
                {isUnlocked ? '★' : '?'}
              </div>
              <div className="achievement-card-info">
                <div className="achievement-card-header">
                  <span className="achievement-card-name">{isUnlocked ? ach.name : '???'}</span>
                  <span
                    className="achievement-card-rarity"
                    style={{ backgroundColor: rarity.color }}
                  >
                    {rarity.label}
                  </span>
                </div>
                <p className="achievement-card-desc">
                  {isUnlocked ? ach.description : '解锁条件未知'}
                </p>
                <div className="achievement-card-rewards">
                  <span className="achievement-reward">+{ach.rewards.experience} EXP</span>
                  <span className="achievement-reward">+{ach.rewards.credits} 信用</span>
                </div>
              </div>
              <div className="achievement-card-status">{isUnlocked ? '✓' : '🔒'}</div>
            </div>
          );
        })}
      </div>

      {filteredAchievements.length === 0 && <div className="achievement-empty">暂无成就</div>}
    </div>
  );
};
