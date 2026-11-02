import * as pc from 'playcanvas';
import { PluginContext } from './PluginSystem';
import { PlayerShip } from './PlayerShip';

/**
 * 2026 Tech: 黑洞物理系统 (Black Hole Physical System)。
 * 实现引力坍缩、吸积盘渲染以及近场时间膨胀效应。
 */
export class BlackHoleSystem {
  public name = 'BlackHoleSystem';
  public version = '2.9.0';

  private context: PluginContext | null = null;
  private player: PlayerShip | null = null;
  private blackHoles: pc.Entity[] = [];

  // 物理常数
  private readonly G = 50.0; // 引力常数 (缩放版)
  private readonly EVENT_HORIZON_RADIUS = 10.0;
  private readonly ERGOSPHERE_RADIUS = 30.0;
  private readonly ACCRETION_DISK_RADIUS = 60.0;

  public init(context: PluginContext): void {
    this.context = context;
    console.log('[BlackHoleSystem] Singularity Physics initialized.');
  }

  public registerBlackHole(entity: pc.Entity): void {
    this.blackHoles.push(entity);
    this.createAccretionDisk(entity);
    console.log(
      `[BlackHoleSystem] Black hole singularity detected at ${entity.getPosition().toString()}`,
    );
  }

  private createAccretionDisk(parent: pc.Entity): void {
    // 2026 Tech: 吸积盘视觉效果 (Accretion Disk VFX)
    const disk = new pc.Entity('accretion_disk');
    parent.addChild(disk);

    // 使用粒子系统模拟吸积盘的旋转流体感
    const app = this.context?.app;
    if (app) {
      const engine = (app as any)['engine'];
      engine?.addParticleSystem(disk, {
        numParticles: 200,
        lifetime: 2.0,
        rate: 50,
        initialVelocity: 5,
        emitterShape: pc.EMITTERSHAPE_SPHERE,
        emitterRadius: this.ACCRETION_DISK_RADIUS,
        colorGraph: new pc.CurveSet([
          [1, 0.4, 0.1],
          [0.8, 0.2, 0],
          [0.1, 0, 0],
        ]),
        scaleGraph: new pc.Curve([0.5, 1.5, 0.5]),
        alphaGraph: new pc.Curve([0, 0.8, 0]),
        // 粒子受引力影响向中心汇聚的逻辑在 shader/update 中体现
      });
    }

    // 事件视界核心 (绝对黑体)
    const core = new pc.Entity('event_horizon');
    core.addComponent('model', { type: 'sphere' });
    core.setLocalScale(
      this.EVENT_HORIZON_RADIUS * 2,
      this.EVENT_HORIZON_RADIUS * 2,
      this.EVENT_HORIZON_RADIUS * 2,
    );
    const mat = new pc.StandardMaterial();
    mat.diffuse.set(0, 0, 0);
    mat.emissive.set(0, 0, 0);
    mat.useLighting = false;
    mat.update();
    if (core.model) core.model.material = mat;
    parent.addChild(core);
  }

  public onUpdate(dt: number): void {
    if (!this.context || !this.player) {
      this.player = (this.context?.app as any)?.['player'];
      return;
    }

    const playerPos = this.player.getPosition();
    let maxTimeDilation = 1.0;

    this.blackHoles.forEach((bh) => {
      const bhPos = bh.getPosition();
      const dist = bhPos.distance(playerPos);

      // 1. 引力拉扯 (Inverse Square Law)
      if (dist < this.ACCRETION_DISK_RADIUS * 2) {
        const forceDir = bhPos.clone().sub(playerPos).normalize();
        const forceMagnitude = (this.G * 100) / (dist * dist);
        this.player?.applyExternalForce(forceDir.scale(forceMagnitude));

        // 2. 时间膨胀效应 (Time Dilation)
        // 越接近事件视界，时间流逝越慢 (模拟广义相对论)
        if (dist < this.ERGOSPHERE_RADIUS) {
          const dilation = pc.math.clamp(
            (dist - this.EVENT_HORIZON_RADIUS) /
              (this.ERGOSPHERE_RADIUS - this.EVENT_HORIZON_RADIUS),
            0.1,
            1.0,
          );
          if (dilation < maxTimeDilation) maxTimeDilation = dilation;
        }

        // 3. 潮汐力损坏 (Tidal Forces)
        if (dist < this.EVENT_HORIZON_RADIUS * 1.5) {
          this.player?.takeDamage(50 * dt);
        }
      }
    });

    // 2026 Tech: 注入时间膨胀因子到全局引擎
    if (maxTimeDilation < 1.0) {
      (this.context.app as any).timeScale = maxTimeDilation;
      // 触发视觉畸变效果 (通过 VFX 系统)
      const vfx = (this.context.app as any)['vfxSystem'];
      vfx?.triggerGravitationalLens(maxTimeDilation);
    } else {
      (this.context.app as any).timeScale = 1.0;
    }
  }

  public clear(): void {
    this.blackHoles = [];
  }
}
