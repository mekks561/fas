local WaveManager = require('wave_manager_module')

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

local function assertNotNil(value, message)
  if value ~= nil then
    tests.passed = tests.passed + 1
    print('[PASS] ' .. (message or ''))
  else
    tests.failed = tests.failed + 1
    print('[FAIL] ' .. (message or '') .. ' - Expected not nil')
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

local function runTests()
  print('--------------------------------------------------')
  print('Wave Manager Module Unit Tests')
  print('--------------------------------------------------')

  do
    local result = WaveManager.reset()
    assertTrue(result.success, 'reset returns success')
  end

  do
    local result = WaveManager.setDifficulty('normal')
    assertTrue(result.success, 'setDifficulty normal returns success')

    result = WaveManager.setDifficulty('easy')
    assertTrue(result.success, 'setDifficulty easy returns success')

    result = WaveManager.setDifficulty('hard')
    assertTrue(result.success, 'setDifficulty hard returns success')

    result = WaveManager.setDifficulty('nightmare')
    assertTrue(result.success, 'setDifficulty nightmare returns success')

    result = WaveManager.setDifficulty(123)
    assertTrue(not result.success, 'setDifficulty invalid type returns failure')

    result = WaveManager.setDifficulty('invalid')
    assertTrue(not result.success, 'setDifficulty invalid value returns failure')
  end

  do
    local result = WaveManager.setMaxWaves(10)
    assertTrue(result.success, 'setMaxWaves valid returns success')

    result = WaveManager.setMaxWaves(0)
    assertTrue(not result.success, 'setMaxWaves zero returns failure')

    result = WaveManager.setMaxWaves(-5)
    assertTrue(not result.success, 'setMaxWaves negative returns failure')

    result = WaveManager.setMaxWaves('invalid')
    assertTrue(not result.success, 'setMaxWaves invalid type returns failure')
  end

  do
    WaveManager.setDifficulty('normal')
    WaveManager.setMaxWaves(10)

    local result = WaveManager.calculateEnemyCount(1)
    assertTrue(result.success, 'calculateEnemyCount wave 1 returns success')
    assertEqual(5, result.count, 'wave 1 enemy count')

    result = WaveManager.calculateEnemyCount(5)
    assertTrue(result.success, 'calculateEnemyCount boss wave returns success')

    result = WaveManager.calculateEnemyCount(0)
    assertTrue(not result.success, 'calculateEnemyCount zero returns failure')

    result = WaveManager.calculateEnemyCount(-1)
    assertTrue(not result.success, 'calculateEnemyCount negative returns failure')
  end

  do
    local result = WaveManager.isBossWave(5)
    assertTrue(result.success, 'isBossWave returns success')
    assertTrue(result.isBoss, 'wave 5 is boss wave')

    result = WaveManager.isBossWave(10)
    assertTrue(result.isBoss, 'wave 10 is boss wave')

    result = WaveManager.isBossWave(3)
    assertTrue(not result.isBoss, 'wave 3 is not boss wave')

    result = WaveManager.isBossWave(0)
    assertTrue(not result.success, 'isBossWave zero returns failure')
  end

  do
    local result = WaveManager.isEliteWave(3)
    assertTrue(result.success, 'isEliteWave returns success')
    assertTrue(result.isElite, 'wave 3 is elite wave')

    result = WaveManager.isEliteWave(6)
    assertTrue(result.isElite, 'wave 6 is elite wave')

    result = WaveManager.isEliteWave(5)
    assertTrue(not result.isElite, 'boss wave is not elite wave')

    result = WaveManager.isEliteWave(1)
    assertTrue(not result.isElite, 'wave 1 is not elite wave')
  end

  do
    WaveManager.setDifficulty('normal')
    WaveManager.setMaxWaves(10)

    local result = WaveManager.generateEnemyTypes(1)
    assertTrue(result.success, 'generateEnemyTypes wave 1 returns success')
    assertNotNil(result.enemyTypes, 'enemyTypes exists')
    assertTrue(#result.enemyTypes > 0, 'wave 1 has enemies')

    result = WaveManager.generateEnemyTypes(5)
    assertTrue(result.success, 'generateEnemyTypes boss wave returns success')
    assertEqual(1, #result.enemyTypes, 'boss wave has 1 enemy')
    assertEqual('boss', result.enemyTypes[1], 'boss wave has boss enemy')

    result = WaveManager.generateEnemyTypes(0)
    assertTrue(not result.success, 'generateEnemyTypes zero returns failure')
  end

  do
    local result = WaveManager.getEnemyConfig('basic')
    assertTrue(result.success, 'getEnemyConfig basic returns success')
    assertNotNil(result.config, 'config exists')
    assertEqual('basic', result.config.type, 'basic enemy type')

    result = WaveManager.getEnemyConfig('boss')
    assertTrue(result.success, 'getEnemyConfig boss returns success')
    assertTrue(result.config.isBoss, 'boss isBoss true')

    result = WaveManager.getEnemyConfig('elite')
    assertTrue(result.success, 'getEnemyConfig elite returns success')
    assertTrue(result.config.isElite, 'elite isElite true')

    result = WaveManager.getEnemyConfig('unknown')
    assertTrue(not result.success, 'getEnemyConfig unknown returns failure')
  end

  do
    WaveManager.reset()
    WaveManager.setDifficulty('normal')
    WaveManager.setMaxWaves(10)

    local result = WaveManager.startWave(1)
    assertTrue(result.success, 'startWave returns success')
    assertEqual(1, result.waveNumber, 'wave number is 1')
    assertEqual(false, result.isBossWave, 'wave 1 is not boss wave')
    assertEqual(false, result.isEliteWave, 'wave 1 is not elite wave')
    assertTrue(result.enemyCount > 0, 'has enemies')

    result = WaveManager.startWave(0)
    assertTrue(not result.success, 'startWave zero returns failure')

    result = WaveManager.startWave(11)
    assertTrue(not result.success, 'startWave exceeds maxWaves returns failure')
  end

  do
    WaveManager.reset()
    WaveManager.setDifficulty('normal')
    WaveManager.setMaxWaves(10)
    WaveManager.startWave(1)

    local result = WaveManager.spawnNextEnemy()
    assertTrue(result.success, 'spawnNextEnemy returns success')
    assertNotNil(result.enemy, 'enemy exists')
    assertEqual(1, result.spawnIndex, 'spawn index is 1')

    result = WaveManager.spawnNextEnemy()
    assertTrue(result.success, 'spawnNextEnemy second call returns success')
    assertEqual(2, result.spawnIndex, 'spawn index is 2')
  end

  do
    WaveManager.reset()
    WaveManager.setDifficulty('normal')
    WaveManager.setMaxWaves(10)
    WaveManager.startWave(1)

    local spawnResult = WaveManager.spawnNextEnemy()
    assertTrue(spawnResult.success, 'spawn enemy first')

    local result = WaveManager.onEnemyDefeated('basic')
    assertTrue(result.success, 'onEnemyDefeated returns success')
    assertEqual(1, result.enemiesDefeated, 'enemies defeated is 1')
  end

  do
    WaveManager.reset()
    WaveManager.setDifficulty('normal')
    WaveManager.setMaxWaves(10)
    WaveManager.startWave(1)

    local result = WaveManager.pauseWave()
    assertTrue(result.success, 'pauseWave returns success')

    result = WaveManager.resumeWave()
    assertTrue(result.success, 'resumeWave returns success')

    result = WaveManager.pauseWave()
    assertTrue(result.success, 'pauseWave again returns success')

    result = WaveManager.pauseWave()
    assertTrue(not result.success, 'pauseWave when paused returns failure')

    result = WaveManager.resumeWave()
    assertTrue(result.success, 'resumeWave when paused returns success')

    result = WaveManager.resumeWave()
    assertTrue(not result.success, 'resumeWave when active returns failure')
  end

  do
    WaveManager.reset()
    WaveManager.setDifficulty('normal')
    WaveManager.setMaxWaves(10)
    WaveManager.startWave(1)

    local result = WaveManager.update(0.1)
    assertTrue(result.success, 'update returns success')
    assertEqual(0.1, result.elapsedTime, 'elapsed time is 0.1')

    result = WaveManager.update(-0.1)
    assertTrue(not result.success, 'update negative deltaTime returns failure')
  end

  do
    WaveManager.reset()
    WaveManager.setDifficulty('normal')
    WaveManager.setMaxWaves(10)
    WaveManager.startWave(1)

    local result = WaveManager.getWaveScoreMultiplier()
    assertTrue(result.success, 'getWaveScoreMultiplier returns success')
    assertNotNil(result.multiplier, 'multiplier exists')
    assertTrue(result.multiplier > 0, 'multiplier is positive')
  end

  do
    WaveManager.reset()
    WaveManager.setDifficulty('normal')
    WaveManager.setMaxWaves(10)

    local result = WaveManager.getNextWaveNumber()
    assertTrue(result.success, 'getNextWaveNumber returns success')
    assertEqual(2, result.waveNumber, 'next wave is 2')

    WaveManager.startWave(10)
    result = WaveManager.getNextWaveNumber()
    assertTrue(not result.success, 'getNextWaveNumber at max returns failure')
  end

  do
    WaveManager.reset()
    local result = WaveManager.getWaveState()
    assertTrue(result.success, 'getWaveState returns success')
    assertNotNil(result.state, 'state exists')
    assertEqual('waiting', result.state.currentState, 'initial state is waiting')
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