/**
 * 游戏事件总线
 * 提供跨组件通信机制
 */

export type GameEvent = 
  | 'game_start'
  | 'game_pause'
  | 'game_resume'
  | 'game_over'
  | 'level_complete'
  | 'wave_change'
  | 'enemy_kill'
  | 'player_damage'
  | 'player_heal'
  | 'achievement_unlocked'
  | 'powerup_collected'
  | 'score_update'
  | 'settings_change';

export interface GameEventData {
  type: GameEvent;
  payload?: unknown;
}

export interface GameEventListener {
  (data: GameEventData): void;
}

export interface EventSubscription {
  event: GameEvent;
  listener: GameEventListener;
}

export class GameEventBus {
  private listeners: Map<GameEvent, Set<GameEventListener>> = new Map();
  private subscriptions: Map<symbol, EventSubscription> = new Map();

  public on(event: GameEvent, listener: GameEventListener): symbol {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(listener);
    
    const id = Symbol();
    this.subscriptions.set(id, { event, listener });
    
    return id;
  }

  public off(id: symbol): void {
    const subscription = this.subscriptions.get(id);
    if (subscription) {
      this.listeners.get(subscription.event)?.delete(subscription.listener);
      this.subscriptions.delete(id);
    }
  }

  public emit(event: GameEvent, payload?: unknown): void {
    const eventData: GameEventData = { type: event, payload };
    
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(eventData);
      } catch (error) {
        console.error(`Error handling event ${event}:`, error);
      }
    });
  }

  public once(event: GameEvent, listener: GameEventListener): symbol {
    const wrapper: GameEventListener = (data) => {
      listener(data);
      const ids = this.findSubscriptionIds(event, wrapper);
      ids.forEach(id => this.off(id));
    };
    
    return this.on(event, wrapper);
  }

  private findSubscriptionIds(event: GameEvent, listener: GameEventListener): symbol[] {
    const ids: symbol[] = [];
    
    this.subscriptions.forEach((sub, id) => {
      if (sub.event === event && sub.listener === listener) {
        ids.push(id);
      }
    });
    
    return ids;
  }

  public hasListeners(event: GameEvent): boolean {
    const listeners = this.listeners.get(event);
    return listeners ? listeners.size > 0 : false;
  }

  public getListenerCount(event?: GameEvent): number {
    if (event) {
      return this.listeners.get(event)?.size || 0;
    }
    
    return Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0);
  }

  public clear(): void {
    this.listeners.clear();
    this.subscriptions.clear();
  }

  public clearEvent(event: GameEvent): void {
    this.listeners.delete(event);
    
    this.subscriptions.forEach((sub, id) => {
      if (sub.event === event) {
        this.subscriptions.delete(id);
      }
    });
  }
}

export const gameEventBus = new GameEventBus();

export const useGameEvent = (event: GameEvent, handler: GameEventListener) => {
  const subscriptionRef = { id: null as symbol | null };
  
  const subscribe = () => {
    if (subscriptionRef.id === null) {
      subscriptionRef.id = gameEventBus.on(event, handler);
    }
  };
  
  const unsubscribe = () => {
    if (subscriptionRef.id !== null) {
      gameEventBus.off(subscriptionRef.id);
      subscriptionRef.id = null;
    }
  };
  
  return { subscribe, unsubscribe };
};