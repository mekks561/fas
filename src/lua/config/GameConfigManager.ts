import { luaEngine } from '../LuaEngine';

/**
 * 游戏配置类型
 */
export interface DifficultyConfig {
  waveInterval: number;
  enemySpawnRate: number;
  enemySpeedMultiplier: number;
  scoreMultiplier: number;
}

export interface WeaponConfig {
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  range: number;
  bulletCount?: number;
}

export interface PowerupConfig {
  value?: number;
  multiplier?: number;
  duration: number;
}

export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'nightmare';
export type WeaponType = 'basic' | 'rapid' | 'heavy' | 'spread';

/**
 * 游戏配置管理器
 *
 * 使用 Lua 脚本管理游戏配置，支持热更新
 *
 * @example
 * ```typescript
 * const configManager = new GameConfigManager();
 * await configManager.initialize();
 *
 * // 获取难度配置
 * const config = configManager.getDifficultyConfig('hard');
 *
 * // 计算伤害
 * const damage = configManager.calculateDamage(100, 0.5, 1.2);
 * ```
 */
export class GameConfigManager {
  private initialized = false;

  /**
   * 初始化配置管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await luaEngine.initialize();

    // 注册配置脚本
    const configScript = await this.loadConfigScript();
    luaEngine.registerModule({
      name: 'game_config',
      script: configScript
    });

    this.initialized = true;
    console.log('[GameConfigManager] Initialized');
  }

  /**
   * 加载配置脚本
   */
  private async loadConfigScript(): Promise<string> {
    return `
GameConfig = {
  difficulty = {
    easy = {
      waveInterval = 10.0,
      enemySpawnRate = 1.0,
      enemySpeedMultiplier = 0.8,
      scoreMultiplier = 1.0
    },
    normal = {
      waveInterval = 7.0,
      enemySpawnRate = 1.5,
      enemySpeedMultiplier = 1.0,
      scoreMultiplier = 1.5
    },
    hard = {
      waveInterval = 5.0,
      enemySpawnRate = 2.0,
      enemySpeedMultiplier = 1.2,
      scoreMultiplier = 2.0
    },
    nightmare = {
      waveInterval = 3.0,
      enemySpawnRate = 3.0,
      enemySpeedMultiplier = 1.5,
      scoreMultiplier = 3.0
    }
  },
  weapons = {
    basic = { damage = 10, fireRate = 0.5, projectileSpeed = 10.0, range = 100.0 },
    rapid = { damage = 5, fireRate = 0.1, projectileSpeed = 12.0, range = 80.0 },
    heavy = { damage = 50, fireRate = 2.0, projectileSpeed = 8.0, range = 150.0 },
    spread = { damage = 8, fireRate = 0.3, projectileSpeed = 10.0, range = 60.0, bulletCount = 5 }
  },
  powerups = {
    health = { value = 25, duration = 0 },
    shield = { value = 50, duration = 10.0 },
    speed = { multiplier = 2.0, duration = 8.0 },
    damage = { multiplier = 2.0, duration = 8.0 },
    tripleShot = { multiplier = 3, duration = 10.0 }
  },
  waves = {
    enemiesPerWave = 5,
    waveHealthMultiplier = 1.2,
    bossEveryNWaves = 5,
    eliteEveryNWaves = 3
  }
}

function getDifficultyConfig(level)
  local config = GameConfig.difficulty[level]
  return config or GameConfig.difficulty.normal
end

function getWeaponConfig(weaponType)
  return GameConfig.weapons[weaponType]
end

function calculateDamage(baseDamage, playerBonus, difficultyMultiplier)
  return math.floor(baseDamage * (1 + playerBonus) * difficultyMultiplier)
end

function calculateScore(enemyType, difficultyLevel, comboMultiplier)
  local baseScores = { basic = 100, elite = 300, boss = 1000 }
  local base = baseScores[enemyType] or 100
  local diffMult = getDifficultyConfig(difficultyLevel).scoreMultiplier
  return math.floor(base * diffMult * comboMultiplier)
end

function getWaveEnemyCount(waveNumber)
  return math.floor(GameConfig.waves.enemiesPerWave * math.pow(1.1, waveNumber - 1))
end

function isBossWave(waveNumber)
  return waveNumber % GameConfig.waves.bossEveryNWaves == 0
end

function isEliteWave(waveNumber)
  return waveNumber % GameConfig.waves.eliteEveryNWaves == 0
end
    `;
  }

  /**
   * 获取难度配置
   */
  getDifficultyConfig(level: DifficultyLevel): DifficultyConfig {
    if (!this.initialized) {
      console.warn('[GameConfigManager] Not initialized');
      return { waveInterval: 7, enemySpawnRate: 1.5, enemySpeedMultiplier: 1, scoreMultiplier: 1.5 };
    }

    try {
      return luaEngine.call<DifficultyConfig>('getDifficultyConfig', level);
    } catch (error) {
      console.error('[GameConfigManager] Failed to get difficulty config:', error);
      return { waveInterval: 7, enemySpawnRate: 1.5, enemySpeedMultiplier: 1, scoreMultiplier: 1.5 };
    }
  }

  /**
   * 获取武器配置
   */
  getWeaponConfig(weaponType: WeaponType): WeaponConfig {
    if (!this.initialized) {
      console.warn('[GameConfigManager] Not initialized');
      return { damage: 10, fireRate: 0.5, projectileSpeed: 10, range: 100 };
    }

    try {
      return luaEngine.call<WeaponConfig>('getWeaponConfig', weaponType);
    } catch (error) {
      console.error('[GameConfigManager] Failed to get weapon config:', error);
      return { damage: 10, fireRate: 0.5, projectileSpeed: 10, range: 100 };
    }
  }

  /**
   * 计算伤害
   */
  calculateDamage(baseDamage: number, playerBonus: number = 0, difficultyMultiplier: number = 1): number {
    if (!this.initialized) {
      console.warn('[GameConfigManager] Not initialized');
      return baseDamage;
    }

    try {
      return luaEngine.call<number>('calculateDamage', baseDamage, playerBonus, difficultyMultiplier);
    } catch (error) {
      console.error('[GameConfigManager] Failed to calculate damage:', error);
      return baseDamage;
    }
  }

  /**
   * 计算分数
   */
  calculateScore(enemyType: string, difficultyLevel: DifficultyLevel, comboMultiplier: number = 1): number {
    if (!this.initialized) {
      console.warn('[GameConfigManager] Not initialized');
      return 100;
    }

    try {
      return luaEngine.call<number>('calculateScore', enemyType, difficultyLevel, comboMultiplier);
    } catch (error) {
      console.error('[GameConfigManager] Failed to calculate score:', error);
      return 100;
    }
  }

  /**
   * 获取波次敌人数量
   */
  getWaveEnemyCount(waveNumber: number): number {
    if (!this.initialized) return 5;

    try {
      return luaEngine.call<number>('getWaveEnemyCount', waveNumber);
    } catch {
      return 5;
    }
  }

  /**
   * 检查是否是 Boss 波次
   */
  isBossWave(waveNumber: number): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('isBossWave', waveNumber);
    } catch {
      return false;
    }
  }

  /**
   * 检查是否是精英波次
   */
  isEliteWave(waveNumber: number): boolean {
    if (!this.initialized) return false;

    try {
      return luaEngine.call<boolean>('isEliteWave', waveNumber);
    } catch {
      return false;
    }
  }

  /**
   * 重新加载配置（热更新）
   */
  async reloadConfig(): Promise<void> {
    console.log('[GameConfigManager] Reloading config...');
    const newScript = await this.loadConfigScript();
    luaEngine.registerModule({
      name: 'game_config',
      script: newScript
    });
    console.log('[GameConfigManager] Config reloaded');
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.initialized = false;
    console.log('[GameConfigManager] Destroyed');
  }
}

// 导出单例
export const gameConfigManager = new GameConfigManager();
