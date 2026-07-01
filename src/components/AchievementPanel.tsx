/**
 * AchievementPanel 成就系统UI组件
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AchievementCategory,
  AchievementRarity,
  AchievementDefinition,
  achievementSystem
} from '../engine/AchievementSystem';
import { Button } from './ui/shadcn';
import { X, Trophy } from 'lucide-react';

interface AchievementPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AchievementItemProps {
  achievement: AchievementDefinition;
  progress: number;
  isUnlocked: boolean;
}

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
  const { t } = useTranslation();
  const progressPercent = Math.min((progress / achievement.requirement) * 100, 100);
  const rarityColor = rarityColors[achievement.rarity];

  return (
    <div className={`flex gap-4 p-4 bg-white/[0.03] border border-white/[0.05] rounded-xl mb-3 transition-all hover:bg-white/[0.05] hover:border-white/[0.1] ${isUnlocked ? 'bg-blue-500/10 border-blue-500/30' : ''}`}>
      <div className="w-[60px] h-[60px] flex items-center justify-center bg-white/[0.05] border-2 rounded-xl text-[28px] flex-shrink-0" style={{ borderColor: rarityColor }}>
        <span className={isUnlocked ? '' : 'grayscale opacity-50'}>{achievement.icon}</span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <p className={`text-sm font-bold ${isUnlocked ? 'text-white' : 'text-slate-400'}`}>
            {achievement.name}
          </p>
          <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: rarityColor }}>
            {achievement.rarity}
          </span>
        </div>
        
        <p className={`text-xs ${isUnlocked ? 'text-slate-400' : 'text-slate-500'}`}>
          {achievement.description}
        </p>
        
        {!isUnlocked && (
          <div className="h-1 bg-white/10 rounded-sm my-2 overflow-hidden">
            <div 
              className="h-full transition-all duration-300 rounded-sm"
              style={{ 
                width: `${progressPercent}%`,
                backgroundColor: rarityColor
              }}
            />
          </div>
        )}
        
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-slate-500">
            {progress} / {achievement.requirement}
          </p>
          {achievement.reward?.score && (
            <p className="text-xs text-yellow-400">
              {t('achievement.scoreReward', { score: achievement.reward.score })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

AchievementItem.displayName = 'AchievementItem';

export const AchievementPanel: React.FC<AchievementPanelProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const categoryNames: Record<AchievementCategory, string> = {
    [AchievementCategory.COMBAT]: t('achievement.combat'),
    [AchievementCategory.SURVIVAL]: t('achievement.survival'),
    [AchievementCategory.COLLECTION]: t('achievement.collection'),
    [AchievementCategory.SKILL]: t('achievement.skill'),
    [AchievementCategory.SPECIAL]: t('achievement.special')
  };
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-[10000] animate-in fade-in-0" onClick={onClose}>
      <div className="w-[90%] max-w-[800px] max-h-[90vh] bg-gradient-to-br from-[rgba(20,20,40,0.95)] to-[rgba(10,10,30,0.98)] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-5 bg-white/[0.05] border-b border-white/10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            {t('achievement.title')}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex justify-around p-5 bg-black/20">
          <div className="text-center">
            <h3 className="text-lg font-bold text-yellow-400">{unlockedCount}</h3>
            <p className="text-xs text-slate-500">{t('achievement.unlocked')}</p>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-white">{totalCount}</h3>
            <p className="text-xs text-slate-500">{t('achievement.total')}</p>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-blue-400">{completionPercent}%</h3>
            <p className="text-xs text-slate-500">{t('achievement.completion')}</p>
          </div>
        </div>

        <div className="h-1.5 bg-white/10 mx-6 rounded-sm overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 rounded-sm"
            style={{ width: `${completionPercent}%` }}
          />
        </div>

        <div className="flex gap-2 px-6 py-4 overflow-x-auto border-b border-white/10">
          <button 
            className={`px-4 py-2 bg-white/[0.05] border border-white/10 rounded-full text-white/70 text-[13px] cursor-pointer transition-all whitespace-nowrap hover:bg-white/10 hover:text-white ${selectedCategory === 'all' ? 'bg-gradient-to-br from-blue-500 to-purple-500 border-transparent text-white' : ''}`}
            onClick={() => handleCategoryChange('all')}
          >
            {t('achievement.all')}
          </button>
          {Object.entries(categoryNames).map(([key, name]) => (
            <button 
              key={key}
              className={`px-4 py-2 bg-white/[0.05] border border-white/10 rounded-full text-white/70 text-[13px] cursor-pointer transition-all whitespace-nowrap hover:bg-white/10 hover:text-white ${selectedCategory === key ? 'bg-gradient-to-br from-blue-500 to-purple-500 border-transparent text-white' : ''}`}
              onClick={() => handleCategoryChange(key as AchievementCategory)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {selectedCategory === 'all' ? (
            Object.entries(groupedAchievements).map(([category, items]) => (
              <div key={category} className="mb-5">
                <div className="flex justify-between items-center py-2 mb-3 border-b border-white/10">
                  <p className="text-sm font-bold text-white">
                    {categoryNames[category as AchievementCategory]}
                  </p>
                  <p className="text-xs text-slate-500">
                    {items.filter(i => i.progress.isUnlocked).length} / {items.length}
                  </p>
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

        <div className="px-6 py-5 bg-black/30 border-t border-white/10">
          <h4 className="text-base font-bold text-white">{t('achievement.playerStats')}</h4>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4 mt-3">
            <div className="flex flex-col gap-1 p-3 bg-white/[0.03] rounded-lg text-center">
              <p className="text-sm text-slate-400">{t('achievement.totalKills')}</p>
              <p className="text-sm font-bold text-white">{stats.totalKills}</p>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-white/[0.03] rounded-lg text-center">
              <p className="text-sm text-slate-400">{t('achievement.highestWave')}</p>
              <p className="text-sm font-bold text-white">{stats.highestWave}</p>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-white/[0.03] rounded-lg text-center">
              <p className="text-sm text-slate-400">{t('achievement.highestScore')}</p>
              <p className="text-sm font-bold text-yellow-400">{stats.highestScore.toLocaleString()}</p>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-white/[0.03] rounded-lg text-center">
              <p className="text-sm text-slate-400">{t('achievement.powerupsCollected')}</p>
              <p className="text-sm font-bold text-white">{stats.powerupsCollected}</p>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-white/[0.03] rounded-lg text-center">
              <p className="text-sm text-slate-400">{t('achievement.survivalTime')}</p>
              <p className="text-sm font-bold text-white">{Math.floor(stats.totalPlayTime / 60)}分</p>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-white/[0.03] rounded-lg text-center">
              <p className="text-sm text-slate-400">{t('achievement.accuracy')}</p>
              <p className="text-sm font-bold text-white">
                {stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AchievementPanel;
