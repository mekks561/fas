--[[
--------------------------------------------------
敌人 AI 模块单元测试
Enemy AI Module Unit Tests

测试覆盖:
- AI 类型获取
- 创建敌人实例
- 更新 AI 行为（巡逻、追击、远程、混合）
- 伤害计算
- 命中检测
- 状态管理
--------------------------------------------------
]]--

local EnemyAI = require('ai/enemy-ai')

local tests = {
  passed = 0,
  failed = 0
}

local function assertEqual(expected, actual, message)
  if expected == actual then
    tests.passed = tests.passed + 1
    print('[PASS] ' .. (message or ''))
  else
    tests.failed = tests.failed + 1
    print('[FAIL] ' .. (message or '') .. string.format(' - Expected: %s, Actual: %s', tostring(expected), tostring(actual)))
  end
end

local function assertTrue(condition, message)
  if condition then
    tests.passed = tests.passed + 1
    print('[PASS] ' .. (message or ''))
  else
    tests.failed = tests.failed + 1
    print('[FAIL] ' .. (message or ''))
  end
end

local function assertNil(value, message)
  if value == nil then
    tests.passed = tests.passed + 1
    print('[PASS] ' .. (message or ''))
  else
    tests.failed = tests.failed + 1
    print('[FAIL] ' .. (message or '') .. string.format(' - Expected nil, Actual: %s', tostring(value)))
  end
end

local function assertNotNil(value, message)
  if value ~= nil then
    tests.passed = tests.passed + 1
    print('[PASS] ' .. (message or ''))
  else
    tests.failed = tests.failed + 1
    print('[FAIL] ' .. (message or '') .. ' - Expected not nil')
  end
end

local function runTests()
  print('--------------------------------------------------')
  print('Enemy AI Module Unit Tests')
  print('--------------------------------------------------')

  -- 测试1: 获取 AI 类型配置 - 有效类型
  do
    local result = EnemyAI.getAIType('PATROL')
    assertTrue(result.success, 'getAIType PATROL returns success')
    assertNotNil(result.config, 'PATROL config exists')
    assertEqual('patrol', result.config.name, 'PATROL name')
    assertEqual(2.0, result.config.speed, 'PATROL speed')
    assertEqual(10.0, result.config.detectRange, 'PATROL detectRange')
  end

  -- 测试2: 获取 AI 类型配置 - 无效类型
  do
    local result = EnemyAI.getAIType('INVALID')
    assertTrue(not result.success, 'getAIType INVALID returns failure')
    assertNotNil(result.error, 'INVALID type has error message')
  end

  -- 测试3: 获取所有 AI 类型
  do
    local types = EnemyAI.getAllAITypes()
    assertNotNil(types, 'getAllAITypes returns types')
    local count = 0
    for _ in pairs(types) do count = count + 1 end
    assertEqual(4, count, '4 AI types exist')
  end

  -- 测试4: 创建敌人 AI - 有效类型
  do
    local result = EnemyAI.createEnemyAI('AGGRESSIVE', 10, 20)
    assertTrue(result.success, 'createEnemyAI AGGRESSIVE returns success')
    assertNotNil(result.enemy, 'enemy instance created')
    assertEqual('aggressive', result.enemy.type, 'enemy type')
    assertEqual(10, result.enemy.x, 'enemy x position')
    assertEqual(20, result.enemy.y, 'enemy y position')
    assertEqual(4.0, result.enemy.speed, 'enemy speed')
    assertEqual('chase', result.enemy.behavior, 'enemy behavior')
    assertEqual('idle', result.enemy.state, 'initial state is idle')
  end

  -- 测试5: 创建敌人 AI - 无效类型
  do
    local result = EnemyAI.createEnemyAI('INVALID')
    assertTrue(not result.success, 'createEnemyAI INVALID returns failure')
    assertNil(result.enemy, 'invalid type returns nil enemy')
  end

  -- 测试6: 创建敌人 AI - 默认位置
  do
    local result = EnemyAI.createEnemyAI('PATROL')
    assertTrue(result.success, 'createEnemyAI PATROL returns success')
    assertEqual(0, result.enemy.x, 'default x position')
    assertEqual(0, result.enemy.y, 'default y position')
  end

  -- 测试7: 更新 AI - 参数验证
  do
    local result = EnemyAI.updateAI(nil, 10, 10, 0.1)
    assertTrue(not result.success, 'updateAI with nil enemy returns failure')
    assertNotNil(result.error, 'nil enemy has error message')

    result = EnemyAI.updateAI({}, 'invalid', 10, 0.1)
    assertTrue(not result.success, 'updateAI with invalid playerX returns failure')

    result = EnemyAI.updateAI({}, 10, 10, -1)
    assertTrue(not result.success, 'updateAI with negative deltaTime returns failure')
  end

  -- 测试8: 更新 AI - 巡逻行为
  do
    local result = EnemyAI.createEnemyAI('PATROL', 0, 0)
    assertTrue(result.success, 'create patrol enemy')

    local enemy = result.enemy
    local initialX, initialY = enemy.x, enemy.y

    -- 更新多次触发巡逻
    for i = 1, 100 do
      local updateResult = EnemyAI.updateAI(enemy, 100, 100, 0.1)
      assertTrue(updateResult.success, 'updateAI patrol returns success')
    end

    assertTrue(enemy.x ~= initialX or enemy.y ~= initialY, 'patrol enemy moved')
    assertEqual('patrolling', enemy.state, 'patrol state after moving')
  end

  -- 测试9: 更新 AI - 追击行为（玩家在检测范围内）
  do
    local result = EnemyAI.createEnemyAI('AGGRESSIVE', 0, 0)
    assertTrue(result.success, 'create aggressive enemy')

    local enemy = result.enemy

    local updateResult = EnemyAI.updateAI(enemy, 5, 0, 0.1)
    assertTrue(updateResult.success, 'updateAI chase returns success')
    assertTrue(enemy.x > 0, 'enemy moved towards player')
    assertEqual('chasing', enemy.state, 'chase state')
  end

  -- 测试10: 更新 AI - 追击行为（玩家在检测范围外）
  do
    local result = EnemyAI.createEnemyAI('AGGRESSIVE', 0, 0)
    assertTrue(result.success, 'create aggressive enemy')

    local enemy = result.enemy

    local updateResult = EnemyAI.updateAI(enemy, 100, 0, 0.1)
    assertTrue(updateResult.success, 'updateAI chase returns success')
    assertEqual('idle', enemy.state, 'idle state when player is far')
  end

  -- 测试11: 更新 AI - 远程攻击行为
  do
    local result = EnemyAI.createEnemyAI('SNIPER', 0, 0)
    assertTrue(result.success, 'create sniper enemy')

    local enemy = result.enemy

    local updateResult = EnemyAI.updateAI(enemy, 20, 0, 0.1)
    assertTrue(updateResult.success, 'updateAI ranged returns success')
    assertEqual('aiming', enemy.state, 'ranged aiming state')
  end

  -- 测试12: 更新 AI - 混合行为（Boss - 高血量）
  do
    local result = EnemyAI.createEnemyAI('BOSS', 0, 0)
    assertTrue(result.success, 'create boss enemy')

    local enemy = result.enemy

    local updateResult = EnemyAI.updateAI(enemy, 10, 0, 0.1)
    assertTrue(updateResult.success, 'updateAI mixed returns success')
    assertEqual('aggressive', enemy.state, 'boss aggressive state')
  end

  -- 测试13: 更新 AI - 混合行为（Boss - 低血量）
  do
    local result = EnemyAI.createEnemyAI('BOSS', 0, 0)
    assertTrue(result.success, 'create boss enemy')

    local enemy = result.enemy
    enemy.health = enemy.maxHealth * 0.3

    local updateResult = EnemyAI.updateAI(enemy, 10, 0, 0.1)
    assertTrue(updateResult.success, 'updateAI mixed returns success')
    assertEqual('retreating', enemy.state, 'boss retreating state')
  end

  -- 测试14: 计算伤害
  do
    local result = EnemyAI.calculateDamage(10, 1.5)
    assertTrue(result.success, 'calculateDamage returns success')
    assertEqual(15, result.damage, 'damage: 10 * 1.5 = 15')
  end

  -- 测试15: 计算伤害 - 边界条件
  do
    local result = EnemyAI.calculateDamage(0, 1)
    assertTrue(result.success, 'zero damage returns success')
    assertEqual(0, result.damage, 'zero damage')

    result = EnemyAI.calculateDamage(10, nil)
    assertTrue(result.success, 'nil modifier returns success')
    assertEqual(10, result.damage, 'nil modifier defaults to 1')

    result = EnemyAI.calculateDamage(-1, 1)
    assertTrue(not result.success, 'negative damage returns failure')
  end

  -- 测试16: 检查命中 - 参数验证
  do
    local result = EnemyAI.checkHit('invalid', 0, 10, 10, 1)
    assertTrue(not result.success, 'invalid attackerX returns failure')

    result = EnemyAI.checkHit(0, 0, 10, 10)
    assertTrue(result.success, 'nil accuracy returns success')
  end

  -- 测试17: 获取敌人状态
  do
    local result = EnemyAI.createEnemyAI('PATROL', 5, 10)
    assertTrue(result.success, 'create enemy for status')

    local statusResult = EnemyAI.getEnemyStatus(result.enemy)
    assertTrue(statusResult.success, 'getEnemyStatus returns success')
    assertNotNil(statusResult.status, 'status exists')
    assertEqual('patrol', statusResult.status.type, 'status type')
    assertEqual(5, statusResult.status.position.x, 'status position x')
    assertEqual(10, statusResult.status.position.y, 'status position y')
  end

  -- 测试18: 重置敌人状态
  do
    local result = EnemyAI.createEnemyAI('AGGRESSIVE', 0, 0)
    assertTrue(result.success, 'create enemy for reset')

    local enemy = result.enemy
    enemy.state = 'chasing'
    enemy.attackCooldown = 5.0
    enemy.patrolTimer = 10.0

    local resetResult = EnemyAI.resetEnemy(enemy)
    assertTrue(resetResult.success, 'resetEnemy returns success')
    assertEqual('idle', enemy.state, 'state reset to idle')
    assertEqual(0, enemy.attackCooldown, 'cooldown reset')
    assertEqual(0, enemy.patrolTimer, 'patrol timer reset')
  end

  -- 测试19: 重置敌人状态 - 参数验证
  do
    local result = EnemyAI.resetEnemy(nil)
    assertTrue(not result.success, 'resetEnemy with nil returns failure')
    assertNotNil(result.error, 'nil enemy has error message')
  end

  -- 测试20: 获取敌人状态 - 参数验证
  do
    local result = EnemyAI.getEnemyStatus(nil)
    assertTrue(not result.success, 'getEnemyStatus with nil returns failure')
    assertNotNil(result.error, 'nil enemy has error message')
  end

  print('--------------------------------------------------')
  print(string.format('Results: %d passed, %d failed', tests.passed, tests.failed))
  print('--------------------------------------------------')

  return tests.passed, tests.failed
end

local passed, failed = runTests()

return {
  passed = passed,
  failed = failed,
  total = passed + failed
}