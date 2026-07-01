-- ==========================================
-- 敌人 AI 行为脚本
-- Fighter Game - Enemy AI Behaviors
-- ==========================================

-- 敌人 AI 配置
AI_TYPES = {
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

-- 创建敌人 AI
function createEnemyAI(type)
  local config = AI_TYPES[type]
  if not config then
    return nil
  end

  return {
    type = config.name,
    x = 0,
    y = 0,
    speed = config.speed,
    detectRange = config.detectRange,
    damage = config.damage,
    health = config.health,
    maxHealth = config.health,
    behavior = config.behavior,
    state = "idle",
    targetX = 0,
    targetY = 0,
    attackCooldown = 0,
    patrolTimer = 0
  }
end

-- 更新 AI 行为
function updateAI(enemy, playerX, playerY, deltaTime)
  if not enemy then return end

  -- 计算与玩家距离
  local dx = playerX - enemy.x
  local dy = playerY - enemy.y
  local distance = math.sqrt(dx * dx + dy * dy)

  -- 状态机
  if enemy.behavior == "patrol" then
    updatePatrol(enemy, deltaTime)
  elseif enemy.behavior == "chase" then
    updateChase(enemy, dx, dy, distance, deltaTime)
  elseif enemy.behavior == "ranged" then
    updateRanged(enemy, dx, dy, distance, deltaTime)
  elseif enemy.behavior == "mixed" then
    updateMixed(enemy, dx, dy, distance, deltaTime)
  end

  -- 更新冷却时间
  if enemy.attackCooldown > 0 then
    enemy.attackCooldown = enemy.attackCooldown - deltaTime
  end

  return enemy
end

-- 巡逻行为
function updatePatrol(enemy, deltaTime)
  enemy.patrolTimer = enemy.patrolTimer + deltaTime

  -- 每3秒改变方向
  if enemy.patrolTimer >= 3.0 then
    enemy.targetX = enemy.x + math.random(-5, 5)
    enemy.targetY = enemy.y + math.random(-5, 5)
    enemy.patrolTimer = 0
  end

  -- 移动向目标
  local dx = enemy.targetX - enemy.x
  local dy = enemy.targetY - enemy.y
  local dist = math.sqrt(dx * dx + dy * dy)

  if dist > 0.1 then
    enemy.x = enemy.x + (dx / dist) * enemy.speed * deltaTime
    enemy.y = enemy.y + (dy / dist) * enemy.speed * deltaTime
  end
end

-- 追击行为
function updateChase(enemy, dx, dy, distance, deltaTime)
  if distance < enemy.detectRange then
    -- 朝玩家移动
    enemy.x = enemy.x + (dx / distance) * enemy.speed * deltaTime
    enemy.y = enemy.y + (dy / distance) * enemy.speed * deltaTime
    enemy.state = "chasing"

    -- 接近时攻击
    if distance < 2.0 and enemy.attackCooldown <= 0 then
      enemy.attackCooldown = 1.0
      enemy.state = "attacking"
    end
  else
    enemy.state = "idle"
  end
end

-- 远程攻击行为
function updateRanged(enemy, dx, dy, distance, deltaTime)
  if distance < enemy.detectRange then
    enemy.state = "aiming"

    -- 保持距离
    if distance < 15.0 then
      -- 后退
      enemy.x = enemy.x - (dx / distance) * enemy.speed * deltaTime
      enemy.y = enemy.y - (dy / distance) * enemy.speed * deltaTime
    elseif distance > 25.0 then
      -- 前进
      enemy.x = enemy.x + (dx / distance) * enemy.speed * deltaTime
      enemy.y = enemy.y + (dy / distance) * enemy.speed * deltaTime
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
end

-- 混合行为 (Boss)
function updateMixed(enemy, dx, dy, distance, deltaTime)
  -- 根据血量调整行为
  local healthPercent = enemy.health / enemy.maxHealth

  if healthPercent > 0.5 then
    -- 高血量：积极进攻
    if distance < enemy.detectRange then
      enemy.state = "aggressive"
      enemy.x = enemy.x + (dx / distance) * enemy.speed * deltaTime
      enemy.y = enemy.y + (dy / distance) * enemy.speed * deltaTime

      if distance < 3.0 and enemy.attackCooldown <= 0 then
        enemy.attackCooldown = 0.5
        return { action = "melee", damage = enemy.damage }
      end
    end
  else
    -- 低血量：边退边打
    enemy.state = "retreating"
    enemy.x = enemy.x - (dx / distance) * enemy.speed * 0.5 * deltaTime
    enemy.y = enemy.y - (dy / distance) * enemy.speed * 0.5 * deltaTime

    if enemy.attackCooldown <= 0 then
      enemy.attackCooldown = 1.0
      return { action = "ranged", x = dx, y = dy, damage = enemy.damage * 0.7 }
    end
  end
end

-- 计算伤害
function calculateDamage(baseDamage, modifier)
  return math.floor(baseDamage * (modifier or 1.0))
end

-- 检查是否命中
function checkHit(attackerX, attackerY, targetX, targetY, accuracy)
  local dx = targetX - attackerX
  local dy = targetY - attackerY
  local distance = math.sqrt(dx * dx + dy * dy)

  -- 距离越远，命中率越低
  local hitChance = math.clamp(accuracy - distance * 0.05, 0.1, 1.0)
  return math.random() < hitChance
end
