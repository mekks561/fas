import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TouchControlOverlay } from './TouchControlOverlay';

describe('TouchControlOverlay', () => {
  const mockHandlers = {
    onMove: vi.fn(),
    onFire: vi.fn(),
    onBoost: vi.fn(),
    onSkill1: vi.fn(),
    onSkill2: vi.fn(),
    onSkill3: vi.fn(),
    onSkill4: vi.fn()
  };

  const mockCooldowns = {
    skill1: 0,
    skill2: 0,
    skill3: 0,
    skill4: 0
  };

  const mockMaxCooldowns = {
    skill1: 8,
    skill2: 10,
    skill3: 15,
    skill4: 20
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染测试', () => {
    it('应该正确渲染组件', () => {
      render(
        <TouchControlOverlay
          {...mockHandlers}
          skillCooldowns={mockCooldowns}
          skillMaxCooldowns={mockMaxCooldowns}
        />
      );

      expect(screen.getByRole('button', { name: /fire/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /boost/i })).toBeInTheDocument();
    });

    it('isVisible为false时不应该渲染', () => {
      render(
        <TouchControlOverlay
          {...mockHandlers}
          skillCooldowns={mockCooldowns}
          skillMaxCooldowns={mockMaxCooldowns}
          isVisible={false}
        />
      );

      expect(screen.queryByRole('button', { name: /fire/i })).not.toBeInTheDocument();
    });

    it('应该正确渲染技能按钮', () => {
      render(
        <TouchControlOverlay
          {...mockHandlers}
          skillCooldowns={mockCooldowns}
          skillMaxCooldowns={mockMaxCooldowns}
        />
      );

      // 技能按钮应该存在
      const skillButtons = screen.getAllByRole('button');
      expect(skillButtons.length).toBeGreaterThan(4);
    });
  });

  describe('冷却时间显示', () => {
    it('应该正确显示冷却时间', () => {
      const cooldownsWithActive = {
        skill1: 5,
        skill2: 0,
        skill3: 10,
        skill4: 0
      };

      render(
        <TouchControlOverlay
          {...mockHandlers}
          skillCooldowns={cooldownsWithActive}
          skillMaxCooldowns={mockMaxCooldowns}
        />
      );

      // 检查冷却时间显示
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('冷却时间为0时不应显示数字', () => {
      render(
        <TouchControlOverlay
          {...mockHandlers}
          skillCooldowns={mockCooldowns}
          skillMaxCooldowns={mockMaxCooldowns}
        />
      );

      // 没有冷却时间数字显示
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('触摸交互', () => {
    it('应该正确响应射击按钮触摸', () => {
      render(
        <TouchControlOverlay
          {...mockHandlers}
          skillCooldowns={mockCooldowns}
          skillMaxCooldowns={mockMaxCooldowns}
        />
      );

      const fireButton = screen.getByRole('button', { name: /fire/i });

      fireEvent.touchStart(fireButton);
      expect(mockHandlers.onFire).toHaveBeenCalledWith(true);

      fireEvent.touchEnd(fireButton);
      expect(mockHandlers.onFire).toHaveBeenCalledWith(false);
    });

    it('应该正确响应加速按钮触摸', () => {
      render(
        <TouchControlOverlay
          {...mockHandlers}
          skillCooldowns={mockCooldowns}
          skillMaxCooldowns={mockMaxCooldowns}
        />
      );

      const boostButton = screen.getByRole('button', { name: /boost/i });

      fireEvent.touchStart(boostButton);
      expect(mockHandlers.onBoost).toHaveBeenCalledWith(true);

      fireEvent.touchEnd(boostButton);
      expect(mockHandlers.onBoost).toHaveBeenCalledWith(false);
    });

    it('冷却期间不应触发技能', () => {
      const cooldownsWithActive = {
        skill1: 5,
        skill2: 0,
        skill3: 0,
        skill4: 0
      };

      render(
        <TouchControlOverlay
          {...mockHandlers}
          skillCooldowns={cooldownsWithActive}
          skillMaxCooldowns={mockMaxCooldowns}
        />
      );

      // 找到技能1按钮并尝试触发
      const skillButtons = screen.getAllByRole('button');
      const skill1Button = skillButtons.find(btn => btn.textContent?.includes('M'));

      if (skill1Button) {
        fireEvent.touchStart(skill1Button);
        // 冷却期间不应触发
        expect(mockHandlers.onSkill1).not.toHaveBeenCalled();
      }
    });
  });

  describe('响应式设计', () => {
    it('应该正确应用样式类', () => {
      render(
        <TouchControlOverlay
          {...mockHandlers}
          skillCooldowns={mockCooldowns}
          skillMaxCooldowns={mockMaxCooldowns}
        />
      );

      const fireButton = screen.getByRole('button', { name: /fire/i });
      const container = fireButton.closest('.pointer-events-none');
      expect(container).toHaveClass('pointer-events-none');
    });
  });
});