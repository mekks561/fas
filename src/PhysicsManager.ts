import { Scene, Vector3 } from '@babylonjs/core';

export class PhysicsManager {
  private scene: Scene;
  private gravity: Vector3;

  constructor(scene: Scene, gravity: Vector3 = new Vector3(0, -9.81, 0)) {
    this.scene = scene;
    this.gravity = gravity;
    this.setupPhysics();
  }

  private setupPhysics(): void {
    // 启用物理引擎
    this.scene.enablePhysics(this.gravity);
  }

  public update(deltaTime: number): void {
    // 这里可以添加自定义物理逻辑
    // 例如：边界检查、碰撞检测回调等
  }

  public setGravity(gravity: Vector3): void {
    this.gravity = gravity;
    if (this.scene.getPhysicsEngine()) {
      this.scene.getPhysicsEngine()!.setGravity(gravity);
    }
  }

  public applyForce(mesh: any, force: Vector3, position?: Vector3): void {
    if (mesh.physicsImpostor) {
      mesh.physicsImpostor.applyForce(force, position || mesh.getAbsolutePosition());
    }
  }

  public checkBoundaries(position: Vector3, bounds: { x: number, y: number, z: number }): Vector3 {
    const newPos = position.clone();
    
    // X轴边界
    if (Math.abs(newPos.x) > bounds.x) {
      newPos.x = bounds.x * Math.sign(newPos.x);
    }
    
    // Y轴边界
    if (Math.abs(newPos.y) > bounds.y) {
      newPos.y = bounds.y * Math.sign(newPos.y);
    }
    
    // Z轴边界
    if (Math.abs(newPos.z) > bounds.z) {
      newPos.z = bounds.z * Math.sign(newPos.z);
    }
    
    return newPos;
  }
}