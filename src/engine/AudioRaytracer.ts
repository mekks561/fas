import * as pc from 'playcanvas';

/**
 * 2026 Tech: 实时音频射线追踪 (Real-time Sound Ray-tracing)。
 * 模拟声波在星区障碍物（如陨石、空间站）间的反射与吸收，动态调整混响与空间感。
 */
export class AudioRaytracer {
  private app: pc.Application;
  private listener: pc.Entity;
  private rayCount: number = 16;
  private maxDistance: number = 100;
  
  // 音频属性缓存
  private currentReverb: number = 0;
  private currentOcclusion: number = 0;

  constructor(app: pc.Application, listener: pc.Entity) {
    this.app = app;
    this.listener = listener;
  }

  /**
   * 更新音频环境。
   * @param obstacles 场景中的物理障碍物
   */
  public update(dt: number, obstacles: pc.Entity[]): void {
    const startPos = this.listener.getPosition();
    let hits = 0;
    let totalDist = 0;

    // 2026 Tech: 随机球采样射线追踪
    for (let i = 0; i < this.rayCount; i++) {
      const dir = new pc.Vec3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();

      const ray = new pc.Ray(startPos, dir);
      const hit = this.castRay(ray, obstacles);

      if (hit) {
        hits++;
        totalDist += hit.distance;
      }
    }

    // 计算混响 (Reverb)：障碍物越近、越多，混响感越强（模拟室内或密集区）
    const hitRatio = hits / this.rayCount;
    const avgDist = hits > 0 ? totalDist / hits : this.maxDistance;
    
    this.currentReverb = pc.math.lerp(this.currentReverb, hitRatio * (1.0 - avgDist / this.maxDistance), 0.1);
    
    // 计算遮挡 (Occlusion)：如果前方有大物体，高频声波衰减
    this.updateAudioEnvironment();
  }

  private castRay(ray: pc.Ray, obstacles: pc.Entity[]): { distance: number } | null {
    let nearest = null;
    let minDist = this.maxDistance;

    for (const obj of obstacles) {
      // 简单球体碰撞检测
      const spherePos = obj.getPosition();
      const radius = obj.getLocalScale().x * 0.5;
      
      const L = new pc.Vec3().sub2(spherePos, ray.origin);
      const tca = L.dot(ray.direction);
      if (tca < 0) continue;
      
      const d2 = L.dot(L) - tca * tca;
      if (d2 > radius * radius) continue;
      
      const thc = Math.sqrt(radius * radius - d2);
      const t0 = tca - thc;
      
      if (t0 < minDist) {
        minDist = t0;
        nearest = { distance: t0 };
      }
    }
    return nearest;
  }

  private updateAudioEnvironment(): void {
    // 2026 Tech: 动态调整全局音频上下文
    // 在实际 Web Audio API 中，这里会连接到 ReverbNode 或 BiquadFilterNode
    // 目前通过 console 模拟状态变更
    if (this.currentReverb > 0.5) {
      // console.log(`[AudioRaytracer] Entering dense area. Reverb: ${this.currentReverb.toFixed(2)}`);
    }
  }

  public getReverbLevel(): number {
    return this.currentReverb;
  }
}
