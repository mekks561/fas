import { SurvivalModeManager } from './SurvivalModeManager';

describe('SurvivalModeManager', () => {
  let manager: SurvivalModeManager;

  beforeEach(() => {
    manager = SurvivalModeManager.getInstance();
    manager.reset();
  });

  describe('Game State Management', () => {
    it('should start in menu state', () => {
      expect(manager.getState()).toBe('menu');
    });

    it('should transition to preparing state on start', () => {
      manager.startGame();
      expect(manager.getState()).toBe('preparing');
    });

    it('should transition to playing state after preparation', () => {
      manager.startGame();
      manager.update(4);
      expect(manager.getState()).toBe('playing');
    });

    it('should stop and return to menu', () => {
      manager.startGame();
      manager.stopGame();
      expect(manager.getState()).toBe('menu');
    });

    it('should set game over state', () => {
      manager.startGame();
      manager.update(4);
      manager.setGameOver();
      expect(manager.getState()).toBe('gameOver');
    });
  });

  describe('Wave Generation', () => {
    it('should generate wave 1 with basic enemies only', () => {
      manager.startGame();
      manager.update(4);

      const config = manager.getCurrentWaveConfig();
      expect(config?.waveNumber).toBe(1);
      expect(config?.isBossWave).toBe(false);
      expect(config?.isEliteWave).toBe(false);

      const enemyTypes = config?.enemies.map((e) => e.type);
      expect(enemyTypes).toContain('basic');
      expect(enemyTypes).not.toContain('tank');
      expect(enemyTypes).not.toContain('ranged');
    });

    it('should generate boss wave at wave 5', () => {
      manager.startGame();
      for (let wave = 1; wave < 5; wave++) {
        manager.update(4);
        const config = manager.getCurrentWaveConfig();
        const totalEnemies = config?.enemies.reduce((sum, e) => sum + e.count, 0) || 0;
        for (let j = 0; j < totalEnemies; j++) {
          manager.recordEnemyDefeat('basic', 100);
        }
        manager.update(1);
        manager.update(5);
      }

      const config = manager.getCurrentWaveConfig();
      expect(config?.waveNumber).toBe(5);
      expect(config?.isBossWave).toBe(true);

      const enemyTypes = config?.enemies.map((e) => e.type);
      expect(enemyTypes).toContain('boss');
      expect(enemyTypes).toContain('elite');
    });

    it('should generate elite wave at wave 3', () => {
      manager.startGame();
      manager.update(4);

      const config1 = manager.getCurrentWaveConfig();
      expect(config1?.waveNumber).toBe(1);
      const totalEnemies1 = config1?.enemies.reduce((sum, e) => sum + e.count, 0) || 0;
      for (let j = 0; j < totalEnemies1; j++) {
        manager.recordEnemyDefeat('basic', 100);
      }
      manager.update(1);
      manager.update(5);

      const config2 = manager.getCurrentWaveConfig();
      expect(config2?.waveNumber).toBe(2);
      const totalEnemies2 = config2?.enemies.reduce((sum, e) => sum + e.count, 0) || 0;
      for (let j = 0; j < totalEnemies2; j++) {
        manager.recordEnemyDefeat('basic', 100);
      }
      manager.update(1);
      manager.update(5);

      const config3 = manager.getCurrentWaveConfig();
      expect(config3?.waveNumber).toBe(3);
      expect(config3?.isEliteWave).toBe(true);
      expect(config3?.isBossWave).toBe(false);
    });

    it('should increase difficulty with wave number', () => {
      manager.startGame();
      manager.update(4);

      const config1 = manager.getCurrentWaveConfig();
      const health1 = config1?.enemies[0].healthMultiplier || 1;
      const totalEnemies1 = config1?.enemies.reduce((sum, e) => sum + e.count, 0) || 0;

      for (let j = 0; j < totalEnemies1; j++) {
        manager.recordEnemyDefeat('basic', 100);
      }
      manager.update(1);
      manager.update(5);

      const config2 = manager.getCurrentWaveConfig();
      const health2 = config2?.enemies[0].healthMultiplier || 1;

      expect(health2).toBeGreaterThan(health1);
    });

    it('should include tank enemies from wave 2', () => {
      manager.startGame();
      manager.update(4);

      const config1 = manager.getCurrentWaveConfig();
      const totalEnemies1 = config1?.enemies.reduce((sum, e) => sum + e.count, 0) || 0;
      for (let j = 0; j < totalEnemies1; j++) {
        manager.recordEnemyDefeat('basic', 100);
      }
      manager.update(1);
      manager.update(5);

      const config = manager.getCurrentWaveConfig();
      expect(config?.waveNumber).toBe(2);

      const enemyTypes = config?.enemies.map((e) => e.type);
      expect(enemyTypes).toContain('tank');
    });

    it('should include ranged enemies from wave 3', () => {
      manager.startGame();
      manager.update(4);

      const config1 = manager.getCurrentWaveConfig();
      const totalEnemies1 = config1?.enemies.reduce((sum, e) => sum + e.count, 0) || 0;
      for (let j = 0; j < totalEnemies1; j++) {
        manager.recordEnemyDefeat('basic', 100);
      }
      manager.update(1);
      manager.update(5);

      const config2 = manager.getCurrentWaveConfig();
      const totalEnemies2 = config2?.enemies.reduce((sum, e) => sum + e.count, 0) || 0;
      for (let j = 0; j < totalEnemies2; j++) {
        manager.recordEnemyDefeat('basic', 100);
      }
      manager.update(1);
      manager.update(5);

      const config = manager.getCurrentWaveConfig();
      expect(config?.waveNumber).toBe(3);

      const enemyTypes = config?.enemies.map((e) => e.type);
      expect(enemyTypes).toContain('ranged');
    });
  });

  describe('Stats Tracking', () => {
    it('should track survival time', () => {
      manager.startGame();
      manager.update(4);
      manager.update(2);

      const stats = manager.getStats();
      expect(stats.survivalTime).toBeGreaterThan(0);
    });

    it('should track enemy defeats', () => {
      manager.startGame();
      manager.update(4);

      manager.recordEnemyDefeat('basic', 100);
      manager.recordEnemyDefeat('fast', 150);

      const stats = manager.getStats();
      expect(stats.enemiesDefeated).toBe(2);
      expect(stats.score).toBe(250);
    });

    it('should track boss defeats', () => {
      manager.startGame();
      manager.update(4);

      manager.recordEnemyDefeat('boss', 1000);

      const stats = manager.getStats();
      expect(stats.bossesDefeated).toBe(1);
    });

    it('should track powerup collection', () => {
      manager.startGame();
      manager.update(4);

      manager.recordPowerupCollection();
      manager.recordPowerupCollection();

      const stats = manager.getStats();
      expect(stats.powerupsCollected).toBe(2);
    });

    it('should track skill usage', () => {
      manager.startGame();
      manager.update(4);

      manager.recordSkillUse();
      manager.recordSkillUse();
      manager.recordSkillUse();

      const stats = manager.getStats();
      expect(stats.skillsUsed).toBe(3);
    });

    it('should track max combo', () => {
      manager.startGame();
      manager.update(4);

      manager.recordCombo(5);
      manager.recordCombo(10);
      manager.recordCombo(7);

      const stats = manager.getStats();
      expect(stats.maxCombo).toBe(10);
    });
  });

  describe('Wave Progress', () => {
    it('should track wave progress', () => {
      manager.startGame();
      manager.update(4);

      const config = manager.getCurrentWaveConfig();
      const totalEnemies = config?.enemies.reduce((sum, e) => sum + e.count, 0) || 0;

      for (let i = 0; i < totalEnemies / 2; i++) {
        manager.recordEnemyDefeat('basic', 100);
      }

      const progress = manager.getWaveProgress();
      expect(progress).toBeCloseTo(0.5, 0.1);
    });

    it('should report remaining enemies', () => {
      manager.startGame();
      manager.update(4);

      const initialRemaining = manager.getRemainingEnemiesInWave();

      manager.recordEnemyDefeat('basic', 100);
      manager.recordEnemyDefeat('basic', 100);

      const remaining = manager.getRemainingEnemiesInWave();
      expect(remaining).toBe(initialRemaining - 2);
    });
  });

  describe('High Scores', () => {
    beforeEach(() => {
      manager.clearHighScores();
    });

    it('should add high score', () => {
      manager.startGame();
      manager.update(4);
      manager.recordEnemyDefeat('basic', 5000);
      manager.setGameOver();

      const isNewHighScore = manager.addHighScore('TestPlayer');
      expect(isNewHighScore).toBe(true);

      const highScores = manager.getHighScores();
      expect(highScores.length).toBe(1);
      expect(highScores[0].name).toBe('TestPlayer');
      expect(highScores[0].score).toBe(5000);
    });

    it('should limit high scores to 10', () => {
      for (let i = 0; i < 15; i++) {
        manager.startGame();
        manager.update(4);
        manager.recordEnemyDefeat('basic', (15 - i) * 1000);
        manager.setGameOver();
        manager.addHighScore(`Player${i}`);
      }

      const highScores = manager.getHighScores();
      expect(highScores.length).toBe(10);
    });

    it('should sort high scores by score', () => {
      manager.startGame();
      manager.update(4);
      manager.recordEnemyDefeat('basic', 2000);
      manager.setGameOver();
      manager.addHighScore('Player2');

      manager.startGame();
      manager.update(4);
      manager.recordEnemyDefeat('basic', 3000);
      manager.setGameOver();
      manager.addHighScore('Player1');

      manager.startGame();
      manager.update(4);
      manager.recordEnemyDefeat('basic', 1000);
      manager.setGameOver();
      manager.addHighScore('Player3');

      const highScores = manager.getHighScores();
      expect(highScores[0].score).toBe(3000);
      expect(highScores[1].score).toBe(2000);
      expect(highScores[2].score).toBe(1000);
    });

    it('should check if score qualifies as high score', () => {
      expect(manager.isHighScore(100)).toBe(true);

      for (let i = 0; i < 10; i++) {
        manager.startGame();
        manager.update(4);
        manager.recordEnemyDefeat('basic', (10 - i) * 100);
        manager.setGameOver();
        manager.addHighScore(`Player${i}`);
      }

      expect(manager.isHighScore(50)).toBe(false);
      expect(manager.isHighScore(500)).toBe(true);
    });

    it('should clear high scores', () => {
      manager.startGame();
      manager.update(4);
      manager.recordEnemyDefeat('basic', 1000);
      manager.setGameOver();
      manager.addHighScore('Test');

      manager.clearHighScores();

      const highScores = manager.getHighScores();
      expect(highScores.length).toBe(0);
    });
  });

  describe('Formatting', () => {
    it('should format time correctly', () => {
      expect(manager.formatTime(0)).toBe('00:00');
      expect(manager.formatTime(30)).toBe('00:30');
      expect(manager.formatTime(60)).toBe('01:00');
      expect(manager.formatTime(95)).toBe('01:35');
      expect(manager.formatTime(3661)).toBe('61:01');
    });

    it('should format score correctly', () => {
      expect(manager.formatScore(0)).toBe('0');
      expect(manager.formatScore(1000)).toBe('1,000');
      expect(manager.formatScore(1234567)).toBe('1,234,567');
    });
  });
});
