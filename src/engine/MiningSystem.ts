import * as pc from 'playcanvas';
import { PluginContext } from './PluginSystem';
import { PlayerShip } from './PlayerShip';
import { AsteroidSystem } from './AsteroidSystem';
import { ResourceSystem, ResourceType } from './ResourceSystem';

/**
 * 2026 Tech: 采矿系统。
 * 实现基于物理反馈的采矿激光，以及陨石资源提取逻辑。
 */
export class MiningSystem {
  public name = 'MiningSystem';
  public version = '2.7.0';

  private context: PluginContext | null = null;
  private player: PlayerShip | null = null;
  private asteroidSystem: AsteroidSystem | null = null;
  private resourceSystem: ResourceSystem | null = null;

  private isMining: boolean = false;
  private miningLaser: pc.Entity | null = null;
  private miningRange: number = 20;
  private miningRate: number = 10; // 每秒提取量
  private heatPoint: pc.Entity | null = null;
  private heatLight: pc.Entity | null = null;

  public init(context: PluginContext): void {
    this.context = context;
    this.createMiningLaser();
    this.createHeatPoint();
    console.log('[MiningSystem] Precise Mining initialized.');
  }

  private createMiningLaser(): void {
    if (!this.context) return;

    this.miningLaser = new pc.Entity('mining_laser');
    const model = new pc.Entity();
    model.addComponent('model', { type: 'cylinder' });
    model.setLocalScale(0.05, 1, 0.05);
    model.setLocalEulerAngles(90, 0, 0);

    const mat = new pc.StandardMaterial();
    mat.emissive = new pc.Color(0, 1, 1); // 青色采矿光束
    mat.opacity = 0.5;
    mat.blendType = pc.BLEND_ADDITIVE;
    mat.update();

    if (model.model) model.model.material = mat;
    this.miningLaser.addChild(model);
    this.miningLaser.enabled = false;

    this.context.app.root.addChild(this.miningLaser);
  }

  private createHeatPoint(): void {
    if (!this.context) return;

    // 2026 Tech: 采矿热力点视觉效果
    this.heatPoint = new pc.Entity('mining_heat_point');
    const model = new pc.Entity();
    model.addComponent('model', { type: 'sphere' });
    model.setLocalScale(0.5, 0.5, 0.5);

    const mat = new pc.StandardMaterial();
    mat.emissive = new pc.Color(1, 0.3, 0); // 橙红色热量感
    mat.update();

    if (model.model) model.model.material = mat;
    this.heatPoint.addChild(model);

    // 添加点光源增强效果
    this.heatLight = new pc.Entity('mining_heat_light');
    this.heatLight.addComponent('light', {
      type: 'point',
      color: new pc.Color(1, 0.2, 0),
      range: 5,
      intensity: 2,
    });
    this.heatPoint.addChild(this.heatLight);

    this.heatPoint.enabled = false;
    this.context.app.root.addChild(this.heatPoint);
  }

  public onUpdate(dt: number): void {
    if (!this.context) return;

    this.player = (this.context.app as any)['player'];
    this.asteroidSystem = (this.context.app as any)['asteroidSystem'];
    this.resourceSystem = (this.context.app as any)['resourceSystem'];

    if (!this.player) return;

    // 2026 Tech: 获取实时控制输入
    const controls = (window as any)['_playerControls'] || this.player.getLatestControls();
    const wantToMine = controls?.interact || false;

    if (wantToMine) {
      this.performMining(dt);
    } else {
      if (this.isMining) this.stopMining();
    }
  }

  private performMining(dt: number): void {
    if (!this.player || !this.miningLaser) return;

    const startPos = this.player.getPosition();
    const forward = this.player.getForward();
    const endPos = startPos.clone().add(forward.clone().scale(this.miningRange));

    // 更新激光视觉
    this.miningLaser.enabled = true;
    const halfRange = this.miningRange * 0.5;
    this.miningLaser.setPosition(startPos.clone().add(forward.clone().scale(halfRange)));
    this.miningLaser.lookAt(endPos);

    // 2026 Tech: 动态调整激光长度以匹配射程
    const model = this.miningLaser.children[0];
    if (model) {
      model.setLocalScale(0.05, this.miningRange, 0.05);
    }

    // 射线检测小行星
    const ray = new pc.Ray(startPos, forward);
    const hit = this.checkAsteroidHit(ray);

    if (hit) {
      this.isMining = true;
      this.extractResource(hit.asteroid, dt);

      // 2026 Tech: 采矿时的物理反馈（轻微反作用力）
      const recoil = forward.clone().scale(-0.5);
      this.player.applyExternalForce(recoil);

      // 视觉反馈：在击中点产生火花与热力点
      this.updateMiningVFX(hit.point, dt);
    } else {
      this.stopMiningVFX();
      this.isMining = false;
    }
  }

  private updateMiningVFX(pos: pc.Vec3, _dt: number): void {
    // 1. 火花粒子
    this.createMiningSparks(pos);

    // 2. 热力点发光
    if (this.heatPoint) {
      this.heatPoint.enabled = true;
      this.heatPoint.setPosition(pos);

      // 热力随时间增强（模拟发红）
      if (this.heatLight && this.heatLight.light) {
        const pulse = Math.sin(Date.now() * 0.01) * 0.5 + 1.5;
        this.heatLight.light.intensity = pulse;
      }
    }
  }

  private stopMiningVFX(): void {
    if (this.heatPoint) this.heatPoint.enabled = false;
  }

  private checkAsteroidHit(ray: pc.Ray): { asteroid: pc.Entity; point: pc.Vec3 } | null {
    if (!this.asteroidSystem) return null;

    // 简单遍历所有小行星进行球体碰撞检测（射线-球体）
    const asteroids = (this.asteroidSystem as any).asteroids as pc.Entity[];
    let closestHit: { asteroid: pc.Entity; point: pc.Vec3; dist: number } | null = null;

    for (const asteroid of asteroids) {
      const pos = asteroid.getPosition();
      const scale = asteroid.getLocalScale().x || 1;
      const radius = scale * 1.5;

      // 射线到球心的垂直距离
      const l = pos.clone().sub(ray.origin);
      const s = l.dot(ray.direction);
      const l2 = l.dot(l);
      const r2 = radius * radius;

      if (s < 0 && l2 > r2) continue;

      const m2 = l2 - s * s;
      if (m2 > r2) continue;

      const q = Math.sqrt(r2 - m2);
      const t = s - q;

      if (t > 0 && t < this.miningRange) {
        if (!closestHit || t < closestHit.dist) {
          closestHit = {
            asteroid,
            point: ray.origin.clone().add(ray.direction.clone().scale(t)),
            dist: t,
          };
        }
      }
    }

    return closestHit;
  }

  private extractResource(asteroid: pc.Entity, dt: number): void {
    if (!this.resourceSystem) return;

    // 获取小行星元数据（如果不存在则初始化）
    let meta = (asteroid as any).miningMeta;
    if (!meta) {
      meta = {
        health: 100,
        type: this.getRandomResourceType(),
        yield: 50 + Math.random() * 150,
      };
      (asteroid as any).miningMeta = meta;
    }

    if (meta.health > 0) {
      const extraction = this.miningRate * dt;
      meta.health -= extraction;

      const amount = (meta.yield / 100) * extraction;
      this.resourceSystem.addResource(meta.type, amount);

      if (meta.health <= 0) {
        this.destroyAsteroid(asteroid);
      }
    }
  }

  private getRandomResourceType(): ResourceType {
    const r = Math.random();
    if (r < 0.6) return ResourceType.IRON;
    if (r < 0.85) return ResourceType.GOLD;
    if (r < 0.95) return ResourceType.CRYSTAL;
    return ResourceType.PLASMA;
  }

  private destroyAsteroid(asteroid: pc.Entity): void {
    // 触发爆炸特效
    const engine = this.context?.app ? (this.context.app as any)['engine'] : null;
    if (engine) {
      const pos = asteroid.getPosition();
      engine.createExplosion?.(pos, 2.0);
    }

    // 从 AsteroidSystem 的列表中移除
    if (this.asteroidSystem) {
      this.asteroidSystem.removeAsteroid(asteroid);
    }

    asteroid.destroy();
  }

  private createMiningSparks(pos: pc.Vec3): void {
    const engine = this.context?.app ? (this.context.app as any)['engine'] : null;
    if (engine) {
      const sparks = new pc.Entity('mining_sparks');
      sparks.setPosition(pos);
      engine.addParticleSystem(sparks, {
        lifetime: 0.2,
        numParticles: 20,
        initialVelocity: 5,
        colorGraph: new pc.CurveSet([
          [1, 1, 0.5],
          [1, 0.5, 0],
          [0, 0, 0],
        ]),
        scaleGraph: new pc.Curve([0.1, 0.3, 0]),
      });
      engine.addToScene(sparks);
      setTimeout(() => sparks.destroy(), 300);
    }
  }

  private stopMining(): void {
    this.isMining = false;
    this.stopMiningVFX();
    if (this.miningLaser) this.miningLaser.enabled = false;
  }
}
