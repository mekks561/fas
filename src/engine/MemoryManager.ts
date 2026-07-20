import * as pc from 'playcanvas';

export interface MemoryStats {
  usedMemory: number;
  peakMemory: number;
  allocatedResources: number;
  activeResources: number;
  recycledResources: number;
}

export interface ResourceEntry {
  id: string;
  type: string;
  resource: unknown;
  size: number;
  lastUsed: number;
  usageCount: number;
  persistent: boolean;
  unloadCallback?: () => void;
}

export interface MemoryConfig {
  maxMemory: number;
  warningThreshold: number;
  cleanupInterval: number;
  maxIdleTime: number;
}

export class MemoryManager {
  private resources: Map<string, ResourceEntry> = new Map();
  private resourceTypes: Map<string, Set<string>> = new Map();
  private isEnabled: boolean = true;
  private usedMemory: number = 0;
  private peakMemory: number = 0;
  private recycledCount: number = 0;
  private cleanupTime: number = 0;

  private config: MemoryConfig = {
    maxMemory: 512 * 1024 * 1024,
    warningThreshold: 0.8,
    cleanupInterval: 5000,
    maxIdleTime: 30000,
  };

  private listeners: Set<(stats: MemoryStats) => void> = new Set();

  constructor(config?: Partial<MemoryConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  public addResource(
    id: string,
    type: string,
    resource: unknown,
    size: number = 0,
    persistent: boolean = false,
    unloadCallback?: () => void,
  ): void {
    if (!this.isEnabled) return;

    const existing = this.resources.get(id);
    if (existing) {
      this.removeResource(id);
    }

    const entry: ResourceEntry = {
      id,
      type,
      resource,
      size,
      lastUsed: Date.now(),
      usageCount: 0,
      persistent,
      unloadCallback,
    };

    this.resources.set(id, entry);

    if (!this.resourceTypes.has(type)) {
      this.resourceTypes.set(type, new Set());
    }
    this.resourceTypes.get(type)?.add(id);

    this.usedMemory += size;
    if (this.usedMemory > this.peakMemory) {
      this.peakMemory = this.usedMemory;
    }

    this.notifyListeners();
  }

  public getResource<T = unknown>(id: string): T | undefined {
    const entry = this.resources.get(id);
    if (!entry) return undefined;

    entry.lastUsed = Date.now();
    entry.usageCount++;

    return entry.resource as T;
  }

  public removeResource(id: string): boolean {
    const entry = this.resources.get(id);
    if (!entry) return false;

    if (entry.unloadCallback) {
      try {
        entry.unloadCallback();
      } catch (error) {
        console.warn(`MemoryManager: Error unloading resource ${id}:`, error);
      }
    }

    this.usedMemory -= entry.size;
    this.resources.delete(id);

    const typeSet = this.resourceTypes.get(entry.type);
    typeSet?.delete(id);

    this.recycledCount++;
    this.notifyListeners();

    return true;
  }

  public removeResourcesByType(type: string): number {
    const typeSet = this.resourceTypes.get(type);
    if (!typeSet) return 0;

    let count = 0;
    const ids = Array.from(typeSet);
    for (const id of ids) {
      if (this.removeResource(id)) {
        count++;
      }
    }

    return count;
  }

  public releaseUnusedResources(maxAge?: number): number {
    const age = maxAge || this.config.maxIdleTime;
    const now = Date.now();
    let count = 0;

    for (const [id, entry] of this.resources) {
      if (entry.persistent) continue;
      if (now - entry.lastUsed > age) {
        if (this.removeResource(id)) {
          count++;
        }
      }
    }

    return count;
  }

  public cleanupToTarget(targetMemory: number): number {
    if (this.usedMemory <= targetMemory) return 0;

    const entries = Array.from(this.resources.values())
      .filter((e) => !e.persistent)
      .sort((a, b) => a.lastUsed - b.lastUsed);

    let count = 0;

    for (const entry of entries) {
      if (this.usedMemory <= targetMemory) break;

      if (this.removeResource(entry.id)) {
        count++;
      }
    }

    return count;
  }

  public update(dt: number): void {
    if (!this.isEnabled) return;

    this.cleanupTime += dt;
    if (this.cleanupTime >= this.config.cleanupInterval) {
      this.cleanupTime = 0;
      this.autoCleanup();
    }
  }

  private autoCleanup(): void {
    const warningLimit = this.config.maxMemory * this.config.warningThreshold;

    if (this.usedMemory > warningLimit) {
      const targetMemory = this.config.maxMemory * 0.5;
      const freed = this.cleanupToTarget(targetMemory);
      if (freed > 0) {
        console.warn(`MemoryManager: Auto-cleanup freed ${freed} resources`);
      }
    } else {
      this.releaseUnusedResources();
    }
  }

  public getStats(): MemoryStats {
    return {
      usedMemory: this.usedMemory,
      peakMemory: this.peakMemory,
      allocatedResources: this.resources.size,
      activeResources: this.resources.size,
      recycledResources: this.recycledCount,
    };
  }

  public getResourceTypeStats(): Record<string, { count: number; totalSize: number }> {
    const stats: Record<string, { count: number; totalSize: number }> = {};

    for (const [type, ids] of this.resourceTypes) {
      let totalSize = 0;
      for (const id of ids) {
        const entry = this.resources.get(id);
        if (entry) {
          totalSize += entry.size;
        }
      }
      stats[type] = {
        count: ids.size,
        totalSize,
      };
    }

    return stats;
  }

  public getResourceUsage(id: string): { usageCount: number; lastUsed: number } | null {
    const entry = this.resources.get(id);
    if (!entry) return null;

    return {
      usageCount: entry.usageCount,
      lastUsed: entry.lastUsed,
    };
  }

  public setResourcePersistent(id: string, persistent: boolean): boolean {
    const entry = this.resources.get(id);
    if (!entry) return false;

    entry.persistent = persistent;
    return true;
  }

  public markAsUsed(id: string): boolean {
    const entry = this.resources.get(id);
    if (!entry) return false;

    entry.lastUsed = Date.now();
    entry.usageCount++;
    return true;
  }

  public subscribe(callback: (stats: MemoryStats) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const stats = this.getStats();
    this.listeners.forEach((callback) => callback(stats));
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public destroy(): void {
    for (const [id] of this.resources) {
      this.removeResource(id);
    }
    this.resources.clear();
    this.resourceTypes.clear();
    this.listeners.clear();
    this.usedMemory = 0;
    this.peakMemory = 0;
    this.recycledCount = 0;
  }

  public estimateMeshSize(mesh: pc.Mesh): number {
    let size = 0;

    if (mesh.vertexBuffer) {
      size += mesh.vertexBuffer.numVertices * 32;
    }

    const indexBuffer = mesh.indexBuffer as unknown as { length?: number };
    if (indexBuffer && indexBuffer.length !== undefined) {
      size += indexBuffer.length * 2;
    }

    return size;
  }

  public estimateTextureSize(texture: pc.Texture): number {
    const formatSize: Record<number, number> = {
      [pc.PIXELFORMAT_R8_G8_B8_A8]: 4,
      [pc.PIXELFORMAT_R5_G6_B5]: 2,
      [pc.PIXELFORMAT_R8_G8_B8]: 3,
      [pc.PIXELFORMAT_DXT1]: 0.5,
      [pc.PIXELFORMAT_DXT5]: 1,
      [pc.PIXELFORMAT_PVRTC_2BPP_RGB_1]: 0.25,
      [pc.PIXELFORMAT_PVRTC_4BPP_RGB_1]: 0.5,
      [pc.PIXELFORMAT_ETC1]: 0.5,
    };

    const width = texture.width || 0;
    const height = texture.height || 0;
    const format = texture.format || pc.PIXELFORMAT_R8_G8_B8_A8;

    return width * height * (formatSize[format] || 4);
  }

  public estimateMaterialSize(_material: pc.Material): number {
    return 1024;
  }

  public getMemoryUsagePercent(): number {
    return (this.usedMemory / this.config.maxMemory) * 100;
  }

  public isMemoryWarning(): boolean {
    return this.getMemoryUsagePercent() >= this.config.warningThreshold * 100;
  }
}
