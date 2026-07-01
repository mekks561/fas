/**
 * PauseMenu 组件
 * 游戏暂停菜单
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Text, Icon } from './ui';
import './PauseMenu.css';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onMainMenu: () => void;
  currentStats?: {
    score: number;
    wave: number;
    level: number;
    enemiesDefeated: number;
    timeElapsed: number;
  };
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onRestart,
  onSettings,
  onMainMenu,
  currentStats = {
    score: 0,
    wave: 1,
    level: 1,
    enemiesDefeated: 0,
    timeElapsed: 0
  }
}) => {
  const [selectedOption, setSelectedOption] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false);

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 菜单选项
  const menuOptions = useMemo(() => [
    { id: 'resume', label: '继续游戏', icon: 'play', action: onResume, primary: true },
    { id: 'restart', label: '重新开始', icon: 'stop', action: onRestart },
    { id: 'settings', label: '设置', icon: 'settings', action: onSettings },
    { id: 'mainMenu', label: '返回主菜单', icon: 'arrow-left', action: onMainMenu, danger: true }
  ], [onResume, onRestart, onSettings, onMainMenu]);

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
        case 'Escape':
          e.preventDefault();
          onResume();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOptions, selectedOption, onResume]);

  // 启动动画
  useEffect(() => {
    setShowAnimation(true);
  }, []);

  // 处理点击
  const handleClick = useCallback((index: number, action?: () => void) => {
    setSelectedOption(index);
    if (action) {
      setTimeout(action, 100);
    }
  }, []);

  return (
    <div className={`pause-container ${showAnimation ? 'pause-container--visible' : ''}`}>
      {/* 半透明背景 */}
      <div className="pause-backdrop" onClick={onResume} />
      
      {/* 暂停面板 */}
      <div className="pause-panel">
        {/* 标题 */}
        <div className="pause-header">
          <Text variant="h2" color="white" bold align="center">
            <Icon name="pause" size={28} color="#fbbf24" />
            游戏暂停
          </Text>
        </div>

        {/* 当前统计 */}
        <div className="pause-stats">
          <div className="pause-stat-item">
            <Icon name="trophy" size={18} color="#fbbf24" />
            <div className="pause-stat-info">
              <span className="pause-stat-label">分数</span>
              <span className="pause-stat-value">{currentStats.score.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="pause-stat-item">
            <Icon name="target" size={18} color="#ef4444" />
            <div className="pause-stat-info">
              <span className="pause-stat-label">消灭敌人</span>
              <span className="pause-stat-value">{currentStats.enemiesDefeated}</span>
            </div>
          </div>
          
          <div className="pause-stat-item">
            <Icon name="bolt" size={18} color="#3b82f6" />
            <div className="pause-stat-info">
              <span className="pause-stat-label">波次</span>
              <span className="pause-stat-value">Wave {currentStats.wave}</span>
            </div>
          </div>
          
          <div className="pause-stat-item">
            <Icon name="star" size={18} color="#a855f7" />
            <div className="pause-stat-info">
              <span className="pause-stat-label">等级</span>
              <span className="pause-stat-value">Level {currentStats.level}</span>
            </div>
          </div>

          <div className="pause-stat-item">
            <Icon name="medal" size={18} color="#22c55e" />
            <div className="pause-stat-info">
              <span className="pause-stat-label">游戏时间</span>
              <span className="pause-stat-value">{formatTime(currentStats.timeElapsed)}</span>
            </div>
          </div>
        </div>

        {/* 菜单选项 */}
        <div className="pause-options">
          {menuOptions.map((option, index) => (
            <div 
              key={option.id}
              className={`pause-option ${selectedOption === index ? 'pause-option--selected' : ''} ${option.danger ? 'pause-option--danger' : ''}`}
              onClick={() => handleClick(index, option.action)}
              onMouseEnter={() => setSelectedOption(index)}
            >
              <Button
                variant={option.primary ? 'primary' : option.danger ? 'danger' : 'secondary'}
                size="large"
                fullWidth
                leftIcon={<Icon name={option.icon as any} size={20} />}
                className="pause-option-button"
              >
                {option.label}
              </Button>
              
              {/* 选中指示器 */}
              {selectedOption === index && (
                <div className="pause-option-indicator">
                  <Icon name="arrow-right" size={16} color="#fbbf24" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 提示信息 */}
        <div className="pause-hint">
          <Text variant="caption" color="muted" align="center">
            Press ESC to resume | W/S to navigate | Enter to select
          </Text>
        </div>
      </div>
    </div>
  );
};

export default PauseMenu;