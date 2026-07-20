--[[
--------------------------------------------------
敌人 AI 行为模块 - Enemy AI Behavior Module
Fighter Game Lua Script Module

功能概述:
- 敌人 AI 类型定义和配置
- AI 状态机管理（巡逻、追击、远程、混合）
- 行为更新逻辑
- 伤害计算和命中检测

作者: Fighter Game Team
版本: 2.0.0
最后更新: 2026-07-14

注意事项:
- 本模块使用局部变量模式，避免全局命名空间污染
- 所有公共函数均进行参数验证
- 返回值统一使用 table 结构，包含 success 字段
- 性能优化：使用局部变量缓存常用属性，避免重复查找
--------------------------------------------------
]]--

local EnemyAI = {}

-- 版本信息
EnemyAI.VERSION = "2.0.0"
EnemyAI.AUTHOR = "Fighter Game Team"

-- AI 类型配置（局部变量，避免全局污染）
local aiTypes = {
  PATROL = {
    name = "patrol",
    speed = 2.0,
    detectRange = 10.0,
    damage = 5.0,
    health = 50.0,
    behavior = "patrol"
  },
  AGGRESSIVE = {
    name = "aggressive",
    speed = 4.0,
    detectRange = 20.0,
    damage = 10.0,
    health = 80.0,
    behavior = "chase"
  },
  SNIPER = {
    name = "sniper",
    speed = 1.0,
    detectRange = 30.0,
    damage = 20.0,
    health = 30.0,
    behavior = "ranged"
  },
  BOSS = {
    name = "boss",
    speed = 3.0,
    detectRange = 25.0,
    damage = 15.0,
    health = 500.0,
    behavior = "mixed"
  }
}

--[[
获取 AI 类型配置
@param typeName: string - AI 类型名称
@return: table - { success, config, error }
]]--
function EnemyAI.getAIType(typeName)
  if type(typeName) ~= "string" then
    return { success = false, error = "typeName must be a string" }
  end

  local config = aiTypes[typeName]
  if not config then
    return { success = false, error = "unknown AI type: " .. typeName }
  end

  return { success = true, config = config }
end

--[[
获取所有 AI 类型配置
@return: table - AI 类型配置列表
]]--
function EnemyAI.getAllAITypes()
  local types = {}
  for key, value in pairs(aiTypes) do
    types[key] = value
  end
  return types
end

--[[
创建敌人 AI 实例
@param typeName: string - AI 类型名称
@param x: number - 初始 X 坐标
@param y: number - 初始 Y 坐标
@return: table - { success, enemy, error }
]]--
function EnemyAI.createEnemyAI(typeName, x, y)
  -- 参数验证
  if type(typeName) ~= "string" then
    return { success = false, error = "typeName must be a string" }
  end

  if type(x) ~= "number" then
    x = 0
  end

  if type(y) ~= "number" then
    y = 0
  end

  local config = aiTypes[typeName]
  if not config then
    return { success = false, error = "unknown AI type: " .. typeName }
  end

  -- 创建实例
  local enemy = {
    type = config.name,
    x = x,
    y = y,
    speed = config.speed,
    detectRange = config.detectRange,
    damage = config.damage,
    health = config.health,
    maxHealth = config.health,
    behavior = config.behavior,
    state = "idle",
    targetX = x,
    targetY = y,
    attackCooldown = 0,
    patrolTimer = 0,
    lastActionTime = 0
  }

  return { success = true, enemy = enemy }
end

--[[
更新 AI 行为
@param enemy: table - 敌人 AI 实例
@param playerX: number - 玩家 X 坐标
@param playerY: number - 玩家 Y 坐标
@param deltaTime: number - 时间步长（秒）
@return: table - { success, enemy, action, error }
]]--
function EnemyAI.updateAI(enemy, playerX, playerY, deltaTime)
  -- 参数验证
  if type(enemy) ~= "table" then
    return { success = false, error = "enemy must be a table" }
  end

  if type(playerX) ~= "number" then
    return { success = false, error = "playerX must be a number" }
  end

  if type(playerY) ~= "number" then
    return { success = false, error = "playerY must be a number" }
  end

  if type(deltaTime) ~= "number" or deltaTime < 0 then
    return { success = false, error = "deltaTime must be a non-negative number" }
  end

  -- 性能优化：缓存局部变量
  local dx = playerX - enemy.x
  local dy = playerY - enemy.y
  local distance = math.sqrt(dx * dx + dy * dy)

  -- 状态机：根据行为类型执行不同逻辑
  local action = nil

  if enemy.behavior == "patrol" then
    action = EnemyAI.updatePatrol(enemy, deltaTime)
  elseif enemy.behavior == "chase" then
    action = EnemyAI.updateChase(enemy, dx, dy, distance, deltaTime)
  elseif enemy.behavior == "ranged" then
    action = EnemyAI.updateRanged(enemy, dx, dy, distance, deltaTime)
  elseif enemy.behavior == "mixed" then
    action = EnemyAI.updateMixed(enemy, dx, dy, distance, deltaTime)
  else
    return { success = false, error = "unknown behavior type: " .. tostring(enemy.behavior) }
  end

  -- 更新冷却时间
  if enemy.attackCooldown > 0 then
    enemy.attackCooldown = math.max(0, enemy.attackCooldown - deltaTime)
  end

  return { success = true, enemy = enemy, action = action }
end

--[[
巡逻行为更新
@param enemy: table - 敌人 AI 实例
@param deltaTime: number - 时间步长（秒）
@return: table | nil - 动作结果
]]--
function EnemyAI.updatePatrol(enemy, deltaTime)
  -- 参数验证
  if type(enemy) ~= "table" then return nil end
  if type(deltaTime) ~= "number" or deltaTime < 0 then return nil end

  enemy.patrolTimer = enemy.patrolTimer + deltaTime

  -- 每3秒改变方向
  if enemy.patrolTimer >= 3.0 then
    enemy.targetX = enemy.x + math.random(-5, 5)
    enemy.targetY = enemy.y + math.random(-5, 5)
    enemy.patrolTimer = 0
    enemy.state = "patrolling"
  end

  -- 移动向目标
  local dx = enemy.targetX - enemy.x
  local dy = enemy.targetY - enemy.y
  local dist = math.sqrt(dx * dx + dy * dy)

  if dist > 0.1 then
    local speed = enemy.speed * deltaTime
    enemy.x = enemy.x + (dx / dist) * speed
    enemy.y = enemy.y + (dy / dist) * speed
  end

  return nil
end

--[[
追击行为更新
@param enemy: table - 敌人 AI 实例
@param dx: number - X 方向距离
@param dy: number - Y 方向距离
@param distance: number - 直线距离
@param deltaTime: number - 时间步长（秒）
@return: table | nil - 动作结果
]]--
function EnemyAI.updateChase(enemy, dx, dy, distance, deltaTime)
  -- 参数验证
  if type(enemy) ~= "table" then return nil end
  if type(distance) ~= "number" or distance < 0 then return nil end
  if type(deltaTime) ~= "number" or deltaTime < 0 then return nil end

  if distance < enemy.detectRange then
    -- 朝玩家移动
    local speed = enemy.speed * deltaTime
    enemy.x = enemy.x + (dx / distance) * speed
    enemy.y = enemy.y + (dy / distance) * speed
    enemy.state = "chasing"

    -- 接近时攻击
    if distance < 2.0 and enemy.attackCooldown <= 0 then
      enemy.attackCooldown = 1.0
      enemy.state = "attacking"
      return { action = "melee", damage = enemy.damage }
    end
  else
    enemy.state = "idle"
  end

  return nil
end

--[[
远程攻击行为更新
@param enemy: table - 敌人 AI 实例
@param dx: number - X 方向距离
@param dy: number - Y 方向距离
@param distance: number - 直线距离
@param deltaTime: number - 时间步长（秒）
@return: table | nil - 动作结果
]]--
function EnemyAI.updateRanged(enemy, dx, dy, distance, deltaTime)
  -- 参数验证
  if type(enemy) ~= "table" then return nil end
  if type(distance) ~= "number" or distance < 0 then return nil end
  if type(deltaTime) ~= "number" or deltaTime < 0 then return nil end

  if distance < enemy.detectRange then
    enemy.state = "aiming"

    -- 保持距离
    if distance < 15.0 then
      -- 后退
      local speed = enemy.speed * deltaTime
      enemy.x = enemy.x - (dx / distance) * speed
      enemy.y = enemy.y - (dy / distance) * speed
    elseif distance > 25.0 then
      -- 前进
      local speed = enemy.speed * deltaTime
      enemy.x = enemy.x + (dx / distance) * speed
      enemy.y = enemy.y + (dy / distance) * speed
    end

    -- 射击
    if enemy.attackCooldown <= 0 then
      enemy.attackCooldown = 2.0
      enemy.state = "shooting"
      return { action = "shoot", x = dx, y = dy, damage = enemy.damage }
    end
  else
    enemy.state = "idle"
  end

  return nil
end

--[[
混合行为更新 (Boss)
@param enemy: table - 敌人 AI 实例
@param dx: number - X 方向距离
@param dy: number - Y 方向距离
@param distance: number - 直线距离
@param deltaTime: number - 时间步长（秒）
@return: table | nil - 动作结果
]]--
function EnemyAI.updateMixed(enemy, dx, dy, distance, deltaTime)
  -- 参数验证
  if type(enemy) ~= "table" then return nil end
  if type(distance) ~= "number" or distance < 0 then return nil end
  if type(deltaTime) ~= "number" or deltaTime < 0 then return nil end

  -- 根据血量调整行为
  local healthPercent = enemy.health / enemy.maxHealth

  if healthPercent > 0.5 then
    -- 高血量：积极进攻
    if distance < enemy.detectRange then
      enemy.state = "aggressive"
      local speed = enemy.speed * deltaTime
      enemy.x = enemy.x + (dx / distance) * speed
      enemy.y = enemy.y + (dy / distance) * speed

      if distance < 3.0 and enemy.attackCooldown <= 0 then
        enemy.attackCooldown = 0.5
        return { action = "melee", damage = enemy.damage }
      end
    end
  else
    -- 低血量：边退边打
    enemy.state = "retreating"
    local speed = enemy.speed * 0.5 * deltaTime
    enemy.x = enemy.x - (dx / distance) * speed
    enemy.y = enemy.y - (dy / distance) * speed

    if enemy.attackCooldown <= 0 then
      enemy.attackCooldown = 1.0
      return { action = "ranged", x = dx, y = dy, damage = enemy.damage * 0.7 }
    end
  end

  return nil
end

--[[
计算伤害
@param baseDamage: number - 基础伤害
@param modifier: number - 伤害修正系数
@return: table - { success, damage, error }
]]--
function EnemyAI.calculateDamage(baseDamage, modifier)
  if type(baseDamage) ~= "number" or baseDamage < 0 then
    return { success = false, error = "baseDamage must be a non-negative number" }
  end

  if type(modifier) ~= "number" then
    modifier = 1.0
  end

  local damage = math.floor(baseDamage * modifier)
  return { success = true, damage = damage }
end

--[[
检查是否命中
@param attackerX: number - 攻击者 X 坐标
@param attackerY: number - 攻击者 Y 坐标
@param targetX: number - 目标 X 坐标
@param targetY: number - 目标 Y 坐标
@param accuracy: number - 准确度 (0-1)
@return: table - { success, hit, error }
]]--
function EnemyAI.checkHit(attackerX, attackerY, targetX, targetY, accuracy)
  -- 参数验证
  if type(attackerX) ~= "number" or type(attackerY) ~= "number" then
    return { success = false, error = "attacker coordinates must be numbers" }
  end

  if type(targetX) ~= "number" or type(targetY) ~= "number" then
    return { success = false, error = "target coordinates must be numbers" }
  end

  if type(accuracy) ~= "number" then
    accuracy = 1.0
  end

  -- 限制准确度范围
  accuracy = math.max(0.1, math.min(1.0, accuracy))

  -- 计算距离
  local dx = targetX - attackerX
  local dy = targetY - attackerY
  local distance = math.sqrt(dx * dx + dy * dy)

  -- 距离越远，命中率越低
  local hitChance = math.max(0.1, accuracy - distance * 0.05)
  local hit = math.random() < hitChance

  return { success = true, hit = hit, distance = distance, hitChance = hitChance }
end

--[[
重置敌人状态
@param enemy: table - 敌人 AI 实例
@return: table - { success, enemy, error }
]]--
function EnemyAI.resetEnemy(enemy)
  if type(enemy) ~= "table" then
    return { success = false, error = "enemy must be a table" }
  end

  enemy.state = "idle"
  enemy.attackCooldown = 0
  enemy.patrolTimer = 0
  enemy.lastActionTime = 0

  return { success = true, enemy = enemy }
end

--[[
获取敌人状态描述
@param enemy: table - 敌人 AI 实例
@return: table - { success, status, error }
]]--
function EnemyAI.getEnemyStatus(enemy)
  if type(enemy) ~= "table" then
    return { success = false, error = "enemy must be a table" }
  end

  return {
    success = true,
    status = {
      type = enemy.type,
      state = enemy.state,
      health = enemy.health,
      maxHealth = enemy.maxHealth,
      healthPercent = (enemy.health / enemy.maxHealth) * 100,
      position = { x = enemy.x, y = enemy.y },
      attackCooldown = enemy.attackCooldown
    }
  }
end

return EnemyAI