-- ==========================================
-- 游戏配置脚本
-- Fighter Game - Configuration
-- ==========================================

-- 游戏配置表
GameConfig = {
  -- 难度设置
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

  -- 玩家设置
  player = {
    defaultHealth = 100,
    defaultSpeed = 5.0,
    invincibilityTime = 2.0,
    maxLives = 3
  },

  -- 武器配置
  weapons = {
    basic = {
      damage = 10,
      fireRate = 0.5,
      projectileSpeed = 10.0,
      range = 100.0
    },
    rapid = {
      damage = 5,
      fireRate = 0.1,
      projectileSpeed = 12.0,
      range = 80.0
    },
    heavy = {
      damage = 50,
      fireRate = 2.0,
      projectileSpeed = 8.0,
      range = 150.0
    },
    spread = {
      damage = 8,
      fireRate = 0.3,
      projectileSpeed = 10.0,
      range = 60.0,
      bulletCount = 5
    }
  },

  -- 道具配置
  powerups = {
    health = { value = 25, duration = 0 },
    shield = { value = 50, duration = 10.0 },
    speed = { multiplier = 2.0, duration = 8.0 },
    damage = { multiplier = 2.0, duration = 8.0 },
    tripleShot = { multiplier = 3, duration = 10.0 }
  },

  -- 波次配置
  waves = {
    enemiesPerWave = 5,
    waveHealthMultiplier = 1.2,
    bossEveryNWaves = 5,
    eliteEveryNWaves = 3
  }
}

-- 获取难度配置
function getDifficultyConfig(level)
  local config = GameConfig.difficulty[level]
  if not config then
    return GameConfig.difficulty.normal
  end
  return config
end

-- 获取武器配置
function getWeaponConfig(weaponType)
  return GameConfig.weapons[weaponType]
end

-- 计算实际伤害
function calculateDamage(baseDamage, playerBonus, difficultyMultiplier)
  return math.floor(baseDamage * (1 + playerBonus) * difficultyMultiplier)
end

-- 计算分数
function calculateScore(enemyType, difficultyLevel, comboMultiplier)
  local baseScores = {
    basic = 100,
    elite = 300,
    boss = 1000
  }
  local base = baseScores[enemyType] or 100
  local diffMult = getDifficultyConfig(difficultyLevel).scoreMultiplier
  return math.floor(base * diffMult * comboMultiplier)
end

-- 检查碰撞（圆形）
function checkCircleCollision(x1, y1, r1, x2, y2, r2)
  local dx = x2 - x1
  local dy = y2 - y1
  local distance = math.sqrt(dx * dx + dy * dy)
  return distance < (r1 + r2)
end

-- 线性插值
function lerp(start, endVal, t)
  return start + (endVal - start) * t
end

-- 获取波次敌人数量
function getWaveEnemyCount(waveNumber)
  local base = GameConfig.waves.enemiesPerWave
  return math.floor(base * math.pow(1.1, waveNumber - 1))
end

-- 检查是否是 Boss 波次
function isBossWave(waveNumber)
  return waveNumber % GameConfig.waves.bossEveryNWaves == 0
end

-- 检查是否是精英波次
function isEliteWave(waveNumber)
  return waveNumber % GameConfig.waves.eliteEveryNWaves == 0
end
