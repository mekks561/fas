--[[
--------------------------------------------------
战斗统计系统 - Combat Stats Module
Fighter Game Lua Script Module

功能概述:
- 击杀统计和连击追踪
- 伤害统计（造成/承受）
- 技能使用统计
- 道具收集统计
- 战斗评分和评级计算
- 统计数据查询和重置

作者: Fighter Game Team
版本: 1.0.0
最后更新: 2026-07-16

注意事项:
- 使用局部模块模式，避免全局变量污染
- 所有公共函数进行参数验证
- 返回值统一使用 {success, result, error} 结构
- 避免使用 os.time()，改用传入的时间戳
--------------------------------------------------
]]--

local CombatStats = {}

CombatStats.VERSION = "1.0.0"
CombatStats.AUTHOR = "Fighter Game Team"

local stats = {
  kills = 0,
  deaths = 0,
  damageDealt = 0,
  damageTaken = 0,
  damageHealed = 0,
  skillsUsed = 0,
  skillsHit = 0,
  powerupsCollected = 0,
  projectilesFired = 0,
  projectilesHit = 0,
  comboMax = 0,
  comboCurrent = 0,
  comboTotal = 0,
  accuracy = 0,
  playTime = 0,
  enemiesDefeated = {},
  skillsUsedBreakdown = {},
  wavesCompleted = 0,
  bossesKilled = 0,
  elitesKilled = 0,
  score = 0,
  rank = "D"
}

local comboTimer = 0.0
local comboTimeout = 2.0

local rankThresholds = {
  S = 10000,
  A = 5000,
  B = 2500,
  C = 1000,
  D = 0
}

function CombatStats.getStats()
  return {
    success = true,
    stats = {
      kills = stats.kills,
      deaths = stats.deaths,
      damageDealt = stats.damageDealt,
      damageTaken = stats.damageTaken,
      damageHealed = stats.damageHealed,
      skillsUsed = stats.skillsUsed,
      skillsHit = stats.skillsHit,
      powerupsCollected = stats.powerupsCollected,
      projectilesFired = stats.projectilesFired,
      projectilesHit = stats.projectilesHit,
      comboMax = stats.comboMax,
      comboCurrent = stats.comboCurrent,
      comboTotal = stats.comboTotal,
      accuracy = stats.accuracy,
      playTime = stats.playTime,
      wavesCompleted = stats.wavesCompleted,
      bossesKilled = stats.bossesKilled,
      elitesKilled = stats.elitesKilled,
      score = stats.score,
      rank = stats.rank,
      enemiesDefeated = stats.enemiesDefeated,
      skillsUsedBreakdown = stats.skillsUsedBreakdown
    }
  }
end

function CombatStats.onKill(enemyType, isBoss, isElite)
  if type(enemyType) ~= "string" then
    return { success = false, error = "enemyType must be a string" }
  end

  stats.kills = stats.kills + 1

  if isBoss then
    stats.bossesKilled = stats.bossesKilled + 1
  elseif isElite then
    stats.elitesKilled = stats.elitesKilled + 1
  end

  stats.enemiesDefeated[enemyType] = (stats.enemiesDefeated[enemyType] or 0) + 1

  CombatStats.incrementCombo()

  return {
    success = true,
    kills = stats.kills,
    comboCurrent = stats.comboCurrent,
    comboMax = stats.comboMax
  }
end

function CombatStats.onDeath()
  stats.deaths = stats.deaths + 1
  CombatStats.resetCombo()

  return { success = true, deaths = stats.deaths }
end

function CombatStats.addDamageDealt(damage)
  if type(damage) ~= "number" or damage < 0 then
    return { success = false, error = "damage must be a non-negative number" }
  end

  stats.damageDealt = stats.damageDealt + math.floor(damage)

  return { success = true, damageDealt = stats.damageDealt }
end

function CombatStats.addDamageTaken(damage)
  if type(damage) ~= "number" or damage < 0 then
    return { success = false, error = "damage must be a non-negative number" }
  end

  stats.damageTaken = stats.damageTaken + math.floor(damage)

  return { success = true, damageTaken = stats.damageTaken }
end

function CombatStats.addDamageHealed(healAmount)
  if type(healAmount) ~= "number" or healAmount < 0 then
    return { success = false, error = "healAmount must be a non-negative number" }
  end

  stats.damageHealed = stats.damageHealed + math.floor(healAmount)

  return { success = true, damageHealed = stats.damageHealed }
end

function CombatStats.onSkillUse(skillId, hit)
  if type(skillId) ~= "string" then
    return { success = false, error = "skillId must be a string" }
  end

  stats.skillsUsed = stats.skillsUsed + 1
  stats.skillsUsedBreakdown[skillId] = (stats.skillsUsedBreakdown[skillId] or 0) + 1

  if hit then
    stats.skillsHit = stats.skillsHit + 1
  end

  CombatStats.updateAccuracy()

  return {
    success = true,
    skillsUsed = stats.skillsUsed,
    skillsHit = stats.skillsHit,
    accuracy = stats.accuracy
  }
end

function CombatStats.onPowerupCollected(powerupType)
  if type(powerupType) ~= "string" then
    return { success = false, error = "powerupType must be a string" }
  end

  stats.powerupsCollected = stats.powerupsCollected + 1

  return { success = true, powerupsCollected = stats.powerupsCollected }
end

function CombatStats.onProjectileFired()
  stats.projectilesFired = stats.projectilesFired + 1
  CombatStats.updateAccuracy()

  return { success = true, projectilesFired = stats.projectilesFired }
end

function CombatStats.onProjectileHit()
  stats.projectilesHit = stats.projectilesHit + 1
  CombatStats.updateAccuracy()

  return { success = true, projectilesHit = stats.projectilesHit }
end

function CombatStats.incrementCombo()
  stats.comboCurrent = stats.comboCurrent + 1
  stats.comboTotal = stats.comboTotal + 1

  if stats.comboCurrent > stats.comboMax then
    stats.comboMax = stats.comboCurrent
  end

  comboTimer = comboTimeout

  return {
    success = true,
    comboCurrent = stats.comboCurrent,
    comboMax = stats.comboMax
  }
end

function CombatStats.resetCombo()
  stats.comboCurrent = 0
  comboTimer = 0.0

  return { success = true, comboCurrent = 0 }
end

function CombatStats.updateCombo(deltaTime)
  if type(deltaTime) ~= "number" or deltaTime < 0 then
    return { success = false, error = "deltaTime must be a non-negative number" }
  end

  local currentCombo = stats.comboCurrent
  if currentCombo > 0 then
    comboTimer = comboTimer - deltaTime

    if comboTimer <= 0 then
      CombatStats.resetCombo()
    end
  end

  return {
    success = true,
    comboCurrent = stats.comboCurrent,
    comboTimer = comboTimer,
    comboTimeout = comboTimeout
  }
end

function CombatStats.updateAccuracy()
  local totalShots = stats.projectilesFired + stats.skillsUsed
  if totalShots == 0 then
    stats.accuracy = 0
    return
  end

  local totalHits = stats.projectilesHit + stats.skillsHit
  stats.accuracy = math.floor((totalHits / totalShots) * 100)
end

function CombatStats.addScore(points)
  if type(points) ~= "number" then
    return { success = false, error = "points must be a number" }
  end

  stats.score = stats.score + math.floor(points)
  CombatStats.calculateRank()

  return { success = true, score = stats.score, rank = stats.rank }
end

function CombatStats.calculateRank()
  local currentScore = stats.score

  if currentScore >= rankThresholds.S then
    stats.rank = "S"
  elseif currentScore >= rankThresholds.A then
    stats.rank = "A"
  elseif currentScore >= rankThresholds.B then
    stats.rank = "B"
  elseif currentScore >= rankThresholds.C then
    stats.rank = "C"
  else
    stats.rank = "D"
  end

  return { success = true, rank = stats.rank }
end

function CombatStats.updatePlayTime(deltaTime)
  if type(deltaTime) ~= "number" or deltaTime < 0 then
    return { success = false, error = "deltaTime must be a non-negative number" }
  end

  stats.playTime = stats.playTime + deltaTime

  return { success = true, playTime = stats.playTime }
end

function CombatStats.onWaveCompleted(waveNumber)
  if type(waveNumber) ~= "number" or waveNumber < 1 then
    return { success = false, error = "waveNumber must be a positive integer" }
  end

  stats.wavesCompleted = stats.wavesCompleted + 1

  return { success = true, wavesCompleted = stats.wavesCompleted }
end

function CombatStats.getComboMultiplier()
  local currentCombo = stats.comboCurrent
  if currentCombo <= 1 then
    return { success = true, multiplier = 1.0 }
  elseif currentCombo <= 5 then
    return { success = true, multiplier = 1.5 }
  elseif currentCombo <= 10 then
    return { success = true, multiplier = 2.0 }
  elseif currentCombo <= 20 then
    return { success = true, multiplier = 3.0 }
  else
    return { success = true, multiplier = 5.0 }
  end
end

function CombatStats.getEfficiency()
  local efficiency = 0

  local currentPlayTime = stats.playTime
  if currentPlayTime > 0 then
    efficiency = math.floor(stats.damageDealt / currentPlayTime)
  end

  return { success = true, efficiency = efficiency }
end

function CombatStats.getSurvivalRate()
  local total = stats.kills + stats.deaths
  if total == 0 then
    return { success = true, rate = 0 }
  end

  local rate = (stats.kills / total) * 100
  return { success = true, rate = math.floor(rate) }
end

function CombatStats.calculateFinalScore()
  local baseScore = stats.score
  local comboBonus = stats.comboMax * 50
  local accuracyBonus = stats.accuracy * 10

  local efficiencyResult = CombatStats.getEfficiency()
  local efficiencyBonus = efficiencyResult.success and efficiencyResult.efficiency * 2 or 0

  local survivalResult = CombatStats.getSurvivalRate()
  local survivalBonus = survivalResult.success and survivalResult.rate * 10 or 0

  local finalScore = baseScore + comboBonus + accuracyBonus + efficiencyBonus + survivalBonus

  return {
    success = true,
    finalScore = finalScore,
    breakdown = {
      baseScore = baseScore,
      comboBonus = comboBonus,
      accuracyBonus = accuracyBonus,
      efficiencyBonus = efficiencyBonus,
      survivalBonus = survivalBonus
    }
  }
end

function CombatStats.reset()
  stats = {
    kills = 0,
    deaths = 0,
    damageDealt = 0,
    damageTaken = 0,
    damageHealed = 0,
    skillsUsed = 0,
    skillsHit = 0,
    powerupsCollected = 0,
    projectilesFired = 0,
    projectilesHit = 0,
    comboMax = 0,
    comboCurrent = 0,
    comboTotal = 0,
    accuracy = 0,
    playTime = 0,
    enemiesDefeated = {},
    skillsUsedBreakdown = {},
    wavesCompleted = 0,
    bossesKilled = 0,
    elitesKilled = 0,
    score = 0,
    rank = "D"
  }

  comboTimer = 0.0

  return { success = true }
end

function CombatStats.getRankThresholds()
  return { success = true, thresholds = rankThresholds }
end

if package and package.preload then
  package.preload["combat_stats_module"] = function()
    return CombatStats
  end
end

return CombatStats