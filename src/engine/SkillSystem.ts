import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';

import {
  SKILL_SLOT_CONFIGS,
  SKILL_SLOT_ORDER,
  SkillType,
  type SkillConfig,
  type SkillState,
} from './skillSlots';

/**
 * 技能 id / 配置的形状与数值**不在这里定义** —— 唯一真源是 `./skillSlots`。
 *
 * 这里只做再导出，保证既有 `import { SkillType } from './SkillSystem'` 的调用点不动。
 * 数值与槽位顺序的改动一律去 `skillSlots.ts`（连同 HUD 冷却环、store 冷却上限一起生效）。
 */
export { SkillType } from './skillSlots';
export type { SkillConfig, SkillState } from './skillSlots';

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
  private missiles: pc.Entity[] = [];
  private targetPositions: pc.Vec3[] = [];
  /**
   * 未到期的定时器 / 周期任务，销毁时必须一次性清空。
   *
   * 这是一次实测抓到的未捕获异常的真凶（e2e：`verify-skill-activation.mjs` 第 7 段）：
   * 一次导弹打击会排出「1.5s 后逐枚爆炸」的 setTimeout，而这批导弹在 1.5s 全部爆完后，
   * 技能还在持续期内 → `executeSkillEffect` 又补了一轮。第二轮的定时器要到 3s 才到期，
   * 而那时玩家往往已经离开关卡、引擎已 `destroy()`：
   * `explodeMissile` → `new pc.Entity('explosion')` → `addComponent('particlesystem')`
   * → PlayCanvas 内部读 `this._app.systems` 时 `_app` 为 null →
   * **每一枚导弹一条 `Cannot read properties of null (reading 'systems')`**（实测 10 条）。
   */
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private intervals = new Set<ReturnType<typeof setInterval>>();

  constructor(player: PlayerShip, engine: PlayCanvasGameEngine) {
    super(player, engine, SKILL_SLOT_CONFIGS[SkillType.MISSILE_STRIKE]);
  }

  protected override executeSkillEffect(_dt: number): void {
    if (this.disposed) return;
    if (this.missiles.length > 0) return;

    const missileCount = 5 + this.state.level * 2;

    for (let i = 0; i < missileCount; i++) {
      const missile = this.createMissile(i, missileCount);
      this.missiles.push(missile);

      this.schedule(() => this.explodeMissile(missile), 1500);
    }
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

  /** 清空所有未到期的定时器与周期任务。 */
  private clearAllTimers(): void {
    this.timers.forEach((id) => clearTimeout(id));
    this.timers.clear();
    this.intervals.forEach((id) => clearInterval(id));
    this.intervals.clear();
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
    this.targetPositions.push(targetPos);

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

    const moveInterval = setInterval(() => {
      if (!missile.parent) {
        clearInterval(moveInterval);
        this.intervals.delete(moveInterval);
        return;
      }

      const currentPos = missile.getPosition();
      const newPos = currentPos.clone().add(direction.clone().scale(30 * 0.016));
      missile.setPosition(newPos);
    }, 16);
    this.intervals.add(moveInterval);

    this.schedule(() => {
      clearInterval(moveInterval);
      this.intervals.delete(moveInterval);
    }, 1500);

    return missile;
  }

  private explodeMissile(missile: pc.Entity): void {
    // 两道闸门，缺一不可：
    //  ① `disposed` —— 技能/引擎已销毁，绝不能再 new 实体；
    //  ② 导弹已不在 `this.missiles` 里 —— 说明它已被 `endSkill()` 或 `destroy()` 收走，
    //     此时它的定时器只是"迟到的回声"，**必须丢弃**，否则就是上面注释里那串 TypeError。
    if (this.disposed) return;
    if (this.missiles.indexOf(missile) === -1) return;

    const explosion = new pc.Entity('explosion');
    explosion.setPosition(missile.getPosition());

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
    }

    missile.destroy();
  }

  protected override endSkill(): void {
    super.endSkill();
    // 必须先清定时器再收导弹：慢了的话，"迟到的爆炸回调"会看到导弹仍在名单里而继续
    // 走 `new pc.Entity` 的老路（这正是上面那串 TypeError 的成因之一）。
    this.clearAllTimers();
    this.missiles.forEach((m) => m.destroy());
    this.missiles = [];
    this.targetPositions = [];
  }

  public override destroy(): void {
    // 顺序有讲究：`super.destroy()` 先立起 disposed 闸门，再清定时器，最后收实体。
    super.destroy();
    this.clearAllTimers();
    this.missiles.forEach((m) => m.destroy());
    this.missiles = [];
    this.targetPositions = [];
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

  constructor(player: PlayerShip, engine: PlayCanvasGameEngine) {
    this.registerSkill(new MissileStrikeSkill(player, engine));
    this.registerSkill(new ShieldBurstSkill(player, engine));
    this.registerSkill(new TimeSlowSkill(player, engine));
    this.registerSkill(new OverdriveSkill(player, engine));
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
      // 这里**必须吵**。曾经的不吵版本掩盖了一个真缺陷：调用方在触屏/HUD 路径传的是
      // snake_case 字符串（`'missile_strike'`）并用 `as SkillType` 绕过类型检查，
      // 于是查表恒 miss、静默返回 false —— 4 个技能里 3 个点了没反应，而控制台一片安静。
      // 现在未知 id 会打出已知 id 列表，下次同类错误在第一次点击时就暴露。
      // （已销毁时 `skills` 表已被清空，那次 miss 属正常，不刷告警。）
      if (!this.destroyed) {
        console.warn(
          `[SkillSystem] 未知技能 id "${type}"，忽略激活。` +
            `已知 id：${Array.from(this.skills.keys()).join(' / ')}。` +
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
    registered: boolean;
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
      return {
        index,
        type,
        registered: !!skill,
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
