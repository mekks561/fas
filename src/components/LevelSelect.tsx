/**
 * LevelSelect 组件
 * 关卡选择界面
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Text, Icon, ProgressBar } from './ui';
import './LevelSelect.css';

export interface LevelData {
  id: number;
  name: string;
  description: string;
  difficulty: 'easy' | 'normal' | 'hard' | 'nightmare';
  recommendedLevel: number;
  stars: number; // 0-3 stars earned
  maxStars: number;
  unlocked: boolean;
  highScore?: number;
  completionRate?: number;
  enemies: number;
  waves: number;
}

interface LevelSelectProps {
  onSelectLevel: (levelId: number) => void;
  onBack: () => void;
  currentPlayerLevel?: number;
}

const defaultLevels: LevelData[] = [
  {
    id: 1,
    name: '新手训练',
    description: '学习基本操作，击败简单敌人',
    difficulty: 'easy',
    recommendedLevel: 1,
    stars: 0,
    maxStars: 3,
    unlocked: true,
    enemies: 20,
    waves: 5
  },
  {
    id: 2,
    name: '星际巡航',
    description: '穿越小行星带，遭遇巡逻队',
    difficulty: 'easy',
    recommendedLevel: 3,
    stars: 0,
    maxStars: 3,
    unlocked: false,
    enemies: 30,
    waves: 6
  },
  {
    id: 3,
    name: '陨石地带',
    description: '在密集陨石中作战，考验操控',
    difficulty: 'normal',
    recommendedLevel: 5,
    stars: 0,
    maxStars: 3,
    unlocked: false,
    enemies: 40,
    waves: 7
  },
  {
    id: 4,
    name: '敌舰基地',
    description: '突袭敌人基地，面对精英部队',
    difficulty: 'hard',
    recommendedLevel: 8,
    stars: 0,
    maxStars: 3,
    unlocked: false,
    enemies: 50,
    waves: 8
  },
  {
    id: 5,
    name: 'Boss战：星际帝王',
    description: '最终决战，击败星际帝王',
    difficulty: 'nightmare',
    recommendedLevel: 10,
    stars: 0,
    maxStars: 3,
    unlocked: false,
    enemies: 1,
    waves: 3
  }
];

export const LevelSelect: React.FC<LevelSelectProps> = ({
  onSelectLevel,
  onBack,
  currentPlayerLevel = 1
}) => {
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [levels, setLevels] = useState<LevelData[]>(() => {
    // 加载保存的进度
    const saved = localStorage.getItem('levelProgress');
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        return defaultLevels.map(level => ({
          ...level,
          ...progress[level.id],
          unlocked: level.id === 1 || currentPlayerLevel >= level.recommendedLevel
        }));
      } catch {
        return defaultLevels;
      }
    }
    return defaultLevels.map(level => ({
      ...level,
      unlocked: level.id === 1 || currentPlayerLevel >= level.recommendedLevel
    }));
  });

  const [showAnimation, setShowAnimation] = useState(false);

  // 获取难度颜色
  const getDifficultyColor = (difficulty: LevelData['difficulty']): string => {
    switch (difficulty) {
      case 'easy': return '#22c55e';
      case 'normal': return '#3b82f6';
      case 'hard': return '#ef4444';
      case 'nightmare': return '#a855f7';
    }
  };

  // 获取难度标签
  const getDifficultyLabel = (difficulty: LevelData['difficulty']): string => {
    switch (difficulty) {
      case 'easy': return '简单';
      case 'normal': return '普通';
      case 'hard': return '困难';
      case 'nightmare': return '噩梦';
    }
  };

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          setSelectedLevel(prev => Math.max(1, prev - 1));
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          setSelectedLevel(prev => Math.min(levels.length, prev + 1));
          break;
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          setSelectedLevel(prev => Math.max(1, prev - 1));
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          setSelectedLevel(prev => Math.min(levels.length, prev + 1));
          break;
        case 'Enter':
        case 'Space':
          e.preventDefault();
          const level = levels.find(l => l.id === selectedLevel);
          if (level?.unlocked) {
            onSelectLevel(selectedLevel);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onBack();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [levels, selectedLevel, onSelectLevel, onBack]);

  // 启动动画
  useEffect(() => {
    setShowAnimation(true);
  }, []);

  // 处理关卡点击
  const handleLevelClick = useCallback((levelId: number) => {
    setSelectedLevel(levelId);
    const level = levels.find(l => l.id === levelId);
    if (level?.unlocked) {
      onSelectLevel(levelId);
    }
  }, [levels, onSelectLevel]);

  // 渲染星星
  const renderStars = (count: number, max: number, earned: boolean) => {
    const stars = [];
    for (let i = 0; i < max; i++) {
      stars.push(
        <Icon 
          key={i} 
          name="star" 
          size={20} 
          color={i < count && earned ? '#fbbf24' : '#374151'} 
          className={i < count && earned ? 'level-star--filled' : 'level-star--empty'}
        />
      );
    }
    return stars;
  };

  // 获取选中的关卡数据
  const selectedLevelData = levels.find(l => l.id === selectedLevel);

  return (
    <div className={`levelselect-container ${showAnimation ? 'levelselect-container--visible' : ''}`}>
      {/* 头部 */}
      <div className="levelselect-header">
        <Button variant="ghost" size="small" onClick={onBack}>
          <Icon name="arrow-left" size={20} />
          返回
        </Button>
        <Text variant="h2" color="white" bold>
          选择关卡
        </Text>
        <div className="levelselect-header-placeholder" />
      </div>

      {/* 关卡网格 */}
      <div className="levelselect-grid">
        {levels.map((level, index) => (
          <div
            key={level.id}
            className={`levelselect-card ${selectedLevel === level.id ? 'levelselect-card--selected' : ''} ${!level.unlocked ? 'levelselect-card--locked' : ''}`}
            onClick={() => handleLevelClick(level.id)}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* 关卡编号 */}
            <div className="levelselect-card-number">
              {level.unlocked ? level.id : <Icon name="lock" size={24} color="#6b7280" />}
            </div>

            {/* 关卡信息 */}
            <div className="levelselect-card-info">
              <Text variant="h5" color={level.unlocked ? 'white' : 'muted'} bold>
                {level.name}
              </Text>
              <Text variant="caption" color="muted">
                {level.description}
              </Text>
            </div>

            {/* 难度标签 */}
            <div 
              className="levelselect-card-difficulty"
              style={{ backgroundColor: getDifficultyColor(level.difficulty) }}
            >
              {getDifficultyLabel(level.difficulty)}
            </div>

            {/* 星星 */}
            <div className="levelselect-card-stars">
              {renderStars(level.stars, level.maxStars, level.unlocked)}
            </div>

            {/* 锁定遮罩 */}
            {!level.unlocked && (
              <div className="levelselect-card-overlay">
                <Icon name="lock" size={48} color="#6b7280" />
                <Text variant="caption" color="muted">
                  需要等级 {level.recommendedLevel}
                </Text>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 详情面板 */}
      {selectedLevelData && (
        <div className="levelselect-detail">
          <div className="levelselect-detail-header">
            <Text variant="h3" color="white" bold>
              {selectedLevelData.name}
            </Text>
            <div 
              className="levelselect-detail-difficulty"
              style={{ backgroundColor: getDifficultyColor(selectedLevelData.difficulty) }}
            >
              {getDifficultyLabel(selectedLevelData.difficulty)}
            </div>
          </div>

          <Text variant="body" color="secondary" className="levelselect-detail-desc">
            {selectedLevelData.description}
          </Text>

          <div className="levelselect-detail-stats">
            <div className="levelselect-detail-stat">
              <Icon name="target" size={20} color="#ef4444" />
              <span>敌人: {selectedLevelData.enemies}</span>
            </div>
            <div className="levelselect-detail-stat">
              <Icon name="bolt" size={20} color="#3b82f6" />
              <span>波次: {selectedLevelData.waves}</span>
            </div>
            <div className="levelselect-detail-stat">
              <Icon name="medal" size={20} color="#fbbf24" />
              <span>等级: {selectedLevelData.recommendedLevel}</span>
            </div>
          </div>

          {selectedLevelData.highScore !== undefined && (
            <div className="levelselect-detail-highscore">
              <Icon name="trophy" size={18} color="#fbbf24" />
              <span>最高分: {selectedLevelData.highScore.toLocaleString()}</span>
            </div>
          )}

          <Button
            variant="primary"
            size="large"
            fullWidth
            disabled={!selectedLevelData.unlocked}
            onClick={() => selectedLevelData.unlocked && onSelectLevel(selectedLevelData.id)}
          >
            {selectedLevelData.unlocked ? '开始挑战' : '未解锁'}
          </Button>
        </div>
      )}

      {/* 提示信息 */}
      <div className="levelselect-hint">
        <Text variant="caption" color="muted" align="center">
          W/S/A/D or Arrow Keys to navigate | Enter to select | ESC to go back
        </Text>
      </div>
    </div>
  );
};

export default LevelSelect;