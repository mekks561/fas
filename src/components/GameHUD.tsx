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
} from 'lucide-react';

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

const EffectIndicator: React.FC<{ effect: ActiveEffect }> = ({ effect }) => {
  const iconName = useMemo(() => {
    switch (effect.type.toLowerCase()) {
      case 'shield':
        return ShieldCheck;
      case 'speed':
        return Zap;
      case 'fire':
        return Flame;
      case 'invincible':
        return Star;
      default:
        return Gem;
    }
  }, [effect.type]);

  const progress = useMemo(() => {
    return (effect.remainingTime / effect.duration) * 100;
  }, [effect.remainingTime, effect.duration]);

  const IconComponent = iconName;

  return (
    <div className="flex flex-col items-center gap-1 bg-slate-800/80 rounded-lg p-2">
      <div className="relative">
        <IconComponent className="w-5 h-5 text-purple-400" />
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
              key={index}
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
}) => {
  const [scoreAnimation, setScoreAnimation] = useState(false);
  const [prevScore, setPrevScore] = useState(score);

  useEffect(() => {
    if (score > prevScore) {
      setScoreAnimation(true);
      setTimeout(() => setScoreAnimation(false), 500);
    }
    setPrevScore(score);
  }, [score, prevScore]);

  const isLowHealth = useMemo(() => {
    return health < maxHealth * 0.3;
  }, [health, maxHealth]);

  return (
    <div className="absolute inset-0 pointer-events-none p-4 md:p-6">
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
            <div className="text-sm text-slate-400">
              Wave {wave} / {totalWaves}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Score</div>
            <div
              className={`text-2xl md:text-3xl font-bold text-white drop-shadow-lg transition-transform ${scoreAnimation ? 'scale-110' : ''}`}
            >
              {score.toLocaleString()}
            </div>
            <div className="text-xs font-bold text-red-400 uppercase tracking-wider mt-2">
              Enemies
            </div>
            <div className="text-xl font-bold text-white drop-shadow-lg">{enemiesRemaining}</div>
            {fps !== undefined && <FPSDisplay fps={fps} />}
          </div>
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
          {activeEffects.length > 0 && (
            <div className="pointer-events-auto">
              <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">
                Active Effects
              </div>
              <div className="flex items-center gap-2">
                {activeEffects.map((effect, index) => (
                  <EffectIndicator key={index} effect={effect} />
                ))}
              </div>
            </div>
          )}

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
