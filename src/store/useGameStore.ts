import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware/persist';
import {
  GameState,
  Difficulty,
  GameConfig,
  PlayerStats,
  GameStatistics,
  LeaderboardEntry,
  Enemy,
  Projectile,
  Particle,
  PowerUp,
  GameEvent
} from '../types/game-types';

// 游戏状态接口
interface GameStoreState {
  // 核心游戏状态
  gameState: GameState;
  gameStartTime: number;

  // 游戏配置
  config: GameConfig;
  
  // 玩家状态
  player: PlayerStats;
  
  // 游戏数据
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  powerUps: PowerUp[];
  events: GameEvent[];
  
  // 游戏进度
  currentWave: number;
  waveProgress: number;
  waveConfig: any;
  
  // 统计数据
  statistics: GameStatistics;
  leaderboard: LeaderboardEntry[];
  
  // 性能指标
  fps: number;
  frameCount: number;
  deltaTime: number;
  performanceStats: {
    drawCalls: number;
    triangles: number;
    memoryUsage: number;
  };
  
  // 错误和加载
  isLoading: boolean;
  loadingProgress: number;
  error: string | null;
}

// 游戏动作接口
interface GameStoreActions {
  // 游戏生命周期
  setGameState: (state: GameState) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: (victory: boolean) => void;
  resetGame: () => void;
  
  // 配置
  setConfig: (config: Partial<GameConfig>) => void;
  updateConfig: (key: keyof GameConfig, value: any) => void;
  
  // 玩家
  updatePlayerHealth: (amount: number) => void;
  updatePlayerShield: (amount: number) => void;
  updatePlayerScore: (points: number) => void;
  updatePlayerSpeed: (speed: number) => void;
  updatePlayerBoost: (amount: number) => void;
  addPlayerExperience: (exp: number) => void;
  levelUp: () => void;
  
  // 游戏对象管理
  addEnemy: (enemy: Enemy) => void;
  updateEnemy: (id: string, updates: Partial<Enemy>) => void;
  removeEnemy: (id: string) => void;
  
  addProjectile: (projectile: Projectile) => void;
  removeProjectile: (id: string) => void;
  
  addParticle: (particle: Particle) => void;
  removeParticle: (id: string) => void;
  
  addPowerUp: (powerUp: PowerUp) => void;
  removePowerUp: (id: string) => void;
  
  addEvent: (event: GameEvent) => void;
  clearEvents: () => void;
  
  // 波次管理
  advanceWave: () => void;
  updateWaveProgress: (progress: number) => void;
  
  // 统计数据
  updateStatistics: (stats: Partial<GameStatistics>) => void;
  addToLeaderboard: (entry: LeaderboardEntry) => void;
  
  // 性能
  setFps: (fps: number) => void;
  updatePerformanceStats: (stats: Partial<{
    drawCalls: number; triangles: number; memoryUsage: number; }) => void;
  incrementFrameCount: () => void;
  
  // 加载
  setLoading: (loading: boolean) => void;
  setLoadingProgress: (progress: number) => void;
  setError: (error: string | null) => void;
}

// 默认配置
const defaultConfig: GameConfig = {
  difficulty: Difficulty.NORMAL,
  soundEnabled: true,
  musicEnabled: true,
  graphicsQuality: 'HIGH',
  fieldOfView: 75,
  sensitivity: 0.5,
  showFPS: true
};

// 默认玩家状态
const defaultPlayer: PlayerStats = {
  health: 100,
  maxHealth: 100,
  shield: 0,
  maxShield: 50,
  speed: 0,
  maxSpeed: 50,
  boost: 100,
  maxBoost: 100,
  score: 0,
  kills: 0,
  level: 1,
  experience: 0,
  experienceToNextLevel: 1000
};

// 默认统计数据
const defaultStatistics: GameStatistics = {
  totalPlayTime: 0,
  totalScore: 0,
  totalKills: 0,
  gamesPlayed: 0,
  gamesWon: 0,
  maxCombo: 0,
  maxWave: 0,
  accuracy: 100
};

// 创建store
export const useGameStore = create<GameStoreState & GameStoreActions>()(
  persist(
    immer((set, get) => ({
      // 初始状态
      gameState: GameState.MAIN_MENU,
      gameStartTime: 0,
      config: defaultConfig,
      player: defaultPlayer,
      enemies: [],
      projectiles: [],
      particles: [],
      powerUps: [],
      events: [],
      currentWave: 1,
      waveProgress: 0,
      waveConfig: null,
      statistics: defaultStatistics,
      leaderboard: [],
      fps: 60,
      frameCount: 0,
      performanceStats: {
        drawCalls: 0,
        triangles: 0,
        memoryUsage: 0
      },
      isLoading: true,
      loadingProgress: 0,
      error: null,
      
      // 游戏生命周期
      setGameState: (state) =>
        set((s) => {
          s.gameState = state;
          if (state === GameState.PLAYING && !s.gameStartTime) {
            s.gameStartTime = Date.now();
          }
        }),
        
      startGame: () =>
        set((s) => {
          s.gameState = GameState.PLAYING;
          s.gameStartTime = Date.now();
          s.isLoading = false;
          s.error = null;
          s.statistics.gamesPlayed += 1;
        }),
        
      pauseGame: () =>
        set((s) => {
          s.gameState = GameState.PAUSED;
        }),
        
      resumeGame: () =>
        set((s) => {
          s.gameState = GameState.PLAYING;
        }),
        
      endGame: (victory) =>
        set((s) => {
          s.gameState = victory ? GameState.VICTORY : GameState.GAME_OVER;
          s.statistics.gamesPlayed += victory ? 1 : 0;
          s.statistics.totalScore += s.player.score;
          s.statistics.totalKills += s.player.kills;
          
          if (s.currentWave > s.statistics.maxWave) {
            s.statistics.maxWave = s.currentWave;
          }
          
          const playTime = Math.floor((Date.now() - s.gameStartTime) / 1000);
          s.statistics.totalPlayTime += playTime;
        }),
        
      resetGame: () =>
        set((s) => {
          s.gameState = GameState.MAIN_MENU;
          s.gameStartTime = 0;
          s.player = { ...defaultPlayer };
          s.enemies = [];
          s.projectiles = [];
          s.particles = [];
          s.powerUps = [];
          s.events = [];
          s.currentWave = 1;
          s.waveProgress = 0;
          s.isLoading = false;
          s.error = null;
        }),
        
      // 配置
      setConfig: (config) =>
        set((s) => {
          s.config = { ...s.config, ...config };
        }),
        
      updateConfig: (key, value) =>
        set((s) => {
          s.config[key] = value;
        }),
        
      // 玩家
      updatePlayerHealth: (amount) =>
        set((s) => {
          s.player.health = Math.max(0, Math.min(s.player.health + amount, s.player.maxHealth));
          
          if (s.player.health <= 0) {
            s.gameState = GameState.GAME_OVER;
          }
        }),
        
      updatePlayerShield: (amount) =>
        set((s) => {
          s.player.shield = Math.max(0, Math.min(s.player.shield + amount, s.player.maxShield));
        }),
        
      updatePlayerScore: (points) =>
        set((s) => {
          s.player.score += points;
        }),
        
      updatePlayerSpeed: (speed) =>
        set((s) => {
          s.player.speed = speed;
        }),
        
      updatePlayerBoost: (amount) =>
        set((s) => {
          s.player.boost = Math.max(0, Math.min(s.player.boost + amount, s.player.maxBoost));
        }),
        
      addPlayerExperience: (exp) =>
        set((s) => {
          s.player.experience += exp;
          if (s.player.experience >= s.player.experienceToNextLevel) {
            get().levelUp();
          }
        }),
        
      levelUp: () =>
        set((s) => {
          s.player.level += 1;
          s.player.experience -= s.player.experienceToNextLevel;
          s.player.experienceToNextLevel = Math.floor(s.player.experienceToNextLevel * 1.5);
          s.player.maxHealth += 10;
          s.player.health = s.player.maxHealth;
          s.player.maxShield += 10;
        }),
        
      // 游戏对象管理
      addEnemy: (enemy) =>
        set((s) => {
          s.enemies.push(enemy);
        }),
        
      updateEnemy: (id, updates) =>
        set((s) => {
          const index = s.enemies.findIndex(e => e.id === id);
          if (index !== -1) {
            s.enemies[index] = { ...s.enemies[index], ...updates };
          }
        }),
        
      removeEnemy: (id) =>
        set((s) => {
          const index = s.enemies.findIndex(e => e.id === id);
          if (index !== -1) {
            const enemy = s.enemies[index];
            s.player.score += enemy.scoreValue;
            s.player.kills += 1;
            s.enemies.splice(index, 1);
            s.events.push({
              type: 'ENEMY_KILLED',
              timestamp: Date.now(),
              data: enemy
            });
          }
        }),
        
      addProjectile: (projectile) =>
        set((s) => {
          s.projectiles.push(projectile);
        }),
        
      removeProjectile: (id) =>
        set((s) => {
          const index = s.projectiles.findIndex(p => p.id === id);
          if (index !== -1) {
            s.projectiles.splice(index, 1);
          }
        }),
        
      addParticle: (particle) =>
        set((s) => {
          s.particles.push(particle);
        }),
        
      removeParticle: (id) =>
        set((s) => {
          const index = s.particles.findIndex(p => p.id === id);
          if (index !== -1) {
            s.particles.splice(index, 1);
          }
        }),
        
      addPowerUp: (powerUp) =>
        set((s) => {
          s.powerUps.push(powerUp);
        }),
        
      removePowerUp: (id) =>
        set((s) => {
          const index = s.powerUps.findIndex(p => p.id === id);
          if (index !== -1) {
            const powerUp = s.powerUps[index];
            s.powerUps.splice(index, 1);
            s.events.push({
              type: 'POWERUP_COLLECTED',
              timestamp: Date.now(),
              data: powerUp
            });
          }
        }),
        
      addEvent: (event) =>
        set((s) => {
          s.events.push(event);
        }),
        
      clearEvents: () =>
        set((s) => {
          s.events = [];
        }),
        
      // 波次管理
      advanceWave: () =>
        set((s) => {
          s.currentWave += 1;
          s.waveProgress = 0;
          s.events.push({
            type: 'WAVE_COMPLETED',
            timestamp: Date.now(),
            data: { wave: s.currentWave }
          });
        }),
        
      updateWaveProgress: (progress) =>
        set((s) => {
          s.waveProgress = progress;
        }),
        
      // 统计数据
      updateStatistics: (stats) =>
        set((s) => {
          s.statistics = { ...s.statistics, ...stats };
        }),
        
      addToLeaderboard: (entry) =>
        set((s) => {
          s.leaderboard.push(entry);
          s.leaderboard.sort((a, b) => b.score - a.score);
          s.leaderboard = s.leaderboard.slice(0, 100);
        }),
        
      // 性能
      setFps: (fps) =>
        set((s) => {
          s.fps = fps;
        }),
        
      updatePerformanceStats: (stats) =>
        set((s) => {
          s.performanceStats = { ...s.performanceStats, ...stats };
        }),
        
      incrementFrameCount: () =>
        set((s) => {
          s.frameCount += 1;
        }),
        
      // 加载
      setLoading: (loading) =>
        set((s) => {
          s.isLoading = loading;
        }),
        
      setLoadingProgress: (progress) =>
        set((s) => {
          s.loadingProgress = progress;
        }),
        
      setError: (error) =>
        set((s) => {
          s.error = error;
        })
    })),
    {
      name: 'fighter-game-storage',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
        if (typeof window !== 'undefined') {
          const item = localStorage.getItem(name);
          if (item) {
            return item;
          }
        }
        return null;
      },
        setItem: (name, value) => {
          if (typeof window !== 'undefined') {
            localStorage.setItem(name, value);
          }
        },
        removeItem: (name) => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(name);
          }
        }
      })),
      partialize: (state) => ({
        config: state.config,
        statistics: state.statistics,
        leaderboard: state.leaderboard
      })
    }
  )
);

// 选择器，优化渲染
export const useGameCoreState = () =>
  useGameStore((state) => ({
    gameState: state.gameState,
    isLoading: state.isLoading,
    loadingProgress: state.loadingProgress,
    error: state.error
  }));

export const usePlayerState = () =>
  useGameStore((state) => ({
    health: state.player.health,
    maxHealth: state.player.maxHealth,
    shield: state.player.shield,
    maxShield: state.player.maxShield,
    speed: state.player.speed,
    boost: state.player.boost,
    maxBoost: state.player.maxBoost,
    score: state.player.score,
    level: state.player.level,
    kills: state.player.kills
  }));

export const useGameStats = () =>
  useGameStore((state) => ({
    currentWave: state.currentWave,
    statistics: state.statistics,
    fps: state.fps,
    performanceStats: state.performanceStats
  }));

export const useGameConfig = () =>
  useGameStore((state) => state.config);

export const useGameActions = () => {
  const {
    setGameState,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    resetGame,
    setConfig,
    updateConfig,
    updatePlayerHealth,
    updatePlayerShield,
    updatePlayerScore,
    updatePlayerSpeed,
    updatePlayerBoost,
    addPlayerExperience,
    levelUp,
    addEnemy,
    updateEnemy,
    removeEnemy,
    addProjectile,
    removeProjectile,
    addParticle,
    removeParticle,
    addPowerUp,
    removePowerUp,
    addEvent,
    clearEvents,
    advanceWave,
    updateWaveProgress,
    updateStatistics,
    addToLeaderboard,
    setFps,
    updatePerformanceStats,
    incrementFrameCount,
    setLoading,
    setLoadingProgress,
    setError
  } = useGameStore();
  
  return {
    setGameState,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    resetGame,
    setConfig,
    updateConfig,
    updatePlayerHealth,
    updatePlayerShield,
    updatePlayerScore,
    updatePlayerSpeed,
    updatePlayerBoost,
    addPlayerExperience,
    levelUp,
    addEnemy,
    updateEnemy,
    removeEnemy,
    addProjectile,
    removeProjectile,
    addParticle,
    removeParticle,
    addPowerUp,
    removePowerUp,
    addEvent,
    clearEvents,
    advanceWave,
    updateWaveProgress,
    updateStatistics,
    addToLeaderboard,
    setFps,
    updatePerformanceStats,
    incrementFrameCount,
    setLoading,
    setLoadingProgress,
    setError
  };
};