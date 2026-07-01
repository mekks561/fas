import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';

export enum SkillType {
  MISSILE_STRIKE = 'missileStrike',
  SHIELD_BURST = 'shieldBurst',
  TIME_SLOW = 'timeSlow',
  EMP_BURST = 'empBurst',
  REPAIR_DRONE = 'repairDrone',
  OVERDRIVE = 'overdrive'
}

export interface SkillConfig {
  type: SkillType;
  name: string;
  description: string;
  cooldown: number;
  duration: number;
  icon: string;
  keyBinding: string;
}

export interface SkillState {
  isActive: boolean;
  cooldownRemaining: number;
  durationRemaining: number;
  level: number;
  maxLevel: number;
}

export class Skill {
  protected config: SkillConfig;
  protected state: SkillState;
  protected player: PlayerShip;
  protected engine: PlayCanvasGameEngine;
  protected effectEntity: pc.Entity | null = null;
  
  constructor(
    player: PlayerShip,
    engine: PlayCanvasGameEngine,
    config: SkillConfig
  ) {
    this.player = player;
    this.engine = engine;
    this.config = config;
    
    this.state = {
      isActive: false,
      cooldownRemaining: 0,
      durationRemaining: 0,
      level: 1,
      maxLevel: 3
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
  
  protected executeSkillEffect(dt: number): void {
  }
  
  public activate(): boolean {
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
  
  protected onUpgrade(): void {
  }
  
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
    return 1 - (this.state.cooldownRemaining / this.config.cooldown);
  }
  
  public isReady(): boolean {
    return this.state.cooldownRemaining <= 0 && !this.state.isActive;
  }
  
  public destroy(): void {
    this.removeEffect();
  }
}

export class MissileStrikeSkill extends Skill {
  private missiles: pc.Entity[] = [];
  private targetPositions: pc.Vec3[] = [];
  
  constructor(player: PlayerShip, engine: PlayCanvasGameEngine) {
    super(player, engine, {
      type: SkillType.MISSILE_STRIKE,
      name: '导弹打击',
      description: '发射多枚导弹攻击前方敌人',
      cooldown: 15,
      duration: 2,
      icon: 'missile',
      keyBinding: 'Q'
    });
  }
  
  protected executeSkillEffect(dt: number): void {
    if (this.missiles.length > 0) return;
    
    const missileCount = 5 + this.state.level * 2;
    
    for (let i = 0; i < missileCount; i++) {
      const missile = this.createMissile(i, missileCount);
      this.missiles.push(missile);
      
      setTimeout(() => {
        this.explodeMissile(missile);
      }, 1500);
    }
  }
  
  private createMissile(index: number, total: number): pc.Entity {
    const playerPos = this.player.getPosition();
    const playerForward = this.getPlayerForward();
    
    const spread = 10;
    const angle = (index / total) * Math.PI - Math.PI / 2;
    const offset = new pc.Vec3(
      Math.sin(angle) * spread,
      (Math.random() - 0.5) * 5,
      Math.cos(angle) * spread * 0.5
    );
    
    const targetPos = playerPos.clone().add(playerForward.clone().scale(50)).add(offset);
    this.targetPositions.push(targetPos);
    
    const missile = new pc.Entity('missile');
    
    const material = new pc.StandardMaterial();
    material.diffuse.set(1, 0.3, 0.3);
    material.emissive.set(0.8, 0.2, 0.2);
    material.update();
    
    missile.addComponent('model', { type: 'cone' });
    missile.model!.material = material;
    missile.setLocalEulerAngles(-90, 0, 0);
    
    const startPos = playerPos.clone().add(new pc.Vec3(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 5
    ));
    missile.setPosition(startPos);
    
    this.engine.addToScene(missile);
    
    const direction = targetPos.clone().sub(startPos).normalize();
    missile.lookAt(startPos.clone().add(direction));
    
    const moveInterval = setInterval(() => {
      if (!missile.parent) {
        clearInterval(moveInterval);
        return;
      }
      
      const currentPos = missile.getPosition();
      const newPos = currentPos.clone().add(direction.clone().scale(30 * 0.016));
      missile.setPosition(newPos);
    }, 16);
    
    setTimeout(() => clearInterval(moveInterval), 1500);
    
    return missile;
  }
  
  private explodeMissile(missile: pc.Entity): void {
    const explosion = new pc.Entity('explosion');
    explosion.setPosition(missile.getPosition());
    
    explosion.addComponent('particlesystem', {
      lifetime: 0.5,
      rate: 0,
      burst: 50,
      speed: 8,
      spread: 360,
      colorGraph: {
        graph: new pc.CurveSet([[1, 0.5, 0.2], [1, 0.3, 0.1], [0.5, 0.2, 0], [0, 0, 0]], 'color')
      },
      sizeGraph: {
        graph: new pc.Curve([0.5, 1.5, 2], 'size')
      }
    });
    
    this.engine.addToScene(explosion);
    explosion.particlesystem?.start();
    
    setTimeout(() => explosion.destroy(), 500);
    
    const missileIndex = this.missiles.indexOf(missile);
    if (missileIndex > -1) {
      this.missiles.splice(missileIndex, 1);
    }
    
    missile.destroy();
  }
  
  protected endSkill(): void {
    super.endSkill();
    this.missiles.forEach(m => m.destroy());
    this.missiles = [];
    this.targetPositions = [];
  }
}

export class ShieldBurstSkill extends Skill {
  private shieldPulse: pc.Entity | null = null;
  
  constructor(player: PlayerShip, engine: PlayCanvasGameEngine) {
    super(player, engine, {
      type: SkillType.SHIELD_BURST,
      name: '护盾爆发',
      description: '瞬间恢复护盾并释放冲击波',
      cooldown: 20,
      duration: 0.5,
      icon: 'shield',
      keyBinding: 'E'
    });
  }
  
  protected executeSkillEffect(dt: number): void {
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
    this.shieldPulse.model!.material = material;
    
    this.engine.addToScene(this.shieldPulse);
  }
  
  protected endSkill(): void {
    super.endSkill();
    if (this.shieldPulse) {
      this.shieldPulse.destroy();
      this.shieldPulse = null;
    }
  }
}

export class TimeSlowSkill extends Skill {
  constructor(player: PlayerShip, engine: PlayCanvasGameEngine) {
    super(player, engine, {
      type: SkillType.TIME_SLOW,
      name: '时间减缓',
      description: '减缓所有敌人的移动和攻击速度',
      cooldown: 30,
      duration: 5,
      icon: 'time',
      keyBinding: 'T'
    });
  }
  
  protected executeSkillEffect(dt: number): void {
    // Time slow effect is handled by the game speed modifier
  }
  
  public getTimeScale(): number {
    if (!this.state.isActive) return 1;
    return 0.3 + (this.state.level - 1) * 0.1;
  }
}

export class OverdriveSkill extends Skill {
  private originalSpeed: number = 0;
  
  constructor(player: PlayerShip, engine: PlayCanvasGameEngine) {
    super(player, engine, {
      type: SkillType.OVERDRIVE,
      name: '过载驱动',
      description: '大幅提升移动速度和武器射速',
      cooldown: 25,
      duration: 4,
      icon: 'overdrive',
      keyBinding: 'G'
    });
  }
  
  protected executeSkillEffect(dt: number): void {
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
  
  protected onUpgrade(): void {
    // Recalculate multipliers
  }
}

export class SkillSystem {
  private skills: Map<SkillType, Skill> = new Map();
  private activeSkills: Set<SkillType> = new Set();
  
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
  
  public activateSkill(type: SkillType): boolean {
    const skill = this.skills.get(type);
    if (!skill) return false;
    
    return skill.activate();
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
    this.skills.forEach(skill => skill.destroy());
    this.skills.clear();
    this.activeSkills.clear();
  }
}