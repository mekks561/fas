import * as pc from 'playcanvas';

export type ResourceType =
  'model' | 'texture' | 'audio' | 'material' | 'json' | 'font' | 'shader' | 'prefab';

export interface ResourceDescriptor {
  id: string;
  type: ResourceType;
  url: string;
  priority?: number;
  preload?: boolean;
  cacheable?: boolean;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

export interface LoadingProgress {
  total: number;
  loaded: number;
  failed: number;
  inProgress: number;
  percentage: number;
  currentResource?: string;
}

export interface ResourceEntry {
  descriptor: ResourceDescriptor;
  asset: pc.Asset | unknown;
  loadedAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  isLoaded: boolean;
}

export type ResourceLoadCallback = (resource: ResourceEntry) => void;
export type ProgressCallback = (progress: LoadingProgress) => void;
export type ErrorCallback = (error: Error, descriptor: ResourceDescriptor) => void;

interface LoadQueueItem {
  descriptor: ResourceDescriptor;
  resolve: (entry: ResourceEntry) => void;
  reject: (error: Error) => void;
}

export class ResourceManager {
  private app: pc.Application | null = null;
  private resources: Map<string, ResourceEntry> = new Map();
  private loadQueue: LoadQueueItem[] = [];
  private activeLoads: Set<string> = new Set();
  private maxConcurrentLoads: number = 6;
  private progressCallbacks: ProgressCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private loadPromises: Map<string, Promise<ResourceEntry>> = new Map();
  private cache: Map<string, unknown> = new Map();
  private maxCacheSize: number = 100 * 1024 * 1024;
  private currentCacheSize: number = 0;
  private isEnabled: boolean = true;
  private totalLoads: number = 0;
  private completedLoads: number = 0;
  private failedLoads: number = 0;

  constructor(app?: pc.Application) {
    this.app = app || null;
  }

  public setApp(app: pc.Application): void {
    this.app = app;
  }

  public registerResource(descriptor: ResourceDescriptor): void {
    if (this.resources.has(descriptor.id)) return;

    const entry: ResourceEntry = {
      descriptor,
      asset: null,
      loadedAt: 0,
      lastAccessed: 0,
      accessCount: 0,
      size: 0,
      isLoaded: false,
    };

    this.resources.set(descriptor.id, entry);
  }

  public registerResources(descriptors: ResourceDescriptor[]): void {
    descriptors.forEach((d) => this.registerResource(d));
  }

  public async loadResource(id: string): Promise<ResourceEntry> {
    if (!this.isEnabled) {
      throw new Error('ResourceManager is disabled');
    }

    const entry = this.resources.get(id);
    if (!entry) {
      throw new Error(`Resource not registered: ${id}`);
    }

    if (entry.isLoaded) {
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      return entry;
    }

    if (this.loadPromises.has(id)) {
      return this.loadPromises.get(id) as Promise<ResourceEntry>;
    }

    if (entry.descriptor.dependencies) {
      await this.loadDependencies(entry.descriptor.dependencies);
    }

    const promise = this.enqueueLoad(entry);
    this.loadPromises.set(id, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.loadPromises.delete(id);
    }
  }

  public async loadResources(ids: string[]): Promise<ResourceEntry[]> {
    const promises = ids.map((id) => this.loadResource(id));
    return Promise.all(promises);
  }

  public async preloadLevel(levelId: string): Promise<void> {
    const levelResources = Array.from(this.resources.values()).filter(
      (r) => r.descriptor.preload && r.descriptor.metadata?.['level'] === levelId,
    );

    const ids = levelResources.map((r) => r.descriptor.id);
    await this.loadResources(ids);
  }

  private async loadDependencies(dependencies: string[]): Promise<void> {
    const unloaded = dependencies.filter((id) => {
      const entry = this.resources.get(id);
      return entry && !entry.isLoaded;
    });

    if (unloaded.length > 0) {
      await this.loadResources(unloaded);
    }
  }

  private enqueueLoad(entry: ResourceEntry): Promise<ResourceEntry> {
    return new Promise((resolve, reject) => {
      this.loadQueue.push({
        descriptor: entry.descriptor,
        resolve,
        reject,
      });
      this.processQueue();
    });
  }

  private processQueue(): void {
    while (this.activeLoads.size < this.maxConcurrentLoads && this.loadQueue.length > 0) {
      const item = this.loadQueue.shift() as LoadQueueItem;
      this.activeLoads.add(item.descriptor.id);
      this.performLoad(item);
    }
  }

  private async performLoad(item: LoadQueueItem): Promise<void> {
    const { descriptor, resolve, reject } = item;
    const entry = this.resources.get(descriptor.id);

    if (!entry) {
      reject(new Error(`Resource missing: ${descriptor.id}`));
      this.activeLoads.delete(descriptor.id);
      this.processQueue();
      return;
    }

    this.totalLoads++;
    this.notifyProgress(descriptor.id);

    try {
      const asset = await this.loadAsset(descriptor);

      entry.asset = asset;
      entry.isLoaded = true;
      entry.loadedAt = Date.now();
      entry.lastAccessed = Date.now();
      entry.size = this.estimateSize(asset);

      this.completedLoads++;
      this.addToCache(descriptor.id, asset, entry.size);
      this.notifyProgress(descriptor.id);

      resolve(entry);
    } catch (error: unknown) {
      this.failedLoads++;
      entry.isLoaded = false;
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.notifyError(errorObj, descriptor);
      reject(errorObj);
    } finally {
      this.activeLoads.delete(descriptor.id);
      this.processQueue();
    }
  }

  private async loadAsset(descriptor: ResourceDescriptor): Promise<pc.Asset | unknown> {
    if (this.app) {
      return this.loadPlayCanvasAsset(descriptor);
    }
    return this.loadGenericAsset(descriptor);
  }

  private loadPlayCanvasAsset(descriptor: ResourceDescriptor): Promise<pc.Asset> {
    if (!this.app) {
      return Promise.reject(new Error('App not set'));
    }

    return new Promise((resolve, reject) => {
      const asset = new pc.Asset(descriptor.id, this.mapResourceType(descriptor.type), {
        url: descriptor.url,
      });

      this.app?.assets.add(asset);

      this.app?.assets.load(asset);

      asset.once('load', () => resolve(asset));
      asset.once('error', (err: string) => reject(new Error(err)));
    });
  }

  private async loadGenericAsset(descriptor: ResourceDescriptor): Promise<unknown> {
    switch (descriptor.type) {
      case 'json':
        return this.loadJson(descriptor.url);
      case 'audio':
        return this.loadAudio(descriptor.url);
      case 'texture':
        return this.loadImage(descriptor.url);
      case 'font':
        return this.loadFont(descriptor.url);
      default:
        return this.loadJson(descriptor.url);
    }
  }

  private async loadJson(url: string): Promise<unknown> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load JSON: ${url}`);
    }
    return response.json();
  }

  private async loadAudio(url: string): Promise<HTMLAudioElement> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.addEventListener('canplaythrough', () => resolve(audio));
      audio.addEventListener('error', () => reject(new Error(`Failed to load audio: ${url}`)));
      audio.load();
    });
  }

  private async loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  private async loadFont(url: string): Promise<FontFace> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load font: ${url}`);
    }
    const buffer = await response.arrayBuffer();
    const fontFace = new FontFace('CustomFont', buffer);
    await fontFace.load();
    document.fonts.add(fontFace);
    return fontFace;
  }

  private mapResourceType(type: ResourceType): string {
    const typeMap: Record<ResourceType, string> = {
      model: 'container',
      texture: 'texture',
      audio: 'audio',
      material: 'material',
      json: 'json',
      font: 'font',
      shader: 'shader',
      prefab: 'container',
    };
    return typeMap[type] || 'json';
  }

  private estimateSize(asset: unknown): number {
    if (!asset) return 0;
    if (asset instanceof HTMLImageElement) {
      return asset.width * asset.height * 4;
    }
    if (asset instanceof HTMLAudioElement) {
      return asset.duration * 44100 * 2;
    }
    if (typeof asset === 'object') {
      try {
        return JSON.stringify(asset).length;
      } catch {
        return 1024;
      }
    }
    return 1024;
  }

  private addToCache(id: string, asset: unknown, size: number): void {
    if (this.currentCacheSize + size > this.maxCacheSize) {
      this.evictCache();
    }

    this.cache.set(id, asset);
    this.currentCacheSize += size;
  }

  private evictCache(): void {
    const entries = Array.from(this.resources.entries())
      .filter(([_, entry]) => entry.isLoaded)
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    while (this.currentCacheSize > this.maxCacheSize * 0.8 && entries.length > 0) {
      const [id, entry] = entries.shift() as [string, ResourceEntry];
      this.cache.delete(id);
      this.currentCacheSize -= entry.size;
    }
  }

  public getResource<T = unknown>(id: string): T | null {
    const entry = this.resources.get(id);
    if (!entry || !entry.isLoaded) return null;

    entry.lastAccessed = Date.now();
    entry.accessCount++;

    return entry.asset as T;
  }

  public isResourceLoaded(id: string): boolean {
    const entry = this.resources.get(id);
    return entry?.isLoaded || false;
  }

  public isResourceRegistered(id: string): boolean {
    return this.resources.has(id);
  }

  public unloadResource(id: string): void {
    const entry = this.resources.get(id);
    if (!entry) return;

    if (this.cache.has(id)) {
      this.cache.delete(id);
      this.currentCacheSize -= entry.size;
    }

    if (this.app && entry.asset) {
      const asset = entry.asset as pc.Asset;
      if (typeof (asset as unknown as { unload: () => void }).unload === 'function') {
        (asset as unknown as { unload: () => void }).unload();
      }
      this.app.assets.remove(asset);
    }

    entry.isLoaded = false;
    entry.asset = null;
  }

  public getProgress(): LoadingProgress {
    const loaded = this.completedLoads;
    const failed = this.failedLoads;
    const inProgress = this.activeLoads.size;
    const total = this.totalLoads;

    return {
      total,
      loaded,
      failed,
      inProgress,
      percentage: total > 0 ? (loaded / total) * 100 : 0,
    };
  }

  public onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.push(callback);
    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index > -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  public onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  private notifyProgress(currentResource?: string): void {
    const progress = this.getProgress();
    if (currentResource) {
      progress.currentResource = currentResource;
    }
    this.progressCallbacks.forEach((cb) => cb(progress));
  }

  private notifyError(error: Error, descriptor: ResourceDescriptor): void {
    this.errorCallbacks.forEach((cb) => cb(error, descriptor));
  }

  public clearCache(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
  }

  public getCacheSize(): number {
    return this.currentCacheSize;
  }

  public getMaxCacheSize(): number {
    return this.maxCacheSize;
  }

  public setMaxCacheSize(size: number): void {
    this.maxCacheSize = size;
    if (this.currentCacheSize > this.maxCacheSize) {
      this.evictCache();
    }
  }

  public setMaxConcurrentLoads(max: number): void {
    this.maxConcurrentLoads = Math.max(1, max);
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public getResourceCount(): number {
    return this.resources.size;
  }

  public getLoadedCount(): number {
    let count = 0;
    this.resources.forEach((r) => {
      if (r.isLoaded) count++;
    });
    return count;
  }

  public destroy(): void {
    this.resources.forEach((_, id) => this.unloadResource(id));
    this.resources.clear();
    this.loadQueue = [];
    this.activeLoads.clear();
    this.loadPromises.clear();
    this.cache.clear();
    this.progressCallbacks = [];
    this.errorCallbacks = [];
  }
}
