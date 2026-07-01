export interface TextureConfig {
  width: number;
  height: number;
  type: 'nebula' | 'planet' | 'hull' | 'explosion' | 'starfield' | 'grid';
  seed?: number;
  options?: any;
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

export class ProceduralTextureGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create Canvas 2D context');
    }
    this.ctx = ctx;
  }

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

  private generateNebula(options: NebulaOptions, seed?: number): void {
    const { colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'], 
            layers = 5, turbulence = 0.5, brightness = 0.8 } = options || {};

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

  private generatePlanet(options: PlanetOptions, seed?: number): void {
    const { baseColor = '#8b4513', continentCount = 5, 
            oceanColor = '#1e90ff', iceCapColor = '#ffffff', hasAtmosphere = true } = options || {};

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
      const atmosphereGradient = this.ctx.createRadialGradient(centerX, centerY, radius * 0.9, centerX, centerY, radius * 1.2);
      atmosphereGradient.addColorStop(0, 'rgba(100, 150, 255, 0.1)');
      atmosphereGradient.addColorStop(0.7, 'rgba(100, 150, 255, 0.2)');
      atmosphereGradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
      this.ctx.fillStyle = atmosphereGradient;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private generateHull(options: HullOptions, seed?: number): void {
    const { baseColor = '#333333', stripeColor = '#ff6b6b', 
            stripeCount = 3, damageLevel = 0.2 } = options || {};

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

    const damageCount = Math.floor(width * height * damageLevel / 1000);
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

  private generateExplosion(options: any, seed?: number): void {
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
      const alpha = 1 - (distance / (width / 2));

      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
      this.ctx.fill();
    }
  }

  private generateStarfield(options: any, seed?: number): void {
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

  private generateGrid(options: any, seed?: number): void {
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
      this.canvas.toBlob(resolve, 'image/png');
    });
  }
}
