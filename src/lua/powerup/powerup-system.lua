--[[
--------------------------------------------------
道具增益系统 - Powerup System Module
Fighter Game Lua Script Module

功能概述:
- 道具类型定义和配置管理
- 增益效果应用和时长管理
- 增益堆叠和冲突处理
- 增益过期和移除逻辑
- 增益状态查询和显示

作者: Fighter Game Team
版本: 1.0.0
最后更新: 2026-07-16

注意事项:
- 使用局部模块模式，避免全局变量污染
- 所有公共函数进行参数验证
- 返回值统一使用 {success, result, error} 结构
- 避免使用 os.time()，改用传入的 deltaTime
--------------------------------------------------
]]--

local PowerupSystem = {}

PowerupSystem.VERSION = "1.0.0"
PowerupSystem.AUTHOR = "Fighter Game Team"

local PowerupType = {
  HEALTH = "health",
  SHIELD = "shield",
  SPEED = "speed",
  DAMAGE = "damage",
  TRIPLE_SHOT = "triple_shot",
  INVINCIBLE = "invincible",
  MAGNET = "magnet",
  SLOW_TIME = "slow_time"
}

local PowerupStackRule = {
  REPLACE = "replace",
  STACK = "stack",
  IGNORE = "ignore",
  EXTEND = "extend"
}

local powerupConfigs = {
  health = {
    name = "health",
    displayName = "Health",
    description = "Restores health",
    type = "instant",
    stat = "health",
    value = 25,
    duration = 0,
    stackRule = PowerupStackRule.REPLACE,
    maxStacks = 1
  },
  shield = {
    name = "shield",
    displayName = "Shield",
    description = "Grants temporary shield",
    type = "duration",
    stat = "shield",
    value = 50,
    duration = 10.0,
    stackRule = PowerupStackRule.STACK,
    maxStacks = 3
  },
  speed = {
    name = "speed",
    displayName = "Speed Boost",
    description = "Increases movement speed",
    type = "duration",
    stat = "speed",
    multiplier = 2.0,
    duration = 8.0,
    stackRule = PowerupStackRule.EXTEND,
    maxStacks = 1
  },
  damage = {
    name = "damage",
    displayName = "Damage Boost",
    description = "Increases damage output",
    type = "duration",
    stat = "damage",
    multiplier = 2.0,
    duration = 8.0,
    stackRule = PowerupStackRule.STACK,
    maxStacks = 3
  },
  triple_shot = {
    name = "triple_shot",
    displayName = "Triple Shot",
    description = "Fires three projectiles",
    type = "duration",
    stat = "projectile_count",
    multiplier = 3,
    duration = 10.0,
    stackRule = PowerupStackRule.EXTEND,
    maxStacks = 1
  },
  invincible = {
    name = "invincible",
    displayName = "Invincible",
    description = "Become immune to damage",
    type = "duration",
    stat = "invincible",
    duration = 5.0,
    stackRule = PowerupStackRule.EXTEND,
    maxStacks = 1
  },
  magnet = {
    name = "magnet",
    displayName = "Magnet",
    description = "Attracts nearby items",
    type = "duration",
    stat = "magnet_range",
    duration = 10.0,
    stackRule = PowerupStackRule.EXTEND,
    maxStacks = 1
  },
  slow_time = {
    name = "slow_time",
    displayName = "Slow Time",
    description = "Slows down game time",
    type = "duration",
    stat = "time_scale",
    multiplier = 0.5,
    duration = 5.0,
    stackRule = PowerupStackRule.REPLACE,
    maxStacks = 1
  }
}

local activePowerups = {}
local powerupIdCounter = 0

function PowerupSystem.getPowerupTypes()
  local types = {}
  for key, config in pairs(powerupConfigs) do
    types[#types + 1] = {
      name = config.name,
      displayName = config.displayName,
      description = config.description,
      type = config.type,
      duration = config.duration
    }
  end
  return { success = true, types = types }
end

function PowerupSystem.getPowerupConfig(powerupType)
  if type(powerupType) ~= "string" then
    return { success = false, error = "powerupType must be a string" }
  end

  local config = powerupConfigs[powerupType]
  if not config then
    return { success = false, error = "unknown powerup type: " .. powerupType }
  end

  return { success = true, config = config }
end

function PowerupSystem.applyPowerup(powerupType, playerState)
  if type(powerupType) ~= "string" then
    return { success = false, error = "powerupType must be a string" }
  end

  local config = powerupConfigs[powerupType]
  if not config then
    return { success = false, error = "unknown powerup type: " .. powerupType }
  end

  local effects = {}
  local appliedId = nil

  if config.type == "instant" then
    if config.value then
      effects[#effects + 1] = {
        type = powerupType,
        effectType = "add",
        stat = config.stat,
        value = config.value
      }
    end
  elseif config.type == "duration" then
    appliedId = PowerupSystem.addDurationPowerup(powerupType, config)
    if appliedId then
      effects[#effects + 1] = {
        type = powerupType,
        effectType = "multiplier",
        stat = config.stat,
        multiplier = config.multiplier,
        duration = config.duration,
        powerupId = appliedId
      }
    end
  end

  return {
    success = true,
    powerupType = powerupType,
    config = config,
    effects = effects,
    powerupId = appliedId
  }
end

function PowerupSystem.addDurationPowerup(powerupType, config)
  local existing = PowerupSystem.getActivePowerup(powerupType)
  
  if existing then
    local stackRule = config.stackRule
    
    if stackRule == PowerupStackRule.REPLACE then
      PowerupSystem.removePowerup(existing.id)
    elseif stackRule == PowerupStackRule.IGNORE then
      return nil
    elseif stackRule == PowerupStackRule.EXTEND then
      existing.duration = existing.duration + config.duration
      return existing.id
    elseif stackRule == PowerupStackRule.STACK then
      if existing.stacks >= config.maxStacks then
        return nil
      end
      existing.stacks = existing.stacks + 1
      return existing.id
    end
  end

  powerupIdCounter = powerupIdCounter + 1
  local newPowerup = {
    id = powerupIdCounter,
    type = powerupType,
    config = config,
    duration = config.duration,
    remainingDuration = config.duration,
    stacks = 1,
    multiplier = config.multiplier or 1.0,
    active = true
  }

  activePowerups[powerupIdCounter] = newPowerup
  return powerupIdCounter
end

function PowerupSystem.getActivePowerup(powerupType)
  for _, powerup in pairs(activePowerups) do
    if powerup.type == powerupType and powerup.active then
      return powerup
    end
  end
  return nil
end

function PowerupSystem.getActivePowerups()
  local result = {}
  for _, powerup in pairs(activePowerups) do
    if powerup.active then
      result[#result + 1] = {
        id = powerup.id,
        type = powerup.type,
        displayName = powerup.config.displayName,
        duration = powerup.duration,
        remainingDuration = powerup.remainingDuration,
        stacks = powerup.stacks,
        multiplier = powerup.multiplier,
        progress = powerup.remainingDuration / powerup.duration
      }
    end
  end
  return { success = true, powerups = result }
end

function PowerupSystem.update(deltaTime)
  if type(deltaTime) ~= "number" or deltaTime < 0 then
    return { success = false, error = "deltaTime must be a non-negative number" }
  end

  local expiredPowerups = {}

  for id, powerup in pairs(activePowerups) do
    if powerup.active then
      powerup.remainingDuration = powerup.remainingDuration - deltaTime

      if powerup.remainingDuration <= 0 then
        powerup.active = false
        expiredPowerups[#expiredPowerups + 1] = {
          id = powerup.id,
          type = powerup.type,
          expired = true
        }
      end
    end
  end

  return {
    success = true,
    expired = expiredPowerups,
    activeCount = PowerupSystem.getActivePowerupCount()
  }
end

function PowerupSystem.removePowerup(powerupId)
  if type(powerupId) ~= "number" or powerupId <= 0 then
    return { success = false, error = "powerupId must be a positive number" }
  end

  local powerup = activePowerups[powerupId]
  if not powerup then
    return { success = false, error = "powerup not found" }
  end

  powerup.active = false
  
  return {
    success = true,
    powerupId = powerupId,
    type = powerup.type
  }
end

function PowerupSystem.removeAllPowerups()
  for _, powerup in pairs(activePowerups) do
    powerup.active = false
  end

  return { success = true }
end

function PowerupSystem.getActivePowerupCount()
  local count = 0
  for _, powerup in pairs(activePowerups) do
    if powerup.active then
      count = count + 1
    end
  end
  return count
end

function PowerupSystem.hasActivePowerup(powerupType)
  if type(powerupType) ~= "string" then
    return { success = false, error = "powerupType must be a string" }
  end

  return { success = true, has = PowerupSystem.getActivePowerup(powerupType) ~= nil }
end

function PowerupSystem.getPowerupMultiplier(powerupType)
  if type(powerupType) ~= "string" then
    return { success = false, error = "powerupType must be a string" }
  end

  local powerup = PowerupSystem.getActivePowerup(powerupType)
  if not powerup then
    return { success = true, multiplier = 1.0 }
  end

  local baseMultiplier = powerup.multiplier or powerup.config.multiplier or 1.0
  local stackBonus = 1.0

  if powerup.config.stackRule == PowerupStackRule.STACK then
    stackBonus = 1.0 + (powerup.stacks - 1) * 0.2
  end

  return {
    success = true,
    multiplier = baseMultiplier * stackBonus,
    stacks = powerup.stacks
  }
end

function PowerupSystem.getPowerupRemainingDuration(powerupType)
  if type(powerupType) ~= "string" then
    return { success = false, error = "powerupType must be a string" }
  end

  local powerup = PowerupSystem.getActivePowerup(powerupType)
  if not powerup then
    return { success = true, remainingDuration = 0 }
  end

  return {
    success = true,
    remainingDuration = powerup.remainingDuration,
    totalDuration = powerup.duration,
    progress = powerup.remainingDuration / powerup.duration
  }
end

function PowerupSystem.generateRandomPowerup()
  local types = {}
  for key, _ in pairs(powerupConfigs) do
    types[#types + 1] = key
  end

  local randomIndex = math.random(1, #types)
  local powerupType = types[randomIndex]

  return {
    success = true,
    powerupType = powerupType,
    config = powerupConfigs[powerupType]
  }
end

function PowerupSystem.reset()
  activePowerups = {}
  powerupIdCounter = 0
  return { success = true }
end

package.preload["powerup_system_module"] = function()
  return PowerupSystem
end

return PowerupSystem