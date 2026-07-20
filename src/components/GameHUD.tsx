import React, { useState, useEffect, useMemo } from 'react';
import {
  Heart,
  Shield,
  Skull,
  Zap,
  Sword,
  Target,
  Star,
  Gem,
  Flame,
  ShieldCheck,
  Gift,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

interface HUDProps {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  level: number;
  wave: number;
  totalWaves: number;
  enemiesRemaining: number;
  fps?: number;
  activeEffects?: ActiveEffect[];
  bossHealth?: number;
  bossMaxHealth?: number;
  bossName?: string;
  weaponInfo?: WeaponInfo;
  skills?: SkillInfo[];
  onSkillActivate?: (index: number) => void;
  speed?: number;
  isBoostActive?: boolean;
  boostEnergy?: number;
  maxBoostEnergy?: number;
  combo?: number;
  maxCombo?: number;
  rank?: string;
  killCount?: number;
  isBossWave?: boolean;
  isEliteWave?: boolean;
}

interface ActiveEffect {
  type: string;
  icon: string;
  remainingTime: number;
  duration: number;
  value: number;
}

interface WeaponInfo {
  name: string;
  damage: number;
  fireRate: number;
  ammo?: number;
  maxAmmo?: number;
}

interface SkillInfo {
  name: string;
  icon: string;
  cooldown: number;
  maxCooldown: number;
  keyBinding: string;
  isActive: boolean;
}

const BossHealthBar: React.FC<{
  health: number;
  maxHealth: number;
  name: string;
}> = ({ health, maxHealth, name }) => {
  const percentage = useMemo(() => {
    return Math.max(0, (health / maxHealth) * 100);
  }, [health, maxHealth]);

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-red-500/30 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Skull className="w-5 h-5 text-red-500" />
        <span className="text-sm font-bold text-white">{name}</span>
      </div>
      <div className="h-6 bg-slate-800 rounded-full overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>
      <div className="text-center text-xs text-red-400 mt-1 font-bold">
        {Math.floor(health)} / {maxHealth}
      </div>
    </div>
  );
};

const EFFECT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  shield: ShieldCheck,
  speed: Zap,
  fire: Flame,
  invincible: Star,
};

const EffectIndicator: React.FC<{ effect: ActiveEffect }> = ({ effect }) => {
  const progress = useMemo(() => {
    return (effect.remainingTime / effect.duration) * 100;
  }, [effect.remainingTime, effect.duration]);

  const Icon = EFFECT_ICONS[effect.type.toLowerCase()] ?? Gem;

  return (
    <div className="flex flex-col items-center gap-1 bg-slate-800/80 rounded-lg p-2">
      <div className="relative">
        <Icon className="w-5 h-5 text-purple-400" />
        <div className="absolute inset-0 bg-purple-400/30 rounded-full blur-sm" />
      </div>
      <span className="text-xs text-slate-300">{effect.type}</span>
      <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

const WeaponDisplay: React.FC<{ weapon: WeaponInfo }> = ({ weapon }) => {
  return (
    <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg p-3 flex items-center gap-3">
      <Sword className="w-5 h-5 text-yellow-400" />
      <div className="flex-1">
        <div className="text-sm font-bold text-white">{weapon.name}</div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-red-400">
            <Target className="w-3 h-3" />
            {weapon.damage}
          </span>
          <span className="flex items-center gap-1 text-yellow-400">
            <Zap className="w-3 h-3" />
            {(60000 / weapon.fireRate).toFixed(1)}/s
          </span>
        </div>
      </div>
      {weapon.ammo !== undefined && (
        <div className="text-sm font-bold text-blue-400 bg-blue-400/20 rounded-lg px-2 py-1">
          {weapon.ammo}/{weapon.maxAmmo}
        </div>
      )}
    </div>
  );
};

const SkillBar: React.FC<{ skills: SkillInfo[]; onActivate?: (index: number) => void }> = ({
  skills,
  onActivate,
}) => {
  return (
    <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg p-3">
      <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">Skills</div>
      <div className="flex items-center gap-2">
        {skills.map((skill, index) => {
          const cooldownPercent =
            skill.cooldown > 0 ? (skill.cooldown / skill.maxCooldown) * 100 : 0;
          const isReady = skill.cooldown <= 0 && !skill.isActive;

          return (
            <button
              key={skill.name}
              className={`relative w-14 h-14 rounded-xl font-bold text-sm transition-all ${
                skill.isActive
                  ? 'bg-yellow-500/30 border-2 border-yellow-400'
                  : isReady
                    ? 'bg-purple-500/30 border-2 border-purple-400 hover:bg-purple-500/50'
                    : 'bg-slate-700/50 border-2 border-slate-600 opacity-60'
              }`}
              onClick={() => onActivate?.(index)}
              disabled={!isReady}
            >
              <span
                className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-xs ${
                  isReady ? 'text-white' : 'text-slate-500'
                }`}
              >
                {skill.keyBinding}
              </span>
              {skill.cooldown > 0 && (
                <div
                  className="absolute bottom-0 left-0 right-0 bg-slate-900/80 rounded-b-xl transition-all duration-100"
                  style={{ height: `${cooldownPercent}%` }}
                />
              )}
              {skill.isActive && (
                <div className="absolute inset-0 bg-yellow-400/20 rounded-xl animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FPSDisplay: React.FC<{ fps: number }> = ({ fps }) => {
  const color = useMemo(() => {
    if (fps >= 55) return '#22c55e';
    if (fps >= 30) return '#eab308';
    return '#ef4444';
  }, [fps]);

  return (
    <div className="flex items-center gap-1 text-xs font-bold" style={{ color }}>
      <Zap className="w-3 h-3" />
      {Math.round(fps)} FPS
    </div>
  );
};

const ComboDisplay: React.FC<{ combo: number; maxCombo: number }> = ({ combo, maxCombo }) => {
  const comboScale = useMemo(() => {
    if (combo >= 50) return 'text-5xl text-yellow-400';
    if (combo >= 30) return 'text-4xl text-orange-400';
    if (combo >= 15) return 'text-3xl text-red-400';
    if (combo >= 5) return 'text-2xl text-purple-400';
    return 'text-xl text-cyan-400';
  }, [combo]);

  if (combo <= 0) return null;

  return (
    <div className="text-center">
      <div className={`font-extrabold drop-shadow-lg animate-pulse ${comboScale}`}>
        {combo}x COMBO
      </div>
      <div className="text-xs text-slate-400 mt-1">
        最高: {maxCombo}x
      </div>
    </div>
  );
};

const RankDisplay: React.FC<{ rank: string }> = ({ rank }) => {
  const rankColor = useMemo(() => {
    switch (rank) {
      case 'S': return 'text-yellow-400 bg-yellow-400/20 border-yellow-400';
      case 'A': return 'text-red-400 bg-red-400/20 border-red-400';
      case 'B': return 'text-purple-400 bg-purple-400/20 border-purple-400';
      case 'C': return 'text-blue-400 bg-blue-400/20 border-blue-400';
      case 'D': return 'text-green-400 bg-green-400/20 border-green-400';
      default: return 'text-slate-400 bg-slate-400/20 border-slate-400';
    }
  }, [rank]);

  return (
    <div className={`px-3 py-1 rounded-lg border-2 font-bold text-sm ${rankColor}`}>
      等级 {rank}
    </div>
  );
};

const WaveBadge: React.FC<{ isBossWave: boolean; isEliteWave: boolean }> = ({ isBossWave, isEliteWave }) => {
  if (isBossWave) {
    return (
      <div className="px-2 py-1 bg-red-500/30 border border-red-500 rounded text-xs font-bold text-red-400 animate-pulse">
        BOSS 波次
      </div>
    );
  }
  if (isEliteWave) {
    return (
      <div className="px-2 py-1 bg-purple-500/30 border border-purple-500 rounded text-xs font-bold text-purple-400">
        精英波次
      </div>
    );
  }
  return null;
};

/** 难度自适应指示器：展示当前档位、倍率、趋势与表现条 */
const DifficultyIndicator: React.FC<{ info: import('../engine/DifficultyManager').DifficultySnapshot }> = ({ info }) => {
  const tierStyles: Record<string, string> = {
    '放松': 'text-green-400 border-green-500/50 bg-green-500/10',
    '普通': 'text-slate-300 border-slate-500/50 bg-slate-500/10',
    '紧张': 'text-orange-400 border-orange-500/50 bg-orange-500/10',
    '极限': 'text-red-400 border-red-500/50 bg-red-500/10',
  };
  const tierStyle = tierStyles[info.tier] || tierStyles['普通'];

  const trendIcon = info.trend === 'rising' ? '▲' : info.trend === 'falling' ? '▼' : '◆';
  const trendColor = info.trend === 'rising' ? 'text-red-400' : info.trend === 'falling' ? 'text-green-400' : 'text-slate-400';

  // 表现条：0-1 映射到 0-100%
  const perfPct = Math.round(info.performanceScore * 100);

  return (
    <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded border ${tierStyle} text-[10px] font-bold mt-1`}>
      <span>自适应</span>
      <span className="text-white/90">{info.tier}</span>
      <span className="text-white/70">×{info.multiplier.toFixed(2)}</span>
      <span className={trendColor} title={`趋势: ${info.trend}`}>{trendIcon}</span>
      <span className="text-slate-500" title={`表现分: ${perfPct}%`}>{perfPct}%</span>
    </div>
  );
};

const SpeedDisplay: React.FC<{ speed: number; maxSpeed?: number }> = ({ speed, maxSpeed = 100 }) => {
  const percentage = useMemo(() => {
    return Math.min(100, (speed / maxSpeed) * 100);
  }, [speed, maxSpeed]);

  const speedColor = useMemo(() => {
    if (percentage >= 90) return 'from-red-600 to-red-400';
    if (percentage >= 70) return 'from-yellow-600 to-yellow-400';
    return 'from-cyan-600 to-cyan-400';
  }, [percentage]);

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-5 h-5 text-cyan-400" />
        <span className="text-sm font-bold text-slate-300">Speed</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${speedColor} transition-all duration-150`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-bold text-white w-12 text-right">
          {Math.round(speed)}
        </span>
      </div>
    </div>
  );
};

const BoostDisplay: React.FC<{ isActive: boolean; boostEnergy?: number; maxBoostEnergy?: number }> = ({
  isActive,
  boostEnergy = 100,
  maxBoostEnergy = 100,
}) => {
  const percentage = useMemo(() => {
    return Math.max(0, (boostEnergy / maxBoostEnergy) * 100);
  }, [boostEnergy, maxBoostEnergy]);

  return (
    <div className={`bg-slate-900/80 backdrop-blur-sm rounded-lg p-3 border-2 transition-all ${
      isActive ? 'border-orange-500 shadow-lg shadow-orange-500/30' : 'border-transparent'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Flame className={`w-5 h-5 ${isActive ? 'text-orange-400 animate-pulse' : 'text-slate-400'}`} />
        <span className={`text-sm font-bold ${isActive ? 'text-orange-400' : 'text-slate-300'}`}>
          {isActive ? 'BOOSTING!' : 'Boost'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${isActive ? 'from-orange-600 to-yellow-400' : 'from-orange-800 to-orange-600'} transition-all duration-150`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={`text-sm font-bold w-12 text-right ${isActive ? 'text-orange-400' : 'text-white'}`}>
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
};

export const GameHUD: React.FC<HUDProps> = React.memo(({
  health,
  maxHealth,
  shield,
  maxShield,
  score,
  level,
  wave,
  totalWaves,
  enemiesRemaining,
  fps,
  activeEffects = [],
  bossHealth,
  bossMaxHealth,
  bossName,
  weaponInfo,
  skills = [],
  onSkillActivate,
  speed = 0,
  isBoostActive = false,
  boostEnergy = 100,
  maxBoostEnergy = 100,
  combo = 0,
  maxCombo = 0,
  rank = 'F',
  killCount = 0,
  isBossWave = false,
  isEliteWave = false,
}) => {
  const [scoreAnimation, setScoreAnimation] = useState(false);
  const [prevScore, setPrevScore] = useState(score);
  const waveRewardNotification = useGameStore((s) => s.waveRewardNotification);
  const setWaveRewardNotification = useGameStore((s) => s.setWaveRewardNotification);
  const achievementNotifications = useGameStore((s) => s.achievementNotifications);
  const removeAchievementNotification = useGameStore((s) => s.removeAchievementNotification);
  const difficultyInfo = useGameStore((s) => s.difficultyInfo);

  useEffect(() => {
    if (waveRewardNotification) {
      const timer = setTimeout(() => {
        setWaveRewardNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [waveRewardNotification, setWaveRewardNotification]);

  // 成就通知自动消失（每个通知4秒后自动移除）
  useEffect(() => {
    if (achievementNotifications.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    achievementNotifications.forEach((n) => {
      const timer = setTimeout(() => {
        removeAchievementNotification(n.id);
      }, 4000);
      timers.push(timer);
    });
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [achievementNotifications, removeAchievementNotification]);

  useEffect(() => {
    if (score > prevScore) {
      const animTimer = setTimeout(() => {
        setScoreAnimation(true);
        const timer = setTimeout(() => setScoreAnimation(false), 500);
        return () => clearTimeout(timer);
      }, 0);
      return () => clearTimeout(animTimer);
    }
    const prevTimer = setTimeout(() => setPrevScore(score), 0);
    return () => clearTimeout(prevTimer);
  }, [score, prevScore]);

  useEffect(() => {
    console.log('[GameHUD] Player stats updated:', {
      health: Math.floor(health),
      shield: Math.floor(shield),
      speed: Math.round(speed),
      isBoostActive,
      boostEnergy: Math.round(boostEnergy),
      score,
      wave,
      enemiesRemaining,
      fps,
    });
  }, [health, shield, speed, isBoostActive, boostEnergy, score, wave, enemiesRemaining, fps]);

  const isLowHealth = useMemo(() => {
    return health < maxHealth * 0.3;
  }, [health, maxHealth]);

  return (
    <div className="absolute inset-0 pointer-events-none p-4 md:p-6">
      {waveRewardNotification && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="bg-gradient-to-br from-yellow-900/90 to-amber-900/90 border-2 border-yellow-500 rounded-2xl p-6 shadow-2xl animate-[fadeIn_0.3s_ease-out]">
            <div className="flex items-center gap-2 mb-3 justify-center">
              <Gift className="w-6 h-6 text-yellow-400" />
              <span className="text-xl font-bold text-yellow-400">波次 {waveRewardNotification.waveNumber} 完成!</span>
            </div>
            <div className="space-y-1.5">
              {waveRewardNotification.rewards.map((r) => (
                <div key={r.label} className="text-sm text-yellow-200 text-center">{r.label}</div>
              ))}
            </div>
          </div>
        </div>
      )}
      {achievementNotifications.length > 0 && (
        <div className="absolute top-24 right-4 md:right-6 z-50 pointer-events-none flex flex-col gap-2 max-w-xs">
          {achievementNotifications.map((n) => {
            const rarityStyles: Record<string, { border: string; glow: string; label: string; labelColor: string }> = {
              common: { border: 'border-slate-400', glow: 'shadow-slate-500/50', label: '普通', labelColor: 'text-slate-300' },
              uncommon: { border: 'border-green-400', glow: 'shadow-green-500/50', label: '不凡', labelColor: 'text-green-300' },
              rare: { border: 'border-blue-400', glow: 'shadow-blue-500/50', label: '稀有', labelColor: 'text-blue-300' },
              epic: { border: 'border-purple-400', glow: 'shadow-purple-500/50', label: '史诗', labelColor: 'text-purple-300' },
              legendary: { border: 'border-yellow-400', glow: 'shadow-yellow-500/50', label: '传说', labelColor: 'text-yellow-300' },
            };
            const style = rarityStyles[n.rarity] || rarityStyles['common'];
            return (
              <div
                key={n.id}
                className={`bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-2 ${style.border} rounded-xl p-3 shadow-2xl ${style.glow} animate-[fadeIn_0.3s_ease-out] flex items-start gap-3 pointer-events-auto`}
              >
                <div className="text-3xl flex-shrink-0 leading-none">{n.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Star className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                    <span className={`text-[10px] font-bold uppercase ${style.labelColor}`}>{style.label}</span>
                  </div>
                  <div className="text-sm font-bold text-white truncate">🏆 {n.name}</div>
                  <div className="text-xs text-slate-300 line-clamp-2">{n.description}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAchievementNotification(n.id)}
                  className="text-slate-400 hover:text-white text-lg leading-none flex-shrink-0 -mt-1 -mr-1"
                  aria-label="关闭通知"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-col justify-between h-full">
        <div className="flex justify-between items-start">
          <div className="pointer-events-auto">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-red-500" />
              <span className="text-sm font-bold text-slate-300">HP</span>
            </div>
            <div className="w-48 md:w-64 h-6 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300 ${isLowHealth ? 'animate-pulse' : ''}`}
                style={{ width: `${(health / maxHealth) * 100}%` }}
              />
            </div>
            <div className="text-right text-xs font-bold text-red-400 mt-1">
              {Math.floor(health)}/{maxHealth}
            </div>

            <div className="flex items-center gap-2 mb-2 mt-3">
              <Shield className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-bold text-slate-300">Shield</span>
            </div>
            <div className="w-48 md:w-64 h-6 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300"
                style={{ width: `${(shield / maxShield) * 100}%` }}
              />
            </div>
            <div className="text-right text-xs font-bold text-blue-400 mt-1">
              {Math.floor(shield)}/{maxShield}
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-white drop-shadow-lg">Level {level}</div>
            <div className="text-sm text-slate-400 flex items-center justify-center gap-2">
              Wave {wave} / {totalWaves}
              <WaveBadge isBossWave={isBossWave} isEliteWave={isEliteWave} />
            </div>
            <div className="mt-1">
              <RankDisplay rank={rank} />
            </div>
            {difficultyInfo && difficultyInfo.adaptiveEnabled && <DifficultyIndicator info={difficultyInfo} />}
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Score</div>
            <div
              className={`text-2xl md:text-3xl font-bold text-white drop-shadow-lg transition-transform ${scoreAnimation ? 'scale-110' : ''}`}
            >
              {score.toLocaleString()}
            </div>
            <div className="flex items-center justify-end gap-3 mt-2">
              <div>
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider">
                  Kills
                </div>
                <div className="text-lg font-bold text-white drop-shadow-lg">{killCount}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider">
                  Enemies
                </div>
                <div className="text-lg font-bold text-white drop-shadow-lg">{enemiesRemaining}</div>
              </div>
            </div>
            {fps !== undefined && <div className="mt-2 flex justify-end"><FPSDisplay fps={fps} /></div>}
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <ComboDisplay combo={combo} maxCombo={maxCombo} />
        </div>

        {bossHealth !== undefined && bossMaxHealth !== undefined && bossHealth > 0 && (
          <div className="flex justify-center">
            <div className="w-full max-w-2xl">
              <BossHealthBar
                health={bossHealth}
                maxHealth={bossMaxHealth}
                name={bossName || 'Boss'}
              />
            </div>
          </div>
        )}

        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-2 pointer-events-auto">
            {activeEffects.length > 0 && (
              <div>
                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">
                  Active Effects
                </div>
                <div className="flex items-center gap-2">
                  {activeEffects.map((effect) => (
                    <EffectIndicator key={effect.type} effect={effect} />
                  ))}
                </div>
              </div>
            )}
            <SpeedDisplay speed={speed} maxSpeed={100} />
            <BoostDisplay
              isActive={isBoostActive}
              boostEnergy={boostEnergy}
              maxBoostEnergy={maxBoostEnergy}
            />
          </div>

          <div className="flex flex-col gap-2 pointer-events-auto">
            {weaponInfo && <WeaponDisplay weapon={weaponInfo} />}
            {skills.length > 0 && <SkillBar skills={skills} onActivate={onSkillActivate} />}
          </div>
        </div>
      </div>
    </div>
  );
});

export default GameHUD;
