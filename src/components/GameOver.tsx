import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from './ui/shadcn';
import { Card, CardContent } from './ui/shadcn';
import {
  Trophy,
  ArrowRight,
  RotateCcw,
  ArrowLeft,
  Star,
  Target,
  Zap,
  Medal,
  Crosshair,
  Heart,
  Shield,
  Sword,
  Sparkles,
  Skull,
  TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LeaderboardService } from '../engine/LeaderboardService';

interface ScoreBreakdown {
  baseScore: number;
  comboBonus: number;
  accuracyBonus: number;
  efficiencyBonus: number;
  survivalBonus: number;
}

interface CombatStatsDetail {
  kills: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  damageHealed: number;
  skillsUsed: number;
  skillsHit: number;
  powerupsCollected: number;
  projectilesFired: number;
  projectilesHit: number;
  comboMax: number;
  accuracy: number;
  playTime: number;
  wavesCompleted: number;
  bossesKilled: number;
  elitesKilled: number;
  enemiesDefeated: Record<string, number>;
}

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
  combatStats?: CombatStatsDetail | null;
  scoreBreakdown?: ScoreBreakdown | null;
  finalRank?: string;
  unlockedAchievements?: {
    id: string;
    name: string;
    icon: string;
  }[];
  onRestart: () => void;
  onMainMenu: () => void;
  onNextLevel?: () => void;
  onLeaderboard?: () => void;
}

const leaderboardService = new LeaderboardService();

export const GameOver: React.FC<GameOverProps> = ({
  isVictory,
  stats,
  combatStats = null,
  scoreBreakdown = null,
  finalRank,
  unlockedAchievements = [],
  onRestart,
  onMainMenu,
  onNextLevel,
  onLeaderboard,
}) => {
  const [selectedOption, setSelectedOption] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false);
  const [animateStats, setAnimateStats] = useState(false);
  const [submittedScore, setSubmittedScore] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const submitScoreAndGetRank = async () => {
      const newRank = await leaderboardService.submitScore(stats.score, stats.wave, stats.enemiesDefeated);
      setRank(newRank);
      setSubmittedScore(true);
    };
    submitScoreAndGetRank();
  }, [stats]);

  const menuOptions = useMemo(
    () => [
      ...(onNextLevel && isVictory
        ? [
            {
              id: 'next',
              label: t('gameOver.nextLevel'),
              icon: ArrowRight,
              action: onNextLevel,
              primary: true,
            },
          ]
        : []),
      {
        id: 'restart',
        label: t('gameOver.restart'),
        icon: RotateCcw,
        action: onRestart,
        primary: !onNextLevel || !isVictory,
      },
      ...(onLeaderboard
        ? [{ id: 'leaderboard', label: t('gameOver.leaderboard'), icon: Trophy, action: onLeaderboard }]
        : []),
      { id: 'mainMenu', label: t('gameOver.mainMenu'), icon: ArrowLeft, action: onMainMenu },
    ],
    [isVictory, onNextLevel, onRestart, onMainMenu, onLeaderboard, t],
  );

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatAccuracy = (accuracy: number): string => {
    return `${Math.round(accuracy * 100)}%`;
  };

  const getRankColor = (rank: string): string => {
    switch (rank) {
      case 'S': return 'text-yellow-400 bg-yellow-400/20 border-yellow-400';
      case 'A': return 'text-red-400 bg-red-400/20 border-red-400';
      case 'B': return 'text-purple-400 bg-purple-400/20 border-purple-400';
      case 'C': return 'text-blue-400 bg-blue-400/20 border-blue-400';
      case 'D': return 'text-green-400 bg-green-400/20 border-green-400';
      default: return 'text-slate-400 bg-slate-400/20 border-slate-400';
    }
  };

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOptions, selectedOption]);

  useEffect(() => {
    const animTimer = setTimeout(() => {
      setShowAnimation(true);
    }, 0);
    const timer = setTimeout(() => setAnimateStats(true), 500);
    return () => {
      clearTimeout(animTimer);
      clearTimeout(timer);
    };
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
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-1000 ${showAnimation ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className={`absolute inset-0 ${isVictory ? 'bg-gradient-to-b from-blue-950/80 to-slate-950/90' : 'bg-gradient-to-b from-red-950/80 to-slate-950/90'}`}
      />

      <Card
        className={`relative z-10 w-full max-w-lg bg-slate-900/95 backdrop-blur-xl border-${isVictory ? 'blue' : 'red'}-500/30 shadow-2xl shadow-${isVictory ? 'blue' : 'red'}-500/20`}
      >
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1
              className={`text-4xl md:text-5xl font-bold bg-gradient-to-r ${isVictory ? 'from-blue-400 via-purple-400 to-cyan-400' : 'from-red-400 via-orange-400 to-yellow-400'} bg-clip-text text-transparent drop-shadow-lg`}
            >
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
              {submittedScore && rank !== null && (
                <div className="flex items-center justify-center gap-2 text-blue-400 mb-3">
                  <Medal className="w-4 h-4" />
                  <span className="text-sm font-bold">排名: #{rank}</span>
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
                  <div className="text-lg font-bold text-white">
                    {formatTime(stats.timeElapsed)}
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
                <Crosshair className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="text-xs text-slate-500">{t('gameOver.accuracy')}</div>
                  <div className="text-lg font-bold text-white">
                    {formatAccuracy(stats.accuracy)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {scoreBreakdown && (
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <span className="text-sm font-bold text-white">分数明细</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>基础分数</span>
                  <span className="font-mono">{scoreBreakdown.baseScore.toLocaleString()}</span>
                </div>
                {scoreBreakdown.comboBonus > 0 && (
                  <div className="flex justify-between text-yellow-400">
                    <span>连击加成</span>
                    <span className="font-mono">+{scoreBreakdown.comboBonus.toLocaleString()}</span>
                  </div>
                )}
                {scoreBreakdown.accuracyBonus > 0 && (
                  <div className="flex justify-between text-purple-400">
                    <span>命中率加成</span>
                    <span className="font-mono">+{scoreBreakdown.accuracyBonus.toLocaleString()}</span>
                  </div>
                )}
                {scoreBreakdown.efficiencyBonus > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>效率加成</span>
                    <span className="font-mono">+{scoreBreakdown.efficiencyBonus.toLocaleString()}</span>
                  </div>
                )}
                {scoreBreakdown.survivalBonus > 0 && (
                  <div className="flex justify-between text-blue-400">
                    <span>生存加成</span>
                    <span className="font-mono">+{scoreBreakdown.survivalBonus.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {combatStats && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
                  <Sword className="w-5 h-5 text-orange-400" />
                  <div>
                    <div className="text-xs text-slate-500">伤害输出</div>
                    <div className="text-lg font-bold text-white">{Math.round(combatStats.damageDealt).toLocaleString()}</div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
                  <Heart className="w-5 h-5 text-red-400" />
                  <div>
                    <div className="text-xs text-slate-500">受到伤害</div>
                    <div className="text-lg font-bold text-white">{Math.round(combatStats.damageTaken).toLocaleString()}</div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-xs text-slate-500">恢复生命</div>
                    <div className="text-lg font-bold text-white">{Math.round(combatStats.damageHealed).toLocaleString()}</div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <div>
                    <div className="text-xs text-slate-500">最高连击</div>
                    <div className="text-lg font-bold text-white">{combatStats.comboMax}x</div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-xs text-slate-500">道具拾取</div>
                    <div className="text-lg font-bold text-white">{combatStats.powerupsCollected}</div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
                  <Skull className="w-5 h-5 text-purple-400" />
                  <div>
                    <div className="text-xs text-slate-500">BOSS/精英击杀</div>
                    <div className="text-lg font-bold text-white">{combatStats.bossesKilled} / {combatStats.elitesKilled}</div>
                  </div>
                </div>
              </div>

              {combatStats.enemiesDefeated && Object.keys(combatStats.enemiesDefeated).length > 0 && (
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-red-400" />
                    <span className="text-sm font-bold text-white">击杀分布</span>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Object.entries(combatStats.enemiesDefeated).map(([type, count]) => (
                      <div key={type} className="bg-slate-700/50 rounded-lg px-3 py-1.5 text-xs">
                        <span className="text-slate-400 capitalize">{type}</span>
                        <span className="text-white font-bold ml-2">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {finalRank && (
            <div className="flex justify-center">
              <div className={`px-6 py-2 rounded-xl border-2 font-bold text-2xl ${getRankColor(finalRank)}`}>
                等级 {finalRank}
              </div>
            </div>
          )}

          {unlockedAchievements.length > 0 && (
            <div className="bg-yellow-400/10 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white text-center mb-3">
                {t('gameOver.unlockedAchievements')}
              </h3>
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
                    } ${option.primary ? (isVictory ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500' : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500') : ''}`}
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

          <p className="text-center text-slate-600 text-xs">{t('gameOver.navigateHint')}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default GameOver;
