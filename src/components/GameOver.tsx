import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from './ui/shadcn';
import { Card, CardContent } from './ui/shadcn';
import { Badge } from './ui/shadcn';
import { Trophy, ArrowRight, RotateCcw, ArrowLeft, Star, Target, Zap, Medal, Crosshair } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

  const menuOptions = useMemo(() => [
    ...(onNextLevel && isVictory ? [{ id: 'next', label: t('gameOver.nextLevel'), icon: ArrowRight, action: onNextLevel, primary: true }] : []),
    { id: 'restart', label: t('gameOver.restart'), icon: RotateCcw, action: onRestart, primary: !onNextLevel || !isVictory },
    { id: 'mainMenu', label: t('gameOver.mainMenu'), icon: ArrowLeft, action: onMainMenu }
  ], [isVictory, onNextLevel, onRestart, onMainMenu, t]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatAccuracy = (accuracy: number): string => {
    return `${Math.round(accuracy * 100)}%`;
  };

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

  useEffect(() => {
    setShowAnimation(true);
    setTimeout(() => setAnimateStats(true), 500);
  }, []);

  const handleClick = useCallback((index: number, action?: () => void) => {
    setSelectedOption(index);
    if (action) {
      setTimeout(action, 100);
    }
  }, []);

  const scorePercentage = useMemo(() => {
    return Math.min(100, (stats.score / stats.highScore) * 100);
  }, [stats.score, stats.highScore]);

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-1000 ${showAnimation ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`absolute inset-0 ${isVictory ? 'bg-gradient-to-b from-blue-950/80 to-slate-950/90' : 'bg-gradient-to-b from-red-950/80 to-slate-950/90'}`} />
      
      <Card className={`relative z-10 w-full max-w-lg bg-slate-900/95 backdrop-blur-xl border-${isVictory ? 'blue' : 'red'}-500/30 shadow-2xl shadow-${isVictory ? 'blue' : 'red'}-500/20`}>
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className={`text-4xl md:text-5xl font-bold bg-gradient-to-r ${isVictory ? 'from-blue-400 via-purple-400 to-cyan-400' : 'from-red-400 via-orange-400 to-yellow-400'} bg-clip-text text-transparent drop-shadow-lg`}>
              {isVictory ? t('gameOver.victory') : t('gameOver.defeat')}
            </h1>
            <p className="text-slate-400">
              {isVictory ? t('gameOver.victoryDesc') : t('gameOver.defeatDesc')}
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <span className="text-lg font-bold text-white">{t('gameOver.finalScore')}</span>
              </div>
              <div className="text-4xl font-bold text-center text-white mb-2">
                {stats.score.toLocaleString()}
              </div>
              {stats.score >= stats.highScore && (
                <div className="flex items-center justify-center gap-2 text-yellow-400 mb-3">
                  <Star className="w-4 h-4 fill-yellow-400" />
                  <span className="text-sm font-bold">{t('gameOver.newRecord')}</span>
                </div>
              )}
              <div className="space-y-2">
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${isVictory ? 'from-blue-500 to-cyan-500' : 'from-red-500 to-orange-500'} transition-all duration-1000 ${animateStats ? '' : 'w-0'}`}
                    style={{ width: `${scorePercentage}%` }}
                  />
                </div>
                <p className="text-center text-xs text-slate-500">
                  {t('gameOver.highScore')}: {stats.highScore.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
                <Target className="w-5 h-5 text-red-400" />
                <div>
                  <div className="text-xs text-slate-500">{t('gameOver.enemiesDefeated')}</div>
                  <div className="text-lg font-bold text-white">{stats.enemiesDefeated}</div>
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
                <Zap className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-xs text-slate-500">{t('gameOver.waveReached')}</div>
                  <div className="text-lg font-bold text-white">Wave {stats.wave}</div>
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
                <Medal className="w-5 h-5 text-green-400" />
                <div>
                  <div className="text-xs text-slate-500">{t('gameOver.playTime')}</div>
                  <div className="text-lg font-bold text-white">{formatTime(stats.timeElapsed)}</div>
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
                <Crosshair className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="text-xs text-slate-500">{t('gameOver.accuracy')}</div>
                  <div className="text-lg font-bold text-white">{formatAccuracy(stats.accuracy)}</div>
                </div>
              </div>
            </div>
          </div>

          {unlockedAchievements.length > 0 && (
            <div className="bg-yellow-400/10 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white text-center mb-3">{t('gameOver.unlockedAchievements')}</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {unlockedAchievements.map((achievement, index) => (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-2 bg-yellow-400/20 rounded-lg px-3 py-2"
                    style={{ animationDelay: `${index * 0.2}s` }}
                  >
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm font-medium text-white">{achievement.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {menuOptions.map((option, index) => {
              const IconComponent = option.icon;
              return (
                <div
                  key={option.id}
                  className={`relative ${selectedOption === index ? 'scale-[1.02]' : ''} transition-transform duration-200`}
                  onClick={() => handleClick(index, option.action)}
                  onMouseEnter={() => setSelectedOption(index)}
                >
                  <Button
                    variant={option.primary ? 'default' : 'outline'}
                    size="lg"
                    className={`w-full h-14 text-base font-semibold ${
                      selectedOption === index 
                        ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900' 
                        : ''
                    } ${option.primary ? isVictory ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500' : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500' : ''}`}
                    onClick={() => option.action?.()}
                  >
                    <IconComponent className="w-5 h-5" />
                    {option.label}
                  </Button>
                  
                  {selectedOption === index && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2">
                      <ArrowRight className="w-5 h-5 text-yellow-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-center text-slate-600 text-xs">
            {t('gameOver.navigateHint')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default GameOver;