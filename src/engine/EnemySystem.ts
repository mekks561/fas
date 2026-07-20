import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { Enemy, EnemyType } from './Enemy';
import { WaveManager } from '../lua/wave/WaveManager';
import type { EnemyConfig as WaveEnemyConfig } from '../lua/wave/WaveManager';

export type PowerupDropCallback = (position: pc.Vec3, enemyType: EnemyType) => void;

export class EnemySystem {
  private engine: PlayCanvasGameEngine;
  private player: PlayerShip;
  private enemies: Enemy[] = [];
  private waveManager: WaveManager;
  private lastSpawnTime: number = 0;
  private spawnInterval: number = 1500;
  private waveActive: boolean = false;
  private powerupDropCallback: PowerupDropCallback | null = null;
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
      console.log(`[EnemySystem] Wave ${waveNumber} started: ${r.enemyCount} enemies (difficulty x${this.difficultyMultiplier.toFixed(2)})`);
    }
  }

  public update(dt: number): void {
    this.enemies = this.enemies.filter((enemy) => enemy.isAlive());

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
      if (state.currentState === 'completed' || (state.enemiesRemaining === 0 && this.enemies.length === 0)) {
        this.waveActive = false;
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

    const spawnRadius = 20 + Math.random() * 10;
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * spawnRadius;
    const z = Math.sin(angle) * spawnRadius;

    const enemy = new Enemy({
      engine: this.engine,
      type,
      position: new pc.Vec3(x, 0, z),
      player: this.player,
      difficultyMultiplier: this.difficultyMultiplier,
    });

    this.enemies.push(enemy);
  }

  /** 设置难度自适应倍率（由 GameScene 每帧同步） */
  public setDifficultyMultiplier(multiplier: number): void {
    this.difficultyMultiplier = multiplier > 0 ? multiplier : 1.0;
  }

  public onEnemyKilled(enemy: Enemy): number {
    let score = 100;
    if (this.waveManager) {
      const result = this.waveManager.onEnemyDefeated(enemy.getType());
      if (result.success) {
        const r = result as { score: number; isWaveComplete: boolean };
        score = r.score;
      }
    }

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
