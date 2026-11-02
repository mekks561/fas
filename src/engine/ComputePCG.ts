import * as pc from 'playcanvas';
import pcgShader from './shaders/pcg.wgsl?raw';

/**
 * 2026 Tech: GPU 驱动的程序化内容生成 (GPU-Driven PCG)。
 * 利用 WebGPU Compute Shader 瞬间生成海量物体坐标与属性，彻底释放 CPU。
 */
export class ComputePCG {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  
  constructor(app: pc.Application) {
    const graphicsDevice = app.graphicsDevice;
    if (graphicsDevice.deviceType === pc.DEVICETYPE_WEBGPU) {
      // @ts-ignore
      this.device = graphicsDevice.gpuDevice;
      this.initPipeline();
    }
  }

  private initPipeline(): void {
    if (!this.device) return;

    const shaderModule = this.device.createShaderModule({
      label: 'PCG Compute Shader',
      code: pcgShader
    });

    this.pipeline = this.device.createComputePipeline({
      label: 'PCG Pipeline',
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main'
      }
    });
  }

  /**
   * 生成物体实例数据。
   * @param count 生成数量 (可达数万)
   * @param seed 随机种子
   * @param innerRadius 内径
   * @param outerRadius 外径
   * @param arenaScale 场景缩放
   */
  public async generateInstances(
    count: number,
    seed: number,
    innerRadius: number,
    outerRadius: number,
    arenaScale: number
  ): Promise<Float32Array> {
    if (!this.device || !this.pipeline) {
      return this.fallbackCPU(count, seed, innerRadius, outerRadius, arenaScale);
    }

    // 1. 准备 Uniform Buffer (32字节对齐以适配 WebGPU 标准)
    const params = new Float32Array([seed, count, innerRadius, outerRadius, arenaScale, 0, 0, 0]);
    const uniformBuffer = this.device.createBuffer({
      size: 32, 
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, params);

    // 2. 准备 Output Storage Buffer
    // InstanceData 结构: vec3 pos(3) + float scale(1) + vec4 rot(4) = 8 floats (32 bytes)
    const stride = 8;
    const outputBufferSize = count * stride * 4;
    const outputBuffer = this.device.createBuffer({
      size: outputBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } }
      ]
    });

    // 3. 执行计算
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(count / 64));
    passEncoder.end();

    // 4. 读回数据
    const readBuffer = this.device.createBuffer({
      size: outputBufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, outputBufferSize);
    this.device.queue.submit([commandEncoder.finish()]);

    // 2026 Tech: 增加超时保护，防止 WebGPU 映射卡死
    try {
      const mapPromise = readBuffer.mapAsync(GPUMapMode.READ);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('WebGPU MapAsync Timeout')), 2000));
      
      await Promise.race([mapPromise, timeoutPromise]);
      
      const data = new Float32Array(readBuffer.getMappedRange().slice(0));
      readBuffer.unmap();
      return data;
    } catch (e) {
      console.warn('[ComputePCG] WebGPU mapAsync failed or timed out, falling back to CPU:', e);
      readBuffer.destroy();
      return this.fallbackCPU(count, seed, innerRadius, outerRadius, arenaScale);
    }
  }

  private fallbackCPU(count: number, seed: number, innerRadius: number, outerRadius: number, arenaScale: number): Float32Array {
    const data = new Float32Array(count * 8);
    let s = seed;
    const rand = () => {
      s = (Math.imul(1103515245, s) + 12345) | 0;
      return ((s >>> 0) / 0xffffffff);
    };

    for (let i = 0; i < count; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const radius = innerRadius + rand() * (outerRadius - innerRadius);
      const x = radius * Math.sin(phi) * Math.cos(theta) * arenaScale;
      const y = (rand() - 0.5) * 60 * arenaScale;
      const z = radius * Math.sin(phi) * Math.sin(theta) * arenaScale;

      const offset = i * 8;
      data[offset + 0] = x;
      data[offset + 1] = y;
      data[offset + 2] = z;
      data[offset + 3] = (0.5 + rand() * 2.0) * arenaScale;
      // 简化旋转
      data[offset + 4] = 0;
      data[offset + 5] = 0;
      data[offset + 6] = 0;
      data[offset + 7] = 1;
    }
    return data;
  }
}
