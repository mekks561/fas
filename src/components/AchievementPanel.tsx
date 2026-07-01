/**
 * AchievementPanel 成就系统UI组件
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  AchievementCategory, 
  AchievementRarity, 
  AchievementDefinition,
  achievementSystem 
} from '../engine/AchievementSystem';
import { Text } from './ui';
import './AchievementPanel.css';

interface AchievementPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AchievementItemProps {
  achievement: AchievementDefinition;
  progress: number;
  isUnlocked: boolean;
}

const categoryNames: Record<AchievementCategory, string> = {
  [AchievementCategory.COMBAT]: '战斗',
  [AchievementCategory.SURVIVAL]: '生存',
  [AchievementCategory.COLLECTION]: '收集',
  [AchievementCategory.SKILL]: '技能',
  [AchievementCategory.SPECIAL]: '特殊'
};

const rarityColors: Record<AchievementRarity, string> = {
  [AchievementRarity.COMMON]: '#9ca3af',
  [AchievementRarity.UNCOMMON]: '#22c55e',
  [AchievementRarity.RARE]: '#3b82f6',
  [AchievementRarity.EPIC]: '#a855f7',
  [AchievementRarity.LEGENDARY]: '#f59e0b'
};

const AchievementItem: React.FC<AchievementItemProps> = React.memo(({ 
  achievement, 
  progress, 
  isUnlocked 
}) => {
  const progressPercent = Math.min((progress / achievement.requirement) * 100, 100);
  const rarityColor = rarityColors[achievement.rarity];

  return (
    <div className={`achievement-item ${isUnlocked ? 'unlocked' : ''}`}>
      <div className="achievement-icon" style={{ borderColor: rarityColor }}>
        <span className={isUnlocked ? '' : 'grayscale'}>{achievement.icon}</span>
      </div>
      
      <div className="achievement-info">
        <div className="achievement-header">
          <Text variant="body" bold color={isUnlocked ? 'white' : 'gray'}>
            {achievement.name}
          </Text>
          <span className="achievement-rarity" style={{ color: rarityColor }}>
            {achievement.rarity}
          </span>
        </div>
        
        <Text variant="caption" color={isUnlocked ? 'lightGray' : 'gray'}>
          {achievement.description}
        </Text>
        
        {!isUnlocked && (
          <div className="achievement-progress-bar">
            <div 
              className="achievement-progress-fill"
              style={{ 
                width: `${progressPercent}%`,
                backgroundColor: rarityColor
              }}
            />
          </div>
        )}
        
        <div className="achievement-footer">
          <Text variant="caption" color="gray">
            {progress} / {achievement.requirement}
          </Text>
          {achievement.reward?.score && (
            <Text variant="caption" color="yellow">
              +{achievement.reward.score}分
            </Text>
          )}
        </div>
      </div>
    </div>
  );
});

AchievementItem.displayName = 'AchievementItem';

export const AchievementPanel: React.FC<AchievementPanelProps> = ({ isOpen, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>('all');
  const [achievements, setAchievements] = useState<(AchievementDefinition & { progress: { current: number; isUnlocked: boolean } })[]>([]);
  const [stats, setStats] = useState(achievementSystem.getStats());

  useEffect(() => {
    achievementSystem.initialize();
    setAchievements(achievementSystem.getAllAchievements());
    setStats(achievementSystem.getStats());
  }, []);

  useEffect(() => {
    const unsubscribe = achievementSystem.onAchievementUnlocked(() => {
      setAchievements(achievementSystem.getAllAchievements());
      setStats(achievementSystem.getStats());
    });

    return () => unsubscribe();
  }, []);

  const filteredAchievements = useMemo(() => {
    if (selectedCategory === 'all') {
      return achievements;
    }
    return achievements.filter(a => a.category === selectedCategory);
  }, [achievements, selectedCategory]);

  const groupedAchievements = useMemo(() => {
    const groups: Record<string, (AchievementDefinition & { progress: { current: number; isUnlocked: boolean } })[]> = {};
    
    filteredAchievements.forEach(a => {
      if (!groups[a.category]) {
        groups[a.category] = [];
      }
      groups[a.category].push(a);
    });
    
    return groups;
  }, [filteredAchievements]);

  const unlockedCount = useMemo(() => achievements.filter(a => a.progress.isUnlocked).length, [achievements]);
  const totalCount = achievements.length;
  const completionPercent = Math.round((unlockedCount / totalCount) * 100);

  const handleCategoryChange = useCallback((category: AchievementCategory | 'all') => {
    setSelectedCategory(category);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="achievement-panel-overlay" onClick={onClose}>
      <div className="achievement-panel" onClick={e => e.stopPropagation()}>
        <div className="achievement-panel-header">
          <Text variant="h2" bold color="white">
            成就系统
          </Text>
          <button className="achievement-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="achievement-stats">
          <div className="achievement-stat">
            <Text variant="h3" bold color="gold">{unlockedCount}</Text>
            <Text variant="caption" color="gray">已解锁</Text>
          </div>
          <div className="achievement-stat">
            <Text variant="h3" bold color="white">{totalCount}</Text>
            <Text variant="caption" color="gray">总数</Text>
          </div>
          <div className="achievement-stat">
            <Text variant="h3" bold color="blue">{completionPercent}%</Text>
            <Text variant="caption" color="gray">完成度</Text>
          </div>
        </div>

        <div className="achievement-progress-bar-large">
          <div 
            className="achievement-progress-fill-large"
            style={{ width: `${completionPercent}%` }}
          />
        </div>

        <div className="achievement-categories">
          <button 
            className={`achievement-category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('all')}
          >
            全部
          </button>
          {Object.entries(categoryNames).map(([key, name]) => (
            <button 
              key={key}
              className={`achievement-category-btn ${selectedCategory === key ? 'active' : ''}`}
              onClick={() => handleCategoryChange(key as AchievementCategory)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="achievement-list">
          {selectedCategory === 'all' ? (
            Object.entries(groupedAchievements).map(([category, items]) => (
              <div key={category} className="achievement-group">
                <div className="achievement-group-header">
                  <Text variant="body" bold color="white">
                    {categoryNames[category as AchievementCategory]}
                  </Text>
                  <Text variant="caption" color="gray">
                    {items.filter(i => i.progress.isUnlocked).length} / {items.length}
                  </Text>
                </div>
                {items.map(achievement => (
                  <AchievementItem
                    key={achievement.id}
                    achievement={achievement}
                    progress={achievement.progress.current}
                    isUnlocked={achievement.progress.isUnlocked}
                  />
                ))}
              </div>
            ))
          ) : (
            filteredAchievements.map(achievement => (
              <AchievementItem
                key={achievement.id}
                achievement={achievement}
                progress={achievement.progress.current}
                isUnlocked={achievement.progress.isUnlocked}
              />
            ))
          )}
        </div>

        <div className="achievement-player-stats">
          <Text variant="h4" bold color="white">玩家统计</Text>
          <div className="achievement-stat-grid">
            <div className="achievement-stat-item">
              <Text variant="body" color="gray">总击杀</Text>
              <Text variant="body" bold color="white">{stats.totalKills}</Text>
            </div>
            <div className="achievement-stat-item">
              <Text variant="body" color="gray">最高波次</Text>
              <Text variant="body" bold color="white">{stats.highestWave}</Text>
            </div>
            <div className="achievement-stat-item">
              <Text variant="body" color="gray">最高分</Text>
              <Text variant="body" bold color="gold">{stats.highestScore.toLocaleString()}</Text>
            </div>
            <div className="achievement-stat-item">
              <Text variant="body" color="gray">道具收集</Text>
              <Text variant="body" bold color="white">{stats.powerupsCollected}</Text>
            </div>
            <div className="achievement-stat-item">
              <Text variant="body" color="gray">存活时间</Text>
              <Text variant="body" bold color="white">{Math.floor(stats.totalPlayTime / 60)}分</Text>
            </div>
            <div className="achievement-stat-item">
              <Text variant="body" color="gray">命中率</Text>
              <Text variant="body" bold color="white">
                {stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%
              </Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AchievementPanel;