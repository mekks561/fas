/**
 * 增强版敌人系统
 * 扩展功能：更多敌人类型、智能AI行为、状态机系统
 */

import * as pc from 'playcanvas';
import { EnhancedPlayCanvasEngine } from './EnhancedPlayCanvasEngine';
import { EnhancedPlayerShip } from './EnhancedPlayerShip';

export enum EnemyType {
  SCOUT = 'scout',
  FIGHTER = 'fighter',
  TANK = 'tank',
  ELITE = 'elite',
  BOSS = 'boss',
  SNIPER = 'sniper',
  ASSASSIN = 'assassin',
  SUPPORT = 'support',
}

export enum AIState {
  IDLE,
  PATROL,
  CHASE,
  ATTACK,
  RETREAT,
  EVADE,
  FORMATION,
  SUPPORT,
}

export interface EnemyConfig {
  type: EnemyType;
  health: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  detectionRange: number;
  attackRange: number;
  rewardScore: number;
}

export interface WaveConfig {
  enemies: { type: EnemyType; count: number }[];
  spawnDelay: number;
  difficulty: number;
}

export class EnhancedEnemy {
  private engine: EnhancedPlayCanvasEngine;
  private entity: pc.Entity;
  private type: EnemyType;
  private config: EnemyConfig;
  private health: number;
  private player: EnhancedPlayerShip;
  private aiState: AIState = AIState.IDLE;
  private lastAttackTime: number = 0;
  private patrolPoint: pc.Vec3 | null = null;
  private stateTimer: number = 0;

  private targetPosition: pc.Vec3 = new pc.Vec3(0, 0, 0);
  private movementSpeed: number = 0;

  constructor(
    engine: EnhancedPlayCanvasEngine,
    type: EnemyType,
    position: pc.Vec3,
    player: EnhancedPlayerShip,
  ) {
    this.engine = engine;
    this.type = type;
    this.player = player;
    this.config = this.getConfigForType(type);
    this.health = this.config.health;

    this.entity = this.createEnemy(position);
    this.movementSpeed = this.config.speed;
  }

  private getConfigForType(type: EnemyType): EnemyConfig {
    switch (type) {
      case EnemyType.SCOUT:
        return {
          type: EnemyType.SCOUT,
          health: 20,
          speed: 8,
          damage: 10,
          attackCooldown: 2000,
          detectionRange: 30,
          attackRange: 5,
          rewardScore: 100,
        };
      case EnemyType.FIGHTER:
        return {
          type: EnemyType.FIGHTER,
          health: 40,
          speed: 5,
          damage: 15,
          attackCooldown: 1500,
          detectionRange: 25,
          attackRange: 4,
          rewardScore: 150,
        };
      case EnemyType.TANK:
        return {
          type: EnemyType.TANK,
          health: 150,
          speed: 2,
          damage: 25,
          attackCooldown: 3000,
          detectionRange: 20,
          attackRange: 3,
          rewardScore: 300,
        };
      case EnemyType.ELITE:
        return {
          type: EnemyType.ELITE,
          health: 80,
          speed: 6,
          damage: 20,
          attackCooldown: 1200,
          detectionRange: 35,
          attackRange: 6,
          rewardScore: 250,
        };
      case EnemyType.BOSS:
        return {
          type: EnemyType.BOSS,
          health: 500,
          speed: 3,
          damage: 40,
          attackCooldown: 2000,
          detectionRange: 40,
          attackRange: 8,
          rewardScore: 1000,
        };
      case EnemyType.SNIPER:
        return {
          type: EnemyType.SNIPER,
          health: 30,
          speed: 4,
          damage: 35,
          attackCooldown: 2500,
          detectionRange: 50,
          attackRange: 30,
          rewardScore: 200,
        };
      case EnemyType.ASSASSIN:
        return {
          type: EnemyType.ASSASSIN,
          health: 25,
          speed: 10,
          damage: 30,
          attackCooldown: 1800,
          detectionRange: 20,
          attackRange: 2,
          rewardScore: 180,
        };
      case EnemyType.SUPPORT:
        return {
          type: EnemyType.SUPPORT,
          health: 35,
          speed: 4,
          damage: 5,
          attackCooldown: 1000,
          detectionRange: 25,
          attackRange: 10,
          rewardScore: 120,
        };
      default:
        return {
          type: EnemyType.SCOUT,
          health: 30,
          speed: 5,
          damage: 12,
          attackCooldown: 2000,
          detectionRange: 25,
          attackRange: 4,
          rewardScore: 100,
        };
    }
  }

  private createEnemy(position: pc.Vec3): pc.Entity {
    const material = this.createEnemyMaterial();

    const enemy = new pc.Entity(`enemy_${this.type}_${Date.now()}`);
    enemy.setPosition(position);

    const body = new pc.Entity('enemyBody');
    body.addComponent('model', { type: this.getModelType() });
    if (body.model) body.model.material = material;
    body.setLocalScale(this.getScale());
    if (this.type === EnemyType.SCOUT) {
      body.setLocalEulerAngles(0, 0, 90);
    }
    enemy.addChild(body);

    const cockpit = new pc.Entity('enemyCockpit');
    cockpit.addComponent('model', { type: 'sphere' });
    const cockpitMaterial = new pc.StandardMaterial();
    cockpitMaterial.diffuse.set(0.6, 0.1, 0.1);
    cockpitMaterial.update();
    if (cockpit.model) cockpit.model.material = cockpitMaterial;
    cockpit.setLocalPosition(0, 0.3, 0);
    cockpit.setLocalScale(0.3, 0.3, 0.3);
    enemy.addChild(cockpit);

    enemy.addComponent('rigidbody', {
      type: 'dynamic',
      mass: 1,
      linearDamping: 0.2,
    });

    enemy.addComponent('collision', {
      type: 'cylinder',
      radius: 0.5,
      height: 1.5,
    });

    this.engine.addToScene(enemy);

    return enemy;
  }

  private createEnemyMaterial(): pc.StandardMaterial {
    const material = new pc.StandardMaterial();

    switch (this.type) {
      case EnemyType.SCOUT:
        material.diffuse.set(0.5, 0.5, 0.5);
        material.emissive.set(0.2, 0.2, 0.2);
        break;
      case EnemyType.FIGHTER:
        material.diffuse.set(0.8, 0.2, 0.2);
        material.emissive.set(0.3, 0.1, 0.1);
        break;
      case EnemyType.TANK:
        material.diffuse.set(0.4, 0.4, 0.4);
        material.emissive.set(0.1, 0.1, 0.1);
        material.roughness = 0.8;
        break;
      case EnemyType.ELITE:
        material.diffuse.set(0.6, 0.2, 0.8);
        material.emissive.set(0.3, 0.1, 0.4);
        break;
      case EnemyType.BOSS:
        material.diffuse.set(0.9, 0.1, 0.1);
        material.emissive.set(0.5, 0.1, 0.1);
        break;
      case EnemyType.SNIPER:
        material.diffuse.set(0.3, 0.3, 0.5);
        material.emissive.set(0.1, 0.1, 0.3);
        break;
      case EnemyType.ASSASSIN:
        material.diffuse.set(0.1, 0.1, 0.1);
        material.emissive.set(0.05, 0.05, 0.05);
        break;
      case EnemyType.SUPPORT:
        material.diffuse.set(0.2, 0.6, 0.2);
        material.emissive.set(0.1, 0.3, 0.1);
        break;
      default:
        material.diffuse.set(0.8, 0.2, 0.2);
    }

    material.update();
    return material;
  }

  private getModelType(): string {
    switch (this.type) {
      case EnemyType.SCOUT:
        return 'cylinder';
      case EnemyType.TANK:
        return 'box';
      case EnemyType.BOSS:
        return 'cylinder';
      default:
        return 'cylinder';
    }
  }

  private getScale(): pc.Vec3 {
    switch (this.type) {
      case EnemyType.SCOUT:
        return new pc.Vec3(0.4, 0.6, 0.4);
      case EnemyType.TANK:
        return new pc.Vec3(1.2, 0.8, 1.2);
      case EnemyType.BOSS:
        return new pc.Vec3(1.5, 1.2, 1.5);
      case EnemyType.ELITE:
        return new pc.Vec3(0.7, 0.9, 0.7);
      default:
        return new pc.Vec3(0.6, 0.8, 0.6);
    }
  }

  public update(dt: number): void {
    this.stateTimer += dt;

    this.updateAIState();
    this.executeAIState(dt);

    this.entity.lookAt(this.targetPosition);
  }

  private updateAIState(): void {
    const distance = this.getDistanceToPlayer();

    if (distance <= this.config.attackRange) {
      this.aiState = AIState.ATTACK;
    } else if (distance <= this.config.detectionRange) {
      this.aiState = AIState.CHASE;
    } else {
      if (this.stateTimer > 5 || !this.patrolPoint) {
        this.aiState = AIState.PATROL;
        this.generatePatrolPoint();
        this.stateTimer = 0;
      }
    }
  }

  private executeAIState(dt: number): void {
    switch (this.aiState) {
      case AIState.IDLE:
        this.targetPosition = this.entity.getPosition();
        break;

      case AIState.PATROL:
        if (this.patrolPoint) {
          this.moveToPosition(this.patrolPoint, dt);
          if (this.getDistanceToPoint(this.patrolPoint) < 2) {
            this.patrolPoint = null;
          }
        }
        break;

      case AIState.CHASE:
        const playerPos = this.player.getPosition();

        if (this.type === EnemyType.SNIPER) {
          this.targetPosition = playerPos.clone();
          if (this.entity.rigidbody) this.entity.rigidbody.linearVelocity = new pc.Vec3(0, 0, 0);
        } else {
          this.moveToPosition(playerPos, dt);
        }
        break;

      case AIState.ATTACK:
        this.targetPosition = this.player.getPosition();
        this.attack();
        break;

      case AIState.EVADE:
        const awayDir = this.entity
          .getPosition()
          .clone()
          .sub(this.player.getPosition())
          .normalize();
        this.moveToPosition(this.entity.getPosition().clone().add(awayDir.scale(10)), dt);
        break;

      case AIState.RETREAT:
        const retreatDir = this.entity
          .getPosition()
          .clone()
          .sub(this.player.getPosition())
          .normalize();
        this.moveToPosition(this.entity.getPosition().clone().add(retreatDir.scale(20)), dt);
        break;
    }
  }

  private generatePatrolPoint(): void {
    const currentPos = this.entity.getPosition();
    const angle = Math.random() * Math.PI * 2;
    const distance = 5 + Math.random() * 10;

    this.patrolPoint = new pc.Vec3(
      currentPos.x + Math.cos(angle) * distance,
      currentPos.y,
      currentPos.z + Math.sin(angle) * distance,
    );
  }

  private moveToPosition(target: pc.Vec3, dt: number): void {
    const currentPos = this.entity.getPosition();
    const direction = target.clone().sub(currentPos).normalize();

    this.entity.rigidbody?.applyForce(direction.scale(this.movementSpeed * dt * 50));
    this.targetPosition = target;
  }

  private getDistanceToPlayer(): number {
    const playerPos = this.player.getPosition();
    const enemyPos = this.entity.getPosition();
    return playerPos.clone().sub(enemyPos).length();
  }

  private getDistanceToPoint(point: pc.Vec3): number {
    const enemyPos = this.entity.getPosition();
    return point.clone().sub(enemyPos).length();
  }

  private attack(): void {
    const now = Date.now();
    if (now - this.lastAttackTime >= this.config.attackCooldown) {
      this.player.takeDamage(this.config.damage);
      this.lastAttackTime = now;

      if (this.type === EnemyType.SNIPER) {
        this.spawnProjectile();
      }
    }
  }

  private spawnProjectile(): void {
    const playerPos = this.player.getPosition();
    const enemyPos = this.entity.getPosition();

    const projectile = new pc.Entity(`enemy_projectile_${Date.now()}`);
    projectile.setPosition(enemyPos.clone());

    const material = new pc.StandardMaterial();
    material.diffuse.set(1, 0.2, 0.2);
    material.emissive.set(1, 0.2, 0.2);
    material.update();

    projectile.addComponent('model', { type: 'sphere' });
    if (projectile.model) projectile.model.material = material;
    projectile.setLocalScale(0.15, 0.15, 0.15);

    projectile.addComponent('rigidbody', {
      type: 'dynamic',
      mass: 0.1,
    });

    projectile.addComponent('collision', {
      type: 'sphere',
      radius: 0.15,
    });

    this.engine.addToScene(projectile);

    const direction = playerPos.clone().sub(enemyPos).normalize();
    if (projectile.rigidbody) projectile.rigidbody.linearVelocity = direction.scale(25);
  }

  public takeDamage(amount: number): void {
    this.health -= amount;

    if (this.health <= this.config.health * 0.3 && this.type !== EnemyType.BOSS) {
      this.aiState = AIState.RETREAT;
    }

    if (this.health <= 0) {
      this.destroy();
    }
  }

  public destroy(): void {
    this.entity.destroy();
  }

  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    return this.config.health;
  }

  public getPosition(): pc.Vec3 {
    return this.entity.getPosition();
  }

  public getEntity(): pc.Entity {
    return this.entity;
  }

  public isAlive(): boolean {
    return this.health > 0;
  }

  public getType(): EnemyType {
    return this.type;
  }

  public getRewardScore(): number {
    return this.config.rewardScore;
  }

  public getAIState(): AIState {
    return this.aiState;
  }
}
