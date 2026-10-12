import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';

import {
  SKILL_SLOT_CONFIGS,
  SKILL_SLOT_ORDER,
  SkillType,
  type ImplementedSkillType,
  type SkillConfig,
  type SkillState,
} from './skillSlots';
import {
  getGrantedUnlockIds,
  getUnlockLevel,
  isSkillUnlocked,
  skillUnlockId,
} from './UnlockRegistry';

/**
 * 技能 id / 配置的形状与数值**不在这里定义** —— 唯一真源是 `./skillSlots`。
 *
 * 这里只做再导出，保证既有 `import { SkillType } from './SkillSystem'` 的调用点不动。
 * 数值与槽位顺序的改动一律去 `skillSlots.ts`（连同 HUD 冷却环、store 冷却上限一起生效）。
 */
export { SkillType } from './skillSlots';
export type { SkillConfig, SkillState } from './skillSlots';

/**
 * 技能可以造成伤害的最小目标形状。
 *
 * 故意写成**结构化接口**而不是 `import type { Enemy }`：技能模块只需要
 * 「还活着吗 / 在哪 / 挨打」这三件事，引入 `Enemy` 会把整个刷怪/模型链拖进来。
 * `Enemy` 天然满足这三个方法，匹配关系由编译期保证，不会悄悄漂移。
 */
export interface SkillDamageTarget {
  isAlive(): boolean;
  getPosition(): pc.Vec3;
  /** 与 `Enemy.takeDamage` 同签名。内部还会扣护甲并至少造成 1 点，那是目标自己的口径。 */
  takeDamage(amount: number): void;
}

/**
 * 技能作用于游戏世界的**查询口**，由 `GameScene` 注入。
 *
 * 为什么不直接让技能 import `EnemySystem`：那会让「技能」与「刷怪/波次」两条链互相缠住，
 * 单测也得跟着铺一层桩。这里只留一个最小契约，与 `setOnSkillActivated` 的回调注入同一套做法。
 */
export interface SkillWorld {
  /** 返回以 `center` 为心、`radius` 为半径的球内**存活**目标。 */
  enemiesInRadius(center: pc.Vec3, radius: number): SkillDamageTarget[];
}

/**
 * 把一次爆炸的伤害分摊给命中目标。
 *
 * 抽成**纯函数**是为了能在 Node 下单测：`explodeMissile` 里满是 `new pc.Entity()`，
 * 出了浏览器就跑不了；而「谁挨打、挨几点」这段逻辑不该被浏览器绑死。
 *
 * 返回的 `damage` 是**发放**的点数（hits × damage），不是实际掉血 —— 后者由目标的
 * `takeDamage` 决定（扣护甲、至少 1 点）。两者故意分开，免得 e2e 用发放值去对掉血量。
 */
export function applyExplosionDamage(
  targets: readonly SkillDamageTarget[],
  damage: number,
): { hits: number; damage: number } {
  let hits = 0;
  for (const target of targets) {
    // `enemiesInRadius` 已过滤存活目标，这里再判一次是幂等保护：
    // 注入实现忘了过滤时，不会把伤害打在一具正在爆炸的尸体上。
    if (!target.isAlive()) continue;
    target.takeDamage(damage);
    hits++;
  }
  return { hits, damage: hits * damage };
}

export class Skill {
  protected config: SkillConfig;
  protected state: SkillState;
  protected player: PlayerShip;
  protected engine: PlayCanvasGameEngine;
  protected effectEntity: pc.Entity | null = null;
  /**
   * 已销毁标记。销毁之后所有延迟回调（setTimeout / setInterval）一律不得再碰引擎对象 ——
   * 引擎此时通常也已被销毁，`new pc.Entity()` 拿不到 application，
   * `entity.addComponent()` 内部读 `this._app.systems` 会直接抛 TypeError。
   */
  protected disposed = false;

  constructor(player: PlayerShip, engine: PlayCanvasGameEngine, config: SkillConfig) {
    this.player = player;
    this.engine = engine;
    this.config = config;

    this.state = {
      isActive: false,
      cooldownRemaining: 0,
      durationRemaining: 0,
      level: 1,
      maxLevel: 3,
    };
  }

  public update(dt: number): void {
    if (this.state.cooldownRemaining > 0) {
      this.state.cooldownRemaining -= dt;
    }

    if (this.state.isActive) {
      this.state.durationRemaining -= dt;
      this.executeSkillEffect(dt);

      if (this.state.durationRemaining <= 0) {
        this.endSkill();
      }
    }
  }

  protected executeSkillEffect(_dt: number): void {}

  public activate(): boolean {
    if (this.disposed) {
      return false;
    }

    if (this.state.cooldownRemaining > 0) {
      return false;
    }

    if (this.state.isActive) {
      return false;
    }

    this.state.isActive = true;
    this.state.durationRemaining = this.config.duration;
    this.state.cooldownRemaining = this.config.cooldown;

    this.createActivationEffect();

    return true;
  }

  protected endSkill(): void {
    this.state.isActive = false;
    this.removeEffect();
  }

  protected createActivationEffect(): void {
    if (this.effectEntity) {
      this.removeEffect();
    }

    this.effectEntity = new pc.Entity(`skill_${this.config.type}_effect`);
    this.effectEntity.setPosition(this.player.getPosition());

    this.engine.addToScene(this.effectEntity);
  }

  protected removeEffect(): void {
    if (this.effectEntity) {
      this.effectEntity.destroy();
      this.effectEntity = null;
    }
  }

  public upgrade(): boolean {
    if (this.state.level >= this.state.maxLevel) {
      return false;
    }

    this.state.level++;
    this.onUpgrade();

    return true;
  }

  protected onUpgrade(): void {}

  public getState(): SkillState {
    return { ...this.state };
  }

  public getConfig(): SkillConfig {
    return { ...this.config };
  }

  public getCooldownPercent(): number {
    if (this.state.cooldownRemaining <= 0) {
      return 1;
    }
    return 1 - this.state.cooldownRemaining / this.config.cooldown;
  }

  public isReady(): boolean {
    return this.state.cooldownRemaining <= 0 && !this.state.isActive;
  }

  public destroy(): void {
    this.disposed = true;
    this.removeEffect();
  }
}

export class MissileStrikeSkill extends Skill {
  /**
   * 单枚导弹的爆炸伤害 = **7.5**（用户指定值）。
   *
   * 口径：**等级只增加导弹数量（`5 + level × 2`），不改单发伤害** ——
   * 这样「一次施放的伤害上限」随等级线性增长，而单发数值是一个可断言的真值。
   * 想改成随等级成长就改这一处，别在 HUD 或 e2e 里另抄一份。
   */
  public static readonly EXPLOSION_DAMAGE = 7.5;

  /**
   * 爆炸半径（世界单位）。
   *
   * 取值依据是刷怪几何，不是手感偏好：导弹落点在玩家前方 50 处、横向铺开 ±10
   * （见 `createMissile`），敌人自 40~60 的环上刷出 —— 12 能让相邻导弹的爆炸圈
   * 连成一片，又不至于一发覆盖全场。**要动它先想清楚这三组数字的关系。**
   */
  public static readonly EXPLOSION_RADIUS = 12;

  /** 导弹飞行速度（世界单位/秒）。与原 `setInterval` 版口径一致（30 × 0.016 / 16ms ≈ 30/s）。 */
  public static readonly MISSILE_SPEED = 30;
  /** 发射到引爆的飞行时长（秒）。1.5s × 30/s ≈ 45 单位，即落点前一点的位置。 */
  public static readonly MISSILE_FLIGHT_SECONDS = 1.5;

  private missiles: pc.Entity[] = [];
  /**
   * 与 `missiles` **平行**的飞行方向（单位向量），进出场同步增删。
   *
   * 之前这里是一个 `targetPositions` 数组，只被 push、**从来没有人读** ——
   * 典型装饰字段。方向才是帧推进真正需要的东西，于是用它顶掉。
   */
  private missileDirections: pc.Vec3[] = [];
  /** 与 `missiles` 平行的已飞行时长（秒），用于判定引爆。 */
  private missileElapsed: number[] = [];

  /**
   * 本次施放是否已经发过一轮导弹。
   *
   * 接线前这里拿 `this.missiles.length > 0` 当闸门，留下一个可复现的缺陷：
   * 导弹在 1.5s 全部爆炸（每枚从数组 `splice` 掉）→ 数组被清空 → 持续期还剩 0.5s
   * → 下一帧又补发一轮 7 枚。第二轮飞出去 0.5s 后被 `endSkill()` 销毁，
   * **既不爆炸也不造成伤害**，是白偷半个持续期的幽灵弹。
   * 那时技能没有伤害，所以「多发一轮空包弹」只算浪费；现在有真伤害了，
   * 玩家会看到「第二轮打出去毫无反应」——这条必须先堵死。
   */
  private fired = false;

  /** 效果层计数：爆炸次数 / 命中目标次数 / 发放伤害点数。供 e2e 断言技能**真的生效**。 */
  private stats = { explosions: 0, hits: 0, damage: 0 };

  /** 世界查询口（由 `GameScene` 注入）。为 null 时技能只播特效、不结算伤害。 */
  private world: SkillWorld | null;
  /**
   * 未到期的延时任务（目前只剩「爆炸粒子播完后销毁实体」），销毁时必须一次性清空。
   *
   * 这段历史值得留一句：早前「1.5s 后逐枚爆炸」也走同一个 `setTimeout`，而导弹在
   * 1.5s 全爆完后持续期还剩 0.5s，`executeSkillEffect` 于是又补发一轮；第二轮的定时器
   * 要到 3s 才到期，那时玩家往往已离开关卡、引擎已 `destroy()` ——
   * `explodeMissile` → `new pc.Entity('explosion')` → `addComponent('particlesystem')`
   * → PlayCanvas 内部读 `this._app.systems` 时 `_app` 为 null →
   * **每一枚导弹一条 `Cannot read properties of null (reading 'systems')`**（实测 10 条）。
   * 引爆现在已改由帧循环按 `missileElapsed` 判定（帧率无关），这条路上不再有定时器；
   * 但「迟到的回调必须被闸门挡住」这条纪律依旧适用于下面这个特效清理定时器。
   */
  private timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(player: PlayerShip, engine: PlayCanvasGameEngine, world: SkillWorld | null = null) {
    super(player, engine, SKILL_SLOT_CONFIGS[SkillType.MISSILE_STRIKE]);
    this.world = world;
  }

  protected override executeSkillEffect(dt: number): void {
    if (this.disposed) return;

    // 一次施放只发一轮：持续期 2s > 导弹飞行 1.5s，若不拦，爆完之后会补发幽灵第二轮。
    if (!this.fired) {
      this.fired = true;

      const missileCount = 5 + this.state.level * 2;
      for (let i = 0; i < missileCount; i++) {
        // 三个平行数组（实体 / 方向 / 已飞行时长）在同一轮里各 push 一次，下标天然对齐。
        this.missiles.push(this.createMissile(i, missileCount));
        this.missileElapsed.push(0);
      }
    }

    this.advanceMissiles(dt);
  }

  /**
   * 按**帧间隔**推进导弹位置并判定引爆。
   *
   * 此前这里是两套 wall-clock 机制：位置由 `setInterval(16ms)` + 固定位移 `30 × 0.016`
   * 驱动，引爆由 `setTimeout(1500ms)` 触发 —— **两者都与真实帧间隔无关**。
   * 60fps 下恰好等价于 30 单位/秒，看着没问题；但掉帧时导弹就飞不到位（实测无头浏览器
   * SwiftShader ~10fps 里 1.5s 只飞了约 7 单位，而正常帧率飞 45），引爆时点也会被
   * 主线程拖后（e2e 实测：持续期已过 0.1s 仍有 3 枚没爆）。
   * 这与项目里「惯性必须帧率无关」是同一条纪律，所以位置和引爆一起搬进帧循环。
   *
   * 附带修好一个口径：游戏暂停时技能不再推进 → 导弹既不会飞也不会爆。
   * 旧实现里暂停期间 `setTimeout` 照常到期，回来时会一次爆完。
   *
   * 单帧位移钳到 0.1s（卡顿一下之后一帧跳出半个场地，比少飞一点更难排查），
   * 但**计时用真实 dt** —— 否则连续低帧率下累计会被钳制拖慢，导弹迟迟不爆、
   * 最后被 `endSkill()` 直接收走（那不是"帧率无关"，只是换了个方式失真）。
   */
  private advanceMissiles(dt: number): void {
    const step = Math.min(dt, 0.1);

    for (let i = 0; i < this.missiles.length; i++) {
      const missile = this.missiles[i];
      const direction = this.missileDirections[i];
      if (!missile.parent || !direction) continue;
      missile.setPosition(
        missile
          .getPosition()
          .clone()
          .add(direction.clone().scale(MissileStrikeSkill.MISSILE_SPEED * step)),
      );
      this.missileElapsed[i] += dt;
    }

    // 倒序引爆：`explodeMissile` 会从三个平行数组里 splice，从后往前删才不会串位。
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      if (this.missileElapsed[i] >= MissileStrikeSkill.MISSILE_FLIGHT_SECONDS) {
        this.explodeMissile(this.missiles[i]);
      }
    }
  }

  /** 效果层真值快照（含当前配置里的伤害与半径，避免 e2e 再抄一份数字）。 */
  public getDamageStats(): {
    explosions: number;
    hits: number;
    damage: number;
    explosionDamage: number;
    explosionRadius: number;
    missilesInFlight: number;
  } {
    return {
      ...this.stats,
      explosionDamage: MissileStrikeSkill.EXPLOSION_DAMAGE,
      explosionRadius: MissileStrikeSkill.EXPLOSION_RADIUS,
      missilesInFlight: this.missiles.length,
    };
  }

  /**
   * 在世界里结算一次爆炸伤害。
   *
   * 闸门说明：`world` 为 null 时（单测 / 未注入）只播特效，不碰任何目标 ——
   * 技能模块不能假设场上一定有敌人系统。
   */
  private applyExplosionDamage(center: pc.Vec3): void {
    if (!this.world) return;

    const targets = this.world.enemiesInRadius(center, MissileStrikeSkill.EXPLOSION_RADIUS);
    const result = applyExplosionDamage(targets, MissileStrikeSkill.EXPLOSION_DAMAGE);

    this.stats.explosions++;
    this.stats.hits += result.hits;
    this.stats.damage += result.damage;
  }

  /**
   * 登记一个定时器，便于 `destroy()` 一次性清掉。
   * 回调触发前再查一次 `disposed`：即使定时器已经被清过，也不会在半销毁状态下执行。
   */
  private schedule(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (this.disposed) return;
      fn();
    }, ms);
    this.timers.add(id);
  }

  /** 清空所有未到期的爆炸定时器。 */
  private clearAllTimers(): void {
    this.timers.forEach((id) => clearTimeout(id));
    this.timers.clear();
  }

  private createMissile(index: number, total: number): pc.Entity {
    const playerPos = this.player.getPosition();
    const playerForward = new pc.Vec3(0, 0, -1);

    const spread = 10;
    const angle = (index / total) * Math.PI - Math.PI / 2;
    const offset = new pc.Vec3(
      Math.sin(angle) * spread,
      (Math.random() - 0.5) * 5,
      Math.cos(angle) * spread * 0.5,
    );

    const targetPos = playerPos.clone().add(playerForward.clone().scale(50)).add(offset);

    const missile = new pc.Entity('missile');

    const material = new pc.StandardMaterial();
    material.diffuse.set(1, 0.3, 0.3);
    material.emissive.set(0.8, 0.2, 0.2);
    material.update();

    missile.addComponent('model', { type: 'cone' });
    if (missile.model) missile.model.material = material;
    missile.setLocalEulerAngles(-90, 0, 0);

    const startPos = playerPos
      .clone()
      .add(
        new pc.Vec3(
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 5,
        ),
      );
    missile.setPosition(startPos);

    this.engine.addToScene(missile);

    const direction = targetPos.clone().sub(startPos).normalize();
    missile.lookAt(startPos.clone().add(direction));
    // 方向随实体一起入册：位置推进在主循环的 `advanceMissiles(dt)` 里做，
    // 不再由 `setInterval` 驱动（那套位移与真实帧间隔无关，掉帧就飞不到位）。
    this.missileDirections.push(direction);

    return missile;
  }

  private explodeMissile(missile: pc.Entity): void {
    // 两道闸门，缺一不可：
    //  ① `disposed` —— 技能/引擎已销毁，绝不能再 new 实体；
    //  ② 导弹已不在 `this.missiles` 里 —— 说明它已被 `endSkill()` 或 `destroy()` 收走，
    //     此时它的定时器只是"迟到的回声"，**必须丢弃**，否则就是上面注释里那串 TypeError。
    if (this.disposed) return;
    if (this.missiles.indexOf(missile) === -1) return;

    // 先把爆炸点拷出来：伤害结算与特效定位都要用它，而 `missile.destroy()` 之后
    // `getPosition()` 读的是一具正在被回收的实体。
    const explosionPos = missile.getPosition().clone();

    this.applyExplosionDamage(explosionPos);

    const explosion = new pc.Entity('explosion');
    explosion.setPosition(explosionPos);

    // colorMap：镜头光晕贴图（中心亮点 + 横向光条），配橙色曲线做技能爆闪
    this.engine.addParticleSystem(explosion, {
      lifetime: 0.5,
      rate: 0,
      // Engine 2：burst 已从引擎中彻底移除，一次喷发 N 个的写法改为 loop:false + numParticles
      loop: false,
      numParticles: 50,
      // Engine 2：speed 改名为 initialVelocity
      initialVelocity: 8,
      // Engine 2：直接传曲线本体，并去掉会破坏曲线分组的 'color' 第二参数
      colorGraph: new pc.CurveSet([
        [1, 0.5, 0.2],
        [1, 0.3, 0.1],
        [0.5, 0.2, 0],
        [0, 0, 0],
      ]),
      scaleGraph: new pc.Curve([0.5, 1.5, 2]),
      colorMapUrl: PlayCanvasGameEngine.PARTICLE_TEXTURES.skillFlare,
    });

    this.engine.addToScene(explosion);
    explosion.particlesystem?.play();

    this.schedule(() => explosion.destroy(), 500);

    const missileIndex = this.missiles.indexOf(missile);
    if (missileIndex > -1) {
      this.missiles.splice(missileIndex, 1);
      // 方向与时长必须与实体同步出册：三个数组是平行的，错位一次就会让后面的导弹
      // 全部按前一枚的方向飞、按前一枚的进度引爆。
      this.missileDirections.splice(missileIndex, 1);
      this.missileElapsed.splice(missileIndex, 1);
    }

    missile.destroy();
  }

  protected override endSkill(): void {
    super.endSkill();
    // 施放结束 → 允许下一次 activate 重新发一轮。放在这里而不是 `activate()`
    // 里，是因为「一轮」的边界就是持续期，两者写成同一个事实更不容易错开。
    this.fired = false;
    this.clearAllTimers();
    this.missiles.forEach((m) => m.destroy());
    this.missiles = [];
    this.missileDirections = [];
    this.missileElapsed = [];
  }

  public override destroy(): void {
    // 顺序有讲究：`super.destroy()` 先立起 disposed 闸门，再清定时器，最后收实体。
    super.destroy();
    this.clearAllTimers();
    this.missiles.forEach((m) => m.destroy());
    this.missiles = [];
    this.missileDirections = [];
    this.missileElapsed = [];
  }
}

export class ShieldBurstSkill extends Skill {
  private shieldPulse: pc.Entity | null = null;

  constructor(player: PlayerShip, engine: PlayCanvasGameEngine) {
    super(player, engine, SKILL_SLOT_CONFIGS[SkillType.SHIELD_BURST]);
  }

  protected override executeSkillEffect(_dt: number): void {
    if (this.disposed) return;

    if (!this.shieldPulse) {
      this.player.addShield(50 + this.state.level * 25);
      this.createShieldPulse();
    }

    const scale = 1 + (1 - this.state.durationRemaining / this.config.duration) * 5;
    this.shieldPulse?.setLocalScale(scale, scale, scale);
  }

  private createShieldPulse(): void {
    this.shieldPulse = new pc.Entity('shieldPulse');
    this.shieldPulse.setPosition(this.player.getPosition());

    const material = new pc.StandardMaterial();
    material.diffuse.set(0.2, 0.5, 1);
    material.emissive.set(0.2, 0.5, 1);
    material.opacity = 0.5;
    material.blendType = pc.BLEND_ADDITIVEALPHA;
    material.update();

    this.shieldPulse.addComponent('model', { type: 'sphere' });
    if (this.shieldPulse.model) this.shieldPulse.model.material = material;

    this.engine.addToScene(this.shieldPulse);
  }

  protected override endSkill(): void {
    super.endSkill();
    if (this.shieldPulse) {
      this.shieldPulse.destroy();
      this.shieldPulse = null;
    }
  }
}

export class TimeSlowSkill extends Skill {
  constructor(player: PlayerShip, engine: PlayCanvasGameEngine) {
    super(player, engine, SKILL_SLOT_CONFIGS[SkillType.TIME_SLOW]);
  }

  protected override executeSkillEffect(_dt: number): void {
    // Time slow effect is handled by the game speed modifier
  }

  public getTimeScale(): number {
    if (!this.state.isActive) return 1;
    return 0.3 + (this.state.level - 1) * 0.1;
  }
}

export class OverdriveSkill extends Skill {
  constructor(player: PlayerShip, engine: PlayCanvasGameEngine) {
    super(player, engine, SKILL_SLOT_CONFIGS[SkillType.OVERDRIVE]);
  }

  protected override executeSkillEffect(_dt: number): void {
    // Speed boost is handled by the player
  }

  public getSpeedMultiplier(): number {
    if (!this.state.isActive) return 1;
    return 2 + (this.state.level - 1) * 0.5;
  }

  public getFireRateMultiplier(): number {
    if (!this.state.isActive) return 1;
    return 1.5 + (this.state.level - 1) * 0.25;
  }

  protected override onUpgrade(): void {
    // Recalculate multipliers
  }
}

export interface SkillSystemOptions {
  /**
   * 已授予的解锁 id 集合。缺省读 `UnlockRegistry`（即按通关记录现算）。
   *
   * 注入这个参数的两个理由：① 单测可以造出「只解锁了导弹」这类中间态，
   * 不必真的去写 localStorage；② `GameScene` 已经为 HUD 读过一次快照，
   * 复用同一份可以保证「HUD 显示已解锁」与「技能真的能放」永远是同一个判断。
   */
  grantedUnlockIds?: ReadonlySet<string>;
  /**
   * 技能作用于世界的查询口。缺省 null —— 此时技能只播特效、不结算伤害
   * （单测与尚未接线的场景走这条路，不会因为缺敌人系统而抛错）。
   */
  world?: SkillWorld;
}

export class SkillSystem {
  private skills: Map<SkillType, Skill> = new Map();
  private activeSkills: Set<SkillType> = new Set();
  /** 已销毁。销毁后 `skills` 表会被清空，此时再查表 miss 不是"词表错位"，不应刷告警。 */
  private destroyed = false;
  /**
   * 技能真正被激活时的回调（由 GameScene 接到成就系统）。
   *
   * 用回调而不是让引擎模块直接 import 成就系统：`SkillSystem` 保持无存储依赖，
   * 与 `StoryMissionManager.subscribe` 同一套做法。
   */
  private onSkillActivated: ((type: SkillType) => void) | null = null;
  /** 本局已解锁的技能 id。未解锁的槽位连 `Skill` 对象都不创建。 */
  private granted: ReadonlySet<string>;
  /** 技能作用于世界的查询口（透传给需要结算伤害的技能）。 */
  private world: SkillWorld | null;

  /**
   * 技能按**通关进度**解锁：只有已解锁的技能才会被注册。
   *
   * 接线前这里是四行无条件 `registerSkill`，于是 `rewards.unlocks` 里的
   * `skill-missile-strike` / `skill-shield-burst` / `skill-time-slow` / `skill-overdrive`
   * 四条完全没有下游 —— 玩家从第一关起就握着全部 4 个技能，
   * 「通关第 2 关解锁导弹打击」只是一句日志。
   *
   * 代价要说清楚：**全新存档在第 1 关没有技能**（第 1 关的奖励是初始舰体）。
   * 这是「十关交替给舰体/技能」这条序列的必然结果，而不是疏漏。
   */
  constructor(player: PlayerShip, engine: PlayCanvasGameEngine, options: SkillSystemOptions = {}) {
    this.granted = options.grantedUnlockIds ?? getGrantedUnlockIds();
    this.world = options.world ?? null;

    const factories: Record<ImplementedSkillType, () => Skill> = {
      [SkillType.MISSILE_STRIKE]: () => new MissileStrikeSkill(player, engine, this.world),
      [SkillType.SHIELD_BURST]: () => new ShieldBurstSkill(player, engine),
      [SkillType.TIME_SLOW]: () => new TimeSlowSkill(player, engine),
      [SkillType.OVERDRIVE]: () => new OverdriveSkill(player, engine),
    };

    for (const type of SKILL_SLOT_ORDER) {
      if (!isSkillUnlocked(type, this.granted)) continue;
      this.registerSkill(factories[type]());
    }
  }

  private registerSkill(skill: Skill): void {
    this.skills.set(skill.getConfig().type, skill);
  }

  public update(dt: number): void {
    this.skills.forEach((skill, type) => {
      skill.update(dt);
      if (skill.getState().isActive) {
        this.activeSkills.add(type);
      } else {
        this.activeSkills.delete(type);
      }
    });
  }

  /**
   * 注册「技能已激活」回调；传 `null` 注销。
   *
   * 存在的原因：`AchievementStats.skillsUsed` 此前**没有任何供给方** ——
   * 「技能大师 / 导弹专家 / 护盾大师」三条成就因此永远点不亮。这里是它们的上游。
   */
  public setOnSkillActivated(cb: ((type: SkillType) => void) | null): void {
    this.onSkillActivated = cb;
  }

  public activateSkill(type: SkillType): boolean {
    const skill = this.skills.get(type);
    if (!skill) {
      // 两种情况都会 miss，但**只有一种该吵**：
      //
      // ① 本次会话尚未解锁（`rewards.unlocks` 没给）—— 正常的门控失效，静默返回 false。
      //    键盘 Q/E/T/G 会走到这里，HUD 的锁定槽位也会（按钮已 disabled，但键盘仍可触发）。
      //    这里不该刷告警，否则「没解锁」会被误报成「词表错位」。
      // ② 真的传了不存在的 id —— 必须吵。曾经的不吵版本掩盖了一个真缺陷：调用方在
      //    触屏/HUD 路径传 snake_case 字符串（`'missile_strike'`）并用 `as SkillType`
      //    绕过类型检查，于是查表恒 miss、静默返回 false —— 4 个技能里 3 个点了没反应。
      //    （已销毁时 `skills` 表已被清空，那次 miss 属正常，同样不刷告警。）
      const implemented = (SKILL_SLOT_ORDER as readonly SkillType[]).includes(type);
      if (implemented) return false;
      if (!this.destroyed) {
        console.warn(
          `[SkillSystem] 未知技能 id "${type}"，忽略激活。` +
            `已知 id：${SKILL_SLOT_ORDER.join(' / ')}。` +
            `调用方应使用 skillSlots 的 SKILL_SLOT_ORDER / SkillType 枚举，不要写字符串字面量。`,
        );
      }
      return false;
    }

    const activated = skill.activate();
    // 只在**真的激活成功**时计数（冷却中返回 false 不算用过）
    if (activated && this.onSkillActivated) {
      this.onSkillActivated(type);
    }
    return activated;
  }

  /**
   * 4 个槽位（Q/E/T/G）的当前状态快照。
   *
   * 供 `__skillDebug.skills()` 观测 —— 读的是 `SkillSystem` 内部的 `Skill` 对象，
   * 而不是 store 里那份「供 HUD 显示」的冷却副本。这两者曾经口径不一致
   * （store 写死 8/10/15/20、技能真实冷却 15/20/30/25），必须能分辨谁是真值。
   */
  public getSlotSnapshot(): Array<{
    index: number;
    type: SkillType;
    name: string;
    registered: boolean;
    /** 本局是否已解锁（未解锁 = 本关还没拿到它）。 */
    unlocked: boolean;
    /** 授予它的关卡（1 基；0 = 没有关卡授予，属数据问题）。 */
    unlockLevel: number;
    isActive: boolean;
    cooldownRemaining: number;
    cooldownTotal: number;
    durationRemaining: number;
    ready: boolean;
    level: number;
  }> {
    return SKILL_SLOT_ORDER.map((type, index) => {
      const skill = this.skills.get(type);
      const state = skill?.getState();
      const unlocked = isSkillUnlocked(type, this.granted);
      return {
        index,
        type,
        // 技能名（真源）。带着它是为了让 e2e 能断言"HUD 上显示的名字 === 真源名字"，
        // 而不是在脚本里再抄一份中文名 —— 抄一份就多一个会漂移的地方。
        // 未注册时也要给出名字：HUD 的锁定槽位同样要显示它叫什么。
        name:
          skill?.getConfig().name ?? SKILL_SLOT_CONFIGS[type as ImplementedSkillType]?.name ?? '',
        registered: !!skill,
        unlocked,
        unlockLevel: getUnlockLevel(skillUnlockId(type)),
        isActive: state?.isActive ?? false,
        cooldownRemaining: state ? Number(state.cooldownRemaining.toFixed(3)) : -1,
        cooldownTotal: skill?.getConfig().cooldown ?? -1,
        durationRemaining: state ? Number(state.durationRemaining.toFixed(3)) : -1,
        ready: skill?.isReady() ?? false,
        level: state?.level ?? -1,
      };
    });
  }

  public upgradeSkill(type: SkillType): boolean {
    const skill = this.skills.get(type);
    if (!skill) return false;

    return skill.upgrade();
  }

  public getSkill(type: SkillType): Skill | undefined {
    return this.skills.get(type);
  }

  public getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  public getActiveSkills(): SkillType[] {
    return Array.from(this.activeSkills);
  }

  public isSkillActive(type: SkillType): boolean {
    return this.activeSkills.has(type);
  }

  public getTimeScale(): number {
    const timeSlow = this.skills.get(SkillType.TIME_SLOW) as TimeSlowSkill;
    if (timeSlow) {
      return timeSlow.getTimeScale();
    }
    return 1;
  }

  public getSpeedMultiplier(): number {
    const overdrive = this.skills.get(SkillType.OVERDRIVE) as OverdriveSkill;
    if (overdrive) {
      return overdrive.getSpeedMultiplier();
    }
    return 1;
  }

  public getFireRateMultiplier(): number {
    const overdrive = this.skills.get(SkillType.OVERDRIVE) as OverdriveSkill;
    if (overdrive) {
      return overdrive.getFireRateMultiplier();
    }
    return 1;
  }

  public destroy(): void {
    this.destroyed = true;
    this.skills.forEach((skill) => skill.destroy());
    this.skills.clear();
    this.activeSkills.clear();
  }
}
