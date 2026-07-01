/**
 * PerformancePanel 组件
 * 性能监控面板，显示FPS、内存使用等信息
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Text } from './ui';
import './PerformancePanel.css';

interface PerformanceMetrics {
  fps: number;
  fpsMin: number;
  fpsMax: number;
  frameTime: number;
  memoryUsed: number;
  memoryTotal: number;
  entityCount: number;
}

export const PerformancePanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    fpsMin: 60,
    fpsMax: 60,
    frameTime: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    entityCount: 0
  });

  const fps = useGameStore((state) => state.fps);

  // 键盘快捷键切换显示
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'F3') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 更新性能指标
  useEffect(() => {
    if (!isVisible) return;

    const intervalId = setInterval(() => {
      let memoryUsed = 0;
      let memoryTotal = 0;
      
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        memoryUsed = Math.round(memory.usedJSHeapSize / (1024 * 1024));
        memoryTotal = Math.round(memory.jsHeapSizeLimit / (1024 * 1024));
      }

      setMetrics(prev => ({
        ...prev,
        fps,
        fpsMin: prev.fpsMin > fps ? fps : prev.fpsMin,
        fpsMax: prev.fpsMax < fps ? fps : prev.fpsMax,
        memoryUsed,
        memoryTotal,
        entityCount: prev.entityCount
      }));
    }, 500);

    return () => clearInterval(intervalId);
  }, [isVisible, fps]);

  const fpsColor = useMemo(() => {
    if (fps >= 55) return '#22c55e';
    if (fps >= 30) return '#eab308';
    return '#ef4444';
  }, [fps]);

  const performanceLevel = useMemo(() => {
    if (fps >= 55) return { level: 'Excellent', color: '#22c55e' };
    if (fps >= 40) return { level: 'Good', color: '#22c55e' };
    if (fps >= 25) return { level: 'Fair', color: '#eab308' };
    return { level: 'Poor', color: '#ef4444' };
  }, [fps]);

  const resetStats = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      fpsMin: fps,
      fpsMax: fps
    }));
  }, [fps]);

  if (!isVisible) return null;

  return (
    <div className="performance-panel">
      <div className="performance-panel-header">
        <Text variant="caption" color="white" bold>
          Performance Monitor (F3)
        </Text>
        <button 
          className="performance-panel-close"
          onClick={() => setIsVisible(false)}
        >
          ×
        </button>
      </div>

      <div className="performance-panel-content">
        <div className="performance-section">
          <Text variant="caption" color="yellow" bold>
            FPS
          </Text>
          <div className="performance-fps-display">
            <span className="performance-fps-current" style={{ color: fpsColor }}>
              {Math.round(fps)}
            </span>
            <span className="performance-fps-unit">FPS</span>
          </div>
          <div className="performance-fps-stats">
            <span style={{ color: fpsColor }}>
              Min: {metrics.fpsMin} | Max: {metrics.fpsMax}
            </span>
          </div>
          <div 
            className="performance-level-badge"
            style={{ backgroundColor: performanceLevel.color }}
          >
            {performanceLevel.level}
          </div>
        </div>

        <div className="performance-section">
          <Text variant="caption" color="blue" bold>
            Frame Time
          </Text>
          <div className="performance-value">
            {metrics.frameTime.toFixed(2)} ms
          </div>
        </div>

        <div className="performance-section">
          <Text variant="caption" color="purple" bold>
            Memory
          </Text>
          <div className="performance-memory-bar">
            <div 
              className="performance-memory-fill"
              style={{ 
                width: `${(metrics.memoryUsed / metrics.memoryTotal) * 100}%`,
                backgroundColor: metrics.memoryUsed > metrics.memoryTotal * 0.8 ? '#ef4444' : '#22c55e'
              }}
            />
          </div>
          <div className="performance-memory-text">
            {metrics.memoryUsed} MB / {metrics.memoryTotal} MB
          </div>
        </div>

        <div className="performance-section">
          <Text variant="caption" color="green" bold>
            Scene
          </Text>
          <div className="performance-value">
            {metrics.entityCount} entities
          </div>
        </div>

        <button 
          className="performance-reset-btn"
          onClick={resetStats}
        >
          Reset Stats
        </button>
      </div>
    </div>
  );
};

export default PerformancePanel;