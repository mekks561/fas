import * as pc from 'playcanvas';

const GPUBufferUsage = {
  STORAGE: 4,
  COPY_SRC: 1,
  COPY_DST: 2,
  UNIFORM: 8,
  MAP_READ: 128,
} as const;

const GPUMapMode = {
  READ: 0,
} as const;

export interface PhysicsConfig {
  maxParticles: number;
  gravity: pc.Vec3;
  damping: number;
  collisionRadius: number;
  solverIterations: number;
}

export interface ParticleData {
  position: pc.Vec3;
  velocity: pc.Vec3;
  acceleration: pc.Vec3;
  mass: number;
  radius: number;
  active: boolean;
}

export class ComputePhysics {
  private device: GPUDevice | null = null;
  private particles: ParticleData[] = [];
  private positionBuffer: Float32Array | null = null;
  private velocityBuffer: Float32Array | null = null;
  private computePipeline: GPUComputePipeline | null = null;
  private positionStorageBuffer: GPUBuffer | null = null;
  private velocityStorageBuffer: GPUBuffer | null = null;
  private configBuffer: GPUBuffer | null = null;
  private config: PhysicsConfig;
  private useGPU: boolean = false;

  constructor(config: Partial<PhysicsConfig> = {}) {
    this.config = {
      maxParticles: 10000,
      gravity: new pc.Vec3(0, -9.81, 0),
      damping: 0.99,
      collisionRadius: 0.5,
      solverIterations: 5,
      ...config,
    };

    this.initParticles();
    this.tryInitWebGPU();
  }

  private initParticles(): void {
    this.particles = [];
    for (let i = 0; i < this.config.maxParticles; i++) {
      this.particles.push({
        position: new pc.Vec3(0, 0, 0),
        velocity: new pc.Vec3(0, 0, 0),
        acceleration: new pc.Vec3(0, 0, 0),
        mass: 1.0,
        radius: 0.5,
        active: false,
      });
    }
    this.positionBuffer = new Float32Array(this.config.maxParticles * 3);
    this.velocityBuffer = new Float32Array(this.config.maxParticles * 3);
  }

  private async tryInitWebGPU(): Promise<void> {
    if (!navigator.gpu) {
      console.warn('WebGPU not available, falling back to CPU physics');
      return;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.warn('WebGPU adapter not available');
        return;
      }
      this.device = await adapter.requestDevice();
      if (!this.device) {
        console.warn('WebGPU device creation failed');
        return;
      }

      await this.createComputePipeline();
      await this.createStorageBuffers();
      this.useGPU = true;
      console.log('WebGPU physics initialized successfully');
    } catch (error) {
      console.warn('WebGPU initialization error:', error);
    }
  }

  private async createComputePipeline(): Promise<void> {
    if (!this.device) return;

    const shaderSource = `
      struct PhysicsConfig {
        gravity: vec3f;
        damping: f32;
        collisionRadius: f32;
        solverIterations: u32;
        particleCount: u32;
      };

      @group(0) @binding(0) var<storage, read_write> positions: array<vec3f>;
      @group(0) @binding(1) var<storage, read_write> velocities: array<vec3f>;
      @group(0) @binding(2) var<uniform> config: PhysicsConfig;

      fn lengthSquared(v: vec3f) -> f32 {
        return v.x * v.x + v.y * v.y + v.z * v.z;
      }

      @compute @workgroup_size(64, 1, 1)
      fn updateVelocities(@builtin(global_invocation_id) global_id: vec3u) {
        let i = global_id.x;
        if (i >= config.particleCount) return;

        var vel = velocities[i];
        vel = vel + config.gravity * 0.016;
        vel = vel * config.damping;
        velocities[i] = vel;
      }

      @compute @workgroup_size(64, 1, 1)
      fn updatePositions(@builtin(global_invocation_id) global_id: vec3u) {
        let i = global_id.x;
        if (i >= config.particleCount) return;

        var pos = positions[i];
        pos = pos + velocities[i] * 0.016;
        positions[i] = pos;
      }

      @compute @workgroup_size(32, 1, 1)
      fn resolveCollisions(@builtin(global_invocation_id) global_id: vec3u) {
        let i = global_id.x;
        if (i >= config.particleCount) return;

        var pos_i = positions[i];

        for (var iteration = 0u; iteration < config.solverIterations; iteration = iteration + 1u) {
          for (var j = 0u; j < config.particleCount; j = j + 1u) {
            if (i == j) continue;

            let pos_j = positions[j];
            let delta = pos_i - pos_j;
            let distSq = lengthSquared(delta);
            let minDist = config.collisionRadius * 2.0;
            let minDistSq = minDist * minDist;

            if (distSq < minDistSq && distSq > 0.0) {
              let dist = sqrt(distSq);
              let n = delta / dist;
              let overlap = minDist - dist;
              let correction = n * overlap * 0.5;

              pos_i = pos_i + correction;
            }
          }
        }

        positions[i] = pos_i;
      }
    `;

    const shaderModule = this.device.createShaderModule({ code: shaderSource });

    this.computePipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'updateVelocities',
      },
    });
  }

  private async createStorageBuffers(): Promise<void> {
    if (!this.device || !this.positionBuffer || !this.velocityBuffer) return;

    const bufferSize = this.positionBuffer.byteLength;

    this.positionStorageBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    this.velocityStorageBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const configArray = new Float32Array([
      this.config.gravity.x,
      this.config.gravity.y,
      this.config.gravity.z,
      this.config.damping,
      this.config.collisionRadius,
      this.config.solverIterations,
    ]);

    this.configBuffer = this.device.createBuffer({
      size: configArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(this.configBuffer, 0, configArray);
  }

  public addParticle(position: pc.Vec3, velocity: pc.Vec3, mass: number = 1.0): number {
    const index = this.particles.findIndex((p) => !p.active);
    if (index === -1) {
      console.warn('Max particles reached');
      return -1;
    }

    this.particles[index] = {
      position: new pc.Vec3().copy(position),
      velocity: new pc.Vec3().copy(velocity),
      acceleration: new pc.Vec3(0, 0, 0),
      mass,
      radius: 0.5,
      active: true,
    };

    if (this.positionBuffer && this.velocityBuffer) {
      const offset = index * 3;
      this.positionBuffer[offset] = position.x;
      this.positionBuffer[offset + 1] = position.y;
      this.positionBuffer[offset + 2] = position.z;
      this.velocityBuffer[offset] = velocity.x;
      this.velocityBuffer[offset + 1] = velocity.y;
      this.velocityBuffer[offset + 2] = velocity.z;
    }

    return index;
  }

  public removeParticle(index: number): void {
    if (index >= 0 && index < this.particles.length) {
      this.particles[index].active = false;
      if (this.positionBuffer && this.velocityBuffer) {
        const offset = index * 3;
        this.positionBuffer[offset] = 0;
        this.positionBuffer[offset + 1] = 0;
        this.positionBuffer[offset + 2] = 0;
        this.velocityBuffer[offset] = 0;
        this.velocityBuffer[offset + 1] = 0;
        this.velocityBuffer[offset + 2] = 0;
      }
    }
  }

  public update(deltaTime: number): void {
    if (this.useGPU && this.device && this.positionStorageBuffer && this.velocityStorageBuffer) {
      this.updateGPU(deltaTime);
    } else {
      this.updateCPU(deltaTime);
    }
  }

  private updateGPU(deltaTime: number): void {
    if (!this.device || !this.computePipeline || !this.positionStorageBuffer || !this.velocityStorageBuffer || !this.configBuffer || !this.positionBuffer || !this.velocityBuffer) {
      this.updateCPU(deltaTime);
      return;
    }

    const queue = this.device.queue;
    const activeCount = this.particles.filter((p) => p.active).length;

    queue.writeBuffer(this.positionStorageBuffer, 0, this.positionBuffer);
    queue.writeBuffer(this.velocityStorageBuffer, 0, this.velocityBuffer);

    const configArray = new Float32Array([
      this.config.gravity.x,
      this.config.gravity.y,
      this.config.gravity.z,
      this.config.damping,
      this.config.collisionRadius,
      this.config.solverIterations,
      activeCount,
      0,
    ]);
    queue.writeBuffer(this.configBuffer, 0, configArray);

    const bindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.positionStorageBuffer } },
        { binding: 1, resource: { buffer: this.velocityStorageBuffer } },
        { binding: 2, resource: { buffer: this.configBuffer } },
      ],
    });

    const commandEncoder = this.device.createCommandEncoder();

    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.computePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(activeCount / 64));
    pass.end();

    const stagingBuffer = this.device.createBuffer({
      size: this.positionBuffer.byteLength,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    commandEncoder.copyBufferToBuffer(
      this.positionStorageBuffer,
      0,
      stagingBuffer,
      0,
      this.positionBuffer.byteLength
    );

    queue.submit([commandEncoder.finish()]);

    stagingBuffer.mapAsync(GPUMapMode.READ).then(() => {
      const data = stagingBuffer.getMappedRange();
      this.positionBuffer?.set(new Float32Array(data));
      stagingBuffer.unmap();
      stagingBuffer.destroy();
    });
  }

  private updateCPU(deltaTime: number): void {
    const activeParticles = this.particles.filter((p) => p.active);

    for (const particle of activeParticles) {
      particle.acceleration.copy(this.config.gravity);
      particle.velocity.add(particle.acceleration.scale(deltaTime));
      particle.velocity.scale(this.config.damping);
      particle.position.add(particle.velocity.scale(deltaTime));
    }

    for (let iteration = 0; iteration < this.config.solverIterations; iteration++) {
      for (let i = 0; i < activeParticles.length; i++) {
        for (let j = i + 1; j < activeParticles.length; j++) {
          const p1 = activeParticles[i];
          const p2 = activeParticles[j];
          const delta = new pc.Vec3().sub2(p1.position, p2.position);
          const dist = delta.length();
          const minDist = p1.radius + p2.radius;

          if (dist < minDist && dist > 0) {
            const n = delta.normalize();
            const overlap = minDist - dist;
            const correction = n.scale(overlap * 0.5);

            p1.position.add(correction);
            p2.position.sub(correction);
          }
        }
      }
    }

    for (const particle of activeParticles) {
      const index = this.particles.indexOf(particle);
      if (index >= 0 && this.positionBuffer && this.velocityBuffer) {
        const offset = index * 3;
        this.positionBuffer[offset] = particle.position.x;
        this.positionBuffer[offset + 1] = particle.position.y;
        this.positionBuffer[offset + 2] = particle.position.z;
        this.velocityBuffer[offset] = particle.velocity.x;
        this.velocityBuffer[offset + 1] = particle.velocity.y;
        this.velocityBuffer[offset + 2] = particle.velocity.z;
      }
    }
  }

  public getParticlePosition(index: number): pc.Vec3 | null {
    if (index >= 0 && index < this.particles.length && this.particles[index].active) {
      return this.particles[index].position.clone();
    }
    return null;
  }

  public getParticleVelocity(index: number): pc.Vec3 | null {
    if (index >= 0 && index < this.particles.length && this.particles[index].active) {
      return this.particles[index].velocity.clone();
    }
    return null;
  }

  public getActiveParticles(): ParticleData[] {
    return this.particles.filter((p) => p.active);
  }

  public getPositionBuffer(): Float32Array | null {
    return this.positionBuffer;
  }

  public getVelocityBuffer(): Float32Array | null {
    return this.velocityBuffer;
  }

  public isUsingGPU(): boolean {
    return this.useGPU;
  }

  public destroy(): void {
    if (this.positionStorageBuffer) this.positionStorageBuffer.destroy();
    if (this.velocityStorageBuffer) this.velocityStorageBuffer.destroy();
    if (this.configBuffer) this.configBuffer.destroy();
    if (this.computePipeline) this.computePipeline = null;
    this.device = null;
  }
}
