import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { ProceduralModelGenerator, ShipModelType } from './ProceduralModelGenerator';
import { ModelAssetProvider } from './ModelAssetProvider';
import type { PlayerModifiers } from './BuildSystem';
import { PLAYER_BOUNDS } from './arena';

export interface PlayerConfig {
  engine: PlayCanvasGameEngine;
  initialPosition?: pc.Vec3;
  health?: number;
  shield?: number;
  shipModel?: ShipModelType;
}

export interface PlayerControls {
  left: boolean; // 偏航左（A）
  right: boolean; // 偏航右（D）
  up: boolean; // 加速（W）
  down: boolean; // 减速（S）
  boost: boolean; // Space
  fire: boolean; // J
  pitchUp: boolean; // 俯仰抬头（方向键↑）
  pitchDown: boolean; // 俯仰低头（方向键↓）
  rollLeft: boolean; // 滚转左（方向键←）
  rollRight: boolean; // 滚转右（方向键→）
}

export class PlayerShip {
  private engine: PlayCanvasGameEngine;
  private entity: pc.Entity;
  private modelGenerator: ProceduralModelGenerator;
  private shipModelType: ShipModelType;

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

  private boostEnergy: number = 100;
  private maxBoostEnergy: number = 100;
  private boostEnergyConsumptionRate: number = 30;
  private boostEnergyRechargeRate: number = 15;

  private rotationSpeed: number = 3; // 偏航角速度
  private rollSpeed: number = 5; // 滚转角速度
  private pitchSpeed: number = 2.0; // 俯仰角速度
  private autoBankAngle: number = 30; // 自动倾斜角度（偏航时视觉滚转）
  private selfLevelRate: number = 2.0; // 自平衡速率（无输入时回正）
  private pitchSoftLimit: number = 0.85; // 软俯仰限制（forward.y，约 ±58°）

  // 引擎尾焰粒子系统
  private engineTrail: pc.Entity | null = null;
  // boost 状态（供 GameScene 查询触发摄像机反馈）
  private isBoosting: boolean = false;

  private isInvulnerable: boolean = false;
  private invulnerabilityDuration: number = 1000;
  private invulnerabilityEndTime: number = 0;

  // Build 系统修饰符（由 BuildSystem 每帧推送，默认值不改变原始行为）
  private buildMods: PlayerModifiers = {
    maxSpeedMultiplier: 1,
    rotationSpeedMultiplier: 1,
    decelerationMultiplier: 1,
    damageTakenMultiplier: 1,
    maxHealthBonus: 0,
    healOnPickup: 0,
    shieldRechargeRateMultiplier: 1,
    shieldRechargeDelayBonusMs: 0,
    boostEnergyRechargeMultiplier: 1,
    invulnerabilityDurationBonusMs: 0,
    dodgeChance: 0,
    lifestealRatio: 0,
    cooldownMultiplier: 1,
    skillDamageMultiplier: 1,
    dashInvulnerableDurationMs: 0,
    emergencyShield: null,
    thorns: null,
  };
  private prevMaxHealthBonus: number = 0;

  constructor(config: PlayerConfig) {
    this.engine = config.engine;
    this.health = config.health || 100;
    this.maxHealth = this.health;
    this.shield = config.shield || 50;
    this.maxShield = this.shield;
    this.shipModelType = config.shipModel || 'fighter';

    this.modelGenerator = new ProceduralModelGenerator(this.engine.getApp());
    this.entity = this.createPlayerShip(config.initialPosition || new pc.Vec3(0, 0, 0));
  }

  private createPlayerShip(position: pc.Vec3): pc.Entity {
    const player = new pc.Entity('player');
    player.setPosition(position);

    const modelRoot = this.modelGenerator.createShipModel(this.shipModelType, {
      primaryColor: [0.2, 0.5, 0.8],
      secondaryColor: [0.1, 0.3, 0.6],
      emissiveColor: [0.1, 0.2, 0.4],
      scale: 0.8,
    });

    player.addChild(modelRoot);

    // 异步换成真实 GLB 模型（Kenney CC0）。加载期间程序化模型照常显示，
    // 任何失败都保留它作为回落，绝不阻塞开局、绝不抛错。
    this.engine
      .getModelAssets()
      .upgrade(player, modelRoot, ModelAssetProvider.shipPath(this.shipModelType), {
        tint: [0.2, 0.5, 0.8],
        scaleMultiplier: ModelAssetProvider.shipScale(),
        yaw: ModelAssetProvider.shipYaw(),
      });

    // 创建引擎尾焰粒子系统
    this.engineTrail = this.createEngineTrail();
    player.addChild(this.engineTrail);

    this.engine.addToScene(player);
    console.log('[PlayerShip] Player entity added to scene with model:', this.shipModelType);

    return player;
  }

  /**
   * 创建引擎尾焰粒子系统：蓝白色锥形喷射，随速度和 boost 动态变化
   * 使用 PlayCanvas 粒子系统标准 API（参考 WeaponSystem 的 flame 配置）
   */
  private createEngineTrail(): pc.Entity {
    const trail = new pc.Entity('engineTrail');
    // 尾焰位于飞船后方（+Z 方向，因为飞船 forward 是 -Z）
    trail.setLocalPosition(0, 0, 1.2);

    // colorMap：Kenney 火焰形状贴图（白色），颜色仍由下方 colorGraph 染成蓝白。
    // 贴图由引擎开局预加载；未就绪时先用默认白点，就绪后由引擎回填。
    this.engine.addParticleSystem(trail, {
      loop: true,
      autoPlay: true,
      numParticles: 60,
      lifetime: 0.4,
      rate: 30, // 每秒 30 个粒子
      // Engine 2：speed 改名为 initialVelocity
      initialVelocity: 3, // 喷射速度
      // 注：Engine 2 已移除 spread —— 发射方向改由 emitterShape 决定
      //（box 沿本地 Z 轴、sphere 沿半径向外），故此处不再设置
      // Engine 2：colorGraph 直接接受 CurveSet 本体，不再有 { graph } 包装层。
      // 注意必须去掉 Engine 1 遗留的第二个参数 'color' —— CurveSet 只要收到 2 个以上参数，
      // 就会把每个参数各当成一条曲线，结果是曲线数错、取值时直接抛异常。
      colorGraph: new pc.CurveSet([
        [0.6, 0.8, 1.0], // 起始蓝白
        [0.3, 0.5, 1.0], // 过渡蓝色
        [0, 0, 0], // 渐隐透明
      ]),
      // Engine 2：sizeGraph 已更名为 scaleGraph
      scaleGraph: new pc.Curve([0.3, 0.05]), // 尺寸从大到小
      colorMapUrl: PlayCanvasGameEngine.PARTICLE_TEXTURES.engineFlame,
    });

    return trail;
  }

  /**
   * 六自由度旋转控制：俯仰、偏航、滚转，使用 rotateLocal 叠加角速度
   * 包含软俯仰限制（防止翻转）、自动倾斜（偏航时视觉滚转）、自平衡（无输入时回正）
   */
  private updateRotation(controls: PlayerControls, dt: number): void {
    const yawInput = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    const pitchInput = (controls.pitchUp ? 1 : 0) - (controls.pitchDown ? 1 : 0);
    const rollInput = (controls.rollRight ? 1 : 0) - (controls.rollLeft ? 1 : 0);

    const effRot = this.rotationSpeed * this.buildMods.rotationSpeedMultiplier;
    let yawDeg = yawInput * effRot * 180 * dt;
    let pitchDeg = pitchInput * this.pitchSpeed * effRot * 180 * dt;
    let rollDeg = rollInput * this.rollSpeed * 180 * dt;

    // 软俯仰限制：检测 forward.y，超过 ±pitchSoftLimit 时停止同向 pitch（防止翻转）
    const fwd = this.entity.forward;
    if (pitchInput > 0 && fwd.y > this.pitchSoftLimit) pitchDeg = 0;
    if (pitchInput < 0 && fwd.y < -this.pitchSoftLimit) pitchDeg = 0;

    // 自动倾斜：根据偏航输入产生视觉滚转（banking turn）
    rollDeg += yawInput * this.autoBankAngle * dt;

    // 自平衡：无偏航/滚转输入且速度 > 1 时，滚转回水平
    if (yawInput === 0 && rollInput === 0 && this.speed > 1) {
      const right = new pc.Vec3(1, 0, 0);
      this.entity.getRotation().transformVector(right);
      const rollSin = right.y; // 测量当前滚转程度
      rollDeg -= rollSin * this.selfLevelRate * 180 * dt;
    }

    this.entity.rotateLocal(pitchDeg, yawDeg, rollDeg);
  }

  /**
   * 更新引擎尾焰：根据速度和 boost 状态动态调整粒子参数
   * 仅使用 ParticleSystemComponent 运行时可设置的属性（numParticles/lifetime/rate/intensity）
   */
  private updateEngineTrail(finalSpeed: number, isBoosting: boolean): void {
    if (!this.engineTrail?.particlesystem) return;

    const ps = this.engineTrail.particlesystem;
    const speedRatio = Math.min(1, Math.abs(finalSpeed) / (this.maxSpeed * this.boostMultiplier));

    // 速度越快，粒子生命越长（尾焰更持久）、生成率越高（更密集）
    ps.lifetime = 0.3 + speedRatio * 0.4;
    ps.rate = 30 + speedRatio * 60;

    // boost 时尾焰更猛烈（粒子数量翻倍，强度提升）
    if (isBoosting) {
      ps.numParticles = 120;
      ps.rate = 100;
      ps.intensity = 1.5;
    } else {
      ps.numParticles = 60;
      ps.intensity = 1.0;
    }

    ps.reset();
  }

  /**
   * 查询当前是否处于 boost 状态（供 GameScene 触发摄像机 FOV/抖动）
   */
  public isBoostingNow(): boolean {
    return this.isBoosting;
  }

  public update(dt: number, controls: PlayerControls): void {
    const now = Date.now();

    if (this.isInvulnerable && now > this.invulnerabilityEndTime) {
      this.isInvulnerable = false;
    }

    // 应用 Build 修饰符：护盾恢复
    const effectiveShieldDelay = Math.max(
      0,
      this.shieldRechargeDelay + this.buildMods.shieldRechargeDelayBonusMs,
    );
    const effectiveShieldRate =
      this.shieldRechargeRate * this.buildMods.shieldRechargeRateMultiplier;
    if (this.shield < this.maxShield && now - this.lastDamageTime > effectiveShieldDelay) {
      this.shield = Math.min(this.maxShield, this.shield + effectiveShieldRate * dt);
    }

    // 应用 Build 修饰符：速度/加速度
    const effectiveMaxSpeed = this.maxSpeed * this.buildMods.maxSpeedMultiplier;
    const effectiveDecel = this.deceleration * this.buildMods.decelerationMultiplier;
    if (controls.up) {
      this.speed = Math.min(this.speed + this.acceleration * dt, effectiveMaxSpeed);
    } else if (controls.down) {
      this.speed = Math.max(this.speed - this.acceleration * dt, -effectiveMaxSpeed * 0.3);
    } else {
      if (this.speed > 0) {
        this.speed = Math.max(this.speed - effectiveDecel * dt, 0);
      } else {
        this.speed = Math.min(this.speed + effectiveDecel * dt, 0);
      }
    }

    const canBoost = controls.boost && this.speed > 0 && this.boostEnergy > 0;

    if (canBoost) {
      this.boostEnergy = Math.max(0, this.boostEnergy - this.boostEnergyConsumptionRate * dt);
    } else if (!controls.boost && this.boostEnergy < this.maxBoostEnergy) {
      const effectiveBoostRecharge =
        this.boostEnergyRechargeRate * this.buildMods.boostEnergyRechargeMultiplier;
      this.boostEnergy = Math.min(
        this.maxBoostEnergy,
        this.boostEnergy + effectiveBoostRecharge * dt,
      );
    }

    const finalSpeed = canBoost ? this.speed * this.boostMultiplier : this.speed;

    // 更新 boost 状态（供 GameScene 查询触发摄像机 FOV/抖动）
    this.isBoosting = canBoost;

    // 六自由度旋转：俯仰、偏航、滚转（使用 rotateLocal 叠加角速度）
    this.updateRotation(controls, dt);

    if (this.speed !== 0) {
      const forward = this.entity.forward.clone().scale(finalSpeed * dt);
      // Engine 2 的 getPosition() 返回 Readonly<Vec3>，clone() 出一份可写副本再就地钳位
      const currentPos = this.entity.getPosition().clone();
      currentPos.add(forward);

      // 各轴独立盒子钳制。边界值唯一真源是 arena.ts 的 PLAYER_BOUNDS ——
      // 改空间大小时必须同步 ENEMY_BOUNDS / ENEMY_SPAWN / ASTEROID_BELT / BACKDROP，
      // 否则敌机追不出边界、小行星带陷进场地、布景相对位置失真。
      currentPos.x = Math.max(-PLAYER_BOUNDS.x, Math.min(PLAYER_BOUNDS.x, currentPos.x));
      currentPos.y = Math.max(-PLAYER_BOUNDS.y, Math.min(PLAYER_BOUNDS.y, currentPos.y));
      currentPos.z = Math.max(-PLAYER_BOUNDS.z, Math.min(PLAYER_BOUNDS.z, currentPos.z));

      this.entity.setPosition(currentPos);
    }

    // 更新引擎尾焰粒子（随速度和 boost 状态动态调整）
    this.updateEngineTrail(finalSpeed, canBoost);

    // 暴露玩家调试信息到全局变量
    const pos = this.entity.getPosition();
    const rot = this.entity.getEulerAngles();
    (window as any).__playerDebug = {
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { x: rot.x, y: rot.y, z: rot.z },
      speed: this.speed,
      controls: { ...controls },
    };
  }

  public takeDamage(amount: number): boolean {
    if (this.isInvulnerable) {
      return false;
    }

    // 应用 Build 修饰符：闪避概率
    if (this.buildMods.dodgeChance > 0 && Math.random() < this.buildMods.dodgeChance) {
      return false;
    }

    // 应用 Build 修饰符：伤害减免
    let remainingDamage = amount * this.buildMods.damageTakenMultiplier;

    this.lastDamageTime = Date.now();

    if (this.shield > 0) {
      const shieldDamage = Math.min(this.shield, remainingDamage);
      this.shield -= shieldDamage;
      remainingDamage -= shieldDamage;
    }

    if (remainingDamage > 0) {
      this.health -= remainingDamage;
    }

    this.isInvulnerable = true;
    // 应用 Build 修饰符：无敌时间延长
    const effectiveInvulnDuration =
      this.invulnerabilityDuration + this.buildMods.invulnerabilityDurationBonusMs;
    this.invulnerabilityEndTime = Date.now() + effectiveInvulnDuration;

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

  public getBoostEnergy(): number {
    return this.boostEnergy;
  }

  public getMaxBoostEnergy(): number {
    return this.maxBoostEnergy;
  }

  public isBoostActive(): boolean {
    return this.boostEnergy < this.maxBoostEnergy && this.speed > 0;
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

  /**
   * 接收 BuildSystem 推送的修饰符，并处理一次性效果（maxHealthBonus/healOnPickup）
   */
  public setBuildModifiers(mods: PlayerModifiers): void {
    this.buildMods = mods;

    // 处理 maxHealthBonus 增量：新增的血量上限立即生效并回复等量生命
    const healthBonusDelta = mods.maxHealthBonus - this.prevMaxHealthBonus;
    if (healthBonusDelta > 0) {
      this.maxHealth += healthBonusDelta;
      this.health = Math.min(this.maxHealth, this.health + healthBonusDelta + mods.healOnPickup);
    }
    this.prevMaxHealthBonus = mods.maxHealthBonus;
  }

  /**
   * 吸血钩子：由 WeaponSystem.checkCollisions 在造成伤害时调用
   */
  public healFromDamage(damageDealt: number): void {
    if (this.buildMods.lifestealRatio > 0 && this.health < this.maxHealth) {
      const healAmount = damageDealt * this.buildMods.lifestealRatio;
      this.health = Math.min(this.maxHealth, this.health + healAmount);
    }
  }

  public getLifestealRatio(): number {
    return this.buildMods.lifestealRatio;
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
