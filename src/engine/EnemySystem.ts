import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { Enemy, EnemyType } from './Enemy';

export interface WaveConfig {
  enemies: { type: EnemyType; count: number }[];
  spawnDelay: number;
}

export class EnemySystem {
  private engine: PlayCanvasGameEngine;
  private player: PlayerShip;
  private enemies: Enemy[] = [];
  private waveConfig: WaveConfig[] = [
    { enemies: [{ type: EnemyType.SCOUT, count: 3 }], spawnDelay: 2000 },
    {
      enemies: [
        { type: EnemyType.SCOUT, count: 2 },
        { type: EnemyType.FIGHTER, count: 2 },
      ],
      spawnDelay: 1800,
    },
    {
      enemies: [
        { type: EnemyType.FIGHTER, count: 3 },
        { type: EnemyType.TANK, count: 1 },
      ],
      spawnDelay: 1500,
    },
    {
      enemies: [
        { type: EnemyType.ELITE, count: 3 },
        { type: EnemyType.FIGHTER, count: 2 },
      ],
      spawnDelay: 1200,
    },
    {
      enemies: [
        { type: EnemyType.BOSS, count: 1 },
        { type: EnemyType.ELITE, count: 2 },
      ],
      spawnDelay: 1000,
    },
  ];
  private currentWave: number = 0;
  private spawnQueue: EnemyType[] = [];
  private lastSpawnTime: number = 0;

  constructor(engine: PlayCanvasGameEngine, player: PlayerShip) {
    this.engine = engine;
    this.player = player;
    this.prepareWave(0);
  }

  private prepareWave(waveIndex: number): void {
    const config = this.waveConfig[waveIndex % this.waveConfig.length];
    this.spawnQueue = [];

    config.enemies.forEach(({ type, count }) => {
      for (let i = 0; i < count; i++) {
        this.spawnQueue.push(type);
      }
    });

    this.spawnQueue = this.shuffleArray(this.spawnQueue);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  public update(dt: number): void {
    const now = Date.now();
    const config = this.waveConfig[this.currentWave % this.waveConfig.length];

    if (this.spawnQueue.length > 0 && now - this.lastSpawnTime >= config.spawnDelay) {
      this.spawnEnemy();
      this.lastSpawnTime = now;
    }

    this.enemies = this.enemies.filter((enemy) => enemy.isAlive());
    this.enemies.forEach((enemy) => enemy.update(dt));

    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.nextWave();
    }
  }

  private spawnEnemy(): void {
    const type = this.spawnQueue.shift();
    if (!type) return;

    const spawnRadius = 20;
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * spawnRadius;
    const z = Math.sin(angle) * spawnRadius;

    const enemy = new Enemy({
      engine: this.engine,
      type,
      position: new pc.Vec3(x, 0, z),
      player: this.player,
    });

    this.enemies.push(enemy);
  }

  private nextWave(): void {
    this.currentWave++;
    this.prepareWave(this.currentWave);
  }

  public getEnemies(): Enemy[] {
    return this.enemies;
  }

  public getCurrentWave(): number {
    return this.currentWave + 1;
  }

  public getTotalWaves(): number {
    return this.waveConfig.length;
  }

  public destroyAll(): void {
    this.enemies.forEach((enemy) => enemy.destroy());
    this.enemies = [];
  }

  public reset(): void {
    this.destroyAll();
    this.currentWave = 0;
    this.prepareWave(0);
  }
}
