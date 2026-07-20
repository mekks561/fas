/**
 * PauseMenu 组件
 * 游戏暂停菜单
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/shadcn';
import {
  Play,
  RotateCcw,
  Settings,
  ArrowLeft,
  ArrowRight,
  Pause,
  Trophy,
  Target,
  Zap,
  Star,
  Medal,
} from 'lucide-react';

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

const menuIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  play: Play,
  stop: RotateCcw,
  settings: Settings,
  'arrow-left': ArrowLeft,
};

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
    timeElapsed: 0,
  },
}) => {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false);

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 菜单选项
  const menuOptions = useMemo(
    () => [
      { id: 'resume', label: t('pause.resume'), icon: 'play', action: onResume, primary: true },
      { id: 'restart', label: t('pause.restart'), icon: 'stop', action: onRestart },
      { id: 'settings', label: t('pause.settings'), icon: 'settings', action: onSettings },
      {
        id: 'mainMenu',
        label: t('pause.mainMenu'),
        icon: 'arrow-left',
        action: onMainMenu,
        danger: true,
      },
    ],
    [onResume, onRestart, onSettings, onMainMenu, t],
  );

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          setSelectedOption((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          setSelectedOption((prev) => Math.min(menuOptions.length - 1, prev + 1));
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
    const timer = setTimeout(() => setShowAnimation(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // 处理点击
  const handleClick = useCallback((index: number, action?: () => void) => {
    setSelectedOption(index);
    if (action) {
      setTimeout(action, 100);
    }
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        showAnimation ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* 半透明背景 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onResume} />

      {/* 暂停面板 */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl">
        {/* 标题 */}
        <div className="mb-4 flex items-center justify-center gap-2">
          <Pause className="h-7 w-7 text-yellow-400" />
          <h2 className="text-xl font-bold text-white">{t('pause.title')}</h2>
        </div>

        {/* 当前统计 */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-yellow-400" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">{t('pause.score')}</span>
              <span className="text-sm font-semibold text-white">
                {currentStats.score.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-red-500" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">{t('pause.enemiesDefeated')}</span>
              <span className="text-sm font-semibold text-white">
                {currentStats.enemiesDefeated}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-blue-500" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">{t('pause.wave')}</span>
              <span className="text-sm font-semibold text-white">Wave {currentStats.wave}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 text-purple-500" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">{t('pause.level')}</span>
              <span className="text-sm font-semibold text-white">Level {currentStats.level}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Medal className="h-5 w-5 text-green-500" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">{t('pause.playTime')}</span>
              <span className="text-sm font-semibold text-white">
                {formatTime(currentStats.timeElapsed)}
              </span>
            </div>
          </div>
        </div>

        {/* 菜单选项 */}
        <div className="space-y-2">
          {menuOptions.map((option, index) => {
            const IconComponent = menuIconMap[option.icon] ?? Play;
            return (
              <div
                key={option.id}
                className={`relative rounded-xl transition-colors ${
                  selectedOption === index ? 'bg-slate-800' : ''
                }`}
                onClick={() => handleClick(index, option.action)}
                onMouseEnter={() => setSelectedOption(index)}
              >
                <Button
                  variant={option.primary ? 'default' : option.danger ? 'destructive' : 'secondary'}
                  size="lg"
                  className="w-full justify-start"
                >
                  <IconComponent />
                  {option.label}
                </Button>

                {/* 选中指示器 */}
                {selectedOption === index && (
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <ArrowRight className="h-4 w-4 text-yellow-400" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 提示信息 */}
        <div className="mt-4">
          <p className="text-center text-xs text-slate-500">{t('pause.navigateHint')}</p>
        </div>
      </div>
    </div>
  );
};

export default PauseMenu;
