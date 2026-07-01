/**
 * ProgressBar 组件
 * 通用进度条组件
 */

import React, { memo, useMemo } from 'react';
import './ProgressBar.css';

export type ProgressBarColor = 'primary' | 'blue' | 'red' | 'green' | 'yellow' | 'purple';
export type ProgressBarSize = 'small' | 'medium' | 'large';

export interface ProgressBarProps {
  /** 当前进度值 */
  value: number;
  /** 最大值 */
  maxValue?: number;
  /** 颜色主题 */
  color?: ProgressBarColor;
  /** 尺寸 */
  size?: ProgressBarSize;
  /** 是否显示百分比 */
  showValue?: boolean;
  /** 是否显示标签 */
  label?: string;
  /** 动画类型 */
  animation?: 'none' | 'pulse' | 'stripes';
  /** 进度条宽度 */
  width?: string | number;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** className */
  className?: string;
  /** 是否反显（从右到左） */
  inverse?: boolean;
}

/**
 * ProgressBar 组件
 * 提供统一的进度条样式
 */
export const ProgressBar: React.FC<ProgressBarProps> = memo(({
  value,
  maxValue = 100,
  color = 'primary',
  size = 'medium',
  showValue = false,
  label,
  animation = 'none',
  width,
  style,
  className = '',
  inverse = false
}) => {
  // 计算百分比
  const percentage = useMemo(() => {
    const percent = Math.max(0, Math.min(100, (value / maxValue) * 100));
    return inverse ? 100 - percent : percent;
  }, [value, maxValue, inverse]);

  // 格式化显示值
  const displayValue = useMemo(() => {
    return Math.round((value / maxValue) * 100);
  }, [value, maxValue]);

  // 构建类名
  const containerClass = useMemo(() => {
    const classes = ['progress-bar-container'];
    if (className) classes.push(className);
    return classes.join(' ');
  }, [className]);

  const barClass = useMemo(() => {
    const classes = [
      'progress-bar',
      `progress-bar--${color}`,
      `progress-bar--${size}`
    ];
    if (animation !== 'none') classes.push(`progress-bar--${animation}`);
    return classes.join(' ');
  }, [color, size, animation]);

  // 容器样式
  const containerStyle = useMemo<React.CSSProperties>(() => {
    return {
      width: width || '100%',
      ...style
    };
  }, [width, style]);

  return (
    <div className={containerClass} style={containerStyle}>
      {(label || showValue) && (
        <div className="progress-bar-header">
          {label && <span className="progress-bar-label">{label}</span>}
          {showValue && <span className="progress-bar-value">{displayValue}%</span>}
        </div>
      )}
      <div className="progress-bar-track">
        <div
          className={barClass}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={maxValue}
          style={{ width: `${percentage}%` }}
        >
          {animation === 'stripes' && <div className="progress-bar-stripes"></div>}
        </div>
      </div>
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;