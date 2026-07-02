import { ScoreSystem } from './ScoreSystem';

// 模拟localStorage抛出错误
const mockLocalStorageError = (() => {
  return {
    getItem: (_key: string) => {
      throw new Error('localStorage is not available');
    },
    setItem: (_key: string, _value: string) => {
      throw new Error('localStorage is not available');
    },
    clear: () => {
      throw new Error('localStorage is not available');
    },
    removeItem: (_key: string) => {
      throw new Error('localStorage is not available');
    },
  };
})();

describe('ScoreSystem with localStorage error', () => {
  let originalLocalStorage: Storage;

  beforeEach(() => {
    // 保存原始localStorage
    originalLocalStorage = (window as any).localStorage;

    // 替换为抛出错误的mock
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorageError,
      writable: true,
    });
  });

  afterEach(() => {
    // 恢复原始localStorage
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  });

  it('应该在localStorage不可用时正常初始化', () => {
    // 应该不会抛出错误
    const scoreSystem = new ScoreSystem();
    expect(scoreSystem).toBeDefined();
    expect(scoreSystem.getCurrentScore()).toBe(0);
  });

  it('应该在localStorage不可用时能够添加分数', () => {
    const scoreSystem = new ScoreSystem();
    scoreSystem.addScore(1000);
    expect(scoreSystem.getCurrentScore()).toBe(1000);
  });

  it('应该在localStorage不可用时能够处理高分记录', () => {
    const scoreSystem = new ScoreSystem();
    scoreSystem.addScore(1000);

    // 应该不会抛出错误，尽管无法保存到localStorage
    const result = scoreSystem.addHighScore('TestPlayer');
    expect(result).toBe(true); // 应该返回true，因为是新的高分

    // 高分应该在内存中可用
    const highScores = scoreSystem.getHighScores();
    expect(highScores.length).toBe(1);
    expect(highScores[0].score).toBe(1000);
  });

  it('应该在localStorage不可用时能够清除高分', () => {
    const scoreSystem = new ScoreSystem();
    scoreSystem.addScore(1000);
    scoreSystem.addHighScore('TestPlayer');

    // 应该不会抛出错误
    scoreSystem.clearHighScores();

    // 高分应该在内存中被清除
    const highScores = scoreSystem.getHighScores();
    expect(highScores.length).toBe(0);
  });

  it('应该在localStorage不可用时能够导入高分', () => {
    const scoreSystem = new ScoreSystem();
    const importData = JSON.stringify([
      { name: 'ImportedPlayer', score: 5000, date: '2023-01-01', level: 5 },
    ]);

    // 应该不会抛出错误
    const result = scoreSystem.importHighScores(importData);
    expect(result).toBe(true);

    // 高分应该在内存中可用
    const highScores = scoreSystem.getHighScores();
    expect(highScores.length).toBe(1);
    expect(highScores[0].score).toBe(5000);
  });
});
