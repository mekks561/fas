/**
 * 增强版武器系统
 * 扩展功能：多种武器类型、武器升级、弹药系统、投射物池
 */

import * as pc from 'playcanvas';
import { EnhancedPlayCanvasEngine } from './EnhancedPlayCanvasEngine';
import { EnhancedPlayerShip, WeaponType } from './EnhancedPlayerShip';
import { EnhancedEnemy } from './EnhancedEnemy';

export interface ProjectileData {
  entity: pc.Entity;
  damage: number;
  velocity: pc.Vec3;
  active: boolean;
  lifetime: number;
  maxLifetime: number;
  weaponType: WeaponType;
}

export interface WeaponUpgrade {
  level: number;
  damageMultiplier: number;
  fireRateMultiplier: number;
  projectileSpeedMultiplier: number;
  maxAmmoMultiplier: number;
}

export class EnhancedWeaponSystem {
  private engine: EnhancedPlayCanvasEngine;
  private player: EnhancedPlayerShip | null = null;
  private projectiles: ProjectileData[] = [];
  private projectilePool: pc.Entity[] = [];
  private maxPoolSize: number = 100;
  
  private weaponUpgrades: Map<WeaponType, WeaponUpgrade> = new Map();
  
  constructor(engine: EnhancedPlayCanvasEngine) {
    this.engine = engine;
    
    this.weaponUpgrades.set('primary', {
      level: 1,
      damageMultiplier: 1,
      fireRateMultiplier: 1,
      projectileSpeedMultiplier: 1,
      maxAmmoMultiplier: 1
    });
    
    this.weaponUpgrades.set('secondary', {
      level: 1,
      damageMultiplier: 1,
      fireRateMultiplier: 1,
      projectileSpeedMultiplier: 1,
      maxAmmoMultiplier: 1
    });
    
    this.weaponUpgrades.set('special', {
      level: 1,
      damageMultiplier: 1,
      fireRateMultiplier: 1,
      projectileSpeedMultiplier: 1,
      maxAmmoMultiplier: 1
    });
    
    this.initializeProjectilePool();
  }
  
  private initializeProjectilePool(): void {
    for (let i = 0; i < this.maxPoolSize; i++) {
      const projectile = new pc.Entity(`projectile_pool_${i}`);
      projectile.addComponent('model', { type: 'sphere' });
      projectile.addComponent('rigidbody', {
        type: 'dynamic',
        mass: 0.1,
        linearDamping: 0
      });
      projectile.addComponent('collision', {
        type: 'sphere',
        radius: 0.2
      });
      projectile.enabled = false;
      this.projectilePool.push(projectile);
      this.engine.addToScene(projectile);
    }
  }
  
  public setPlayer(player: EnhancedPlayerShip): void {
    this.player = player;
  }
  
  public shoot(weaponType: WeaponType): void {
    if (!this.player) return;
    
    const weapon = this.player.getWeapons().get(weaponType);
    if (!weapon) return;
    
    const upgrade = this.weaponUpgrades.get(weaponType);
    if (!upgrade) return;
    
    const now = Date.now();
    const cooldown = this.player.getWeaponCooldowns?.()[weaponType] || 0;
    if (now < cooldown) return;
    
    const projectile = this.getProjectileFromPool();
    if (!projectile) return;
    
    const playerPos = this.player.getEntity().getPosition();
    const playerForward = this.player.getEntity().forward.clone();
    
    const adjustedDamage = weapon.damage * upgrade.damageMultiplier;
    const adjustedSpeed = weapon.projectileSpeed * upgrade.projectileSpeedMultiplier;
    const adjustedCooldown = weapon.fireRate / upgrade.fireRateMultiplier;
    
    projectile.setPosition(playerPos.clone().add(playerForward.clone().scale(2)));
    projectile.enabled = true;
    if (projectile.rigidbody) projectile.rigidbody.linearVelocity = playerForward.clone().scale(adjustedSpeed);
    
    const material = this.getProjectileMaterial(weaponType);
    if (projectile.model) projectile.model.material = material;
    
    this.projectiles.push({
      entity: projectile,
      damage: adjustedDamage,
      velocity: playerForward.clone().scale(adjustedSpeed),
      active: true,
      lifetime: 0,
      maxLifetime: 3,
      weaponType
    });
    
    if (this.player.setWeaponCooldowns) {
      this.player.setWeaponCooldowns({ ...this.player.getWeaponCooldowns?.() || {}, [weaponType]: now + adjustedCooldown });
    }
  }
  
  private getProjectileFromPool(): pc.Entity | null {
    const available = this.projectilePool.find(p => !p.enabled);
    if (available) {
      return available;
    }
    
    if (this.projectilePool.length < this.maxPoolSize) {
      const newProjectile = new pc.Entity(`projectile_pool_${this.projectilePool.length}`);
      newProjectile.addComponent('model', { type: 'sphere' });
      newProjectile.addComponent('rigidbody', {
        type: 'dynamic',
        mass: 0.1,
        linearDamping: 0
      });
      newProjectile.addComponent('collision', {
        type: 'sphere',
        radius: 0.2
      });
      newProjectile.enabled = false;
      this.projectilePool.push(newProjectile);
      this.engine.addToScene(newProjectile);
      return newProjectile;
    }
    
    return null;
  }
  
  private getProjectileMaterial(weaponType: WeaponType): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    
    switch (weaponType) {
      case 'primary':
        material.diffuse.set(0, 0.8, 1);
        material.emissive.set(0, 0.8, 1);
        break;
      case 'secondary':
        material.diffuse.set(1, 0.5, 0);
        material.emissive.set(1, 0.5, 0);
        break;
      case 'special':
        material.diffuse.set(0.8, 0, 1);
        material.emissive.set(0.8, 0, 1);
        break;
      default:
        material.diffuse.set(1, 1, 1);
        material.emissive.set(1, 1, 1);
    }
    
    material.update();
    return material;
  }
  
  public update(dt: number): void {
    this.projectiles = this.projectiles.filter(proj => {
      if (!proj.active) {
        proj.entity.enabled = false;
        return false;
      }
      
      proj.lifetime += dt;
      
      if (proj.lifetime >= proj.maxLifetime) {
        proj.entity.enabled = false;
        return false;
      }
      
      const pos = proj.entity.getPosition();
      if (pos.length() > 100) {
        proj.entity.enabled = false;
        return false;
      }
      
      return true;
    });
  }
  
  public checkCollisions(enemies: EnhancedEnemy[]): { hits: number; score: number } {
    let hits = 0;
    let score = 0;
    
    this.projectiles.forEach(proj => {
      if (!proj.active) return;
      
      enemies.forEach(enemy => {
        if (!enemy.isAlive()) return;
        
        const projPos = proj.entity.getPosition();
        const enemyPos = enemy.getPosition();
        const distance = projPos.clone().sub(enemyPos).length();
        
        if (distance < 1) {
          enemy.takeDamage(proj.damage);
          proj.active = false;
          hits++;
          
          if (!enemy.isAlive()) {
            score += enemy.getRewardScore();
          }
        }
      });
    });
    
    return { hits, score };
  }
  
  public upgradeWeapon(weaponType: WeaponType): boolean {
    const upgrade = this.weaponUpgrades.get(weaponType);
    if (!upgrade) return false;
    
    if (upgrade.level >= 5) return false;
    
    upgrade.level++;
    upgrade.damageMultiplier += 0.2;
    upgrade.fireRateMultiplier += 0.15;
    upgrade.projectileSpeedMultiplier += 0.1;
    upgrade.maxAmmoMultiplier += 0.3;
    
    return true;
  }
  
  public getWeaponUpgrade(weaponType: WeaponType): WeaponUpgrade | undefined {
    return this.weaponUpgrades.get(weaponType);
  }
  
  public getProjectileCount(): number {
    return this.projectiles.length;
  }
  
  public getActiveProjectiles(): ProjectileData[] {
    return this.projectiles.filter(p => p.active);
  }
  
  public destroyAll(): void {
    this.projectiles.forEach(proj => {
      proj.entity.enabled = false;
    });
    this.projectiles = [];
  }
  
  public getWeaponUpgrades(): Map<WeaponType, WeaponUpgrade> {
    return this.weaponUpgrades;
  }
}