// 游戏核心类型定义
export enum GameState {
  MAIN_MENU = 'MAIN_MENU',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
}

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
  EXPERT = 'EXPERT',
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

/**
 * PlayCanvas 2.x 内建图元模型的合法 `type` 取值。
 * 与引擎 ModelComponent 的 type 选项联合完全一致。
 *
 * 为什么要有这个类型：引擎在收到非法图元名时**不报运行时错误**，只是静默不渲染
 * （例如曾经写过的 'diamond' 就不在执行联合里）。把返回值标成这个联合，
 * 非法值就会在编译期被拦住，而不是留到画面上才发现。
 */
export type PrimitiveModelType =
  'asset' | 'box' | 'capsule' | 'cone' | 'cylinder' | 'plane' | 'sphere' | 'torus';
