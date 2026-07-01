/**
 * GameHUD 组件
 * 游戏界面HUD显示
 */

import React, { useState, useEffect, useMemo } from 'react';
import { HealthBar, ProgressBar, Text, Icon } from './ui';
import './GameHUD.css';

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

interface StatusBarProps {
    value: number;
    maxValue: number;
    label: string;
    color: 'red' | 'blue' | 'green' | 'yellow' | 'purple';
    flash?: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({
    value,
    maxValue,
    label,
    color,
    flash
}) => {
    return (
        <div className="hud-status-bar">
            <div className="hud-status-bar-label">{label}</div>
            <div className="hud-status-bar-bar">
                <ProgressBar
                    value={value}
                    maxValue={maxValue}
                    color={color}
                    size="small"
                    animation={flash ? 'pulse' : 'none'}
                />
            </div>
            <div className="hud-status-bar-value">
                {Math.floor(value)}/{maxValue}
            </div>
        </div>
    );
};

const BossHealthBar: React.FC<{
    health: number;
    maxHealth: number;
    name: string;
}> = ({ health, maxHealth, name }) => {
    const percentage = useMemo(() => {
        return Math.max(0, (health / maxHealth) * 100);
    }, [health, maxHealth]);

    return (
        <div className="hud-boss-bar">
            <div className="hud-boss-bar-header">
                <Icon name="skull" size={20} color="#ef4444" />
                <Text variant="h6" color="white" bold>
                    {name}
                </Text>
            </div>
            <div className="hud-boss-bar-track">
                <div
                    className="hud-boss-bar-fill"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div className="hud-boss-bar-text">
                {Math.floor(health)} / {maxHealth}
            </div>
        </div>
    );
};

const EffectIndicator: React.FC<{ effect: ActiveEffect }> = ({ effect }) => {
    const iconName = useMemo(() => {
        switch (effect.type.toLowerCase()) {
            case 'shield': return 'shield';
            case 'speed': return 'bolt';
            case 'fire': return 'fire';
            case 'invincible': return 'star';
            default: return 'gem';
        }
    }, [effect.type]);

    const progress = useMemo(() => {
        return (effect.remainingTime / effect.duration) * 100;
    }, [effect.remainingTime, effect.duration]);

    return (
        <div className="hud-effect-item">
            <Icon name={iconName as any} size={16} color="#a855f7" />
            <span className="hud-effect-name">{effect.type}</span>
            <div className="hud-effect-bar">
                <div
                    className="hud-effect-bar-fill"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

const WeaponDisplay: React.FC<{ weapon: WeaponInfo }> = ({ weapon }) => {
    return (
        <div className="hud-weapon-display">
            <Icon name="sword" size={18} color="#fbbf24" />
            <div className="hud-weapon-info">
                <Text variant="caption" bold color="white">
                    {weapon.name}
                </Text>
                <div className="hud-weapon-stats">
                    <span className="hud-weapon-stat">
                        <Icon name="target" size={12} color="#ef4444" />
                        {weapon.damage}
                    </span>
                    <span className="hud-weapon-stat">
                        <Icon name="bolt" size={12} color="#fbbf24" />
                        {(60000 / weapon.fireRate).toFixed(1)}/s
                    </span>
                </div>
            </div>
            {weapon.ammo !== undefined && (
                <div className="hud-weapon-ammo">
                    {weapon.ammo}/{weapon.maxAmmo}
                </div>
            )}
        </div>
    );
};

const SkillBar: React.FC<{ skills: SkillInfo[]; onActivate?: (index: number) => void }> = ({ skills, onActivate }) => {
    return (
        <div className="hud-skill-bar">
            <Text variant="caption" color="cyan" bold>
                SKILLS
            </Text>
            <div className="hud-skill-items">
                {skills.map((skill, index) => {
                    const cooldownPercent = skill.cooldown > 0 ? (skill.cooldown / skill.maxCooldown) * 100 : 0;
                    const isReady = skill.cooldown <= 0 && !skill.isActive;
                    
                    return (
                        <button
                            key={index}
                            className={`hud-skill-item ${skill.isActive ? 'active' : ''} ${!isReady ? 'cooldown' : ''}`}
                            onClick={() => onActivate?.(index)}
                            disabled={!isReady}
                        >
                            <Icon name={skill.icon as any} size={20} color={skill.isActive ? '#fbbf24' : isReady ? '#a855f7' : '#6b7280'} />
                            <span className="hud-skill-key">{skill.keyBinding}</span>
                            {skill.cooldown > 0 && (
                                <div className="hud-skill-cooldown-overlay" style={{ height: `${cooldownPercent}%` }} />
                            )}
                            {skill.isActive && (
                                <div className="hud-skill-active-glow" />
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
        <div className="hud-fps">
            <Icon name="bolt" size={14} color={color} />
            <span style={{ color }}>{Math.round(fps)} FPS</span>
        </div>
    );
};

export const GameHUD: React.FC<HUDProps> = ({
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
    onSkillActivate
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
        <div className="hud-container">
            {/* Top Left - Health & Shield */}
            <div className="hud-section hud-section--top-left">
                <HealthBar
                    value={health}
                    maxValue={maxHealth}
                    label="HP"
                    color="red"
                    size="small"
                    animation={isLowHealth ? 'pulse' : 'none'}
                    showExactValue
                />
                <HealthBar
                    value={shield}
                    maxValue={maxShield}
                    label="Shield"
                    color="blue"
                    size="small"
                    showExactValue
                />
            </div>

            {/* Top Center - Level & Wave Info */}
            <div className="hud-section hud-section--top-center">
                <div className="hud-level-info">
                    <Text variant="h5" color="white" bold align="center">
                        Level {level}
                    </Text>
                    <Text variant="caption" color="secondary" align="center">
                        Wave {wave} / {totalWaves}
                    </Text>
                </div>
            </div>

            {/* Top Right - Score & Enemies */}
            <div className="hud-section hud-section--top-right">
                <div className={`hud-score ${scoreAnimation ? 'hud-score--animated' : ''}`}>
                    <Text variant="caption" color="yellow" bold>
                        SCORE
                    </Text>
                    <Text variant="h4" color="white" bold>
                        {score.toLocaleString()}
                    </Text>
                </div>
                <div className="hud-enemies">
                    <Text variant="caption" color="danger" bold>
                        ENEMIES
                    </Text>
                    <Text variant="h5" color="white" bold>
                        {enemiesRemaining}
                    </Text>
                </div>
                {fps !== undefined && <FPSDisplay fps={fps} />}
            </div>

            {/* Boss Health Bar */}
            {bossHealth !== undefined && bossMaxHealth !== undefined && bossHealth > 0 && (
                <div className="hud-section hud-section--boss">
                    <BossHealthBar
                        health={bossHealth}
                        maxHealth={bossMaxHealth}
                        name={bossName || 'Boss'}
                    />
                </div>
            )}

            {/* Bottom Left - Active Effects */}
            {activeEffects.length > 0 && (
                <div className="hud-section hud-section--bottom-left">
                    <div className="hud-effects">
                        <Text variant="caption" color="purple" bold>
                            ACTIVE EFFECTS
                        </Text>
                        <div className="hud-effects-list">
                            {activeEffects.map((effect, index) => (
                                <EffectIndicator key={index} effect={effect} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Center - Weapon Info & Skills */}
            <div className="hud-section hud-section--bottom-center">
                {weaponInfo && <WeaponDisplay weapon={weaponInfo} />}
                {skills.length > 0 && <SkillBar skills={skills} onActivate={onSkillActivate} />}
            </div>
        </div>
    );
};

export default GameHUD;