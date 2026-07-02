import * as pc from 'playcanvas';

export interface PerformanceMetrics {
  fps: number;
  fpsMin: number;
  fpsMax: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  memoryUsed: number;
  memoryTotal: number;
  entityCount: number;
  particleCount: number;
  audioSources: number;
}

export interface FrameStats {
  deltaTime: number;
  updateTime: number;
  renderTime: number;
}

export class PerformanceMonitor {
  private app: pc.Application;
  private frameCount: number = 0;
  private lastTime: number = 0;
  private fpsHistory: number[] = [];
  private maxHistorySize: number = 60;

  private fpsMin: number = 60;
  private fpsMax: number = 0;
  private totalFps: number = 0;

  private updateStartTime: number = 0;
  private renderStartTime: number = 0;

  private lastFrameTime: number = 0;
  private deltaTime: number = 0;

  private isMonitoring: boolean = false;
  private updateCallback: ((metrics: PerformanceMetrics) => void) | null = null;
  private intervalId: number | null = null;

  constructor(app: pc.Application) {
    this.app = app;
  }

  public start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.lastTime = performance.now();

    this.app.on('update', this.onUpdate.bind(this));

    this.intervalId = window.setInterval(() => {
      this.reportMetrics();
    }, 1000);
  }

  public stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public setUpdateCallback(callback: (metrics: PerformanceMetrics) => void): void {
    this.updateCallback = callback;
  }

  public beginUpdate(): void {
    this.updateStartTime = performance.now();
  }

  public endUpdate(): void {
    const now = performance.now();
    this.lastFrameTime = now - this.updateStartTime;
  }

  public beginRender(): void {
    this.renderStartTime = performance.now();
  }

  public endRender(): void {
    // Rendering time is measured by frame callback
  }

  private onUpdate(dt: number): void {
    this.deltaTime = dt;
    this.frameCount++;
  }

  private reportMetrics(): void {
    if (!this.isMonitoring) return;

    const fps = this.frameCount;
    this.frameCount = 0;

    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > this.maxHistorySize) {
      this.fpsHistory.shift();
    }

    this.fpsMin = Math.min(this.fpsMin, fps);
    this.fpsMax = Math.max(this.fpsMax, fps);
    this.totalFps += fps;

    const metrics = this.getMetrics();

    if (this.updateCallback) {
      this.updateCallback(metrics);
    }
  }

  public getMetrics(): PerformanceMetrics {
    const gpu = this.app.graphicsDevice;

    let memoryUsed = 0;
    let memoryTotal = 0;

    if ('memory' in performance) {
      const memory = (
        performance as unknown as { memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } }
      ).memory;
      memoryUsed = memory.usedJSHeapSize / (1024 * 1024);
      memoryTotal = memory.jsHeapSizeLimit / (1024 * 1024);
    }

    let entityCount = 0;
    let particleCount = 0;

    this.app.root?.find((entity: pc.Entity) => {
      entityCount++;
      if (entity.particlesystem) {
        particleCount++;
      }
      return false;
    });

    const currentFps =
      this.fpsHistory.length > 0
        ? this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
        : 60;

    return {
      fps: Math.round(currentFps),
      fpsMin: this.fpsMin,
      fpsMax: this.fpsMax,
      frameTime: this.lastFrameTime,
      drawCalls: gpu.drawCalls,
      triangles: gpu.triangles,
      memoryUsed,
      memoryTotal,
      entityCount,
      particleCount,
      audioSources: 0,
    };
  }

  public getAverageFps(): number {
    if (this.fpsHistory.length === 0) return 60;
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
  }

  public getFpsVariance(): number {
    if (this.fpsHistory.length < 2) return 0;

    const mean = this.getAverageFps();
    const squaredDiffs = this.fpsHistory.map((fps) => Math.pow(fps - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
  }

  public getFpsStability(): number {
    const variance = this.getFpsVariance();
    return Math.max(0, 100 - variance);
  }

  public reset(): void {
    this.fpsHistory = [];
    this.fpsMin = 60;
    this.fpsMax = 0;
    this.totalFps = 0;
    this.frameCount = 0;
  }

  public getDeltaTime(): number {
    return this.deltaTime;
  }

  public isPerformanceAcceptable(): boolean {
    return this.getAverageFps() >= 55;
  }

  public needsOptimization(): { level: 'none' | 'low' | 'medium' | 'high'; reason: string } {
    const fps = this.getAverageFps();

    if (fps >= 55) {
      return { level: 'none', reason: 'Performance is excellent' };
    } else if (fps >= 40) {
      return { level: 'low', reason: 'Minor performance issues detected' };
    } else if (fps >= 25) {
      return { level: 'medium', reason: 'Significant performance issues' };
    } else {
      return { level: 'high', reason: 'Critical performance problems' };
    }
  }
}

export class MemoryManager {
  private app: pc.Application;
  private loadedAssets: Map<string, pc.Asset> = new Map();
  private assetReferenceCounts: Map<string, number> = new Map();

  constructor(app: pc.Application) {
    this.app = app;
  }

  public registerAsset(id: string, asset: pc.Asset): void {
    this.loadedAssets.set(id, asset);
    this.assetReferenceCounts.set(id, 1);
  }

  public addReference(id: string): void {
    const count = this.assetReferenceCounts.get(id) || 0;
    this.assetReferenceCounts.set(id, count + 1);
  }

  public releaseReference(id: string): void {
    const count = this.assetReferenceCounts.get(id) || 0;
    if (count > 0) {
      this.assetReferenceCounts.set(id, count - 1);
    }
  }

  public unloadUnusedAssets(): number {
    let unloadedCount = 0;

    this.assetReferenceCounts.forEach((count, id) => {
      if (count === 0) {
        const asset = this.loadedAssets.get(id);
        if (asset) {
          this.app.assets.remove(asset);
          asset.unload();
          this.loadedAssets.delete(id);
          this.assetReferenceCounts.delete(id);
          unloadedCount++;
        }
      }
    });

    return unloadedCount;
  }

  public getMemoryUsage(): { used: number; total: number; assetCount: number } {
    let used = 0;

    if ('memory' in performance) {
      const memory = (
        performance as unknown as { memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } }
      ).memory;
      used = memory.usedJSHeapSize / (1024 * 1024);
    }

    return {
      used,
      total: this.loadedAssets.size,
      assetCount: this.loadedAssets.size,
    };
  }

  public clear(): void {
    this.loadedAssets.forEach((asset) => {
      this.app.assets.remove(asset);
      asset.unload();
    });

    this.loadedAssets.clear();
    this.assetReferenceCounts.clear();
  }
}
