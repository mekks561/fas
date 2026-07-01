import * as pc from 'playcanvas';

export type GameEventType = 
  | 'player_damage'
  | 'player_heal'
  | 'player_death'
  | 'player_boost'
  | 'player_move'
  | 'player_shoot'
  | 'enemy_spawn'
  | 'enemy_death'
  | 'enemy_damage'
  | 'powerup_collect'
  | 'skill_activate'
  | 'wave_start'
  | 'wave_complete'
  | 'game_pause'
  | 'game_resume'
  | 'game_over'
  | 'game_win'
  | 'achievement_unlocked'
  | 'score_update'
  | 'level_complete'
  | 'camera_shake'
  | 'screen_flash'
  | 'sound_play'
  | 'ui_open'
  | 'ui_close';

export interface EventData {
  type: GameEventType;
  timestamp: number;
  data?: Record<string, any>;
}

export interface PlayerDamageData {
  damage: number;
  remainingHealth: number;
  maxHealth: number;
}

export interface PlayerHealData {
  amount: number;
  remainingHealth: number;
  maxHealth: number;
}

export interface PlayerDeathData {
  killCount: number;
  score: number;
  wave: number;
}

export interface PlayerShootData {
  weaponType: string;
  weaponLevel: number;
  position: pc.Vec3;
}

export interface EnemySpawnData {
  type: string;
  count: number;
  wave: number;
}

export interface EnemyDeathData {
  type: string;
  score: number;
  position: pc.Vec3;
}

export interface EnemyDamageData {
  type: string;
  damage: number;
  remainingHealth: number;
}

export interface PowerupCollectData {
  type: string;
  position: pc.Vec3;
}

export interface SkillActivateData {
  skillId: string;
  level: number;
}

export interface WaveData {
  wave: number;
  enemyCount: number;
}

export interface ScoreUpdateData {
  score: number;
  delta: number;
}

export interface CameraShakeData {
  intensity: number;
  duration: number;
}

export interface ScreenFlashData {
  color: pc.Color;
  duration: number;
  intensity: number;
}

export interface SoundPlayData {
  soundId: string;
  volume?: number;
  position?: pc.Vec3;
}

export interface UIEventData {
  uiId: string;
}

export type EventCallback = (event: EventData) => void;

export class EventSystem {
  private listeners: Map<GameEventType, EventCallback[]> = new Map();
  private onceListeners: Map<GameEventType, EventCallback[]> = new Map();
  private eventQueue: EventData[] = [];
  private isProcessing: boolean = false;
  private isEnabled: boolean = true;
  private history: EventData[] = [];
  private maxHistorySize: number = 100;

  constructor() {}

  public on(type: GameEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)?.push(callback);

    return () => this.off(type, callback);
  }

  public once(type: GameEventType, callback: EventCallback): () => void {
    if (!this.onceListeners.has(type)) {
      this.onceListeners.set(type, []);
    }
    this.onceListeners.get(type)?.push(callback);

    return () => {
      const callbacks = this.onceListeners.get(type);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  public off(type: GameEventType, callback: EventCallback): void {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }

    const onceCallbacks = this.onceListeners.get(type);
    if (onceCallbacks) {
      const index = onceCallbacks.indexOf(callback);
      if (index > -1) {
        onceCallbacks.splice(index, 1);
      }
    }
  }

  public emit(type: GameEventType, data?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const event: EventData = {
      type,
      timestamp: Date.now(),
      data
    };

    this.history.push(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.eventQueue.push(event);

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private processQueue(): void {
    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (!event) continue;

      const listeners = this.listeners.get(event.type) || [];
      const onceListeners = this.onceListeners.get(event.type) || [];

      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });

      onceListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in once listener for ${event.type}:`, error);
        }
      });

      this.onceListeners.delete(event.type);
    }

    this.isProcessing = false;
  }

  public emitPlayerDamage(damage: number, remainingHealth: number, maxHealth: number): void {
    this.emit('player_damage', { damage, remainingHealth, maxHealth } as PlayerDamageData);
  }

  public emitPlayerHeal(amount: number, remainingHealth: number, maxHealth: number): void {
    this.emit('player_heal', { amount, remainingHealth, maxHealth } as PlayerHealData);
  }

  public emitPlayerDeath(killCount: number, score: number, wave: number): void {
    this.emit('player_death', { killCount, score, wave } as PlayerDeathData);
  }

  public emitPlayerBoost(): void {
    this.emit('player_boost');
  }

  public emitPlayerMove(position: pc.Vec3): void {
    this.emit('player_move', { position: { x: position.x, y: position.y, z: position.z } });
  }

  public emitPlayerShoot(weaponType: string, weaponLevel: number, position: pc.Vec3): void {
    this.emit('player_shoot', { 
      weaponType, 
      weaponLevel, 
      position: { x: position.x, y: position.y, z: position.z } 
    } as PlayerShootData);
  }

  public emitEnemySpawn(type: string, count: number, wave: number): void {
    this.emit('enemy_spawn', { type, count, wave } as EnemySpawnData);
  }

  public emitEnemyDeath(type: string, score: number, position: pc.Vec3): void {
    this.emit('enemy_death', { 
      type, 
      score, 
      position: { x: position.x, y: position.y, z: position.z } 
    } as EnemyDeathData);
  }

  public emitEnemyDamage(type: string, damage: number, remainingHealth: number): void {
    this.emit('enemy_damage', { type, damage, remainingHealth } as EnemyDamageData);
  }

  public emitPowerupCollect(type: string, position: pc.Vec3): void {
    this.emit('powerup_collect', { 
      type, 
      position: { x: position.x, y: position.y, z: position.z } 
    } as PowerupCollectData);
  }

  public emitSkillActivate(skillId: string, level: number): void {
    this.emit('skill_activate', { skillId, level } as SkillActivateData);
  }

  public emitWaveStart(wave: number, enemyCount: number): void {
    this.emit('wave_start', { wave, enemyCount } as WaveData);
  }

  public emitWaveComplete(wave: number, enemyCount: number): void {
    this.emit('wave_complete', { wave, enemyCount } as WaveData);
  }

  public emitGamePause(): void {
    this.emit('game_pause');
  }

  public emitGameResume(): void {
    this.emit('game_resume');
  }

  public emitGameOver(): void {
    this.emit('game_over');
  }

  public emitGameWin(): void {
    this.emit('game_win');
  }

  public emitAchievementUnlocked(achievementId: string): void {
    this.emit('achievement_unlocked', { achievementId });
  }

  public emitScoreUpdate(score: number, delta: number): void {
    this.emit('score_update', { score, delta } as ScoreUpdateData);
  }

  public emitLevelComplete(level: number): void {
    this.emit('level_complete', { level });
  }

  public emitCameraShake(intensity: number, duration: number): void {
    this.emit('camera_shake', { intensity, duration } as CameraShakeData);
  }

  public emitScreenFlash(color: pc.Color, duration: number, intensity: number = 1): void {
    this.emit('screen_flash', { 
      color: { r: color.r, g: color.g, b: color.b }, 
      duration, 
      intensity 
    } as ScreenFlashData);
  }

  public emitSoundPlay(soundId: string, volume?: number, position?: pc.Vec3): void {
    this.emit('sound_play', { 
      soundId, 
      volume, 
      position: position ? { x: position.x, y: position.y, z: position.z } : undefined 
    } as SoundPlayData);
  }

  public emitUIOpen(uiId: string): void {
    this.emit('ui_open', { uiId } as UIEventData);
  }

  public emitUIClose(uiId: string): void {
    this.emit('ui_close', { uiId } as UIEventData);
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public getHistory(): EventData[] {
    return [...this.history];
  }

  public clearHistory(): void {
    this.history = [];
  }

  public getListenerCount(type: GameEventType): number {
    const listeners = this.listeners.get(type) || [];
    const onceListeners = this.onceListeners.get(type) || [];
    return listeners.length + onceListeners.length;
  }

  public getAllListenerCounts(): Record<GameEventType, number> {
    const counts: Record<GameEventType, number> = {} as Record<GameEventType, number>;
    this.listeners.forEach((_, type) => {
      counts[type] = this.getListenerCount(type);
    });
    return counts;
  }

  public destroy(): void {
    this.listeners.clear();
    this.onceListeners.clear();
    this.eventQueue = [];
    this.history = [];
  }
}