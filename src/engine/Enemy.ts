import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { EnemyAI, EnemyAIFactory, AIState, StatusEffect } from './EnemyAI';
import { attachLuaBrain, getEnemyAIMode } from './LuaEnemyAIBridge';
import { ProceduralModelGenerator, EnemyModelType } from './ProceduralModelGenerator';
import { ModelAssetProvider } from './ModelAssetProvider';
import { WebGPUDamageSystem } from './WebGPUDamageSystem';
import { MeshTearingSystem } from './MeshTearingSystem';
import { useGameStore } from '../store/useGameStore';

export enum EnemyType {
  SCOUT = 'scout',
  FIGHTER = 'fighter',
  BOMBER = 'bomber',
  TANK = 'tank',
  ASSASSIN = 'assassin',
  DRONE = 'drone',
  ELITE = 'elite',
  CORVETTE = 'corvette',
  DESTROYER = 'destroyer',
  BOSS_SENTINEL = 'boss_sentinel',
  BOSS_OVERLORD = 'boss_overlord',
  BOSS = 'boss',
  VOID_LORD = 'void_lord',
  ASSAULT = 'assault',
  SNIPER = 'sniper',
  SWARM = 'swarm',
  STATIC_OUTPOST = 'static_outpost',
  CRUISER = 'cruiser',
}

export enum CapitalShipPhase {
  PHASE_1 = 'standard',
  PHASE_2 = 'defensive',
  PHASE_3 = 'berserk',
}

export interface EnemyConfig {
  engine: PlayCanvasGameEngine;
  type: EnemyType;
  position: pc.Vec3;
  player: PlayerShip;
  /** 难度倍率（由难度自适应系统提供，缩放生命/速度/伤害），默认 1.0 */
  difficultyMultiplier?: number;
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

export interface CapitalShipPart {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  entity: pc.Entity;
  type: 'turret' | 'engine' | 'bridge' | 'hull' | 'reactor' | 'hangar';
  isDestroyed: boolean;
  // Turret specific
  lastShootTime?: number;
  shootInterval?: number;
  weaponType?: 'cannon' | 'missile' | 'laser' | 'heavy_beam';
  target?: pc.Entity | PlayerShip;
  rotationSpeed?: number;
}

export class EnemyProjectile {
  public entity: pc.Entity;
  public damage: number;
  public velocity: pc.Vec3;
  public active: boolean = true;
  public lifetime: number = 5;

  constructor(entity: pc.Entity, damage: number, velocity: pc.Vec3) {
    this.entity = entity;
    this.damage = damage;
    this.velocity = velocity;
  }

  public update(dt: number): void {
    const pos = this.entity.getPosition();
    pos.add(this.velocity.clone().mulScalar(dt));
    this.entity.setPosition(pos);
    this.lifetime -= dt;
    if (this.lifetime <= 0) this.active = false;
  }
}

export class Enemy {
  protected engine: PlayCanvasGameEngine;
  protected entity: pc.Entity;
  protected type: EnemyType;
  protected stats: EnemyStats;
  protected player: PlayerShip;
  protected ai: EnemyAI;
  protected modelGenerator: ProceduralModelGenerator;
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
    // 应用难度倍率：生命/伤害按倍率缩放，速度仅轻微缩放（避免过快/过慢破坏体验）
    const m =
      config.difficultyMultiplier && config.difficultyMultiplier > 0
        ? config.difficultyMultiplier
        : 1.0;
    const scaledHealth = Math.round(stats.health * m);
    const scaledDamage = Math.round(stats.damage * m);
    // 速度倍率压缩到 0.85 - 1.15 区间，避免极端值
    const speedScale = Math.max(0.85, Math.min(1.15, 1 + (m - 1) * 0.4));
    const scaledSpeed = stats.speed * speedScale;
    this.stats = {
      ...stats,
      health: scaledHealth,
      maxHealth: scaledHealth,
      damage: scaledDamage,
      speed: scaledSpeed,
    };
    this.health = scaledHealth;
    this.maxHealth = scaledHealth;
    this.speed = scaledSpeed;
    this.damage = scaledDamage;
    this.attackCooldown = stats.attackCooldown;
    this.lastAttackTime = 0;

    this.modelGenerator = new ProceduralModelGenerator();
    this.entity = this.createEnemy(config.position);
    this.ai = EnemyAIFactory.createAI(config.type, this.entity, config.player, config.position);
    // 同步 AI attackRadius 与 Enemy attackRange，确保 ATTACK 状态下能触发攻击
    // （FighterAI 被多种敌人复用，attackRange 各不相同，必须按实际 stats 同步）
    this.ai.syncAttackRange(this.stats.attackRange);

    // 敌机 AI 后端：默认 ts（原生行为）。?ai=lua / __aiDebug.setMode('lua') 时把 Lua 大脑
    // 挂上去接管行为；挂不上（Lua 未就绪 / 生成失败）就保持上面的原生 TS 行为。
    if (getEnemyAIMode() === 'lua') {
      attachLuaBrain(
        this.ai,
        this.entity,
        config.player,
        config.type,
        config.position,
        this.health,
        this.maxHealth,
      );
    }
  }

  private getStatsForType(type: EnemyType): EnemyStats {
    switch (type) {
      case EnemyType.SCOUT:
        return {
          health: 20,
          maxHealth: 20,
          speed: 8,
          damage: 10,
          attackCooldown: 2000,
          attackRange: 2,
          armor: 0,
        };
      case EnemyType.FIGHTER:
        return {
          health: 40,
          maxHealth: 40,
          speed: 5,
          damage: 15,
          attackCooldown: 1500,
          attackRange: 3,
          armor: 5,
        };
      case EnemyType.BOMBER:
        return {
          health: 60,
          maxHealth: 60,
          speed: 3,
          damage: 30,
          attackCooldown: 2500,
          attackRange: 4,
          armor: 10,
        };
      case EnemyType.TANK:
        return {
          health: 100,
          maxHealth: 100,
          speed: 2,
          damage: 25,
          attackCooldown: 3000,
          attackRange: 4,
          armor: 20,
        };
      case EnemyType.ASSASSIN:
        return {
          health: 35,
          maxHealth: 35,
          speed: 10,
          damage: 35,
          attackCooldown: 1800,
          attackRange: 2,
          armor: 3,
        };
      case EnemyType.DRONE:
        return {
          health: 15,
          maxHealth: 15,
          speed: 7,
          damage: 8,
          attackCooldown: 1200,
          attackRange: 2.5,
          armor: 0,
        };
      case EnemyType.ELITE:
        return {
          health: 60,
          maxHealth: 60,
          speed: 6,
          damage: 20,
          attackCooldown: 1200,
          attackRange: 5,
          armor: 10,
        };
      case EnemyType.CORVETTE:
        return {
          health: 80,
          maxHealth: 80,
          speed: 4,
          damage: 22,
          attackCooldown: 2000,
          attackRange: 5,
          armor: 15,
        };
      case EnemyType.DESTROYER:
        return {
          health: 150,
          maxHealth: 150,
          speed: 2.5,
          damage: 35,
          attackCooldown: 2800,
          attackRange: 6,
          armor: 25,
        };
      case EnemyType.BOSS_SENTINEL:
        return {
          health: 300,
          maxHealth: 300,
          speed: 2,
          damage: 40,
          attackCooldown: 1500,
          attackRange: 7,
          armor: 25,
        };
      case EnemyType.BOSS_OVERLORD:
        return {
          health: 500,
          maxHealth: 500,
          speed: 1.5,
          damage: 50,
          attackCooldown: 1200,
          attackRange: 8,
          armor: 35,
        };
      case EnemyType.BOSS:
        return {
          health: 300,
          maxHealth: 300,
          speed: 3,
          damage: 40,
          attackCooldown: 2000,
          attackRange: 6,
          armor: 30,
        };
      case EnemyType.ASSAULT:
        return {
          health: 50,
          maxHealth: 50,
          speed: 6,
          damage: 18,
          attackCooldown: 1200,
          attackRange: 3.5,
          armor: 8,
        };
      case EnemyType.SNIPER:
        return {
          health: 30,
          maxHealth: 30,
          speed: 4,
          damage: 45,
          attackCooldown: 3500,
          attackRange: 12,
          armor: 2,
        };
      case EnemyType.SWARM:
        return {
          health: 12,
          maxHealth: 12,
          speed: 9,
          damage: 6,
          attackCooldown: 800,
          attackRange: 2,
          armor: 0,
        };
      case EnemyType.STATIC_OUTPOST:
        return {
          health: 500,
          maxHealth: 500,
          speed: 0,
          damage: 0,
          attackCooldown: 99999,
          attackRange: 0,
          armor: 30,
        };
      case EnemyType.CRUISER:
        return {
          health: 2000,
          maxHealth: 2000,
          speed: 1.2,
          damage: 60,
          attackCooldown: 1000,
          attackRange: 15,
          armor: 50,
        };
      case EnemyType.VOID_LORD:
        return {
          health: 10000,
          maxHealth: 10000,
          speed: 1.0,
          damage: 100,
          attackCooldown: 3000,
          attackRange: 25,
          armor: 80,
        };
      default:
        return {
          health: 30,
          maxHealth: 30,
          speed: 5,
          damage: 12,
          attackCooldown: 2000,
          attackRange: 3,
          armor: 5,
        };
    }
  }

  private createEnemy(position: pc.Vec3): pc.Entity {
    const enemy = new pc.Entity('enemy');
    enemy.setPosition(position);

    const modelType = this.getModelTypeForEnemy();
    const modelOptions = this.getModelOptionsForEnemy();
    const modelRoot = this.modelGenerator.createEnemyModel(modelType, modelOptions);
    enemy.addChild(modelRoot);

    // 异步换成真实 GLB 模型。敌人数量多，每个实例共用同一份已加载的容器资产；
    // 加载失败时保留程序化模型，波次照常进行。
    const isBoss = modelType.startsWith('boss');
    this.engine
      .getModelAssets()
      .upgrade(enemy, modelRoot, ModelAssetProvider.enemyPath(modelType), {
        tint: modelOptions.primaryColor,
        scaleMultiplier: isBoss ? ModelAssetProvider.bossScale() : ModelAssetProvider.enemyScale(),
        yaw: isBoss ? ModelAssetProvider.bossYaw() : ModelAssetProvider.enemyYaw(),
        onReplaced: (instance) => {
          // 叠上真 PBR 材质。重型单位用金属板（更多划痕/凹凸），轻型用纯金属。
          const pbrSet =
            this.type === EnemyType.TANK ||
            this.type === EnemyType.DESTROYER ||
            this.type === EnemyType.CORVETTE ||
            isBoss
              ? 'metalPlates'
              : 'metal';
          this.engine.applyPbrMaterialWhenReady(instance, pbrSet, modelOptions.primaryColor);
        },
      });

    this.engine.addToScene(enemy);

    return enemy;
  }

  private getModelTypeForEnemy(): EnemyModelType {
    switch (this.type) {
      case EnemyType.SCOUT:
        return 'scout';
      case EnemyType.FIGHTER:
        return 'fighter';
      case EnemyType.BOMBER:
        return 'bomber';
      case EnemyType.TANK:
        return 'tank';
      case EnemyType.ASSASSIN:
        return 'assassin';
      case EnemyType.DRONE:
        return 'drone';
      case EnemyType.ELITE:
        return 'fighter';
      case EnemyType.CORVETTE:
        return 'corvette';
      case EnemyType.DESTROYER:
        return 'destroyer';
      case EnemyType.BOSS_SENTINEL:
        return 'boss_sentinel';
      case EnemyType.BOSS_OVERLORD:
        return 'boss_overlord';
      case EnemyType.BOSS:
        return 'boss_sentinel';
      case EnemyType.ASSAULT:
        return 'fighter';
      case EnemyType.SNIPER:
        return 'scout';
      case EnemyType.SWARM:
        return 'drone';
      case EnemyType.STATIC_OUTPOST:
        return 'boss_overlord'; // 使用大型模型替代
      case EnemyType.CRUISER:
        return 'cruiser';
      case EnemyType.VOID_LORD:
        return 'boss_overlord'; // 基础模型，后续通过 MeshTearing 变形
      default:
        return 'fighter';
    }
  }

  private getModelOptionsForEnemy(): {
    primaryColor?: [number, number, number];
    emissiveColor?: [number, number, number];
    scale?: number;
  } {
    switch (this.type) {
      case EnemyType.SCOUT:
        return { primaryColor: [0.4, 0.8, 0.4], emissiveColor: [0.1, 0.3, 0.1], scale: 0.8 };
      case EnemyType.FIGHTER:
        return { primaryColor: [0.8, 0.5, 0.2], emissiveColor: [0.2, 0.1, 0], scale: 1 };
      case EnemyType.BOMBER:
        return { primaryColor: [0.5, 0.3, 0.1], emissiveColor: [0.1, 0.05, 0], scale: 1.2 };
      case EnemyType.TANK:
        return { primaryColor: [0.4, 0.4, 0.45], emissiveColor: [0.05, 0.05, 0.05], scale: 1.5 };
      case EnemyType.ASSASSIN:
        return { primaryColor: [0.6, 0.3, 1.0], emissiveColor: [0.3, 0.1, 0.5], scale: 0.9 };
      case EnemyType.DRONE:
        return { primaryColor: [0.3, 0.3, 0.35], emissiveColor: [0.1, 0.1, 0.15], scale: 0.6 };
      case EnemyType.ELITE:
        return { primaryColor: [0.6, 0.3, 1.0], emissiveColor: [0.3, 0.1, 0.5], scale: 1.1 };
      case EnemyType.CORVETTE:
        return { primaryColor: [0.3, 0.4, 0.5], emissiveColor: [0.05, 0.1, 0.15], scale: 1.3 };
      case EnemyType.DESTROYER:
        return { primaryColor: [0.25, 0.25, 0.3], emissiveColor: [0.05, 0.05, 0.1], scale: 1.8 };
      case EnemyType.BOSS_SENTINEL:
        return { primaryColor: [0.5, 0.2, 0.2], emissiveColor: [0.3, 0.1, 0.1], scale: 3 };
      case EnemyType.BOSS_OVERLORD:
        return { primaryColor: [0.3, 0.0, 0.3], emissiveColor: [0.4, 0.1, 0.5], scale: 4 };
      case EnemyType.BOSS:
        return { primaryColor: [0.5, 0.2, 0.2], emissiveColor: [0.3, 0.1, 0.1], scale: 2.5 };
      case EnemyType.ASSAULT:
        // 突击型：明亮橙色，更小更快
        return { primaryColor: [1.0, 0.6, 0.1], emissiveColor: [0.5, 0.2, 0], scale: 0.9 };
      case EnemyType.SNIPER:
        // 狙击型：冷色调深蓝，更小且纤细
        return { primaryColor: [0.2, 0.4, 0.8], emissiveColor: [0.1, 0.2, 0.6], scale: 0.75 };
      case EnemyType.SWARM:
        // 蜂群型：鲜艳黄色，极小
        return { primaryColor: [1.0, 0.9, 0.1], emissiveColor: [0.4, 0.4, 0], scale: 0.45 };
      case EnemyType.STATIC_OUTPOST:
        return { primaryColor: [0.3, 0.3, 0.3], emissiveColor: [0.8, 0.1, 0.1], scale: 5.0 };
      case EnemyType.CRUISER:
        return { primaryColor: [0.2, 0.2, 0.25], emissiveColor: [0.1, 0.4, 0.8], scale: 8.0 };
      case EnemyType.VOID_LORD:
        return { primaryColor: [0.1, 0.0, 0.2], emissiveColor: [0.8, 0.0, 1.0], scale: 12.0 };
      default:
        return { primaryColor: [0.8, 0.2, 0.2], emissiveColor: [0.2, 0.05, 0.05], scale: 1 };
    }
  }

  public update(dt: number): void {
    if (this.isDying) {
      this.deathTimer += dt;
      if (this.deathTimer >= 0.3) {
        this.destroy();
      }
      return;
    }

    this.updateHitFeedback(dt);
    this.ai.update(dt);

    // 攻击判定：
    //  - 原生 TS 后端：沿用「进入 attackRange 即攻击」
    //  - Lua 后端接管时：攻击时机由 enemy-ai.lua 的 action 决定（近身/远程/混合各有自己的
    //    距离与冷却阈值），伤害数值仍走本类 stats，所以数值平衡不受后端切换影响。
    if (this.ai.isExternalBrainActive()) {
      if (this.ai.consumeAttackIntent()) this.tryAttack();
      return;
    }

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

    this.beginHitFeedback();

    if (this.health <= 0) {
      this.health = 0;
      this.startDeath();
    }
  }

  // ─── 受击反馈：闪白 + 体量鼓包 ───────────────────────────────────────────
  // 此前 takeDamage 只有数值变化，画面上**零反馈**——打中敌机和没打中一样。
  // 材质可放心改：ModelAssetProvider.upgrade 给每个实例 clone 了独立材质
  // （见 ModelAssetProvider.ts 的 tint 分支），不会出现「打一个全类型同闪」。

  /** 闪白剩余时长（秒）。 */
  private hitFlashTime: number = 0;
  /** 体量鼓包剩余时长（秒）。 */
  private hitPunchTime: number = 0;
  /** 首次闪白时抓取的材质原值快照，恢复用。 */
  private hitFlashMaterials:
    { mat: pc.StandardMaterial; emissive: pc.Color; intensity: number }[] | null = null;

  private static readonly HIT_FLASH_DURATION = 0.12;
  private static readonly HIT_PUNCH_DURATION = 0.1;
  private static readonly HIT_FLASH_COLOR = new pc.Color(1, 1, 1);

  private beginHitFeedback(): void {
    if (this.isDying) return;
    this.hitFlashTime = Enemy.HIT_FLASH_DURATION;
    this.hitPunchTime = Enemy.HIT_PUNCH_DURATION;
  }

  /** 每帧衰减两路反馈；归零时恢复原值。 */
  private updateHitFeedback(dt: number): void {
    if (this.hitFlashTime > 0) {
      this.hitFlashTime -= dt;
      if (this.hitFlashTime <= 0) {
        this.endHitFlash();
      } else {
        this.applyHitFlash();
      }
    }
    if (this.hitPunchTime > 0) {
      this.hitPunchTime -= dt;
      const t = Math.max(0, this.hitPunchTime / Enemy.HIT_PUNCH_DURATION);
      // 正弦鼓包：从 1.15 平滑缩回 1，不会跳变
      const s = 1 + 0.15 * Math.sin(t * Math.PI);
      this.entity.setLocalScale(s, s, s);
    }
  }

  private applyHitFlash(): void {
    if (!this.hitFlashMaterials) {
      this.hitFlashMaterials = [];
      const renders = this.entity.findComponents('render') as pc.RenderComponent[];
      for (const r of renders) {
        for (const mi of r.meshInstances ?? []) {
          const mat = mi.material as pc.StandardMaterial | null;
          if (!mat) continue;
          this.hitFlashMaterials.push({
            mat,
            emissive: mat.emissive.clone(),
            intensity: mat.emissiveIntensity,
          });
        }
      }
    }
    for (const f of this.hitFlashMaterials) {
      f.mat.emissive = Enemy.HIT_FLASH_COLOR;
      f.mat.emissiveIntensity = 2.5;
      f.mat.update();
    }
  }

  private endHitFlash(): void {
    if (!this.hitFlashMaterials) return;
    for (const f of this.hitFlashMaterials) {
      f.mat.emissive = f.emissive;
      f.mat.emissiveIntensity = f.intensity;
      f.mat.update();
    }
    this.hitFlashMaterials = null;
  }

  public addStatusEffect(type: StatusEffect['type'], duration: number, intensity: number): void {
    this.ai.addStatusEffect(type, duration, intensity);
  }

  public startDeath(): void {
    this.isDying = true;
    this.entity.enabled = false;
    // 复原受击反馈：死亡后 update 不再衰减这两路状态，
    // 不复原会留下「最后一次鼓包的缩放」和「闪白的 emissive」（下次复用前会被覆盖，但防御起见）
    this.hitFlashTime = 0;
    this.hitPunchTime = 0;
    this.endHitFlash();
    this.entity.setLocalScale(1, 1, 1);
    // 释放 Lua 侧句柄：注册表只保留存活敌机，否则长时间战斗会持续泄漏
    this.ai.detachExternalBrain();
    this.createDeathExplosion();
  }

  private createDeathExplosion(): void {
    const explosion = new pc.Entity('explosion');
    explosion.setPosition(this.entity.getPosition());

    const particleCount =
      this.type === EnemyType.BOSS ? 150 : this.type === EnemyType.TANK ? 80 : 50;

    // colorMap 按体量选：Boss/重型用六芒星光，普通敌机用环形冲击波光球
    this.engine.addParticleSystem(explosion, {
      lifetime: 0.8,
      rate: 0,
      // Engine 2：burst 已从引擎中彻底移除，一次喷发 N 个的写法改为 loop:false + numParticles
      loop: false,
      numParticles: particleCount,
      // Engine 2：speed 改名为 initialVelocity
      initialVelocity: 8,
      // Engine 2：直接传 CurveSet，并去掉 Engine 1 遗留的 'color' 第二参数（会破坏曲线分组）
      colorGraph: new pc.CurveSet([
        [1, 0.8, 0.3],
        [1, 0.5, 0.1],
        [0.5, 0.2, 0],
        [0, 0, 0],
      ]),
      scaleGraph: new pc.Curve([0.5, 1.5, 2]),
      colorMapUrl:
        this.type === EnemyType.BOSS || this.type === EnemyType.TANK
          ? PlayCanvasGameEngine.PARTICLE_TEXTURES.bossBurst
          : PlayCanvasGameEngine.PARTICLE_TEXTURES.explosionRing,
    });

    this.engine.addToScene(explosion);
    explosion.particlesystem?.play();

    setTimeout(() => explosion.destroy(), 800);
  }

  public destroy(): void {
    // 兜底释放（destroyAll / 重置关卡会直接 destroy，不走 startDeath）
    this.ai.detachExternalBrain();
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

/**
 * 2026 Tech: 战略级巨型舰船实体。
 * 支持多部位受损逻辑与独立武装平台。
 */
/**
 * 2026 Tech: 派系前哨站 (Faction Outpost)。
 * 静态防御性建筑，具备自动化防御炮塔和区域护盾。
 */
export class FactionOutpost extends Enemy {
  private turretEntities: pc.Entity[] = [];
  private shieldEntity: pc.Entity | null = null;
  private lastTurretFire: number = 0;

  constructor(config: EnemyConfig) {
    super(config);
    this.setupOutpostStructure();
  }

  private setupOutpostStructure(): void {
    // 1. 基础核心结构
    const core = new pc.Entity('outpost_core');
    core.addComponent('model', { type: 'box' });
    core.setLocalScale(10, 4, 10);
    this.entity.addChild(core);

    // 2. 自动化炮塔
    const turretOffsets = [
      new pc.Vec3(4, 2, 4),
      new pc.Vec3(-4, 2, 4),
      new pc.Vec3(4, 2, -4),
      new pc.Vec3(-4, 2, -4),
    ];

    turretOffsets.forEach((offset, i) => {
      const turret = new pc.Entity(`outpost_turret_${i}`);
      turret.setLocalPosition(offset);
      turret.addComponent('model', { type: 'cylinder' });
      turret.setLocalScale(0.8, 2, 0.8);
      this.entity.addChild(turret);
      this.turretEntities.push(turret);
    });

    // 3. 区域护盾视觉
    this.shieldEntity = new pc.Entity('outpost_shield');
    this.shieldEntity.addComponent('model', { type: 'sphere' });
    this.shieldEntity.setLocalScale(25, 25, 25);

    const mat = new pc.StandardMaterial();
    mat.diffuse.set(0, 0.5, 1);
    mat.opacity = 0.2;
    mat.blendType = pc.BLEND_NORMAL;
    mat.useLighting = false;
    mat.update();

    if (this.shieldEntity.model) this.shieldEntity.model.material = mat;
    this.entity.addChild(this.shieldEntity);
  }

  public override update(dt: number): void {
    super.update(dt);
    if (!this.isAlive()) return;

    // 2026 Tech: 自动化炮塔逻辑
    const playerPos = this.player.getPosition();
    const dist = this.entity.getPosition().distance(playerPos);

    if (dist < 30) {
      const now = Date.now();
      if (now - this.lastTurretFire > 1500) {
        this.turretEntities.forEach((turret) => {
          turret.lookAt(playerPos);
          this.fireTurret(turret);
        });
        this.lastTurretFire = now;
      }
    }

    // 护盾缓慢旋转
    if (this.shieldEntity) {
      this.shieldEntity.rotate(0, 5 * dt, 0);
    }
  }

  private fireTurret(turret: pc.Entity): void {
    // 简化的开火逻辑，实际可扩展为发射 projectile
    console.log(`[Outpost] Turret ${turret.name} firing!`);
  }
}

export class CapitalShip extends Enemy {
  private parts: Map<string, CapitalShipPart> = new Map();
  private turretEntities: pc.Entity[] = [];
  private newProjectiles: EnemyProjectile[] = [];
  private scanTimer: number = 0;
  private spawnDroneTimer: number = 0;
  private meshTearing: MeshTearingSystem | null = null;
  private damageSystem: WebGPUDamageSystem | null = null;
  private currentPhase: CapitalShipPhase = CapitalShipPhase.PHASE_1;
  private phaseAlertTriggered: Set<CapitalShipPhase> = new Set([CapitalShipPhase.PHASE_1]);

  constructor(config: EnemyConfig) {
    super(config);
    this.setupCapitalShipParts();
    this.setupDamageSystem();
  }

  private setupDamageSystem(): void {
    const app = this.engine.getApp();
    this.damageSystem = (app as any)['webgpuDamageSystem'];
    if (this.damageSystem) {
      this.meshTearing = new MeshTearingSystem(app, this.damageSystem);
      this.meshTearing.applyToEntity(this.entity);
    }
  }

  private checkPhaseTransition(): void {
    const hpPct = this.health / this.maxHealth;
    const destroyedParts = Array.from(this.parts.values()).filter((p) => p.isDestroyed).length;
    const totalParts = this.parts.size;
    const partDestructionPct = destroyedParts / totalParts;

    let nextPhase = this.currentPhase;

    if (hpPct < 0.3 || partDestructionPct > 0.6) {
      nextPhase = CapitalShipPhase.PHASE_3;
    } else if (hpPct < 0.7 || partDestructionPct > 0.3) {
      nextPhase = CapitalShipPhase.PHASE_2;
    }

    if (nextPhase !== this.currentPhase) {
      this.enterPhase(nextPhase);
    }
  }

  private enterPhase(phase: CapitalShipPhase): void {
    if (this.phaseAlertTriggered.has(phase)) return;

    this.currentPhase = phase;
    this.phaseAlertTriggered.add(phase);

    const store = useGameStore.getState();
    let alertMsg = '';

    switch (phase) {
      case CapitalShipPhase.PHASE_2:
        alertMsg = `[WARNING] 敌方母舰进入防御姿态：自动维修激活，机库出动频率翻倍！`;
        // 视觉反馈：核心亮度增加
        this.setReactorGlow(2.0);
        break;
      case CapitalShipPhase.PHASE_3:
        alertMsg = `[DANGER] 敌方母舰进入狂暴模式：能量溢出，武器系统超频！请求紧急支援！`;
        this.setReactorGlow(5.0);
        // 触发全局抖动
        (this.engine.getApp() as any)['vfxSystem']?.triggerShake(1.5, 0.4);
        // 触发敌方援军
        const reinforcement = (this.engine.getApp() as any)['reinforcementSystem'];
        if (reinforcement) {
          // 强制触发一次入侵级援军
          reinforcement.evaluateBattleSituation?.(true);
        }
        break;
    }

    if (alertMsg) {
      store.updateGalacticStatus({
        intelligenceFeed: [...store.galacticStatus.intelligenceFeed.slice(-4), alertMsg],
      });
    }
  }

  private setReactorGlow(intensity: number): void {
    const reactor = this.parts.get('reactor_core');
    if (reactor && !reactor.isDestroyed) {
      const renders = reactor.entity.findComponents('render') as pc.RenderComponent[];
      renders.forEach((r) => {
        r.meshInstances.forEach((mi) => {
          const mat = mi.material as pc.StandardMaterial;
          if (mat) {
            mat.emissiveIntensity = intensity;
            mat.update();
          }
        });
      });
    }
  }

  private setupCapitalShipParts(): void {
    // 2026 Tech: 模块化巨型舰船构造
    this.addPart('reactor_core', '聚变反应堆', 1200, 'reactor', new pc.Vec3(0, 0, 0));

    this.addPart('turret_heavy_main', '主能量炮', 600, 'turret', new pc.Vec3(0, 3, 8), {
      shootInterval: 4000,
      weaponType: 'heavy_beam',
      rotationSpeed: 20,
    });

    this.addPart('turret_l_1', '左舷激光阵列', 350, 'turret', new pc.Vec3(-5, 1, 4), {
      shootInterval: 1200,
      weaponType: 'laser',
      rotationSpeed: 60,
    });

    this.addPart('turret_r_1', '右舷激光阵列', 350, 'turret', new pc.Vec3(5, 1, 4), {
      shootInterval: 1200,
      weaponType: 'laser',
      rotationSpeed: 60,
    });

    this.addPart('turret_rear', '后置导弹仓', 400, 'turret', new pc.Vec3(0, 2, -5), {
      shootInterval: 3000,
      weaponType: 'missile',
      rotationSpeed: 45,
    });

    this.addPart('hangar_bay', '无人机机库', 900, 'hangar', new pc.Vec3(0, -2, -2));
    this.addPart('engine_primary', '主推进器组', 1000, 'engine', new pc.Vec3(0, 0, -10));
    this.addPart('bridge_tower', '指挥塔', 500, 'bridge', new pc.Vec3(0, 5, -4));
  }

  private addPart(
    id: string,
    name: string,
    health: number,
    type: CapitalShipPart['type'],
    offset: pc.Vec3,
    turretConfig?: {
      shootInterval: number;
      weaponType: CapitalShipPart['weaponType'];
      rotationSpeed: number;
    },
  ): void {
    const partEntity = new pc.Entity(name);
    this.entity.addChild(partEntity);
    partEntity.setLocalPosition(offset);

    // 2026 Tech: 基于类型的程序化模型组件
    const model = new pc.Entity();
    let modelType: string = 'box';
    let scale = new pc.Vec3(2, 2, 2);

    switch (type) {
      case 'turret':
        modelType = 'cylinder';
        scale.set(1, 2, 1);
        break;
      case 'reactor':
        modelType = 'sphere';
        scale.set(3, 3, 3);
        break;
      case 'hangar':
        modelType = 'box';
        scale.set(4, 1, 4);
        break;
      case 'engine':
        modelType = 'cone';
        scale.set(2, 3, 2);
        break;
    }

    model.addComponent('model', {
      type: modelType as
        'box' | 'sphere' | 'cylinder' | 'cone' | 'capsule' | 'plane' | 'torus' | 'asset',
    });
    model.setLocalScale(scale);
    partEntity.addChild(model);

    // 为不同部位设置不同颜色
    if (model.model) {
      const mat = new pc.StandardMaterial();
      const color =
        type === 'reactor'
          ? [0.2, 0.8, 1.0]
          : type === 'turret'
            ? [0.8, 0.2, 0.2]
            : [0.5, 0.5, 0.5];
      mat.diffuse.set(color[0], color[1], color[2]);
      mat.emissive.set(color[0] * 0.5, color[1] * 0.5, color[2] * 0.5);
      mat.update();
      model.model.material = mat;
    }

    const part: CapitalShipPart = {
      id,
      name,
      health,
      maxHealth: health,
      entity: partEntity,
      type,
      isDestroyed: false,
      lastShootTime: 0,
      shootInterval: turretConfig?.shootInterval,
      weaponType: turretConfig?.weaponType,
      rotationSpeed: turretConfig?.rotationSpeed || 30,
    };

    this.parts.set(id, part);
    if (type === 'turret') {
      this.turretEntities.push(partEntity);
    }
  }

  public override takeDamage(amount: number): void {
    // 2026 Tech: WebGPU 损毁计算集成
    if (this.damageSystem) {
      // 计算碰撞点（简化为实体位置加一点偏移）
      const hitPos = this.entity
        .getPosition()
        .clone()
        .add(
          new pc.Vec3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
          ),
        );
      const force = new pc.Vec3(amount * 0.1, amount * 0.1, amount * 0.1);
      this.damageSystem.applyDamage(hitPos, force);
    }

    // 2026 Tech: 智能损伤分配
    const partsArray = Array.from(this.parts.values()).filter((p) => !p.isDestroyed);

    // 找出炮塔
    const turrets = partsArray.filter((p) => p.type === 'turret');
    if (turrets.length > 0 && Math.random() > 0.4) {
      const target = turrets[Math.floor(Math.random() * turrets.length)];
      this.damagePart(target.id, amount);
    } else {
      // 随机分配给其他部位
      const target = partsArray[Math.floor(Math.random() * partsArray.length)];
      this.damagePart(target.id, amount);
    }

    // 基础血量受损（象征结构性损伤）
    super.takeDamage(amount * 0.1);

    // 2026 Tech: 阶段转换检测
    this.checkPhaseTransition();
  }

  public damagePart(partId: string, amount: number): void {
    const part = this.parts.get(partId);
    if (!part || part.isDestroyed) return;

    part.health -= amount;

    // 触发局部受损特效（火花）
    this.engine.createExplosion?.(part.entity.getPosition(), 0.5);

    if (part.health <= 0) {
      this.destroyPart(partId);
    }
  }

  private destroyPart(partId: string): void {
    const part = this.parts.get(partId);
    if (!part) return;

    part.isDestroyed = true;
    part.health = 0;

    // 视觉反馈：变黑
    const renders = part.entity.findComponents('render') as pc.RenderComponent[];
    renders.forEach((r) => {
      r.meshInstances.forEach((mi) => {
        const mat = mi.material as pc.StandardMaterial;
        if (mat) {
          mat.diffuse.set(0.1, 0.1, 0.1);
          mat.emissive.set(0, 0, 0);
          mat.update();
        }
      });
    });

    this.createLocalExplosion(part.entity.getPosition());

    // 2026 Tech: 战术情报同步
    const store = useGameStore.getState();
    store.updateGalacticStatus({
      intelligenceFeed: [
        ...store.galacticStatus.intelligenceFeed.slice(-4),
        `[TACTICAL] 敌方巡洋舰部件已毁: ${part.name}`,
      ],
    });

    // 2026 Tech: 功能性损毁逻辑
    switch (part.type) {
      case 'reactor':
        console.log('CRITICAL: REACTOR MELTDOWN!');
        this.triggerMeltdownEffect(part.entity.getPosition());
        setTimeout(() => this.startDeath(), 1500); // 延迟爆炸，增加压迫感
        break;
      case 'engine':
        this.speed *= 0.3;
        this.triggerEngineFailureEffect(part.entity.getPosition());
        console.log('Engines disabled.');
        break;
      case 'bridge':
        this.ai.addStatusEffect('stun', 10000, 1);
        this.triggerBridgeDamageEffect(part.entity.getPosition());
        console.log('Command bridge destroyed, AI confusion.');
        break;
      case 'hangar':
        this.triggerHangarDestructionEffect(part.entity.getPosition());
        console.log('Hangar bay destroyed, drone deployment halted.');
        break;
    }
  }

  private triggerMeltdownEffect(pos: pc.Vec3): void {
    const meltdown = new pc.Entity('meltdown_effect');
    meltdown.setPosition(pos);
    this.engine.addParticleSystem(meltdown, {
      lifetime: 2.0,
      numParticles: 200,
      initialVelocity: 15,
      colorGraph: new pc.CurveSet([
        [0.2, 0.8, 1],
        [1, 0.5, 0],
        [0, 0, 0],
      ]),
      scaleGraph: new pc.Curve([0, 5, 10, 0]),
    });
    this.engine.addToScene(meltdown);

    // 强烈的全屏抖动
    (this.engine.getApp() as any)['vfxSystem']?.triggerShake(2.0, 0.5);
  }

  private triggerEngineFailureEffect(pos: pc.Vec3): void {
    const smoke = new pc.Entity('engine_smoke');
    smoke.setPosition(pos);
    this.engine.addParticleSystem(smoke, {
      lifetime: 3.0,
      numParticles: 100,
      initialVelocity: 2,
      colorGraph: new pc.CurveSet([
        [0.2, 0.2, 0.2],
        [0.1, 0.1, 0.1],
        [0, 0, 0],
      ]),
      scaleGraph: new pc.Curve([0.5, 2.0, 4.0]),
    });
    this.engine.addToScene(smoke);
  }

  private triggerBridgeDamageEffect(pos: pc.Vec3): void {
    // 桥接受损：电火花持续喷射
    const sparks = new pc.Entity('bridge_sparks');
    sparks.setPosition(pos);
    this.engine.addParticleSystem(sparks, {
      lifetime: 0.5,
      numParticles: 30,
      initialVelocity: 8,
      colorGraph: new pc.CurveSet([
        [1, 1, 1],
        [0.5, 0.8, 1],
        [0, 0, 0],
      ]),
      scaleGraph: new pc.Curve([0.1, 0.2, 0]),
    });
    this.engine.addToScene(sparks);
  }

  private triggerHangarDestructionEffect(pos: pc.Vec3): void {
    this.createLocalExplosion(pos);
    // 额外的碎片效果
    const debris = new pc.Entity('hangar_debris');
    debris.setPosition(pos);
    this.engine.addParticleSystem(debris, {
      lifetime: 1.5,
      numParticles: 40,
      initialVelocity: 12,
      colorGraph: new pc.CurveSet([
        [0.4, 0.4, 0.45],
        [0.2, 0.2, 0.2],
      ]),
      scaleGraph: new pc.Curve([0.2, 0.4, 0.1]),
    });
    this.engine.addToScene(debris);
  }

  public override update(dt: number): void {
    super.update(dt);
    if (!this.isAlive()) return;

    // 2026 Tech: 更新网格撕裂效果
    if (this.meshTearing) {
      this.meshTearing.update(this.entity);
    }

    const now = Date.now();
    const playerPos = this.player.getPosition();

    // 2026 Tech: 广域扫描与多目标锁定 (Wide-range Scanning & Multi-target Locking)
    this.scanTimer += dt;
    if (this.scanTimer > 1.0) {
      this.scanForTargets();
      this.scanTimer = 0;
    }

    // 2026 Tech: 检查核心功能性损毁
    if (this.damageSystem) {
      if (!this.damageSystem.isComponentFunctional('ENGINE')) {
        this.speed = this.stats.speed * 0.2;
      }
      if (!this.damageSystem.isComponentFunctional('CORE') && this.health > this.maxHealth * 0.1) {
        // 核心受损但未爆炸，产生持续伤害
        this.takeDamage(dt * 5);
      }
    }

    // 2026 Tech: 独立炮塔瞄准系统
    this.parts.forEach((part) => {
      if (part.type === 'turret' && !part.isDestroyed) {
        // 决定当前瞄准目标
        const targetPos =
          part.target instanceof pc.Entity
            ? part.target.getPosition()
            : part.target instanceof PlayerShip
              ? part.target.getPosition()
              : playerPos;

        // 缓慢转向目标
        const currentRot = part.entity.getRotation();
        part.entity.lookAt(targetPos);
        const targetRot = part.entity.getRotation();

        // 插值旋转以实现平滑追踪 (2026 拟真度)
        const slerpRot = new pc.Quat().slerp(
          currentRot,
          targetRot,
          (part.rotationSpeed || 30) * dt * 0.01,
        );
        part.entity.setRotation(slerpRot);

        // 射击判定：仅当目标在视野范围内
        const angle = part.entity.forward.dot(
          targetPos.clone().sub(part.entity.getPosition()).normalize(),
        );
        if (angle > 0.8) {
          // 约 36 度角
          let shootInterval = part.shootInterval || 4000;

          // 2026 Tech: 阶段倍率缩放
          if (this.currentPhase === CapitalShipPhase.PHASE_3) {
            shootInterval *= 0.5; // 射速翻倍
          }

          if (now - (part.lastShootTime || 0) >= shootInterval) {
            this.fireTurret(part, targetPos);
            part.lastShootTime = now;
          }
        }
      }

      // 2026 Tech: 机库自动部署
      if (part.type === 'hangar' && !part.isDestroyed) {
        this.spawnDroneTimer += dt;
        let deployInterval = 12.0;

        if (this.currentPhase === CapitalShipPhase.PHASE_2) deployInterval = 6.0;
        if (this.currentPhase === CapitalShipPhase.PHASE_3) deployInterval = 3.0;

        if (this.spawnDroneTimer > deployInterval) {
          this.deployDrone(part.entity.getPosition());
          this.spawnDroneTimer = 0;
        }
      }
    });
  }

  private scanForTargets(): void {
    const npcs = (this.engine.getApp() as any)['npcManager']?.getNPCs() || [];
    const myPos = this.entity.getPosition();

    // 2026 Tech: 智能多目标锁定
    // 巨型舰船会扫描周围的单位，根据威胁度和距离分配目标
    this.parts.forEach((part) => {
      if (part.type === 'turret' && !part.isDestroyed) {
        // 70% 概率锁定玩家（主要威胁），30% 概率锁定最近的友军 NPC（分散火力）
        if (Math.random() > 0.7 && npcs.length > 0) {
          // 找到最近的 NPC
          let nearestNPC = npcs[0];
          let minDist = nearestNPC.getPosition().distance(myPos);

          for (let i = 1; i < npcs.length; i++) {
            const dist = npcs[i].getPosition().distance(myPos);
            if (dist < minDist) {
              minDist = dist;
              nearestNPC = npcs[i];
            }
          }

          // 如果 NPC 在 50m 范围内，则锁定它
          if (minDist < 50) {
            part.target = (nearestNPC as any).entity;
          } else {
            part.target = this.player;
          }
        } else {
          part.target = this.player;
        }
      }
    });
  }

  private fireTurret(part: CapitalShipPart, targetPos: pc.Vec3): void {
    const forward = part.entity.forward.clone();
    const spawnPos = part.entity.getPosition().clone().add(forward.clone().mulScalar(2));

    let speed = 30;
    let damage = 20;
    let color = new pc.Color(1, 0.5, 0);

    switch (part.weaponType) {
      case 'laser':
        speed = 60;
        damage = 10;
        color.set(1, 0, 0);
        break;
      case 'heavy_beam':
        speed = 80;
        damage = 50;
        color.set(0.2, 0.8, 1);
        break;
      case 'missile':
        speed = 15;
        damage = 40;
        color.set(1, 1, 0);
        break;
    }

    const projectileEntity = new pc.Entity('enemy_projectile');
    const mat = new pc.StandardMaterial();
    mat.diffuse = color;
    mat.emissive = color;
    mat.emissiveIntensity = 2.0;
    mat.update();

    projectileEntity.addComponent('model', {
      type: part.weaponType === 'heavy_beam' ? 'cylinder' : 'sphere',
    });
    if (projectileEntity.model) projectileEntity.model.material = mat;

    const scale =
      part.weaponType === 'heavy_beam' ? new pc.Vec3(0.5, 2, 0.5) : new pc.Vec3(0.4, 0.4, 0.4);
    projectileEntity.setLocalScale(scale);
    projectileEntity.setPosition(spawnPos);
    projectileEntity.lookAt(targetPos);

    this.engine.addToScene(projectileEntity);

    const projectile = new EnemyProjectile(projectileEntity, damage, forward.mulScalar(speed));
    this.newProjectiles.push(projectile);

    this.createMuzzleFlash(spawnPos);
  }

  private createMuzzleFlash(pos: pc.Vec3): void {
    const flash = new pc.Entity('muzzle_flash');
    flash.setPosition(pos);
    this.engine.addParticleSystem(flash, {
      lifetime: 0.15,
      numParticles: 10,
      initialVelocity: 5,
      colorGraph: new pc.CurveSet([
        [1, 0.8, 0],
        [0.5, 0.2, 0],
      ]),
      scaleGraph: new pc.Curve([0.1, 0.5, 0]),
    });
    this.engine.addToScene(flash);
    setTimeout(() => flash.destroy(), 200);
  }

  private createLocalExplosion(pos: pc.Vec3): void {
    const explosion = new pc.Entity('part_explosion');
    explosion.setPosition(pos);
    this.engine.addParticleSystem(explosion, {
      lifetime: 0.8,
      numParticles: 50,
      initialVelocity: 10,
      colorGraph: new pc.CurveSet([
        [1, 0.5, 0.2],
        [0.2, 0.1, 0],
      ]),
      scaleGraph: new pc.Curve([0.5, 1.2, 0]),
    });
    this.engine.addToScene(explosion);
    setTimeout(() => explosion.destroy(), 1000);
  }

  /**
   * 2026 Tech: 从机库部署无人机。
   * 无人机会加入敌方系统并协同作战。
   */
  private deployDrone(position: pc.Vec3): void {
    const app = this.engine.getApp() as any;
    const enemySystem = app['_enemySystem'];
    if (enemySystem) {
      // 2026 Tech: 部署一架无人机
      enemySystem.spawnEnemyInstance(EnemyType.DRONE, position.clone());
      console.log(`[CapitalShip] ${this.type} deployed a drone at ${position}`);

      // 触发部署特效（简单的光效）
      const deployEffect = new pc.Entity('deploy_effect');
      deployEffect.setPosition(position);
      this.engine.addParticleSystem(deployEffect, {
        lifetime: 0.5,
        numParticles: 20,
        initialVelocity: 2,
        colorGraph: new pc.CurveSet([
          [0.2, 0.8, 1],
          [0, 0.2, 0.5],
        ]),
        scaleGraph: new pc.Curve([0.1, 0.3, 0]),
      });
      this.engine.addToScene(deployEffect);
      setTimeout(() => deployEffect.destroy(), 600);
    }
  }

  public consumeNewProjectiles(): EnemyProjectile[] {
    const projs = [...this.newProjectiles];
    this.newProjectiles = [];
    return projs;
  }
}
