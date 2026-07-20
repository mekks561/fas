import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DifficultySnapshot } from '../engine/DifficultyManager';

interface PlayerState {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  level: number;
  speed: number;
  isBoostActive: boolean;
  boostEnergy: number;
  maxBoostEnergy: number;
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

interface PerformanceStats {
  drawCalls: number;
  triangles: number;
  memoryUsage: number;
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
  frameCount: number;
  performanceStats: PerformanceStats;
  combo: number;
  maxCombo: number;
  comboTimer: number;
  rank: string;
  activePowerups: ActivePowerup[];
  isBossWave: boolean;
  isEliteWave: boolean;
  waveEnemiesSpawned: number;
  waveEnemiesDefeated: number;
  waveEnemiesRemaining: number;
  waveRewardNotification: { waveNumber: number; rewards: { label: string }[] } | null;
  achievementNotifications: AchievementNotification[];
  difficultyInfo: DifficultySnapshot | null;
}

interface AchievementNotification {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  timestamp: number;
}

interface ActivePowerup {
  type: string;
  name: string;
  remainingTime: number;
  duration: number;
  value: number;
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
  setBoostEnergy: (energy: number) => void;
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
  incrementFrameCount: () => void;
  updatePerformanceStats: (stats: Partial<PerformanceStats>) => void;
  setCombo: (combo: number, maxCombo: number, timer: number) => void;
  setRank: (rank: string) => void;
  setActivePowerups: (powerups: ActivePowerup[]) => void;
  addActivePowerup: (powerup: ActivePowerup) => void;
  removeActivePowerup: (type: string) => void;
  setWaveInfo: (info: Partial<{ isBossWave: boolean; isEliteWave: boolean; enemiesSpawned: number; enemiesDefeated: number; enemiesRemaining: number }>) => void;
  setWaveRewardNotification: (notification: { waveNumber: number; rewards: { label: string }[] } | null) => void;
  addAchievementNotification: (notification: AchievementNotification) => void;
  removeAchievementNotification: (id: string) => void;
  setDifficultyInfo: (info: DifficultySnapshot | null) => void;
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
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      console.warn('Storage quota exceeded, save failed');
    }
  },
  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      console.warn('Storage remove failed');
      return false;
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
  boostEnergy: 100,
  maxBoostEnergy: 100,
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
  totalWaves: 10,
  waveProgress: 0,
  enemyCount: 0,
  projectileCount: 0,
  fps: 60,
  killCount: 0,
  playTime: 0,
  powerupsCollected: 0,
  skillsUsed: 0,
  enemiesDefeated: 0,
  frameCount: 0,
  performanceStats: {
    drawCalls: 0,
    triangles: 0,
    memoryUsage: 0,
  },
  combo: 0,
  maxCombo: 0,
  comboTimer: 0,
  rank: 'F',
  activePowerups: [],
  isBossWave: false,
  isEliteWave: false,
  waveEnemiesSpawned: 0,
  waveEnemiesDefeated: 0,
  waveEnemiesRemaining: 0,
  waveRewardNotification: null,
  achievementNotifications: [],
  difficultyInfo: null,
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

      setBoostEnergy: (energy) =>
        set((state) => ({
          player: {
            ...state.player,
            boostEnergy: Math.max(0, Math.min(state.player.maxBoostEnergy, energy)),
          },
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

      incrementFrameCount: () => set((state) => ({ frameCount: state.frameCount + 1 })),
      updatePerformanceStats: (stats) =>
        set((state) => ({
          performanceStats: { ...state.performanceStats, ...stats },
        })),

      setCombo: (combo, maxCombo, timer) =>
        set((state) => ({
          combo,
          maxCombo: Math.max(state.maxCombo, maxCombo),
          comboTimer: timer,
        })),

      setRank: (rank) => set({ rank }),

      setActivePowerups: (powerups) => set({ activePowerups: powerups }),

      addActivePowerup: (powerup) =>
        set((state) => {
          const existing = state.activePowerups.findIndex((p) => p.type === powerup.type);
          if (existing >= 0) {
            const updated = [...state.activePowerups];
            updated[existing] = powerup;
            return { activePowerups: updated };
          }
          return { activePowerups: [...state.activePowerups, powerup] };
        }),

      removeActivePowerup: (type) =>
        set((state) => ({
          activePowerups: state.activePowerups.filter((p) => p.type !== type),
        })),

      setWaveInfo: (info) =>
        set((state) => ({
          isBossWave: info.isBossWave ?? state.isBossWave,
          isEliteWave: info.isEliteWave ?? state.isEliteWave,
          waveEnemiesSpawned: info.enemiesSpawned ?? state.waveEnemiesSpawned,
          waveEnemiesDefeated: info.enemiesDefeated ?? state.waveEnemiesDefeated,
          waveEnemiesRemaining: info.enemiesRemaining ?? state.waveEnemiesRemaining,
        })),

      setWaveRewardNotification: (notification) => set({ waveRewardNotification: notification }),

      addAchievementNotification: (notification) =>
        set((state) => {
          // 避免重复添加同一个成就通知
          if (state.achievementNotifications.some((n) => n.id === notification.id)) {
            return state;
          }
          // 限制队列长度，最多保留5个通知
          const next = [...state.achievementNotifications, notification];
          if (next.length > 5) {
            next.shift();
          }
          return { achievementNotifications: next };
        }),

      removeAchievementNotification: (id) =>
        set((state) => ({
          achievementNotifications: state.achievementNotifications.filter((n) => n.id !== id),
        })),

      setDifficultyInfo: (info) => set({ difficultyInfo: info }),
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
