import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { Enemy } from './Enemy';
import { LuaSkillBridge } from './LuaSkillBridge';
import type { WeaponModifiers } from './BuildSystem';

export type WeaponType = 'normal' | 'spread' | 'laser' | 'missile';

export interface WeaponConfig {
  type: WeaponType;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  spreadCount?: number;
  spreadAngle?: number;
  color?: pc.Color;
}

export class Projectile {
  public entity: pc.Entity;
  public damage: number;
  public velocity: pc.Vec3;
  public active: boolean;
  public weaponType: WeaponType;
  /** 剩余穿透次数（由 Build 修饰符注入） */
  public pierceRemaining: number = 0;
  /** 本帧已击中的敌人引用集合，避免穿透时重复命中同一敌人 */
  public hitEnemyIds: Set<Enemy> = new Set();

  constructor(entity: pc.Entity, damage: number, velocity: pc.Vec3, weaponType: WeaponType) {
    this.entity = entity;
    this.damage = damage;
    this.velocity = velocity;
    this.active = true;
    this.weaponType = weaponType;
  }
}

export class WeaponSystem {
  private engine: PlayCanvasGameEngine;
  private player!: PlayerShip;
  private projectiles: Projectile[] = [];
  private currentWeapon: WeaponType = 'normal';
  private weaponLevel: number = 1;
  private lastShootTime: number = 0;
  private luaSkillBridge: LuaSkillBridge | null = null;
  private playerLevel: number = 1;
  private learnedSkills: string[] = [];

  // Build 系统修饰符（由 BuildSystem 每帧推送）
  private buildMods: WeaponModifiers = {
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    pierceBonus: 0,
    splitCount: 0,
    splitDamageMultiplier: 0.5,
    splitSeekingRange: 8,
    critChanceBonus: 0,
    critDamageMultiplier: 2,
    ricochet: null,
    chainLightning: null,
    elemental: null,
    stardustPickupRangeMultiplier: 1,
    stardustDropAmountMultiplier: 1,
  };

  // 武器配置
  private weaponConfigs: Record<WeaponType, WeaponConfig> = {
    normal: {
      type: 'normal',
      damage: 20,
      fireRate: 200,
      projectileSpeed: 50,
      color: new pc.Color(1, 0.8, 0),
    },
    spread: {
      type: 'spread',
      damage: 15,
      fireRate: 300,
      projectileSpeed: 45,
      spreadCount: 3,
      spreadAngle: 15,
      color: new pc.Color(0.8, 1, 0.2),
    },
    laser: {
      type: 'laser',
      damage: 30,
      fireRate: 150,
      projectileSpeed: 100,
      color: new pc.Color(0.2, 0.8, 1),
    },
    missile: {
      type: 'missile',
      damage: 60,
      fireRate: 800,
      projectileSpeed: 35,
      color: new pc.Color(1, 0.4, 0.8),
    },
  };

  // 武器升级配置
  private levelConfigs = [
    { normal: 'normal', spread: 'normal', laser: 'normal', missile: 'normal' },
    { normal: 'normal', spread: 'normal', laser: 'normal', missile: 'normal' },
    { normal: 'spread', spread: 'spread', laser: 'spread', missile: 'spread' },
    { normal: 'spread', spread: 'laser', laser: 'laser', missile: 'laser' },
    { normal: 'laser', spread: 'laser', laser: 'missile', missile: 'missile' },
  ];

  constructor(engine: PlayCanvasGameEngine) {
    this.engine = engine;
  }

  public setPlayer(player: PlayerShip): void {
    this.player = player;
  }

  public setBuildModifiers(mods: WeaponModifiers): void {
    this.buildMods = mods;
  }

  public setLuaSkillBridge(bridge: LuaSkillBridge): void {
    this.luaSkillBridge = bridge;
    // 初始化 Lua 技能
    this.initializeLuaSkills();
  }

  public setPlayerLevel(level: number): void {
    this.playerLevel = level;
  }

  /**
   * 初始化 Lua 技能
   * 根据玩家等级自动学习可用的技能
   */
  private initializeLuaSkills(): void {
    if (!this.luaSkillBridge) return;

    console.log('[WeaponSystem] Initializing Lua skills...');

    // 学习基础攻击（等级 1）
    if (this.luaSkillBridge.learnSkill('basic_attack', this.playerLevel, this.learnedSkills)) {
      this.learnedSkills.push('basic_attack');
      console.log('[WeaponSystem] Learned: basic_attack');
    }

    // 学习快速恢复（等级 3）
    if (
      this.playerLevel >= 3 &&
      this.luaSkillBridge.learnSkill('quick_heal', this.playerLevel, this.learnedSkills)
    ) {
      this.learnedSkills.push('quick_heal');
      console.log('[WeaponSystem] Learned: quick_heal');
    }

    // 学习强力射击（等级 5）
    if (
      this.playerLevel >= 5 &&
      this.luaSkillBridge.learnSkill('power_shot', this.playerLevel, this.learnedSkills)
    ) {
      this.learnedSkills.push('power_shot');
      console.log('[WeaponSystem] Learned: power_shot');
    }

    // 学习疾风加速（等级 5）
    if (
      this.playerLevel >= 5 &&
      this.luaSkillBridge.learnSkill('speed_boost', this.playerLevel, this.learnedSkills)
    ) {
      this.learnedSkills.push('speed_boost');
      console.log('[WeaponSystem] Learned: speed_boost');
    }

    // 学习攻击强化被动（等级 2）
    if (
      this.playerLevel >= 2 &&
      this.luaSkillBridge.learnSkill('attack_boost_passive', this.playerLevel, this.learnedSkills)
    ) {
      this.learnedSkills.push('attack_boost_passive');
      console.log('[WeaponSystem] Learned: attack_boost_passive');
    }

    // 学习散射弹幕（等级 10）
    if (
      this.playerLevel >= 10 &&
      this.luaSkillBridge.learnSkill('spread_shot', this.playerLevel, this.learnedSkills)
    ) {
      this.learnedSkills.push('spread_shot');
      console.log('[WeaponSystem] Learned: spread_shot');
    }

    // 学习终极爆发（等级 20）
    if (
      this.playerLevel >= 20 &&
      this.luaSkillBridge.learnSkill('ultimate_burst', this.playerLevel, this.learnedSkills)
    ) {
      this.learnedSkills.push('ultimate_burst');
      console.log('[WeaponSystem] Learned: ultimate_burst');
    }

    console.log(`[WeaponSystem] Total skills learned: ${this.learnedSkills.length}`);
  }

  /**
   * 获取玩家属性
   */
  private getPlayerStats(): Record<string, number> {
    return {
      damage: this.getWeaponDamage(),
      critChance: 10, // 基础暴击率
      critDamage: 50, // 基础暴击伤害
      speed: 5.0, // 基础速度
    };
  }

  /**
   * 获取玩家资源
   */
  private getPlayerResources(): Record<string, number> {
    // 从玩家获取实际资源
    const health = this.player.getHealth ? this.player.getHealth() : 100;
    return {
      mana: 100, // 法力值（可扩展）
      energy: 100, // 能量值
      health: health, // 血量
    };
  }

  public shoot(): void {
    const now = Date.now();
    const config = this.getWeaponConfig();

    // 应用 Build 修饰符：射击间隔（fireRateMultiplier > 1 = 更慢，< 1 = 更快）
    const effectiveFireRate = config.fireRate * this.buildMods.fireRateMultiplier;
    if (now - this.lastShootTime < effectiveFireRate) return;

    const playerPos = this.player.getEntity().getPosition();
    const playerForward = this.player.getEntity().forward.clone();

    // 调用 Lua 技能系统
    if (this.luaSkillBridge) {
      const playerPosVec3 = {
        x: playerPos.x,
        y: playerPos.y,
        z: playerPos.z,
      };

      const targetPos = {
        x: playerPos.x + playerForward.x * 100,
        y: playerPos.y + playerForward.y * 100,
        z: playerPos.z + playerForward.z * 100,
      };

      const result = this.luaSkillBridge.castSkill(
        'basic_attack',
        { ...playerPosVec3, stats: this.getPlayerStats() },
        targetPos,
        this.getPlayerResources(),
      );

      if (result.success) {
        // Lua 技能系统调用成功，伤害计算结果可用于后续扩展
        // （高频射击时避免 console.log 刷屏，按需在调试时临时开启）
        if (result.effects && result.effects.length > 0) {
          const damageEffect = result.effects.find((e: { type: string }) => e.type === 'damage');
          // TODO: 将 Lua 计算的 damageEffect.value 应用到实际子弹伤害
          void damageEffect;
        }
      }
    }

    switch (this.currentWeapon) {
      case 'normal':
        this.createNormalProjectile(playerPos, playerForward, config);
        break;
      case 'spread':
        this.createSpreadProjectiles(playerPos, playerForward, config);
        break;
      case 'laser':
        this.createLaserProjectile(playerPos, playerForward, config);
        break;
      case 'missile':
        this.createMissileProjectile(playerPos, playerForward, config);
        break;
    }

    this.lastShootTime = now;
  }

  private getWeaponConfig(): WeaponConfig {
    const baseConfig = this.weaponConfigs[this.currentWeapon];
    const levelBonus = 1 + (this.weaponLevel - 1) * 0.2;

    return {
      ...baseConfig,
      damage: Math.floor(baseConfig.damage * levelBonus),
      fireRate: Math.max(50, baseConfig.fireRate - (this.weaponLevel - 1) * 20),
    };
  }

  private createNormalProjectile(pos: pc.Vec3, forward: pc.Vec3, config: WeaponConfig): void {
    const projectile = this.createProjectileEntity(config.color || new pc.Color(1, 0.8, 0));
    projectile.setPosition(pos.clone().add(forward.clone().mulScalar(2)));

    this.engine.addToScene(projectile);

    // 应用 Build 修饰符：伤害倍率 + 穿透次数
    const effectiveDamage = config.damage * this.buildMods.damageMultiplier;
    const proj = new Projectile(
      projectile,
      effectiveDamage,
      forward.clone().mulScalar(config.projectileSpeed),
      'normal',
    );
    proj.pierceRemaining = this.buildMods.pierceBonus;
    this.projectiles.push(proj);
  }

  private createSpreadProjectiles(pos: pc.Vec3, forward: pc.Vec3, config: WeaponConfig): void {
    const count = config.spreadCount || 3;
    const angle = ((config.spreadAngle || 15) * Math.PI) / 180;

    for (let i = 0; i < count; i++) {
      const offsetAngle = (i - (count - 1) / 2) * angle;
      const direction = forward.clone();

      const rotation = new pc.Quat();
      rotation.setFromAxisAngle(new pc.Vec3(0, 1, 0), offsetAngle);
      rotation.transformVector(direction);

      const projectile = this.createProjectileEntity(config.color || new pc.Color(0.8, 1, 0.2));
      projectile.setPosition(pos.clone().add(forward.clone().mulScalar(2)));

      this.engine.addToScene(projectile);

      this.projectiles.push(
        new Projectile(
          projectile,
          config.damage * this.buildMods.damageMultiplier,
          direction.clone().mulScalar(config.projectileSpeed),
          'spread',
        ),
      );
    }
  }

  private createLaserProjectile(pos: pc.Vec3, forward: pc.Vec3, config: WeaponConfig): void {
    const projectile = new pc.Entity('laser');
    projectile.setPosition(pos.clone().add(forward.clone().mulScalar(2)));

    const material = new pc.StandardMaterial();
    material.diffuse.copy(config.color || new pc.Color(0.2, 0.8, 1));
    material.emissive.copy(config.color || new pc.Color(0.2, 0.8, 1));
    material.blendType = pc.BLEND_ADDITIVE;
    material.update();

    projectile.addComponent('model', { type: 'cylinder' });
    if (projectile.model) projectile.model.material = material;
    projectile.setLocalScale(0.08, 2, 0.08);
    projectile.setLocalEulerAngles(90, 0, 0);

    this.engine.addToScene(projectile);

    this.projectiles.push(
      new Projectile(
        projectile,
        config.damage * this.buildMods.damageMultiplier,
        forward.clone().mulScalar(config.projectileSpeed),
        'laser',
      ),
    );
  }

  private createMissileProjectile(pos: pc.Vec3, forward: pc.Vec3, config: WeaponConfig): void {
    const missile = new pc.Entity('missile');
    missile.setPosition(pos.clone().add(forward.clone().mulScalar(2.5)));

    const material = new pc.StandardMaterial();
    material.diffuse.copy(config.color || new pc.Color(1, 0.4, 0.8));
    material.emissive.copy(config.color || new pc.Color(1, 0.4, 0.8));
    material.update();

    missile.addComponent('model', { type: 'cylinder' });
    if (missile.model) missile.model.material = material;
    missile.setLocalScale(0.15, 0.8, 0.15);
    missile.setLocalEulerAngles(90, 0, 0);

    // 导弹尾焰
    const flame = new pc.Entity('missileFlame');
    flame.addComponent('particlesystem', {
      lifetime: 0.2,
      rate: 30,
      // Engine 2：speed 改名为 initialVelocity
      initialVelocity: 5,
      // 注：Engine 2 已移除 spread —— 发射方向改由 emitterShape 决定
      //（box 沿本地 Z 轴、sphere 沿半径向外），故此处不再设置
      // Engine 2：直接传曲线本体，并去掉会破坏曲线分组的 'color' 第二参数
      colorGraph: new pc.CurveSet([
        [1, 0.5, 0],
        [1, 0.8, 0.2],
        [0, 0, 0],
      ]),
      scaleGraph: new pc.Curve([0.2, 0.05]),
    });
    flame.setLocalPosition(0, -0.5, 0);
    missile.addChild(flame);

    this.engine.addToScene(missile);

    this.projectiles.push(
      new Projectile(
        missile,
        config.damage * this.buildMods.damageMultiplier,
        forward.clone().mulScalar(config.projectileSpeed),
        'missile',
      ),
    );
  }

  private createProjectileEntity(color: pc.Color): pc.Entity {
    const projectile = new pc.Entity('projectile');

    const material = new pc.StandardMaterial();
    material.diffuse.copy(color);
    material.emissive.copy(color);
    material.update();

    projectile.addComponent('model', { type: 'sphere' });
    if (projectile.model) projectile.model.material = material;
    projectile.setLocalScale(0.15, 0.15, 0.15);

    return projectile;
  }

  public update(dt: number): void {
    this.projectiles = this.projectiles.filter((proj) => {
      if (!proj.active) {
        proj.entity.destroy();
        return false;
      }

      // 清除本帧穿透命中记录
      proj.hitEnemyIds.clear();

      const pos = proj.entity.getPosition();
      pos.add(proj.velocity.clone().mulScalar(dt));
      proj.entity.setPosition(pos);

      if (pos.length() > 100) {
        proj.entity.destroy();
        return false;
      }

      return true;
    });
  }

  public checkCollisions(enemies: Enemy[]): number {
    let hits = 0;

    this.projectiles.forEach((proj) => {
      if (!proj.active) return;

      enemies.forEach((enemy) => {
        if (!enemy.isAlive()) return;
        // 穿透时跳过已击中的敌人
        if (proj.hitEnemyIds.has(enemy)) return;

        const projPos = proj.entity.getPosition();
        const enemyPos = enemy.getPosition();
        const distance = projPos.clone().sub(enemyPos).length();

        const collisionDistance = proj.weaponType === 'missile' ? 1.5 : 0.8;

        if (distance < collisionDistance) {
          // 应用 Build 修饰符：暴击
          let damage = proj.damage;
          const isCrit =
            this.buildMods.critChanceBonus > 0 && Math.random() < this.buildMods.critChanceBonus;
          if (isCrit) {
            damage = Math.floor(damage * this.buildMods.critDamageMultiplier);
          }

          enemy.takeDamage(damage);
          proj.hitEnemyIds.add(enemy);
          hits++;

          // 应用 Build 修饰符：吸血
          if (this.player.getLifestealRatio() > 0) {
            this.player.healFromDamage(damage);
          }

          // 应用 Build 修饰符：分裂弹
          if (this.buildMods.splitCount > 0) {
            this.createSplitProjectiles(projPos, enemies, enemy);
          }

          // 应用 Build 修饰符：穿透（有剩余穿透次数时不销毁子弹）
          if (proj.pierceRemaining > 0) {
            proj.pierceRemaining--;
          } else {
            proj.active = false;
          }

          // 导弹产生爆炸效果
          if (proj.weaponType === 'missile') {
            this.createExplosion(projPos);
          }
        }
      });
    });

    return hits;
  }

  /**
   * 创建分裂弹：向附近其他敌人发射追踪弹
   */
  private createSplitProjectiles(origin: pc.Vec3, enemies: Enemy[], hitEnemy: Enemy): void {
    const splitCount = this.buildMods.splitCount;
    const splitDamage = this.buildMods.splitDamageMultiplier;
    const seekRange = this.buildMods.splitSeekingRange;

    // 寻找附近的敌人作为分裂弹目标
    const nearbyEnemies = enemies
      .filter((e) => e.isAlive() && e !== hitEnemy)
      .map((e) => ({ enemy: e, dist: e.getPosition().clone().sub(origin).length() }))
      .filter((item) => item.dist <= seekRange)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, splitCount);

    for (const target of nearbyEnemies) {
      const direction = target.enemy.getPosition().clone().sub(origin).normalize();
      const projectile = this.createProjectileEntity(new pc.Color(1, 0.6, 0.2));
      projectile.setPosition(origin.clone());

      this.engine.addToScene(projectile);

      const proj = new Projectile(
        projectile,
        this.getWeaponDamage() * this.buildMods.damageMultiplier * splitDamage,
        direction.mulScalar(40),
        'normal',
      );
      proj.pierceRemaining = 0;
      this.projectiles.push(proj);
    }
  }

  private createExplosion(position: pc.Vec3): void {
    const explosion = new pc.Entity('explosion');
    explosion.setPosition(position);

    explosion.addComponent('particlesystem', {
      lifetime: 0.5,
      rate: 0,
      // Engine 2：burst 已从引擎中彻底移除，一次喷发 N 个的写法改为 loop:false + numParticles
      loop: false,
      numParticles: 50,
      // Engine 2：speed 改名为 initialVelocity
      initialVelocity: 15,
      // Engine 2：直接传曲线本体，并去掉会破坏曲线分组的 'color' 第二参数
      colorGraph: new pc.CurveSet([
        [1, 0.8, 0.2],
        [1, 0.5, 0],
        [0.5, 0.2, 0],
        [0, 0, 0],
      ]),
      scaleGraph: new pc.Curve([0.5, 1.5]),
    });

    this.engine.addToScene(explosion);

    setTimeout(() => {
      explosion.destroy();
    }, 500);
  }

  public upgradeWeapon(): void {
    if (this.weaponLevel < this.levelConfigs.length) {
      this.weaponLevel++;
      this.updateCurrentWeapon();
    }
  }

  public downgradeWeapon(): void {
    if (this.weaponLevel > 1) {
      this.weaponLevel--;
      this.updateCurrentWeapon();
    }
  }

  public setWeaponType(type: WeaponType): void {
    this.currentWeapon = type;
  }

  private updateCurrentWeapon(): void {
    const levelConfig =
      this.levelConfigs[Math.min(this.weaponLevel - 1, this.levelConfigs.length - 1)];
    this.currentWeapon = (levelConfig[this.currentWeapon] as WeaponType) || 'normal';
  }

  public getCurrentWeapon(): WeaponType {
    return this.currentWeapon;
  }

  public getWeaponLevel(): number {
    return this.weaponLevel;
  }

  public getProjectileCount(): number {
    return this.projectiles.length;
  }

  public destroyAll(): void {
    this.projectiles.forEach((proj) => proj.entity.destroy());
    this.projectiles = [];
  }

  public getWeaponDamage(): number {
    return this.getWeaponConfig().damage;
  }

  public getFireRate(): number {
    return this.getWeaponConfig().fireRate;
  }
}
