import * as pc from 'playcanvas';
import { PlayerShip } from './PlayerShip';
import { EnemyType } from './Enemy';

export enum AIState {
  IDLE = 'idle',
  PATROL = 'patrol',
  CHASE = 'chase',
  ATTACK = 'attack',
  RETREAT = 'retreat',
  EVADE = 'evade',
  STUNNED = 'stunned',
  DEAD = 'dead'
}

export interface AIConfig {
  state: AIState;
  targetPosition?: pc.Vec3;
  patrolRadius: number;
  chaseRadius: number;
  attackRadius: number;
  retreatRadius: number;
  strafeDirection: number;
  strafeTimer: number;
}

export interface StatusEffect {
  type: 'burn' | 'freeze' | 'stun' | 'slow' | 'poison';
  duration: number;
  remainingTime: number;
  intensity: number;
  lastTick: number;
}

export abstract class EnemyAI {
  protected entity: pc.Entity;
  protected player: PlayerShip;
  protected aiConfig: AIConfig;
  protected statusEffects: StatusEffect[] = [];
  protected lastUpdateTime: number = 0;
  protected patrolCenter: pc.Vec3;
  
  constructor(entity: pc.Entity, player: PlayerShip, initialPosition: pc.Vec3) {
    this.entity = entity;
    this.player = player;
    this.patrolCenter = initialPosition.clone();
    
    this.aiConfig = {
      state: AIState.PATROL,
      patrolRadius: 10,
      chaseRadius: 25,
      attackRadius: 3,
      retreatRadius: 5,
      strafeDirection: 1,
      strafeTimer: 0
    };
  }
  
  public update(dt: number): void {
    this.lastUpdateTime += dt;
    
    this.updateStatusEffects(dt);
    
    if (this.isStunned()) {
      return;
    }
    
    this.executeBehavior(dt);
  }
  
  protected abstract executeBehavior(dt: number): void;
  
  protected updateStatusEffects(dt: number): void {
    const _now = Date.now();
    
    this.statusEffects = this.statusEffects.filter(effect => {
      effect.remainingTime -= dt * 1000;
      
      if (effect.remainingTime <= 0) {
        return false;
      }
      
      return true;
    });
  }
  
  protected isStunned(): boolean {
    return this.statusEffects.some(e => e.type === 'stun' && e.remainingTime > 0);
  }
  
  protected getSpeedMultiplier(): number {
    let multiplier = 1;
    
    this.statusEffects.forEach(effect => {
      if (effect.type === 'slow' && effect.remainingTime > 0) {
        multiplier *= (1 - effect.intensity);
      }
      if (effect.type === 'freeze' && effect.remainingTime > 0) {
        multiplier *= 0.1;
      }
    });
    
    return multiplier;
  }
  
  protected applyStatusEffectToSelf(effect: StatusEffect): void {
    const existingIndex = this.statusEffects.findIndex(e => e.type === effect.type);
    
    if (existingIndex >= 0) {
      this.statusEffects[existingIndex].remainingTime = effect.duration;
      this.statusEffects[existingIndex].intensity = effect.intensity;
    } else {
      this.statusEffects.push({ ...effect, lastTick: Date.now() });
    }
  }
  
  public addStatusEffect(type: StatusEffect['type'], duration: number, intensity: number): void {
    this.applyStatusEffectToSelf({
      type,
      duration,
      remainingTime: duration,
      intensity,
      lastTick: Date.now()
    });
  }
  
  public getStatusEffects(): StatusEffect[] {
    return [...this.statusEffects];
  }
  
  public clearStatusEffects(): void {
    this.statusEffects = [];
  }
  
  public getDistanceToPlayer(): number {
    const playerPos = this.player.getPosition();
    const enemyPos = this.entity.getPosition();
    return playerPos.clone().sub(enemyPos).length();
  }
  
  protected getDirectionToPlayer(): pc.Vec3 {
    const playerPos = this.player.getPosition();
    const enemyPos = this.entity.getPosition();
    return playerPos.clone().sub(enemyPos).normalize();
  }
  
  protected getDirectionToPatrolCenter(): pc.Vec3 {
    const enemyPos = this.entity.getPosition();
    return this.patrolCenter.clone().sub(enemyPos).normalize();
  }
  
  protected moveTowards(direction: pc.Vec3, speed: number, dt: number): void {
    const currentPos = this.entity.getPosition();
    const movement = direction.normalize().scale(speed * dt);
    currentPos.add(movement);
    
    currentPos.x = Math.max(-30, Math.min(30, currentPos.x));
    currentPos.y = Math.max(-15, Math.min(15, currentPos.y));
    currentPos.z = Math.max(-30, Math.min(30, currentPos.z));
    
    this.entity.setPosition(currentPos);
  }
  
  public abstract getState(): AIState;
}

export class ScoutAI extends EnemyAI {
  private zigzagTimer: number = 0;
  private zigzagAmplitude: number = 3;
  
  constructor(entity: pc.Entity, player: PlayerShip, initialPosition: pc.Vec3) {
    super(entity, player, initialPosition);
    this.aiConfig.patrolRadius = 8;
    this.aiConfig.chaseRadius = 30;
    this.aiConfig.attackRadius = 2;
  }
  
  protected executeBehavior(dt: number): void {
    const distance = this.getDistanceToPlayer();
    const direction = this.getDirectionToPlayer();
    
    if (distance > this.aiConfig.chaseRadius) {
      this.aiConfig.state = AIState.PATROL;
      this.executePatrol(dt);
    } else if (distance <= this.aiConfig.attackRadius) {
      this.aiConfig.state = AIState.ATTACK;
      this.executeAttack(dt);
    } else {
      this.aiConfig.state = AIState.CHASE;
      this.executeChase(dt);
    }
  }
  
  private executePatrol(dt: number): void {
    this.zigzagTimer += dt;
    
    const centerDir = this.getDirectionToPatrolCenter();
    const perpendicular = new pc.Vec3(-centerDir.z, 0, centerDir.x);
    
    const zigzagOffset = Math.sin(this.zigzagTimer * 2) * this.zigzagAmplitude;
    const movement = centerDir.clone().add(perpendicular.clone().scale(zigzagOffset));
    
    const speed = 3 * this.getSpeedMultiplier();
    this.moveTowards(movement, speed, dt);
    
    this.entity.lookAt(this.entity.getPosition().clone().add(movement));
  }
  
  private executeChase(dt: number): void {
    this.zigzagTimer += dt;
    
    const direction = this.getDirectionToPlayer();
    const perpendicular = new pc.Vec3(-direction.z, 0, direction.x);
    const zigzagOffset = Math.sin(this.zigzagTimer * 4) * this.zigzagAmplitude;
    
    const movement = direction.clone().add(perpendicular.clone().scale(zigzagOffset * 0.5));
    
    const speed = 8 * this.getSpeedMultiplier();
    this.moveTowards(movement, speed, dt);
    
    this.entity.lookAt(this.player.getPosition());
  }
  
  private executeAttack(dt: number): void {
    const direction = this.getDirectionToPlayer();
    const backward = direction.clone().scale(-1);
    
    this.moveTowards(backward, 5, dt);
    this.entity.lookAt(this.player.getPosition());
  }
  
  public getState(): AIState {
    return this.aiConfig.state;
  }
}

export class FighterAI extends EnemyAI {
  private strafeTimer: number = 0;
  private strafeDuration: number = 2;
  
  constructor(entity: pc.Entity, player: PlayerShip, initialPosition: pc.Vec3) {
    super(entity, player, initialPosition);
    this.aiConfig.patrolRadius = 12;
    this.aiConfig.chaseRadius = 20;
    this.aiConfig.attackRadius = 4;
    this.aiConfig.retreatRadius = 2;
  }
  
  protected executeBehavior(dt: number): void {
    const distance = this.getDistanceToPlayer();
    
    if (distance > this.aiConfig.chaseRadius) {
      this.aiConfig.state = AIState.PATROL;
      this.executePatrol(dt);
    } else if (distance <= this.aiConfig.attackRadius) {
      this.aiConfig.state = AIState.ATTACK;
      this.executeAttack(dt);
    } else {
      this.aiConfig.state = AIState.CHASE;
      this.executeChase(dt);
    }
  }
  
  private executePatrol(dt: number): void {
    const centerDir = this.getDirectionToPatrolCenter();
    const speed = 2 * this.getSpeedMultiplier();
    
    this.moveTowards(centerDir, speed, dt);
    
    const lookTarget = this.entity.getPosition().clone().add(centerDir);
    this.entity.lookAt(lookTarget);
  }
  
  private executeChase(dt: number): void {
    this.strafeTimer += dt;
    
    if (this.strafeTimer >= this.strafeDuration) {
      this.strafeTimer = 0;
      this.aiConfig.strafeDirection *= -1;
    }
    
    const direction = this.getDirectionToPlayer();
    const perpendicular = new pc.Vec3(-direction.z, 0, direction.x);
    
    const movement = direction.clone().scale(0.6)
      .add(perpendicular.clone().scale(this.aiConfig.strafeDirection * 0.4));
    
    const speed = 5 * this.getSpeedMultiplier();
    this.moveTowards(movement, speed, dt);
    
    this.entity.lookAt(this.player.getPosition());
  }
  
  private executeAttack(dt: number): void {
    const direction = this.getDirectionToPlayer();
    
    if (this.getDistanceToPlayer() < this.aiConfig.retreatRadius) {
      const retreat = direction.clone().scale(-1);
      this.moveTowards(retreat, 3, dt);
    }
    
    this.entity.lookAt(this.player.getPosition());
  }
  
  public getState(): AIState {
    return this.aiConfig.state;
  }
}

export class TankAI extends EnemyAI {
  private chargeTimer: number = 0;
  private isCharging: boolean = false;
  
  constructor(entity: pc.Entity, player: PlayerShip, initialPosition: pc.Vec3) {
    super(entity, player, initialPosition);
    this.aiConfig.patrolRadius = 5;
    this.aiConfig.chaseRadius = 15;
    this.aiConfig.attackRadius = 5;
  }
  
  protected executeBehavior(dt: number): void {
    const distance = this.getDistanceToPlayer();
    
    if (distance > this.aiConfig.chaseRadius) {
      this.aiConfig.state = AIState.PATROL;
      this.executePatrol(dt);
    } else if (this.isCharging) {
      this.executeCharge(dt);
    } else if (distance <= this.aiConfig.attackRadius) {
      this.aiConfig.state = AIState.ATTACK;
      this.executeAttack(dt);
    } else {
      this.aiConfig.state = AIState.CHASE;
      this.executeChase(dt);
    }
  }
  
  private executePatrol(dt: number): void {
    const centerDir = this.getDirectionToPatrolCenter();
    const speed = 1 * this.getSpeedMultiplier();
    
    this.moveTowards(centerDir, speed, dt);
    this.entity.lookAt(this.entity.getPosition().clone().add(centerDir));
  }
  
  private executeChase(dt: number): void {
    this.chargeTimer += dt;
    
    if (this.chargeTimer >= 3) {
      this.isCharging = true;
      this.chargeTimer = 0;
    }
    
    const direction = this.getDirectionToPlayer();
    const speed = 2 * this.getSpeedMultiplier();
    
    this.moveTowards(direction, speed, dt);
    this.entity.lookAt(this.player.getPosition());
  }
  
  private executeCharge(dt: number): void {
    const direction = this.getDirectionToPlayer();
    const speed = 10 * this.getSpeedMultiplier();
    
    this.moveTowards(direction, speed, dt);
    this.entity.lookAt(this.player.getPosition());
    
    this.chargeTimer += dt;
    if (this.chargeTimer >= 1) {
      this.isCharging = false;
      this.chargeTimer = 0;
    }
  }
  
  private executeAttack(dt: number): void {
    this.entity.lookAt(this.player.getPosition());
    
    if (this.getDistanceToPlayer() < 3) {
      const direction = this.getDirectionToPlayer().clone().scale(-1);
      this.moveTowards(direction, 2, dt);
    }
  }
  
  public getState(): AIState {
    return this.aiConfig.state;
  }
}

export class EliteAI extends EnemyAI {
  private teleportCooldown: number = 0;
  private lastTeleportTime: number = 0;
  
  constructor(entity: pc.Entity, player: PlayerShip, initialPosition: pc.Vec3) {
    super(entity, player, initialPosition);
    this.aiConfig.patrolRadius = 15;
    this.aiConfig.chaseRadius = 25;
    this.aiConfig.attackRadius = 8;
  }
  
  protected executeBehavior(dt: number): void {
    const _now = Date.now();
    const distance = this.getDistanceToPlayer();
    
    if (distance > this.aiConfig.chaseRadius) {
      this.aiConfig.state = AIState.PATROL;
      this.executePatrol(dt);
    } else if (distance <= this.aiConfig.attackRadius) {
      this.aiConfig.state = AIState.ATTACK;
      this.executeAttack(dt);
    } else {
      this.aiConfig.state = AIState.CHASE;
      this.executeChase(dt);
    }
  }
  
  private executePatrol(dt: number): void {
    const centerDir = this.getDirectionToPatrolCenter();
    const speed = 3 * this.getSpeedMultiplier();
    
    this.moveTowards(centerDir, speed, dt);
    this.entity.lookAt(this.entity.getPosition().clone().add(centerDir));
  }
  
  private executeChase(dt: number): void {
    const direction = this.getDirectionToPlayer();
    const speed = 6 * this.getSpeedMultiplier();
    
    this.moveTowards(direction, speed, dt);
    this.entity.lookAt(this.player.getPosition());
  }
  
  private executeAttack(dt: number): void {
    const direction = this.getDirectionToPlayer();
    const perpendicular = new pc.Vec3(-direction.z, 0, direction.x);
    
    this.aiConfig.strafeTimer += dt;
    if (this.aiConfig.strafeTimer >= 1.5) {
      this.aiConfig.strafeTimer = 0;
      this.aiConfig.strafeDirection *= -1;
    }
    
    const strafeDir = perpendicular.clone().scale(this.aiConfig.strafeDirection);
    const movement = direction.clone().scale(0.3).add(strafeDir.scale(0.7));
    
    const speed = 4 * this.getSpeedMultiplier();
    this.moveTowards(movement, speed, dt);
    this.entity.lookAt(this.player.getPosition());
  }
  
  public getState(): AIState {
    return this.aiConfig.state;
  }
}

export class BossAI extends EnemyAI {
  private phase: number = 1;
  private attackPattern: number = 0;
  private patternTimer: number = 0;
  private isEnraged: boolean = false;
  
  constructor(entity: pc.Entity, player: PlayerShip, initialPosition: pc.Vec3) {
    super(entity, player, initialPosition);
    this.aiConfig.patrolRadius = 20;
    this.aiConfig.chaseRadius = 30;
    this.aiConfig.attackRadius = 6;
  }
  
  protected executeBehavior(dt: number): void {
    const distance = this.getDistanceToPlayer();
    
    if (distance > this.aiConfig.chaseRadius) {
      this.aiConfig.state = AIState.PATROL;
      this.executePatrol(dt);
    } else if (distance <= this.aiConfig.attackRadius) {
      this.aiConfig.state = AIState.ATTACK;
      this.executeAttack(dt);
    } else {
      this.aiConfig.state = AIState.CHASE;
      this.executeChase(dt);
    }
  }
  
  private executePatrol(dt: number): void {
    const centerDir = this.getDirectionToPatrolCenter();
    const speed = 2 * this.getSpeedMultiplier();
    
    this.moveTowards(centerDir, speed, dt);
    this.entity.lookAt(this.entity.getPosition().clone().add(centerDir));
  }
  
  private executeChase(dt: number): void {
    this.patternTimer += dt;
    
    if (this.patternTimer >= 3) {
      this.patternTimer = 0;
      this.attackPattern = (this.attackPattern + 1) % 3;
    }
    
    const direction = this.getDirectionToPlayer();
    
    switch (this.attackPattern) {
      case 0:
        this.executeChargeAttack(dt, direction);
        break;
      case 1:
        this.executeCircleAttack(dt, direction);
        break;
      case 2:
        this.executeFlankAttack(dt, direction);
        break;
    }
    
    this.entity.lookAt(this.player.getPosition());
  }
  
  private executeChargeAttack(dt: number, direction: pc.Vec3): void {
    const speed = this.isEnraged ? 8 : 5;
    
    this.moveTowards(direction, speed, dt);
  }
  
  private executeCircleAttack(dt: number, direction: pc.Vec3): void {
    const perpendicular = new pc.Vec3(-direction.z, 0, direction.x);
    
    this.aiConfig.strafeTimer += dt * 0.5;
    const strafeAmount = Math.sin(this.aiConfig.strafeTimer) * 0.7;
    
    const movement = direction.clone().scale(0.3).add(
      perpendicular.clone().scale(strafeAmount)
    );
    
    const speed = this.isEnraged ? 6 : 4;
    this.moveTowards(movement, speed, dt);
  }
  
  private executeFlankAttack(dt: number, direction: pc.Vec3): void {
    const perpendicular = new pc.Vec3(-direction.z, 0, direction.x);
    
    const flankDir = this.aiConfig.strafeDirection > 0 ? perpendicular : perpendicular.clone().scale(-1);
    
    const movement = flankDir.clone().scale(0.8).add(direction.clone().scale(0.2));
    
    const speed = this.isEnraged ? 7 : 5;
    this.moveTowards(movement, speed, dt);
    
    if (this.aiConfig.strafeTimer >= 2) {
      this.aiConfig.strafeDirection *= -1;
      this.aiConfig.strafeTimer = 0;
    }
  }
  
  private executeAttack(dt: number): void {
    const direction = this.getDirectionToPlayer();
    const backward = direction.clone().scale(-1);
    
    this.moveTowards(backward, 3, dt);
    this.entity.lookAt(this.player.getPosition());
  }
  
  public getState(): AIState {
    return this.aiConfig.state;
  }
  
  public getPhase(): number {
    return this.phase;
  }
  
  public isEnragedBoss(): boolean {
    return this.isEnraged;
  }
}

export class EnemyAIFactory {
  public static createAI(
    type: EnemyType,
    entity: pc.Entity,
    player: PlayerShip,
    initialPosition: pc.Vec3
  ): EnemyAI {
    switch (type) {
      case EnemyType.SCOUT:
        return new ScoutAI(entity, player, initialPosition);
      case EnemyType.FIGHTER:
        return new FighterAI(entity, player, initialPosition);
      case EnemyType.TANK:
        return new TankAI(entity, player, initialPosition);
      case EnemyType.ELITE:
        return new EliteAI(entity, player, initialPosition);
      case EnemyType.BOSS:
        return new BossAI(entity, player, initialPosition);
      default:
        return new FighterAI(entity, player, initialPosition);
    }
  }
}