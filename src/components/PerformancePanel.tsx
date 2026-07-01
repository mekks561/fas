/**
 * PerformancePanel 组件
 * 性能监控面板，显示FPS、内存使用等信息
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/useGameStore';
import { Button } from './ui/shadcn';
import { X, RotateCcw } from 'lucide-react';

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
  const { t } = useTranslation();
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
        const memory = (performance as Performance & { memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
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
    if (fps >= 55) return { level: t('performance.excellent'), color: '#22c55e' };
    if (fps >= 40) return { level: t('performance.good'), color: '#22c55e' };
    if (fps >= 25) return { level: t('performance.fair'), color: '#eab308' };
    return { level: t('performance.poor'), color: '#ef4444' };
  }, [fps, t]);

  const resetStats = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      fpsMin: fps,
      fpsMax: fps
    }));
  }, [fps]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-2.5 right-2.5 w-[280px] bg-gradient-to-br from-[rgba(0,0,0,0.9)] to-[rgba(20,20,40,0.95)] border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md z-[10000] font-mono overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 bg-white/[0.05] border-b border-white/10">
        <p className="text-xs font-bold text-white">
          {t('performance.title')}
        </p>
        <Button 
          variant="ghost" 
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsVisible(false)}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="p-4">
        <div className="mb-4 pb-3 border-b border-white/[0.05]">
          <p className="text-xs font-bold text-yellow-400">
            {t('performance.fps')}
          </p>
          <div className="flex items-baseline my-2">
            <span className="text-[48px] font-bold leading-none" style={{ color: fpsColor, textShadow: '0 0 20px currentColor' }}>
              {Math.round(fps)}
            </span>
            <span className="text-sm text-white/50 ml-1.5">{t('performance.fps')}</span>
          </div>
          <div className="text-[11px] text-white/60 mb-2">
            <span style={{ color: fpsColor }}>
              Min: {metrics.fpsMin} | Max: {metrics.fpsMax}
            </span>
          </div>
          <div 
            className="inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: performanceLevel.color, textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}
          >
            {performanceLevel.level}
          </div>
        </div>

        <div className="mb-4 pb-3 border-b border-white/[0.05]">
          <p className="text-xs font-bold text-blue-400">
            {t('performance.frameTime')}
          </p>
          <div className="text-xl text-white mt-1">
            {metrics.frameTime.toFixed(2)} ms
          </div>
        </div>

        <div className="mb-4 pb-3 border-b border-white/[0.05]">
          <p className="text-xs font-bold text-purple-400">
            {t('performance.memory')}
          </p>
          <div className="h-1.5 bg-white/10 rounded-sm my-2 overflow-hidden">
            <div 
              className="h-full transition-all duration-300 rounded-sm"
              style={{ 
                width: `${(metrics.memoryUsed / metrics.memoryTotal) * 100}%`,
                backgroundColor: metrics.memoryUsed > metrics.memoryTotal * 0.8 ? '#ef4444' : '#22c55e'
              }}
            />
          </div>
          <div className="text-[11px] text-white/60">
            {metrics.memoryUsed} MB / {metrics.memoryTotal} MB
          </div>
        </div>

        <div className="mb-3">
          <p className="text-xs font-bold text-green-400">
            {t('performance.scene')}
          </p>
          <div className="text-xl text-white mt-1">
            {metrics.entityCount} {t('performance.entities')}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={resetStats}
        >
          <RotateCcw className="w-3 h-3" />
          {t('performance.resetStats')}
        </Button>
      </div>
    </div>
  );
};

export default PerformancePanel;
