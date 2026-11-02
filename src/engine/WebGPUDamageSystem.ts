import * as pc from 'playcanvas';
import { PluginContext } from './PluginSystem';
import damageShader from './shaders/damage.wgsl?raw';

/**
 * 2026 Tech: WebGPU 驱动的模块化损毁系统。
 * 使用 Compute Shader 处理成千上万个飞船部件的实时损毁与形变。
 */
export class WebGPUDamageSystem {
  public name = 'WebGPUDamageSystem';
  public version = '2.7.0';

  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private componentBuffer: GPUBuffer | null = null;
  private collisionUniformBuffer: GPUBuffer | null = null;
  private readbackBuffer: GPUBuffer | null = null;
  
  private components: Float32Array | null = null;
  private maxComponents = 1024;
  private componentStride = 12; // vec3 pos (3) + float health (1) + float mass (1) + vec3 offset (3) + 4 padding = 12 floats (48 bytes)

  private needsSync = false;
  private isSyncing = false;
  private lastSyncTime = 0;
  private syncInterval = 33; // ~30Hz 同步频率，平衡性能与实时性

  // 2026 Tech: 关键组件索引映射
  public static readonly COMPONENT_MAP = {
    CORE: { start: 0, end: 99, name: 'Reactor Core' },
    L_WING: { start: 100, end: 199, name: 'Left Wing' },
    R_WING: { start: 200, end: 299, name: 'Right Wing' },
    ENGINE: { start: 300, end: 399, name: 'Main Thruster' },
    WEAPON_L: { start: 400, end: 449, name: 'Left Hardpoint' },
    WEAPON_R: { start: 450, end: 499, name: 'Right Hardpoint' },
  };
  
  // 缓存用于同步回 PlayCanvas 的数据
  private healthData: Float32Array = new Float32Array(0);
  private offsetData: Float32Array = new Float32Array(0);

  // 2026 Tech: GPU 性能分析器
  private profiler = {
    computePassTimeMs: 0,
    dispatchCount: 0,
    isSupported: false
  };
  private querySet: GPUQuerySet | null = null;
  private queryResolveBuffer: GPUBuffer | null = null;
  private queryReadbackBuffer: GPUBuffer | null = null;

  public async init(context: PluginContext): Promise<void> {
    const graphicsDevice = context.app.graphicsDevice;
    
    // 检查是否为 WebGPU 设备
    if (graphicsDevice.deviceType !== pc.DEVICETYPE_WEBGPU) {
      console.warn('[WebGPUDamageSystem] WebGPU not active, damage system will run in CPU fallback mode.');
      return;
    }

    // 获取底层的 WebGPU 设备
    // @ts-ignore
    this.device = graphicsDevice.gpuDevice;
    if (!this.device) return;

    await this.setupPipeline();
    await this.setupBuffers();
    await this.setupProfiler();
    
    console.log('[WebGPUDamageSystem] WebGPU Damage Pipeline initialized.');
  }

  private async setupProfiler(): Promise<void> {
    if (!this.device) return;

    // 检查是否支持时间戳查询 (Timestamp Query)
    if (this.device.features.has('timestamp-query')) {
      this.profiler.isSupported = true;
      
      this.querySet = this.device.createQuerySet({
        type: 'timestamp',
        count: 2
      });

      this.queryResolveBuffer = this.device.createBuffer({
        size: 2 * 8, // 两个 64 位时间戳
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
      });

      this.queryReadbackBuffer = this.device.createBuffer({
        size: 2 * 8,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      
      console.log('[WebGPUDamageSystem] Compute Pass Profiler enabled.');
    }
  }

  private async setupPipeline(): Promise<void> {
    if (!this.device) return;

    const shaderModule = this.device.createShaderModule({
      label: 'Damage Compute Shader',
      code: damageShader
    });

    this.pipeline = this.device.createComputePipeline({
      label: 'Damage Pipeline',
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main'
      }
    });
  }

  private async setupBuffers(): Promise<void> {
    if (!this.device) return;

    // 2026 Tech: 按预定义的物理布局初始化组件
    this.components = new Float32Array(this.maxComponents * this.componentStride);
    
    const initPart = (start: number, end: number, center: pc.Vec3, spread: pc.Vec3) => {
      for (let i = start; i <= end; i++) {
        const offset = i * this.componentStride;
        this.components![offset + 0] = center.x + (Math.random() - 0.5) * spread.x;
        this.components![offset + 1] = center.y + (Math.random() - 0.5) * spread.y;
        this.components![offset + 2] = center.z + (Math.random() - 0.5) * spread.z;
        this.components![offset + 3] = 100.0; // Health
        this.components![offset + 4] = 1.0;   // Mass
      }
    };

    const M = WebGPUDamageSystem.COMPONENT_MAP;
    initPart(M.CORE.start, M.CORE.end, new pc.Vec3(0, 0, 0), new pc.Vec3(1, 0.5, 3));
    initPart(M.L_WING.start, M.L_WING.end, new pc.Vec3(-3, 0, 0.5), new pc.Vec3(2, 0.2, 1.5));
    initPart(M.R_WING.start, M.R_WING.end, new pc.Vec3(3, 0, 0.5), new pc.Vec3(2, 0.2, 1.5));
    initPart(M.ENGINE.start, M.ENGINE.end, new pc.Vec3(0, 0, 3), new pc.Vec3(0.8, 0.8, 1));
    initPart(M.WEAPON_L.start, M.WEAPON_L.end, new pc.Vec3(-2, 0, -1), new pc.Vec3(0.5, 0.5, 0.5));
    initPart(M.WEAPON_R.start, M.WEAPON_R.end, new pc.Vec3(2, 0, -1), new pc.Vec3(0.5, 0.5, 0.5));

    this.componentBuffer = this.device.createBuffer({
      label: 'Ship Components Buffer',
      size: this.components.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });

    this.device.queue.writeBuffer(this.componentBuffer, 0, this.components);

    this.collisionUniformBuffer = this.device.createBuffer({
      label: 'Collision Uniform Buffer',
      size: 16, // vec3 + padding
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.readbackBuffer = this.device.createBuffer({
      label: 'Damage Readback Buffer',
      size: this.components.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    
    this.healthData = new Float32Array(this.maxComponents);
    this.offsetData = new Float32Array(this.maxComponents * 3);
  }

  /**
   * 触发一次碰撞损坏计算
   * @param position 碰撞中心
   * @param force 碰撞力度/向量
   */
  public applyDamage(position: pc.Vec3, force: pc.Vec3): void {
    if (!this.device || !this.pipeline || !this.componentBuffer || !this.collisionUniformBuffer) {
      this.applyDamageFallback(position, force);
      return;
    }

    // 更新 Uniform
    const collisionData = new Float32Array([position.x, position.y, position.z, 0]);
    this.device.queue.writeBuffer(this.collisionUniformBuffer, 0, collisionData);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.componentBuffer } },
        { binding: 1, resource: { buffer: this.collisionUniformBuffer } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    
    // 如果支持时间戳，则开始性能分析
    if (this.querySet) {
      (commandEncoder as any).writeTimestamp(this.querySet, 0);
    }

    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(this.maxComponents / 64));
    passEncoder.end();

    if (this.querySet) {
      (commandEncoder as any).writeTimestamp(this.querySet, 1);
      commandEncoder.resolveQuerySet(this.querySet, 0, 2, this.queryResolveBuffer!, 0);
      commandEncoder.copyBufferToBuffer(this.queryResolveBuffer!, 0, this.queryReadbackBuffer!, 0, 16);
    }

    this.device.queue.submit([commandEncoder.finish()]);
    
    this.profiler.dispatchCount++;
    if (this.profiler.isSupported) {
      this.readbackProfilerData();
    }
    
    // 标记需要同步
    this.needsSync = true;
  }

  private async readbackProfilerData(): Promise<void> {
    if (!this.queryReadbackBuffer) return;

    await this.queryReadbackBuffer.mapAsync(GPUMapMode.READ);
    const result = new BigUint64Array(this.queryReadbackBuffer.getMappedRange());
    
    // 计算耗时 (单位：纳秒)
    const durationNanoseconds = result[1] - result[0];
    this.profiler.computePassTimeMs = Number(durationNanoseconds) / 1000000;
    
    this.queryReadbackBuffer.unmap();
  }

  private async syncFromGPU(): Promise<void> {
    if (!this.device || !this.componentBuffer || !this.readbackBuffer || this.isSyncing) return;

    this.isSyncing = true;
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(this.componentBuffer, 0, this.readbackBuffer, 0, this.readbackBuffer.size);
    this.device.queue.submit([commandEncoder.finish()]);

    try {
      await this.readbackBuffer.mapAsync(GPUMapMode.READ);
      const arrayBuffer = this.readbackBuffer.getMappedRange();
      const result = new Float32Array(arrayBuffer);
      
      if (this.components) {
        this.components.set(result);
      }
      
      this.readbackBuffer.unmap();
      this.needsSync = false;
      this.lastSyncTime = Date.now();
    } catch (e) {
      console.warn('[WebGPUDamageSystem] Sync failed:', e);
    } finally {
      this.isSyncing = false;
    }
  }

  private applyDamageFallback(position: pc.Vec3, force: pc.Vec3): void {
    if (!this.components) return;
    
    // CPU 降级逻辑，模拟 WGSL 行为
    for (let i = 0; i < this.maxComponents; i++) {
      const offset = i * this.componentStride;
      const compPos = new pc.Vec3(this.components[offset], this.components[offset+1], this.components[offset+2]);
      const dist = compPos.distance(position);
      
      if (dist < 5.0) {
        const damage = (5.0 - dist) * force.length() * 0.1;
        this.components![offset + 3] -= damage;
        
        const dir = new pc.Vec3().sub2(compPos, position).normalize();
        this.components[offset + 5] += dir.x * damage * 0.01;
        this.components[offset + 6] += dir.y * damage * 0.01;
        this.components[offset + 7] += dir.z * damage * 0.01;
      }
    }
  }

  public onUpdate(dt: number): void {
    // 2026 Tech: 脏区节流同步
    if (this.needsSync && !this.isSyncing) {
      const now = Date.now();
      if (now - this.lastSyncTime > this.syncInterval) {
        this.syncFromGPU();
      }
    }
  }

  public getComponentHealth(index: number): number {
    if (!this.components || index >= this.maxComponents) return 0;
    return this.components[index * this.componentStride + 3];
  }

  public getComponentOffset(index: number): pc.Vec3 {
    if (!this.components || index >= this.maxComponents) return new pc.Vec3();
    const o = index * this.componentStride;
    return new pc.Vec3(this.components[o + 5], this.components[o + 6], this.components[o + 7]);
  }

  public getComponentInitialPos(index: number): pc.Vec3 {
    if (!this.components || index >= this.maxComponents) return new pc.Vec3();
    const o = index * this.componentStride;
    return new pc.Vec3(this.components[o + 0], this.components[o + 1], this.components[o + 2]);
  }

  public getProfilerData() {
    return { ...this.profiler };
  }

  /**
   * 2026 Tech: 检查特定组件组是否仍具备功能。
   * 如果平均健康值低于 20%，则认为失效。
   */
  public isComponentFunctional(type: keyof typeof WebGPUDamageSystem.COMPONENT_MAP): boolean {
    if (!this.components) return true;
    
    const map = WebGPUDamageSystem.COMPONENT_MAP[type];
    let totalHealth = 0;
    let count = 0;
    
    for (let i = map.start; i <= map.end; i++) {
      totalHealth += this.components[i * this.componentStride + 3];
      count++;
    }
    
    const avgHealth = totalHealth / count;
    return avgHealth > 20.0;
  }

  /**
   * 2026 Tech: 计算当前飞船的质心偏移。
   * 基于各组件的剩余生命值 (Health) 和初始质量 (Mass)。
   */
  public calculateCenterOfMass(): pc.Vec3 {
    if (!this.components) return new pc.Vec3(0, 0, 0);

    let totalMass = 0;
    let weightedPos = new pc.Vec3(0, 0, 0);

    for (let i = 0; i < this.maxComponents; i++) {
      const offset = i * this.componentStride;
      const x = this.components![offset + 0];
      const y = this.components![offset + 1];
      const z = this.components![offset + 2];
      const health = this.components![offset + 3];
      const initialMass = this.components![offset + 4];

      // 只有健康值大于 0 的组件才贡献质量
      if (health > 0) {
        const currentMass = initialMass * (health / 100.0);
        totalMass += currentMass;
        weightedPos.x += x * currentMass;
        weightedPos.y += y * currentMass;
        weightedPos.z += z * currentMass;
      }
    }

    if (totalMass > 0) {
      return weightedPos.scale(1.0 / totalMass);
    }

    return new pc.Vec3(0, 0, 0);
  }
}
