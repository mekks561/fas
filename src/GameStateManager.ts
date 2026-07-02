export enum GameState {
  MENU,
  PLAYING,
  PAUSED,
  GAME_OVER,
  LEVEL_COMPLETE,
  LOADING,
}

export interface GameStatus {
  score: number;
  lives: number;
  level: number;
  kills: number;
  combo: number;
  maxCombo: number;
  wave: number;
  enemiesRemaining: number;
}

export class GameStateManager {
  private currentState: GameState = GameState.MENU;
  private status: GameStatus = {
    score: 0,
    lives: 3,
    level: 1,
    kills: 0,
    combo: 0,
    maxCombo: 0,
    wave: 1,
    enemiesRemaining: 0,
  };

  private stateChangeCallbacks: ((state: GameState) => void)[] = [];
  private statusChangeCallbacks: ((status: GameStatus) => void)[] = [];

  constructor(_scene?: unknown) {
    this.status.enemiesRemaining = this.getEnemiesForWave(1);
  }

  public getState(): GameState {
    return this.currentState;
  }

  public getStatus(): GameStatus {
    return { ...this.status };
  }

  public isState(state: GameState): boolean {
    return this.currentState === state;
  }

  public setState(state: GameState): void {
    if (this.currentState !== state) {
      this.currentState = state;
      this.notifyStateChange(state);
    }
  }

  public setPlayingState(): void {
    this.setState(GameState.PLAYING);
  }

  public setPausedState(): void {
    this.setState(GameState.PAUSED);
  }

  public setGameOverState(): void {
    this.setState(GameState.GAME_OVER);
  }

  public setMenuState(): void {
    this.setState(GameState.MENU);
  }

  public setLoadingState(): void {
    this.setState(GameState.LOADING);
  }

  public setLevelCompleteState(): void {
    this.setState(GameState.LEVEL_COMPLETE);
  }

  public addScore(points: number): void {
    this.status.score += points;
    this.notifyStatusChange();
  }

  public addKill(): void {
    this.status.kills++;
    this.status.combo++;
    if (this.status.combo > this.status.maxCombo) {
      this.status.maxCombo = this.status.combo;
    }
    this.addScore(100 * this.status.combo);
    this.notifyStatusChange();
  }

  public resetCombo(): void {
    this.status.combo = 0;
    this.notifyStatusChange();
  }

  public loseLife(): boolean {
    this.status.lives--;
    this.resetCombo();
    this.notifyStatusChange();

    if (this.status.lives <= 0) {
      this.setGameOverState();
      return true;
    }
    return false;
  }

  public addLife(): void {
    if (this.status.lives < 5) {
      this.status.lives++;
      this.notifyStatusChange();
    }
  }

  public nextLevel(): void {
    this.status.level++;
    this.status.wave = 1;
    this.status.enemiesRemaining = this.getEnemiesForWave(1);
    this.notifyStatusChange();
  }

  public nextWave(): void {
    this.status.wave++;
    this.status.enemiesRemaining = this.getEnemiesForWave(this.status.wave);
    this.notifyStatusChange();
  }

  public enemyDestroyed(): void {
    if (this.status.enemiesRemaining > 0) {
      this.status.enemiesRemaining--;
      this.notifyStatusChange();
    }
  }

  public getEnemiesForWave(wave: number): number {
    return 5 + wave * 3;
  }

  public isWaveComplete(): boolean {
    return this.status.enemiesRemaining <= 0;
  }

  public reset(): void {
    this.status = {
      score: 0,
      lives: 3,
      level: 1,
      kills: 0,
      combo: 0,
      maxCombo: 0,
      wave: 1,
      enemiesRemaining: this.getEnemiesForWave(1),
    };
    this.notifyStatusChange();
  }

  public subscribeToStateChange(callback: (state: GameState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  public subscribeToStatusChange(callback: (status: GameStatus) => void): void {
    this.statusChangeCallbacks.push(callback);
  }

  private notifyStateChange(state: GameState): void {
    for (const callback of this.stateChangeCallbacks) {
      callback(state);
    }
  }

  private notifyStatusChange(): void {
    for (const callback of this.statusChangeCallbacks) {
      callback({ ...this.status });
    }
  }

  public update(_deltaTime: number): void {
    // 游戏状态更新逻辑可以在这里添加
  }

  public dispose(): void {
    this.stateChangeCallbacks = [];
    this.statusChangeCallbacks = [];
  }
}
