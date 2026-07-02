import {
  ResourceInfo,
  ResourceManifest,
  ResourceDownloadStatus,
  NetworkQuality,
  DownloadTestResult,
} from './types/resource-types';
import { DownloadManager } from './DownloadManager';
import { FileStorageManager } from './FileStorageManager';
import { MD5Validator } from './ResourceValidator';

export class GameResourceManager {
  private downloadManager: DownloadManager;
  private storageManager: FileStorageManager;
  private manifest: ResourceManifest | null = null;
  private downloadStatuses: Map<string, ResourceDownloadStatus> = new Map();
  private networkQuality: NetworkQuality = {
    type: 'excellent',
    latency: 0,
    bandwidth: 0,
    packetLoss: 0,
  };
  private maxRetries: number = 3;
  private downloadListeners: Array<(status: ResourceDownloadStatus) => void> = [];

  constructor() {
    this.downloadManager = new DownloadManager(3);
    this.storageManager = new FileStorageManager('fighter_game_assets');
  }

  public setManifest(manifest: ResourceManifest): void {
    this.manifest = manifest;
    console.log(`Manifest loaded: ${manifest.resources.length} resources`);
  }

  public async downloadResource(resourceInfo: ResourceInfo): Promise<boolean> {
    const status: ResourceDownloadStatus = {
      resourceId: resourceInfo.id,
      status: 'downloading',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: resourceInfo.size,
      retryCount: 0,
    };

    this.updateStatus(resourceInfo.id, status);

    try {
      const data = await this.downloadWithRetry(resourceInfo);

      if (!data) {
        throw new Error('Download failed');
      }

      this.updateStatus(resourceInfo.id, {
        ...status,
        status: 'verifying',
        progress: 90,
      });

      const isValid = await MD5Validator.validate(data, resourceInfo.md5);

      if (!isValid) {
        console.error(`Resource validation failed: ${resourceInfo.filename}`);
        this.updateStatus(resourceInfo.id, {
          ...status,
          status: 'corrupted',
          error: 'MD5 validation failed',
        });
        return false;
      }

      await this.storageManager.save(resourceInfo, data);

      this.updateStatus(resourceInfo.id, {
        ...status,
        status: 'completed',
        progress: 100,
        endTime: Date.now(),
      });

      console.log(`Resource downloaded and verified: ${resourceInfo.filename}`);
      return true;
    } catch (error) {
      console.error(`Failed to download resource ${resourceInfo.filename}:`, error);
      this.updateStatus(resourceInfo.id, {
        ...status,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  private async downloadWithRetry(resourceInfo: ResourceInfo): Promise<ArrayBuffer | null> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        this.updateStatus(resourceInfo.id, {
          resourceId: resourceInfo.id,
          status: 'downloading',
          progress: 0,
          bytesDownloaded: 0,
          totalBytes: resourceInfo.size,
          retryCount: attempt,
          startTime: Date.now(),
        });

        const data = await this.downloadManager.download(resourceInfo.url, {
          timeout: this.getTimeoutForNetwork(),
          retries: 1,
          cache: false,
        });

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Download attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < this.maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.delay(delay);
        }
      }
    }

    throw lastError;
  }

  public async downloadAllResources(): Promise<{ success: number; failed: number }> {
    if (!this.manifest) {
      throw new Error('Manifest not set');
    }

    let success = 0;
    let failed = 0;

    const requiredResources = this.manifest.resources.filter((r) => r.required);

    for (const resource of requiredResources) {
      const result = await this.downloadResource(resource);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  public async getResource(filename: string): Promise<ArrayBuffer | null> {
    return this.storageManager.load(filename);
  }

  public async hasResource(resourceInfo: ResourceInfo): Promise<boolean> {
    const cached = await this.storageManager.load(resourceInfo.filename);
    if (cached) {
      const isValid = await MD5Validator.validate(cached, resourceInfo.md5);
      return isValid;
    }
    return false;
  }

  public async testDownloadScenario(
    resourceInfo: ResourceInfo,
    scenario: 'normal' | 'slow' | 'interrupted' | 'corrupted',
  ): Promise<DownloadTestResult> {
    const startTime = Date.now();
    let success = false;
    let errorCount = 0;
    let recoveredFromError = false;
    let dataIntegrity = false;

    try {
      switch (scenario) {
        case 'normal':
          const normalResult = await this.downloadResource(resourceInfo);
          success = normalResult;
          dataIntegrity = normalResult;
          break;

        case 'slow':
          const slowResult = await this.downloadWithSimulation(resourceInfo, 5000);
          success = slowResult !== null;
          dataIntegrity = slowResult !== null;
          break;

        case 'interrupted':
          errorCount = await this.testInterruptionRecovery(resourceInfo);
          success = errorCount < 3;
          recoveredFromError = errorCount > 0;
          break;

        case 'corrupted':
          const corruptedResult = await this.testCorruptionDetection(resourceInfo);
          success = !corruptedResult;
          dataIntegrity = !corruptedResult;
          break;
      }
    } catch (error) {
      errorCount++;
      console.error(`Test scenario ${scenario} failed:`, error);
    }

    const duration = Date.now() - startTime;
    const speed = duration > 0 ? resourceInfo.size / (duration / 1000) : 0;

    return {
      scenario,
      success,
      duration,
      speed,
      errorCount,
      recoveredFromError,
      dataIntegrity,
    };
  }

  private async downloadWithSimulation(
    resourceInfo: ResourceInfo,
    delay: number,
  ): Promise<ArrayBuffer | null> {
    await this.delay(delay);
    return this.downloadManager.download(resourceInfo.url);
  }

  private async testInterruptionRecovery(resourceInfo: ResourceInfo): Promise<number> {
    let errors = 0;

    for (let i = 0; i < 3; i++) {
      try {
        await this.downloadManager.download(resourceInfo.url, { timeout: 1000 });
      } catch {
        errors++;
        await this.delay(1000);
      }
    }

    return errors;
  }

  private async testCorruptionDetection(resourceInfo: ResourceInfo): Promise<boolean> {
    try {
      const data = await this.downloadManager.download(resourceInfo.url);
      const fakeMD5 = '00000000000000000000000000000000';
      const isCorrupted = await MD5Validator.validate(data, fakeMD5);
      return isCorrupted;
    } catch {
      return false;
    }
  }

  public async measureNetworkQuality(): Promise<NetworkQuality> {
    const startTime = Date.now();

    try {
      await fetch('https://httpbin.org/get', {
        mode: 'no-cors',
        cache: 'no-store',
      });

      const latency = Date.now() - startTime;

      this.networkQuality = {
        type: this.categorizeNetwork(latency),
        latency,
        bandwidth: this.estimateBandwidth(latency),
        packetLoss: 0,
      };
    } catch {
      this.networkQuality = {
        type: 'offline',
        latency: -1,
        bandwidth: 0,
        packetLoss: 100,
      };
    }

    return this.networkQuality;
  }

  private categorizeNetwork(latency: number): NetworkQuality['type'] {
    if (latency < 50) return 'excellent';
    if (latency < 150) return 'good';
    if (latency < 500) return 'poor';
    return 'offline';
  }

  private estimateBandwidth(latency: number): number {
    if (latency < 0) return 0;
    return Math.max(100, 1000 - latency * 5);
  }

  private getTimeoutForNetwork(): number {
    switch (this.networkQuality.type) {
      case 'excellent':
        return 10000;
      case 'good':
        return 20000;
      case 'poor':
        return 60000;
      case 'offline':
        return 120000;
    }
  }

  public getDownloadStatus(resourceId: string): ResourceDownloadStatus | undefined {
    return this.downloadStatuses.get(resourceId);
  }

  public getAllStatuses(): ResourceDownloadStatus[] {
    return Array.from(this.downloadStatuses.values());
  }

  public onStatusChange(callback: (status: ResourceDownloadStatus) => void): void {
    this.downloadListeners.push(callback);
  }

  private updateStatus(resourceId: string, status: Partial<ResourceDownloadStatus>): void {
    const current = this.downloadStatuses.get(resourceId) || {
      resourceId,
      status: 'pending' as const,
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 0,
      retryCount: 0,
    };

    const updated = { ...current, ...status };
    this.downloadStatuses.set(resourceId, updated);

    this.downloadListeners.forEach((listener) => listener(updated));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async cleanup(): Promise<void> {
    await this.storageManager.clear();
    this.downloadStatuses.clear();
    console.log('Resource manager cleaned up');
  }
}
