import { useEffect, useState } from 'react';
import { PerformanceStats } from '../engine/PerformanceMonitor';

interface PerformanceOverlayProps {
  stats: PerformanceStats | null;
  visible: boolean;
}

export function PerformanceOverlay({ stats, visible }: PerformanceOverlayProps) {
  const [displayStats, setDisplayStats] = useState<PerformanceStats | null>(null);

  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => setDisplayStats(null), 0);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      if (stats) {
        setDisplayStats({ ...stats });
      }
    }, 300);

    return () => clearInterval(interval);
  }, [visible, stats]);

  if (!visible || !displayStats) {
    return null;
  }

  const getFpsColor = (fps: number): string => {
    if (fps >= 55) return 'text-green-400';
    if (fps >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getTimeColor = (ms: number): string => {
    if (ms < 1) return 'text-green-400';
    if (ms < 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed top-4 left-4 z-50 bg-black/80 rounded-lg p-4 text-xs font-mono backdrop-blur-sm border border-gray-700">
      <div className="text-gray-400 mb-2 font-bold text-sm">PERFORMANCE MONITOR</div>
      
      <div className="space-y-1">
        <div className="flex justify-between gap-8">
          <span className="text-gray-400">FPS:</span>
          <span className={`font-bold ${getFpsColor(displayStats.fps)}`}>
            {displayStats.fps}
          </span>
        </div>

        <div className="flex justify-between gap-8">
          <span className="text-gray-400">Frame:</span>
          <span className={getTimeColor(displayStats.frameTime)}>
            {displayStats.frameTime.toFixed(2)} ms
          </span>
        </div>

        <div className="flex justify-between gap-8">
          <span className="text-gray-400">Physics:</span>
          <span className={getTimeColor(displayStats.physicsTime)}>
            {displayStats.physicsTime.toFixed(2)} ms
            {displayStats.gpuPhysics && (
              <span className="ml-1 text-cyan-400">GPU</span>
            )}
          </span>
        </div>

        <div className="flex justify-between gap-8">
          <span className="text-gray-400">AI:</span>
          <span className={getTimeColor(displayStats.aiTime)}>
            {displayStats.aiTime.toFixed(2)} ms
            {displayStats.aiEnabled && (
              <span className="ml-1 text-purple-400">ON</span>
            )}
          </span>
        </div>

        <div className="border-t border-gray-600 my-2"></div>

        <div className="flex justify-between gap-8">
          <span className="text-gray-400">Particles:</span>
          <span className="text-blue-400">{displayStats.activeParticles}</span>
        </div>

        <div className="flex justify-between gap-8">
          <span className="text-gray-400">NPCs:</span>
          <span className="text-orange-400">{displayStats.activeNPCs}</span>
        </div>
      </div>

      <div className="text-gray-500 mt-3 text-[10px]">Press F3 to toggle</div>
    </div>
  );
}
