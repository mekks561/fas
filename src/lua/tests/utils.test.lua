--[[
==========================================
通用工具模块单元测试
Utilities Module Unit Tests

测试覆盖:
- 数学运算工具（向量、距离、插值、随机等）
- 表操作工具（深拷贝、浅拷贝、合并、排序等）
- 类型检查工具
- 字符串处理工具
- 碰撞检测工具
==========================================
]]--

local Utils = require('utils')

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
  print('==========================================')
  print('Utilities Module Unit Tests')
  print('==========================================')

  -- 测试1: 向量长度计算
  do
    local result = Utils.vectorLength(3, 4)
    assertTrue(result.success, 'vectorLength returns success')
    assertEqual(5, result.length, 'vector (3,4) length is 5')
  end

  -- 测试2: 向量归一化
  do
    local result = Utils.normalizeVector(3, 4)
    assertTrue(result.success, 'normalizeVector returns success')
    assertEqual(0.6, result.x, 'normalized x')
    assertEqual(0.8, result.y, 'normalized y')

    result = Utils.normalizeVector(0, 0)
    assertTrue(result.success, 'normalize zero vector returns success')
    assertEqual(0, result.x, 'zero vector x')
    assertEqual(0, result.y, 'zero vector y')
  end

  -- 测试3: 向量点积
  do
    local result = Utils.dotProduct(1, 0, 0, 1)
    assertTrue(result.success, 'dotProduct perpendicular vectors returns success')
    assertEqual(0, result.dot, 'perpendicular vectors dot product')

    result = Utils.dotProduct(2, 3, 4, 5)
    assertTrue(result.success, 'dotProduct returns success')
    assertEqual(23, result.dot, 'dot product: 2*4 + 3*5 = 23')
  end

  -- 测试4: 距离计算
  do
    local result = Utils.distance(0, 0, 3, 4)
    assertTrue(result.success, 'distance returns success')
    assertEqual(5, result.distance, 'distance between (0,0) and (3,4)')
  end

  -- 测试5: 角度转弧度
  do
    local result = Utils.degreesToRadians(180)
    assertTrue(result.success, 'degreesToRadians returns success')
    assertEqual(math.pi, result.radians, '180 degrees = pi radians')
  end

  -- 测试6: 弧度转角度
  do
    local result = Utils.radiansToDegrees(math.pi)
    assertTrue(result.success, 'radiansToDegrees returns success')
    assertEqual(180, result.degrees, 'pi radians = 180 degrees')
  end

  -- 测试7: 计算角度
  do
    local result = Utils.calculateAngle(0, 0, 1, 0)
    assertTrue(result.success, 'calculateAngle returns success')
    assertEqual(0, result.angle, 'angle from (0,0) to (1,0)')

    result = Utils.calculateAngle(0, 0, 0, 1)
    assertTrue(result.success, 'calculateAngle returns success')
    assertEqual(math.pi / 2, result.angle, 'angle from (0,0) to (0,1)')
  end

  -- 测试8: 线性插值
  do
    local result = Utils.lerp(0, 100, 0.5)
    assertTrue(result.success, 'lerp returns success')
    assertEqual(50, result.value, 'lerp(0, 100, 0.5) = 50')

    result = Utils.lerp(10, 20, 0)
    assertEqual(10, result.value, 'lerp at 0')

    result = Utils.lerp(10, 20, 1)
    assertEqual(20, result.value, 'lerp at 1')

    result = Utils.lerp(10, 20, -1)
    assertEqual(10, result.value, 'lerp clamps below 0')

    result = Utils.lerp(10, 20, 2)
    assertEqual(20, result.value, 'lerp clamps above 1')
  end

  -- 测试9: 向量线性插值
  do
    local result = Utils.vectorLerp(0, 0, 10, 20, 0.5)
    assertTrue(result.success, 'vectorLerp returns success')
    assertEqual(5, result.x, 'vector lerp x')
    assertEqual(10, result.y, 'vector lerp y')
  end

  -- 测试10: clamp
  do
    local result = Utils.clamp(5, 0, 10)
    assertTrue(result.success, 'clamp within range returns success')
    assertEqual(5, result.value, 'clamp within range')

    result = Utils.clamp(-5, 0, 10)
    assertEqual(0, result.value, 'clamp below range')

    result = Utils.clamp(15, 0, 10)
    assertEqual(10, result.value, 'clamp above range')
  end

  -- 测试11: 随机整数
  do
    local result = Utils.randomInt(1, 10)
    assertTrue(result.success, 'randomInt returns success')
    assertTrue(result.value >= 1 and result.value <= 10, 'randomInt in range')
  end

  -- 测试12: 随机浮点数
  do
    local result = Utils.randomFloat(0, 1)
    assertTrue(result.success, 'randomFloat returns success')
    assertTrue(result.value >= 0 and result.value <= 1, 'randomFloat in range')
  end

  -- 测试13: 表深拷贝
  do
    local original = { a = 1, b = { c = 2, d = { e = 3 } } }
    local result = Utils.deepCopy(original)
    assertTrue(result.success, 'deepCopy returns success')
    assertNotNil(result.copy, 'deepCopy returns copy')
    assertEqual(1, result.copy.a, 'deepCopy top level')
    assertEqual(2, result.copy.b.c, 'deepCopy nested')
    assertEqual(3, result.copy.b.d.e, 'deepCopy deeply nested')

    original.b.d.e = 4
    assertEqual(3, result.copy.b.d.e, 'deepCopy independent')
  end

  -- 测试14: 表浅拷贝
  do
    local original = { a = 1, b = { c = 2 } }
    local result = Utils.shallowCopy(original)
    assertTrue(result.success, 'shallowCopy returns success')
    assertEqual(1, result.copy.a, 'shallowCopy top level')
    assertEqual(2, result.copy.b.c, 'shallowCopy nested')

    original.b.c = 3
    assertEqual(3, result.copy.b.c, 'shallowCopy shared nested')
  end

  -- 测试15: 合并表
  do
    local dest = { a = 1, b = 2 }
    local src = { b = 3, c = 4 }
    local result = Utils.mergeTables(dest, src)
    assertTrue(result.success, 'mergeTables returns success')
    assertEqual(1, result.merged.a, 'mergeTables a preserved')
    assertEqual(3, result.merged.b, 'mergeTables b overwritten')
    assertEqual(4, result.merged.c, 'mergeTables c added')
  end

  -- 测试16: 表长度
  do
    local result = Utils.tableLength({ a = 1, b = 2, c = 3 })
    assertTrue(result.success, 'tableLength returns success')
    assertEqual(3, result.length, 'table with 3 keys')
  end

  -- 测试17: 表包含
  do
    local result = Utils.tableContains({ a = 1, b = 2 }, 2)
    assertTrue(result.success, 'tableContains returns success')
    assertTrue(result.found, 'table contains value')
    assertEqual('b', result.key, 'table contains key')

    result = Utils.tableContains({ a = 1, b = 2 }, 3)
    assertTrue(not result.found, 'table does not contain value')
  end

  -- 测试18: 反转数组
  do
    local result = Utils.reverseArray({ 1, 2, 3, 4, 5 })
    assertTrue(result.success, 'reverseArray returns success')
    assertEqual(5, result.reversed[1], 'first element')
    assertEqual(1, result.reversed[5], 'last element')
  end

  -- 测试19: 数组去重
  do
    local result = Utils.uniqueArray({ 1, 2, 2, 3, 3, 3, 4 })
    assertTrue(result.success, 'uniqueArray returns success')
    assertEqual(4, #result.unique, 'unique array length')
  end

  -- 测试20: 按键排序
  do
    local data = { { name = 'Bob', age = 30 }, { name = 'Alice', age = 25 }, { name = 'Charlie', age = 35 } }
    local result = Utils.sortByKey(data, 'age')
    assertTrue(result.success, 'sortByKey returns success')
    assertEqual('Alice', result.sorted[1].name, 'sorted first')
    assertEqual('Charlie', result.sorted[3].name, 'sorted last')
  end

  -- 测试21: 类型检查
  do
    assertTrue(Utils.isString('test'), 'isString')
    assertTrue(Utils.isNumber(123), 'isNumber')
    assertTrue(Utils.isInteger(5), 'isInteger')
    assertTrue(Utils.isTable({}), 'isTable')
    assertTrue(Utils.isFunction(function() end), 'isFunction')
    assertTrue(Utils.isBoolean(true), 'isBoolean')
    assertTrue(Utils.isNil(nil), 'isNil')

    assertTrue(not Utils.isString(123), 'isString negative')
    assertTrue(not Utils.isNumber('123'), 'isNumber negative')
  end

  -- 测试22: 范围检查
  do
    local result = Utils.isInRange(5, 0, 10)
    assertTrue(result.success, 'isInRange returns success')
    assertTrue(result.inRange, 'value in range')

    result = Utils.isInRange(-1, 0, 10)
    assertTrue(not result.inRange, 'value below range')

    result = Utils.isInRange(11, 0, 10)
    assertTrue(not result.inRange, 'value above range')
  end

  -- 测试23: 字符串处理
  do
    local result = Utils.toLowerCase('HELLO')
    assertTrue(result.success, 'toLowerCase returns success')
    assertEqual('hello', result.result, 'toLowerCase')

    result = Utils.toUpperCase('hello')
    assertEqual('HELLO', result.result, 'toUpperCase')

    result = Utils.trim('  hello world  ')
    assertEqual('hello world', result.result, 'trim')

    result = Utils.split('a,b,c', ',')
    assertEqual(3, #result.parts, 'split length')
    assertEqual('a', result.parts[1], 'split first')

    result = Utils.replace('hello world', 'world', 'lua')
    assertEqual('hello lua', result.result, 'replace')

    result = Utils.startsWith('hello', 'he')
    assertTrue(result.startsWith, 'startsWith')

    result = Utils.endsWith('hello', 'lo')
    assertTrue(result.endsWith, 'endsWith')

    result = Utils.formatNumber(3.14159, 2)
    assertEqual('3.14', result.result, 'formatNumber')
  end

  -- 测试24: 时间工具
  do
    local result = Utils.getTimestampSeconds()
    assertTrue(result.success, 'getTimestampSeconds returns success')
    assertNotNil(result.timestamp, 'timestamp exists')

    result = Utils.formatTime(65)
    assertTrue(result.success, 'formatTime returns success')
    assertEqual('1:05', result.formatted, 'formatTime 65 seconds')

    result = Utils.formatTime(3665)
    assertEqual('1:01:05', result.formatted, 'formatTime 3665 seconds')

    result = Utils.timeDifference(100, 150)
    assertTrue(result.success, 'timeDifference returns success')
    assertEqual(50, result.diff, 'timeDifference')
  end

  -- 测试25: 碰撞检测
  do
    local result = Utils.checkCircleCollision(0, 0, 5, 3, 0, 5)
    assertTrue(result.success, 'checkCircleCollision returns success')
    assertTrue(result.collided, 'circles collide')

    result = Utils.checkCircleCollision(0, 0, 5, 15, 0, 5)
    assertTrue(not result.collided, 'circles do not collide')

    result = Utils.checkRectCollision(0, 0, 10, 10, 5, 5, 10, 10)
    assertTrue(result.success, 'checkRectCollision returns success')
    assertTrue(result.collided, 'rectangles collide')

    result = Utils.checkRectCollision(0, 0, 5, 5, 10, 10, 5, 5)
    assertTrue(not result.collided, 'rectangles do not collide')

    result = Utils.pointInRect(5, 5, 0, 0, 10, 10)
    assertTrue(result.success, 'pointInRect returns success')
    assertTrue(result.inside, 'point inside rect')

    result = Utils.pointInRect(15, 15, 0, 0, 10, 10)
    assertTrue(not result.inside, 'point outside rect')

    result = Utils.pointInCircle(3, 0, 0, 0, 5)
    assertTrue(result.success, 'pointInCircle returns success')
    assertTrue(result.inside, 'point inside circle')

    result = Utils.pointInCircle(6, 0, 0, 0, 5)
    assertTrue(not result.inside, 'point outside circle')
  end

  -- 测试26: 空检查
  do
    local result = Utils.isEmptyString('')
    assertTrue(result.success, 'isEmptyString returns success')
    assertTrue(result.isEmpty, 'empty string')

    result = Utils.isEmptyString('hello')
    assertTrue(not result.isEmpty, 'non-empty string')

    result = Utils.isEmptyTable({})
    assertTrue(result.success, 'isEmptyTable returns success')
    assertTrue(result.isEmpty, 'empty table')

    result = Utils.isEmptyTable({ a = 1 })
    assertTrue(not result.isEmpty, 'non-empty table')
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