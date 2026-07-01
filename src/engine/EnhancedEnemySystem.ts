/**
 * 增强版敌人管理系统
 * 扩展功能：波次系统、难度递增、BOSS战、敌人AI行为树
 */

import * as pc from 'playcanvas';
import { EnhancedPlayCanvasEngine } from './EnhancedPlayCanvasEngine';
import { EnhancedPlayerShip } from './EnhancedPlayerShip';
import { EnhancedEnemy, EnemyType, AIState } from './EnhancedEnemy';

export interface WaveConfig {
  enemies: { type: EnemyType; count: number }[];
  spawnDelay: number;
  difficulty: number;
  isBossWave?: boolean;
  bossType?: EnemyType;
}

export class EnhancedEnemySystem {
  private engine: EnhancedPlayCanvasEngine;
  private player: EnhancedPlayerShip;
  private enemies: EnhancedEnemy[] = [];
  private waveConfigs: WaveConfig[] = [];
  private currentWave: number = 0;
  private spawnQueue: EnemyType[] = [];
  private lastSpawnTime: number = 0;
  private waveActive: boolean = false;
  private waveCompleteCallback?: () => void;
  
  private scoreMultiplier: number = 1;
  private difficultyLevel: number = 1;
  
  constructor(engine: EnhancedPlayCanvasEngine, player: EnhancedPlayerShip) {
    this.engine = engine;
    this.player = player;
    this.initializeWaveConfigs();
    this.prepareWave(0);
  }
  
  private initializeWaveConfigs(): void {
    this.waveConfigs = [
      {
        enemies: [{ type: EnemyType.SCOUT, count: 3 }],
        spawnDelay: 2000,
        difficulty: 1,
        isBossWave: false
      },
      {
        enemies: [{ type: EnemyType.SCOUT, count: 2 }, { type: EnemyType.FIGHTER, count: 2 }],
        spawnDelay: 1800,
        difficulty: 1.2,
        isBossWave: false
      },
      {
        enemies: [{ type: EnemyType.FIGHTER, count: 3 }, { type: EnemyType.TANK, count: 1 }],
        spawnDelay: 1500,
        difficulty: 1.5,
        isBossWave: false
      },
      {
        enemies: [{ type: EnemyType.ELITE, count: 3 }, { type: EnemyType.FIGHTER, count: 2 }],
        spawnDelay: 1200,
        difficulty: 2,
        isBossWave: false
      },
      {
        enemies: [],
        spawnDelay: 0,
        difficulty: 3,
        isBossWave: true,
        bossType: EnemyType.BOSS
      },
      {
        enemies: [{ type: EnemyType.SNIPER, count: 2 }, { type: EnemyType.ASSASSIN, count: 2 }],
        spawnDelay: 1000,
        difficulty: 2.5,
        isBossWave: false
      },
      {
        enemies: [{ type: EnemyType.SUPPORT, count: 2 }, { type: EnemyType.ELITE, count: 3 }],
        spawnDelay: 1100,
        difficulty: 2.8,
        isBossWave: false
      },
      {
        enemies: [],
        spawnDelay: 0,
        difficulty: 4,
        isBossWave: true,
        bossType: EnemyType.BOSS
      },
      {
        enemies: [
          { type: EnemyType.SCOUT, count: 3 },
          { type: EnemyType.FIGHTER, count: 3 },
          { type: EnemyType.TANK, count: 2 },
          { type: EnemyType.SNIPER, count: 1 }
        ],
        spawnDelay: 800,
        difficulty: 3.5,
        isBossWave: false
      },
      {
        enemies: [],
        spawnDelay: 0,
        difficulty: 5,
        isBossWave: true,
        bossType: EnemyType.BOSS
      }
    ];
  }
  
  private prepareWave(waveIndex: number): void {
    const config = this.waveConfigs[waveIndex % this.waveConfigs.length];
    this.spawnQueue = [];
    
    const adjustedDifficulty = config.difficulty * this.difficultyLevel;
    
    if (config.isBossWave && config.bossType) {
      const bossCount = Math.min(Math.floor(this.currentWave / 5) + 1, 3);
      for (let i = 0; i < bossCount; i++) {
        this.spawnQueue.push(config.bossType);
      }
    } else {
      config.enemies.forEach(({ type, count }) => {
        const adjustedCount = Math.floor(count * adjustedDifficulty);
        for (let i = 0; i < Math.max(adjustedCount, count); i++) {
          this.spawnQueue.push(type);
        }
      });
    }
    
    this.spawnQueue = this.shuffleArray(this.spawnQueue);
    this.waveActive = true;
  }
  
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  
  public update(dt: number): number {
    let totalDamage = 0;
    
    const now = Date.now();
    const config = this.waveConfigs[this.currentWave % this.waveConfigs.length];
    
    if (this.spawnQueue.length > 0 && now - this.lastSpawnTime >= config.spawnDelay) {
      this.spawnEnemy();
      this.lastSpawnTime = now;
    }
    
    this.enemies = this.enemies.filter(enemy => enemy.isAlive());
    
    this.enemies.forEach(enemy => {
      enemy.update(dt);
      
      if (enemy.getAIState() === AIState.ATTACK) {
        totalDamage += enemy.getMaxHealth() * 0.01;
      }
    });
    
    if (this.spawnQueue.length === 0 && this.enemies.length === 0 && this.waveActive) {
      this.completeWave();
    }
    
    return totalDamage;
  }
  
  private spawnEnemy(): void {
    const type = this.spawnQueue.shift();
    if (!type) return;
    
    const spawnRadius = 25 + this.currentWave * 2;
    const angle = Math.random() * Math.PI * 2;
    const height = Math.random() * 5 - 2.5;
    
    const x = Math.cos(angle) * spawnRadius;
    const z = Math.sin(angle) * spawnRadius;
    
    const enemy = new EnhancedEnemy(
      this.engine,
      type,
      new pc.Vec3(x, height, z),
      this.player
    );
    
    this.enemies.push(enemy);
  }
  
  private completeWave(): void {
    this.waveActive = false;
    this.currentWave++;
    this.scoreMultiplier += 0.1;
    
    if (this.currentWave % 5 === 0) {
      this.difficultyLevel += 0.5;
    }
    
    if (this.waveCompleteCallback) {
      this.waveCompleteCallback();
    }
    
    setTimeout(() => {
      this.prepareWave(this.currentWave);
    }, 3000);
  }
  
  public checkCollisions(projectiles: any[]): number {
    let hits = 0;
    
    this.enemies.forEach(enemy => {
      if (!enemy.isAlive()) return;
      
      projectiles.forEach(proj => {
        if (!proj.active) return;
        
        const projPos = proj.entity.getPosition();
        const enemyPos = enemy.getPosition();
        const distance = projPos.clone().sub(enemyPos).length();
        
        if (distance < 1) {
          enemy.takeDamage(proj.damage);
          proj.active = false;
          hits++;
        }
      });
    });
    
    return hits;
  }
  
  public getEnemies(): EnhancedEnemy[] {
    return this.enemies;
  }
  
  public getCurrentWave(): number {
    return this.currentWave + 1;
  }
  
  public getTotalWaves(): number {
    return this.waveConfigs.length;
  }
  
  public getScoreMultiplier(): number {
    return this.scoreMultiplier;
  }
  
  public getDifficultyLevel(): number {
    return this.difficultyLevel;
  }
  
  public isWaveActive(): boolean {
    return this.waveActive;
  }
  
  public setWaveCompleteCallback(callback: () => void): void {
    this.waveCompleteCallback = callback;
  }
  
  public destroyAll(): void {
    this.enemies.forEach(enemy => enemy.destroy());
    this.enemies = [];
  }
  
  public reset(): void {
    this.destroyAll();
    this.currentWave = 0;
    this.scoreMultiplier = 1;
    this.difficultyLevel = 1;
    this.prepareWave(0);
  }
  
  public getEnemyCount(): number {
    return this.enemies.length;
  }
  
  public getSpawnQueueCount(): number {
    return this.spawnQueue.length;
  }
}