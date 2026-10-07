import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { Enemy, EnemyType } from './Enemy';
import { WaveManager } from '../lua/wave/WaveManager';
import type { EnemyConfig as WaveEnemyConfig } from '../lua/wave/WaveManager';
import { ENEMY_SPAWN } from './arena';

export type PowerupDropCallback = (position: pc.Vec3, enemyType: EnemyType) => void;

/** 阵亡敌人整体回调：每帧把本帧所有阵亡敌人一次性交给上层统一结算 */
export type EnemiesDefeatedCallback = (enemies: Enemy[]) => void;

export class EnemySystem {
  private engine: PlayCanvasGameEngine;
  private player: PlayerShip;
  private enemies: Enemy[] = [];
  private waveManager: WaveManager;
  private lastSpawnTime: number = 0;
  private spawnInterval: number = 1500;
  private waveActive: boolean = false;
  private powerupDropCallback: PowerupDropCallback | null = null;
  private enemiesDefeatedCallback: EnemiesDefeatedCallback | null = null;
  private dropRate: number = 0.15;
  /** 难度自适应倍率（缩放敌人生命/速度/伤害/生成间隔） */
  private difficultyMultiplier: number = 1.0;

  constructor(engine: PlayCanvasGameEngine, player: PlayerShip, waveManager?: WaveManager) {
    this.engine = engine;
    this.player = player;
    this.waveManager = waveManager || (null as unknown as WaveManager);
  }

  public setWaveManager(manager: WaveManager): void {
    this.waveManager = manager;
  }

  public startWave(waveNumber: number): void {
    if (!this.waveManager) {
      console.warn('[EnemySystem] WaveManager not set');
      return;
    }

    const result = this.waveManager.startWave(waveNumber);
    if (result.success) {
      this.waveActive = true;
      this.lastSpawnTime = 0;
      const r = result as { enemyCount: number; isBossWave: boolean };
      // 基础生成间隔随波次递减；难度倍率越高，生成越快（除以倍率），但不低于 350ms
      const baseInterval = r.isBossWave ? 2500 : Math.max(500, 1500 - waveNumber * 80);
      this.spawnInterval = Math.max(350, Math.round(baseInterval / this.difficultyMultiplier));
      console.log(
        `[EnemySystem] Wave ${waveNumber} started: ${r.enemyCount} enemies (difficulty x${this.difficultyMultiplier.toFixed(2)})`,
      );
    }
  }

  public update(dt: number): void {
    // 先把本帧阵亡的敌人整体回调给上层结算，再从数组移除。
    // 此前 filter 直接丢弃死敌，非武器击杀（技能/撞击/调试钩子）永远漏结算，
    // 导致波次计数不推进、游戏打完一波就静止。
    if (this.enemies.some((enemy) => !enemy.isAlive())) {
      const deadEnemies = this.enemies.filter((enemy) => !enemy.isAlive());
      this.enemies = this.enemies.filter((enemy) => enemy.isAlive());
      if (deadEnemies.length > 0) {
        this.enemiesDefeatedCallback?.(deadEnemies);
      }
    }

    if (this.waveActive && this.waveManager) {
      const now = Date.now();

      if (now - this.lastSpawnTime >= this.spawnInterval) {
        const spawnResult = this.waveManager.spawnNextEnemy();

        if (spawnResult.success) {
          const r = spawnResult as { enemy: WaveEnemyConfig };
          this.spawnEnemy(r.enemy);
          this.lastSpawnTime = now;
        }
      }

      this.waveManager.update(dt);
    }

    this.enemies.forEach((enemy) => enemy.update(dt));

    if (this.waveActive && this.waveManager) {
      const state = this.waveManager.getWaveState();
      if (
        state.currentState === 'completed' ||
        (state.enemiesRemaining === 0 && this.enemies.length === 0)
      ) {
        this.waveActive = false;
        console.log(`[EnemySystem] Wave completed`);
      }
    }
  }

  private enemyTypeFromString(type: string): EnemyType {
    const typeMap: Record<string, EnemyType> = {
      scout: EnemyType.SCOUT,
      fighter: EnemyType.FIGHTER,
      bomber: EnemyType.BOMBER,
      tank: EnemyType.TANK,
      assassin: EnemyType.ASSASSIN,
      drone: EnemyType.DRONE,
      elite: EnemyType.ELITE,
      corvette: EnemyType.CORVETTE,
      destroyer: EnemyType.DESTROYER,
      boss_sentinel: EnemyType.BOSS_SENTINEL,
      boss_overlord: EnemyType.BOSS_OVERLORD,
      boss: EnemyType.BOSS,
      basic: EnemyType.FIGHTER,
    };
    return typeMap[type] || EnemyType.FIGHTER;
  }

  private spawnEnemy(waveConfig: WaveEnemyConfig): void {
    const type = this.enemyTypeFromString(waveConfig.type);

    // 3D 球面均匀分布：使用 theta + phi 球坐标，让敌人在 Y 轴也随机分布。
    // 生成环半径与 Y 限幅的唯一真源是 arena.ts 的 ENEMY_SPAWN —— 它们必须与
    // PLAYER_BOUNDS 同比例，否则场地放大后敌机会全部挤在中心，玩家跑到边缘就
    // 「敌人在背后冒出来」。
    const spawnRadius =
      ENEMY_SPAWN.ringInner + Math.random() * (ENEMY_SPAWN.ringOuter - ENEMY_SPAWN.ringInner);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1); // 球面均匀分布
    const x = Math.cos(theta) * Math.sin(phi) * spawnRadius;
    // Y 范围稍小（×0.6），避免极端垂直位置，并限制在玩家可达范围
    const y = Math.sin(theta) * Math.sin(phi) * spawnRadius * 0.6;
    const z = Math.cos(phi) * spawnRadius;
    const clampedY = Math.max(-ENEMY_SPAWN.yLimit, Math.min(ENEMY_SPAWN.yLimit, y));

    const enemy = new Enemy({
      engine: this.engine,
      type,
      position: new pc.Vec3(x, clampedY, z),
      player: this.player,
      difficultyMultiplier: this.difficultyMultiplier,
    });

    this.enemies.push(enemy);
  }

  /** 设置难度自适应倍率（由 GameScene 每帧同步） */
  public setDifficultyMultiplier(multiplier: number): void {
    this.difficultyMultiplier = multiplier > 0 ? multiplier : 1.0;
  }

  /**
   * 单个敌人阵亡时的本地处理：返回该敌人的基础分（供上层统计），并按概率掉落道具。
   *
   * 注意：这里**不推进波次**。波次推进由 GameplayManager.onEnemyKilled 统一负责
   * （GameplayManager 持有 WaveManager）。此前这里也调用过 waveManager.onEnemyDefeated，
   * 与 GameplayManager 侧重复，一次击杀把 enemiesRemaining 扣两次，波次会提前完成。
   */
  public onEnemyKilled(enemy: Enemy): number {
    const score = 100;

    if (this.powerupDropCallback) {
      const isBoss = enemy.getType().includes('boss') || enemy.getType() === EnemyType.BOSS;
      const isElite = enemy.getType() === EnemyType.ELITE;
      const dropChance = isBoss ? 1.0 : isElite ? 0.5 : this.dropRate;
      if (Math.random() < dropChance) {
        this.powerupDropCallback(enemy.getPosition(), enemy.getType());
      }
    }

    return score;
  }

  public setPowerupDropCallback(callback: PowerupDropCallback): void {
    this.powerupDropCallback = callback;
  }

  public setEnemiesDefeatedCallback(callback: EnemiesDefeatedCallback): void {
    this.enemiesDefeatedCallback = callback;
  }

  public setDropRate(rate: number): void {
    this.dropRate = Math.max(0, Math.min(1, rate));
  }

  public getEnemies(): Enemy[] {
    return this.enemies;
  }

  public getAliveCount(): number {
    return this.enemies.filter((e) => e.isAlive()).length;
  }

  public getCurrentWave(): number {
    if (!this.waveManager) return 1;
    return this.waveManager.getWaveState().waveNumber;
  }

  public getTotalWaves(): number {
    if (!this.waveManager) return 10;
    return this.waveManager.getWaveState().maxWaves;
  }

  public getRemainingCount(): number {
    if (!this.waveManager) return this.enemies.length;
    const state = this.waveManager.getWaveState();
    return state.enemiesRemaining;
  }

  public isBossWave(): boolean {
    if (!this.waveManager) return false;
    return this.waveManager.getWaveState().isBossWave;
  }

  public isEliteWave(): boolean {
    if (!this.waveManager) return false;
    return this.waveManager.getWaveState().isEliteWave;
  }

  public isWaveActive(): boolean {
    return this.waveActive;
  }

  public destroyAll(): void {
    this.enemies.forEach((enemy) => enemy.destroy());
    this.enemies = [];
  }

  public reset(): void {
    this.destroyAll();
    this.waveActive = false;
    this.lastSpawnTime = 0;
    if (this.waveManager) {
      this.waveManager.reset();
    }
  }

  public pause(): void {
    if (this.waveManager) {
      this.waveManager.pauseWave();
    }
  }

  public resume(): void {
    if (this.waveManager) {
      this.waveManager.resumeWave();
    }
  }
}
