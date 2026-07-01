/**
 * Button 组件
 * 统一的按钮组件，支持多种变体和尺寸
 */

import React, { memo, useCallback, useMemo } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮变体样式 */
  variant?: ButtonVariant;
  /** 按钮尺寸 */
  size?: ButtonSize;
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 是否全宽显示 */
  fullWidth?: boolean;
  /** 左侧图标 */
  leftIcon?: React.ReactNode;
  /** 右侧图标 */
  rightIcon?: React.ReactNode;
  /** 点击回调 */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** 子元素 */
  children?: React.ReactNode;
}

/**
 * Button 组件
 * 提供统一的按钮样式，支持多种变体和尺寸
 */
export const Button: React.FC<ButtonProps> = memo(({
  variant = 'primary',
  size = 'medium',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  onClick,
  children,
  disabled,
  className = '',
  ...props
}) => {
  // 稳定化类名计算
  const buttonClass = useMemo(() => {
    const classes = [
      'ui-button',
      `ui-button--${variant}`,
      `ui-button--${size}`,
    ];
    
    if (fullWidth) classes.push('ui-button--full-width');
    if (loading) classes.push('ui-button--loading');
    if (disabled || loading) classes.push('ui-button--disabled');
    if (className) classes.push(className);
    
    return classes.join(' ');
  }, [variant, size, fullWidth, loading, disabled, className]);

  // 稳定化点击处理
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }, [disabled, loading, onClick]);

  // 渲染图标
  const renderLeftIcon = useMemo(() => {
    if (!leftIcon) return null;
    return <span className="ui-button__icon ui-button__icon--left">{leftIcon}</span>;
  }, [leftIcon]);

  const renderRightIcon = useMemo(() => {
    if (!rightIcon) return null;
    return <span className="ui-button__icon ui-button__icon--right">{rightIcon}</span>;
  }, [rightIcon]);

  // 渲染加载指示器
  const renderLoading = useMemo(() => {
    if (!loading) return null;
    return (
      <span className="ui-button__spinner">
        <span className="ui-button__spinner-dot"></span>
        <span className="ui-button__spinner-dot"></span>
        <span className="ui-button__spinner-dot"></span>
      </span>
    );
  }, [loading]);

  return (
    <button
      className={buttonClass}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {renderLoading}
      {renderLeftIcon}
      {children && <span className="ui-button__text">{children}</span>}
      {renderRightIcon}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;