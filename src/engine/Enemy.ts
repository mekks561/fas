import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { EnemyAI, EnemyAIFactory, AIState, StatusEffect } from './EnemyAI';

export enum EnemyType {
  SCOUT = 'scout',
  FIGHTER = 'fighter',
  TANK = 'tank',
  ELITE = 'elite',
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
    
    this.entity = this.createEnemy(config.position);
    this.ai = EnemyAIFactory.createAI(config.type, this.entity, config.player, config.position);
  }
  
  private getStatsForType(type: EnemyType): EnemyStats {
    switch (type) {
      case EnemyType.SCOUT:
        return { health: 20, maxHealth: 20, speed: 8, damage: 10, attackCooldown: 2000, attackRange: 2, armor: 0 };
      case EnemyType.FIGHTER:
        return { health: 40, maxHealth: 40, speed: 5, damage: 15, attackCooldown: 1500, attackRange: 3, armor: 5 };
      case EnemyType.TANK:
        return { health: 100, maxHealth: 100, speed: 2, damage: 25, attackCooldown: 3000, attackRange: 4, armor: 20 };
      case EnemyType.ELITE:
        return { health: 60, maxHealth: 60, speed: 6, damage: 20, attackCooldown: 1200, attackRange: 5, armor: 10 };
      case EnemyType.BOSS:
        return { health: 300, maxHealth: 300, speed: 3, damage: 40, attackCooldown: 2000, attackRange: 6, armor: 30 };
      default:
        return { health: 30, maxHealth: 30, speed: 5, damage: 12, attackCooldown: 2000, attackRange: 3, armor: 5 };
    }
  }
  
  private createEnemy(position: pc.Vec3): pc.Entity {
    const material = this.createEnemyMaterial();
    
    const enemy = new pc.Entity('enemy');
    enemy.setPosition(position);
    
    switch (this.type) {
      case EnemyType.SCOUT:
        this.createScoutModel(enemy, material);
        break;
      case EnemyType.FIGHTER:
        this.createFighterModel(enemy, material);
        break;
      case EnemyType.TANK:
        this.createTankModel(enemy, material);
        break;
      case EnemyType.ELITE:
        this.createEliteModel(enemy, material);
        break;
      case EnemyType.BOSS:
        this.createBossModel(enemy, material);
        break;
      default:
        this.createFighterModel(enemy, material);
    }
    
    this.engine.addToScene(enemy);
    
    return enemy;
  }
  
  private createEnemyMaterial(): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    
    switch (this.type) {
      case EnemyType.SCOUT:
        material.diffuse.set(0.4, 0.8, 0.4);
        material.emissive.set(0.1, 0.3, 0.1);
        break;
      case EnemyType.FIGHTER:
        material.diffuse.set(0.8, 0.5, 0.2);
        material.emissive.set(0.2, 0.1, 0);
        break;
      case EnemyType.TANK:
        material.diffuse.set(0.5, 0.5, 0.5);
        material.emissive.set(0.1, 0.1, 0.1);
        break;
      case EnemyType.ELITE:
        material.diffuse.set(0.6, 0.3, 1.0);
        material.emissive.set(0.3, 0.1, 0.5);
        break;
      case EnemyType.BOSS:
        material.diffuse.set(1.0, 0.2, 0.2);
        material.emissive.set(0.5, 0.1, 0.1);
        break;
      default:
        material.diffuse.set(0.8, 0.2, 0.2);
    }
    
    material.specular.set(0.5, 0.5, 0.5);
    (material as any).shininess = 30;
    material.update();
    
    return material;
  }
  
  private createScoutModel(enemy: pc.Entity, material: pc.StandardMaterial): void {
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'cone' });
    body.model!.material = material;
    body.setLocalScale(0.5, 1, 0.5);
    body.setLocalEulerAngles(90, 0, 0);
    enemy.addChild(body);
  }
  
  private createFighterModel(enemy: pc.Entity, material: pc.StandardMaterial): void {
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'cylinder' });
    body.model!.material = material;
    body.setLocalScale(0.6, 0.8, 0.6);
    body.setLocalEulerAngles(90, 0, 0);
    enemy.addChild(body);
    
    const cockpit = new pc.Entity('cockpit');
    cockpit.addComponent('model', { type: 'sphere' });
    const cockpitMaterial = new pc.StandardMaterial();
    cockpitMaterial.diffuse.set(0.3, 0.1, 0.1);
    cockpitMaterial.update();
    cockpit.model!.material = cockpitMaterial;
    cockpit.setLocalPosition(0, 0.3, 0);
    cockpit.setLocalScale(0.3, 0.3, 0.3);
    enemy.addChild(cockpit);
  }
  
  private createTankModel(enemy: pc.Entity, material: pc.StandardMaterial): void {
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'box' });
    body.model!.material = material;
    body.setLocalScale(1.2, 0.6, 1.2);
    enemy.addChild(body);
    
    const turret = new pc.Entity('turret');
    turret.addComponent('model', { type: 'cylinder' });
    turret.model!.material = material;
    turret.setLocalPosition(0, 0.5, 0);
    turret.setLocalScale(0.5, 0.4, 0.5);
    turret.setLocalEulerAngles(90, 0, 0);
    enemy.addChild(turret);
  }
  
  private createEliteModel(enemy: pc.Entity, material: pc.StandardMaterial): void {
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'diamond' });
    body.model!.material = material;
    body.setLocalScale(0.8, 1, 0.8);
    enemy.addChild(body);
  }
  
  private createBossModel(enemy: pc.Entity, material: pc.StandardMaterial): void {
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'box' });
    body.model!.material = material;
    body.setLocalScale(2, 1, 2);
    enemy.addChild(body);
    
    const core = new pc.Entity('core');
    core.addComponent('model', { type: 'sphere' });
    const coreMaterial = new pc.StandardMaterial();
    coreMaterial.diffuse.set(1, 0.5, 0);
    coreMaterial.emissive.set(1, 0.5, 0);
    coreMaterial.update();
    core.model!.material = coreMaterial;
    core.setLocalPosition(0, 0, 0);
    core.setLocalScale(0.6, 0.6, 0.6);
    enemy.addChild(core);
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