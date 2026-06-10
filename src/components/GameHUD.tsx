import React from 'react';
import { useGameUIState, usePerformanceStats } from '../store/useGameStore';

export const GameHUD: React.FC = React.memo(() => {
  const {
    score,
    speed,
    boostActive,
    health,
  } = useGameUIState();

  const {
    showPerformanceStats,
    fps,
    enemyCount,
    projectileCount,
    particleCount,
    isGamePaused,
    togglePerformanceStats,
  } = usePerformanceStats();

  return (
    <div className="hud-container">
      {/* 速度显示 */}
      <div className="speed-panel">
        <div className="hud-label">速度:</div>
        <div className="hud-value">{speed}</div>
      </div>

      {/* 加速显示 */}
      <div className="boost-panel">
        <div className={`boost-indicator ${boostActive ? 'active' : ''}`}>
          {boostActive ? '加速激活' : '加速就绪'}
        </div>
      </div>

      {/* 得分显示 */}
      <div className="score-panel">
        <div className="hud-label">得分:</div>
        <div className="hud-value">{score}</div>
      </div>

      {/* 生命值显示 */}
      <div className="health-panel">
        <div className="hud-label">生命值:</div>
        <div className="health-bar-container">
          <div 
            className="health-bar" 
            style={{ width: `${health}%` }}
          ></div>
        </div>
        <div className="hud-value">{health}</div>
      </div>

      {/* 准星 */}
      <div className="crosshair"></div>

      {/* 性能统计切换按钮 */}
      <button 
        className="stats-toggle-button" 
        onClick={togglePerformanceStats}
        title="切换性能统计"
      >
        {showPerformanceStats ? '隐藏统计' : '显示统计'}
      </button>

      {/* 性能统计面板 */}
      {showPerformanceStats && (
        <div className="performance-stats">
          <div className="stats-title">性能统计</div>
          <div className="stats-item">
            <span className="stats-label">FPS:</span>
            <span className={`stats-value ${fps < 30 ? 'low' : fps < 60 ? 'medium' : 'high'}`}>
              {fps}
            </span>
          </div>
          <div className="stats-item">
            <span className="stats-label">敌人数量:</span>
            <span className="stats-value">{enemyCount}</span>
          </div>
          <div className="stats-item">
            <span className="stats-label">子弹数量:</span>
            <span className="stats-value">{projectileCount}</span>
          </div>
          <div className="stats-item">
            <span className="stats-label">粒子系统:</span>
            <span className="stats-value">{particleCount}</span>
          </div>
          <div className="stats-item">
            <span className="stats-label">游戏状态:</span>
            <span className="stats-value">{isGamePaused ? '暂停' : '运行'}</span>
          </div>
        </div>
      )}
    </div>
  );
});
