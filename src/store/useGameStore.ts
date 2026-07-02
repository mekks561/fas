import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PlayerState {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  level: number;
  speed: number;
  isBoostActive: boolean;
}

interface SkillsState {
  cooldowns: {
    skill1: number;
    skill2: number;
    skill3: number;
    skill4: number;
  };
  maxCooldowns: {
    skill1: number;
    skill2: number;
    skill3: number;
    skill4: number;
  };
}

interface TouchHandlers {
  onMove: (x: number, y: number) => void;
  onFire: (active: boolean) => void;
  onBoost: (active: boolean) => void;
  onSkill1: () => void;
  onSkill2: () => void;
  onSkill3: () => void;
  onSkill4: () => void;
}

interface GameState {
  isLoading: boolean;
  loadingProgress: number;
  error: string | null;
  isGamePaused: boolean;
  isSceneReady: boolean;
  showAchievements: boolean;
  isVictory: boolean;
  player: PlayerState;
  skills: SkillsState;
  touchHandlers: TouchHandlers | null;
  currentWave: number;
  totalWaves: number;
  waveProgress: number;
  enemyCount: number;
  projectileCount: number;
  fps: number;
  killCount: number;
  playTime: number;
  powerupsCollected: number;
  skillsUsed: number;
  enemiesDefeated: number;
}

interface GameActions {
  setLoading: (loading: boolean) => void;
  setLoadingProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setGamePaused: (paused: boolean) => void;
  setSceneReady: (ready: boolean) => void;
  toggleAchievements: () => void;
  updatePlayerHealth: (health: number) => void;
  updatePlayerShield: (shield: number) => void;
  addScore: (score: number) => void;
  setPlayerLevel: (level: number) => void;
  setSpeed: (speed: number) => void;
  setBoostActive: (active: boolean) => void;
  setWave: (wave: number) => void;
  setTotalWaves: (waves: number) => void;
  setWaveProgress: (progress: number) => void;
  setEnemyCount: (count: number) => void;
  setProjectileCount: (count: number) => void;
  setFps: (fps: number) => void;
  setSkillCooldown: (skillId: string, cooldown: number) => void;
  updateSkillCooldowns: (dt: number) => void;
  setTouchHandlers: (handlers: TouchHandlers) => void;
  addKill: () => void;
  addPowerup: () => void;
  addSkill: () => void;
  getPlayerScore: () => number;
  getKillCount: () => number;
  getPlayTime: () => number;
  getPowerupsCollected: () => number;
  getSkillsUsed: () => number;
  setVictory: (victory: boolean) => void;
  resetGame: () => void;
  saveGame: () => void;
  loadGame: () => void;
  clearSave: () => void;
}

const STORAGE_KEY = 'fighter-game-save';

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      console.warn('Storage quota exceeded, save failed');
      return false;
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      console.warn('Storage remove failed');
    }
  },
};

const storage = createJSONStorage(() => ({
  getItem: safeLocalStorage.getItem,
  setItem: safeLocalStorage.setItem,
  removeItem: safeLocalStorage.removeItem,
}));

const defaultPlayerState: PlayerState = {
  health: 100,
  maxHealth: 100,
  shield: 50,
  maxShield: 50,
  score: 0,
  level: 1,
  speed: 0,
  isBoostActive: false,
};

const defaultSkillsState: SkillsState = {
  cooldowns: {
    skill1: 0,
    skill2: 0,
    skill3: 0,
    skill4: 0,
  },
  maxCooldowns: {
    skill1: 8,
    skill2: 10,
    skill3: 15,
    skill4: 20,
  },
};

const defaultState: GameState = {
  isLoading: true,
  loadingProgress: 0,
  error: null,
  isGamePaused: false,
  isSceneReady: false,
  showAchievements: false,
  isVictory: false,
  player: defaultPlayerState,
  skills: defaultSkillsState,
  touchHandlers: null,
  currentWave: 1,
  totalWaves: 5,
  waveProgress: 0,
  enemyCount: 0,
  projectileCount: 0,
  fps: 60,
  killCount: 0,
  playTime: 0,
  powerupsCollected: 0,
  skillsUsed: 0,
  enemiesDefeated: 0,
};

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setLoading: (loading) => set({ isLoading: loading }),
      setLoadingProgress: (progress) => set({ loadingProgress: progress }),
      setError: (error) => set({ error }),
      setGamePaused: (paused) => set({ isGamePaused: paused }),
      setSceneReady: (ready) => set({ isSceneReady: ready }),
      toggleAchievements: () => set((state) => ({ showAchievements: !state.showAchievements })),

      updatePlayerHealth: (health) =>
        set((state) => ({
          player: {
            ...state.player,
            health: Math.max(0, Math.min(state.player.maxHealth, health)),
          },
        })),

      updatePlayerShield: (shield) =>
        set((state) => ({
          player: {
            ...state.player,
            shield: Math.max(0, Math.min(state.player.maxShield, shield)),
          },
        })),

      addScore: (score) =>
        set((state) => ({
          player: { ...state.player, score: state.player.score + score },
        })),

      setPlayerLevel: (level) =>
        set((state) => ({
          player: { ...state.player, level },
        })),

      setSpeed: (speed) =>
        set((state) => ({
          player: { ...state.player, speed },
        })),

      setBoostActive: (active) =>
        set((state) => ({
          player: { ...state.player, isBoostActive: active },
        })),

      setWave: (wave) => set({ currentWave: wave }),
      setTotalWaves: (waves) => set({ totalWaves: waves }),
      setWaveProgress: (progress) => set({ waveProgress: progress }),
      setEnemyCount: (count) => set({ enemyCount: count }),
      setProjectileCount: (count) => set({ projectileCount: count }),
      setFps: (fps) => set({ fps }),

      setSkillCooldown: (skillId, cooldown) =>
        set((state) => ({
          skills: {
            ...state.skills,
            cooldowns: {
              ...state.skills.cooldowns,
              [skillId]: Math.max(0, cooldown),
            },
          },
        })),

      updateSkillCooldowns: (dt) =>
        set((state) => ({
          skills: {
            ...state.skills,
            cooldowns: {
              skill1: Math.max(0, state.skills.cooldowns.skill1 - dt),
              skill2: Math.max(0, state.skills.cooldowns.skill2 - dt),
              skill3: Math.max(0, state.skills.cooldowns.skill3 - dt),
              skill4: Math.max(0, state.skills.cooldowns.skill4 - dt),
            },
          },
        })),

      setTouchHandlers: (handlers) => set({ touchHandlers: handlers }),

      addKill: () => set((state) => ({ killCount: state.killCount + 1 })),
      addPowerup: () => set((state) => ({ powerupsCollected: state.powerupsCollected + 1 })),
      addSkill: () => set((state) => ({ skillsUsed: state.skillsUsed + 1 })),

      getPlayerScore: () => get().player.score,
      getKillCount: () => get().killCount,
      getPlayTime: () => get().playTime,
      getPowerupsCollected: () => get().powerupsCollected,
      getSkillsUsed: () => get().skillsUsed,

      setVictory: (victory) => set({ isVictory: victory }),

      resetGame: () =>
        set({
          ...defaultState,
          player: { ...defaultPlayerState, score: get().player.score, level: get().player.level },
        }),

      saveGame: () => {
        const state = get();
        const saveData = {
          player: {
            score: state.player.score,
            level: state.player.level,
          },
          lastSaved: new Date().toISOString(),
        };
        safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      },

      loadGame: () => {
        const saved = safeLocalStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const data = JSON.parse(saved);
            if (data.player) {
              set({
                player: {
                  ...get().player,
                  score: data.player.score ?? get().player.score,
                  level: data.player.level ?? get().player.level,
                },
              });
            }
          } catch {
            console.warn('Failed to load save data');
          }
        }
      },

      clearSave: () => {
        safeLocalStorage.removeItem(STORAGE_KEY);
        set({
          player: { ...get().player, score: 0, level: 1 },
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage,
      partialize: (state) => ({
        player: {
          score: state.player.score,
          level: state.player.level,
        },
      }),
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('Game state rehydrated:', state.player);
        }
      },
    },
  ),
);
