--[[
--------------------------------------------------
游戏配置模块单元测试
Game Config Module Unit Tests

测试覆盖:
- 难度配置获取
- 武器配置获取
- 伤害计算
- 分数计算
- 碰撞检测
- 线性插值
- 波次计算
--------------------------------------------------
]]--

local GameConfig = require('config/game-config')

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
  print('Game Config Module Unit Tests')
  print('--------------------------------------------------')

  -- 测试1: 获取难度配置 - 有效难度
  do
    local result = GameConfig.getDifficultyConfig('easy')
    assertTrue(result.success, 'getDifficultyConfig returns success')
    assertNotNil(result.config, 'easy difficulty config exists')
    assertEqual(10.0, result.config.waveInterval, 'easy waveInterval')
    assertEqual(0.8, result.config.enemySpeedMultiplier, 'easy enemySpeedMultiplier')
  end

  -- 测试2: 获取难度配置 - 无效难度（应该回退到normal）
  do
    local result = GameConfig.getDifficultyConfig('invalid')
    assertTrue(result.success, 'invalid difficulty returns success')
    assertNotNil(result.config, 'invalid difficulty falls back to normal')
    assertEqual(7.0, result.config.waveInterval, 'invalid falls back to normal waveInterval')
  end

  -- 测试3: 获取难度配置 - 参数验证
  do
    local result = GameConfig.getDifficultyConfig(123)
    assertTrue(result.success, 'number parameter returns success')
    assertNotNil(result.config, 'number parameter falls back to normal')
  end

  -- 测试4: 获取武器配置 - 有效武器
  do
    local result = GameConfig.getWeaponConfig('basic')
    assertTrue(result.success, 'getWeaponConfig basic returns success')
    assertNotNil(result.config, 'basic weapon config exists')
    assertEqual(10, result.config.damage, 'basic weapon damage')
    assertEqual(0.5, result.config.fireRate, 'basic weapon fireRate')
  end

  -- 测试5: 获取武器配置 - 无效武器
  do
    local result = GameConfig.getWeaponConfig('invalid')
    assertTrue(not result.success, 'invalid weapon returns failure')
    assertNotNil(result.error, 'invalid weapon has error message')
  end

  -- 测试6: 计算伤害 - 正常参数
  do
    local result = GameConfig.calculateDamage(100, 0.5, 1.2)
    assertTrue(result.success, 'calculateDamage returns success')
    assertEqual(180, result.damage, 'damage calculation: 100 * 1.5 * 1.2 = 180')
  end

  -- 测试7: 计算伤害 - 边界条件
  do
    local result = GameConfig.calculateDamage(0, 0, 1)
    assertTrue(result.success, 'zero damage returns success')
    assertEqual(0, result.damage, 'zero damage calculation')

    result = GameConfig.calculateDamage(100, nil, 1)
    assertTrue(result.success, 'nil playerBonus returns success')
    assertEqual(100, result.damage, 'nil playerBonus defaults to 0')

    result = GameConfig.calculateDamage(100, 0, nil)
    assertTrue(result.success, 'nil difficultyMultiplier returns success')
    assertEqual(100, result.damage, 'nil difficultyMultiplier defaults to 1')
  end

  -- 测试8: 计算分数 - 正常参数
  do
    local result = GameConfig.calculateScore('elite', 'hard', 2.0)
    assertTrue(result.success, 'calculateScore returns success')
    assertEqual(1200, result.score, 'score: 300 * 2 * 2 = 1200')
  end

  -- 测试9: 计算分数 - 默认值
  do
    local result = GameConfig.calculateScore('unknown', 'normal', 1)
    assertTrue(result.success, 'unknown enemyType returns success')
    assertEqual(150, result.score, 'unknown enemyType defaults to 100')
  end

  -- 测试10: 圆形碰撞检测 - 碰撞
  do
    local result = GameConfig.checkCircleCollision(0, 0, 5, 3, 0, 5)
    assertTrue(result.success, 'checkCircleCollision returns success')
    assertTrue(result.collided, 'circles at (0,0) r=5 and (3,0) r=5 should collide')
  end

  -- 测试11: 圆形碰撞检测 - 不碰撞
  do
    local result = GameConfig.checkCircleCollision(0, 0, 5, 15, 0, 5)
    assertTrue(result.success, 'checkCircleCollision returns success')
    assertTrue(not result.collided, 'circles at (0,0) r=5 and (15,0) r=5 should not collide')
  end

  -- 测试12: 线性插值 - 正常参数
  do
    local result = GameConfig.lerp(0, 100, 0.5)
    assertTrue(result.success, 'lerp returns success')
    assertEqual(50, result.value, 'lerp(0, 100, 0.5) = 50')
  end

  -- 测试13: 线性插值 - 边界条件
  do
    local result = GameConfig.lerp(0, 100, 0)
    assertTrue(result.success, 'lerp at 0 returns success')
    assertEqual(0, result.value, 'lerp at 0')

    result = GameConfig.lerp(0, 100, 1)
    assertTrue(result.success, 'lerp at 1 returns success')
    assertEqual(100, result.value, 'lerp at 1')

    result = GameConfig.lerp(0, 100, -1)
    assertTrue(result.success, 'lerp at -1 returns success')
    assertEqual(0, result.value, 'lerp clamps below 0')

    result = GameConfig.lerp(0, 100, 2)
    assertTrue(result.success, 'lerp at 2 returns success')
    assertEqual(100, result.value, 'lerp clamps above 1')
  end

  -- 测试14: 获取波次敌人数量
  do
    local result = GameConfig.getWaveEnemyCount(1)
    assertTrue(result.success, 'getWaveEnemyCount wave 1 returns success')
    assertEqual(5, result.count, 'wave 1 enemy count')

    result = GameConfig.getWaveEnemyCount(5)
    assertTrue(result.success, 'getWaveEnemyCount wave 5 returns success')
    assertEqual(7, result.count, 'wave 5 enemy count')
  end

  -- 测试15: 检查Boss波次
  do
    local result = GameConfig.isBossWave(5)
    assertTrue(result.success, 'isBossWave wave 5 returns success')
    assertTrue(result.isBoss, 'wave 5 is boss wave')

    result = GameConfig.isBossWave(3)
    assertTrue(result.success, 'isBossWave wave 3 returns success')
    assertTrue(not result.isBoss, 'wave 3 is not boss wave')
  end

  -- 测试16: 检查精英波次
  do
    local result = GameConfig.isEliteWave(3)
    assertTrue(result.success, 'isEliteWave wave 3 returns success')
    assertTrue(result.isElite, 'wave 3 is elite wave')

    result = GameConfig.isEliteWave(4)
    assertTrue(result.success, 'isEliteWave wave 4 returns success')
    assertTrue(not result.isElite, 'wave 4 is not elite wave')
  end

  -- 测试17: 获取玩家配置
  do
    local result = GameConfig.getPlayerConfig()
    assertTrue(result.success, 'getPlayerConfig returns success')
    assertNotNil(result.config, 'player config exists')
    assertEqual(100, result.config.defaultHealth, 'default health')
    assertEqual(5.0, result.config.defaultSpeed, 'default speed')
  end

  -- 测试18: 获取道具配置
  do
    local result = GameConfig.getPowerupConfig('health')
    assertTrue(result.success, 'getPowerupConfig health returns success')
    assertNotNil(result.config, 'health powerup exists')
    assertEqual(25, result.config.value, 'health powerup value')

    result = GameConfig.getPowerupConfig()
    assertTrue(result.success, 'getPowerupConfig all returns success')
    assertNotNil(result.config, 'all powerups exist')
  end

  -- 测试19: 获取波次配置
  do
    local result = GameConfig.getWaveConfig()
    assertTrue(result.success, 'getWaveConfig returns success')
    assertNotNil(result.config, 'wave config exists')
    assertEqual(5, result.config.bossEveryNWaves, 'boss every 5 waves')
  end

  -- 测试20: 获取完整配置
  do
    local config = GameConfig.getFullConfig()
    assertNotNil(config, 'getFullConfig returns config')
    assertNotNil(config.difficulty, 'full config has difficulty')
    assertNotNil(config.weapons, 'full config has weapons')
    assertNotNil(config.player, 'full config has player')
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