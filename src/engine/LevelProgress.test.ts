import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLevelProgress,
  isLevelCleared,
  markLevelCleared,
  type LevelProgressMap,
} from './LevelProgress';

describe('LevelProgress', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('无存档时返回空表', () => {
    expect(getLevelProgress()).toEqual({});
    expect(isLevelCleared(1)).toBe(false);
  });

  it('记录通关后能读回', () => {
    markLevelCleared(1, 2);
    expect(isLevelCleared(1)).toBe(true);
    const map: LevelProgressMap = getLevelProgress();
    expect(map['1'].cleared).toBe(true);
    expect(map['1'].stars).toBe(2);
  });

  it('星级取历史最好成绩，不被低星覆盖', () => {
    markLevelCleared(1, 3);
    markLevelCleared(1, 1);
    expect(getLevelProgress()['1'].stars).toBe(3);
  });

  it('星级被夹在 0-3 且取整', () => {
    markLevelCleared(2, 9);
    expect(getLevelProgress()['2'].stars).toBe(3);
    markLevelCleared(3, -1);
    expect(getLevelProgress()['3'].stars).toBe(0);
    markLevelCleared(4, 1.7);
    expect(getLevelProgress()['4'].stars).toBe(1);
  });

  it('最高分取历史最高', () => {
    markLevelCleared(1, 1, 500);
    markLevelCleared(1, 1, 300);
    expect(getLevelProgress()['1'].highScore).toBe(500);
    markLevelCleared(1, 1, 900);
    expect(getLevelProgress()['1'].highScore).toBe(900);
  });

  it('损坏的存档不抛异常，按空表处理', () => {
    localStorage.setItem('levelProgress', '{not json');
    expect(getLevelProgress()).toEqual({});
    expect(isLevelCleared(1)).toBe(false);
  });

  it('多关并存互不影响', () => {
    markLevelCleared(1, 1);
    markLevelCleared(2, 3);
    expect(isLevelCleared(1)).toBe(true);
    expect(isLevelCleared(2)).toBe(true);
    expect(isLevelCleared(3)).toBe(false);
    expect(getLevelProgress()['2'].stars).toBe(3);
  });
});
