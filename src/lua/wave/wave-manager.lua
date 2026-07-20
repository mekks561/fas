--[[
--------------------------------------------------
波次管理模块 - Wave Manager Module
Fighter Game Lua Script Module

功能概述:
- 波次状态管理（准备、进行中、暂停、完成）
- 敌人生成配置和数量计算
- Boss和精英波次触发逻辑
- 难度曲线和敌人属性递增
- 波次进度追踪

作者: Fighter Game Team
版本: 1.0.0
最后更新: 2026-07-16

注意事项:
- 使用局部模块模式，避免全局变量污染
- 所有公共函数进行参数验证
- 返回值统一使用 {success, result, error} 结构
- 复用 utils.lua 和 game-config.lua 的工具函数
--------------------------------------------------
]]--

local WaveManager = {}

WaveManager.VERSION = "1.0.0"
WaveManager.AUTHOR = "Fighter Game Team"

local WaveState = {
  WAITING = "waiting",
  ACTIVE = "active",
  PAUSED = "paused",
  COMPLETED = "completed",
  FAILED = "failed"
}

local currentState = {
  waveNumber = 1,
  maxWaves = 10,
  state = WaveState.WAITING,
  enemiesSpawned = 0,
  enemiesDefeated = 0,
  enemiesRemaining = 0,
  waveStartTime = 0,
  elapsedTime = 0,
  difficulty = "normal",
  isBossWave = false,
  isEliteWave = false,
  spawnedEnemyTypes = {}
}

local difficultyMultipliers = {
  easy = { health = 0.8, damage = 0.8, speed = 0.8, count = 0.8 },
  normal = { health = 1.0, damage = 1.0, speed = 1.0, count = 1.0 },
  hard = { health = 1.2, damage = 1.2, speed = 1.1, count = 1.2 },
  nightmare = { health = 1.5, damage = 1.5, speed = 1.3, count = 1.5 }
}

local enemyTemplates = {
  basic = { type = "basic", health = 50, damage = 10, speed = 2.0, score = 100 },
  fast = { type = "fast", health = 30, damage = 8, speed = 4.0, score = 150 },
  tank = { type = "tank", health = 100, damage = 15, speed = 1.0, score = 250 },
  shooter = { type = "shooter", health = 40, damage = 12, speed = 1.5, score = 200 },
  elite = { type = "elite", health = 200, damage = 25, speed = 2.5, score = 500 },
  boss = { type = "boss", health = 1000, damage = 30, speed = 1.5, score = 2000 }
}

function WaveManager.getWaveState()
  return {
    success = true,
    state = {
      waveNumber = currentState.waveNumber,
      maxWaves = currentState.maxWaves,
      currentState = currentState.state,
      enemiesSpawned = currentState.enemiesSpawned,
      enemiesDefeated = currentState.enemiesDefeated,
      enemiesRemaining = currentState.enemiesRemaining,
      elapsedTime = currentState.elapsedTime,
      difficulty = currentState.difficulty,
      isBossWave = currentState.isBossWave,
      isEliteWave = currentState.isEliteWave,
      progress = WaveManager.calculateProgress()
    }
  }
end

function WaveManager.setDifficulty(difficulty)
  if type(difficulty) ~= "string" then
    return { success = false, error = "difficulty must be a string" }
  end

  local validDifficulties = { easy = true, normal = true, hard = true, nightmare = true }
  if not validDifficulties[difficulty] then
    return { success = false, error = "invalid difficulty: " .. difficulty }
  end

  currentState.difficulty = difficulty
  return { success = true }
end

function WaveManager.setMaxWaves(maxWaves)
  if type(maxWaves) ~= "number" or maxWaves < 1 then
    return { success = false, error = "maxWaves must be a positive integer" }
  end

  currentState.maxWaves = math.floor(maxWaves)
  return { success = true }
end

function WaveManager.calculateEnemyCount(waveNumber)
  if type(waveNumber) ~= "number" or waveNumber < 1 then
    return { success = false, error = "waveNumber must be a positive integer" }
  end

  local baseCount = 5
  local growthFactor = 1.1
  local difficultyMult = difficultyMultipliers[currentState.difficulty].count

  local count = math.floor(baseCount * math.pow(growthFactor, waveNumber - 1) * difficultyMult)
  
  if WaveManager.isBossWave(waveNumber) then
    count = math.max(1, math.floor(count * 0.3))
  elseif WaveManager.isEliteWave(waveNumber) then
    count = math.floor(count * 0.8)
  end

  return { success = true, count = count }
end

function WaveManager.isBossWave(waveNumber)
  if type(waveNumber) ~= "number" or waveNumber < 1 then
    return { success = false, error = "waveNumber must be a positive integer" }
  end

  return { success = true, isBoss = waveNumber % 5 == 0 }
end

function WaveManager.isEliteWave(waveNumber)
  if type(waveNumber) ~= "number" or waveNumber < 1 then
    return { success = false, error = "waveNumber must be a positive integer" }
  end

  if WaveManager.isBossWave(waveNumber).isBoss then
    return { success = true, isElite = false }
  end

  return { success = true, isElite = waveNumber % 3 == 0 }
end

function WaveManager.generateEnemyTypes(waveNumber)
  if type(waveNumber) ~= "number" or waveNumber < 1 then
    return { success = false, error = "waveNumber must be a positive integer" }
  end

  local enemyTypes = {}
  local isBoss = WaveManager.isBossWave(waveNumber).isBoss
  local isElite = WaveManager.isEliteWave(waveNumber).isElite

  if isBoss then
    enemyTypes[#enemyTypes + 1] = "boss"
  else
    local availableTypes = { "basic" }
    
    if waveNumber >= 2 then
      availableTypes[#availableTypes + 1] = "fast"
    end
    if waveNumber >= 3 then
      availableTypes[#availableTypes + 1] = "shooter"
    end
    if waveNumber >= 4 then
      availableTypes[#availableTypes + 1] = "tank"
    end
    if isElite then
      availableTypes[#availableTypes + 1] = "elite"
    end

    local countResult = WaveManager.calculateEnemyCount(waveNumber)
    if not countResult.success then
      return countResult
    end

    local count = countResult.count
    for i = 1, count do
      local randomIndex = math.random(1, #availableTypes)
      enemyTypes[#enemyTypes + 1] = availableTypes[randomIndex]
    end
  end

  return { success = true, enemyTypes = enemyTypes }
end

function WaveManager.getEnemyConfig(enemyType)
  if type(enemyType) ~= "string" then
    return { success = false, error = "enemyType must be a string" }
  end

  local template = enemyTemplates[enemyType]
  if not template then
    return { success = false, error = "unknown enemy type: " .. enemyType }
  end

  local waveMult = math.pow(1.15, currentState.waveNumber - 1)
  local diffMult = difficultyMultipliers[currentState.difficulty]

  return {
    success = true,
    config = {
      type = template.type,
      health = math.floor(template.health * waveMult * diffMult.health),
      damage = math.floor(template.damage * waveMult * diffMult.damage),
      speed = template.speed * diffMult.speed,
      score = math.floor(template.score * waveMult),
      isBoss = enemyType == "boss",
      isElite = enemyType == "elite"
    }
  }
end

function WaveManager.startWave(waveNumber)
  if type(waveNumber) ~= "number" or waveNumber < 1 then
    return { success = false, error = "waveNumber must be a positive integer" }
  end

  if waveNumber > currentState.maxWaves then
    return { success = false, error = "waveNumber exceeds maxWaves" }
  end

  local enemyTypesResult = WaveManager.generateEnemyTypes(waveNumber)
  if not enemyTypesResult.success then
    return enemyTypesResult
  end

  currentState.waveNumber = waveNumber
  currentState.state = WaveState.ACTIVE
  currentState.enemiesSpawned = 0
  currentState.enemiesDefeated = 0
  currentState.enemiesRemaining = #enemyTypesResult.enemyTypes
  currentState.waveStartTime = 0
  currentState.elapsedTime = 0
  currentState.isBossWave = WaveManager.isBossWave(waveNumber).isBoss
  currentState.isEliteWave = WaveManager.isEliteWave(waveNumber).isElite
  currentState.spawnedEnemyTypes = enemyTypesResult.enemyTypes

  return {
    success = true,
    waveNumber = waveNumber,
    enemyCount = currentState.enemiesRemaining,
    isBossWave = currentState.isBossWave,
    isEliteWave = currentState.isEliteWave,
    enemyTypes = currentState.spawnedEnemyTypes
  }
end

function WaveManager.spawnNextEnemy()
  if currentState.state ~= WaveState.ACTIVE then
    return { success = false, error = "wave is not active" }
  end

  if currentState.enemiesSpawned >= #currentState.spawnedEnemyTypes then
    return { success = false, error = "no more enemies to spawn" }
  end

  currentState.enemiesSpawned = currentState.enemiesSpawned + 1
  local enemyType = currentState.spawnedEnemyTypes[currentState.enemiesSpawned]
  
  local configResult = WaveManager.getEnemyConfig(enemyType)
  if not configResult.success then
    return configResult
  end

  return {
    success = true,
    enemy = configResult.config,
    spawnIndex = currentState.enemiesSpawned,
    totalToSpawn = #currentState.spawnedEnemyTypes
  }
end

function WaveManager.onEnemyDefeated(enemyType)
  if currentState.state ~= WaveState.ACTIVE then
    return { success = false, error = "wave is not active" }
  end

  currentState.enemiesDefeated = currentState.enemiesDefeated + 1
  currentState.enemiesRemaining = currentState.enemiesRemaining - 1

  if currentState.enemiesRemaining <= 0 then
    WaveManager.completeWave()
  end

  return {
    success = true,
    enemiesDefeated = currentState.enemiesDefeated,
    enemiesRemaining = currentState.enemiesRemaining,
    isWaveComplete = currentState.enemiesRemaining <= 0,
    score = enemyTemplates[enemyType] and enemyTemplates[enemyType].score or 100
  }
end

function WaveManager.completeWave()
  currentState.state = WaveState.COMPLETED

  return {
    success = true,
    waveNumber = currentState.waveNumber,
    enemiesDefeated = currentState.enemiesDefeated,
    elapsedTime = currentState.elapsedTime,
    isLastWave = currentState.waveNumber >= currentState.maxWaves
  }
end

function WaveManager.failWave()
  currentState.state = WaveState.FAILED

  return {
    success = true,
    waveNumber = currentState.waveNumber,
    enemiesRemaining = currentState.enemiesRemaining
  }
end

function WaveManager.pauseWave()
  if currentState.state ~= WaveState.ACTIVE then
    return { success = false, error = "wave is not active" }
  end

  currentState.state = WaveState.PAUSED
  return { success = true }
end

function WaveManager.resumeWave()
  if currentState.state ~= WaveState.PAUSED then
    return { success = false, error = "wave is not paused" }
  end

  currentState.state = WaveState.ACTIVE
  return { success = true }
end

function WaveManager.update(deltaTime)
  if type(deltaTime) ~= "number" or deltaTime < 0 then
    return { success = false, error = "deltaTime must be a non-negative number" }
  end

  if currentState.state == WaveState.ACTIVE then
    currentState.elapsedTime = currentState.elapsedTime + deltaTime
  end

  return {
    success = true,
    elapsedTime = currentState.elapsedTime,
    state = currentState.state,
    enemiesRemaining = currentState.enemiesRemaining
  }
end

function WaveManager.calculateProgress()
  if currentState.enemiesDefeated + currentState.enemiesRemaining == 0 then
    return 0
  end

  return (currentState.enemiesDefeated) / (currentState.enemiesDefeated + currentState.enemiesRemaining)
end

function WaveManager.reset()
  currentState = {
    waveNumber = 1,
    maxWaves = 10,
    state = WaveState.WAITING,
    enemiesSpawned = 0,
    enemiesDefeated = 0,
    enemiesRemaining = 0,
    waveStartTime = 0,
    elapsedTime = 0,
    difficulty = "normal",
    isBossWave = false,
    isEliteWave = false,
    spawnedEnemyTypes = {}
  }

  return { success = true }
end

function WaveManager.getNextWaveNumber()
  local nextWave = currentState.waveNumber + 1
  if nextWave > currentState.maxWaves then
    return { success = false, error = "no more waves" }
  end

  return { success = true, waveNumber = nextWave }
end

function WaveManager.getWaveScoreMultiplier()
  local baseMult = 1.0
  local waveBonus = currentState.waveNumber * 0.1
  local difficultyBonus = { easy = 0.5, normal = 1.0, hard = 1.5, nightmare = 2.0 }

  return {
    success = true,
    multiplier = baseMult + waveBonus + difficultyBonus[currentState.difficulty]
  }
end

package.preload["wave_manager_module"] = function()
  return WaveManager
end

return WaveManager