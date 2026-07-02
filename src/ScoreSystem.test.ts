import { ScoreSystem } from './ScoreSystem';

// 模拟localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

// 替换全局localStorage
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('ScoreSystem', () => {
  let scoreSystem: ScoreSystem;

  beforeEach(() => {
    // 清除localStorage并创建新的ScoreSystem实例
    localStorage.clear();
    scoreSystem = new ScoreSystem();
  });

  describe('初始化', () => {
    it('应该正确初始化分数系统', () => {
      expect(scoreSystem.getCurrentScore()).toBe(0);
      expect(scoreSystem.getScoreMultiplier()).toBe(1);
      expect(scoreSystem.getMultiplierTimeLeft()).toBe(0);
      expect(scoreSystem.getHighScores().length).toBe(0);
    });

    it('应该从localStorage加载高分记录', () => {
      // 预填充localStorage
      const mockScores = [
        { name: 'Player1', score: 1000, date: '2023-01-01', level: 1 },
        { name: 'Player2', score: 2000, date: '2023-01-02', level: 2 },
      ];
      localStorage.setItem('fighterGameHighScores', JSON.stringify(mockScores));

      // 创建新实例，应该加载预填充的高分
      const newScoreSystem = new ScoreSystem();
      const highScores = newScoreSystem.getHighScores();

      expect(highScores.length).toBe(2);
      expect(highScores[0].score).toBe(2000); // 应该按分数降序排序
      expect(highScores[1].score).toBe(1000);
    });

    it('应该处理无效的localStorage数据', () => {
      // 存储无效数据
      localStorage.setItem('fighterGameHighScores', 'invalid json');

      // 创建新实例，应该处理无效数据
      const newScoreSystem = new ScoreSystem();
      expect(newScoreSystem.getHighScores().length).toBe(0);
    });
  });

  describe('分数管理', () => {
    it('应该正确添加分数', () => {
      scoreSystem.addScore(100);
      expect(scoreSystem.getCurrentScore()).toBe(100);

      scoreSystem.addScore(200);
      expect(scoreSystem.getCurrentScore()).toBe(300);
    });

    it('应该正确添加击杀分数', () => {
      scoreSystem.addKillScore();
      expect(scoreSystem.getCurrentScore()).toBe(100); // 默认基础击杀分数是100

      scoreSystem.addKillScore(2);
      expect(scoreSystem.getCurrentScore()).toBe(300); // 100 + (100 * 2)
    });

    it('应该正确应用分数倍数', () => {
      scoreSystem.setMultiplier(2, 5); // 2倍分数，持续5秒
      scoreSystem.addScore(100);
      expect(scoreSystem.getCurrentScore()).toBe(200); // 100 * 2

      scoreSystem.setMultiplier(3, 5); // 3倍分数，持续5秒
      scoreSystem.addScore(100);
      expect(scoreSystem.getCurrentScore()).toBe(500); // 200 + (100 * 3)
    });

    it('应该在倍数时间结束后重置倍数', () => {
      scoreSystem.setMultiplier(2, 0.5); // 2倍分数，持续0.5秒
      expect(scoreSystem.getScoreMultiplier()).toBe(2);

      // 更新超过倍数持续时间
      scoreSystem.update(1);
      expect(scoreSystem.getScoreMultiplier()).toBe(1);
      expect(scoreSystem.getMultiplierTimeLeft()).toBe(0);

      // 倍数应该已重置
      scoreSystem.addScore(100);
      expect(scoreSystem.getCurrentScore()).toBe(100); // 100 * 1
    });

    it('应该正确重置分数', () => {
      scoreSystem.addScore(1000);
      scoreSystem.setMultiplier(2, 5);

      scoreSystem.resetScore();

      expect(scoreSystem.getCurrentScore()).toBe(0);
      expect(scoreSystem.getScoreMultiplier()).toBe(1);
      expect(scoreSystem.getMultiplierTimeLeft()).toBe(0);
    });
  });

  describe('高分管理', () => {
    it('应该正确添加高分记录', () => {
      scoreSystem.addScore(1000);
      const isNewHighScore = scoreSystem.addHighScore('TestPlayer');

      expect(isNewHighScore).toBe(true);
      const highScores = scoreSystem.getHighScores();
      expect(highScores.length).toBe(1);
      expect(highScores[0].name).toBe('TestPlayer');
      expect(highScores[0].score).toBe(1000);
      expect(highScores[0].level).toBe(1);
      expect(new Date(highScores[0].date)).toBeInstanceOf(Date);
    });

    it('应该只保存前10名高分', () => {
      // 添加15个高分记录
      for (let i = 1; i <= 15; i++) {
        scoreSystem.resetScore();
        scoreSystem.addScore(i * 100);
        scoreSystem.addHighScore(`Player${i}`);
      }

      const highScores = scoreSystem.getHighScores();
      expect(highScores.length).toBe(10);
      expect(highScores[0].score).toBe(1500); // 最高分应该是第15个玩家
      expect(highScores[9].score).toBe(600); // 第10名应该是第6个玩家
    });

    it('应该正确检查是否是高分', () => {
      // 添加9个高分记录
      for (let i = 1; i <= 9; i++) {
        scoreSystem.resetScore();
        scoreSystem.addScore(i * 100);
        scoreSystem.addHighScore(`Player${i}`);
      }

      // 第10个记录应该是高分
      expect(scoreSystem.isHighScore(500)).toBe(true);

      // 添加第10个记录
      scoreSystem.resetScore();
      scoreSystem.addScore(1000);
      scoreSystem.addHighScore('Player10');

      // 现在高分记录按降序排列：[1000, 900, 800, 700, 600, 500, 400, 300, 200, 100]
      // 最低分是100，所以500仍然是高分，因为500 > 100
      expect(scoreSystem.isHighScore(500)).toBe(true); // 500 > 100
      expect(scoreSystem.isHighScore(90)).toBe(false); // 90 < 100
      expect(scoreSystem.isHighScore(1100)).toBe(true); // 1100 > 1000
    });

    it('应该正确清除高分', () => {
      // 添加一些高分记录
      for (let i = 1; i <= 5; i++) {
        scoreSystem.resetScore();
        scoreSystem.addScore(i * 100);
        scoreSystem.addHighScore(`Player${i}`);
      }

      expect(scoreSystem.getHighScores().length).toBe(5);

      scoreSystem.clearHighScores();

      expect(scoreSystem.getHighScores().length).toBe(0);

      // 检查localStorage是否也被清除
      const storedScores = localStorage.getItem('fighterGameHighScores');
      expect(storedScores).toBe('[]');
    });

    it('不应该添加分数为0的高分记录', () => {
      // 分数为0，不应该添加到高分记录
      const isNewHighScore = scoreSystem.addHighScore('TestPlayer');

      expect(isNewHighScore).toBe(false);
      expect(scoreSystem.getHighScores().length).toBe(0);
    });
  });

  describe('数据导入导出', () => {
    it('应该正确导出高分记录', () => {
      // 添加一些高分记录
      for (let i = 1; i <= 3; i++) {
        scoreSystem.resetScore();
        scoreSystem.addScore(i * 100);
        scoreSystem.addHighScore(`Player${i}`);
      }

      const exportedData = scoreSystem.exportHighScores();
      const parsedData = JSON.parse(exportedData);

      expect(parsedData).toHaveLength(3);
      expect(parsedData[0].score).toBe(300);
      expect(parsedData[1].score).toBe(200);
      expect(parsedData[2].score).toBe(100);
    });

    it('应该正确导入高分记录', () => {
      const importData = JSON.stringify([
        { name: 'ImportedPlayer1', score: 5000, date: '2023-01-01', level: 5 },
        { name: 'ImportedPlayer2', score: 4000, date: '2023-01-02', level: 4 },
      ]);

      const result = scoreSystem.importHighScores(importData);

      expect(result).toBe(true);
      const highScores = scoreSystem.getHighScores();
      expect(highScores.length).toBe(2);
      expect(highScores[0].name).toBe('ImportedPlayer1');
      expect(highScores[0].score).toBe(5000);
      expect(highScores[1].name).toBe('ImportedPlayer2');
      expect(highScores[1].score).toBe(4000);
    });

    it('应该处理无效的导入数据', () => {
      const result1 = scoreSystem.importHighScores('invalid json');
      expect(result1).toBe(false);

      const result2 = scoreSystem.importHighScores(JSON.stringify({ not: 'an array' }));
      expect(result2).toBe(false);

      // 高分记录应该保持不变
      expect(scoreSystem.getHighScores().length).toBe(0);
    });
  });

  describe('分数格式化', () => {
    it('应该正确格式化分数', () => {
      expect(scoreSystem.formatScore(123)).toBe('000,123');
      expect(scoreSystem.formatScore(1234)).toBe('001,234');
      expect(scoreSystem.formatScore(12345)).toBe('012,345');
      expect(scoreSystem.formatScore(123456)).toBe('123,456');
      expect(scoreSystem.formatScore(1234567)).toBe('1,234,567');
    });
  });

  describe('localStorage持久化', () => {
    it('应该在添加高分时保存到localStorage', () => {
      scoreSystem.addScore(1000);
      scoreSystem.addHighScore('TestPlayer');

      const storedData = localStorage.getItem('fighterGameHighScores');
      expect(storedData).not.toBeNull();

      const parsedData = JSON.parse(storedData!);
      expect(parsedData.length).toBe(1);
      expect(parsedData[0].name).toBe('TestPlayer');
      expect(parsedData[0].score).toBe(1000);
    });

    it('应该在清除高分时更新localStorage', () => {
      // 添加一些高分记录
      for (let i = 1; i <= 3; i++) {
        scoreSystem.resetScore();
        scoreSystem.addScore(i * 100);
        scoreSystem.addHighScore(`Player${i}`);
      }

      // 清除高分
      scoreSystem.clearHighScores();

      const storedData = localStorage.getItem('fighterGameHighScores');
      expect(storedData).toBe('[]');
    });

    it('应该在导入高分时保存到localStorage', () => {
      const importData = JSON.stringify([
        { name: 'ImportedPlayer', score: 5000, date: '2023-01-01', level: 5 },
      ]);

      scoreSystem.importHighScores(importData);

      const storedData = localStorage.getItem('fighterGameHighScores');
      expect(storedData).not.toBeNull();

      const parsedData = JSON.parse(storedData!);
      expect(parsedData.length).toBe(1);
      expect(parsedData[0].name).toBe('ImportedPlayer');
      expect(parsedData[0].score).toBe(5000);
    });
  });
});
