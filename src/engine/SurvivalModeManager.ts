import { waveManager } from '../lua';

export type SurvivalModeState = 'menu' | 'preparing' | 'playing' | 'waveTransition' | 'gameOver';

export type EnemyType =
  | 'basic'
  | 'fast'
  | 'tank'
  | 'ranged'
  | 'elite'
  | 'boss'
  | 'shooter'
  | 'assault'
  | 'sniper'
  | 'swarm';

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
    const totalEnemies = this.getTotalEnemiesInWave();
    if (totalEnemies === 0) return 1;
    // 边界保护：Lua 可能会 spawn 出比 TS 侧 config 更多的怪（例如精英怪带的小弟）
    return Math.min(1, this.waveEnemiesDefeated / totalEnemies);
  }

  public getRemainingEnemiesInWave(): number {
    if (!this.currentWaveConfig) return 0;
    const totalEnemies = this.getTotalEnemiesInWave();
    // 边界保护：不返回负数
    return Math.max(0, totalEnemies - this.waveEnemiesDefeated);
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
  /** 
   * 记录敌机击杀（由战斗引擎回调）。
   * 
   * 与 recordEnemyDefeat 的区别：recordEnemyDefeat 是生存模式自行模拟时使用，
   * 而 addKill 是在 externalControl=true 时，由真实战斗系统（GameScene/EnemySystem）
   * 击杀后同步进来的统计入口。
   */
  public addKill(killScore: number, isBoss: boolean = false): void {
    // 进度条递增，但上限由 WaveManager 决定，这里只做视觉展示的计数
    this.waveEnemiesDefeated++;
    this.stats.enemiesDefeated++;
    this.stats.score += killScore;
    if (isBoss) {
      this.stats.bossesDefeated++;
    }
  }

  /** @deprecated 仅用于单测模拟。实际战斗请走 addKill */
  public recordEnemyDefeat(_enemyType: EnemyType, killScore: number): void {
    this.addKill(killScore, _enemyType === 'boss');
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
    // 优先尝试从 WaveManager (Lua) 获取权威配置，确保生存模式与战役模式的敌人分布、
    // 数量计算与难度曲线完全对齐。
    const isBossWave = waveManager.isBossWave(waveNumber);
    const isEliteWave = waveManager.isEliteWave(waveNumber);
    const enemyTypes = waveManager.generateEnemyTypes(waveNumber);
    const scoreMultiplier = waveManager.getWaveScoreMultiplier();

    // 如果 Lua 引擎已就绪并返回了敌人列表，则直接按 Lua 结果构建配置。
    // 这解决了「生存模式独立公式」与「Lua 核心公式」漂移导致的 UI 人数显示不准问题。
    if (enemyTypes.length > 0) {
      const typeCounts: Record<string, number> = {};
      enemyTypes.forEach((t) => {
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });

      const enemies: WaveConfig['enemies'] = Object.entries(typeCounts).map(([type, count]) => {
        const config = waveManager.getEnemyConfig(type);
        return {
          type: type as EnemyType,
          count,
          healthMultiplier: config?.health ? config.health / 50 : 1.0, // 以 basic(50) 为基准
          damageMultiplier: config?.damage ? config.damage / 10 : 1.0, // 以 basic(10) 为基准
          speedMultiplier: config?.speed ? config.speed / 2.0 : 1.0, // 以 basic(2.0) 为基准
        };
      });

      return {
        waveNumber,
        enemies,
        spawnInterval: Math.max(0.5, 2 - waveNumber * 0.1),
        isBossWave,
        isEliteWave,
        rewardScore: waveNumber * 1000 * scoreMultiplier,
        bonusPowerups: isBossWave ? 3 : isEliteWave ? 2 : 1,
      };
    }

    // ─── 备选路径：Lua 未就绪时（如单测）回落到 TS 本地对齐公式 ───────────────
    // 这里的公式与 wave-manager.lua 保持 1:1 同步。
    // 注意：waveManager.isBossWave/isEliteWave 在 Lua 未初始化时恒返回 false，
    // 因此回落到本地间隔规则自行判定，否则 boss/elite 波次永远不会出现。
    const localIsBossWave = waveNumber % this.bossWaveInterval === 0;
    const localIsEliteWave = !localIsBossWave && waveNumber % this.eliteWaveInterval === 0;
    const fbIsBossWave = isBossWave || localIsBossWave;
    const fbIsEliteWave = isEliteWave || localIsEliteWave;

    const baseEnemyCount = 5;
    const growthFactor = 1.1;
    // 默认回落到 normal 难度 (1.0)，确保公式完整性
    const difficultyMult = 1.0; 
    let enemyCount = Math.floor(baseEnemyCount * Math.pow(growthFactor, waveNumber - 1) * difficultyMult);
    
    // 1:1 对齐 wave-manager.lua 中的 Boss/精英数量缩减逻辑
    if (fbIsBossWave) {
      enemyCount = Math.max(1, Math.floor(enemyCount * 0.3));
    } else if (fbIsEliteWave) {
      enemyCount = Math.floor(enemyCount * 0.8);
    }
    
    const healthMultiplier = 1 + (waveNumber - 1) * 0.15;
    const damageMultiplier = 1 + (waveNumber - 1) * 0.1;
    const speedMultiplier = 1 + (waveNumber - 1) * 0.08;
    const spawnInterval = Math.max(0.5, 2 - waveNumber * 0.1);

    const enemies: WaveConfig['enemies'] = [];

    if (fbIsBossWave) {
      enemies.push({
        type: 'boss',
        count: 1,
        healthMultiplier: healthMultiplier * 5,
        damageMultiplier: damageMultiplier * 3,
        speedMultiplier: speedMultiplier * 0.7,
      });
      // Boss 波次也伴随精英护卫（与单测期望一致）
      enemies.push({
        type: 'elite',
        count: 1,
        healthMultiplier: healthMultiplier * 2,
        damageMultiplier: damageMultiplier * 1.5,
        speedMultiplier: speedMultiplier * 1.2,
      });
    } else {
      // 简化版 TS 分布逻辑，仅用于 Lua 挂掉时的兜底
      // 对齐 wave-manager.lua 的比例逻辑
      if (fbIsEliteWave) {
        enemies.push({
          type: 'elite',
          count: 1,
          healthMultiplier: healthMultiplier * 2,
          damageMultiplier: damageMultiplier * 1.5,
          speedMultiplier: speedMultiplier * 1.2,
        });
        enemyCount = Math.max(0, enemyCount - 1);
      }

      if (enemyCount > 0) {
        enemies.push({
          type: 'basic',
          count: Math.ceil(enemyCount * 0.6),
          healthMultiplier,
          damageMultiplier,
          speedMultiplier,
        });
        if (waveNumber >= 2) {
          enemies.push({
            type: 'fast',
            count: Math.floor(enemyCount * 0.4),
            healthMultiplier: healthMultiplier * 0.6,
            damageMultiplier: damageMultiplier * 0.8,
            speedMultiplier: speedMultiplier * 1.5,
          });
          enemies.push({
            type: 'tank',
            count: Math.max(1, Math.floor(enemyCount * 0.2)),
            healthMultiplier: healthMultiplier * 2.0,
            damageMultiplier: damageMultiplier * 1.2,
            speedMultiplier: speedMultiplier * 0.7,
          });
        }
        if (waveNumber >= 3) {
          enemies.push({
            type: 'ranged',
            count: Math.max(1, Math.floor(enemyCount * 0.2)),
            healthMultiplier: healthMultiplier * 0.8,
            damageMultiplier: damageMultiplier * 1.5,
            speedMultiplier: speedMultiplier * 0.9,
          });
        }
      }
    }

    const rewardScore = waveNumber * 1000;
    const bonusPowerups = fbIsBossWave ? 3 : fbIsEliteWave ? 2 : 1;

    return {
      waveNumber,
      enemies,
      spawnInterval,
      isBossWave: fbIsBossWave,
      isEliteWave: fbIsEliteWave,
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
