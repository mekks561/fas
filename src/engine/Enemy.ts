import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { EnemyAI, EnemyAIFactory, AIState, StatusEffect } from './EnemyAI';
import { attachLuaBrain, getEnemyAIMode } from './LuaEnemyAIBridge';
import { ProceduralModelGenerator, EnemyModelType } from './ProceduralModelGenerator';
import { ModelAssetProvider } from './ModelAssetProvider';

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

    this.modelGenerator = new ProceduralModelGenerator(this.engine.getApp());
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

  private startDeath(): void {
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
