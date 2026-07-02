/**
 * 高性能游戏性能监控系统
 * 实时监控FPS、内存、绘制调用等关键指标
 */

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  memoryUsage: number;
  cpuUsage: number;
  particleCount: number;
  enemyCount: number;
  projectileCount: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fps: 60,
    frameTime: 16.67,
    drawCalls: 0,
    triangles: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    particleCount: 0,
    enemyCount: 0,
    projectileCount: 0,
  };

  private frameTimes: number[] = [];
  private maxFrameTimeHistory: number = 60;
  private lastFpsUpdate: number = 0;
  private fpsUpdateInterval: number = 500;

  private onMetricsUpdate?: (metrics: PerformanceMetrics) => void;

  /**
   * 更新帧率
   */
  public updateFps(frameTime: number): void {
    this.frameTimes.push(frameTime);

    if (this.frameTimes.length > this.maxFrameTimeHistory) {
      this.frameTimes.shift();
    }

    const now = performance.now();
    if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.metrics.fps = Math.round(1000 / avgFrameTime);
      this.metrics.frameTime = avgFrameTime;
      this.lastFpsUpdate = now;

      this.notifyUpdate();
    }
  }

  /**
   * 更新绘制指标
   */
  public updateDrawMetrics(drawCalls: number, triangles: number): void {
    this.metrics.drawCalls = drawCalls;
    this.metrics.triangles = triangles;
  }

  /**
   * 更新内存使用
   */
  public updateMemoryUsage(): void {
    if (performance.memory) {
      this.metrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
  }

  /**
   * 更新游戏对象计数
   */
  public updateObjectCounts(
    particleCount: number,
    enemyCount: number,
    projectileCount: number,
  ): void {
    this.metrics.particleCount = particleCount;
    this.metrics.enemyCount = enemyCount;
    this.metrics.projectileCount = projectileCount;
  }

  /**
   * 获取当前指标
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 设置指标更新回调
   */
  public setOnMetricsUpdate(callback: (metrics: PerformanceMetrics) => void): void {
    this.onMetricsUpdate = callback;
  }

  /**
   * 通知更新
   */
  private notifyUpdate(): void {
    if (this.onMetricsUpdate) {
      this.onMetricsUpdate(this.metrics);
    }
  }

  /**
   * 获取性能等级
   */
  public getPerformanceLevel(): 'excellent' | 'good' | 'warning' | 'critical' {
    if (this.metrics.fps >= 55) return 'excellent';
    if (this.metrics.fps >= 40) return 'good';
    if (this.metrics.fps >= 30) return 'warning';
    return 'critical';
  }

  /**
   * 重置监控
   */
  public reset(): void {
    this.frameTimes = [];
    this.lastFpsUpdate = performance.now();
  }
}

/**
 * 性能警告系统
 */
export class PerformanceWarningSystem {
  private monitor: PerformanceMonitor;
  private warningThresholds = {
    fps: 30,
    memory: 500, // MB
    drawCalls: 1000,
  };

  private warnings: string[] = [];

  constructor(monitor: PerformanceMonitor) {
    this.monitor = monitor;
    monitor.setOnMetricsUpdate(() => this.checkWarnings());
  }

  private checkWarnings(): void {
    const metrics = this.monitor.getMetrics();
    this.warnings = [];

    if (metrics.fps < this.warningThresholds.fps) {
      this.warnings.push(`FPS过低: ${metrics.fps}`);
    }

    if (metrics.memoryUsage > this.warningThresholds.memory) {
      this.warnings.push(`内存占用过高: ${metrics.memoryUsage}MB`);
    }

    if (metrics.drawCalls > this.warningThresholds.drawCalls) {
      this.warnings.push(`绘制调用过多: ${metrics.drawCalls}`);
    }

    if (this.warnings.length > 0) {
      console.warn('[Performance]', this.warnings.join(', '));
    }
  }

  public getWarnings(): string[] {
    return [...this.warnings];
  }
}
