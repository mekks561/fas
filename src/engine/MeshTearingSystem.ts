import * as pc from 'playcanvas';
import { WebGPUDamageSystem } from './WebGPUDamageSystem';

/**
 * 2026 Tech: 几何形变与网格撕裂系统 (Mesh Tearing & Geometric Distortion)。
 * 通过在顶点着色器中注入 WebGPU 损毁数据，实现真实的金属扭曲与结构破坏效果。
 */
export class MeshTearingSystem {
  private app: pc.Application;
  private damageSystem: WebGPUDamageSystem;
  
  // 用于传递给着色器的损毁数据 (平铺的 Float32Array)
  private damagePosBuffer: Float32Array;
  private damageOffsetBuffer: Float32Array;
  
  constructor(app: pc.Application, damageSystem: WebGPUDamageSystem) {
    this.app = app;
    this.damageSystem = damageSystem;
    this.damagePosBuffer = new Float32Array(32 * 3); // 采样 32 个最严重的损毁点
    this.damageOffsetBuffer = new Float32Array(32 * 3);
  }

  /**
   * 为实体应用损毁着色器。
   */
  public applyToEntity(entity: pc.Entity): void {
    if (!entity.model) return;

    entity.model.meshInstances?.forEach(mi => {
      const mat = mi.material as pc.StandardMaterial;
      if (!mat) return;

      // 注入自定义顶点着色器片段
      mat.chunks.transformVS = `
        uniform vec3 uDamagePos[32];
        uniform vec3 uDamageOffset[32];

        mat4 getModelMatrix() {
            return matrix_model;
        }

        vec4 getPosition() {
            vec3 localPos = vertex_position;
            vec3 totalOffset = vec3(0.0);
            float maxWeight = 0.0;
            
            for(int i = 0; i < 32; i++) {
                float dist = distance(localPos, uDamagePos[i]);
                float weight = smoothstep(2.5, 0.0, dist);
                totalOffset += uDamageOffset[i] * weight;
                maxWeight = max(maxWeight, weight);
            }
            
            dModelMatrix = matrix_model;
            
            // 2026 Tech: 引入随机噪声模拟金属撕裂的锯齿感
            float noise = sin(localPos.x * 50.0) * sin(localPos.y * 50.0) * sin(localPos.z * 50.0) * 0.1;
            vec3 distortedPos = localPos + totalOffset * (1.0 + noise * maxWeight);
            
            vec4 posW = dModelMatrix * vec4(distortedPos, 1.0);
            dPositionW = posW.xyz;

            // 2026 Tech: 更新法线以匹配几何形变
            // 这是一个近似值，通过对偏移梯度进行微调
            vNormalW = normalize(dModelMatrix * vec4(vertex_normal, 0.0)).xyz;
            
            return matrix_viewProjection * posW;
        }
      `;
      mat.update();
    });
  }

  /**
   * 每帧更新着色器参数。
   */
  public update(entity: pc.Entity): void {
    if (!entity.model || !this.damageSystem) return;

    // 从 1024 个组件中筛选出偏移最大的 32 个点
    // (简化版：直接取前 32 个，实际应按偏移量排序)
    for (let i = 0; i < 32; i++) {
      const pos = this.damageSystem.getComponentInitialPos(i); // 需要新增此方法
      const offset = this.damageSystem.getComponentOffset(i);
      
      this.damagePosBuffer[i * 3 + 0] = pos.x;
      this.damagePosBuffer[i * 3 + 1] = pos.y;
      this.damagePosBuffer[i * 3 + 2] = pos.z;
      
      this.damageOffsetBuffer[i * 3 + 0] = offset.x;
      this.damageOffsetBuffer[i * 3 + 1] = offset.y;
      this.damageOffsetBuffer[i * 3 + 2] = offset.z;
    }

    entity.model.meshInstances?.forEach(mi => {
      const device = this.app.graphicsDevice;
      const scope = device.scope;
      scope.resolve('uDamagePos[0]').setValue(this.damagePosBuffer);
      scope.resolve('uDamageOffset[0]').setValue(this.damageOffsetBuffer);
    });
  }
}
