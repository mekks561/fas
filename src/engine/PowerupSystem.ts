import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';

export enum PowerupType {
  HEALTH = 'health',
  SHIELD = 'shield',
  WEAPON_UPGRADE = 'weaponUpgrade',
  SPEED_BOOST = 'speedBoost',
  SCORE_BONUS = 'scoreBonus',
  INVINCIBILITY = 'invincibility',
  MISSILE = 'missile',
  LASER = 'laser'
}

export interface PowerupConfig {
  type: PowerupType;
  position: pc.Vec3;
  value: number;
  duration: number;
}

export class Powerup {
  private entity: pc.Entity;
  private type: PowerupType;
  private value: number;
  private duration: number;
  private engine: PlayCanvasGameEngine;
  private isCollected: boolean = false;
  private respawnTime: number = 0;
  private isVisible: boolean = true;
  
  constructor(
    engine: PlayCanvasGameEngine,
    type: PowerupType,
    position: pc.Vec3,
    value: number = 1,
    duration: number = 0
  ) {
    this.engine = engine;
    this.type = type;
    this.value = value;
    this.duration = duration;
    
    this.entity = this.createPowerup(position);
  }
  
  private createPowerup(position: pc.Vec3): pc.Entity {
    const entity = new pc.Entity(`powerup_${this.type}`);
    entity.setPosition(position);
    
    const material = this.createMaterial();
    entity.addComponent('model', { type: 'sphere' });
    entity.model!.material = material;
    
    const outerGlow = new pc.Entity('outerGlow');
    outerGlow.addComponent('model', { type: 'sphere' });
    const glowMaterial = this.createGlowMaterial();
    outerGlow.model!.material = glowMaterial;
    outerGlow.setLocalScale(1.5, 1.5, 1.5);
    entity.addChild(outerGlow);
    
    const ring = new pc.Entity('ring');
    ring.addComponent('model', { type: 'torus' });
    ring.model!.material = glowMaterial;
    ring.setLocalScale(2, 2, 0.2);
    ring.setLocalEulerAngles(90, 0, 0);
    entity.addChild(ring);
    
    this.engine.addToScene(entity);
    
    return entity;
  }
  
  private createMaterial(): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    
    switch (this.type) {
      case PowerupType.HEALTH:
        material.diffuse.set(1, 0.2, 0.2);
        material.emissive.set(0.8, 0.1, 0.1);
        break;
      case PowerupType.SHIELD:
        material.diffuse.set(0.2, 0.5, 1);
        material.emissive.set(0.1, 0.3, 0.8);
        break;
      case PowerupType.WEAPON_UPGRADE:
        material.diffuse.set(1, 0.8, 0.2);
        material.emissive.set(0.8, 0.5, 0.1);
        break;
      case PowerupType.SPEED_BOOST:
        material.diffuse.set(0.2, 1, 0.2);
        material.emissive.set(0.1, 0.8, 0.1);
        break;
      case PowerupType.SCORE_BONUS:
        material.diffuse.set(1, 1, 0.2);
        material.emissive.set(0.8, 0.8, 0.1);
        break;
      case PowerupType.INVINCIBILITY:
        material.diffuse.set(1, 1, 1);
        material.emissive.set(0.9, 0.9, 0.9);
        break;
      case PowerupType.MISSILE:
        material.diffuse.set(1, 0.3, 0.5);
        material.emissive.set(0.8, 0.2, 0.3);
        break;
      case PowerupType.LASER:
        material.diffuse.set(0.3, 0.5, 1);
        material.emissive.set(0.2, 0.3, 0.8);
        break;
      default:
        material.diffuse.set(1, 1, 1);
    }
    
    material.specular.set(1, 1, 1);
    material.shininess = 100;
    material.update();
    
    return material;
  }
  
  private createGlowMaterial(): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    
    switch (this.type) {
      case PowerupType.HEALTH:
        material.emissive.set(1, 0.2, 0.2);
        break;
      case PowerupType.SHIELD:
        material.emissive.set(0.2, 0.5, 1);
        break;
      case PowerupType.WEAPON_UPGRADE:
        material.emissive.set(1, 0.8, 0.2);
        break;
      case PowerupType.SPEED_BOOST:
        material.emissive.set(0.2, 1, 0.2);
        break;
      case PowerupType.SCORE_BONUS:
        material.emissive.set(1, 1, 0.2);
        break;
      case PowerupType.INVINCIBILITY:
        material.emissive.set(1, 1, 1);
        break;
      case PowerupType.MISSILE:
        material.emissive.set(1, 0.3, 0.5);
        break;
      case PowerupType.LASER:
        material.emissive.set(0.3, 0.5, 1);
        break;
      default:
        material.emissive.set(1, 1, 1);
    }
    
    material.opacity = 0.3;
    material.blendType = pc.BLEND_ADDITIVEALPHA;
    material.update();
    
    return material;
  }
  
  public update(dt: number): void {
    if (!this.isVisible) {
      this.respawnTime -= dt;
      if (this.respawnTime <= 0) {
        this.respawn();
      }
      return;
    }
    
    const rotation = this.entity.getEulerAngles();
    this.entity.setEulerAngles(rotation.x, rotation.y + 60 * dt, rotation.z);
    
    const scale = this.entity.getLocalScale();
    const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.1;
    this.entity.setLocalScale(scale.x * pulse * 0.1 + scale.x * (1 - 0.1), scale.y, scale.z);
  }
  
  public checkCollection(player: PlayerShip): boolean {
    if (this.isCollected || !this.isVisible) return false;
    
    const playerPos = player.getPosition();
    const powerupPos = this.entity.getPosition();
    
    const distance = playerPos.clone().sub(powerupPos).length();
    
    if (distance < 1.5) {
      this.collect();
      return true;
    }
    
    return false;
  }
  
  private collect(): void {
    this.isCollected = true;
    this.createCollectEffect();
    this.entity.enabled = false;
  }
  
  private createCollectEffect(): void {
    const effect = new pc.Entity('collectEffect');
    effect.setPosition(this.entity.getPosition());
    
    effect.addComponent('particlesystem', {
      lifetime: 0.5,
      rate: 0,
      burst: 30,
      speed: 5,
      spread: 360,
      colorGraph: {
        graph: this.getColorCurve()
      },
      sizeGraph: {
        graph: new pc.Curve([0.3, 0.8, 1], 'size')
      }
    });
    
    this.engine.addToScene(effect);
    effect.particlesystem?.start();
    
    setTimeout(() => effect.destroy(), 500);
  }
  
  private getColorCurve(): { graph: pc.CurveSet } {
    switch (this.type) {
      case PowerupType.HEALTH:
        return { graph: new pc.CurveSet([[1, 0.2, 0.2], [1, 0.2, 0.2], [1, 0.2, 0.2], [0, 0, 0]], 'color') };
      case PowerupType.SHIELD:
        return { graph: new pc.CurveSet([[0.2, 0.5, 1], [0.2, 0.5, 1], [0.2, 0.5, 1], [0, 0, 0]], 'color') };
      case PowerupType.WEAPON_UPGRADE:
        return { graph: new pc.CurveSet([[1, 0.8, 0.2], [1, 0.8, 0.2], [1, 0.8, 0.2], [0, 0, 0]], 'color') };
      case PowerupType.SPEED_BOOST:
        return { graph: new pc.CurveSet([[0.2, 1, 0.2], [0.2, 1, 0.2], [0.2, 1, 0.2], [0, 0, 0]], 'color') };
      case PowerupType.SCORE_BONUS:
        return { graph: new pc.CurveSet([[1, 1, 0.2], [1, 1, 0.2], [1, 1, 0.2], [0, 0, 0]], 'color') };
      case PowerupType.INVINCIBILITY:
        return { graph: new pc.CurveSet([[1, 1, 1], [1, 1, 1], [1, 1, 1], [0, 0, 0]], 'color') };
      case PowerupType.MISSILE:
        return { graph: new pc.CurveSet([[1, 0.3, 0.5], [1, 0.3, 0.5], [1, 0.3, 0.5], [0, 0, 0]], 'color') };
      case PowerupType.LASER:
        return { graph: new pc.CurveSet([[0.3, 0.5, 1], [0.3, 0.5, 1], [0.3, 0.5, 1], [0, 0, 0]], 'color') };
      default:
        return { graph: new pc.CurveSet([[1, 1, 1], [1, 1, 1], [1, 1, 1], [0, 0, 0]], 'color') };
    }
  }
  
  private respawn(): void {
    this.isCollected = false;
    this.isVisible = true;
    this.entity.enabled = true;
  }
  
  public apply(player: PlayerShip): void {
    switch (this.type) {
      case PowerupType.HEALTH:
        player.heal(this.value * 20);
        break;
      case PowerupType.SHIELD:
        player.addShield(this.value * 30);
        break;
      case PowerupType.WEAPON_UPGRADE:
        break;
      case PowerupType.SPEED_BOOST:
        break;
      case PowerupType.SCORE_BONUS:
        break;
      case PowerupType.INVINCIBILITY:
        player.setInvincible(this.duration);
        break;
      case PowerupType.MISSILE:
        break;
      case PowerupType.LASER:
        break;
    }
  }
  
  public getType(): PowerupType {
    return this.type;
  }
  
  public getPosition(): pc.Vec3 {
    return this.entity.getPosition();
  }
  
  public setRespawnTime(time: number): void {
    this.respawnTime = time;
  }
  
  public destroy(): void {
    this.entity.destroy();
  }
  
  public isActive(): boolean {
    return this.isVisible && !this.isCollected;
  }
}

export class PowerupSpawner {
  private engine: PlayCanvasGameEngine;
  private powerups: Powerup[] = [];
  private spawnTimer: number = 0;
  private spawnInterval: number = 5;
  private maxPowerups: number = 5;
  
  constructor(engine: PlayCanvasGameEngine) {
    this.engine = engine;
  }
  
  public update(dt: number): void {
    this.spawnTimer += dt;
    
    if (this.spawnTimer >= this.spawnInterval && this.powerups.length < this.maxPowerups) {
      this.spawnPowerup();
      this.spawnTimer = 0;
    }
    
    this.powerups.forEach(powerup => powerup.update(dt));
    
    this.powerups = this.powerups.filter(powerup => powerup.isActive());
  }
  
  private spawnPowerup(): void {
    const types = Object.values(PowerupType);
    const randomType = types[Math.floor(Math.random() * types.length)];
    
    const spawnArea = 40;
    const x = (Math.random() - 0.5) * spawnArea;
    const y = (Math.random() - 0.5) * 10;
    const z = (Math.random() - 0.5) * spawnArea;
    
    const position = new pc.Vec3(x, y, z);
    const powerup = new Powerup(this.engine, randomType, position);
    
    this.powerups.push(powerup);
  }
  
  public checkCollisions(player: PlayerShip): Powerup | null {
    for (const powerup of this.powerups) {
      if (powerup.checkCollection(player)) {
        powerup.apply(player);
        return powerup;
      }
    }
    return null;
  }
  
  public addPowerup(type: PowerupType, position: pc.Vec3, value: number = 1, duration: number = 0): Powerup {
    const powerup = new Powerup(this.engine, type, position, value, duration);
    this.powerups.push(powerup);
    return powerup;
  }
  
  public clearAll(): void {
    this.powerups.forEach(p => p.destroy());
    this.powerups = [];
  }
  
  public getPowerups(): Powerup[] {
    return this.powerups;
  }
  
  public setSpawnInterval(interval: number): void {
    this.spawnInterval = interval;
  }
  
  public setMaxPowerups(max: number): void {
    this.maxPowerups = max;
  }
}