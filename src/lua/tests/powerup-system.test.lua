local PowerupSystem = require('powerup_system_module')

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

local function runTests()
  print('--------------------------------------------------')
  print('Powerup System Module Unit Tests')
  print('--------------------------------------------------')

  do
    local result = PowerupSystem.reset()
    assertTrue(result.success, 'reset returns success')
  end

  do
    local result = PowerupSystem.getPowerupTypes()
    assertTrue(result.success, 'getPowerupTypes returns success')
    assertNotNil(result.types, 'types exists')
    assertTrue(#result.types > 0, 'has powerup types')
  end

  do
    local result = PowerupSystem.getPowerupConfig('health')
    assertTrue(result.success, 'getPowerupConfig health returns success')
    assertNotNil(result.config, 'config exists')
    assertEqual('health', result.config.name, 'health config name')

    result = PowerupSystem.getPowerupConfig('speed')
    assertTrue(result.success, 'getPowerupConfig speed returns success')
    assertEqual('speed', result.config.name, 'speed config name')

    result = PowerupSystem.getPowerupConfig('unknown')
    assertTrue(not result.success, 'getPowerupConfig unknown returns failure')

    result = PowerupSystem.getPowerupConfig(123)
    assertTrue(not result.success, 'getPowerupConfig invalid type returns failure')
  end

  do
    PowerupSystem.reset()

    local result = PowerupSystem.applyPowerup('health', {})
    assertTrue(result.success, 'applyPowerup health returns success')
    assertEqual('health', result.powerupType, 'powerup type is health')
    assertNotNil(result.effects, 'effects exists')
    assertEqual(1, #result.effects, 'health has 1 effect')

    result = PowerupSystem.applyPowerup('speed', {})
    assertTrue(result.success, 'applyPowerup speed returns success')
    assertNotNil(result.powerupId, 'speed has powerupId')

    result = PowerupSystem.applyPowerup('unknown', {})
    assertTrue(not result.success, 'applyPowerup unknown returns failure')

    result = PowerupSystem.applyPowerup(123, {})
    assertTrue(not result.success, 'applyPowerup invalid type returns failure')
  end

  do
    PowerupSystem.reset()

    PowerupSystem.applyPowerup('speed', {})

    local result = PowerupSystem.getActivePowerups()
    assertTrue(result.success, 'getActivePowerups returns success')
    assertNotNil(result.powerups, 'powerups exists')
    assertEqual(1, #result.powerups, 'has 1 active powerup')
    assertEqual('speed', result.powerups[1].type, 'active powerup is speed')
  end

  do
    PowerupSystem.reset()

    PowerupSystem.applyPowerup('speed', {})

    local result = PowerupSystem.hasActivePowerup('speed')
    assertTrue(result.success, 'hasActivePowerup returns success')
    assertTrue(result.has, 'has active speed powerup')

    result = PowerupSystem.hasActivePowerup('health')
    assertTrue(not result.has, 'does not have health powerup')

    result = PowerupSystem.hasActivePowerup(123)
    assertTrue(not result.success, 'hasActivePowerup invalid type returns failure')
  end

  do
    PowerupSystem.reset()

    local result = PowerupSystem.hasActivePowerup('speed')
    assertTrue(result.success, 'hasActivePowerup no active returns success')
    assertTrue(not result.has, 'no active speed powerup')
  end

  do
    PowerupSystem.reset()

    PowerupSystem.applyPowerup('damage', {})

    local result = PowerupSystem.getPowerupMultiplier('damage')
    assertTrue(result.success, 'getPowerupMultiplier returns success')
    assertNotNil(result.multiplier, 'multiplier exists')
    assertTrue(result.multiplier >= 1.0, 'multiplier is >= 1')

    result = PowerupSystem.getPowerupMultiplier('health')
    assertTrue(result.success, 'getPowerupMultiplier no active returns success')
    assertEqual(1.0, result.multiplier, 'no active returns 1.0')

    result = PowerupSystem.getPowerupMultiplier(123)
    assertTrue(not result.success, 'getPowerupMultiplier invalid type returns failure')
  end

  do
    PowerupSystem.reset()

    PowerupSystem.applyPowerup('speed', {})

    local result = PowerupSystem.getPowerupRemainingDuration('speed')
    assertTrue(result.success, 'getPowerupRemainingDuration returns success')
    assertNotNil(result.remainingDuration, 'remainingDuration exists')
    assertTrue(result.remainingDuration > 0, 'remainingDuration is positive')
    assertNotNil(result.totalDuration, 'totalDuration exists')
    assertNotNil(result.progress, 'progress exists')

    result = PowerupSystem.getPowerupRemainingDuration('health')
    assertTrue(result.success, 'getPowerupRemainingDuration no active returns success')
    assertEqual(0, result.remainingDuration, 'no active returns 0')

    result = PowerupSystem.getPowerupRemainingDuration(123)
    assertTrue(not result.success, 'getPowerupRemainingDuration invalid type returns failure')
  end

  do
    PowerupSystem.reset()

    PowerupSystem.applyPowerup('speed', {})

    local result = PowerupSystem.update(1.0)
    assertTrue(result.success, 'update returns success')
    assertNotNil(result.expired, 'expired exists')
    assertEqual(0, #result.expired, 'no expired powerups')
    assertNotNil(result.activeCount, 'activeCount exists')
    assertEqual(1, result.activeCount, '1 active powerup')

    result = PowerupSystem.update(-1.0)
    assertTrue(not result.success, 'update negative deltaTime returns failure')
  end

  do
    PowerupSystem.reset()

    PowerupSystem.applyPowerup('speed', {})

    local result = PowerupSystem.getActivePowerups()
    local powerupId = result.powerups[1].id

    local removeResult = PowerupSystem.removePowerup(powerupId)
    assertTrue(removeResult.success, 'removePowerup returns success')

    result = PowerupSystem.getActivePowerups()
    assertEqual(0, #result.powerups, 'no active powerups after removal')

    removeResult = PowerupSystem.removePowerup(999)
    assertTrue(not removeResult.success, 'removePowerup invalid id returns failure')

    removeResult = PowerupSystem.removePowerup(0)
    assertTrue(not removeResult.success, 'removePowerup zero id returns failure')

    removeResult = PowerupSystem.removePowerup(-1)
    assertTrue(not removeResult.success, 'removePowerup negative id returns failure')

    removeResult = PowerupSystem.removePowerup('invalid')
    assertTrue(not removeResult.success, 'removePowerup invalid type returns failure')
  end

  do
    PowerupSystem.reset()

    PowerupSystem.applyPowerup('speed', {})
    PowerupSystem.applyPowerup('damage', {})

    local result = PowerupSystem.getActivePowerups()
    assertEqual(2, #result.powerups, 'has 2 active powerups')

    local removeAllResult = PowerupSystem.removeAllPowerups()
    assertTrue(removeAllResult.success, 'removeAllPowerups returns success')

    result = PowerupSystem.getActivePowerups()
    assertEqual(0, #result.powerups, 'no active powerups after removeAll')
  end

  do
    PowerupSystem.reset()

    local result = PowerupSystem.generateRandomPowerup()
    assertTrue(result.success, 'generateRandomPowerup returns success')
    assertNotNil(result.powerupType, 'powerupType exists')
    assertNotNil(result.config, 'config exists')
    assertEqual(result.powerupType, result.config.name, 'powerupType matches config name')
  end

  do
    PowerupSystem.reset()

    local result1 = PowerupSystem.applyPowerup('speed', {})
    assertTrue(result1.success, 'apply speed first time')
    local id1 = result1.powerupId

    local result2 = PowerupSystem.applyPowerup('speed', {})
    assertTrue(result2.success, 'apply speed second time (extend rule)')
    assertEqual(id1, result2.powerupId, 'speed extends, same id')
  end

  do
    PowerupSystem.reset()

    local result1 = PowerupSystem.applyPowerup('damage', {})
    assertTrue(result1.success, 'apply damage first time')
    local id1 = result1.powerupId

    local result2 = PowerupSystem.applyPowerup('damage', {})
    assertTrue(result2.success, 'apply damage second time (stack rule)')
    assertEqual(id1, result2.powerupId, 'damage stacks, same id')

    local result3 = PowerupSystem.applyPowerup('damage', {})
    assertTrue(result3.success, 'apply damage third time (stack rule)')
    assertEqual(id1, result3.powerupId, 'damage stacks again, same id')

    local result4 = PowerupSystem.applyPowerup('damage', {})
    assertTrue(result4.success, 'apply damage fourth time (max stacks)')
    assertNil(result4.powerupId, 'damage at max stacks returns nil powerupId')
  end

  do
    PowerupSystem.reset()

    local result1 = PowerupSystem.applyPowerup('slow_time', {})
    assertTrue(result1.success, 'apply slow_time first time')
    local id1 = result1.powerupId

    local result2 = PowerupSystem.applyPowerup('slow_time', {})
    assertTrue(result2.success, 'apply slow_time second time (replace rule)')
    assertTrue(result2.powerupId ~= id1, 'slow_time replaces, new id')
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