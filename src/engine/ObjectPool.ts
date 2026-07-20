import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { EnemyType } from './Enemy';
import { EnemyAI, EnemyAIFactory } from './EnemyAI';

export interface Poolable {
  entity: pc.Entity;
  reset(): void;
  destroy(): void;
}

export class ObjectPool<T extends Poolable> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private factory: () => T;
  private maxSize: number;
  private name: string;

  constructor(
    factory: () => T,
    initialSize: number = 10,
    maxSize: number = 100,
    name: string = 'ObjectPool',
  ) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.name = name;

    for (let i = 0; i < initialSize; i++) {
      this.available.push(this.factory());
    }
  }

  public acquire(): T | null {
    let obj: T;

    if (this.available.length > 0) {
      obj = this.available.pop() as T;
    } else if (this.inUse.size < this.maxSize) {
      obj = this.factory();
    } else {
      console.warn(`[ObjectPool:${this.name}] Pool exhausted, max size ${this.maxSize} reached`);
      return null;
    }

    this.inUse.add(obj);
    return obj;
  }

  public release(obj: T): void {
    if (!this.inUse.has(obj)) {
      console.warn(`[ObjectPool:${this.name}] Attempting to release object not in use`);
      return;
    }

    this.inUse.delete(obj);
    obj.reset();
    this.available.push(obj);
  }

  public releaseAll(): void {
    this.inUse.forEach((obj) => {
      obj.reset();
      this.available.push(obj);
    });
    this.inUse.clear();
  }

  public clear(): void {
    this.available.forEach((obj) => obj.destroy());
    this.inUse.forEach((obj) => obj.destroy());
    this.available = [];
    this.inUse.clear();
  }

  public getAvailableCount(): number {
    return this.available.length;
  }

  public getInUseCount(): number {
    return this.inUse.size;
  }

  public getTotalCount(): number {
    return this.available.length + this.inUse.size;
  }
}

export class ProjectilePoolItem implements Poolable {
  public entity: pc.Entity;
  private material: pc.StandardMaterial;
  private initialPosition: pc.Vec3;
  private initialScale: number;

  constructor(
    _engine: pc.Application,
    material: pc.StandardMaterial,
    initialPosition: pc.Vec3 = new pc.Vec3(0, 0, 0),
    _initialVelocity: pc.Vec3 = new pc.Vec3(0, 0, 0),
    scale: number = 0.15,
  ) {
    this.material = material;
    this.initialPosition = initialPosition.clone();
    this.initialScale = scale;

    this.entity = new pc.Entity('projectile');
    this.entity.addComponent('model', { type: 'sphere' });
    if (this.entity.model) this.entity.model.material = this.material;
    this.entity.setLocalScale(scale, scale, scale);
  }

  public reset(): void {
    this.entity.enabled = true;
    this.entity.setPosition(this.initialPosition);
    this.entity.setLocalScale(this.initialScale, this.initialScale, this.initialScale);

    if (this.entity.rigidbody) {
      this.entity.rigidbody.linearVelocity = new pc.Vec3(0, 0, 0);
      this.entity.rigidbody.angularVelocity = new pc.Vec3(0, 0, 0);
    }
  }

  public destroy(): void {
    this.entity.destroy();
  }

  public setInitialState(position: pc.Vec3, _velocity: pc.Vec3): void {
    this.initialPosition = position.clone();
  }
}

export class ParticlePoolItem implements Poolable {
  public entity: pc.Entity;

  constructor() {
    this.entity = new pc.Entity('particle');
    this.entity.addComponent('particlesystem', {
      type: 'box',
      lifetime: 0.5,
      rate: 0,
      burst: 50,
      speed: 15,
      spread: 360,
    });
  }

  public reset(): void {
    this.entity.enabled = true;
    if (this.entity.particlesystem) {
      this.entity.particlesystem.stop();
    }
  }

  public destroy(): void {
    this.entity.destroy();
  }

  public play(): void {
    if (this.entity.particlesystem) {
      this.entity.particlesystem.start();
    }
  }

  public stop(): void {
    if (this.entity.particlesystem) {
      this.entity.particlesystem.stop();
    }
  }

  public setPosition(pos: pc.Vec3): void {
    this.entity.setPosition(pos);
  }

  public setColor(_colors: [pc.Color, pc.Color, pc.Color, pc.Color]): void {
  }
}

export class EnemyPoolItem implements Poolable {
  public entity: pc.Entity;
  private player: PlayerShip;
  private ai: EnemyAI | null = null;
  private type: EnemyType;
  private health: number;
  private maxHealth: number;
  private damage: number;
  private attackCooldown: number;
  private lastAttackTime: number = 0;

  constructor(_engine: PlayCanvasGameEngine, player: PlayerShip, type: EnemyType) {
    this.player = player;
    this.type = type;

    const stats = this.getStatsForType(type);
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.damage = stats.damage;
    this.attackCooldown = stats.attackCooldown;

    this.entity = this.createEnemyEntity();
  }

  private getStatsForType(type: EnemyType): {
    health: number;
    speed: number;
    damage: number;
    attackCooldown: number;
  } {
    switch (type) {
      case EnemyType.SCOUT:
        return { health: 20, speed: 8, damage: 10, attackCooldown: 2000 };
      case EnemyType.FIGHTER:
        return { health: 40, speed: 5, damage: 15, attackCooldown: 1500 };
      case EnemyType.TANK:
        return { health: 100, speed: 2, damage: 25, attackCooldown: 3000 };
      case EnemyType.ELITE:
        return { health: 60, speed: 6, damage: 20, attackCooldown: 1200 };
      case EnemyType.BOSS:
        return { health: 300, speed: 3, damage: 40, attackCooldown: 2000 };
      default:
        return { health: 30, speed: 5, damage: 12, attackCooldown: 2000 };
    }
  }

  private createEnemyEntity(): pc.Entity {
    const material = this.createEnemyMaterial();
    const enemy = new pc.Entity(`enemy_${this.type}`);

    switch (this.type) {
      case EnemyType.SCOUT:
        enemy.addComponent('model', { type: 'sphere' });
        enemy.setLocalScale(0.5, 0.5, 0.5);
        break;
      case EnemyType.FIGHTER:
        enemy.addComponent('model', { type: 'box' });
        enemy.setLocalScale(0.8, 0.6, 0.8);
        break;
      case EnemyType.TANK:
        enemy.addComponent('model', { type: 'box' });
        enemy.setLocalScale(1.5, 1, 1.5);
        break;
      case EnemyType.ELITE:
        enemy.addComponent('model', { type: 'diamond' });
        enemy.setLocalScale(0.8, 1, 0.8);
        break;
      case EnemyType.BOSS:
        enemy.addComponent('model', { type: 'box' });
        enemy.setLocalScale(2, 1, 2);
        break;
    }

    if (enemy.model) enemy.model.material = material;
    return enemy;
  }

  private createEnemyMaterial(): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    switch (this.type) {
      case EnemyType.SCOUT:
        material.diffuse.set(0.5, 0.5, 0.8);
        material.emissive.set(0.3, 0.3, 0.6);
        break;
      case EnemyType.FIGHTER:
        material.diffuse.set(0.8, 0.3, 0.3);
        material.emissive.set(0.6, 0.2, 0.2);
        break;
      case EnemyType.TANK:
        material.diffuse.set(0.6, 0.6, 0.6);
        material.emissive.set(0.3, 0.3, 0.3);
        break;
      case EnemyType.ELITE:
        material.diffuse.set(0.6, 0.3, 1);
        material.emissive.set(0.4, 0.2, 0.8);
        break;
      case EnemyType.BOSS:
        material.diffuse.set(1, 0.5, 0);
        material.emissive.set(0.8, 0.4, 0);
        break;
    }
    material.update();
    return material;
  }

  public reset(): void {
    this.entity.enabled = true;
    const stats = this.getStatsForType(this.type);
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.damage = stats.damage;
    this.attackCooldown = stats.attackCooldown;
    this.lastAttackTime = 0;
  }

  public destroy(): void {
    this.entity.destroy();
  }

  public initialize(position: pc.Vec3): void {
    this.entity.setPosition(position);
    this.ai = EnemyAIFactory.createAI(this.type, this.entity, this.player, position);
  }

  public update(dt: number): void {
    if (!this.ai) return;
    this.ai.update(dt);

    const now = Date.now();
    const distance = this.getDistanceToPlayer();

    if (distance <= 3 && now - this.lastAttackTime >= this.attackCooldown) {
      this.player.takeDamage(this.damage);
      this.lastAttackTime = now;
    }
  }

  private getDistanceToPlayer(): number {
    const playerPos = this.player.getPosition();
    const enemyPos = this.entity.getPosition();
    return playerPos.clone().sub(enemyPos).length();
  }

  public takeDamage(damage: number): number {
    this.health -= damage;
    return this.health;
  }

  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }

  public getType(): EnemyType {
    return this.type;
  }
}

export class ExplosionPoolItem implements Poolable {
  public entity: pc.Entity;
  private particleSystem: pc.ParticleSystemComponent | undefined;
  private duration: number = 0;
  private maxDuration: number = 0.5;

  constructor(_app: pc.Application) {
    this.entity = new pc.Entity('explosion');
    this.entity.addComponent('particlesystem', {
      type: 'sphere',
      lifetime: this.maxDuration,
      rate: 0,
      burst: 100,
      speed: 20,
      spread: 360,
    });
    this.particleSystem = this.entity.particlesystem;
    this.entity.enabled = false;
  }

  public reset(): void {
    this.entity.enabled = true;
    this.duration = 0;
    if (this.particleSystem) {
      this.particleSystem.stop();
    }
  }

  public destroy(): void {
    this.entity.destroy();
  }

  public play(position: pc.Vec3): void {
    this.entity.setPosition(position);
    this.duration = 0;
    this.entity.enabled = true;
    if (this.particleSystem) {
      this.particleSystem.start();
    }
  }

  public update(dt: number): boolean {
    this.duration += dt;
    return this.duration >= this.maxDuration;
  }
}

export class ObjectPoolManager {
  private pools: Map<string, ObjectPool<Poolable>> = new Map();
  private app: pc.Application;

  constructor(app: pc.Application) {
    this.app = app;
  }

  public createProjectilePool(
    material: pc.StandardMaterial,
    initialSize: number = 20,
    maxSize: number = 200,
  ): ObjectPool<ProjectilePoolItem> {
    const pool = new ObjectPool<ProjectilePoolItem>(
      () => new ProjectilePoolItem(this.app, material),
      initialSize,
      maxSize,
      'ProjectilePool',
    );
    this.pools.set('projectile', pool);
    return pool;
  }

  public createParticlePool(
    initialSize: number = 10,
    maxSize: number = 50,
  ): ObjectPool<ParticlePoolItem> {
    const pool = new ObjectPool<ParticlePoolItem>(
      () => new ParticlePoolItem(),
      initialSize,
      maxSize,
      'ParticlePool',
    );
    this.pools.set('particle', pool);
    return pool;
  }

  public createEnemyPool(
    engine: PlayCanvasGameEngine,
    player: PlayerShip,
    type: EnemyType,
    initialSize: number = 10,
    maxSize: number = 50,
  ): ObjectPool<EnemyPoolItem> {
    const pool = new ObjectPool<EnemyPoolItem>(
      () => new EnemyPoolItem(engine, player, type),
      initialSize,
      maxSize,
      `EnemyPool_${type}`,
    );
    this.pools.set(`enemy_${type}`, pool);
    return pool;
  }

  public createExplosionPool(
    initialSize: number = 10,
    maxSize: number = 50,
  ): ObjectPool<ExplosionPoolItem> {
    const pool = new ObjectPool<ExplosionPoolItem>(
      () => new ExplosionPoolItem(this.app),
      initialSize,
      maxSize,
      'ExplosionPool',
    );
    this.pools.set('explosion', pool);
    return pool;
  }

  public getPool(name: string): ObjectPool<Poolable> | undefined {
    return this.pools.get(name);
  }

  public releaseAll(): void {
    this.pools.forEach((pool) => pool.releaseAll());
  }

  public clearAll(): void {
    this.pools.forEach((pool) => pool.clear());
    this.pools.clear();
  }

  public getPoolStats(): { name: string; available: number; inUse: number; total: number }[] {
    const stats: { name: string; available: number; inUse: number; total: number }[] = [];

    this.pools.forEach((pool, name) => {
      stats.push({
        name,
        available: pool.getAvailableCount(),
        inUse: pool.getInUseCount(),
        total: pool.getTotalCount(),
      });
    });

    return stats;
  }
}
