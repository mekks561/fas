import { ResourceInfo } from './types/resource-types';

export class FileStorageManager {
  private basePath: string;
  private cache: Map<string, ArrayBuffer> = new Map();
  private usePersistentStorage: boolean;

  constructor(basePath: string = 'game_assets') {
    this.basePath = basePath;
    this.usePersistentStorage = 'indexedDB' in window;
  }

  public async save(resourceInfo: ResourceInfo, data: ArrayBuffer): Promise<string> {
    const filename = resourceInfo.filename;
    const path = `${this.basePath}/${filename}`;

    try {
      if (this.usePersistentStorage) {
        await this.saveToIndexedDB(filename, data);
      }

      const blob = new Blob([data], { type: 'application/octet-stream' });
      URL.createObjectURL(blob);

      this.cache.set(filename, data);

      await this.updateMetadata(filename, resourceInfo);

      console.log(`Resource saved: ${filename}`);
      return path;
    } catch (error) {
      console.error(`Failed to save resource ${filename}:`, error);
      throw error;
    }
  }

  public async load(filename: string): Promise<ArrayBuffer | null> {
    if (this.cache.has(filename)) {
      console.log(`Cache hit for ${filename}`);
      const cached = this.cache.get(filename);
      if (cached) {
        return cached;
      }
    }

    if (this.usePersistentStorage) {
      try {
        const data = await this.loadFromIndexedDB(filename);
        if (data) {
          this.cache.set(filename, data);
          return data;
        }
      } catch (error) {
        console.error(`Failed to load from IndexedDB: ${filename}`, error);
      }
    }

    return null;
  }

  public async exists(filename: string): Promise<boolean> {
    if (this.cache.has(filename)) {
      return true;
    }

    if (this.usePersistentStorage) {
      try {
        const db = await this.openDatabase();
        const tx = db.transaction('resources', 'readonly');
        const store = tx.objectStore('resources');
        const request = store.get(filename);

        return new Promise((resolve) => {
          request.onsuccess = () => resolve(!!request.result);
          request.onerror = () => resolve(false);
        });
      } catch {
        return false;
      }
    }

    return false;
  }

  public async delete(filename: string): Promise<void> {
    this.cache.delete(filename);

    if (this.usePersistentStorage) {
      try {
        const db = await this.openDatabase();
        const tx = db.transaction('resources', 'readwrite');
        const store = tx.objectStore('resources');
        store.delete(filename);
      } catch (error) {
        console.error(`Failed to delete ${filename} from IndexedDB:`, error);
      }
    }
  }

  public async clear(): Promise<void> {
    this.cache.clear();

    if (this.usePersistentStorage) {
      try {
        const db = await this.openDatabase();
        const tx = db.transaction('resources', 'readwrite');
        const store = tx.objectStore('resources');
        store.clear();
      } catch (error) {
        console.error('Failed to clear IndexedDB:', error);
      }
    }
  }

  public getCacheSize(): number {
    let size = 0;
    for (const buffer of this.cache.values()) {
      size += buffer.byteLength;
    }
    return size;
  }

  public getCachedFiles(): string[] {
    return Array.from(this.cache.keys());
  }

  private async saveToIndexedDB(filename: string, data: ArrayBuffer): Promise<void> {
    const db = await this.openDatabase();
    const tx = db.transaction('resources', 'readwrite');
    const store = tx.objectStore('resources');

    return new Promise((resolve, reject) => {
      const request = store.put({ filename, data, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async loadFromIndexedDB(filename: string): Promise<ArrayBuffer | null> {
    const db = await this.openDatabase();
    const tx = db.transaction('resources', 'readonly');
    const store = tx.objectStore('resources');

    return new Promise((resolve) => {
      const request = store.get(filename);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => resolve(null);
    });
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('GameAssetStorage', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('resources')) {
          db.createObjectStore('resources', { keyPath: 'filename' });
        }
      };
    });
  }

  private async updateMetadata(filename: string, resourceInfo: ResourceInfo): Promise<void> {
    try {
      let metadata = await this.loadMetadata();
      metadata[filename] = {
        ...resourceInfo,
        savedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      URL.createObjectURL(blob);
      console.log(`Metadata updated for ${filename}`);
    } catch (error) {
      console.error('Failed to update metadata:', error);
    }
  }

  private async loadMetadata(): Promise<Record<string, unknown>> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');

      return new Promise((resolve) => {
        const request = store.get('resources');
        request.onsuccess = () => resolve(request.result || {});
        request.onerror = () => resolve({});
      });
    } catch {
      return {};
    }
  }
}
