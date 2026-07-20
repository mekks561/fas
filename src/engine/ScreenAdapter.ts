import * as pc from 'playcanvas';

export type ResolutionPreset = 'auto' | '720p' | '1080p' | '1440p' | '4k';
export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface ScreenConfig {
  resolution: ResolutionPreset;
  quality: QualityLevel;
  vsync: boolean;
  antiAliasing: boolean;
  fullscreen: boolean;
  maxFPS: number;
}

export interface ScreenMetrics {
  width: number;
  height: number;
  aspectRatio: number;
  devicePixelRatio: number;
  orientation: 'landscape' | 'portrait' | 'square';
  deviceType: DeviceType;
}

const QUALITY_PRESETS: Record<
  QualityLevel,
  {
    shadowResolution: number;
    shadowDistance: number;
    textureQuality: 'low' | 'medium' | 'high';
    particleDensity: number;
    maxLights: number;
    postProcessing: boolean;
  }
> = {
  low: {
    shadowResolution: 512,
    shadowDistance: 20,
    textureQuality: 'low',
    particleDensity: 0.5,
    maxLights: 2,
    postProcessing: false,
  },
  medium: {
    shadowResolution: 1024,
    shadowDistance: 40,
    textureQuality: 'medium',
    particleDensity: 0.75,
    maxLights: 4,
    postProcessing: true,
  },
  high: {
    shadowResolution: 2048,
    shadowDistance: 60,
    textureQuality: 'high',
    particleDensity: 1.0,
    maxLights: 8,
    postProcessing: true,
  },
  ultra: {
    shadowResolution: 4096,
    shadowDistance: 100,
    textureQuality: 'high',
    particleDensity: 1.5,
    maxLights: 16,
    postProcessing: true,
  },
};

export class ScreenAdapter {
  private app: pc.Application;
  private config: ScreenConfig;
  private metrics: ScreenMetrics;
  private listeners: Set<(metrics: ScreenMetrics) => void> = new Set();
  private resizeTimeout: number | null = null;

  constructor(app: pc.Application, config?: Partial<ScreenConfig>) {
    this.app = app;

    this.config = {
      resolution: config?.resolution || 'auto',
      quality: config?.quality || 'high',
      vsync: config?.vsync !== undefined ? config.vsync : true,
      antiAliasing: config?.antiAliasing !== undefined ? config.antiAliasing : true,
      fullscreen: config?.fullscreen || false,
      maxFPS: config?.maxFPS || 60,
    };

    this.metrics = this.calculateMetrics();
    this.applyConfig();

    window.addEventListener('resize', this.onResize.bind(this));
    window.addEventListener('orientationchange', this.onOrientationChange.bind(this));
  }

  private calculateMetrics(): ScreenMetrics {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;
    const devicePixelRatio = window.devicePixelRatio || 1;

    let orientation: 'landscape' | 'portrait' | 'square' = 'landscape';
    if (aspectRatio > 1.2) {
      orientation = 'landscape';
    } else if (aspectRatio < 0.8) {
      orientation = 'portrait';
    } else {
      orientation = 'square';
    }

    let deviceType: DeviceType = 'desktop';
    if (window.matchMedia('(max-width: 768px)').matches) {
      deviceType = 'mobile';
    } else if (window.matchMedia('(max-width: 1024px)').matches) {
      deviceType = 'tablet';
    }

    return {
      width,
      height,
      aspectRatio,
      devicePixelRatio,
      orientation,
      deviceType,
    };
  }

  private applyConfig(): void {
    if (this.config.resolution === 'auto') {
      this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    } else {
      this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    }

    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

    this.app.graphicsDevice.maxPixelRatio = this.metrics.devicePixelRatio;

    if (this.metrics.deviceType === 'mobile') {
      this.app.graphicsDevice.maxPixelRatio = Math.min(this.metrics.devicePixelRatio, 2);
    }
  }

  private onResize(): void {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    this.resizeTimeout = window.setTimeout(() => {
      this.metrics = this.calculateMetrics();
      this.applyConfig();
      this.notifyListeners();
      this.app.resizeCanvas();
    }, 100);
  }

  private onOrientationChange(): void {
    setTimeout(() => {
      this.metrics = this.calculateMetrics();
      this.notifyListeners();
      this.app.resizeCanvas();
    }, 200);
  }

  public setResolution(resolution: ResolutionPreset): void {
    this.config.resolution = resolution;
    this.applyConfig();
    this.app.resizeCanvas();
  }

  public setQuality(quality: QualityLevel): void {
    this.config.quality = quality;
    this.applyConfig();
  }

  public setVSync(enabled: boolean): void {
    this.config.vsync = enabled;
  }

  public setAntiAliasing(enabled: boolean): void {
    this.config.antiAliasing = enabled;
  }

  public toggleFullscreen(): boolean {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      this.config.fullscreen = true;
    } else {
      document.exitFullscreen().catch(() => {});
      this.config.fullscreen = false;
    }
    return this.config.fullscreen;
  }

  public setMaxFPS(fps: number): void {
    this.config.maxFPS = Math.max(30, Math.min(240, fps));
  }

  public getConfig(): ScreenConfig {
    return { ...this.config };
  }

  public getMetrics(): ScreenMetrics {
    return { ...this.metrics };
  }

  public getQualityPreset(): typeof QUALITY_PRESETS.high {
    return QUALITY_PRESETS[this.config.quality];
  }

  public addResizeListener(callback: (metrics: ScreenMetrics) => void): void {
    this.listeners.add(callback);
  }

  public removeResizeListener(callback: (metrics: ScreenMetrics) => void): void {
    this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((callback) => callback(this.metrics));
  }

  public isPortrait(): boolean {
    return this.metrics.orientation === 'portrait';
  }

  public isLandscape(): boolean {
    return this.metrics.orientation === 'landscape';
  }

  public getScaleFactor(): number {
    if (this.metrics.deviceType === 'mobile') {
      return 0.75;
    } else if (this.metrics.deviceType === 'tablet') {
      return 0.9;
    }
    return 1;
  }

  public getParticleScale(): number {
    const qualityPreset = QUALITY_PRESETS[this.config.quality];
    return qualityPreset.particleDensity * this.getScaleFactor();
  }

  public shouldEnableShadows(): boolean {
    return this.config.quality !== 'low' && this.metrics.deviceType !== 'mobile';
  }

  public shouldEnablePostProcessing(): boolean {
    const qualityPreset = QUALITY_PRESETS[this.config.quality];
    return qualityPreset.postProcessing && this.metrics.deviceType !== 'mobile';
  }

  public autoDetectQuality(): QualityLevel {
    const gpu = this.app.graphicsDevice as unknown as { renderer?: string };

    const renderer = gpu?.renderer || '';

    const isLowEndDevice =
      this.metrics.deviceType === 'mobile' ||
      /Intel|Mali|Adreno 3|Adreno 4/.test(renderer) ||
      this.metrics.width > 2000;

    const isHighEndDevice =
      /RTX|Radeon RX|GTX 10|Nvidia/.test(renderer) || this.metrics.width < 1500;

    if (isLowEndDevice) return 'low';
    if (isHighEndDevice) return 'ultra';
    return 'medium';
  }

  public destroy(): void {
    window.removeEventListener('resize', this.onResize.bind(this));
    window.removeEventListener('orientationchange', this.onOrientationChange.bind(this));

    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    this.listeners.clear();
  }
}

export class ResponsiveUI {
  private baseWidth: number = 1920;
  private baseHeight: number = 1080;
  private listeners: Set<() => void> = new Set();

  constructor(baseWidth: number = 1920, baseHeight: number = 1080) {
    this.baseWidth = baseWidth;
    this.baseHeight = baseHeight;

    window.addEventListener('resize', this.onResize.bind(this));
  }

  private onResize(): void {
    this.notifyListeners();
  }

  public getScale(): number {
    const scaleX = window.innerWidth / this.baseWidth;
    const scaleY = window.innerHeight / this.baseHeight;
    return Math.min(scaleX, scaleY);
  }

  public getRelativePosition(x: number, y: number): { x: number; y: number } {
    return {
      x: (x / this.baseWidth) * window.innerWidth,
      y: (y / this.baseHeight) * window.innerHeight,
    };
  }

  public getRelativeSize(width: number, height: number): { width: number; height: number } {
    const scale = this.getScale();
    return {
      width: width * scale,
      height: height * scale,
    };
  }

  public addListener(callback: () => void): void {
    this.listeners.add(callback);
  }

  public removeListener(callback: () => void): void {
    this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((callback) => callback());
  }

  public destroy(): void {
    window.removeEventListener('resize', this.onResize.bind(this));
    this.listeners.clear();
  }
}
