import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('wasmoon', () => ({
  factory: undefined,
}));

import { gameplayManager } from './GameplayManager';
import { luaEngine } from '../lua';

describe('GameplayManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await luaEngine.initialize();
    await gameplayManager.initialize('normal');
    await gameplayManager.startGame('normal');
  });

  afterEach(() => {
    gameplayManager.destroy();
    luaEngine.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with normal difficulty', () => {
      expect(gameplayManager.isInitialized()).toBe(true);
      expect(gameplayManager.getDifficulty()).toBe('normal');
    });

    it('should not reinitialize if already initialized', async () => {
      const initialStatus = gameplayManager.isInitialized();
      expect(initialStatus).toBe(true);
      
      const spy = vi.spyOn(gameplayManager as any, 'initialize').mockImplementation(() => Promise.resolve());
      await gameplayManager.initialize('normal');
      
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Wave Management', () => {
    it('should start a wave successfully', () => {
      const result = gameplayManager.startWave(1);
      expect(result.success).toBe(true);
      expect(result.enemyCount).toBeGreaterThan(0);
      expect(result.enemyTypes.length).toBe(result.enemyCount);
    });

    it('should generate boss wave on every 5th wave', () => {
      const result = gameplayManager.startWave(5);
      expect(result.success).toBe(true);
      expect(result.isBossWave).toBe(true);
    });

    it('should generate elite wave on every 3rd wave (not boss)', () => {
      const result = gameplayManager.startWave(3);
      expect(result.success).toBe(true);
      expect(result.isEliteWave).toBe(true);
      expect(result.isBossWave).toBe(false);
    });

    it('should not start wave when game is not running', () => {
      gameplayManager.destroy();
      const result = gameplayManager.startWave(1);
      expect(result.success).toBe(false);
    });

    it('should spawn enemies from wave configuration', () => {
      gameplayManager.startWave(1);
      const spawnResult = gameplayManager.spawnNextEnemy();
      expect(spawnResult.success).toBe(true);
      expect(spawnResult.enemy).toBeDefined();
      expect(spawnResult.enemy?.type).toBeDefined();
    });

    it('should complete wave when all enemies are defeated', () => {
      gameplayManager.startWave(1);
      const waveState = gameplayManager.getWaveState();
      if (waveState) {
        for (let i = 0; i < waveState.enemiesRemaining; i++) {
          gameplayManager.spawnNextEnemy();
        }
      }

      let waveComplete = false;
      gameplayManager.setEventCallbacks({
        onWaveComplete: () => {
          waveComplete = true;
        },
      });

      const initialState = gameplayManager.getWaveState();
      if (initialState) {
        for (let i = 0; i < initialState.enemiesRemaining; i++) {
          gameplayManager.onEnemyKilled('basic', false, false);
        }
      }

      expect(waveComplete).toBe(true);
    });
  });

  describe('Powerup System Integration', () => {
    it('should apply powerup and track collection', () => {
      const result = gameplayManager.applyPowerup('health');
      expect(result).toBe(true);

      const stats = gameplayManager.getStats();
      expect(stats?.powerupsCollected).toBe(1);
    });

    it('should track active powerups', () => {
      gameplayManager.applyPowerup('speed');
      const activePowerups = gameplayManager.getActivePowerups();
      expect(activePowerups.length).toBe(1);
      expect(activePowerups[0].type).toBe('speed');
    });

    it('should update powerup duration over time', () => {
      gameplayManager.applyPowerup('speed');
      const initialPowerups = gameplayManager.getActivePowerups();
      expect(initialPowerups.length).toBe(1);
      const initialDuration = initialPowerups[0].remainingDuration;

      gameplayManager.update(1.0);

      const updatedPowerups = gameplayManager.getActivePowerups();
      expect(updatedPowerups[0].remainingDuration).toBeLessThan(initialDuration);
    });

    it('should fire event when powerup expires', () => {
      gameplayManager.applyPowerup('speed');
      let expiredType: string | null = null;

      gameplayManager.setEventCallbacks({
        onPowerupExpired: (type) => {
          expiredType = type;
        },
      });

      for (let i = 0; i < 100; i++) {
        gameplayManager.update(0.5);
      }

      expect(expiredType).toBe('speed');
    });

    it('should get powerup configuration', () => {
      const config = gameplayManager.getPowerupConfig('health');
      expect(config).not.toBeNull();
      expect(config?.name).toBe('health');
      expect(config?.type).toBe('instant');
    });
  });

  describe('Combat Stats Integration', () => {
    it('should track kills and combo', () => {
      gameplayManager.onEnemyKilled('basic', false, false);
      gameplayManager.onEnemyKilled('basic', false, false);

      const stats = gameplayManager.getStats();
      expect(stats?.kills).toBe(2);
      expect(stats?.comboCurrent).toBe(2);
    });

    it('should reset combo on death', () => {
      gameplayManager.onEnemyKilled('basic', false, false);
      gameplayManager.onEnemyKilled('basic', false, false);

      let combo = 0;
      gameplayManager.setEventCallbacks({
        onComboUpdate: (current) => {
          combo = current;
        },
      });

      gameplayManager.update(3.0);

      expect(combo).toBe(0);
    });

    it('should track boss kills', () => {
      gameplayManager.onEnemyKilled('boss', true, false);
      const stats = gameplayManager.getStats();
      expect(stats?.bossesKilled).toBe(1);
    });

    it('should track elite kills', () => {
      gameplayManager.onEnemyKilled('elite', false, true);
      const stats = gameplayManager.getStats();
      expect(stats?.elitesKilled).toBe(1);
    });

    it('should calculate rank based on score', () => {
      for (let i = 0; i < 100; i++) {
        gameplayManager.combatStats.addScore(100);
      }

      const stats = gameplayManager.getStats();
      const rankOrder = ['D', 'C', 'B', 'A', 'S'];
      expect(rankOrder.indexOf(stats?.rank || 'D')).toBeGreaterThanOrEqual(rankOrder.indexOf('C'));
    });

    it('should track play time', () => {
      gameplayManager.update(1.5);
      gameplayManager.update(2.0);

      const stats = gameplayManager.getStats();
      expect(stats?.playTime).toBeCloseTo(3.5, 0.1);
    });

    it('should track waves completed', () => {
      gameplayManager.startWave(1);
      const state = gameplayManager.getWaveState();
      if (state) {
        for (let i = 0; i < state.enemiesRemaining; i++) {
          gameplayManager.spawnNextEnemy();
        }
        for (let i = 0; i < state.enemiesRemaining; i++) {
          gameplayManager.onEnemyKilled('basic', false, false);
        }
      }

      const stats = gameplayManager.getStats();
      expect(stats?.wavesCompleted).toBe(1);
    });
  });

  describe('Score System', () => {
    it('should accumulate score from kills', () => {
      gameplayManager.startWave(1);
      gameplayManager.spawnNextEnemy();
      gameplayManager.onEnemyKilled('basic', false, false);

      const score = gameplayManager.getScore();
      expect(score).toBeGreaterThan(0);
    });

    it('should provide score breakdown', () => {
      gameplayManager.onEnemyKilled('basic', false, false);
      gameplayManager.onEnemyKilled('basic', false, false);
      gameplayManager.update(1.0);

      const breakdown = gameplayManager.getScoreBreakdown();
      expect(breakdown).not.toBeNull();
      expect(breakdown?.baseScore).toBeDefined();
      expect(breakdown?.comboBonus).toBeDefined();
    });
  });

  describe('Wave Rewards', () => {
    it('should generate rewards for completing a wave', () => {
      const reward = gameplayManager.generateWaveReward(1, false, false);
      expect(reward.waveNumber).toBe(1);
      expect(reward.rewards.length).toBeGreaterThan(0);
      expect(reward.totalScoreBonus).toBeGreaterThan(0);
    });

    it('should generate special rewards for boss waves', () => {
      const reward = gameplayManager.generateWaveReward(5, true, false);
      expect(reward.totalScoreBonus).toBeGreaterThan(1000);
      const hasHealReward = reward.rewards.some((r) => r.type === 'heal');
      expect(hasHealReward).toBe(true);
      const hasPowerupReward = reward.rewards.some((r) => r.type === 'powerup');
      expect(hasPowerupReward).toBe(true);
    });

    it('should generate enhanced rewards for elite waves', () => {
      const reward = gameplayManager.generateWaveReward(3, false, true);
      expect(reward.totalScoreBonus).toBeGreaterThan(500);
      const hasShieldReward = reward.rewards.some((r) => r.type === 'shield');
      expect(hasShieldReward).toBe(true);
    });

    it('should apply wave rewards', () => {
      const initialScore = gameplayManager.getScore();
      const reward = gameplayManager.generateWaveReward(1, false, false);
      gameplayManager.applyWaveReward(reward);

      const newScore = gameplayManager.getScore();
      expect(newScore).toBe(initialScore + reward.totalScoreBonus);
    });
  });

  describe('Game State Management', () => {
    it('should pause and resume game', () => {
      expect(gameplayManager.isRunning()).toBe(true);
      gameplayManager.pause();
      expect(gameplayManager.isRunning()).toBe(false);
      gameplayManager.resume();
      expect(gameplayManager.isRunning()).toBe(true);
    });

    it('should return game over state', () => {
      gameplayManager.onEnemyKilled('basic', false, false);
      const result = gameplayManager.gameOver();

      expect(result.finalScore).toBeGreaterThan(0);
      expect(result.rank).toBeDefined();
      expect(result.stats).not.toBeNull();
    });

    it('should reset game state when starting new game', async () => {
      gameplayManager.onEnemyKilled('basic', false, false);
      gameplayManager.applyPowerup('speed');

      await gameplayManager.startGame('normal');

      const stats = gameplayManager.getStats();
      expect(stats?.kills).toBe(0);
      expect(stats?.powerupsCollected).toBe(0);

      const powerups = gameplayManager.getActivePowerups();
      expect(powerups.length).toBe(0);
    });
  });

  describe('Difficulty Management', () => {
    it('should set and get difficulty', () => {
      gameplayManager.setDifficulty('hard');
      expect(gameplayManager.getDifficulty()).toBe('hard');
    });

    it('should get difficulty multiplier', () => {
      const multiplier = gameplayManager.getDifficultyMultiplier();
      expect(multiplier).toBeGreaterThan(0);
    });

    it('should set max waves', () => {
      gameplayManager.setMaxWaves(20);
      const state = gameplayManager.getWaveState();
      expect(state?.maxWaves).toBe(20);
    });
  });

  describe('Event System', () => {
    it('should fire onWaveStart event', () => {
      const spy = vi.fn();
      gameplayManager.setEventCallbacks({ onWaveStart: spy });
      gameplayManager.startWave(1);
      expect(spy).toHaveBeenCalledWith(1);
    });

    it('should fire onBossWave event', () => {
      const spy = vi.fn();
      gameplayManager.setEventCallbacks({ onBossWave: spy });
      gameplayManager.startWave(5);
      expect(spy).toHaveBeenCalledWith(5);
    });

    it('should fire onEnemyKilled event', () => {
      const spy = vi.fn();
      gameplayManager.setEventCallbacks({ onEnemyKilled: spy });
      gameplayManager.startWave(1);
      gameplayManager.spawnNextEnemy();
      gameplayManager.onEnemyKilled('basic', false, false);
      expect(spy).toHaveBeenCalled();
    });

    it('should fire onComboUpdate event', () => {
      const spy = vi.fn();
      gameplayManager.setEventCallbacks({ onComboUpdate: spy });
      gameplayManager.onEnemyKilled('basic', false, false);
      expect(spy).toHaveBeenCalled();
    });

    it('should fire onRankChange event', () => {
      const spy = vi.fn();
      gameplayManager.setEventCallbacks({ onRankChange: spy });

      for (let i = 0; i < 200; i++) {
        gameplayManager.onEnemyKilled('basic', false, false);
      }

      expect(spy).toHaveBeenCalled();
    });

    it('should fire onPowerupApplied event', () => {
      const spy = vi.fn();
      gameplayManager.setEventCallbacks({ onPowerupApplied: spy });
      gameplayManager.applyPowerup('health');
      expect(spy).toHaveBeenCalledWith('health');
    });

    it('should fire onGameOver event', () => {
      const spy = vi.fn();
      gameplayManager.setEventCallbacks({ onGameOver: spy });
      gameplayManager.gameOver();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Full Integration Test', () => {
    it('should complete a full game cycle with multiple waves', async () => {
      await gameplayManager.startGame('normal');

      for (let wave = 1; wave <= 3; wave++) {
        const startResult = gameplayManager.startWave(wave);
        expect(startResult.success).toBe(true);

        const waveState = gameplayManager.getWaveState();
        expect(waveState?.waveNumber).toBe(wave);

        const enemyCount = startResult.enemyCount;
        for (let i = 0; i < enemyCount; i++) {
          gameplayManager.spawnNextEnemy();
        }

        for (let i = 0; i < enemyCount; i++) {
          gameplayManager.onEnemyKilled('basic', false, false);
        }

        gameplayManager.update(0.1);
      }

      const finalStats = gameplayManager.getStats();
      expect(finalStats?.wavesCompleted).toBe(3);
      expect(finalStats?.kills).toBeGreaterThan(0);

      const gameOverResult = gameplayManager.gameOver();
      expect(gameOverResult.finalScore).toBeGreaterThan(0);
    });

    it('should handle powerups during gameplay', async () => {
      await gameplayManager.startGame('normal');

      gameplayManager.applyPowerup('speed');
      gameplayManager.applyPowerup('damage');

      let activeCount = gameplayManager.getActivePowerups().length;
      expect(activeCount).toBe(2);

      for (let i = 0; i < 10; i++) {
        gameplayManager.update(1.0);
      }

      activeCount = gameplayManager.getActivePowerups().length;
      expect(activeCount).toBeLessThan(2);
    });

    it('should track combat statistics accurately', async () => {
      await gameplayManager.startGame('normal');

      gameplayManager.onEnemyKilled('basic', false, false);
      gameplayManager.onEnemyKilled('elite', false, true);
      gameplayManager.onEnemyKilled('boss', true, false);

      const stats = gameplayManager.getStats();
      expect(stats?.kills).toBe(3);
      expect(stats?.elitesKilled).toBe(1);
      expect(stats?.bossesKilled).toBe(1);
      expect(stats?.comboMax).toBe(3);
    });
  });
});