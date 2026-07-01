export interface PlayerProgress {
  playerId: string;
  playerName: string;
  level: number;
  totalScore: number;
  highestScore: number;
  highestWave: number;
  totalPlayTime: number;
  totalKills: number;
  totalDeaths: number;
  achievementsUnlocked: string[];
  unlockedLevels: number[];
  levelStars: Record<number, number>;
  settings: GameSettings;
  lastUpdated: number;
  version: string;
}

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  difficulty: 'easy' | 'normal' | 'hard' | 'expert';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  showFPS: boolean;
  showDamageNumbers: boolean;
  cameraShake: boolean;
  screenFlash: boolean;
  touchControls: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  score: number;
  wave: number;
  kills: number;
  timestamp: number;
  rank?: number;
}

export interface SaveResult {
  success: boolean;
  savedAt: number;
  syncedToCloud: boolean;
  error?: string;
}

export interface LoadResult {
  success: boolean;
  data?: PlayerProgress;
  source: 'local' | 'cloud' | 'cache';
  error?: string;
}

export type SaveProvider = 'local' | 'cloud' | 'auto';

export interface CloudConfig {
  endpoint: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface SyncResult {
  success: boolean;
  syncedAt: number;
  uploaded: boolean;
  downloaded: boolean;
  conflictsResolved: number;
  error?: string;
}

type SaveCallback = (result: SaveResult) => void;
type LoadCallback = (result: LoadResult) => void;
type LeaderboardCallback = (entries: LeaderboardEntry[]) => void;

interface SaveQueueItem {
  data: PlayerProgress;
  resolve: (result: SaveResult) => void;
  reject: (error: Error) => void;
  retries: number;
}

import { gameDatabase } from './GameDatabase';

export class CloudSaveSystem {
  private currentProgress: PlayerProgress | null = null;
  private cloudConfig: CloudConfig;
  private saveQueue: SaveQueueItem[] = [];
  private isProcessingSave: boolean = false;
  private isOnline: boolean = navigator.onLine;
  private isEnabled: boolean = true;
  private saveCallbacks: SaveCallback[] = [];
  private loadCallbacks: LoadCallback[] = [];
  private leaderboardCallbacks: LeaderboardCallback[] = [];
  private lastSyncTime: number = 0;
  private autoSyncInterval: number = 60000;
  private autoSyncTimer: number | null = null;
  private version: string = '1.0.0';
  private pendingSync: boolean = false;
  private localOnly: boolean = false;

  constructor(config?: Partial<CloudConfig>) {
    this.cloudConfig = {
      endpoint: config?.endpoint || '/api/save',
      apiKey: config?.apiKey,
      timeout: config?.timeout || 10000,
      retryAttempts: config?.retryAttempts || 3,
      retryDelay: config?.retryDelay || 1000
    };

    this.setupNetworkListeners();
    this.startAutoSync();
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  private handleOnline(): void {
    this.isOnline = true;
    if (this.pendingSync) {
      this.syncWithCloud();
    }
  }

  private handleOffline(): void {
    this.isOnline = false;
  }

  public setLocalOnly(enabled: boolean): void {
    this.localOnly = enabled;
  }

  public isLocalOnly(): boolean {
    return this.localOnly;
  }

  public async saveProgress(data: PlayerProgress, provider: SaveProvider = 'auto'): Promise<SaveResult> {
    if (!this.isEnabled) {
      return { success: false, savedAt: 0, syncedToCloud: false, error: 'System disabled' };
    }

    data.lastUpdated = Date.now();
    data.version = this.version;

    const useCloud = provider === 'cloud' || (provider === 'auto' && this.isOnline && !this.localOnly);

    let result: SaveResult = {
      success: false,
      savedAt: Date.now(),
      syncedToCloud: false
    };

    try {
      const localResult = await this.saveToLocal(data);
      this.currentProgress = data;

      if (localResult) {
        result.success = true;

        if (useCloud) {
          try {
            const cloudResult = await this.saveToCloud(data);
            result.syncedToCloud = cloudResult;
            this.lastSyncTime = Date.now();
            this.pendingSync = false;
          } catch (error) {
            this.pendingSync = true;
            this.enqueueSave(data);
          }
        }
      }

      this.saveCallbacks.forEach(cb => cb(result));
      return result;
    } catch (error) {
      result.error = (error as Error).message;
      this.saveCallbacks.forEach(cb => cb(result));
      return result;
    }
  }

  private async saveToLocal(data: PlayerProgress): Promise<boolean> {
    try {
      await gameDatabase.savePlayerProgress(data);
      return true;
    } catch (error) {
      console.error('Failed to save to local storage:', error);
      return false;
    }
  }

  private async saveToCloud(data: PlayerProgress): Promise<boolean> {
    if (!this.isOnline || this.localOnly) {
      throw new Error('Not online or local-only mode');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.cloudConfig.timeout);

    try {
      const response = await fetch(`${this.cloudConfig.endpoint}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.cloudConfig.apiKey ? { 'Authorization': `Bearer ${this.cloudConfig.apiKey}` } : {})
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Cloud save failed: ${response.status}`);
      }

      return true;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  public async loadProgress(provider: SaveProvider = 'auto'): Promise<LoadResult> {
    if (!this.isEnabled) {
      return { success: false, source: 'local', error: 'System disabled' };
    }

    if (this.currentProgress) {
      return { success: true, data: this.currentProgress, source: 'cache' };
    }

    const localResult = await this.loadFromLocal();
    if (localResult.success && localResult.data) {
      this.currentProgress = localResult.data;
      return localResult;
    }

    if (provider === 'auto' && this.isOnline && !this.localOnly) {
      try {
        const cloudResult = await this.loadFromCloud();
        if (cloudResult.success && cloudResult.data) {
          this.currentProgress = cloudResult.data;
          await this.saveToLocal(cloudResult.data);
          return cloudResult;
        }
      } catch (error) {
        console.warn('Cloud load failed:', error);
      }
    }

    return localResult;
  }

  private async loadFromLocal(): Promise<LoadResult> {
    try {
      const saved = await gameDatabase.getPlayerProgress('default_player');
      if (saved) {
        return { success: true, data: saved, source: 'local' };
      }

      const allProgress = await gameDatabase.getAllPlayerProgress();
      if (allProgress.length > 0) {
        return { success: true, data: allProgress[0], source: 'local' };
      }

      return { success: false, source: 'local', error: 'No save data found' };
    } catch (error) {
      return { success: false, source: 'local', error: (error as Error).message };
    }
  }

  private async loadFromCloud(): Promise<LoadResult> {
    if (!this.isOnline || this.localOnly) {
      return { success: false, source: 'cloud', error: 'Not online' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.cloudConfig.timeout);

    try {
      const response = await fetch(`${this.cloudConfig.endpoint}/load`, {
        method: 'GET',
        headers: {
          ...(this.cloudConfig.apiKey ? { 'Authorization': `Bearer ${this.cloudConfig.apiKey}` } : {})
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, source: 'cloud', error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { success: true, data, source: 'cloud' };
    } catch (error) {
      clearTimeout(timeoutId);
      return { success: false, source: 'cloud', error: (error as Error).message };
    }
  }

  public async syncWithCloud(): Promise<SyncResult> {
    if (!this.isOnline || this.localOnly) {
      return { success: false, syncedAt: 0, uploaded: false, downloaded: false, conflictsResolved: 0, error: 'Not online' };
    }

    const result: SyncResult = {
      success: false,
      syncedAt: 0,
      uploaded: false,
      downloaded: false,
      conflictsResolved: 0
    };

    try {
      const local = await this.loadFromLocal();
      if (!local.success || !local.data) {
        result.error = 'No local data to sync';
        return result;
      }

      const cloud = await this.loadFromCloud();

      if (!cloud.success || !cloud.data) {
        await this.saveToCloud(local.data);
        result.uploaded = true;
        result.success = true;
        result.syncedAt = Date.now();
        this.lastSyncTime = result.syncedAt;
        this.pendingSync = false;
        return result;
      }

      if (local.data.lastUpdated > cloud.data.lastUpdated) {
        const merged = this.mergeProgress(local.data, cloud.data);
        await this.saveToCloud(merged);
        await this.saveToLocal(merged);
        this.currentProgress = merged;
        result.uploaded = true;
        result.conflictsResolved++;
      } else if (cloud.data.lastUpdated > local.data.lastUpdated) {
        await this.saveToLocal(cloud.data);
        this.currentProgress = cloud.data;
        result.downloaded = true;
        result.conflictsResolved++;
      }

      result.success = true;
      result.syncedAt = Date.now();
      this.lastSyncTime = result.syncedAt;
      this.pendingSync = false;
    } catch (error) {
      result.error = (error as Error).message;
    }

    return result;
  }

  private mergeProgress(local: PlayerProgress, cloud: PlayerProgress): PlayerProgress {
    return {
      playerId: local.playerId,
      playerName: local.playerName,
      level: Math.max(local.level, cloud.level),
      totalScore: Math.max(local.totalScore, cloud.totalScore),
      highestScore: Math.max(local.highestScore, cloud.highestScore),
      highestWave: Math.max(local.highestWave, cloud.highestWave),
      totalPlayTime: local.totalPlayTime + cloud.totalPlayTime,
      totalKills: Math.max(local.totalKills, cloud.totalKills),
      totalDeaths: local.totalDeaths + cloud.totalDeaths,
      achievementsUnlocked: Array.from(new Set([...local.achievementsUnlocked, ...cloud.achievementsUnlocked])),
      unlockedLevels: Array.from(new Set([...local.unlockedLevels, ...cloud.unlockedLevels])).sort((a, b) => a - b),
      levelStars: { ...cloud.levelStars, ...local.levelStars },
      settings: { ...cloud.settings, ...local.settings },
      lastUpdated: Date.now(),
      version: this.version
    };
  }

  private enqueueSave(data: PlayerProgress): void {
    this.saveQueue.push({
      data,
      resolve: () => {},
      reject: () => {},
      retries: 0
    });
    this.processSaveQueue();
  }

  private async processSaveQueue(): Promise<void> {
    if (this.isProcessingSave || this.saveQueue.length === 0) return;

    this.isProcessingSave = true;

    while (this.saveQueue.length > 0 && this.isOnline) {
      const item = this.saveQueue[0];

      try {
        await this.saveToCloud(item.data);
        this.saveQueue.shift();
        this.lastSyncTime = Date.now();
      } catch (_error) {
        item.retries++;
        if (item.retries >= this.cloudConfig.retryAttempts) {
          this.saveQueue.shift();
        } else {
          await this.delay(this.cloudConfig.retryDelay * item.retries);
        }
      }
    }

    this.isProcessingSave = false;
  }

  public async getLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
    if (!this.isOnline || this.localOnly) {
      return this.getLocalLeaderboard(limit);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.cloudConfig.timeout);

      const response = await fetch(`${this.cloudConfig.endpoint}/leaderboard?limit=${limit}`, {
        headers: {
          ...(this.cloudConfig.apiKey ? { 'Authorization': `Bearer ${this.cloudConfig.apiKey}` } : {})
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const entries: LeaderboardEntry[] = await response.json();
      const ranked = this.assignRanks(entries);
      this.leaderboardCallbacks.forEach(cb => cb(ranked));
      return ranked;
    } catch (error) {
      console.warn('Failed to fetch leaderboard:', error);
      return this.getLocalLeaderboard(limit);
    }
  }

  private getLocalLeaderboard(limit: number): LeaderboardEntry[] {
    const local = localStorage.getItem('leaderboard');
    if (!local) return [];

    try {
      const entries: LeaderboardEntry[] = JSON.parse(local);
      const sorted = entries.sort((a, b) => b.score - a.score).slice(0, limit);
      return this.assignRanks(sorted);
    } catch {
      return [];
    }
  }

  public async submitScore(entry: Omit<LeaderboardEntry, 'rank' | 'timestamp'>): Promise<boolean> {
    const fullEntry: LeaderboardEntry = {
      ...entry,
      timestamp: Date.now()
    };

    const local = this.getLocalLeaderboard(1000);
    const updated = [...local, fullEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);
    
    localStorage.setItem('leaderboard', JSON.stringify(updated));

    if (this.isOnline && !this.localOnly) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.cloudConfig.timeout);

        const response = await fetch(`${this.cloudConfig.endpoint}/leaderboard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.cloudConfig.apiKey ? { 'Authorization': `Bearer ${this.cloudConfig.apiKey}` } : {})
          },
          body: JSON.stringify(fullEntry),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response.ok;
      } catch (error) {
        console.warn('Failed to submit score:', error);
        return false;
      }
    }

    return true;
  }

  private assignRanks(entries: LeaderboardEntry[]): LeaderboardEntry[] {
    return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  public getCurrentProgress(): PlayerProgress | null {
    return this.currentProgress ? { ...this.currentProgress } : null;
  }

  public updateProgress(updates: Partial<PlayerProgress>): boolean {
    if (!this.currentProgress) return false;

    this.currentProgress = {
      ...this.currentProgress,
      ...updates
    };
    return true;
  }

  public updateSettings(settings: Partial<GameSettings>): boolean {
    if (!this.currentProgress) return false;

    this.currentProgress.settings = {
      ...this.currentProgress.settings,
      ...settings
    };
    return true;
  }

  public addAchievement(achievementId: string): boolean {
    if (!this.currentProgress) return false;
    if (this.currentProgress.achievementsUnlocked.includes(achievementId)) {
      return false;
    }

    this.currentProgress.achievementsUnlocked.push(achievementId);
    return true;
  }

  public unlockLevel(level: number): boolean {
    if (!this.currentProgress) return false;
    if (this.currentProgress.unlockedLevels.includes(level)) {
      return false;
    }

    this.currentProgress.unlockedLevels.push(level);
    this.currentProgress.unlockedLevels.sort((a, b) => a - b);
    return true;
  }

  public setLevelStars(level: number, stars: number): boolean {
    if (!this.currentProgress) return false;
    
    const currentStars = this.currentProgress.levelStars[level] || 0;
    if (stars > currentStars) {
      this.currentProgress.levelStars[level] = stars;
      return true;
    }
    return false;
  }

  public createNewProgress(playerName: string): PlayerProgress {
    const progress: PlayerProgress = {
      playerId: this.generatePlayerId(),
      playerName,
      level: 1,
      totalScore: 0,
      highestScore: 0,
      highestWave: 0,
      totalPlayTime: 0,
      totalKills: 0,
      totalDeaths: 0,
      achievementsUnlocked: [],
      unlockedLevels: [1],
      levelStars: {},
      settings: this.getDefaultSettings(),
      lastUpdated: Date.now(),
      version: this.version
    };

    this.currentProgress = progress;
    return progress;
  }

  private getDefaultSettings(): GameSettings {
    return {
      masterVolume: 0.8,
      musicVolume: 0.6,
      sfxVolume: 0.8,
      difficulty: 'normal',
      quality: 'high',
      showFPS: false,
      showDamageNumbers: true,
      cameraShake: true,
      screenFlash: true,
      touchControls: true
    };
  }

  private generatePlayerId(): string {
    return 'player_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  public startAutoSync(): void {
    if (this.autoSyncTimer !== null) return;

    this.autoSyncTimer = window.setInterval(() => {
      if (this.isOnline && !this.localOnly && this.currentProgress) {
        this.syncWithCloud();
      }
    }, this.autoSyncInterval);
  }

  public stopAutoSync(): void {
    if (this.autoSyncTimer !== null) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  public setAutoSyncInterval(interval: number): void {
    this.autoSyncInterval = interval;
    this.stopAutoSync();
    this.startAutoSync();
  }

  public onSave(callback: SaveCallback): () => void {
    this.saveCallbacks.push(callback);
    return () => {
      const index = this.saveCallbacks.indexOf(callback);
      if (index > -1) this.saveCallbacks.splice(index, 1);
    };
  }

  public onLoad(callback: LoadCallback): () => void {
    this.loadCallbacks.push(callback);
    return () => {
      const index = this.loadCallbacks.indexOf(callback);
      if (index > -1) this.loadCallbacks.splice(index, 1);
    };
  }

  public onLeaderboardUpdate(callback: LeaderboardCallback): () => void {
    this.leaderboardCallbacks.push(callback);
    return () => {
      const index = this.leaderboardCallbacks.indexOf(callback);
      if (index > -1) this.leaderboardCallbacks.splice(index, 1);
    };
  }

  public isNetworkOnline(): boolean {
    return this.isOnline;
  }

  public hasPendingSync(): boolean {
    return this.pendingSync;
  }

  public getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  public setCloudConfig(config: Partial<CloudConfig>): void {
    this.cloudConfig = { ...this.cloudConfig, ...config };
  }

  public getCloudConfig(): CloudConfig {
    return { ...this.cloudConfig };
  }

  public async deleteSaveData(): Promise<boolean> {
    try {
      if (this.currentProgress) {
        await gameDatabase.deletePlayerData(this.currentProgress.playerId);
      }
      this.currentProgress = null;
      return true;
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public destroy(): void {
    this.stopAutoSync();
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    this.saveQueue = [];
    this.saveCallbacks = [];
    this.loadCallbacks = [];
    this.leaderboardCallbacks = [];
    this.currentProgress = null;
  }
}