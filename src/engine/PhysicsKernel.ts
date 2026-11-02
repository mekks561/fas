import * as pc from 'playcanvas';

/**
 * 2026 Tech: 物理微内核。
 * 处理高频物理计算（质心偏移、阻力、惯性张量）。
 * 架构上预留了 WASM 接口，当前为 TypeScript 实现。
 * 使用 TypedArray 优化性能并为 WASM 共享内存做准备。
 */
export class PhysicsKernel {
  private data: Float32Array;
  // 数据布局:
  // 0-2: velocity (x, y, z)
  // 3-5: angularVelocity (x, y, z)
  // 6: mass
  // 7-9: centerOfMass (x, y, z)
  // 10: linearDrag
  // 11: angularDrag

  constructor(mass: number = 1000) {
    this.data = new Float32Array(16); // 对齐到 16 以便 SIMD 优化
    this.data[6] = mass;
    this.data[10] = 0.1;
    this.data[11] = 0.2;
  }

  /**
   * 更新物理状态
   * @param dt 步长
   * @param forces 作用力数组（带有相对于几何中心的偏移位置）
   * @param torques 直接扭矩数组
   */
  public step(dt: number, forces: { force: pc.Vec3; position: pc.Vec3 }[], torques: pc.Vec3[]): void {
    const mass = this.data[6];
    const invMass = 1.0 / mass;
    const com = new pc.Vec3(this.data[7], this.data[8], this.data[9]);

    // 1. 累加力与力矩
    let fx = 0, fy = 0, fz = 0;
    let tx = 0, ty = 0, tz = 0;

    for (const fObj of forces) {
      const f = fObj.force;
      const p = fObj.position;
      
      // 累加合力
      fx += f.x; fy += f.y; fz += f.z;
      
      // 2026 Tech: 计算偏心力产生的力矩 T = (p - com) x F
      const r = p.clone().sub(com);
      const tFromF = new pc.Vec3().cross(r, f);
      tx += tFromF.x; ty += tFromF.y; tz += tFromF.z;
    }

    // 2. 累加直接扭矩
    for (const t of torques) {
      tx += t.x; ty += t.y; tz += t.z;
    }

    // 3. 计算线性加速度并更新速度 (F = ma)
    this.data[0] += (fx * invMass) * dt;
    this.data[1] += (fy * invMass) * dt;
    this.data[2] += (fz * invMass) * dt;

    // 应用线性阻力
    const lDrag = 1.0 - this.data[10] * dt;
    this.data[0] *= lDrag;
    this.data[1] *= lDrag;
    this.data[2] *= lDrag;

    // 4. 更新角速度 (简化惯性矩模型)
    const invInertia = 1.0 / (mass * 0.5);
    this.data[3] += (tx * invInertia) * dt;
    this.data[4] += (ty * invInertia) * dt;
    this.data[5] += (tz * invInertia) * dt;

    // 应用旋转阻力
    const aDrag = 1.0 - this.data[11] * dt;
    this.data[3] *= aDrag;
    this.data[4] *= aDrag;
    this.data[5] *= aDrag;
  }

  public getVelocity(): pc.Vec3 {
    return new pc.Vec3(this.data[0], this.data[1], this.data[2]);
  }

  public getAngularVelocity(): pc.Vec3 {
    return new pc.Vec3(this.data[3], this.data[4], this.data[5]);
  }

  public setMass(mass: number): void {
    this.data[6] = mass;
  }

  public getMass(): number {
    return this.data[6];
  }

  public setCenterOfMass(offset: pc.Vec3): void {
    this.data[7] = offset.x;
    this.data[8] = offset.y;
    this.data[9] = offset.z;
  }
}
