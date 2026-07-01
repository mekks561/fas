/**
 * HealthBar 组件
 * 专门用于显示生命值、护盾值等游戏属性
 */

import React, { memo, useMemo, useEffect, useState } from 'react';
import './HealthBar.css';

export type HealthBarColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple';
export type HealthBarSize = 'small' | 'medium' | 'large';

export interface HealthBarProps {
  /** 当前值 */
  value: number;
  /** 最大值 */
  maxValue: number;
  /** 标签文本 */
  label?: string;
  /** 颜色主题 */
  color?: HealthBarColor;
  /** 尺寸 */
  size?: HealthBarSize;
  /** 是否显示数值 */
  showValue?: boolean;
  /** 是否显示最大/当前格式 (50/100) */
  showExactValue?: boolean;
  /** 动画类型 */
  animation?: 'none' | 'pulse' | 'flash';
  /** 低血量阈值 (百分比) */
  lowThreshold?: number;
  /** 是否显示伤害数字飘字 */
  showDamageNumber?: boolean;
  /** 受伤回调 */
  onDamage?: (amount: number) => void;
  /** 宽度 */
  width?: string | number;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** className */
  className?: string;
}

interface DamageNumber {
  id: number;
  value: number;
  timestamp: number;
}

/**
 * HealthBar 组件
 * 提供游戏风格的属性条显示
 */
export const HealthBar: React.FC<HealthBarProps> = memo(({
  value,
  maxValue,
  label,
  color = 'red',
  size = 'medium',
  showValue = true,
  showExactValue = false,
  animation = 'none',
  lowThreshold = 30,
  showDamageNumber = false,
  onDamage,
  width,
  style,
  className = ''
}) => {
  // 伤害数字状态
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  
  // 计算百分比
  const percentage = useMemo(() => {
    return Math.max(0, Math.min(100, (value / maxValue) * 100));
  }, [value, maxValue]);

  // 是否为低血量
  const isLow = useMemo(() => {
    return percentage <= lowThreshold;
  }, [percentage, lowThreshold]);

  // 是否为极低血量
  const isCritical = useMemo(() => {
    return percentage <= lowThreshold / 2;
  }, [percentage, lowThreshold]);

  // 监测伤害
  useEffect(() => {
    const prevValue = value;
    // 这里可以添加伤害检测逻辑
  }, [value]);

  // 显示值文本
  const displayText = useMemo(() => {
    if (showExactValue) {
      return `${Math.ceil(value)}/${maxValue}`;
    }
    if (showValue) {
      return Math.ceil(value).toString();
    }
    return '';
  }, [value, maxValue, showValue, showExactValue]);

  // 构建类名
  const containerClass = useMemo(() => {
    const classes = ['health-bar-container'];
    if (isLow) classes.push('health-bar-container--low');
    if (isCritical) classes.push('health-bar-container--critical');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [isLow, isCritical, className]);

  const barClass = useMemo(() => {
    const classes = [
      'health-bar',
      `health-bar--${color}`,
      `health-bar--${size}`
    ];
    if (isLow) classes.push('health-bar--low');
    if (isCritical) classes.push('health-bar--critical');
    if (animation !== 'none' && isLow) classes.push(`health-bar--${animation}`);
    return classes.join(' ');
  }, [color, size, isLow, isCritical, animation]);

  // 容器样式
  const containerStyle = useMemo<React.CSSProperties>(() => {
    return {
      width: width || '100%',
      ...style
    };
  }, [width, style]);

  return (
    <div className={containerClass} style={containerStyle}>
      {(label || showValue || showExactValue) && (
        <div className="health-bar-header">
          {label && <span className="health-bar-label">{label}</span>}
          {showValue && !showExactValue && (
            <span className="health-bar-value">{displayText}</span>
          )}
          {showExactValue && (
            <span className="health-bar-value-exact">{displayText}</span>
          )}
        </div>
      )}
      <div className="health-bar-track">
        <div
          className={barClass}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={maxValue}
          style={{ width: `${percentage}%` }}
        >
          {/* 血量纹理 */}
          <div className="health-bar-texture"></div>
          
          {/* 受伤遮罩 */}
          <div className="health-bar-damage-overlay"></div>
        </div>
        
        {/* 护盾条 */}
        {color === 'blue' && (
          <div 
            className="health-bar-shield"
            style={{ width: `${Math.min(percentage * 0.5, 50)}%` }}
          ></div>
        )}
      </div>
      
      {/* 伤害数字 */}
      {showDamageNumber && damageNumbers.length > 0 && (
        <div className="health-bar-damage-numbers">
          {damageNumbers.map(dmg => (
            <div key={dmg.id} className="damage-number">
              -{dmg.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

HealthBar.displayName = 'HealthBar';

export default HealthBar;