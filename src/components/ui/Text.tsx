/**
 * Text 组件
 * 文本格式化组件
 */

import React, { memo, useMemo } from 'react';
import './Text.css';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'caption' | 'overline';
export type TextColor = 'default' | 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'white' | 'muted';
export type TextAlign = 'left' | 'center' | 'right';

export interface TextProps {
  /** 文本内容 */
  children?: React.ReactNode;
  /** 文本变体 */
  variant?: TextVariant;
  /** 颜色 */
  color?: TextColor;
  /** 对齐方式 */
  align?: TextAlign;
  /** 是否加粗 */
  bold?: boolean;
  /** 是否斜体 */
  italic?: boolean;
  /** 是否带下划线 */
  underline?: boolean;
  /** 是否带删除线 */
  strikethrough?: boolean;
  /** 行高 */
  lineHeight?: number | string;
  /** 字母间距 */
  letterSpacing?: number | string;
  /** 最大行数 */
  maxLines?: number;
  /** 文本截断方式 */
  truncate?: 'none' | 'ellipsis' | 'clip';
  /** 是否显示渐变 */
  gradient?: 'none' | 'primary' | 'fire' | 'ice';
  /** 是否显示发光效果 */
  glow?: boolean;
  /** glow颜色 */
  glowColor?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** className */
  className?: string;
  /** 其他HTML属性 */
  [key: string]: any;
}

/**
 * Text 组件
 * 提供统一的文本样式
 */
export const Text: React.FC<TextProps> = memo(({
  children,
  variant = 'body',
  color = 'default',
  align = 'left',
  bold = false,
  italic = false,
  underline = false,
  strikethrough = false,
  lineHeight,
  letterSpacing,
  maxLines,
  truncate = 'none',
  gradient = 'none',
  glow = false,
  glowColor,
  style,
  className = '',
  ...props
}) => {
  // 构建类名
  const classNames = useMemo(() => {
    const classes = ['ui-text', `ui-text--${variant}`, `ui-text--${color}`, `ui-text--${align}`];
    
    if (bold) classes.push('ui-text--bold');
    if (italic) classes.push('ui-text--italic');
    if (underline) classes.push('ui-text--underline');
    if (strikethrough) classes.push('ui-text--strikethrough');
    if (maxLines) classes.push('ui-text--clamp');
    if (truncate !== 'none') classes.push(`ui-text--truncate-${truncate}`);
    if (gradient !== 'none') classes.push(`ui-text--gradient-${gradient}`);
    if (glow) classes.push('ui-text--glow');
    if (className) classes.push(className);
    
    return classes.join(' ');
  }, [variant, color, align, bold, italic, underline, strikethrough, maxLines, truncate, gradient, glow, className]);

  // 构建样式
  const customStyle = useMemo<React.CSSProperties>(() => {
    const styles: React.CSSProperties = { ...style };
    
    if (lineHeight) {
      styles.lineHeight = typeof lineHeight === 'number' ? `${lineHeight}em` : lineHeight;
    }
    
    if (letterSpacing) {
      styles.letterSpacing = typeof letterSpacing === 'number' ? `${letterSpacing}px` : letterSpacing;
    }
    
    if (maxLines) {
      styles['--text-max-lines'] = maxLines;
    }
    
    if (glowColor) {
      styles['--text-glow-color'] = glowColor;
    }
    
    return styles;
  }, [lineHeight, letterSpacing, maxLines, glowColor, style]);

  // 根据变体选择HTML标签
  const Component = useMemo(() => {
    switch (variant) {
      case 'h1': return 'h1';
      case 'h2': return 'h2';
      case 'h3': return 'h3';
      case 'h4': return 'h4';
      case 'h5': return 'h5';
      case 'h6': return 'h6';
      case 'caption': return 'span';
      case 'overline': return 'span';
      default: return 'p';
    }
  }, [variant]);

  return (
    <Component
      className={classNames}
      style={customStyle}
      {...props}
    >
      {children}
    </Component>
  );
});

Text.displayName = 'Text';

// 便捷的预设组件
export const Title: React.FC<Omit<TextProps, 'variant'>> = (props) => (
  <Text variant="h1" {...props} />
);

export const Subtitle: React.FC<Omit<TextProps, 'variant'>> = (props) => (
  <Text variant="h2" {...props} />
);

export const Heading: React.FC<Omit<TextProps, 'variant'>> = (props) => (
  <Text variant="h3" {...props} />
);

export const Body: React.FC<Omit<TextProps, 'variant'>> = (props) => (
  <Text variant="body" {...props} />
);

export const Caption: React.FC<Omit<TextProps, 'variant'>> = (props) => (
  <Text variant="caption" {...props} />
);

export default Text;