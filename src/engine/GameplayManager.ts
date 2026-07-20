import {
  waveManager,
  powerupSystemManager,
  combatStatsManager,
  luaEngine,
  WaveManager,
  PowerupSystemManager,
  CombatStatsManager,
} from '../lua';
import { achievementSystem, type AchievementDefinition } from './AchievementSystem';
import { difficultyManager, type DifficultySnapshot } from './DifficultyManager';
import type {
  WaveState,
  EnemyConfig,
  DifficultyLevel,
  PowerupConfig,
  ActivePowerup,
  CombatStatsData,
  ComboInfo,
  ScoreBreakdown,
  PowerupType,
} from '../lua';

export interface GameplayState {
  wave: WaveState | null;
  activePowerups: ActivePowerup[];
  stats: CombatStatsData | null;
  combo: ComboInfo | null;
  score: number;
  rank: string;
}

export type WaveRewardType = 'score' | 'powerup' | 'heal' | 'shield' | 'extraLife';

export interface WaveReward {
  type: WaveRewardType;
  amount: number;
  powerupType?: PowerupType;
  label: string;
}

export interface WaveRewardResult {
  waveNumber: number;
  rewards: WaveReward[];
  totalScoreBonus: number;
}

export interface GameplayEvents {
  onWaveStart?: (waveNumber: number) => void;
  onWaveComplete?: (waveNumber: number, score: number) => void;
  onWaveReward?: (reward: WaveRewardResult) => void;
  onBossWave?: (waveNumber: number) => void;
  onEnemyKilled?: (enemyType: string, score: number) => void;
  onPowerupApplied?: (powerupType: string) => void;
  onPowerupExpired?: (powerupType: string) => void;
  onComboUpdate?: (combo: number, maxCombo: number) => void;
  onRankChange?: (newRank: string, oldRank: string) => void;
  onGameOver?: (finalScore: number, rank: string) => void;
  onAchievementUnlocked?: (achievement: AchievementDefinition) => void;
}

export class GameplayManager {
  private static instance: GameplayManager | null = null;

  private waveManager: WaveManager;
  private powerupManager: PowerupSystemManager;
  private combatStats: CombatStatsManager;

  private initialized = false;
  private running = false;
  private currentScore = 0;
  private currentRank = 'F';
  private events: GameplayEvents = {};
  private unlockedAchievementsThisSession: AchievementDefinition[] = [];

  private constructor() {
    this.waveManager = waveManager;
    this.powerupManager = powerupSystemManager;
    this.combatStats = combatStatsManager;
  }

  public static getInstance(): GameplayManager {
    if (!GameplayManager.instance) {
      GameplayManager.instance = new GameplayManager();
    }
    return GameplayManager.instance;
  }

  public async initialize(difficulty: DifficultyLevel = 'normal'): Promise<void> {
    if (this.initialized) return;

    await luaEngine.initialize();
    await this.waveManager.initialize();
    await this.powerupManager.initialize();
    await this.combatStats.initialize();

    this.waveManager.setDifficulty(difficulty);
    this.initialized = true;

    achievementSystem.initialize();
    achievementSystem.onAchievementUnlocked((achievement) => {
      const alreadyUnlocked = this.unlockedAchievementsThisSession.find((a) => a.id === achievement.id);
      if (!alreadyUnlocked) {
        this.unlockedAchievementsThisSession.push(achievement);
      }
      this.events.onAchievementUnlocked?.(achievement);
    });

    console.log('[GameplayManager] Initialized with difficulty:', difficulty);
  }

  public setEventCallbacks(events: GameplayEvents): void {
    this.events = { ...this.events, ...events };
  }

  public async startGame(difficulty: DifficultyLevel = 'normal'): Promise<void> {
    if (!this.initialized) {
      await this.initialize(difficulty);
    }

    this.waveManager.reset();
    this.waveManager.setDifficulty(difficulty);
    this.combatStats.reset();
    this.powerupManager.removeAllPowerups();

    this.running = true;
    this.currentScore = 0;
    this.currentRank = 'D';
    this.unlockedAchievementsThisSession = [];

    // 启动难度自适应系统
    difficultyManager.start(100);

    console.log('[GameplayManager] Game started');
  }

  public startWave(waveNumber: number): {
    success: boolean;
    enemyCount: number;
    isBossWave: boolean;
    isEliteWave: boolean;
    enemyTypes: string[];
  } {
    if (!this.running) {
      return { success: false, enemyCount: 0, isBossWave: false, isEliteWave: false, enemyTypes: [] };
    }

    const result = this.waveManager.startWave(waveNumber);
    if (!result || 'error' in result) {
      return { success: false, enemyCount: 0, isBossWave: false, isEliteWave: false, enemyTypes: [] };
    }

    this.events.onWaveStart?.(waveNumber);
    if (result.isBossWave) {
      this.events.onBossWave?.(waveNumber);
    }

    return {
      success: result.success,
      enemyCount: result.enemyCount,
      isBossWave: result.isBossWave,
      isEliteWave: result.isEliteWave,
      enemyTypes: result.enemyTypes,
    };
  }

  public spawnNextEnemy(): {
    success: boolean;
    enemy?: EnemyConfig;
    spawnIndex?: number;
    totalToSpawn?: number;
  } {
    if (!this.running) return { success: false };

    const result = this.waveManager.spawnNextEnemy();
    if (!result || 'error' in result) {
      return { success: false };
    }

    return result;
  }

  public onEnemyKilled(enemyType: string, isBoss: boolean = false, isElite: boolean = false): void {
    if (!this.running) return;

    difficultyManager.recordKill();

    const waveResult = this.waveManager.onEnemyDefeated(enemyType);
    const statsResult = this.combatStats.onKill(enemyType, isBoss, isElite);

    let scoreGained = 0;
    if (waveResult && !('error' in waveResult) && waveResult.score) {
      scoreGained = waveResult.score;
    } else {
      const baseScores: Record<string, number> = { basic: 100, fast: 150, tank: 250, shooter: 200, elite: 500, boss: 2000 };
      scoreGained = baseScores[enemyType] || 100;
    }
    this.currentScore += scoreGained;
    this.combatStats.addScore(scoreGained);
    this.events.onEnemyKilled?.(enemyType, scoreGained);

    if (statsResult && !('error' in statsResult) && statsResult.comboCurrent !== undefined) {
      this.events.onComboUpdate?.(statsResult.comboCurrent, statsResult.comboMax || 0);
    }

    const oldRank = this.currentRank;
    const stats = this.combatStats.getStats();
    if (stats?.rank) {
      this.currentRank = stats.rank;
    }
    if (oldRank !== this.currentRank) {
      this.events.onRankChange?.(this.currentRank, oldRank);
    }

    if (waveResult && !('error' in waveResult) && waveResult.isWaveComplete) {
      const waveState = this.getWaveState();
      const completedWave = waveState?.waveNumber || 0;
      this.combatStats.onWaveCompleted(completedWave);
      this.events.onWaveComplete?.(completedWave, this.currentScore);

      difficultyManager.recordWaveCompleted();

      const reward = this.generateWaveReward(completedWave, waveState?.isBossWave || false, waveState?.isEliteWave || false);
      this.applyWaveReward(reward);
      this.events.onWaveReward?.(reward);
    }

    achievementSystem.updateStats({
      totalKills: 1,
      enemiesKilledByType: {
        [isBoss ? 'boss' : isElite ? 'elite' : enemyType]: 1,
      },
      highestScore: this.currentScore,
    });

    const combatStats = this.combatStats.getStats();
    if (combatStats) {
      achievementSystem.setStats({
        highestWave: combatStats.wavesCompleted || 0,
        totalPlayTime: combatStats.playTime || 0,
      });
    }
  }

  public applyPowerup(powerupType: PowerupType): boolean {
    if (!this.running) return false;

    const result = this.powerupManager.applyPowerup(powerupType);
    if (!result || 'error' in result) return false;

    if (result.success) {
      this.combatStats.onPowerupCollected(powerupType);
      this.events.onPowerupApplied?.(powerupType);

      achievementSystem.updateStats({
        powerupsCollected: 1,
        enemiesKilledByType: powerupType === 'health' ? { health: 1 } : undefined,
      });
    }

    return result.success;
  }

  public update(dt: number): void {
    if (!this.running) return;

    this.waveManager.update(dt);
    const powerupUpdate = this.powerupManager.update(dt);
    this.combatStats.updatePlayTime(dt);
    this.combatStats.updateCombo(dt);

    // 难度自适应：每帧更新倍率
    difficultyManager.update(dt);

    if (powerupUpdate.expired && powerupUpdate.expired.length > 0) {
      for (const expired of powerupUpdate.expired) {
        this.events.onPowerupExpired?.(expired.type);
      }
    }

    const comboInfo = this.getComboInfo();
    if (comboInfo && comboInfo.comboCurrent > 0) {
      this.events.onComboUpdate?.(comboInfo.comboCurrent, comboInfo.comboMax);
    }
  }

  public getWaveState(): WaveState | null {
    if (!this.initialized) return null;
    return this.waveManager.getWaveState();
  }

  public getWaveManager(): WaveManager | null {
    if (!this.initialized) return null;
    return this.waveManager;
  }

  public getUnlockedAchievementsThisSession(): AchievementDefinition[] {
    return [...this.unlockedAchievementsThisSession];
  }

  public generateWaveReward(waveNumber: number, isBossWave: boolean, isEliteWave: boolean): WaveRewardResult {
    const rewards: WaveReward[] = [];
    let totalScoreBonus = 0;

    const baseScoreBonus = 500 + waveNumber * 100;
    rewards.push({ type: 'score', amount: baseScoreBonus, label: `波次完成奖励 +${baseScoreBonus}` });
    totalScoreBonus += baseScoreBonus;

    if (isBossWave) {
      const bossBonus = 2000 + waveNumber * 200;
      rewards.push({ type: 'score', amount: bossBonus, label: `BOSS击破奖励 +${bossBonus}` });
      totalScoreBonus += bossBonus;

      rewards.push({ type: 'heal', amount: 100, label: '全血量恢复' });

      const powerupTypes: PowerupType[] = ['shield', 'invincible', 'triple_shot'];
      const randomPowerup = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
      rewards.push({ type: 'powerup', amount: 1, powerupType: randomPowerup, label: `特殊道具: ${randomPowerup}` });
    } else if (isEliteWave) {
      const eliteBonus = 1000 + waveNumber * 150;
      rewards.push({ type: 'score', amount: eliteBonus, label: `精英波次奖励 +${eliteBonus}` });
      totalScoreBonus += eliteBonus;

      rewards.push({ type: 'shield', amount: 50, label: '护盾补充 +50' });
    } else {
      if (waveNumber % 3 === 0) {
        rewards.push({ type: 'heal', amount: 50, label: '生命恢复 +50%' });
      }

      if (waveNumber % 2 === 0) {
        const powerupTypes: PowerupType[] = ['health', 'speed', 'damage'];
        const randomPowerup = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
        rewards.push({ type: 'powerup', amount: 1, powerupType: randomPowerup, label: `道具奖励: ${randomPowerup}` });
      }
    }

    return { waveNumber, rewards, totalScoreBonus };
  }

  public applyWaveReward(reward: WaveRewardResult): void {
    for (const r of reward.rewards) {
      switch (r.type) {
        case 'score':
          this.currentScore += r.amount;
          this.combatStats.addScore(r.amount);
          break;
        case 'powerup':
          if (r.powerupType) {
            this.powerupManager.applyPowerup(r.powerupType);
          }
          break;
        case 'heal':
        case 'shield':
        case 'extraLife':
          break;
      }
    }
  }

  public getActivePowerups(): ActivePowerup[] {
    if (!this.initialized) return [];
    return this.powerupManager.getActivePowerups();
  }

  public getStats(): CombatStatsData | null {
    const stats = this.combatStats.getStats();
    if (stats) {
      stats.score = this.currentScore;
      if (!stats.rank) {
        stats.rank = this.currentRank;
      }
    }
    return stats;
  }

  public getComboInfo(): ComboInfo | null {
    if (!this.initialized) return null;

    const result = this.combatStats.updateCombo(0);
    if ('error' in result) return null;

    return {
      comboCurrent: result.comboCurrent || 0,
      comboMax: this.combatStats.getStats()?.comboMax || 0,
      comboTimer: result.comboTimer || 0,
      comboTimeout: result.comboTimeout || 2.0,
    };
  }

  public getScore(): number {
    return this.currentScore;
  }

  public getRank(): string {
    return this.currentRank;
  }

  public getScoreBreakdown(): ScoreBreakdown | null {
    if (!this.initialized) return null;

    const result = this.combatStats.calculateFinalScore?.();
    if (result && !('error' in result) && result.breakdown) {
      return result.breakdown as ScoreBreakdown;
    }
    return null;
  }

  public getPowerupConfig(powerupType: PowerupType): PowerupConfig | null {
    if (!this.initialized) return null;
    return this.powerupManager.getPowerupConfig(powerupType);
  }

  public getDifficulty(): DifficultyLevel | null {
    const state = this.getWaveState();
    return state?.difficulty as DifficultyLevel || null;
  }

  public setDifficulty(difficulty: DifficultyLevel): void {
    this.waveManager.setDifficulty(difficulty);
  }

  /** 获取难度自适应快照（供 UI 与敌人系统使用） */
  public getDifficultySnapshot(): DifficultySnapshot {
    return difficultyManager.getSnapshot();
  }

  /** 获取当前难度自适应倍率 */
  public getDifficultyMultiplier(): number {
    return difficultyManager.getMultiplier();
  }

  /** 上报玩家生命（供难度自适应系统评估表现与受伤） */
  public reportPlayerHealth(health: number, maxHealth: number): void {
    difficultyManager.recordPlayerHealth(health, maxHealth);
  }

  /** 设置自适应难度配置（开关 + 强度） */
  public setAdaptiveConfig(config: { enabled: boolean; intensity: 'low' | 'medium' | 'high' }): void {
    difficultyManager.setConfig({
      enabled: config.enabled,
      intensity: config.intensity,
    });
  }

  public setMaxWaves(maxWaves: number): void {
    this.waveManager.setMaxWaves(maxWaves);
  }

  public pause(): void {
    if (!this.running) return;
    this.waveManager.pauseWave();
    this.running = false;
  }

  public resume(): void {
    if (this.running) return;
    this.waveManager.resumeWave();
    this.running = true;
  }

  public gameOver(): { finalScore: number; rank: string; stats: CombatStatsData | null } {
    this.running = false;
    const stats = this.getStats();
    this.events.onGameOver?.(this.currentScore, this.currentRank);
    return {
      finalScore: this.currentScore,
      rank: this.currentRank,
      stats,
    };
  }

  public isRunning(): boolean {
    return this.running;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public destroy(): void {
    this.running = false;
    this.initialized = false;
    this.events = {};
    GameplayManager.instance = null;
  }
}

export const gameplayManager = GameplayManager.getInstance();
