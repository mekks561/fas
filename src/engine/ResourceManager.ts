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
  chunk?: string;
  group?: string;
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
  priority: number;
  timestamp: number;
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
  private chunks: Map<string, Set<string>> = new Map();
  private groups: Map<string, Set<string>> = new Map();
  private loadingChunks: Set<string> = new Set();
  private preloadQueue: string[] = [];
  private preloadInProgress: boolean = false;
  private maxPreloadSize: number = 10 * 1024 * 1024;

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

    if (descriptor.chunk) {
      if (!this.chunks.has(descriptor.chunk)) {
        this.chunks.set(descriptor.chunk, new Set());
      }
      this.chunks.get(descriptor.chunk)?.add(descriptor.id);
    }

    if (descriptor.group) {
      if (!this.groups.has(descriptor.group)) {
        this.groups.set(descriptor.group, new Set());
      }
      this.groups.get(descriptor.group)?.add(descriptor.id);
    }

    if (descriptor.preload) {
      this.preloadQueue.push(descriptor.id);
    }
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
      const priority = entry.descriptor.priority || 0;
      const timestamp = Date.now();

      const item: LoadQueueItem = {
        descriptor: entry.descriptor,
        resolve,
        reject,
        priority,
        timestamp,
      };

      this.loadQueue.push(item);
      this.sortQueue();
      this.processQueue();
    });
  }

  private sortQueue(): void {
    this.loadQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
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

  public async loadChunk(chunkId: string): Promise<void> {
    if (this.loadingChunks.has(chunkId)) {
      return;
    }

    const resourceIds = this.chunks.get(chunkId);
    if (!resourceIds) {
      throw new Error(`Chunk not found: ${chunkId}`);
    }

    this.loadingChunks.add(chunkId);
    try {
      await this.loadResources(Array.from(resourceIds));
    } finally {
      this.loadingChunks.delete(chunkId);
    }
  }

  public unloadChunk(chunkId: string): void {
    const resourceIds = this.chunks.get(chunkId);
    if (!resourceIds) {
      return;
    }

    resourceIds.forEach((id) => {
      this.unloadResource(id);
    });
  }

  public async loadGroup(groupId: string): Promise<void> {
    const resourceIds = this.groups.get(groupId);
    if (!resourceIds) {
      throw new Error(`Group not found: ${groupId}`);
    }

    await this.loadResources(Array.from(resourceIds));
  }

  public unloadGroup(groupId: string): void {
    const resourceIds = this.groups.get(groupId);
    if (!resourceIds) {
      return;
    }

    resourceIds.forEach((id) => {
      this.unloadResource(id);
    });
  }

  public async startPreload(): Promise<void> {
    if (this.preloadInProgress) {
      return;
    }

    this.preloadInProgress = true;
    try {
      let totalLoaded = 0;
      const maxPreloadCount = Math.min(
        this.preloadQueue.length,
        Math.floor(this.maxPreloadSize / 1024),
      );

      for (let i = 0; i < maxPreloadCount; i++) {
        const resourceId = this.preloadQueue[i];
        if (!resourceId) continue;

        try {
          await this.loadResource(resourceId);
          totalLoaded++;
        } catch {}
      }
    } finally {
      this.preloadInProgress = false;
    }
  }

  public getChunkProgress(chunkId: string): LoadingProgress {
    const resourceIds = this.chunks.get(chunkId);
    if (!resourceIds) {
      return {
        total: 0,
        loaded: 0,
        failed: 0,
        inProgress: 0,
        percentage: 0,
      };
    }

    let loaded = 0;
    let failed = 0;
    let inProgress = 0;

    resourceIds.forEach((id) => {
      const entry = this.resources.get(id);
      if (!entry) return;

      if (entry.isLoaded) {
        loaded++;
      } else if (this.activeLoads.has(id)) {
        inProgress++;
      }
    });

    const total = resourceIds.size;

    return {
      total,
      loaded,
      failed,
      inProgress,
      percentage: total > 0 ? (loaded / total) * 100 : 0,
    };
  }

  public getAvailableChunks(): string[] {
    return Array.from(this.chunks.keys());
  }

  public getAvailableGroups(): string[] {
    return Array.from(this.groups.keys());
  }

  public isChunkLoading(chunkId: string): boolean {
    return this.loadingChunks.has(chunkId);
  }

  public isPreloading(): boolean {
    return this.preloadInProgress;
  }

  public getPreloadQueueSize(): number {
    return this.preloadQueue.length;
  }

  public setMaxPreloadSize(size: number): void {
    this.maxPreloadSize = Math.max(1024, size);
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
    this.chunks.clear();
    this.groups.clear();
    this.loadingChunks.clear();
    this.preloadQueue = [];
    this.preloadInProgress = false;
  }
}
