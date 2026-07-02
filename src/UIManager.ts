import { UIMode } from './components/MainMenu';

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  difficulty: 'easy' | 'normal' | 'hard';
  graphicsQuality: 'low' | 'medium' | 'high';
  showFPS: boolean;
  fullscreen: boolean;
}

export interface LevelInfo {
  id: number;
  name: string;
  description: string;
  completed: boolean;
  highScore: number;
  difficulty?: 'easy' | 'normal' | 'hard' | 'nightmare';
  recommendedLevel?: number;
  stars?: number;
  unlocked?: boolean;
  completionRate?: number;
  enemies?: number;
  waves?: number;
}

export interface UIState {
  mode: UIMode;
  settings: GameSettings;
  levels: LevelInfo[];
  currentLevelId: number;
  isPaused: boolean;
  showTutorial: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 70,
  sfxVolume: 80,
  difficulty: 'normal',
  graphicsQuality: 'high',
  showFPS: false,
  fullscreen: false,
};

export const DEFAULT_LEVELS: LevelInfo[] = [
  {
    id: 1,
    name: 'Tutorial Zone',
    description: 'Learn the basics of combat',
    completed: false,
    highScore: 0,
    difficulty: 'easy',
    recommendedLevel: 1,
    stars: 0,
    unlocked: true,
    enemies: 20,
    waves: 5,
  },
  {
    id: 2,
    name: 'Asteroid Field',
    description: 'Navigate through asteroid chaos',
    completed: false,
    highScore: 0,
    difficulty: 'normal',
    recommendedLevel: 3,
    stars: 0,
    unlocked: false,
    enemies: 35,
    waves: 8,
  },
  {
    id: 3,
    name: 'Enemy Fortress',
    description: 'Assault the enemy stronghold',
    completed: false,
    highScore: 0,
    difficulty: 'hard',
    recommendedLevel: 5,
    stars: 0,
    unlocked: false,
    enemies: 50,
    waves: 10,
  },
];

export class UIManager {
  private state: UIState;
  private stateCallbacks: ((state: UIState) => void)[] = [];
  private settingsCallbacks: ((settings: GameSettings) => void)[] = [];

  constructor() {
    this.state = {
      mode: UIMode.MAIN_MENU,
      settings: this.loadSettings(),
      levels: this.loadLevels(),
      currentLevelId: 1,
      isPaused: false,
      showTutorial: false,
    };
  }

  private loadSettings(): GameSettings {
    try {
      const saved = localStorage.getItem('fighterGameSettings');
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore errors
    }
    return DEFAULT_SETTINGS;
  }

  private loadLevels(): LevelInfo[] {
    try {
      const saved = localStorage.getItem('fighterGameLevels');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore errors
    }
    return DEFAULT_LEVELS;
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('fighterGameSettings', JSON.stringify(this.state.settings));
    } catch {
      // Ignore errors
    }
  }

  private saveLevels(): void {
    try {
      localStorage.setItem('fighterGameLevels', JSON.stringify(this.state.levels));
    } catch {
      // Ignore errors
    }
  }

  public getState(): UIState {
    return this.state;
  }

  public getMode(): UIMode {
    return this.state.mode;
  }

  public setMode(mode: UIMode): void {
    this.state.mode = mode;
    this.notifyStateChange();
  }

  public getSettings(): GameSettings {
    return this.state.settings;
  }

  public updateSettings(settings: Partial<GameSettings>): void {
    this.state.settings = { ...this.state.settings, ...settings };
    this.saveSettings();
    this.notifySettingsChange();
    this.notifyStateChange();
  }

  public getLevels(): LevelInfo[] {
    return this.state.levels;
  }

  public markLevelCompleted(levelId: number, score: number): void {
    const level = this.state.levels.find((l) => l.id === levelId);
    if (level) {
      level.completed = true;
      if (score > level.highScore) {
        level.highScore = score;
      }
      this.saveLevels();
      this.notifyStateChange();
    }
  }

  public setCurrentLevel(levelId: number): void {
    this.state.currentLevelId = levelId;
    this.notifyStateChange();
  }

  public getCurrentLevel(): LevelInfo {
    return (
      this.state.levels.find((l) => l.id === this.state.currentLevelId) || this.state.levels[0]
    );
  }

  public togglePause(): void {
    this.state.isPaused = !this.state.isPaused;
    if (this.state.isPaused) {
      this.state.mode = UIMode.PAUSED;
    } else {
      this.state.mode = UIMode.PLAYING;
    }
    this.notifyStateChange();
  }

  public pause(): void {
    if (!this.state.isPaused) {
      this.state.isPaused = true;
      this.state.mode = UIMode.PAUSED;
      this.notifyStateChange();
    }
  }

  public resume(): void {
    if (this.state.isPaused) {
      this.state.isPaused = false;
      this.state.mode = UIMode.PLAYING;
      this.notifyStateChange();
    }
  }

  public isPaused(): boolean {
    return this.state.isPaused;
  }

  public startGame(levelId: number = 1): void {
    this.state.currentLevelId = levelId;
    this.state.mode = UIMode.PLAYING;
    this.state.isPaused = false;
    this.notifyStateChange();
  }

  public showMainMenu(): void {
    this.state.mode = UIMode.MAIN_MENU;
    this.state.isPaused = false;
    this.notifyStateChange();
  }

  public showLevelSelect(): void {
    this.state.mode = UIMode.LEVEL_SELECT;
    this.notifyStateChange();
  }

  public showSettings(): void {
    this.state.mode = UIMode.SETTINGS;
    this.notifyStateChange();
  }

  public showGameOver(): void {
    this.state.mode = UIMode.GAME_OVER;
    this.state.isPaused = false;
    this.notifyStateChange();
  }

  public showLevelComplete(): void {
    this.state.mode = UIMode.LEVEL_COMPLETE;
    this.state.isPaused = false;
    this.notifyStateChange();
  }

  public subscribeToState(callback: (state: UIState) => void): () => void {
    this.stateCallbacks.push(callback);
    return () => this.unsubscribeFromState(callback);
  }

  public unsubscribeFromState(callback: (state: UIState) => void): void {
    const index = this.stateCallbacks.indexOf(callback);
    if (index !== -1) {
      this.stateCallbacks.splice(index, 1);
    }
  }

  public subscribeToSettings(callback: (settings: GameSettings) => void): void {
    this.settingsCallbacks.push(callback);
  }

  private notifyStateChange(): void {
    for (const callback of this.stateCallbacks) {
      callback(this.state);
    }
  }

  private notifySettingsChange(): void {
    for (const callback of this.settingsCallbacks) {
      callback(this.state.settings);
    }
  }

  public resetProgress(): void {
    this.state.levels = DEFAULT_LEVELS.map((l) => ({
      ...l,
      completed: false,
      highScore: 0,
      stars: 0,
      unlocked: l.id === 1, // 只有第一关解锁
    }));
    this.saveLevels();
    this.notifyStateChange();
  }

  public dispose(): void {
    this.stateCallbacks = [];
    this.settingsCallbacks = [];
  }
}

// Singleton instance
let uiManagerInstance: UIManager | null = null;

export function getUIManager(): UIManager {
  if (!uiManagerInstance) {
    uiManagerInstance = new UIManager();
  }
  return uiManagerInstance;
}

export function resetUIManager(): void {
  if (uiManagerInstance) {
    uiManagerInstance.dispose();
    uiManagerInstance = null;
  }
}
