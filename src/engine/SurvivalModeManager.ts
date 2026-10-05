export type SurvivalModeState = 'menu' | 'preparing' | 'playing' | 'waveTransition' | 'gameOver';

export type EnemyType = 'basic' | 'fast' | 'tank' | 'ranged' | 'elite' | 'boss';

export interface WaveConfig {
  waveNumber: number;
  enemies: {
    type: EnemyType;
    count: number;
    healthMultiplier: number;
    damageMultiplier: number;
    speedMultiplier: number;
  }[];
  spawnInterval: number;
  isBossWave: boolean;
  isEliteWave: boolean;
  rewardScore: number;
  bonusPowerups: number;
}

export interface SurvivalStats {
  currentWave: number;
  enemiesDefeated: number;
  enemiesSpawned: number;
  survivalTime: number;
  score: number;
  maxCombo: number;
  powerupsCollected: number;
  skillsUsed: number;
  bossesDefeated: number;
}

export interface SurvivalHighScore {
  rank: number;
  name: string;
  score: number;
  wave: number;
  survivalTime: number;
  date: string;
}

export class SurvivalModeManager {
  private static instance: SurvivalModeManager | null = null;

  private state: SurvivalModeState = 'menu';
  private stats: SurvivalStats = this.createDefaultStats();
  private currentWaveConfig: WaveConfig | null = null;
  private waveEnemiesSpawned: number = 0;
  private waveEnemiesDefeated: number = 0;
  private spawnTimer: number = 0;
  private transitionTimer: number = 0;
  private preparingTimer: number = 0;

  private highScores: SurvivalHighScore[] = [];
  private highScoresStorageKey = 'survivalModeHighScores';

  private bossWaveInterval = 5;
  private eliteWaveInterval = 3;

  /**
   * 外部战斗接管标记。
   *
   * 生存模式有两种运行方式：
   * - 独立运行（默认 false）：本管理器自己按 spawnInterval 计数、自己判定波次完成，
   *   供单元测试与离线推演使用。
   * - 接入真实战斗（true）：敌人由战斗系统（EnemySystem + WaveManager）实际生成，
   *   本管理器只保留「计时 + 统计 + 状态机」。若在接入后仍让内部按自己的敌人总数
   *   判定完成，两边波次人数不一致会导致波次提前结束（实测第 1 波 3 vs 5）。
   */
  private externalControl = false;

  private constructor() {
    this.loadHighScores();
  }

  public static getInstance(): SurvivalModeManager {
    if (!SurvivalModeManager.instance) {
      SurvivalModeManager.instance = new SurvivalModeManager();
    }
    return SurvivalModeManager.instance;
  }

  private createDefaultStats(): SurvivalStats {
    return {
      currentWave: 0,
      enemiesDefeated: 0,
      enemiesSpawned: 0,
      survivalTime: 0,
      score: 0,
      maxCombo: 0,
      powerupsCollected: 0,
      skillsUsed: 0,
      bossesDefeated: 0,
    };
  }

  public startGame(): void {
    this.stats = this.createDefaultStats();
    this.state = 'preparing';
    this.preparingTimer = 3;
    this.currentWaveConfig = null;
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesDefeated = 0;
  }

  public stopGame(): void {
    this.state = 'menu';
    this.stats = this.createDefaultStats();
    this.currentWaveConfig = null;
  }

  public getState(): SurvivalModeState {
    return this.state;
  }

  public getStats(): SurvivalStats {
    return { ...this.stats };
  }

  public getCurrentWaveConfig(): WaveConfig | null {
    return this.currentWaveConfig;
  }

  public getWaveProgress(): number {
    if (!this.currentWaveConfig) return 0;
    const totalEnemies = this.currentWaveConfig.enemies.reduce((sum, e) => sum + e.count, 0);
    if (totalEnemies === 0) return 1;
    return this.waveEnemiesDefeated / totalEnemies;
  }

  public getRemainingEnemiesInWave(): number {
    if (!this.currentWaveConfig) return 0;
    const totalEnemies = this.currentWaveConfig.enemies.reduce((sum, e) => sum + e.count, 0);
    return totalEnemies - this.waveEnemiesDefeated;
  }

  public update(dt: number): void {
    if (this.state === 'playing') {
      this.stats.survivalTime += dt;
      // 接入真实战斗时波次完成由战斗侧的 onWaveComplete 通知（notifyWaveCleared），
      // 这里再按内部计数判定会与 WaveManager 的敌人数打架（见 externalControl）。
      if (!this.externalControl) {
        this.updateWave(dt);
      }
    } else if (this.state === 'preparing') {
      this.preparingTimer -= dt;
      if (this.preparingTimer <= 0) {
        this.startWave(1);
      }
    } else if (this.state === 'waveTransition') {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        this.startWave(this.stats.currentWave + 1);
      }
    }
  }

  private updateWave(dt: number): void {
    if (!this.currentWaveConfig) return;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.waveEnemiesSpawned < this.getTotalEnemiesInWave()) {
      this.spawnEnemy();
      this.spawnTimer = this.currentWaveConfig.spawnInterval;
    }

    if (this.waveEnemiesDefeated >= this.getTotalEnemiesInWave()) {
      this.completeWave();
    }
  }

  private getTotalEnemiesInWave(): number {
    if (!this.currentWaveConfig) return 0;
    return this.currentWaveConfig.enemies.reduce((sum, e) => sum + e.count, 0);
  }

  private spawnEnemy(): void {
    const totalEnemies = this.getTotalEnemiesInWave();
    if (this.waveEnemiesSpawned >= totalEnemies) return;

    let remaining = this.waveEnemiesSpawned;
    for (const enemyConfig of this.currentWaveConfig!.enemies) {
      if (remaining < enemyConfig.count) {
        this.waveEnemiesSpawned++;
        this.stats.enemiesSpawned++;
        return;
      }
      remaining -= enemyConfig.count;
    }
  }

  /**
   * 切换为「真实战斗驱动」模式。接入 EnemySystem/WaveManager 时**必须**开启，
   * 否则本管理器会用自己的敌人总数提前判定波次完成。详见 externalControl 字段说明。
   */
  public setExternalControl(on: boolean): void {
    this.externalControl = on;
  }

  /**
   * 战斗侧本波已清空（真实战斗驱动的波次推进入口）。
   *
   * 等价于内部的 completeWave()：加分波奖励、进入 waveTransition 并开始倒计时，
   * 倒计时结束由 update(dt) 自动开启下一波（波号 = 当前波 + 1）。
   */
  public notifyWaveCleared(): void {
    this.completeWave();
  }

  /**
   * 记录一次击杀（真实战斗驱动的统计入口）。
   *
   * 与 recordEnemyDefeat 的区别：**不推进本管理器自己的波次计数**
   * （waveEnemiesDefeated）——真实战斗的敌人数由 WaveManager 决定，
   * 波次完成以战斗侧的 onWaveComplete → notifyWaveCleared() 为准。
   */
  public addKill(killScore: number, isBoss: boolean = false): void {
    this.stats.enemiesDefeated++;
    this.stats.score += killScore;
    if (isBoss) {
      this.stats.bossesDefeated++;
    }
  }

  public recordEnemyDefeat(enemyType: EnemyType, killScore: number): void {
    this.waveEnemiesDefeated++;
    this.stats.enemiesDefeated++;
    this.stats.score += killScore;

    if (enemyType === 'boss') {
      this.stats.bossesDefeated++;
    }
  }

  public recordPowerupCollection(): void {
    this.stats.powerupsCollected++;
  }

  public recordSkillUse(): void {
    this.stats.skillsUsed++;
  }

  public recordCombo(combo: number): void {
    if (combo > this.stats.maxCombo) {
      this.stats.maxCombo = combo;
    }
  }

  public recordDamageTaken(): void {}

  public setGameOver(): void {
    this.state = 'gameOver';
  }

  private startWave(waveNumber: number): void {
    this.stats.currentWave = waveNumber;
    this.currentWaveConfig = this.generateWaveConfig(waveNumber);
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesDefeated = 0;
    this.spawnTimer = 0;
    this.state = 'playing';
  }

  private completeWave(): void {
    if (!this.currentWaveConfig) return;

    this.stats.score += this.currentWaveConfig.rewardScore;

    this.state = 'waveTransition';
    this.transitionTimer = 3;
  }

  private generateWaveConfig(waveNumber: number): WaveConfig {
    const isBossWave = waveNumber % this.bossWaveInterval === 0;
    const isEliteWave = waveNumber % this.eliteWaveInterval === 0 && !isBossWave;

    const baseEnemyCount = 3 + Math.floor(waveNumber * 1.5);
    const healthMultiplier = 1 + (waveNumber - 1) * 0.15;
    const damageMultiplier = 1 + (waveNumber - 1) * 0.1;
    const speedMultiplier = 1 + (waveNumber - 1) * 0.08;
    const spawnInterval = Math.max(0.5, 2 - waveNumber * 0.1);

    const enemies: WaveConfig['enemies'] = [];

    if (isBossWave) {
      enemies.push({
        type: 'boss',
        count: 1,
        healthMultiplier: healthMultiplier * 5,
        damageMultiplier: damageMultiplier * 3,
        speedMultiplier: speedMultiplier * 0.7,
      });
      enemies.push({
        type: 'elite',
        count: Math.floor(waveNumber / 2),
        healthMultiplier: healthMultiplier * 2,
        damageMultiplier: damageMultiplier * 1.5,
        speedMultiplier: speedMultiplier * 1.2,
      });
    } else if (isEliteWave) {
      enemies.push({
        type: 'elite',
        count: Math.floor(baseEnemyCount * 0.3),
        healthMultiplier: healthMultiplier * 1.8,
        damageMultiplier: damageMultiplier * 1.4,
        speedMultiplier: speedMultiplier * 1.3,
      });
      enemies.push({
        type: 'basic',
        count: Math.floor(baseEnemyCount * 0.4),
        healthMultiplier,
        damageMultiplier,
        speedMultiplier,
      });
      enemies.push({
        type: 'fast',
        count: Math.floor(baseEnemyCount * 0.2),
        healthMultiplier: healthMultiplier * 0.6,
        damageMultiplier: damageMultiplier * 0.8,
        speedMultiplier: speedMultiplier * 1.5,
      });
      enemies.push({
        type: 'ranged',
        count: Math.floor(baseEnemyCount * 0.1),
        healthMultiplier: healthMultiplier * 0.7,
        damageMultiplier: damageMultiplier * 1.1,
        speedMultiplier: speedMultiplier * 0.8,
      });
    } else {
      const basicCount = Math.floor(baseEnemyCount * 0.5);
      const fastCount = Math.floor(baseEnemyCount * 0.3);
      const tankCount = waveNumber >= 2 ? Math.max(1, Math.floor(baseEnemyCount * 0.15)) : 0;
      const rangedCount = waveNumber >= 3 ? Math.max(1, Math.floor(baseEnemyCount * 0.15)) : 0;

      if (basicCount > 0) {
        enemies.push({
          type: 'basic',
          count: basicCount,
          healthMultiplier,
          damageMultiplier,
          speedMultiplier,
        });
      }

      if (fastCount > 0) {
        enemies.push({
          type: 'fast',
          count: fastCount,
          healthMultiplier: healthMultiplier * 0.5,
          damageMultiplier: damageMultiplier * 0.7,
          speedMultiplier: speedMultiplier * 1.4,
        });
      }

      if (tankCount > 0) {
        enemies.push({
          type: 'tank',
          count: tankCount,
          healthMultiplier: healthMultiplier * 2.5,
          damageMultiplier: damageMultiplier * 1.2,
          speedMultiplier: speedMultiplier * 0.6,
        });
      }

      if (rangedCount > 0) {
        enemies.push({
          type: 'ranged',
          count: rangedCount,
          healthMultiplier: healthMultiplier * 0.7,
          damageMultiplier: damageMultiplier * 1.1,
          speedMultiplier: speedMultiplier * 0.8,
        });
      }
    }

    const rewardScore = waveNumber * 1000;
    const bonusPowerups = isBossWave ? 3 : isEliteWave ? 2 : 1;

    return {
      waveNumber,
      enemies,
      spawnInterval,
      isBossWave,
      isEliteWave,
      rewardScore,
      bonusPowerups,
    };
  }

  private loadHighScores(): void {
    try {
      const stored = localStorage.getItem(this.highScoresStorageKey);
      if (stored) {
        this.highScores = JSON.parse(stored);
        this.highScores.sort((a, b) => b.score - a.score);
      }
    } catch {
      this.highScores = [];
    }
  }

  private saveHighScores(): void {
    try {
      localStorage.setItem(this.highScoresStorageKey, JSON.stringify(this.highScores));
    } catch {
      console.warn('Failed to save survival high scores');
    }
  }

  public addHighScore(name: string): boolean {
    if (this.stats.score <= 0) return false;

    const newScore: SurvivalHighScore = {
      rank: 0,
      name: name || 'Player',
      score: this.stats.score,
      wave: this.stats.currentWave,
      survivalTime: this.stats.survivalTime,
      date: new Date().toISOString(),
    };

    this.highScores.push(newScore);
    this.highScores.sort((a, b) => b.score - a.score);

    if (this.highScores.length > 10) {
      this.highScores = this.highScores.slice(0, 10);
    }

    this.highScores.forEach((score, index) => {
      score.rank = index + 1;
    });

    this.saveHighScores();

    return this.highScores[0].score === this.stats.score;
  }

  public getHighScores(): SurvivalHighScore[] {
    return [...this.highScores];
  }

  public getHighScore(): number {
    return this.highScores.length > 0 ? this.highScores[0].score : 0;
  }

  public isHighScore(score: number): boolean {
    if (this.highScores.length < 10) return true;
    return score > this.highScores[this.highScores.length - 1].score;
  }

  public clearHighScores(): void {
    this.highScores = [];
    this.saveHighScores();
  }

  public formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  public formatScore(score: number): string {
    return score.toLocaleString('en-US');
  }

  public getPreparingTimer(): number {
    return this.preparingTimer;
  }

  public getTransitionTimer(): number {
    return this.transitionTimer;
  }

  public reset(): void {
    this.state = 'menu';
    this.stats = this.createDefaultStats();
    this.currentWaveConfig = null;
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesDefeated = 0;
    this.spawnTimer = 0;
    this.transitionTimer = 0;
    this.preparingTimer = 0;
  }
}

export const survivalModeManager = SurvivalModeManager.getInstance();
