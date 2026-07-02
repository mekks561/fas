import * as pc from 'playcanvas';

export interface TextureConfig {
  width: number;
  height: number;
  type: 'nebula' | 'planet' | 'hull' | 'explosion' | 'starfield' | 'grid';
  seed?: number;
  options?: unknown;
}

export interface NebulaOptions {
  colors: string[];
  layers: number;
  turbulence: number;
  brightness: number;
}

export interface PlanetOptions {
  baseColor: string;
  continentCount: number;
  oceanColor: string;
  iceCapColor: string;
  hasAtmosphere: boolean;
}

export interface HullOptions {
  baseColor: string;
  stripeColor: string;
  stripeCount: number;
  damageLevel: number;
}

// ============================================================================
// WGSL Compute Shader Sources
// ============================================================================

// Nebula: FBM noise with color layers, turbulence, and brightness parameters
const NEBULA_WGSL = `
uniform width: u32;
uniform height: u32;
uniform seed: f32;
uniform turbulence: f32;
uniform brightness: f32;
uniform color1: vec4f;
uniform color2: vec4f;
uniform color3: vec4f;
uniform color4: vec4f;

var<storage, read_write> outputBuffer: array<vec4f>;

fn hash(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

fn noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let a = hash(i);
  let b = hash(i + vec2(1.0, 0.0));
  let c = hash(i + vec2(0.0, 1.0));
  let d = hash(i + vec2(1.0, 1.0));
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p: vec2<f32>) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var freq = 1.0;
  for (var i = 0; i < 5; i = i + 1) {
    value = value + amplitude * noise(p * freq);
    freq = freq * 2.0;
    amplitude = amplitude * 0.5;
  }
  return value;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
  let px = global_id.x;
  let py = global_id.y;
  if (px >= uniform.width || py >= uniform.height) {
    return;
  }

  let uv = vec2<f32>(f32(px) / f32(uniform.width), f32(py) / f32(uniform.height));
  let pos = uv * 3.0 + vec2<f32>(uniform.seed, uniform.seed * 0.5);

  let n = fbm(pos + fbm(pos * (1.0 + uniform.turbulence * 2.0)));

  var color = vec3<f32>(0.02, 0.02, 0.08);
  color = mix(color, uniform.color1.rgb, smoothstep(0.3, 0.6, n) * uniform.brightness);
  color = mix(color, uniform.color2.rgb, smoothstep(0.4, 0.7, n) * uniform.brightness * 0.7);
  color = mix(color, uniform.color3.rgb, smoothstep(0.5, 0.8, n) * uniform.brightness * 0.5);
  color = mix(color, uniform.color4.rgb, smoothstep(0.6, 0.9, n) * uniform.brightness * 0.3);

  let index = py * uniform.width + px;
  outputBuffer[index] = vec4<f32>(color, 1.0);
}
`;

// Starfield: Random star positions with size/alpha variation using grid-based hashing
const STARFIELD_WGSL = `
uniform width: u32;
uniform height: u32;
uniform seed: f32;

var<storage, read_write> outputBuffer: array<vec4f>;

fn hash(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
  let px = global_id.x;
  let py = global_id.y;
  if (px >= uniform.width || py >= uniform.height) {
    return;
  }

  let cellSize = 4.0;
  let cellX = floor(f32(px) / cellSize);
  let cellY = floor(f32(py) / cellSize);

  var brightness = 0.0;

  // Check 3x3 neighboring cells for stars that may overlap into this pixel
  for (var oy = -1.0; oy <= 1.0; oy = oy + 1.0) {
    for (var ox = -1.0; ox <= 1.0; ox = ox + 1.0) {
      let cx = cellX + ox;
      let cy = cellY + oy;
      let cs = vec2<f32>(cx + uniform.seed, cy + uniform.seed * 2.0);

      let prob = hash(cs);
      let hasStar = step(0.55, prob);

      let starX = cx * cellSize + hash(cs + vec2<f32>(1.0, 0.0)) * cellSize;
      let starY = cy * cellSize + hash(cs + vec2<f32>(0.0, 1.0)) * cellSize;
      let starSize = hash(cs + vec2<f32>(2.0, 2.0)) * 1.5 + 0.5;
      let starAlpha = hash(cs + vec2<f32>(3.0, 3.0)) * 0.7 + 0.3;

      let dx = f32(px) - starX;
      let dy = f32(py) - starY;
      let dist = sqrt(dx * dx + dy * dy);

      brightness = brightness + hasStar * smoothstep(starSize, 0.0, dist) * starAlpha;
    }
  }

  brightness = clamp(brightness, 0.0, 1.0);

  let index = py * uniform.width + px;
  outputBuffer[index] = vec4<f32>(brightness, brightness, brightness, 1.0);
}
`;

// Explosion: Radial gradient with color gradient (white to yellow to orange to red) and particle sparks
const EXPLOSION_WGSL = `
uniform width: u32;
uniform height: u32;
uniform seed: f32;

var<storage, read_write> outputBuffer: array<vec4f>;

fn hash(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
  let px = global_id.x;
  let py = global_id.y;
  if (px >= uniform.width || py >= uniform.height) {
    return;
  }

  let centerX = f32(uniform.width) * 0.5;
  let centerY = f32(uniform.height) * 0.5;
  let dx = f32(px) - centerX;
  let dy = f32(py) - centerY;
  let dist = sqrt(dx * dx + dy * dy);
  let maxRadius = min(f32(uniform.width), f32(uniform.height)) * 0.5;
  let t = clamp(dist / maxRadius, 0.0, 1.0);

  // Color gradient: white -> yellow -> orange -> red -> black
  var color: vec3<f32>;
  if (t < 0.15) {
    color = vec3<f32>(1.0, 1.0, 1.0);
  } else if (t < 0.35) {
    color = mix(vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(1.0, 1.0, 0.2), (t - 0.15) / 0.2);
  } else if (t < 0.55) {
    color = mix(vec3<f32>(1.0, 1.0, 0.2), vec3<f32>(1.0, 0.5, 0.0), (t - 0.35) / 0.2);
  } else if (t < 0.75) {
    color = mix(vec3<f32>(1.0, 0.5, 0.0), vec3<f32>(1.0, 0.1, 0.0), (t - 0.55) / 0.2);
  } else {
    color = mix(vec3<f32>(1.0, 0.1, 0.0), vec3<f32>(0.0, 0.0, 0.0), (t - 0.75) / 0.25);
  }

  // Add particle sparks using hash-based randomness
  let angle = atan2(dy, dx);
  let sparkHash = hash(vec2<f32>(floor(angle * 12.0), floor(dist * 0.3 + uniform.seed)));
  let spark = step(0.92, sparkHash) * (1.0 - t) * 0.8;
  color = color + vec3<f32>(spark, spark * 0.7, spark * 0.3);

  let alpha = 1.0 - smoothstep(0.7, 1.0, t);

  let index = py * uniform.width + px;
  outputBuffer[index] = vec4<f32>(color, alpha);
}
`;

// The StorageBuffer.read() supports an optional 'immediate' 4th parameter that
// forces immediate command buffer submission. This is not in the type definitions.
interface StorageBufferWithImmediate {
  read(
    offset?: number,
    size?: number,
    data?: ArrayBufferView | null,
    immediate?: boolean,
  ): Promise<ArrayBufferView>;
}

// Texture types that have GPU compute shaders
const GPU_SHADER_TYPES = new Set<string>(['nebula', 'starfield', 'explosion']);

export class ProceduralTextureGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private device: pc.GraphicsDevice | null = null;
  private computeShaders: Map<string, pc.Shader> = new Map();

  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create Canvas 2D context');
    }
    this.ctx = ctx;
  }

  // ==========================================================================
  // WebGPU Compute Shader Support
  // ==========================================================================

  /**
   * Set the PlayCanvas graphics device for WebGPU compute shader support.
   * Initializes the compute shader cache.
   */
  setDevice(device: pc.GraphicsDevice): void {
    this.device = device;
    this.computeShaders = new Map();
  }

  /**
   * Returns true if the device supports WebGPU compute shaders.
   */
  get isWebGPUAvailable(): boolean {
    return this.device?.supportsCompute ?? false;
  }

  /**
   * Generate a texture and return it as a PlayCanvas Texture.
   * Uses WebGPU compute shaders when available, falls back to Canvas2D otherwise.
   * Returns null if no device is set.
   */
  async generateTexture(config: TextureConfig): Promise<pc.Texture | null> {
    if (!this.device) {
      return null;
    }

    // Only use GPU path for types that have compute shaders
    if (this.isWebGPUAvailable && GPU_SHADER_TYPES.has(config.type)) {
      try {
        return await this.generateGPUTexture(config);
      } catch (e) {
        console.warn('GPU texture generation failed, falling back to Canvas2D:', e);
      }
    }

    // Fallback to Canvas2D
    const canvas = this.generate(config);
    return this.createTextureFromCanvas(canvas);
  }

  /**
   * Generate a texture using WebGPU compute shaders.
   * Creates a storage buffer, dispatches the compute shader, reads back pixel data,
   * and creates a PlayCanvas Texture from the result.
   */
  private async generateGPUTexture(config: TextureConfig): Promise<pc.Texture> {
    if (!this.device) {
      throw new Error('No graphics device available');
    }

    const { width, height, type, seed = Math.random() * 1000 } = config;

    // Create storage buffer for pixel data (width * height * 4 floats)
    const pixelCount = width * height;
    const byteSize = pixelCount * 4 * 4; // 4 floats per pixel, 4 bytes per float
    const buffer = new pc.StorageBuffer(
      this.device,
      byteSize,
      pc.BUFFERUSAGE_COPY_SRC | pc.BUFFERUSAGE_COPY_DST,
    );

    try {
      // Get or create the compute shader for this texture type
      const shader = this.getComputeShader(type);

      // Create compute instance
      const compute = new pc.Compute(this.device, shader, `TextureGen_${type}`);

      // Set common parameters
      compute.setParameter('outputBuffer', buffer);
      compute.setParameter('width', width);
      compute.setParameter('height', height);
      compute.setParameter('seed', seed);

      // Set type-specific parameters
      if (type === 'nebula') {
        this.setNebulaComputeParameters(compute, config.options as NebulaOptions);
      }

      // Dispatch compute shader with workgroups of 8x8
      const workgroupX = Math.ceil(width / 8);
      const workgroupY = Math.ceil(height / 8);
      compute.setupDispatch(workgroupX, workgroupY, 1);
      this.device.computeDispatch([compute]);

      // Read back data from the storage buffer.
      // Use immediate=true to force command buffer submission outside the render loop.
      const floatData = new Float32Array(pixelCount * 4);
      const bufferWithImmediate = buffer as unknown as StorageBufferWithImmediate;
      await bufferWithImmediate.read(0, byteSize, floatData, true);

      // Convert float data (0.0-1.0) to Uint8Array (0-255)
      const pixelData = new Uint8Array(pixelCount * 4);
      for (let i = 0; i < pixelCount * 4; i++) {
        pixelData[i] = Math.max(0, Math.min(255, Math.round(floatData[i] * 255)));
      }

      // Create PlayCanvas texture with RGBA8 format
      const texture = new pc.Texture(this.device, {
        name: `procedural_${type}_${Date.now()}`,
        width,
        height,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
      });

      // Set pixel data via lock/unlock
      const lockedData = texture.lock() as Uint8Array;
      lockedData.set(pixelData);
      texture.unlock();

      return texture;
    } finally {
      // Always destroy the storage buffer to free GPU memory
      buffer.destroy();
    }
  }

  /**
   * Set nebula-specific compute shader parameters (colors, turbulence, brightness).
   */
  private setNebulaComputeParameters(
    compute: pc.Compute,
    options: NebulaOptions | undefined,
  ): void {
    const colors = options?.colors ?? ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];
    const turbulence = options?.turbulence ?? 0.5;
    const brightness = options?.brightness ?? 0.8;

    compute.setParameter('turbulence', turbulence);
    compute.setParameter('brightness', brightness);

    // Parse hex colors and set as vec4f uniforms
    for (let i = 0; i < 4; i++) {
      const hex = colors[i % colors.length] ?? '#ffffff';
      const [r, g, b] = this.hexToRgbFloat(hex);
      compute.setParameter(`color${i + 1}`, [r, g, b, 1.0]);
    }
  }

  /**
   * Get a cached compute shader or create a new one for the given texture type.
   */
  private getComputeShader(type: string): pc.Shader {
    if (!this.device) {
      throw new Error('No graphics device available');
    }

    let shader = this.computeShaders.get(type);
    if (!shader) {
      shader = new pc.Shader(this.device, {
        name: `ComputeShader_${type}`,
        shaderLanguage: pc.SHADERLANGUAGE_WGSL,
        cshader: this.getShaderSource(type),
      });
      this.computeShaders.set(type, shader);
    }
    return shader;
  }

  /**
   * Get the WGSL compute shader source for the given texture type.
   */
  private getShaderSource(type: string): string {
    switch (type) {
      case 'nebula':
        return NEBULA_WGSL;
      case 'starfield':
        return STARFIELD_WGSL;
      case 'explosion':
        return EXPLOSION_WGSL;
      default:
        throw new Error(`No compute shader available for texture type: ${type}`);
    }
  }

  /**
   * Create a PlayCanvas Texture from an HTMLCanvasElement.
   */
  private createTextureFromCanvas(canvas: HTMLCanvasElement): pc.Texture {
    if (!this.device) {
      throw new Error('No graphics device available');
    }

    const texture = new pc.Texture(this.device, {
      name: `procedural_canvas_${Date.now()}`,
      width: canvas.width,
      height: canvas.height,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: false,
    });
    texture.setSource(canvas);
    return texture;
  }

  /**
   * Convert a hex color string to normalized RGB float values (0.0-1.0).
   */
  private hexToRgbFloat(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
  }

  // ==========================================================================
  // Canvas2D Fallback Path (existing methods - unchanged)
  // ==========================================================================

  generate(config: TextureConfig): HTMLCanvasElement {
    this.canvas.width = config.width;
    this.canvas.height = config.height;

    switch (config.type) {
      case 'nebula':
        this.generateNebula(config.options as NebulaOptions, config.seed);
        break;
      case 'planet':
        this.generatePlanet(config.options as PlanetOptions, config.seed);
        break;
      case 'hull':
        this.generateHull(config.options as HullOptions, config.seed);
        break;
      case 'explosion':
        this.generateExplosion(config.options, config.seed);
        break;
      case 'starfield':
        this.generateStarfield(config.options, config.seed);
        break;
      case 'grid':
        this.generateGrid(config.options, config.seed);
        break;
    }

    return this.canvas;
  }

  private generateNebula(options: NebulaOptions, _seed?: number): void {
    const {
      colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'],
      layers = 5,
      turbulence = 0.5,
      brightness = 0.8,
    } = options || {};

    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, width, height);

    for (let layer = 0; layer < layers; layer++) {
      const color = colors[layer % colors.length];
      const radius = Math.min(width, height) * (0.3 + layer * 0.1);
      const x = width * (0.3 + Math.random() * 0.4);
      const y = height * (0.3 + Math.random() * 0.4);

      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, this.hexToRgba(color, brightness * (1 - layer * 0.15)));
      gradient.addColorStop(0.5, this.hexToRgba(color, brightness * 0.3 * (1 - layer * 0.15)));
      gradient.addColorStop(1, this.hexToRgba(color, 0));

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.addNoise(turbulence);
  }

  private generatePlanet(options: PlanetOptions, _seed?: number): void {
    const {
      baseColor = '#8b4513',
      continentCount = 5,
      oceanColor = '#1e90ff',
      hasAtmosphere = true,
    } = options || {};

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.4;

    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = oceanColor;
    this.ctx.fill();

    for (let i = 0; i < continentCount; i++) {
      const cx = centerX + (Math.random() - 0.5) * radius * 0.6;
      const cy = centerY + (Math.random() - 0.5) * radius * 0.6;
      const r = radius * (0.2 + Math.random() * 0.3);

      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, this.hexToRgba(baseColor, 0));
      this.ctx.fillStyle = gradient;
      this.ctx.fill();
    }

    if (hasAtmosphere) {
      const atmosphereGradient = this.ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.9,
        centerX,
        centerY,
        radius * 1.2,
      );
      atmosphereGradient.addColorStop(0, 'rgba(100, 150, 255, 0.1)');
      atmosphereGradient.addColorStop(0.7, 'rgba(100, 150, 255, 0.2)');
      atmosphereGradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
      this.ctx.fillStyle = atmosphereGradient;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private generateHull(options: HullOptions, _seed?: number): void {
    const {
      baseColor = '#333333',
      stripeColor = '#ff6b6b',
      stripeCount = 3,
      damageLevel = 0.2,
    } = options || {};

    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.fillStyle = baseColor;
    this.ctx.fillRect(0, 0, width, height);

    const stripeSpacing = height / (stripeCount + 1);
    for (let i = 1; i <= stripeCount; i++) {
      const y = stripeSpacing * i;
      const gradient = this.ctx.createLinearGradient(0, y - 5, 0, y + 5);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.5, stripeColor);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, y - 5, width, 10);
    }

    const metalGradient = this.ctx.createLinearGradient(0, 0, width, height);
    metalGradient.addColorStop(0, 'rgba(255,255,255,0.05)');
    metalGradient.addColorStop(0.5, 'rgba(255,255,255,0.1)');
    metalGradient.addColorStop(1, 'rgba(0,0,0,0.1)');
    this.ctx.fillStyle = metalGradient;
    this.ctx.fillRect(0, 0, width, height);

    const damageCount = Math.floor((width * height * damageLevel) / 1000);
    for (let i = 0; i < damageCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 3 + 1;
      this.ctx.beginPath();
      this.ctx.arc(x, y, r, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(50, 50, 50, ${Math.random() * 0.5})`;
      this.ctx.fill();
    }
  }

  private generateExplosion(_options: unknown, _seed?: number): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    this.ctx.fillRect(0, 0, width, height);

    const colors = ['#ffffff', '#ffff00', '#ff8800', '#ff4400', '#ff0000'];

    for (let i = 0; i < 5; i++) {
      const radius = (width / 2) * (1 - i * 0.15);
      const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, colors[i]);
      gradient.addColorStop(0.3, colors[i]);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    const particleCount = 50;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const distance = Math.random() * (width / 2);
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      const size = Math.random() * 4 + 2;
      const alpha = 1 - distance / (width / 2);

      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
      this.ctx.fill();
    }
  }

  private generateStarfield(options: Record<string, unknown>, _seed?: number): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const starCount = options?.starCount || 200;

    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 2 + 0.5;
      const alpha = Math.random() * 0.8 + 0.2;

      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      this.ctx.fill();
    }
  }

  private generateGrid(options: Record<string, unknown>, _seed?: number): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const gridSize = options?.gridSize || 50;

    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.strokeStyle = 'rgba(100, 150, 255, 0.3)';
    this.ctx.lineWidth = 1;

    for (let x = 0; x <= width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    for (let y = 0; y <= height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }
  }

  private addNoise(intensity: number): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const imageData = this.ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 255 * intensity;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  toImage(): HTMLImageElement {
    const img = new Image();
    img.src = this.canvas.toDataURL('image/png');
    return img;
  }

  toBlob(): Promise<Blob> {
    return new Promise((resolve) => {
      this.canvas.toBlob((blob: Blob | null) => {
        if (blob) resolve(blob);
      }, 'image/png');
    });
  }
}
