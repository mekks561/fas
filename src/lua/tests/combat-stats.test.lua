local CombatStats = require('combat_stats_module')

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
  print('==========================================')
  print('Combat Stats Module Unit Tests')
  print('==========================================')

  do
    local result = CombatStats.reset()
    assertTrue(result.success, 'reset returns success')
  end

  do
    local result = CombatStats.getStats()
    assertTrue(result.success, 'getStats returns success')
    assertNotNil(result.stats, 'stats exists')
    assertEqual(0, result.stats.kills, 'initial kills is 0')
    assertEqual(0, result.stats.deaths, 'initial deaths is 0')
    assertEqual(0, result.stats.damageDealt, 'initial damageDealt is 0')
    assertEqual(0, result.stats.score, 'initial score is 0')
    assertEqual('D', result.stats.rank, 'initial rank is D')
  end

  do
    CombatStats.reset()

    local result = CombatStats.onKill('basic')
    assertTrue(result.success, 'onKill basic returns success')
    assertEqual(1, result.kills, 'kills is 1')
    assertEqual(1, result.comboCurrent, 'comboCurrent is 1')
    assertEqual(1, result.comboMax, 'comboMax is 1')

    result = CombatStats.onKill('fast')
    assertTrue(result.success, 'onKill fast returns success')
    assertEqual(2, result.kills, 'kills is 2')
    assertEqual(2, result.comboCurrent, 'comboCurrent is 2')
    assertEqual(2, result.comboMax, 'comboMax is 2')

    result = CombatStats.onKill(123)
    assertTrue(not result.success, 'onKill invalid type returns failure')
  end

  do
    CombatStats.reset()

    local result = CombatStats.onKill('boss', true, false)
    assertTrue(result.success, 'onKill boss returns success')
    assertEqual(1, result.kills, 'kills is 1')

    local stats = CombatStats.getStats().stats
    assertEqual(1, stats.bossesKilled, 'bossesKilled is 1')
    assertEqual(0, stats.elitesKilled, 'elitesKilled is 0')

    result = CombatStats.onKill('elite', false, true)
    assertTrue(result.success, 'onKill elite returns success')

    stats = CombatStats.getStats().stats
    assertEqual(1, stats.elitesKilled, 'elitesKilled is 1')
  end

  do
    CombatStats.reset()

    local result = CombatStats.onDeath()
    assertTrue(result.success, 'onDeath returns success')
    assertEqual(1, result.deaths, 'deaths is 1')

    local stats = CombatStats.getStats().stats
    assertEqual(0, stats.comboCurrent, 'combo reset after death')
  end

  do
    CombatStats.reset()

    local result = CombatStats.addDamageDealt(100)
    assertTrue(result.success, 'addDamageDealt returns success')
    assertEqual(100, result.damageDealt, 'damageDealt is 100')

    result = CombatStats.addDamageDealt(50)
    assertTrue(result.success, 'addDamageDealt again returns success')
    assertEqual(150, result.damageDealt, 'damageDealt is 150')

    result = CombatStats.addDamageDealt(-10)
    assertTrue(not result.success, 'addDamageDealt negative returns failure')

    result = CombatStats.addDamageDealt('invalid')
    assertTrue(not result.success, 'addDamageDealt invalid type returns failure')
  end

  do
    CombatStats.reset()

    local result = CombatStats.addDamageTaken(20)
    assertTrue(result.success, 'addDamageTaken returns success')
    assertEqual(20, result.damageTaken, 'damageTaken is 20')

    result = CombatStats.addDamageTaken(-5)
    assertTrue(not result.success, 'addDamageTaken negative returns failure')

    result = CombatStats.addDamageTaken('invalid')
    assertTrue(not result.success, 'addDamageTaken invalid type returns failure')
  end

  do
    CombatStats.reset()

    local result = CombatStats.addDamageHealed(30)
    assertTrue(result.success, 'addDamageHealed returns success')
    assertEqual(30, result.damageHealed, 'damageHealed is 30')

    result = CombatStats.addDamageHealed(-10)
    assertTrue(not result.success, 'addDamageHealed negative returns failure')

    result = CombatStats.addDamageHealed('invalid')
    assertTrue(not result.success, 'addDamageHealed invalid type returns failure')
  end

  do
    CombatStats.reset()

    local result = CombatStats.onSkillUse('fireball')
    assertTrue(result.success, 'onSkillUse returns success')
    assertEqual(1, result.skillsUsed, 'skillsUsed is 1')
    assertEqual(0, result.skillsHit, 'skillsHit is 0')

    result = CombatStats.onSkillUse('fireball', true)
    assertTrue(result.success, 'onSkillUse with hit returns success')
    assertEqual(2, result.skillsUsed, 'skillsUsed is 2')
    assertEqual(1, result.skillsHit, 'skillsHit is 1')

    result = CombatStats.onSkillUse(123)
    assertTrue(not result.success, 'onSkillUse invalid type returns failure')
  end

  do
    CombatStats.reset()

    local result = CombatStats.onPowerupCollected('health')
    assertTrue(result.success, 'onPowerupCollected returns success')
    assertEqual(1, result.powerupsCollected, 'powerupsCollected is 1')

    result = CombatStats.onPowerupCollected(123)
    assertTrue(not result.success, 'onPowerupCollected invalid type returns failure')
  end

  do
    CombatStats.reset()

    local result = CombatStats.onProjectileFired()
    assertTrue(result.success, 'onProjectileFired returns success')
    assertEqual(1, result.projectilesFired, 'projectilesFired is 1')
  end

  do
    CombatStats.reset()

    local result = CombatStats.onProjectileHit()
    assertTrue(result.success, 'onProjectileHit returns success')
    assertEqual(1, result.projectilesHit, 'projectilesHit is 1')
  end

  do
    CombatStats.reset()

    CombatStats.onKill('basic')
    CombatStats.onKill('basic')

    local result = CombatStats.updateCombo(1.0)
    assertTrue(result.success, 'updateCombo returns success')
    assertEqual(2, result.comboCurrent, 'comboCurrent is 2')
    assertTrue(result.comboTimer > 0, 'comboTimer is positive')

    result = CombatStats.updateCombo(3.0)
    assertTrue(result.success, 'updateCombo after timeout returns success')
    assertEqual(0, result.comboCurrent, 'comboCurrent reset after timeout')

    result = CombatStats.updateCombo(-1.0)
    assertTrue(not result.success, 'updateCombo negative deltaTime returns failure')
  end

  do
    CombatStats.reset()

    local result = CombatStats.addScore(1000)
    assertTrue(result.success, 'addScore returns success')
    assertEqual(1000, result.score, 'score is 1000')
    assertEqual('C', result.rank, 'rank is C')

    result = CombatStats.addScore(4000)
    assertTrue(result.success, 'addScore again returns success')
    assertEqual(5000, result.score, 'score is 5000')
    assertEqual('A', result.rank, 'rank is A')

    result = CombatStats.addScore(6000)
    assertTrue(result.success, 'addScore to S rank returns success')
    assertEqual(11000, result.score, 'score is 11000')
    assertEqual('S', result.rank, 'rank is S')

    result = CombatStats.addScore('invalid')
    assertTrue(not result.success, 'addScore invalid type returns failure')
  end

  do
    CombatStats.reset()

    local result = CombatStats.updatePlayTime(5.0)
    assertTrue(result.success, 'updatePlayTime returns success')
    assertEqual(5.0, result.playTime, 'playTime is 5.0')

    result = CombatStats.updatePlayTime(-1.0)
    assertTrue(not result.success, 'updatePlayTime negative returns failure')

    result = CombatStats.updatePlayTime('invalid')
    assertTrue(not result.success, 'updatePlayTime invalid type returns failure')
  end

  do
    CombatStats.reset()

    local result = CombatStats.onWaveCompleted(1)
    assertTrue(result.success, 'onWaveCompleted returns success')
    assertEqual(1, result.wavesCompleted, 'wavesCompleted is 1')

    result = CombatStats.onWaveCompleted(0)
    assertTrue(not result.success, 'onWaveCompleted zero returns failure')

    result = CombatStats.onWaveCompleted(-1)
    assertTrue(not result.success, 'onWaveCompleted negative returns failure')

    result = CombatStats.onWaveCompleted('invalid')
    assertTrue(not result.success, 'onWaveCompleted invalid type returns failure')
  end

  do
    CombatStats.reset()

    local result = CombatStats.getComboMultiplier()
    assertTrue(result.success, 'getComboMultiplier no combo returns success')
    assertEqual(1.0, result.multiplier, 'multiplier is 1.0')

    CombatStats.onKill('basic')
    CombatStats.onKill('basic')
    CombatStats.onKill('basic')

    result = CombatStats.getComboMultiplier()
    assertTrue(result.success, 'getComboMultiplier with combo returns success')
    assertEqual(1.5, result.multiplier, 'multiplier is 1.5 for combo 3')
  end

  do
    CombatStats.reset()

    local result = CombatStats.getEfficiency()
    assertTrue(result.success, 'getEfficiency no playtime returns success')
    assertEqual(0, result.efficiency, 'efficiency is 0 with no playtime')

    CombatStats.addDamageDealt(100)
    CombatStats.updatePlayTime(10)

    result = CombatStats.getEfficiency()
    assertTrue(result.success, 'getEfficiency with data returns success')
    assertEqual(10, result.efficiency, 'efficiency is 10')
  end

  do
    CombatStats.reset()

    local result = CombatStats.getSurvivalRate()
    assertTrue(result.success, 'getSurvivalRate no data returns success')
    assertEqual(0, result.rate, 'survival rate is 0 with no data')

    CombatStats.onKill('basic')
    CombatStats.onKill('basic')
    CombatStats.onDeath()

    result = CombatStats.getSurvivalRate()
    assertTrue(result.success, 'getSurvivalRate with data returns success')
    assertTrue(result.rate > 0, 'survival rate is positive')
  end

  do
    CombatStats.reset()

    CombatStats.addScore(1000)
    CombatStats.onKill('basic')
    CombatStats.onKill('basic')
    CombatStats.onSkillUse('fireball', true)
    CombatStats.onProjectileFired()
    CombatStats.onProjectileHit()
    CombatStats.addDamageDealt(100)
    CombatStats.updatePlayTime(10)

    local result = CombatStats.calculateFinalScore()
    assertTrue(result.success, 'calculateFinalScore returns success')
    assertNotNil(result.finalScore, 'finalScore exists')
    assertTrue(result.finalScore > 0, 'finalScore is positive')
    assertNotNil(result.breakdown, 'breakdown exists')
  end

  do
    CombatStats.reset()

    CombatStats.addScore(500)
    CombatStats.onKill('basic')

    local result = CombatStats.getRankThresholds()
    assertTrue(result.success, 'getRankThresholds returns success')
    assertNotNil(result.thresholds, 'thresholds exists')
    assertEqual(10000, result.thresholds.S, 'S threshold')
    assertEqual(5000, result.thresholds.A, 'A threshold')
    assertEqual(2500, result.thresholds.B, 'B threshold')
    assertEqual(1000, result.thresholds.C, 'C threshold')
    assertEqual(0, result.thresholds.D, 'D threshold')
  end

  do
    CombatStats.reset()

    CombatStats.onKill('basic')
    CombatStats.onKill('fast')
    CombatStats.onKill('basic')

    local stats = CombatStats.getStats().stats
    assertEqual(2, stats.enemiesDefeated['basic'], 'basic enemies defeated')
    assertEqual(1, stats.enemiesDefeated['fast'], 'fast enemies defeated')
  end

  do
    CombatStats.reset()

    CombatStats.onSkillUse('fireball')
    CombatStats.onSkillUse('ice')
    CombatStats.onSkillUse('fireball')

    local stats = CombatStats.getStats().stats
    assertEqual(2, stats.skillsUsedBreakdown['fireball'], 'fireball used 2 times')
    assertEqual(1, stats.skillsUsedBreakdown['ice'], 'ice used 1 time')
  end

  print('==========================================')
  print(string.format('Results: %d passed, %d failed', tests.passed, tests.failed))
  print('==========================================')

  return tests.passed, tests.failed
end

local passed, failed = runTests()

return {
  passed = passed,
  failed = failed,
  total = passed + failed
}