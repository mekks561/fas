// 游戏核心类型定义
export enum GameState {
  MAIN_MENU = 'MAIN_MENU',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
  EXPERT = 'EXPERT'
}

export interface GameConfig {
  difficulty: Difficulty;
  soundEnabled: boolean;
  musicEnabled: boolean;
  graphicsQuality: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
  fieldOfView: number;
  sensitivity: number;
  showFPS: boolean;
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  speed: number;
  maxSpeed: number;
  boost: number;
  maxBoost: number;
  score: number;
  kills: number;
  level: number;
  experience: number;
  experienceToNextLevel: number;
}

export interface GameStatistics {
  totalPlayTime: number;
  totalScore: number;
  totalKills: number;
  gamesPlayed: number;
  gamesWon: number;
  maxCombo: number;
  maxWave: number;
  accuracy: number;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  level: number;
  wave: number;
  kills: number;
  date: string;
  timestamp: number;
}

export interface PowerUp {
  id: string;
  type: 'HEALTH' | 'SHIELD' | 'BOOST' | 'MULTIPLIER' | 'WEAPON_UPGRADE';
  x: number;
  y: number;
  z: number;
  duration: number;
  value: number;
}

export interface Enemy {
  id: string;
  type: 'FIGHTER' | 'BOMBER' | 'ELITE' | 'BOSS';
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  scoreValue: number;
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export interface Projectile {
  id: string;
  type: 'PLAYER' | 'ENEMY';
  x: number;
  y: number;
  z: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  damage: number;
  lifetime: number;
}

export interface Particle {
  id: string;
  type: 'EXPLOSION' | 'TRAIL' | 'SPARK';
  x: number;
  y: number;
  z: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  lifetime: number;
  maxLifetime: number;
  color: string;
  size: number;
}

export interface WaveConfig {
  number: number;
  enemyCount: number;
  enemyTypes: string[];
  spawnRate: number;
  difficultyModifier: number;
  bossWave?: boolean;
}

export interface GameEvent {
  type: 'ENEMY_KILLED' | 'POWERUP_COLLECTED' | 'LEVEL_UP' | 'WAVE_COMPLETED' | 'DAMAGE_TAKEN';
  timestamp: number;
  data: unknown;
}