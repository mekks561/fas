import * as pc from 'playcanvas';
import { CapitalShip, EnemyConfig, EnemyProjectile } from './Enemy';
import { BlackHoleSystem } from './BlackHoleSystem';
import { resolveVoidPhase } from './CapitalSubsystems';

/**
 * 2026 Tech: 终极 Boss - 虚空之主 (Void Lord)。
 *
 * v2.8 Phase 2：迁移为母舰原型。
 * - 继承 `CapitalShip` 的 5 子系统损毁模型、命中路由、炮塔与机库行为。
 * - 阶段不再按纯血量阈值切换，而由「毁伤组合」解锁（见 `resolveVoidPhase`）。
 * - 保留引力场、虚空射线、弹幕散射与引力坍缩弹。
 */
export class VoidLordBoss extends CapitalShip {
  private blackHoleSystem: BlackHoleSystem | null = null;
  private lastVoidPhase: 1 | 2 | 3 = 1;
  private singularityActive: boolean = false;

  private gravityRadius = 120;
  private gravityStrength = 30;

  constructor(config: EnemyConfig) {
    super(config);
    this.blackHoleSystem = (this.engine.getApp() as any)['blackHoleSystem'] ?? null;
    console.log('[VoidLordBoss] The Void Lord has arrived (capital ship prototype).');
  }

  /** 当前阶段由子系统毁伤组合推导，不再依赖血量阈值 */
  private getVoidPhase(): 1 | 2 | 3 {
    const reactor = this.getSubsystemState('reactor');
    const weapons = this.getSubsystemState('weapons');

    return resolveVoidPhase({
      destroyedCount: this.getDestroyedSubsystemCount(),
      reactorDestroyed: reactor?.isDestroyed === true,
      weaponsHealthRatio: weapons ? weapons.health / weapons.maxHealth : 1,
    });
  }

  public override update(dt: number): void {
    super.update(dt);
    if (!this.isAlive()) return;

    const phase = this.getVoidPhase();
    if (phase !== this.lastVoidPhase) {
      this.onVoidPhaseChanged(phase);
    }

    if (phase === 3) {
      this.updateGravityField();
    }
  }

  private onVoidPhaseChanged(phase: 1 | 2 | 3): void {
    this.lastVoidPhase = phase;

    if (phase === 2) {
      this.phaseSpeedMultiplier = 1.5;
      this.attackCooldown *= 0.7;
      this.engine.createExplosion?.(this.entity.getPosition(), 2.0);
      console.log('[VoidLordBoss] Phase 2: Subsystem breach. Barrage protocol engaged.');
      return;
    }

    if (phase === 3) {
      this.phaseSpeedMultiplier = 0.5; // 变为固定核心
      this.attackCooldown *= 0.5;
      this.activateSingularity();
      console.log('[VoidLordBoss] Phase 3: Singularity stabilized. All will be consumed.');
    }
  }

  /** 进入坍缩态：注册引力源并把舰体染成深紫 */
  private activateSingularity(): void {
    if (this.singularityActive) return;
    this.singularityActive = true;

    this.blackHoleSystem?.registerBlackHole(this.entity);

    const renders = this.entity.findComponents('render') as pc.RenderComponent[];
    renders.forEach((r) => {
      r.meshInstances.forEach((mi) => {
        const mat = mi.material as pc.StandardMaterial;
        if (mat) {
          mat.diffuse.set(0, 0, 0);
          mat.emissive.set(0.5, 0, 1.0);
          mat.update();
        }
      });
    });
  }

  private updateGravityField(): void {
    const playerPos = this.player.getPosition();
    const bossPos = this.entity.getPosition();
    const dist = bossPos.distance(playerPos);

    if (dist >= this.gravityRadius) return;

    // 强力牵引
    const dir = bossPos.clone().sub(playerPos).normalize();
    const force = dir.mulScalar(this.gravityStrength * (1 - dist / this.gravityRadius));
    this.player.applyExternalForce(force);

    // 周期性引力脉冲
    if (Math.sin(Date.now() * 0.005) > 0.95) {
      this.player.takeDamage(5);
      this.engine.createExplosion?.(playerPos, 0.5);
    }
  }

  /** 舰桥被毁后失去精确火控，落点大幅偏移 */
  private getAimPoint(): pc.Vec3 {
    const target = this.player.getPosition().clone();

    if (this.getSubsystemState('bridge')?.isDestroyed) {
      target.add(
        new pc.Vec3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
        ),
      );
    }

    return target;
  }

  protected override attack(): void {
    const phase = this.getVoidPhase();

    // 坍缩态只发射引力弹，与武器阵列无关
    if (phase === 3) {
      this.fireSingularityProjectiles();
      return;
    }

    // 武器阵列被毁 → 射线与弹幕全部停摆
    if (this.getSubsystemState('weapons')?.isDestroyed) return;

    if (phase === 2) {
      this.fireBarrage();
    } else {
      this.fireHeavyBeam();
    }
  }

  private fireHeavyBeam(): void {
    const playerPos = this.getAimPoint();
    const bossPos = this.entity.getPosition();
    const dir = playerPos.clone().sub(bossPos).normalize();

    // 2026 Tech: 虚空射线视觉与物理逻辑
    const beamEntity = new pc.Entity('void_beam');
    const mat = new pc.StandardMaterial();
    mat.diffuse.set(0.2, 0, 0.5);
    mat.emissive.set(0.5, 0, 1.0);
    mat.emissiveIntensity = 5.0;
    mat.update();

    beamEntity.addComponent('model', { type: 'cylinder' });
    if (beamEntity.model) beamEntity.model.material = mat;

    beamEntity.setLocalScale(0.8, 100, 0.8);
    beamEntity.setPosition(bossPos.clone().add(dir.clone().mulScalar(50)));
    beamEntity.lookAt(playerPos);
    beamEntity.rotateLocal(90, 0, 0); // 调整圆柱体方向

    this.engine.addToScene(beamEntity);

    // 射线是瞬间或持续伤害，这里用一个高初速子弹模拟
    const projectile = new EnemyProjectile(beamEntity, this.damage * 1.2, dir.mulScalar(200));
    projectile.lifetime = 0.5; // 短寿命，模拟射线
    this.newProjectiles.push(projectile);

    this.engine.createExplosion?.(bossPos, 1.0);
    console.log('[VoidLordBoss] Firing Heavy Void Beam');
  }

  private fireBarrage(): void {
    console.log('[VoidLordBoss] Firing Rapid Barrage');
    const playerPos = this.getAimPoint();
    const bossPos = this.entity.getPosition();

    // 散射弹幕
    for (let i = 0; i < 8; i++) {
      const offset = new pc.Vec3(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
      );
      const dir = playerPos.clone().sub(bossPos).add(offset).normalize();

      const projEntity = new pc.Entity('void_shard');
      const mat = new pc.StandardMaterial();
      mat.diffuse.set(0.5, 0, 0.8);
      mat.emissive.set(1.0, 0, 1.0);
      mat.update();

      projEntity.addComponent('model', { type: 'box' });
      if (projEntity.model) projEntity.model.material = mat;
      projEntity.setLocalScale(0.4, 0.4, 1.2);
      projEntity.setPosition(bossPos);
      projEntity.lookAt(playerPos);

      this.engine.addToScene(projEntity);

      const projectile = new EnemyProjectile(projEntity, this.damage * 0.3, dir.mulScalar(60));
      this.newProjectiles.push(projectile);
    }
  }

  private fireSingularityProjectiles(): void {
    console.log('[VoidLordBoss] Launching Singularity Projectiles');
    const playerPos = this.getAimPoint();
    const bossPos = this.entity.getPosition();
    const dir = playerPos.clone().sub(bossPos).normalize();

    // 引力子弹：深紫色球体，带有引力拖拽效果（由 EnemyProjectile 逻辑支持或在此模拟）
    const projEntity = new pc.Entity('singularity_proj');
    const mat = new pc.StandardMaterial();
    mat.diffuse.set(0, 0, 0);
    mat.emissive.set(0.8, 0, 1.0);
    mat.emissiveIntensity = 3.0;
    mat.update();

    projEntity.addComponent('model', { type: 'sphere' });
    if (projEntity.model) projEntity.model.material = mat;
    projEntity.setLocalScale(2, 2, 2);
    projEntity.setPosition(bossPos);

    this.engine.addToScene(projEntity);

    const projectile = new EnemyProjectile(projEntity, this.damage * 2.0, dir.mulScalar(40));
    this.newProjectiles.push(projectile);
  }
}
