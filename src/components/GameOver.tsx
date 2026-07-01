/**
 * GameOver 组件
 * 游戏结算界面
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Text, Icon, ProgressBar } from './ui';
import './GameOver.css';

interface GameOverProps {
  isVictory: boolean;
  stats: {
    score: number;
    highScore: number;
    wave: number;
    level: number;
    enemiesDefeated: number;
    timeElapsed: number;
    accuracy: number;
  };
  unlockedAchievements?: {
    id: string;
    name: string;
    icon: string;
  }[];
  onRestart: () => void;
  onMainMenu: () => void;
  onNextLevel?: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({
  isVictory,
  stats,
  unlockedAchievements = [],
  onRestart,
  onMainMenu,
  onNextLevel
}) => {
  const [selectedOption, setSelectedOption] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false);
  const [animateStats, setAnimateStats] = useState(false);

  // 菜单选项
  const menuOptions = useMemo(() => [
    ...(onNextLevel && isVictory ? [{ id: 'next', label: '下一关', icon: 'arrow-right', action: onNextLevel, primary: true }] : []),
    { id: 'restart', label: '重新开始', icon: 'stop', action: onRestart, primary: !onNextLevel || !isVictory },
    { id: 'mainMenu', label: '返回主菜单', icon: 'arrow-left', action: onMainMenu }
  ], [isVictory, onNextLevel, onRestart, onMainMenu]);

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 格式化精度
  const formatAccuracy = (accuracy: number): string => {
    return `${Math.round(accuracy * 100)}%`;
  };

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          setSelectedOption(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          setSelectedOption(prev => Math.min(menuOptions.length - 1, prev + 1));
          break;
        case 'Enter':
        case 'Space':
          e.preventDefault();
          menuOptions[selectedOption]?.action?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOptions, selectedOption]);

  // 启动动画
  useEffect(() => {
    setShowAnimation(true);
    setTimeout(() => setAnimateStats(true), 500);
  }, []);

  // 处理点击
  const handleClick = useCallback((index: number, action?: () => void) => {
    setSelectedOption(index);
    if (action) {
      setTimeout(action, 100);
    }
  }, []);

  // 计算分数百分比
  const scorePercentage = useMemo(() => {
    return Math.min(100, (stats.score / stats.highScore) * 100);
  }, [stats.score, stats.highScore]);

  return (
    <div className={`gameover-container ${showAnimation ? 'gameover-container--visible' : ''}`}>
      {/* 背景效果 */}
      <div className={`gameover-backdrop ${isVictory ? 'gameover-backdrop--victory' : 'gameover-backdrop--defeat'}`} />
      
      {/* 结算面板 */}
      <div className="gameover-panel">
        {/* 标题 */}
        <div className="gameover-header">
          <Text 
            variant="h1" 
            gradient={isVictory ? 'primary' : 'fire'} 
            glow 
            glowColor={isVictory ? '#3b82f6' : '#ef4444'}
            align="center"
            className="gameover-title"
          >
            {isVictory ? 'VICTORY!' : 'GAME OVER'}
          </Text>
          <Text variant="body" color="secondary" align="center">
            {isVictory ? '恭喜你完成了这一关！' : '再接再厉！'}
          </Text>
        </div>

        {/* 统计数据 */}
        <div className="gameover-stats">
          {/* 分数 */}
          <div className="gameover-stat-main">
            <div className="gameover-stat-main-header">
              <Icon name="trophy" size={24} color="#fbbf24" />
              <Text variant="h4" color="white" bold>
                最终得分
              </Text>
            </div>
            <Text 
              variant="h1" 
              color="white" 
              bold 
              align="center"
              className="gameover-score"
            >
              {stats.score.toLocaleString()}
            </Text>
            {stats.score >= stats.highScore && (
              <div className="gameover-new-record">
                <Icon name="star" size={16} color="#fbbf24" />
                <Text variant="caption" color="yellow" bold>
                  NEW RECORD!
                </Text>
              </div>
            )}
            <div className="gameover-score-bar">
              <ProgressBar 
                value={scorePercentage} 
                maxValue={100} 
                color={isVictory ? 'primary' : 'red'} 
                size="medium"
              />
              <Text variant="caption" color="muted" align="center">
                最高分: {stats.highScore.toLocaleString()}
              </Text>
            </div>
          </div>

          {/* 详细统计 */}
          <div className="gameover-stats-grid">
            <div className="gameover-stat-item">
              <Icon name="target" size={18} color="#ef4444" />
              <div className="gameover-stat-info">
                <span className="gameover-stat-label">消灭敌人</span>
                <span className="gameover-stat-value">{stats.enemiesDefeated}</span>
              </div>
            </div>
            
            <div className="gameover-stat-item">
              <Icon name="bolt" size={18} color="#3b82f6" />
              <div className="gameover-stat-info">
                <span className="gameover-stat-label">到达波次</span>
                <span className="gameover-stat-value">Wave {stats.wave}</span>
              </div>
            </div>
            
            <div className="gameover-stat-item">
              <Icon name="medal" size={18} color="#22c55e" />
              <div className="gameover-stat-info">
                <span className="gameover-stat-label">游戏时间</span>
                <span className="gameover-stat-value">{formatTime(stats.timeElapsed)}</span>
              </div>
            </div>
            
            <div className="gameover-stat-item">
              <Icon name="target" size={18} color="#a855f7" />
              <div className="gameover-stat-info">
                <span className="gameover-stat-label">命中率</span>
                <span className="gameover-stat-value">{formatAccuracy(stats.accuracy)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 解锁成就 */}
        {unlockedAchievements.length > 0 && (
          <div className="gameover-achievements">
            <Text variant="h5" color="white" bold align="center">
              解锁成就
            </Text>
            <div className="gameover-achievements-list">
              {unlockedAchievements.map((achievement, index) => (
                <div 
                  key={achievement.id} 
                  className="gameover-achievement-item"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <Icon name={achievement.icon as any} size={24} color="#fbbf24" />
                  <Text variant="body" color="white">{achievement.name}</Text>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 菜单选项 */}
        <div className="gameover-options">
          {menuOptions.map((option, index) => (
            <div 
              key={option.id}
              className={`gameover-option ${selectedOption === index ? 'gameover-option--selected' : ''}`}
              onClick={() => handleClick(index, option.action)}
              onMouseEnter={() => setSelectedOption(index)}
            >
              <Button
                variant={option.primary ? 'primary' : 'secondary'}
                size="large"
                fullWidth
                leftIcon={<Icon name={option.icon as any} size={20} />}
                className="gameover-option-button"
              >
                {option.label}
              </Button>
              
              {selectedOption === index && (
                <div className="gameover-option-indicator">
                  <Icon name="arrow-right" size={16} color="#fbbf24" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 提示 */}
        <div className="gameover-hint">
          <Text variant="caption" color="muted" align="center">
            Press W/S to navigate | Enter to select
          </Text>
        </div>
      </div>
    </div>
  );
};

export default GameOver;