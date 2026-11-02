import * as pc from 'playcanvas';
import { Enemy, EnemyConfig, EnemyProjectile } from './Enemy';
import { MeshTearingSystem } from './MeshTearingSystem';
import { BlackHoleSystem } from './BlackHoleSystem';

/**
 * 2026 Tech: 终极 Boss - 虚空之主 (Void Lord)。
 * 具备多阶段变换、引力场控制与 WebGPU 网格撕裂效果。
 */
export class VoidLordBoss extends Enemy {
  private phase: 1 | 2 | 3 = 1;
  private meshTearing: MeshTearingSystem | null = null;
  private blackHoleSystem: BlackHoleSystem | null = null;
  private phaseThresholds = {
    phase2: 0.7, // 70% 血量进入二阶段
    phase3: 0.3  // 30% 血量进入三阶段
  };
  
  private gravityRadius = 100;
  private gravityStrength = 30;
  private singularityEntity: pc.Entity | null = null;
  private newProjectiles: EnemyProjectile[] = [];

  constructor(config: EnemyConfig) {
    super(config);
    this.setupBossSystems();
    console.log('[VoidLordBoss] The Void Lord has arrived.');
  }

  private setupBossSystems(): void {
    const app = this.engine.getApp();
    const damageSystem = (app as any)._webgpuDamageSystem;
    
    if (damageSystem) {
      this.meshTearing = new MeshTearingSystem(app, damageSystem);
      this.meshTearing.applyToEntity(this.entity);
    }

    this.blackHoleSystem = (app as any)._blackHoleSystem;
  }

  public override takeDamage(amount: number): void {
    super.takeDamage(amount);
    this.checkPhaseTransition();
  }

  private checkPhaseTransition(): void {
    const healthRatio = this.health / this.maxHealth;

    if (this.phase === 1 && healthRatio <= this.phaseThresholds.phase2) {
      this.enterPhase2();
    } else if (this.phase === 2 && healthRatio <= this.phaseThresholds.phase3) {
      this.enterPhase3();
    }
  }

  private enterPhase2(): void {
    this.phase = 2;
    this.speed *= 1.5;
    this.attackCooldown *= 0.7;
    console.log('[VoidLordBoss] Phase 2: Armor ruptured. Increasing aggression.');
    
    // 触发视觉特效：外壳剥落感
    this.engine.createExplosion?.(this.entity.getPosition(), 2.0);
  }

  private enterPhase3(): void {
    this.phase = 3;
    this.speed *= 0.5; // 变为固定核心
    this.attackCooldown *= 0.5;
    console.log('[VoidLordBoss] Phase 3: Singularity stabilized. All will be consumed.');

    // 注册为黑洞实体，开始产生引力影响
    if (this.blackHoleSystem) {
      this.blackHoleSystem.registerBlackHole(this.entity);
    }
    
    // 改变颜色为深紫色/黑色
    const renders = this.entity.findComponents('render') as pc.RenderComponent[];
    renders.forEach(r => {
      r.meshInstances.forEach(mi => {
        const mat = mi.material as pc.StandardMaterial;
        if (mat) {
          mat.diffuse.set(0, 0, 0);
          mat.emissive.set(0.5, 0, 1.0);
          mat.update();
        }
      });
    });
  }

  public override update(dt: number): void {
    super.update(dt);
    if (!this.isAlive()) return;

    // 更新网格撕裂效果
    if (this.meshTearing) {
      this.meshTearing.update(this.entity);
    }

    // 三阶段引力波攻击
    if (this.phase === 3) {
      this.updateGravityField(dt);
    }
  }

  private updateGravityField(dt: number): void {
    const playerPos = this.player.getPosition();
    const bossPos = this.entity.getPosition();
    const dist = bossPos.distance(playerPos);

    if (dist < this.gravityRadius) {
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
  }

  protected override attack(): void {
    if (this.phase === 1) {
      // 重型能量束
      this.fireHeavyBeam();
    } else if (this.phase === 2) {
      // 弹幕散射
      this.fireBarrage();
    } else {
      // 引力坍缩弹
      this.fireSingularityProjectiles();
    }
  }

  private fireHeavyBeam(): void {
    const playerPos = this.player.getPosition();
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
    const playerPos = this.player.getPosition();
    const bossPos = this.entity.getPosition();
    
    // 散射弹幕
    for (let i = 0; i < 8; i++) {
      const offset = new pc.Vec3(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5
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
    const playerPos = this.player.getPosition();
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

  public consumeNewProjectiles(): EnemyProjectile[] {
    const projs = [...this.newProjectiles];
    this.newProjectiles = [];
    return projs;
  }
}

