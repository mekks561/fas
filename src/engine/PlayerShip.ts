import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';

export interface PlayerConfig {
  engine: PlayCanvasGameEngine;
  initialPosition?: pc.Vec3;
  health?: number;
  shield?: number;
}

export interface PlayerControls {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  boost: boolean;
  fire: boolean;
}

export class PlayerShip {
  private engine: PlayCanvasGameEngine;
  private entity: pc.Entity;
  
  private health: number;
  private maxHealth: number;
  private shield: number;
  private maxShield: number;
  private shieldRechargeRate: number = 5;
  private shieldRechargeDelay: number = 3000;
  private lastDamageTime: number = 0;
  
  private speed: number = 0;
  private maxSpeed: number = 15;
  private acceleration: number = 8;
  private deceleration: number = 5;
  private boostMultiplier: number = 2.5;
  
  private rotationSpeed: number = 3;
  private rollSpeed: number = 5;
  
  private isInvulnerable: boolean = false;
  private invulnerabilityDuration: number = 1000;
  private invulnerabilityEndTime: number = 0;
  
  constructor(config: PlayerConfig) {
    this.engine = config.engine;
    this.health = config.health || 100;
    this.maxHealth = this.health;
    this.shield = config.shield || 50;
    this.maxShield = this.shield;
    
    this.entity = this.createPlayerShip(config.initialPosition || new pc.Vec3(0, 0, 0));
  }
  
  private createPlayerShip(position: pc.Vec3): pc.Entity {
    const app = this.engine.getApp();
    
    const shipMaterial = new pc.StandardMaterial();
    shipMaterial.diffuse.set(0.2, 0.5, 0.8);
    shipMaterial.specular.set(0.8, 0.8, 0.8);
    (shipMaterial as any).shininess = 80;
    shipMaterial.emissive.set(0.1, 0.2, 0.4);
    shipMaterial.update();
    
    const player = new pc.Entity('player');
    player.setPosition(position);
    
    const body = new pc.Entity('body');
    body.addComponent('model', { type: 'box' });
    body.model!.material = shipMaterial;
    body.setLocalScale(0.8, 0.4, 2);
    player.addChild(body);
    
    const cockpit = new pc.Entity('cockpit');
    cockpit.addComponent('model', { type: 'sphere' });
    const cockpitMaterial = new pc.StandardMaterial();
    cockpitMaterial.diffuse.set(0.1, 0.4, 0.7);
    cockpitMaterial.specular.set(0.9, 0.9, 0.9);
    (cockpitMaterial as any).shininess = 100;
    cockpitMaterial.transparency = 0.3;
    cockpitMaterial.update();
    cockpit.model!.material = cockpitMaterial;
    cockpit.setLocalPosition(0, 0.3, 0.5);
    cockpit.setLocalScale(0.3, 0.3, 0.3);
    player.addChild(cockpit);
    
    const wingLeft = new pc.Entity('wingLeft');
    wingLeft.addComponent('model', { type: 'box' });
    wingLeft.model!.material = shipMaterial;
    wingLeft.setLocalPosition(-0.8, -0.15, 0);
    wingLeft.setLocalScale(1.2, 0.08, 1.5);
    player.addChild(wingLeft);
    
    const wingRight = new pc.Entity('wingRight');
    wingRight.addComponent('model', { type: 'box' });
    wingRight.model!.material = shipMaterial;
    wingRight.setLocalPosition(0.8, -0.15, 0);
    wingRight.setLocalScale(1.2, 0.08, 1.5);
    player.addChild(wingRight);
    
    const leftWeapon = new pc.Entity('leftWeapon');
    leftWeapon.addComponent('model', { type: 'cylinder' });
    const weaponMaterial = new pc.StandardMaterial();
    weaponMaterial.diffuse.set(0.3, 0.3, 0.3);
    weaponMaterial.specular.set(0.6, 0.6, 0.6);
    weaponMaterial.update();
    leftWeapon.model!.material = weaponMaterial;
    leftWeapon.setLocalPosition(-0.6, 0, -0.8);
    leftWeapon.setLocalScale(0.08, 0.8, 0.08);
    leftWeapon.setLocalEulerAngles(90, 0, 0);
    player.addChild(leftWeapon);
    
    const rightWeapon = new pc.Entity('rightWeapon');
    rightWeapon.addComponent('model', { type: 'cylinder' });
    rightWeapon.model!.material = weaponMaterial;
    rightWeapon.setLocalPosition(0.6, 0, -0.8);
    rightWeapon.setLocalScale(0.08, 0.8, 0.08);
    rightWeapon.setLocalEulerAngles(90, 0, 0);
    player.addChild(rightWeapon);
    
    const engineNozzle = new pc.Entity('engineNozzle');
    engineNozzle.addComponent('model', { type: 'cylinder' });
    const engineMaterial = new pc.StandardMaterial();
    engineMaterial.diffuse.set(0.2, 0.2, 0.3);
    engineMaterial.emissive.set(0.3, 0.2, 0.1);
    engineMaterial.update();
    engineNozzle.model!.material = engineMaterial;
    engineNozzle.setLocalPosition(0, 0, -1.8);
    engineNozzle.setLocalScale(0.3, 0.25, 0.3);
    player.addChild(engineNozzle);
    
    this.engine.addToScene(player);
    console.log('[PlayerShip] Player entity added to scene');
    
    return player;
  }
  
  public update(dt: number, controls: PlayerControls): void {
    const now = Date.now();
    
    if (this.isInvulnerable && now > this.invulnerabilityEndTime) {
      this.isInvulnerable = false;
    }
    
    if (this.shield < this.maxShield && now - this.lastDamageTime > this.shieldRechargeDelay) {
      this.shield = Math.min(this.maxShield, this.shield + this.shieldRechargeRate * dt);
    }
    
    if (controls.up) {
      this.speed = Math.min(this.speed + this.acceleration * dt, this.maxSpeed);
    } else if (controls.down) {
      this.speed = Math.max(this.speed - this.acceleration * dt, -this.maxSpeed * 0.3);
    } else {
      if (this.speed > 0) {
        this.speed = Math.max(this.speed - this.deceleration * dt, 0);
      } else {
        this.speed = Math.min(this.speed + this.deceleration * dt, 0);
      }
    }
    
    const finalSpeed = controls.boost && this.speed > 0 
      ? this.speed * this.boostMultiplier 
      : this.speed;
    
    let currentRotation = this.entity.getEulerAngles();
    
    if (controls.left) {
      currentRotation.y -= this.rotationSpeed * 180 * dt;
    }
    if (controls.right) {
      currentRotation.y += this.rotationSpeed * 180 * dt;
    }
    
    if (controls.left && this.speed > 3) {
      currentRotation.x -= this.rollSpeed * 90 * dt;
    } else if (controls.right && this.speed > 3) {
      currentRotation.x += this.rollSpeed * 90 * dt;
    } else {
      currentRotation.x *= 0.9;
    }
    
    currentRotation.x = Math.max(-45, Math.min(45, currentRotation.x));
    
    this.entity.setEulerAngles(currentRotation.x, currentRotation.y, currentRotation.z);
    
    if (this.speed !== 0) {
      const forward = this.entity.forward.clone().scale(finalSpeed * dt);
      const currentPos = this.entity.getPosition();
      currentPos.add(forward);
      
      currentPos.x = Math.max(-25, Math.min(25, currentPos.x));
      currentPos.y = Math.max(-10, Math.min(10, currentPos.y));
      currentPos.z = Math.max(-25, Math.min(25, currentPos.z));
      
      this.entity.setPosition(currentPos);
    }
  }
  
  public takeDamage(amount: number): boolean {
    if (this.isInvulnerable) {
      return false;
    }
    
    this.lastDamageTime = Date.now();
    
    if (this.shield > 0) {
      const shieldDamage = Math.min(this.shield, amount);
      this.shield -= shieldDamage;
      amount -= shieldDamage;
    }
    
    if (amount > 0) {
      this.health -= amount;
    }
    
    this.isInvulnerable = true;
    this.invulnerabilityEndTime = Date.now() + this.invulnerabilityDuration;
    
    this.flashDamage();
    
    if (this.health <= 0) {
      this.health = 0;
      return true;
    }
    
    return false;
  }
  
  private flashDamage(): void {
    const flashInterval = 100;
    const flashCount = 5;
    let count = 0;
    
    const flash = () => {
      if (count >= flashCount) {
        this.entity.enabled = true;
        return;
      }
      
      this.entity.enabled = !this.entity.enabled;
      count++;
      setTimeout(flash, flashInterval);
    };
    
    flash();
  }
  
  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }
  
  public rechargeShield(amount: number): void {
    this.shield = Math.min(this.maxShield, this.shield + amount);
  }
  
  public getHealth(): number {
    return this.health;
  }
  
  public getMaxHealth(): number {
    return this.maxHealth;
  }
  
  public getShield(): number {
    return this.shield;
  }
  
  public getMaxShield(): number {
    return this.maxShield;
  }
  
  public getSpeed(): number {
    return this.speed;
  }
  
  public getPosition(): pc.Vec3 {
    return this.entity.getPosition();
  }
  
  public getEntity(): pc.Entity {
    return this.entity;
  }
  
  public getForward(): pc.Vec3 {
    return this.entity.forward.clone();
  }
  
  public isAlive(): boolean {
    return this.health > 0;
  }
  
  public isCurrentlyInvulnerable(): boolean {
      return this.isInvulnerable;
    }
  
  public setMaxHealth(maxHealth: number): void {
    this.maxHealth = maxHealth;
    this.health = Math.min(this.health, maxHealth);
  }
  
  public setMaxShield(maxShield: number): void {
    this.maxShield = maxShield;
    this.shield = Math.min(this.shield, maxShield);
  }
  
  public addShield(amount: number): void {
    this.shield = Math.min(this.maxShield, this.shield + amount);
  }
  
  public setInvincible(durationMs: number): void {
    this.isInvulnerable = true;
    this.invulnerabilityEndTime = Date.now() + durationMs;
  }
  
  public setSpeedMultiplier(multiplier: number): void {
    this.maxSpeed = 15 * multiplier;
  }
  
  public resetSpeed(): void {
    this.maxSpeed = 15;
  }
  
  public destroy(): void {
    this.entity.destroy();
  }
}