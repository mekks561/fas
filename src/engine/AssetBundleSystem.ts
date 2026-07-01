export interface AssetInfo {
  id: string;
  name: string;
  type: 'model' | 'texture' | 'audio' | 'config' | 'effect';
  url: string;
  size: number;
  hash: string;
  dependencies?: string[];
}

export interface BundleInfo {
  id: string;
  name: string;
  size: number;
  hash: string;
  assets: AssetInfo[];
  platform: 'web' | 'mobile' | 'desktop';
  version: string;
}

export interface BundleManifest {
  version: string;
  bundles: BundleInfo[];
  dependencies: Map<string, string[]>;
  totalSize: number;
}

export type LoadingPriority = 'immediate' | 'high' | 'medium' | 'low';

export interface LoadingOptions {
  priority?: LoadingPriority;
  onProgress?: (progress: number) => void;
  onComplete?: (assets: Map<string, unknown>) => void;
  onError?: (error: Error) => void;
}

interface CachedAsset {
  data: unknown;
  timestamp: number;
  usageCount: number;
  size: number;
}

export class AssetBundleSystem {
  private manifest: BundleManifest | null = null;
  private cache: Map<string, CachedAsset> = new Map();
  private loadingQueue: Map<string, Promise<Map<string, unknown>>> = new Map();
  private memoryBudget: number = 500 * 1024 * 1024;
  private currentMemoryUsage: number = 0;
  private loadedBundles: Set<string> = new Set();
  private bundleAssets: Map<string, Set<string>> = new Map();

  async loadManifest(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.status}`);
    }
    const data = await response.json();
    this.manifest = {
      version: data.version,
      bundles: data.bundles,
      dependencies: new Map(Object.entries(data.dependencies || {})),
      totalSize: data.totalSize || 0
    };
  }

  getBundle(id: string): BundleInfo | undefined {
    return this.manifest?.bundles.find(b => b.id === id);
  }

  async loadBundle(bundleId: string, options: LoadingOptions = {}): Promise<Map<string, unknown>> {
    if (this.loadedBundles.has(bundleId)) {
      return this.getBundleAssets(bundleId);
    }

    const bundle = this.getBundle(bundleId);
    if (!bundle) {
      throw new Error(`Bundle not found: ${bundleId}`);
    }

    const dependencies = this.manifest?.dependencies.get(bundleId) || [];
    for (const depId of dependencies) {
      if (!this.loadedBundles.has(depId)) {
        await this.loadBundle(depId, { priority: options.priority });
      }
    }

    const queued = this.loadingQueue.get(bundleId);
    if (queued) {
      return queued;
    }

    const promise = this.loadBundleAssets(bundle, options);
    this.loadingQueue.set(bundleId, promise);

    try {
      const assets = await promise;
      this.loadedBundles.add(bundleId);
      const assetIds = new Set<string>();
      bundle.assets.forEach(a => assetIds.add(a.id));
      this.bundleAssets.set(bundleId, assetIds);
      return assets;
    } finally {
      this.loadingQueue.delete(bundleId);
    }
  }

  private async loadBundleAssets(bundle: BundleInfo, options: LoadingOptions): Promise<Map<string, unknown>> {
    const assets = new Map<string, unknown>();
    const totalSize = bundle.assets.reduce((sum, a) => sum + a.size, 0);
    let loadedSize = 0;

    for (const asset of bundle.assets) {
      try {
        const data = await this.loadAsset(asset);
        assets.set(asset.id, data);
        loadedSize += asset.size;
        options.onProgress?.((loadedSize / totalSize) * 100);
      } catch (error) {
        console.warn(`Failed to load asset ${asset.id}:`, error);
      }
    }

    options.onComplete?.(assets);
    return assets;
  }

  private async loadAsset(asset: AssetInfo): Promise<unknown> {
    const cached = this.cache.get(asset.id);
    if (cached) {
      cached.usageCount++;
      cached.timestamp = Date.now();
      return cached.data;
    }

    const response = await fetch(asset.url);
    if (!response.ok) {
      throw new Error(`Failed to load asset ${asset.id}: ${response.status}`);
    }

    let data: unknown;
    switch (asset.type) {
      case 'texture':
        data = await this.loadTexture(response);
        break;
      case 'audio':
        data = await this.loadAudio(response);
        break;
      case 'model':
        data = await this.loadModel(response);
        break;
      case 'config':
        data = await response.json();
        break;
      case 'effect':
        data = await response.json();
        break;
      default:
        data = await response.arrayBuffer();
    }

    this.cacheAsset(asset.id, data, asset.size);
    return data;
  }

  private async loadTexture(response: Response): Promise<HTMLImageElement> {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  private async loadAudio(response: Response): Promise<AudioBuffer> {
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return audioContext.decodeAudioData(arrayBuffer);
  }

  private async loadModel(response: Response): Promise<ArrayBuffer> {
    return response.arrayBuffer();
  }

  private cacheAsset(id: string, data: unknown, size: number): void {
    while (this.currentMemoryUsage + size > this.memoryBudget && this.cache.size > 0) {
      this.evictLeastUsed();
    }

    this.cache.set(id, {
      data,
      timestamp: Date.now(),
      usageCount: 1,
      size
    });
    this.currentMemoryUsage += size;
  }

  private evictLeastUsed(): void {
    let leastUsed: string | null = null;
    let minScore = Infinity;

    for (const [id, asset] of this.cache) {
      const score = asset.timestamp + asset.usageCount;
      if (score < minScore) {
        minScore = score;
        leastUsed = id;
      }
    }

    if (leastUsed) {
      const asset = this.cache.get(leastUsed);
      if (asset) {
        this.currentMemoryUsage -= asset.size;
        this.cache.delete(leastUsed);
      }
    }
  }

  unloadBundle(bundleId: string): void {
    const assetIds = this.bundleAssets.get(bundleId);
    if (assetIds) {
      for (const id of assetIds) {
        const cached = this.cache.get(id);
        if (cached) {
          cached.usageCount--;
          if (cached.usageCount <= 0) {
            this.currentMemoryUsage -= cached.size;
            this.cache.delete(id);
          }
        }
      }
    }
    this.loadedBundles.delete(bundleId);
    this.bundleAssets.delete(bundleId);
  }

  private getBundleAssets(bundleId: string): Map<string, unknown> {
    const assets = new Map<string, unknown>();
    const bundle = this.getBundle(bundleId);
    if (bundle) {
      for (const asset of bundle.assets) {
        const cached = this.cache.get(asset.id);
        if (cached) {
          assets.set(asset.id, cached.data);
        }
      }
    }
    return assets;
  }

  getAsset(assetId: string): unknown {
    const cached = this.cache.get(assetId);
    if (cached) {
      cached.usageCount++;
      cached.timestamp = Date.now();
      return cached.data;
    }
    return undefined;
  }

  hasBundle(bundleId: string): boolean {
    return this.loadedBundles.has(bundleId);
  }

  getMemoryUsage(): number {
    return this.currentMemoryUsage;
  }

  setMemoryBudget(bytes: number): void {
    this.memoryBudget = bytes;
  }

  getManifest(): BundleManifest | null {
    return this.manifest;
  }

  clearCache(): void {
    this.cache.clear();
    this.currentMemoryUsage = 0;
  }
}
