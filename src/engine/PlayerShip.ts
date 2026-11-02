import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { ProceduralModelGenerator, ShipModelType } from './ProceduralModelGenerator';
import { ModelAssetProvider } from './ModelAssetProvider';
import type { PlayerModifiers } from './BuildSystem';
import { PLAYER_BOUNDS } from './arena';
import { PhysicsKernel } from './PhysicsKernel';
import { MeshTearingSystem } from './MeshTearingSystem';
import { WebGPUDamageSystem } from './WebGPUDamageSystem';
import { useGameStore } from '../store/useGameStore';

export interface PlayerConfig {
  engine: PlayCanvasGameEngine;
  initialPosition?: pc.Vec3;
  health?: number;
  shield?: number;
  shipModel?: ShipModelType;
  /**
   * 舰体主色（RGB 0-1）。来自元进度的涂装（已购 `cosmetic` 物品）；
   * 不传 = 用本类自己的默认色。**默认色只在这里定义**，避免两处各写一份。
   */
  tint?: [number, number, number];
}

/** 舰体默认主色（渲染侧唯一真源）。 */
const DEFAULT_HULL_TINT: [number, number, number] = [0.2, 0.5, 0.8];

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
  interact: boolean; // 交互（F）
}

export class PlayerShip {
  private engine: PlayCanvasGameEngine;
  private entity: pc.Entity;
  private modelGenerator: ProceduralModelGenerator;
  private shipModelType: ShipModelType;
  /** 舰体主色：程序化模型与 GLB tint 共用它，保证涂装两条渲染路径一致。 */
  private hullTint: [number, number, number] = DEFAULT_HULL_TINT;

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

  private rotationSpeed: number = 3; // 偏航角速度（度/秒 = ×180）
  private rollSpeed: number = 5; // 滚转角速度（度/秒 = ×180）
  private pitchSpeed: number = 2.0; // 俯仰角速度（度/秒 = ×180）
  private autoBankAngle: number = 30; // 自动倾斜角度（偏航时视觉滚转）
  private selfLevelRate: number = 2.0; // 自平衡速率（无输入时回正）
  private pitchSoftLimit: number = 0.85; // 软俯仰限制（forward.y，约 ±58°）

  /**
   * 角速度惯性 —— **操作手感的核心参数，调手感只动这两个数**。
   *
   * 为什么需要它：原先三个轴都是 `输入 × 角速度 × dt` 直接交给 `rotateLocal`，
   * 也就是"按下瞬间满速、松手瞬间归零"的开关式旋转。键盘本身是 0/1 输入，
   * 于是飞船像被鼠标拖着的方块：起步是一个硬拐点、松手立刻停死、想微调几乎不可能。
   * 中间加一层一阶惯性（指数逼近）后，按键有很短的爬升、松键有很短的滑行，
   * 而**稳态角速度不变** —— 所以空气动力学没变、物理平衡没变，改的只是过渡曲线。
   *
   * `rise`：按键时角速度逼近目标值的速率（1/s）。越大越"跟手"，越小越"沉"。
   * `fall`：松键时角速度回落的速率（1/s）。越小松开后滑行越远、越"飘"。
   * 参考：rise=24 时约 3 帧到六成、130ms 基本到位（60fps），属于"几乎察觉不到延迟但有重量"。
   */
  private readonly angularSmoothing = { rise: 24, fall: 13 };

  /** 三轴当前角速度（度/秒）。由 `angularSmoothing` 逼近目标值，取代原先的直接赋值。 */
  private angularVelocity = { yaw: 0, pitch: 0, roll: 0 };

  /**
   * boost 过渡（0→1）。原先 `canBoost` 一为真速度立刻 ×2.5，是个硬台阶，
   * 起步那一下会把画面"顶"一下。这里只把**倍数**做成渐变：
   * 最大速度、能量消耗速率、`canBoost` 的判定条件全部不变，只是倍率不再瞬跳。
   */
  private boostBlend: number = 0;
  private latestControls: PlayerControls | null = null;

  // 引擎尾焰粒子系统
  private engineTrail: pc.Entity | null = null;
  // boost 状态（供 GameScene 查询触发摄像机反馈）
  private isBoosting: boolean = false;

  private isInvulnerable: boolean = false;
  private invulnerabilityDuration: number = 1000;
  private invulnerabilityEndTime: number = 0;

  private isOverdriveActive: boolean = false;
  private overdriveSpeedMult: number = 1;

  /**
   * 本局累计受到的伤害（护盾 + 生命实际被扣掉的量）。
   * 供成就「不死之身（无伤通关）」在关卡结算时判定 —— 见 `takeDamage`。
   */
  private damageTaken: number = 0;

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
  private physicsKernel: PhysicsKernel;
  private damageSystem: WebGPUDamageSystem | null = null;
  private meshTearing: MeshTearingSystem | null = null;
  private externalForces: pc.Vec3[] = [];

  constructor(config: PlayerConfig) {
    this.engine = config.engine;
    this.health = config.health || 100;
    this.maxHealth = this.health;
    this.shield = config.shield || 50;
    this.maxShield = this.shield;
    this.shipModelType = config.shipModel || 'fighter';
    if (config.tint) this.hullTint = config.tint;

    this.physicsKernel = new PhysicsKernel(1000); // 飞船质量 1000kg

    // 获取 WebGPU 损毁系统插件
    this.damageSystem = this.engine.getPlugin('WebGPUDamageSystem');
    if (this.damageSystem) {
      this.meshTearing = new MeshTearingSystem(this.engine.getApp(), this.damageSystem);
    }

    this.modelGenerator = new ProceduralModelGenerator();
    this.entity = this.createPlayerShip(config.initialPosition || new pc.Vec3(0, 0, 0));
  }

  /** 当前舰体主色（验证脚本用；涂装是元进度里唯一可见的外观差异）。 */
  public getHullTint(): [number, number, number] {
    return [this.hullTint[0], this.hullTint[1], this.hullTint[2]];
  }

  /**
   * 实际使用的舰体类型（**渲染侧真值**，不是 UI 里选中的那个值）。
   *
   * 存在的意义：`config.shipModel` 长期无人传入、永远回落 `'fighter'`，
   * 而「机库选了 bomber」到「模型真的换了」之间隔着一次 GLB 异步替换。
   * 验证脚本要断言后者，就必须能读到这一份 —— 读 UI 的选中值证明不了任何事。
   */
  public getShipModelType(): ShipModelType {
    return this.shipModelType;
  }

  private createPlayerShip(position: pc.Vec3): pc.Entity {
    const player = new pc.Entity('player');
    player.setPosition(position);

    const modelRoot = this.modelGenerator.createShipModel(this.shipModelType, {
      primaryColor: this.hullTint,
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
        tint: this.hullTint,
        scaleMultiplier: ModelAssetProvider.shipScale(),
        yaw: ModelAssetProvider.shipYaw(),
        onReplaced: (instance) => {
          // 叠上真 PBR 材质（金属），配合 faction tint 着色
          this.engine.applyPbrMaterialWhenReady(instance, 'metal', this.hullTint);

          // 2026 Tech: 应用网格撕裂着色器
          if (this.meshTearing) {
            this.meshTearing.applyToEntity(player);
          }
        },
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
   * 2026 Tech: 获取控制扭矩。
   * 将玩家按键输入转化为物理扭矩。
   */
  private getControlTorques(controls: PlayerControls): pc.Vec3 {
    const yawInput = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    const pitchInput = (controls.pitchUp ? 1 : 0) - (controls.pitchDown ? 1 : 0);
    const rollInput = (controls.rollRight ? 1 : 0) - (controls.rollLeft ? 1 : 0);

    const effRot = this.rotationSpeed * this.buildMods.rotationSpeedMultiplier * 1000;
    const effPitch = this.pitchSpeed * 1000 * this.buildMods.rotationSpeedMultiplier;
    const effRoll = this.rollSpeed * 1000;

    let torqueYaw = yawInput * effRot;
    let torquePitch = pitchInput * effPitch;
    let torqueRoll = rollInput * effRoll;

    // 自动倾斜扭矩
    torqueRoll += yawInput * this.autoBankAngle * 10;

    // 自平衡扭矩
    if (yawInput === 0 && rollInput === 0 && this.speed > 1) {
      const right = new pc.Vec3(1, 0, 0);
      this.entity.getRotation().transformVector(right);
      const rollSin = right.y;
      torqueRoll += -rollSin * this.selfLevelRate * 500;
    }

    return new pc.Vec3(torquePitch, torqueYaw, torqueRoll);
  }

  /**
   * 2026 Tech: 应用物理驱动的旋转。
   */
  private applyRotation(angVel: pc.Vec3, dt: number): void {
    // 将角速度应用到实体
    this.entity.rotateLocal(angVel.x * dt, angVel.y * dt, angVel.z * dt);

    // 同步视觉状态 (用于尾焰等)
    this.angularVelocity.pitch = angVel.x;
    this.angularVelocity.yaw = angVel.y;
    this.angularVelocity.roll = angVel.z;
  }

  /**
   * 更新引擎尾焰：根据速度和 boost 状态动态调整粒子参数
   * 仅使用 ParticleSystemComponent 运行时可设置的属性（numParticles/lifetime/rate/intensity）
   */
  private updateEngineTrail(finalSpeed: number, isBoosting: boolean): void {
    if (!this.engineTrail?.particlesystem) return;

    const ps = this.engineTrail.particlesystem;
    const speedRatio = Math.min(
      1,
      Math.abs(finalSpeed) / (this.maxSpeed * this.boostMultiplier * this.overdriveSpeedMult),
    );

    // 速度越快，粒子生命越长（尾焰更持久）、生成率越高（更密集）
    ps.lifetime = 0.3 + speedRatio * 0.4;
    ps.rate = 30 + speedRatio * 60;

    // Overdrive 状态下：紫色尾焰，粒子数量和生成率进一步提升
    if (this.isOverdriveActive) {
      ps.colorGraph = new pc.CurveSet([
        [0.8, 0.2, 1.0], // 起始紫色
        [0.4, 0.1, 0.6], // 过渡深紫
        [0, 0, 0], // 渐隐透明
      ]);
      ps.numParticles = isBoosting ? 200 : 120;
      ps.rate = isBoosting ? 150 : 80;
      ps.intensity = isBoosting ? 2.0 : 1.5;
    } else {
      // 恢复蓝色尾焰
      ps.colorGraph = new pc.CurveSet([
        [0.6, 0.8, 1.0], // 起始蓝白
        [0.3, 0.5, 1.0], // 过渡蓝色
        [0, 0, 0], // 渐隐透明
      ]);

      // boost 时尾焰更猛烈（粒子数量翻倍，强度提升）
      if (isBoosting) {
        ps.numParticles = 120;
        ps.rate = 100;
        ps.intensity = 1.5;
      } else {
        ps.numParticles = 60;
        ps.intensity = 1.0;
      }
    }

    ps.reset();
  }

  /**
   * 查询当前是否处于 boost 状态（供 GameScene 触发摄像机 FOV/抖动）
   */
  public isBoostingNow(): boolean {
    return this.isBoosting;
  }

  /**
   * 应用外部力场（引力井、EMP 冲击等）。
   * 2026 Tech: 对接到 PhysicsKernel 实现真实的加速度偏移。
   */
  public applyExternalForce(force: pc.Vec3): void {
    this.externalForces.push(force.clone());
  }

  public update(dt: number, controls: PlayerControls): void {
    this.latestControls = controls;
    const sectorManager = (this.engine.getApp() as any)['sectorManager'];
    const inNebula = sectorManager?.isInNebula() || false;

    // 2026 Tech: 星云环境影响 (Tactical Volumetric Nebula)
    // 1. 推进器过热：能量消耗增加
    // 2. 制动失效：阻力减小，惯性增加
    const nebulaHeatMult = inNebula ? 2.5 : 1.0;
    const nebulaDecelMult = inNebula ? 0.3 : 1.0;
    const nebulaMaxSpeedMult = inNebula ? 0.8 : 1.0; // 阻力导致最高速度下降

    if (import.meta.env.DEV && (controls.up || controls.down || controls.left || controls.right)) {
      console.log('[PlayerShip] Movement input detected:', controls);
    }
    const now = Date.now();

    if (this.isInvulnerable && now > this.invulnerabilityEndTime) {
      this.isInvulnerable = false;
    }

    // 应用 Build 修饰符：护盾恢复
    const effectiveShieldDelay = Math.max(
      0,
      this.shieldRechargeDelay + this.buildMods.shieldRechargeDelayBonusMs,
    );

    // 2026 Tech: 应用全局增益 (护盾恢复)
    const globalModifiers = useGameStore.getState().globalModifiers || [];
    const shieldRegenMod = globalModifiers.find((m) => m.type === 'shield_regen')?.value || 1.0;

    const effectiveShieldRate =
      this.shieldRechargeRate * this.buildMods.shieldRechargeRateMultiplier * shieldRegenMod;
    if (this.shield < this.maxShield && now - this.lastDamageTime > effectiveShieldDelay) {
      this.shield = Math.min(this.maxShield, this.shield + effectiveShieldRate * dt);
    }

    // 应用 Build 修饰符与 Overdrive：速度/加速度
    const speedMod = globalModifiers.find((m) => m.type === 'speed')?.value || 1.0;
    const overdriveMult = this.isOverdriveActive ? this.overdriveSpeedMult : 1;
    const effectiveMaxSpeed =
      this.maxSpeed *
      this.buildMods.maxSpeedMultiplier *
      overdriveMult *
      nebulaMaxSpeedMult *
      speedMod;
    const effectiveAccel = this.acceleration * overdriveMult;
    const effectiveDecel =
      this.deceleration * this.buildMods.decelerationMultiplier * nebulaDecelMult;

    if (controls.up) {
      this.speed = Math.min(this.speed + effectiveAccel * dt, effectiveMaxSpeed);
    } else if (controls.down) {
      this.speed = Math.max(this.speed - effectiveAccel * dt, -effectiveMaxSpeed * 0.3);
    } else {
      if (this.speed > 0) {
        this.speed = Math.max(this.speed - effectiveDecel * dt, 0);
      } else {
        this.speed = Math.min(this.speed + effectiveDecel * dt, 0);
      }
    }

    const canBoost = controls.boost && this.speed > 0 && this.boostEnergy > 0;

    if (canBoost) {
      this.boostEnergy = Math.max(
        0,
        this.boostEnergy - this.boostEnergyConsumptionRate * dt * nebulaHeatMult,
      );
    } else if (!controls.boost && this.boostEnergy < this.maxBoostEnergy) {
      // 2026 Tech: 应用全局增益 (如戴森云提供的能量恢复加成)
      const energyRegenMod = globalModifiers.find((m) => m.type === 'energy_regen')?.value || 1.0;

      const effectiveBoostRecharge =
        this.boostEnergyRechargeRate *
        this.buildMods.boostEnergyRechargeMultiplier *
        overdriveMult *
        energyRegenMod;
      this.boostEnergy = Math.min(
        this.maxBoostEnergy,
        this.boostEnergy + effectiveBoostRecharge * dt,
      );
    }

    // boost 倍率渐入/渐出：原先 `canBoost` 一为真就整体 ×2.5，起步那一下会把画面顶一下。
    // 这里只把**倍率**做成渐变（最大速度、能量消耗、canBoost 判定都不变）。
    // 步长与旋转同样钳到 100ms，掉帧时不会一帧到位（否则这个渐变只在 60fps 下存在）。
    const blendDt = Math.min(dt, 0.1);
    this.boostBlend += ((canBoost ? 1 : 0) - this.boostBlend) * (1 - Math.exp(-8 * blendDt));
    const finalSpeed = this.speed * (1 + (this.boostMultiplier - 1) * this.boostBlend);

    // 更新 boost 状态（供 GameScene 查询触发摄像机 FOV/抖动）
    this.isBoosting = canBoost;

    // 2026 Tech: 物理内核处理外部力场与质心扭矩
    if (this.damageSystem) {
      const com = this.damageSystem.calculateCenterOfMass();
      this.physicsKernel.setCenterOfMass(com);

      // 2026 Tech: 几何形变视觉反馈 (Geometric Distortion)
      this.updateDamageVisuals();

      // 2026 Tech: 更新网格撕裂着色器参数
      if (this.meshTearing) {
        this.meshTearing.update(this.entity);
      }
    }

    // 1. 获取控制扭矩 (由用户输入产生)
    const controlTorques = this.getControlTorques(controls);

    // 2. 获取推进力 (主引擎推力)
    const physicsForces = this.externalForces.map((f) => ({
      force: f,
      position: new pc.Vec3(0, 0, 0), // 外部力场默认作用于中心
    }));

    if (this.speed !== 0) {
      // 推进力作用于飞船尾部。如果 CoM 偏移，这会产生真实的偏转力矩。
      const thrustForce = this.entity.forward
        .clone()
        .scale(this.acceleration * this.physicsKernel.getMass() * (this.speed > 0 ? 1 : -0.5));
      physicsForces.push({
        force: thrustForce,
        position: new pc.Vec3(0, 0, 1.2), // Kenney 飞船尾部位置
      });
    }

    // 3. 步进物理内核
    this.physicsKernel.step(dt, physicsForces, [controlTorques]);
    this.externalForces = []; // 清空累加力

    const physicsVel = this.physicsKernel.getVelocity();
    const physicsAngVel = this.physicsKernel.getAngularVelocity();

    // 4. 应用物理旋转与控制旋转
    this.applyRotation(physicsAngVel, dt);

    if (this.speed !== 0 || physicsVel.length() > 0.01) {
      const forward = this.entity.forward.clone().scale(finalSpeed * dt);
      // Engine 2 的 getPosition() 返回 Readonly<Vec3>，clone() 出一份可写副本再就地钳位
      const currentPos = this.entity.getPosition().clone();

      // 叠加基础移动与物理偏移
      currentPos.add(forward);
      currentPos.add(physicsVel.clone().scale(dt));

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

    // 暴露玩家调试信息到全局变量。
    const pos = this.entity.getPosition();
    const rot = this.entity.getEulerAngles();

    (window as any)['_playerDebug'] = {
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { x: rot.x, y: rot.y, z: rot.z },
      speed: this.speed,
      finalSpeed,
      angularVelocity: { ...this.angularVelocity },
      boostBlend: this.boostBlend,
      isBoosting: canBoost,
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

    // 成就「不死之身（无伤通关）」的真值来源。
    // 这是全项目**唯一**的受伤入口（`Enemy` 撞击 / `AsteroidSystem` 碰撞 / 敌弹都走这里），
    // 且只统计真正被扣掉的量 —— 无敌帧与闪避在上面的提前返回里已经排除掉了。
    this.damageTaken += remainingDamage;

    this.lastDamageTime = Date.now();

    if (this.shield > 0) {
      const shieldDamage = Math.min(this.shield, remainingDamage);
      this.shield -= shieldDamage;
      remainingDamage -= shieldDamage;
    }

    if (remainingDamage > 0) {
      this.health -= remainingDamage;
    }

    // 2026 WebGPU: 触发物理损毁计算
    if (this.damageSystem) {
      // 模拟局部碰撞点：在飞船中心周围随机选择一个点
      const localHitPos = new pc.Vec3(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 4,
      );
      this.damageSystem.applyDamage(localHitPos, new pc.Vec3(0, 0, 1).scale(amount));
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

  /** 本局累计受到的伤害（护盾 + 生命实际被扣掉的总量）。 */
  public getDamageTaken(): number {
    return this.damageTaken;
  }

  /** 清空受伤记录（关卡开始时调用，成就按「本关是否受击」判定）。 */
  public resetDamageTaken(): void {
    this.damageTaken = 0;
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

  public getLatestControls(): PlayerControls | null {
    return this.latestControls;
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
   * 设置加速能量上限（元进度的「能量强化模块」走这条）。
   * 当前能量按新上限夹取，避免缩小时越界。
   */
  public setMaxBoostEnergy(maxBoostEnergy: number): void {
    if (!Number.isFinite(maxBoostEnergy) || maxBoostEnergy <= 0) return;
    this.maxBoostEnergy = maxBoostEnergy;
    this.boostEnergy = Math.min(this.boostEnergy, maxBoostEnergy);
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

  public setOverdrive(active: boolean, speedMult: number): void {
    this.isOverdriveActive = active;
    this.overdriveSpeedMult = speedMult;
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

  /**
   * 2026 Tech: 几何形变与损毁视觉反馈。
   * 基于 WebGPU 损毁数据动态调整模型状态。
   */
  private updateDamageVisuals(): void {
    if (!this.damageSystem || !this.entity.model) return;

    const healthRatio = this.health / this.maxHealth;
    if (healthRatio > 0.95) return;

    // 1. 整体模型抖动 (模拟结构不稳定)
    const jitter = (1.0 - healthRatio) * 0.05;
    const modelRoot = this.entity.children[0]; // 假设第一个子节点是模型根
    if (modelRoot) {
      modelRoot.setLocalPosition(
        (Math.random() - 0.5) * jitter,
        (Math.random() - 0.5) * jitter,
        (Math.random() - 0.5) * jitter,
      );
    }

    // 2. 局部发红 (模拟热损伤/漏电)
    this.entity.model.meshInstances?.forEach((mi) => {
      if (mi.material instanceof pc.StandardMaterial) {
        const mat = mi.material;
        const damageColor = new pc.Color(1, 0.2, 0);
        const intensity = (1.0 - healthRatio) * 0.5;

        mat.emissive.lerp(mat.emissive, damageColor, 0.1);
        mat.emissiveIntensity = 1.0 + intensity * 5;
        mat.update();
      }
    });

    // 3. 2026 Tech: 关键组件失效烟雾
    if (!this.damageSystem.isComponentFunctional('ENGINE')) {
      this.createDamageSmoke('engine_smoke', new pc.Vec3(0, 0, 1.2));
    }
    if (!this.damageSystem.isComponentFunctional('WEAPON_L')) {
      this.createDamageSmoke('weapon_l_smoke', new pc.Vec3(-1, 0, -1));
    }
    if (!this.damageSystem.isComponentFunctional('WEAPON_R')) {
      this.createDamageSmoke('weapon_r_smoke', new pc.Vec3(1, 0, -1));
    }
  }

  private createDamageSmoke(name: string, localPos: pc.Vec3): void {
    if (this.entity.findByName(name)) return;

    const smoke = new pc.Entity(name);
    smoke.setLocalPosition(localPos);
    this.engine.addParticleSystem(smoke, {
      numParticles: 30,
      lifetime: 1.0,
      rate: 10,
      initialVelocity: 2,
      colorGraph: new pc.CurveSet([
        [0.2, 0.2, 0.2],
        [0.1, 0.1, 0.1],
        [0, 0, 0],
      ]),
      scaleGraph: new pc.Curve([0.1, 0.5]),
      colorMapUrl: PlayCanvasGameEngine.PARTICLE_TEXTURES.engineFlame,
    });
    this.entity.addChild(smoke);
  }
}
