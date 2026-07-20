export interface PerformanceStats {
  fps: number;
  frameTime: number;
  physicsTime: number;
  aiTime: number;
  gpuPhysics: boolean;
  aiEnabled: boolean;
  activeParticles: number;
  activeNPCs: number;
}

export class PerformanceMonitor {
  private readonly BUFFER_SIZE = 60;
  private frameTimes: number[] = new Array(this.BUFFER_SIZE).fill(0);
  private physicsTimes: number[] = new Array(this.BUFFER_SIZE).fill(0);
  private aiTimes: number[] = new Array(this.BUFFER_SIZE).fill(0);
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private fps = 0;

  private gpuPhysics = false;
  private aiEnabled = false;
  private activeParticles = 0;
  private activeNPCs = 0;

  private frameTimeIndex = 0;
  private physicsTimeIndex = 0;
  private aiTimeIndex = 0;

  public recordFrameTime(time: number): void {
    this.frameTimes[this.frameTimeIndex] = time;
    this.frameTimeIndex = (this.frameTimeIndex + 1) % this.BUFFER_SIZE;

    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = Math.round(this.frameCount * 1000 / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  public recordPhysicsTime(time: number): void {
    this.physicsTimes[this.physicsTimeIndex] = time;
    this.physicsTimeIndex = (this.physicsTimeIndex + 1) % this.BUFFER_SIZE;
  }

  public recordAiTime(time: number): void {
    this.aiTimes[this.aiTimeIndex] = time;
    this.aiTimeIndex = (this.aiTimeIndex + 1) % this.BUFFER_SIZE;
  }

  public setGpuPhysics(enabled: boolean): void {
    this.gpuPhysics = enabled;
  }

  public setAiEnabled(enabled: boolean): void {
    this.aiEnabled = enabled;
  }

  public setActiveParticles(count: number): void {
    this.activeParticles = count;
  }

  public setActiveNPCs(count: number): void {
    this.activeNPCs = count;
  }

  public getStats(): PerformanceStats {
    return {
      fps: this.fps,
      frameTime: this.calculateAverage(this.frameTimes),
      physicsTime: this.calculateAverage(this.physicsTimes),
      aiTime: this.calculateAverage(this.aiTimes),
      gpuPhysics: this.gpuPhysics,
      aiEnabled: this.aiEnabled,
      activeParticles: this.activeParticles,
      activeNPCs: this.activeNPCs,
    };
  }

  private calculateAverage(values: number[]): number {
    let sum = 0;
    let count = 0;
    for (const value of values) {
      if (value > 0) {
        sum += value;
        count++;
      }
    }
    return count > 0 ? Math.round(sum / count * 100) / 100 : 0;
  }

  public reset(): void {
    this.frameTimes = new Array(this.BUFFER_SIZE).fill(0);
    this.physicsTimes = new Array(this.BUFFER_SIZE).fill(0);
    this.aiTimes = new Array(this.BUFFER_SIZE).fill(0);
    this.frameCount = 0;
    this.fps = 0;
    this.frameTimeIndex = 0;
    this.physicsTimeIndex = 0;
    this.aiTimeIndex = 0;
  }
}
