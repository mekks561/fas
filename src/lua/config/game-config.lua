--[[
--------------------------------------------------
游戏配置模块 - Game Configuration Module
Fighter Game Lua Script Module

功能概述:
- 游戏难度配置管理
- 玩家属性配置
- 武器参数配置
- 道具配置管理
- 波次规则配置
- 辅助计算函数（伤害、分数、碰撞检测）

作者: Fighter Game Team
版本: 2.0.0
最后更新: 2026-07-14

注意事项:
- 本模块使用局部变量模式，避免全局命名空间污染
- 所有公共函数均进行参数验证
- 返回值统一使用 table 结构，包含 success 字段
--------------------------------------------------
]]--

local GameConfig = {}

-- 版本信息
GameConfig.VERSION = "2.0.0"
GameConfig.AUTHOR = "Fighter Game Team"

-- 配置数据
local configData = {
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

  player = {
    defaultHealth = 100,
    defaultSpeed = 5.0,
    invincibilityTime = 2.0,
    maxLives = 3
  },

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

--[[
获取难度配置
@param level: string - 难度级别 (easy/normal/hard/nightmare)
@return: table - { success, config, error }
]]--
function GameConfig.getDifficultyConfig(level)
  if type(level) ~= "string" then
    return { success = false, error = "level must be a string" }
  end

  local config = configData.difficulty[level]
  if not config then
    return { success = true, config = configData.difficulty.normal }
  end

  return { success = true, config = config }
end

--[[
获取武器配置
@param weaponType: string - 武器类型
@return: table - { success, config, error }
]]--
function GameConfig.getWeaponConfig(weaponType)
  if type(weaponType) ~= "string" then
    return { success = false, error = "weaponType must be a string" }
  end

  local config = configData.weapons[weaponType]
  if not config then
    return { success = false, error = "unknown weapon type: " .. weaponType }
  end

  return { success = true, config = config }
end

--[[
获取玩家配置
@return: table - { success, config }
]]--
function GameConfig.getPlayerConfig()
  return { success = true, config = configData.player }
end

--[[
获取道具配置
@param powerupType: string - 道具类型 (可选)
@return: table - { success, config, error }
]]--
function GameConfig.getPowerupConfig(powerupType)
  if not powerupType then
    return { success = true, config = configData.powerups }
  end

  if type(powerupType) ~= "string" then
    return { success = false, error = "powerupType must be a string" }
  end

  local config = configData.powerups[powerupType]
  if not config then
    return { success = false, error = "unknown powerup type: " .. powerupType }
  end

  return { success = true, config = config }
end

--[[
获取波次配置
@return: table - { success, config }
]]--
function GameConfig.getWaveConfig()
  return { success = true, config = configData.waves }
end

--[[
计算实际伤害
@param baseDamage: number - 基础伤害
@param playerBonus: number - 玩家加成 (0-1之间的小数)
@param difficultyMultiplier: number - 难度系数
@return: table - { success, damage, error }
]]--
function GameConfig.calculateDamage(baseDamage, playerBonus, difficultyMultiplier)
  if type(baseDamage) ~= "number" or baseDamage < 0 then
    return { success = false, error = "baseDamage must be a non-negative number" }
  end

  if type(playerBonus) ~= "number" then
    playerBonus = 0
  end

  if type(difficultyMultiplier) ~= "number" or difficultyMultiplier <= 0 then
    difficultyMultiplier = 1.0
  end

  local damage = math.floor(baseDamage * (1 + playerBonus) * difficultyMultiplier)
  return { success = true, damage = damage }
end

--[[
计算分数
@param enemyType: string - 敌人类型 (basic/elite/boss)
@param difficultyLevel: string - 难度级别
@param comboMultiplier: number - 连击系数
@return: table - { success, score, error }
]]--
function GameConfig.calculateScore(enemyType, difficultyLevel, comboMultiplier)
  if type(enemyType) ~= "string" then
    return { success = false, error = "enemyType must be a string" }
  end

  local baseScores = {
    basic = 100,
    elite = 300,
    boss = 1000
  }
  local base = baseScores[enemyType] or 100

  local diffResult = GameConfig.getDifficultyConfig(difficultyLevel)
  if not diffResult.success then
    return diffResult
  end

  if type(comboMultiplier) ~= "number" or comboMultiplier <= 0 then
    comboMultiplier = 1.0
  end

  local score = math.floor(base * diffResult.config.scoreMultiplier * comboMultiplier)
  return { success = true, score = score }
end

--[[
检查圆形碰撞
@param x1, y1: number - 第一个圆的坐标
@param r1: number - 第一个圆的半径
@param x2, y2: number - 第二个圆的坐标
@param r2: number - 第二个圆的半径
@return: table - { success, collided, error }
]]--
function GameConfig.checkCircleCollision(x1, y1, r1, x2, y2, r2)
  if type(x1) ~= "number" or type(y1) ~= "number" or type(r1) ~= "number" then
    return { success = false, error = "x1, y1, r1 must be numbers" }
  end

  if type(x2) ~= "number" or type(y2) ~= "number" or type(r2) ~= "number" then
    return { success = false, error = "x2, y2, r2 must be numbers" }
  end

  if r1 <= 0 or r2 <= 0 then
    return { success = false, error = "radii must be positive" }
  end

  local dx = x2 - x1
  local dy = y2 - y1
  local distance = math.sqrt(dx * dx + dy * dy)
  return { success = true, collided = distance < (r1 + r2) }
end

--[[
线性插值
@param start: number - 起始值
@param endVal: number - 结束值
@param t: number - 插值因子 (0-1)
@return: table - { success, value, error }
]]--
function GameConfig.lerp(start, endVal, t)
  if type(start) ~= "number" then
    return { success = false, error = "start must be a number" }
  end

  if type(endVal) ~= "number" then
    return { success = false, error = "endVal must be a number" }
  end

  if type(t) ~= "number" then
    t = 0
  end

  t = math.max(0, math.min(1, t))
  return { success = true, value = start + (endVal - start) * t }
end

--[[
获取波次敌人数量
@param waveNumber: number - 波次编号
@return: table - { success, count, error }
]]--
function GameConfig.getWaveEnemyCount(waveNumber)
  if type(waveNumber) ~= "number" or waveNumber < 1 then
    return { success = false, error = "waveNumber must be a positive integer" }
  end

  local base = configData.waves.enemiesPerWave
  local count = math.floor(base * math.pow(1.1, waveNumber - 1))
  return { success = true, count = count }
end

--[[
检查是否是 Boss 波次
@param waveNumber: number - 波次编号
@return: table - { success, isBoss, error }
]]--
function GameConfig.isBossWave(waveNumber)
  if type(waveNumber) ~= "number" or waveNumber < 1 then
    return { success = false, error = "waveNumber must be a positive integer" }
  end

  return { success = true, isBoss = waveNumber % configData.waves.bossEveryNWaves == 0 }
end

--[[
检查是否是精英波次
@param waveNumber: number - 波次编号
@return: table - { success, isElite, error }
]]--
function GameConfig.isEliteWave(waveNumber)
  if type(waveNumber) ~= "number" or waveNumber < 1 then
    return { success = false, error = "waveNumber must be a positive integer" }
  end

  return { success = true, isElite = waveNumber % configData.waves.eliteEveryNWaves == 0 }
end

--[[
获取完整配置数据（调试用）
@return: table - configData 的深拷贝
]]--
function GameConfig.getFullConfig()
  local copy = {}
  for key, value in pairs(configData) do
    if type(value) == "table" then
      copy[key] = {}
      for k, v in pairs(value) do
        if type(v) == "table" then
          copy[key][k] = {}
          for sk, sv in pairs(v) do
            copy[key][k][sk] = sv
          end
        else
          copy[key][k] = v
        end
      end
    else
      copy[key] = value
    end
  end
  return copy
end

return GameConfig