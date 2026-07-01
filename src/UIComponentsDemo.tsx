/**
 * UI组件使用示例
 * 展示如何使用基础UI组件库
 */

import React, { useState } from 'react';
import { Button, ProgressBar, HealthBar, Icon, Text } from './components/ui';
import './App.css';

// 示例1: Button组件使用
export const ButtonExamples: React.FC = () => {
  return (
    <div className="example-section">
      <Text variant="h3">Button 组件示例</Text>
      
      {/* 基础按钮 */}
      <div className="example-row">
        <Button variant="primary">主要按钮</Button>
        <Button variant="secondary">次要按钮</Button>
        <Button variant="danger">危险按钮</Button>
        <Button variant="success">成功按钮</Button>
        <Button variant="ghost">幽灵按钮</Button>
      </div>
      
      {/* 不同尺寸 */}
      <div className="example-row">
        <Button size="small">小按钮</Button>
        <Button size="medium">中按钮</Button>
        <Button size="large">大按钮</Button>
      </div>
      
      {/* 带图标 */}
      <div className="example-row">
        <Button leftIcon={<Icon name="play" size={16} />}>开始游戏</Button>
        <Button rightIcon={<Icon name="arrow-right" size={16} />}>继续</Button>
        <Button 
          variant="danger" 
          leftIcon={<Icon name="close" size={16} />}
        >
          退出游戏
        </Button>
      </div>
      
      {/* 加载状态 */}
      <div className="example-row">
        <Button loading>加载中...</Button>
        <Button disabled>禁用按钮</Button>
        <Button fullWidth>全宽按钮</Button>
      </div>
    </div>
  );
};

// 示例2: ProgressBar组件使用
export const ProgressBarExamples: React.FC = () => {
  const [progress, setProgress] = useState(60);
  
  return (
    <div className="example-section">
      <Text variant="h3">ProgressBar 组件示例</Text>
      
      {/* 基础进度条 */}
      <div className="example-row vertical">
        <ProgressBar value={progress} maxValue={100} showValue label="进度" />
        
        {/* 控制进度 */}
        <div className="button-group">
          <Button size="small" onClick={() => setProgress(p => Math.max(0, p - 10))}>
            减少 10%
          </Button>
          <Button size="small" onClick={() => setProgress(p => Math.min(100, p + 10))}>
            增加 10%
          </Button>
        </div>
      </div>
      
      {/* 不同颜色 */}
      <div className="example-row vertical">
        <ProgressBar value={30} color="primary" label="主要颜色" />
        <ProgressBar value={50} color="red" label="红色" />
        <ProgressBar value={70} color="green" label="绿色" />
        <ProgressBar value={90} color="yellow" label="黄色" />
        <ProgressBar value={100} color="purple" label="紫色" />
      </div>
      
      {/* 不同尺寸 */}
      <div className="example-row vertical">
        <ProgressBar value={40} size="small" label="小尺寸" />
        <ProgressBar value={60} size="medium" label="中尺寸" />
        <ProgressBar value={80} size="large" label="大尺寸" />
      </div>
      
      {/* 动画效果 */}
      <div className="example-row vertical">
        <ProgressBar value={50} animation="stripes" label="条纹动画" />
        <ProgressBar value={75} animation="pulse" label="脉冲动画" />
      </div>
    </div>
  );
};

// 示例3: HealthBar组件使用
export const HealthBarExamples: React.FC = () => {
  const [health, setHealth] = useState(80);
  const [shield, setShield] = useState(50);
  
  return (
    <div className="example-section">
      <Text variant="h3">HealthBar 组件示例</Text>
      
      {/* 基础生命条 */}
      <div className="example-row vertical">
        <HealthBar 
          value={health} 
          maxValue={100} 
          label="生命值" 
          showValue
        />
        
        <div className="button-group">
          <Button 
            size="small" 
            variant="danger"
            onClick={() => setHealth(h => Math.max(0, h - 20))}
          >
            受伤 -20
          </Button>
          <Button 
            size="small" 
            variant="success"
            onClick={() => setHealth(h => Math.min(100, h + 20))}
          >
            治疗 +20
          </Button>
        </div>
      </div>
      
      {/* 护盾条 */}
      <div className="example-row vertical">
        <HealthBar 
          value={shield} 
          maxValue={100} 
          color="blue" 
          label="护盾值" 
        />
        
        <div className="button-group">
          <Button 
            size="small" 
            variant="danger"
            onClick={() => setShield(s => Math.max(0, s - 15))}
          >
            消耗护盾 -15
          </Button>
          <Button 
            size="small" 
            variant="success"
            onClick={() => setShield(s => Math.min(100, s + 15))}
          >
            充能护盾 +15
          </Button>
        </div>
      </div>
      
      {/* 低血量动画 */}
      <div className="example-row vertical">
        <HealthBar 
          value={20} 
          maxValue={100} 
          label="低血量 (20%)" 
          animation="pulse"
        />
        <HealthBar 
          value={10} 
          maxValue={100} 
          label="危急血量 (10%)" 
          animation="flash"
        />
      </div>
      
      {/* 不同尺寸 */}
      <div className="example-row vertical">
        <HealthBar value={60} size="small" label="小尺寸" />
        <HealthBar value={80} size="medium" label="中尺寸" />
        <HealthBar value={100} size="large" label="大尺寸" />
      </div>
      
      {/* 精确数值显示 */}
      <div className="example-row vertical">
        <HealthBar 
          value={75} 
          maxValue={100} 
          showExactValue
          label="精确数值 (75/100)"
        />
      </div>
    </div>
  );
};

// 示例4: Icon组件使用
export const IconExamples: React.FC = () => {
  const iconNames = [
    'play', 'pause', 'stop', 'settings', 'close', 'check',
    'plus', 'minus', 'star', 'heart', 'shield', 'sword',
    'bolt', 'fire', 'rocket', 'target', 'trophy', 'medal'
  ] as const;
  
  return (
    <div className="example-section">
      <Text variant="h3">Icon 组件示例</Text>
      
      {/* 图标展示 */}
      <div className="icon-grid">
        {iconNames.map(name => (
          <div key={name} className="icon-item">
            <Icon name={name} size={32} />
            <span>{name}</span>
          </div>
        ))}
      </div>
      
      {/* 不同尺寸 */}
      <div className="example-row">
        <Icon name="star" size={16} color="#fbbf24" />
        <Icon name="star" size={24} color="#fbbf24" />
        <Icon name="star" size={32} color="#fbbf24" />
        <Icon name="star" size={48} color="#fbbf24" />
        <Icon name="star" size={64} color="#fbbf24" />
      </div>
      
      {/* 不同颜色 */}
      <div className="example-row">
        <Icon name="heart" size={32} color="#ef4444" />
        <Icon name="heart" size={32} color="#22c55e" />
        <Icon name="heart" size={32} color="#3b82f6" />
        <Icon name="heart" size={32} color="#a855f7" />
        <Icon name="heart" size={32} color="#eab308" />
      </div>
    </div>
  );
};

// 示例5: Text组件使用
export const TextExamples: React.FC = () => {
  return (
    <div className="example-section">
      <Text variant="h3">Text 组件示例</Text>
      
      {/* 标题变体 */}
      <div className="example-row vertical">
        <Text variant="h1">H1 标题</Text>
        <Text variant="h2">H2 标题</Text>
        <Text variant="h3">H3 标题</Text>
        <Text variant="h4">H4 标题</Text>
        <Text variant="h5">H5 标题</Text>
        <Text variant="h6">H6 标题</Text>
      </div>
      
      {/* 颜色变体 */}
      <div className="example-row vertical">
        <Text color="primary">主要颜色文本</Text>
        <Text color="secondary">次要颜色文本</Text>
        <Text color="danger">危险文本</Text>
        <Text color="success">成功文本</Text>
        <Text color="warning">警告文本</Text>
      </div>
      
      {/* 文本样式 */}
      <div className="example-row vertical">
        <Text bold>加粗文本</Text>
        <Text italic>斜体文本</Text>
        <Text underline>下划线文本</Text>
        <Text strikethrough>删除线文本</Text>
      </div>
      
      {/* 渐变效果 */}
      <div className="example-row vertical">
        <Text variant="h2" gradient="primary">渐变主色调</Text>
        <Text variant="h2" gradient="fire">火焰渐变</Text>
        <Text variant="h2" gradient="ice">冰霜渐变</Text>
      </div>
      
      {/* 对齐方式 */}
      <div className="example-row vertical">
        <Text align="left">左对齐文本</Text>
        <Text align="center">居中文本</Text>
        <Text align="right">右对齐文本</Text>
      </div>
      
      {/* 发光效果 */}
      <div className="example-row vertical">
        <Text variant="h2" glow glowColor="#3b82f6">蓝色发光</Text>
        <Text variant="h2" glow glowColor="#ef4444">红色发光</Text>
        <Text variant="h2" glow glowColor="#22c55e">绿色发光</Text>
      </div>
    </div>
  );
};

// 主示例组件
export const UIComponentsDemo: React.FC = () => {
  return (
    <div className="ui-components-demo">
      <Text variant="h1" align="center" gradient="primary" glow>
        UI 组件库演示
      </Text>
      
      <ButtonExamples />
      <ProgressBarExamples />
      <HealthBarExamples />
      <IconExamples />
      <TextExamples />
    </div>
  );
};

export default UIComponentsDemo;