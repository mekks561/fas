import { describe, it, expect } from 'vitest';
import {
  EXP_PER_WAVE,
  EXP_PER_LEVEL_LATE,
  MAX_LEVEL,
  expForLevel,
  levelForExp,
  expToNextLevel,
  expProgressInLevel,
} from './Experience';
import { getAllLevels, recommendedLevelForIndex, waveCountOf } from '../levels';

describe('Experience 经验曲线', () => {
  it('1 级恒为 0 经验', () => {
    expect(expForLevel(1)).toBe(0);
    expect(expForLevel(0)).toBe(0);
    expect(expForLevel(-5)).toBe(0);
  });

  it('1~4 级每级 1 波（与旧的「每清一波 +1 级」等价）', () => {
    expect(expForLevel(2)).toBe(EXP_PER_WAVE);
    expect(expForLevel(3)).toBe(2 * EXP_PER_WAVE);
    expect(expForLevel(4)).toBe(3 * EXP_PER_WAVE);
  });

  it('5 级起步长翻倍（抑制天赋点通胀）', () => {
    expect(expForLevel(5)).toBe(3 * EXP_PER_WAVE + EXP_PER_LEVEL_LATE);
    expect(expForLevel(6)).toBe(3 * EXP_PER_WAVE + 2 * EXP_PER_LEVEL_LATE);
  });

  it('曲线严格单调递增', () => {
    for (let level = 1; level < MAX_LEVEL; level++) {
      expect(expForLevel(level + 1)).toBeGreaterThan(expForLevel(level));
    }
  });

  it('levelForExp 是 expForLevel 的逆（往返一致）', () => {
    for (let level = 1; level <= 40; level++) {
      expect(levelForExp(expForLevel(level))).toBe(level);
    }
  });

  it('区间内每个经验值都落在正确的等级（不变式 expForLevel(levelForExp(e)) <= e）', () => {
    for (let e = 0; e <= 2000; e += 7) {
      const level = levelForExp(e);
      expect(expForLevel(level)).toBeLessThanOrEqual(e);
      if (level < MAX_LEVEL) expect(expForLevel(level + 1)).toBeGreaterThan(e);
    }
  });

  it('负数 / NaN / 非有限值一律回落到 1 级 0 经验', () => {
    expect(levelForExp(-1)).toBe(1);
    expect(levelForExp(Number.NaN)).toBe(1);
    expect(levelForExp(Number.POSITIVE_INFINITY)).toBe(MAX_LEVEL);
  });

  it('封顶在 MAX_LEVEL', () => {
    expect(levelForExp(1e9)).toBe(MAX_LEVEL);
    expect(expToNextLevel(1e9)).toBe(0);
    expect(expProgressInLevel(1e9)).toBe(1);
  });

  it('expToNextLevel / expProgressInLevel 自洽', () => {
    expect(expToNextLevel(0)).toBe(EXP_PER_WAVE);
    expect(expProgressInLevel(0)).toBe(0);
    expect(expProgressInLevel(EXP_PER_WAVE / 2)).toBeCloseTo(0.5, 6);
    expect(expToNextLevel(EXP_PER_WAVE / 2)).toBe(EXP_PER_WAVE / 2);
  });
});

/**
 * 按顺序清完前 `levelCount` 关之后的累计经验
 * （每关 = 波数 × 每波经验 + 关卡通关奖励经验）。
 */
function cumulativeExpAfterClearing(levelCount: number): number {
  const levels = getAllLevels();
  let exp = 0;
  for (let i = 0; i < levelCount; i++) {
    const level = levels[i];
    exp += waveCountOf(level) * EXP_PER_WAVE + level.rewards.experience;
  }
  return exp;
}

describe('Experience 与关卡解锁门槛的一致性（防漂移护栏）', () => {
  /**
   * 关卡解锁由 `currentPlayerLevel >= recommendedLevelForIndex(index)` 判定。
   * 只要「按顺序打完前一关之后，等级必须已经够开下一关」，玩家就不会被锁死。
   * 这条用例的意义是：以后**调曲线时**（改 EXP_PER_WAVE / 步长）它会立刻指出
   * 是哪一关变得开不了了，而不是等玩家玩到那儿才发现。
   */
  it('打完第 i 关后，等级足够解锁第 i+1 关', () => {
    const levels = getAllLevels();
    for (let i = 1; i < levels.length; i++) {
      const level = levelForExp(cumulativeExpAfterClearing(i));
      const required = recommendedLevelForIndex(i);
      expect(
        level,
        `清完前 ${i} 关后等级 ${level} < 第 ${i + 1} 关门槛 ${required}`,
      ).toBeGreaterThanOrEqual(required);
    }
  });

  it('清完一波就够 1 点天赋（等级至少 +1）', () => {
    expect(levelForExp(EXP_PER_WAVE)).toBe(2);
  });

  it('清完第 1 关后等级为 4（与改造前「每波 +1 级」的结果一致）', () => {
    expect(levelForExp(cumulativeExpAfterClearing(1))).toBe(4);
  });
});
