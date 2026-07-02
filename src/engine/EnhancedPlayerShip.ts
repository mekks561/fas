/**
 * 增强版玩家飞船组件
 * 扩展功能：多种武器、技能系统、动画效果、伤害反馈
 */

import * as pc from 'playcanvas';
import { EnhancedPlayCanvasEngine } from './EnhancedPlayCanvasEngine';

export type WeaponType = 'primary' | 'secondary' | 'special';

export interface WeaponConfig {
  type: WeaponType;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  maxAmmo: number;
  reloadTime: number;
}

export interface SkillConfig {
  name: string;
  cooldown: number;
  duration: number;
  description: string;
}

export interface PlayerConfig {
  engine: EnhancedPlayCanvasEngine;
  initialPosition?: pc.Vec3;
  health?: number;
  shield?: number;
  speed?: number;
}

export class EnhancedPlayerShip {
  private engine: EnhancedPlayCanvasEngine;
  private entity: pc.Entity;
  private health: number;
  private maxHealth: number;
  private shield: number;
  private maxShield: number;
  private speed: number;
  private velocity: pc.Vec3;

  private weapons: Map<WeaponType, WeaponConfig> = new Map();
  private currentWeapon: WeaponType = 'primary';
  private weaponCooldowns: Map<WeaponType, number> = new Map();

  private skills: Map<string, SkillConfig> = new Map();
  private skillCooldowns: Map<string, number> = new Map();
  private activeSkills: Set<string> = new Set();

  private engineParticles: pc.Entity | null = null;
  private damageParticles: pc.Entity | null = null;

  private isInvincible: boolean = false;
  private invincibleTimer: number = 0;

  constructor(config: PlayerConfig) {
    this.engine = config.engine;
    this.health = config.health || 100;
    this.maxHealth = this.health;
    this.shield = config.shield || 50;
    this.maxShield = this.shield;
    this.speed = config.speed || 10;
    this.velocity = new pc.Vec3(0, 0, 0);

    this.initializeWeapons();
    this.initializeSkills();

    this.entity = this.createPlayerShip(config.initialPosition || new pc.Vec3(0, 0, 0));
    this.createParticleEffects();
  }

  private initializeWeapons(): void {
    this.weapons.set('primary', {
      type: 'primary',
      damage: 20,
      fireRate: 200,
      projectileSpeed: 50,
      maxAmmo: 50,
      reloadTime: 1000,
    });

    this.weapons.set('secondary', {
      type: 'secondary',
      damage: 50,
      fireRate: 800,
      projectileSpeed: 30,
      maxAmmo: 20,
      reloadTime: 2000,
    });

    this.weapons.set('special', {
      type: 'special',
      damage: 100,
      fireRate: 3000,
      projectileSpeed: 20,
      maxAmmo: 5,
      reloadTime: 5000,
    });

    this.weaponCooldowns.set('primary', 0);
    this.weaponCooldowns.set('secondary', 0);
    this.weaponCooldowns.set('special', 0);
  }

  private initializeSkills(): void {
    this.skills.set('shieldBoost', {
      name: 'Shield Boost',
      cooldown: 10000,
      duration: 5000,
      description: 'Temporarily increases shield capacity by 50%',
    });

    this.skills.set('speedBoost', {
      name: 'Speed Boost',
      cooldown: 8000,
      duration: 3000,
      description: 'Doubles movement speed',
    });

    this.skills.set('invincible', {
      name: 'Invincibility',
      cooldown: 30000,
      duration: 3000,
      description: 'Makes player invincible for a short time',
    });

    this.skillCooldowns.set('shieldBoost', 0);
    this.skillCooldowns.set('speedBoost', 0);
    this.skillCooldowns.set('invincible', 0);
  }

  private createPlayerShip(position: pc.Vec3): pc.Entity {
    const _app = this.engine.getApp();

    const material = new pc.StandardMaterial();
    material.diffuse.set(0.2, 0.5, 0.8);
    material.specular.set(0.8, 0.8, 0.8);
    material.shininess = 50;
    material.emissive.set(0.1, 0.2, 0.4);
    material.update();

    const player = new pc.Entity('player');
    player.setPosition(position);

    const body = new pc.Entity('playerBody');
    body.addComponent('model', { type: 'box' });
    if (body.model) body.model.material = material;
    body.setLocalScale(1, 0.5, 2);
    player.addChild(body);

    const cockpit = new pc.Entity('cockpit');
    cockpit.addComponent('model', { type: 'sphere' });
    const cockpitMaterial = new pc.StandardMaterial();
    cockpitMaterial.diffuse.set(0.1, 0.3, 0.6);
    cockpitMaterial.specular.set(0.9, 0.9, 0.9);
    cockpitMaterial.shininess = 100;
    cockpitMaterial.transparency = 0.3;
    cockpitMaterial.update();
    if (cockpit.model) cockpit.model.material = cockpitMaterial;
    cockpit.setLocalPosition(0, 0.3, 0);
    cockpit.setLocalScale(0.4, 0.4, 0.4);
    player.addChild(cockpit);

    const wingLeft = new pc.Entity('wingLeft');
    wingLeft.addComponent('model', { type: 'box' });
    if (wingLeft.model) wingLeft.model.material = material;
    wingLeft.setLocalPosition(-0.8, -0.1, 0);
    wingLeft.setLocalScale(1.5, 0.1, 1);
    player.addChild(wingLeft);

    const wingRight = new pc.Entity('wingRight');
    wingRight.addComponent('model', { type: 'box' });
    if (wingRight.model) wingRight.model.material = material;
    wingRight.setLocalPosition(0.8, -0.1, 0);
    wingRight.setLocalScale(1.5, 0.1, 1);
    player.addChild(wingRight);

    const engineGlow = new pc.Entity('engineGlow');
    engineGlow.addComponent('model', { type: 'sphere' });
    const glowMaterial = new pc.StandardMaterial();
    glowMaterial.diffuse.set(0.8, 0.4, 0.1);
    glowMaterial.emissive.set(1, 0.6, 0.2);
    glowMaterial.update();
    if (engineGlow.model) engineGlow.model.material = glowMaterial;
    engineGlow.setLocalPosition(0, 0, -1.5);
    engineGlow.setLocalScale(0.3, 0.3, 0.5);
    player.addChild(engineGlow);

    player.addComponent('rigidbody', {
      type: 'dynamic',
      mass: 1,
      linearDamping: 0.1,
    });

    player.addComponent('collision', {
      type: 'box',
      halfExtents: new pc.Vec3(0.8, 0.4, 1.5),
    });

    this.engine.addToScene(player);

    return player;
  }

  private createParticleEffects(): void {
    this.engineParticles = this.engine.createParticleSystem('engineParticles', {
      emitterShape: 'cone',
      rate: 50,
      lifetime: 0.5,
      speed: 10,
      colorStart: new pc.Color(1, 0.8, 0.2),
      colorEnd: new pc.Color(1, 0.3, 0),
      sizeStart: 0.3,
      sizeEnd: 0.05,
    });
    this.engineParticles.setParent(this.entity);
    this.engineParticles.setLocalPosition(0, 0, -1.5);
    this.engineParticles.setLocalEulerAngles(180, 0, 0);

    this.damageParticles = this.engine.createParticleSystem('damageParticles', {
      emitterShape: 'sphere',
      rate: 30,
      lifetime: 0.3,
      speed: 5,
      colorStart: new pc.Color(1, 0, 0),
      colorEnd: new pc.Color(0.5, 0, 0),
      sizeStart: 0.2,
      sizeEnd: 0,
    });
    this.damageParticles.setParent(this.entity);
    if (this.damageParticles.particlesystem) this.damageParticles.particlesystem.enabled = false;
  }

  public update(
    dt: number,
    controls: {
      left: boolean;
      right: boolean;
      up: boolean;
      down: boolean;
      boost: boolean;
      fire: boolean;
      switchWeapon?: WeaponType;
      skill1?: boolean;
      skill2?: boolean;
      skill3?: boolean;
    },
  ): void {
    const speedMultiplier = this.activeSkills.has('speedBoost') ? 2 : 1;
    const currentSpeed = controls.boost
      ? this.speed * 2 * speedMultiplier
      : this.speed * speedMultiplier;

    if (controls.left) this.entity.rigidbody?.applyTorque(new pc.Vec3(0, -50 * dt, 0));
    if (controls.right) this.entity.rigidbody?.applyTorque(new pc.Vec3(0, 50 * dt, 0));
    if (controls.up)
      this.entity.rigidbody?.applyForce(this.entity.forward.clone().scale(currentSpeed * dt * 100));
    if (controls.down)
      this.entity.rigidbody?.applyForce(this.entity.forward.clone().scale(-currentSpeed * dt * 50));

    this.speed = this.entity.rigidbody?.linearVelocity.length() ?? 0;

    if (this.engineParticles) {
      const emitterRate = controls.boost ? 100 : 50;
      if (this.engineParticles.particlesystem)
        this.engineParticles.particlesystem.rate = emitterRate;
    }

    if (controls.fire) {
      this.fireWeapon();
    }

    if (controls.switchWeapon) {
      this.switchWeapon(controls.switchWeapon);
    }

    if (controls.skill1) {
      this.activateSkill('shieldBoost');
    }
    if (controls.skill2) {
      this.activateSkill('speedBoost');
    }
    if (controls.skill3) {
      this.activateSkill('invincible');
    }

    this.updateCooldowns(dt);
    this.updateInvincibility(dt);
    this.updateActiveSkills(dt);
  }

  private fireWeapon(): void {
    const now = Date.now();
    const cooldown = this.weaponCooldowns.get(this.currentWeapon);

    if (cooldown === undefined || now < cooldown) return;

    const weapon = this.weapons.get(this.currentWeapon);
    if (!weapon) return;

    this.weaponCooldowns.set(this.currentWeapon, now + weapon.fireRate);

    const playerPos = this.entity.getPosition();
    const playerForward = this.entity.forward.clone();

    const projectile = new pc.Entity(`projectile_${Date.now()}`);
    projectile.setPosition(playerPos.clone().add(playerForward.clone().scale(2)));

    const material = new pc.StandardMaterial();
    const color = this.getWeaponColor(this.currentWeapon);
    material.diffuse.set(color.r, color.g, color.b);
    material.emissive.set(color.r, color.g, color.b);
    material.update();

    projectile.addComponent('model', { type: 'sphere' });
    if (projectile.model) projectile.model.material = material;
    projectile.setLocalScale(0.2, 0.2, 0.2);

    projectile.addComponent('rigidbody', {
      type: 'dynamic',
      mass: 0.1,
      linearDamping: 0,
    });

    projectile.addComponent('collision', {
      type: 'sphere',
      radius: 0.2,
    });

    this.engine.addToScene(projectile);

    if (projectile.rigidbody)
      projectile.rigidbody.linearVelocity = playerForward.clone().scale(weapon.projectileSpeed);
  }

  private getWeaponColor(type: WeaponType): pc.Color {
    switch (type) {
      case 'primary':
        return new pc.Color(0, 0.8, 1);
      case 'secondary':
        return new pc.Color(1, 0.5, 0);
      case 'special':
        return new pc.Color(0.8, 0, 1);
      default:
        return new pc.Color(1, 1, 1);
    }
  }

  private switchWeapon(type: WeaponType): void {
    if (this.weapons.has(type)) {
      this.currentWeapon = type;
    }
  }

  private activateSkill(skillName: string): void {
    const now = Date.now();
    const cooldown = this.skillCooldowns.get(skillName);

    if (cooldown === undefined || now < cooldown) return;

    const skill = this.skills.get(skillName);
    if (!skill) return;

    this.skillCooldowns.set(skillName, now + skill.cooldown);
    this.activeSkills.add(skillName);

    switch (skillName) {
      case 'shieldBoost':
        this.shield = this.maxShield * 1.5;
        break;
      case 'speedBoost':
        break;
      case 'invincible':
        this.isInvincible = true;
        this.invincibleTimer = skill.duration;
        break;
    }

    setTimeout(() => {
      this.deactivateSkill(skillName);
    }, skill.duration);
  }

  private deactivateSkill(skillName: string): void {
    this.activeSkills.delete(skillName);

    if (skillName === 'shieldBoost') {
      this.shield = Math.min(this.shield, this.maxShield);
    }
    if (skillName === 'invincible') {
      this.isInvincible = false;
    }
  }

  private updateCooldowns(_dt: number): void {
    const now = Date.now();
    this.weaponCooldowns.forEach((cooldown, weapon) => {
      if (now >= cooldown) {
        this.weaponCooldowns.set(weapon, 0);
      }
    });

    this.skillCooldowns.forEach((cooldown, skill) => {
      if (now >= cooldown) {
        this.skillCooldowns.set(skill, 0);
      }
    });
  }

  private updateInvincibility(dt: number): void {
    if (this.isInvincible && this.invincibleTimer > 0) {
      this.invincibleTimer -= dt * 1000;
      if (this.invincibleTimer <= 0) {
        this.isInvincible = false;
      }
    }
  }

  private updateActiveSkills(_dt: number): void {
    // 可以在这里添加技能持续效果的更新逻辑
  }

  public takeDamage(amount: number): void {
    if (this.isInvincible) return;

    if (this.shield > 0) {
      const shieldDamage = Math.min(this.shield, amount);
      this.shield -= shieldDamage;
      amount -= shieldDamage;
    }
    this.health -= amount;
    this.health = Math.max(0, this.health);

    this.showDamageEffect();
  }

  private showDamageEffect(): void {
    if (this.damageParticles) {
      if (this.damageParticles.particlesystem) this.damageParticles.particlesystem.enabled = true;
      setTimeout(() => {
        if (this.damageParticles) {
          if (this.damageParticles.particlesystem)
            this.damageParticles.particlesystem.enabled = false;
        }
      }, 300);
    }
  }

  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  public rechargeShield(amount: number): void {
    const maxShield = this.activeSkills.has('shieldBoost') ? this.maxShield * 1.5 : this.maxShield;
    this.shield = Math.min(maxShield, this.shield + amount);
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

  public isAlive(): boolean {
    return this.health > 0;
  }

  public getCurrentWeapon(): WeaponType {
    return this.currentWeapon;
  }

  public getWeapons(): Map<WeaponType, WeaponConfig> {
    return this.weapons;
  }

  public getSkills(): Map<string, SkillConfig> {
    return this.skills;
  }

  public getSkillCooldown(skillName: string): number {
    const cooldown = this.skillCooldowns.get(skillName);
    if (!cooldown || cooldown <= Date.now()) return 0;
    return Math.max(0, cooldown - Date.now());
  }

  public isSkillActive(skillName: string): boolean {
    return this.activeSkills.has(skillName);
  }
}
