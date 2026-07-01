import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { EnemyAI, EnemyAIFactory, AIState, StatusEffect } from './EnemyAI';
import { ProceduralModelGenerator, EnemyModelType } from './ProceduralModelGenerator';

export enum EnemyType {
  SCOUT = 'scout',
  FIGHTER = 'fighter',
  BOMBER = 'bomber',
  TANK = 'tank',
  ASSASSIN = 'assassin',
  DRONE = 'drone',
  ELITE = 'elite',
  CORVETTE = 'corvette',
  DESTROYER = 'destroyer',
  BOSS_SENTINEL = 'boss_sentinel',
  BOSS_OVERLORD = 'boss_overlord',
  BOSS = 'boss'
}

export interface EnemyConfig {
  engine: PlayCanvasGameEngine;
  type: EnemyType;
  position: pc.Vec3;
  player: PlayerShip;
}

export interface EnemyStats {
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  attackRange: number;
  armor: number;
}

export class Enemy {
  protected engine: PlayCanvasGameEngine;
  protected entity: pc.Entity;
  protected type: EnemyType;
  protected stats: EnemyStats;
  protected player: PlayerShip;
  protected ai: EnemyAI;
  protected modelGenerator: ProceduralModelGenerator;
  protected lastAttackTime: number = 0;
  protected statusEffects: StatusEffect[] = [];
  protected isDying: boolean = false;
  protected deathTimer: number = 0;
  protected healthBarEntity: pc.Entity | null = null;
  protected health: number;
  protected maxHealth: number;
  protected speed: number;
  protected damage: number;
  protected attackCooldown: number;
  
  constructor(config: EnemyConfig) {
    this.engine = config.engine;
    this.type = config.type;
    this.player = config.player;
    
    const stats = this.getStatsForType(config.type);
    this.stats = stats;
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.speed = stats.speed;
    this.damage = stats.damage;
    this.attackCooldown = stats.attackCooldown;
    this.lastAttackTime = 0;
    
    this.modelGenerator = new ProceduralModelGenerator(this.engine.getApp());
    this.entity = this.createEnemy(config.position);
    this.ai = EnemyAIFactory.createAI(config.type, this.entity, config.player, config.position);
  }
  
  private getStatsForType(type: EnemyType): EnemyStats {
    switch (type) {
      case EnemyType.SCOUT:
        return { health: 20, maxHealth: 20, speed: 8, damage: 10, attackCooldown: 2000, attackRange: 2, armor: 0 };
      case EnemyType.FIGHTER:
        return { health: 40, maxHealth: 40, speed: 5, damage: 15, attackCooldown: 1500, attackRange: 3, armor: 5 };
      case EnemyType.BOMBER:
        return { health: 60, maxHealth: 60, speed: 3, damage: 30, attackCooldown: 2500, attackRange: 4, armor: 10 };
      case EnemyType.TANK:
        return { health: 100, maxHealth: 100, speed: 2, damage: 25, attackCooldown: 3000, attackRange: 4, armor: 20 };
      case EnemyType.ASSASSIN:
        return { health: 35, maxHealth: 35, speed: 10, damage: 35, attackCooldown: 1800, attackRange: 2, armor: 3 };
      case EnemyType.DRONE:
        return { health: 15, maxHealth: 15, speed: 7, damage: 8, attackCooldown: 1200, attackRange: 2.5, armor: 0 };
      case EnemyType.ELITE:
        return { health: 60, maxHealth: 60, speed: 6, damage: 20, attackCooldown: 1200, attackRange: 5, armor: 10 };
      case EnemyType.CORVETTE:
        return { health: 80, maxHealth: 80, speed: 4, damage: 22, attackCooldown: 2000, attackRange: 5, armor: 15 };
      case EnemyType.DESTROYER:
        return { health: 150, maxHealth: 150, speed: 2.5, damage: 35, attackCooldown: 2800, attackRange: 6, armor: 25 };
      case EnemyType.BOSS_SENTINEL:
        return { health: 300, maxHealth: 300, speed: 2, damage: 40, attackCooldown: 1500, attackRange: 7, armor: 25 };
      case EnemyType.BOSS_OVERLORD:
        return { health: 500, maxHealth: 500, speed: 1.5, damage: 50, attackCooldown: 1200, attackRange: 8, armor: 35 };
      case EnemyType.BOSS:
        return { health: 300, maxHealth: 300, speed: 3, damage: 40, attackCooldown: 2000, attackRange: 6, armor: 30 };
      default:
        return { health: 30, maxHealth: 30, speed: 5, damage: 12, attackCooldown: 2000, attackRange: 3, armor: 5 };
    }
  }
  
  private createEnemy(position: pc.Vec3): pc.Entity {
    const enemy = new pc.Entity('enemy');
    enemy.setPosition(position);

    const modelType = this.getModelTypeForEnemy();
    const modelOptions = this.getModelOptionsForEnemy();
    const modelRoot = this.modelGenerator.createEnemyModel(modelType, modelOptions);
    enemy.addChild(modelRoot);

    this.engine.addToScene(enemy);

    return enemy;
  }

  private getModelTypeForEnemy(): EnemyModelType {
    switch (this.type) {
      case EnemyType.SCOUT: return 'scout';
      case EnemyType.FIGHTER: return 'fighter';
      case EnemyType.BOMBER: return 'bomber';
      case EnemyType.TANK: return 'tank';
      case EnemyType.ASSASSIN: return 'assassin';
      case EnemyType.DRONE: return 'drone';
      case EnemyType.ELITE: return 'fighter';
      case EnemyType.CORVETTE: return 'corvette';
      case EnemyType.DESTROYER: return 'destroyer';
      case EnemyType.BOSS_SENTINEL: return 'boss_sentinel';
      case EnemyType.BOSS_OVERLORD: return 'boss_overlord';
      case EnemyType.BOSS: return 'boss_sentinel';
      default: return 'fighter';
    }
  }

  private getModelOptionsForEnemy(): { primaryColor?: [number, number, number]; emissiveColor?: [number, number, number]; scale?: number } {
    switch (this.type) {
      case EnemyType.SCOUT:
        return { primaryColor: [0.4, 0.8, 0.4], emissiveColor: [0.1, 0.3, 0.1], scale: 0.8 };
      case EnemyType.FIGHTER:
        return { primaryColor: [0.8, 0.5, 0.2], emissiveColor: [0.2, 0.1, 0], scale: 1 };
      case EnemyType.BOMBER:
        return { primaryColor: [0.5, 0.3, 0.1], emissiveColor: [0.1, 0.05, 0], scale: 1.2 };
      case EnemyType.TANK:
        return { primaryColor: [0.4, 0.4, 0.45], emissiveColor: [0.05, 0.05, 0.05], scale: 1.5 };
      case EnemyType.ASSASSIN:
        return { primaryColor: [0.6, 0.3, 1.0], emissiveColor: [0.3, 0.1, 0.5], scale: 0.9 };
      case EnemyType.DRONE:
        return { primaryColor: [0.3, 0.3, 0.35], emissiveColor: [0.1, 0.1, 0.15], scale: 0.6 };
      case EnemyType.ELITE:
        return { primaryColor: [0.6, 0.3, 1.0], emissiveColor: [0.3, 0.1, 0.5], scale: 1.1 };
      case EnemyType.CORVETTE:
        return { primaryColor: [0.3, 0.4, 0.5], emissiveColor: [0.05, 0.1, 0.15], scale: 1.3 };
      case EnemyType.DESTROYER:
        return { primaryColor: [0.25, 0.25, 0.3], emissiveColor: [0.05, 0.05, 0.1], scale: 1.8 };
      case EnemyType.BOSS_SENTINEL:
        return { primaryColor: [0.5, 0.2, 0.2], emissiveColor: [0.3, 0.1, 0.1], scale: 3 };
      case EnemyType.BOSS_OVERLORD:
        return { primaryColor: [0.3, 0.0, 0.3], emissiveColor: [0.4, 0.1, 0.5], scale: 4 };
      case EnemyType.BOSS:
        return { primaryColor: [0.5, 0.2, 0.2], emissiveColor: [0.3, 0.1, 0.1], scale: 2.5 };
      default:
        return { primaryColor: [0.8, 0.2, 0.2], emissiveColor: [0.2, 0.05, 0.05], scale: 1 };
    }
  }
  
  public update(dt: number): void {
    if (this.isDying) {
      this.deathTimer += dt;
      if (this.deathTimer >= 0.3) {
        this.destroy();
      }
      return;
    }
    
    this.ai.update(dt);
    
    const distance = this.getDistanceToPlayer();
    if (distance <= this.stats.attackRange) {
      this.tryAttack();
    }
  }
  
  private getDistanceToPlayer(): number {
    const playerPos = this.player.getPosition();
    const enemyPos = this.entity.getPosition();
    return playerPos.clone().sub(enemyPos).length();
  }
  
  private tryAttack(): void {
    const now = Date.now();
    if (now - this.lastAttackTime >= this.attackCooldown) {
      this.attack();
      this.lastAttackTime = now;
    }
  }
  
  protected attack(): void {
    this.player.takeDamage(this.damage);
  }
  
  public takeDamage(amount: number): void {
    const actualDamage = Math.max(1, amount - this.stats.armor * 0.5);
    this.health -= actualDamage;
    
    if (this.health <= 0) {
      this.health = 0;
      this.startDeath();
    }
  }
  
  public addStatusEffect(type: StatusEffect['type'], duration: number, intensity: number): void {
    this.ai.addStatusEffect(type, duration, intensity);
  }
  
  private startDeath(): void {
    this.isDying = true;
    this.entity.enabled = false;
    this.createDeathExplosion();
  }
  
  private createDeathExplosion(): void {
    const explosion = new pc.Entity('explosion');
    explosion.setPosition(this.entity.getPosition());
    
    const particleCount = this.type === EnemyType.BOSS ? 150 : 
                          this.type === EnemyType.TANK ? 80 : 50;
    
    explosion.addComponent('particlesystem', {
      lifetime: 0.8,
      rate: 0,
      burst: particleCount,
      speed: 8,
      spread: 360,
      colorGraph: {
        graph: new pc.CurveSet([
          [1, 0.8, 0.3],
          [1, 0.5, 0.1],
          [0.5, 0.2, 0],
          [0, 0, 0]
        ], 'color')
      },
      sizeGraph: {
        graph: new pc.Curve([0.5, 1.5, 2], 'size')
      }
    });
    
    this.engine.addToScene(explosion);
    explosion.particlesystem?.start();
    
    setTimeout(() => explosion.destroy(), 800);
  }
  
  public destroy(): void {
    this.entity.destroy();
  }
  
  public getHealth(): number {
    return this.health;
  }
  
  public getMaxHealth(): number {
    return this.maxHealth;
  }
  
  public getPosition(): pc.Vec3 {
    return this.entity.getPosition();
  }
  
  public getEntity(): pc.Entity {
    return this.entity;
  }
  
  public isAlive(): boolean {
    return this.health > 0 && !this.isDying;
  }
  
  public getType(): EnemyType {
    return this.type;
  }
  
  public getAIState(): AIState {
    return this.ai.getState();
  }
}