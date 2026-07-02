/**
 * 游戏状态机系统
 * 管理游戏的全局状态转换
 */

export enum GameState {
  MENU = 'menu',
  LEVEL_SELECT = 'level_select',
  LOADING = 'loading',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'game_over',
  LEVEL_COMPLETE = 'level_complete',
  SETTINGS = 'settings',
  CREDITS = 'credits',
  ACHIEVEMENTS = 'achievements',
  SHOP = 'shop',
}

export interface GameStateTransition {
  from: GameState;
  to: GameState;
  condition?: () => boolean;
}

export class GameStateMachine {
  private currentState: GameState = GameState.MENU;
  private transitions: Map<GameState, GameState[]> = new Map();
  private listeners: Set<(state: GameState) => void> = new Set();

  constructor() {
    this.initializeTransitions();
  }

  private initializeTransitions(): void {
    this.transitions.set(GameState.MENU, [
      GameState.LEVEL_SELECT,
      GameState.LOADING,
      GameState.SETTINGS,
      GameState.CREDITS,
      GameState.ACHIEVEMENTS,
      GameState.SHOP,
    ]);

    this.transitions.set(GameState.LEVEL_SELECT, [GameState.PLAYING, GameState.MENU]);

    this.transitions.set(GameState.LOADING, [GameState.PLAYING, GameState.MENU]);

    this.transitions.set(GameState.PLAYING, [
      GameState.PAUSED,
      GameState.GAME_OVER,
      GameState.LEVEL_COMPLETE,
    ]);

    this.transitions.set(GameState.PAUSED, [GameState.PLAYING, GameState.MENU]);

    this.transitions.set(GameState.GAME_OVER, [GameState.MENU, GameState.LOADING]);

    this.transitions.set(GameState.LEVEL_COMPLETE, [GameState.PLAYING, GameState.MENU]);

    this.transitions.set(GameState.SETTINGS, [GameState.MENU, GameState.PLAYING]);

    this.transitions.set(GameState.CREDITS, [GameState.MENU]);
  }

  public getState(): GameState {
    return this.currentState;
  }

  public canTransition(to: GameState): boolean {
    const allowed = this.transitions.get(this.currentState);
    return allowed ? allowed.includes(to) : false;
  }

  public transition(to: GameState): boolean {
    if (!this.canTransition(to)) {
      console.warn(`Cannot transition from ${this.currentState} to ${to}`);
      return false;
    }

    const previousState = this.currentState;
    this.currentState = to;

    console.log(`Game state changed: ${previousState} -> ${to}`);

    this.listeners.forEach((listener) => listener(to));
    return true;
  }

  public onStateChange(listener: (state: GameState) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public isPlaying(): boolean {
    return this.currentState === GameState.PLAYING;
  }

  public isPaused(): boolean {
    return this.currentState === GameState.PAUSED;
  }

  public isMenu(): boolean {
    return this.currentState === GameState.MENU;
  }

  public reset(): void {
    this.currentState = GameState.MENU;
    this.listeners.forEach((listener) => listener(GameState.MENU));
  }
}
