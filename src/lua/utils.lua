--[[
==========================================
通用工具模块 - Utilities Module
Fighter Game Lua Script Module

功能概述:
- 数学运算工具（向量、矩阵、插值、随机等）
- 字符串处理工具
- 表操作工具（深拷贝、合并、遍历等）
- 类型检查和验证工具
- 时间和日期工具

作者: Fighter Game Team
版本: 1.0.0
最后更新: 2026-07-14

注意事项:
- 本模块使用局部变量模式，避免全局命名空间污染
- 所有函数均进行参数验证
- 返回值统一使用 table 结构，包含 success 字段
- 性能敏感函数使用局部变量缓存
==========================================
]]--

local Utils = {}

-- 版本信息
Utils.VERSION = "1.0.0"
Utils.AUTHOR = "Fighter Game Team"

-- ==========================================
-- 数学运算工具
-- ==========================================

--[[
向量长度计算
@param x: number - X 分量
@param y: number - Y 分量
@return: table - { success, length, error }
]]--
function Utils.vectorLength(x, y)
  if type(x) ~= "number" or type(y) ~= "number" then
    return { success = false, error = "x and y must be numbers" }
  end

  return { success = true, length = math.sqrt(x * x + y * y) }
end

--[[
向量归一化
@param x: number - X 分量
@param y: number - Y 分量
@return: table - { success, x, y, error }
]]--
function Utils.normalizeVector(x, y)
  if type(x) ~= "number" or type(y) ~= "number" then
    return { success = false, error = "x and y must be numbers" }
  end

  local length = math.sqrt(x * x + y * y)
  if length == 0 then
    return { success = true, x = 0, y = 0 }
  end

  return { success = true, x = x / length, y = y / length }
end

--[[
向量点积
@param x1, y1: number - 第一个向量
@param x2, y2: number - 第二个向量
@return: table - { success, dot, error }
]]--
function Utils.dotProduct(x1, y1, x2, y2)
  if type(x1) ~= "number" or type(y1) ~= "number" then
    return { success = false, error = "first vector components must be numbers" }
  end

  if type(x2) ~= "number" or type(y2) ~= "number" then
    return { success = false, error = "second vector components must be numbers" }
  end

  return { success = true, dot = x1 * x2 + y1 * y2 }
end

--[[
计算两点之间距离
@param x1, y1: number - 第一个点
@param x2, y2: number - 第二个点
@return: table - { success, distance, error }
]]--
function Utils.distance(x1, y1, x2, y2)
  if type(x1) ~= "number" or type(y1) ~= "number" then
    return { success = false, error = "first point coordinates must be numbers" }
  end

  if type(x2) ~= "number" or type(y2) ~= "number" then
    return { success = false, error = "second point coordinates must be numbers" }
  end

  local dx = x2 - x1
  local dy = y2 - y1
  return { success = true, distance = math.sqrt(dx * dx + dy * dy) }
end

--[[
角度转弧度
@param degrees: number - 角度值
@return: table - { success, radians, error }
]]--
function Utils.degreesToRadians(degrees)
  if type(degrees) ~= "number" then
    return { success = false, error = "degrees must be a number" }
  end

  return { success = true, radians = degrees * 0.017453292519943295 }
end

--[[
弧度转角度
@param radians: number - 弧度值
@return: table - { success, degrees, error }
]]--
function Utils.radiansToDegrees(radians)
  if type(radians) ~= "number" then
    return { success = false, error = "radians must be a number" }
  end

  return { success = true, degrees = radians * 57.29577951308232 }
end

--[[
计算两点之间的角度（弧度）
@param x1, y1: number - 起点坐标
@param x2, y2: number - 终点坐标
@return: table - { success, angle, error }
]]--
function Utils.calculateAngle(x1, y1, x2, y2)
  if type(x1) ~= "number" or type(y1) ~= "number" then
    return { success = false, error = "start point coordinates must be numbers" }
  end

  if type(x2) ~= "number" or type(y2) ~= "number" then
    return { success = false, error = "end point coordinates must be numbers" }
  end

  return { success = true, angle = math.atan2(y2 - y1, x2 - x1) }
end

--[[
线性插值
@param start: number - 起始值
@param endVal: number - 结束值
@param t: number - 插值因子 (0-1)
@return: table - { success, value, error }
]]--
function Utils.lerp(start, endVal, t)
  if type(start) ~= "number" then
    return { success = false, error = "start must be a number" }
  end

  if type(endVal) ~= "number" then
    return { success = false, error = "endVal must be a number" }
  end

  if type(t) ~= "number" then
    t = 0
  end

  t = math.max(0, math.min(1, t))
  return { success = true, value = start + (endVal - start) * t }
end

--[[
向量线性插值
@param x1, y1: number - 起始向量
@param x2, y2: number - 结束向量
@param t: number - 插值因子 (0-1)
@return: table - { success, x, y, error }
]]--
function Utils.vectorLerp(x1, y1, x2, y2, t)
  if type(x1) ~= "number" or type(y1) ~= "number" then
    return { success = false, error = "start vector components must be numbers" }
  end

  if type(x2) ~= "number" or type(y2) ~= "number" then
    return { success = false, error = "end vector components must be numbers" }
  end

  if type(t) ~= "number" then
    t = 0
  end

  t = math.max(0, math.min(1, t))
  return {
    success = true,
    x = x1 + (x2 - x1) * t,
    y = y1 + (y2 - y1) * t
  }
end

--[[
限制值在范围内
@param val: number - 要限制的值
@param min: number - 最小值
@param max: number - 最大值
@return: table - { success, value, error }
]]--
function Utils.clamp(val, min, max)
  if type(val) ~= "number" then
    return { success = false, error = "val must be a number" }
  end

  if type(min) ~= "number" then
    return { success = false, error = "min must be a number" }
  end

  if type(max) ~= "number" then
    return { success = false, error = "max must be a number" }
  end

  return { success = true, value = math.max(min, math.min(max, val)) }
end

--[[
随机整数
@param min: number - 最小值（包含）
@param max: number - 最大值（包含）
@return: table - { success, value, error }
]]--
function Utils.randomInt(min, max)
  if type(min) ~= "number" then
    return { success = false, error = "min must be a number" }
  end

  if type(max) ~= "number" then
    return { success = false, error = "max must be a number" }
  end

  if min > max then
    min, max = max, min
  end

  return { success = true, value = math.random(min, max) }
end

--[[
随机浮点数
@param min: number - 最小值
@param max: number - 最大值
@return: table - { success, value, error }
]]--
function Utils.randomFloat(min, max)
  if type(min) ~= "number" then
    return { success = false, error = "min must be a number" }
  end

  if type(max) ~= "number" then
    return { success = false, error = "max must be a number" }
  end

  if min > max then
    min, max = max, min
  end

  return { success = true, value = min + math.random() * (max - min) }
end

-- ==========================================
-- 表操作工具
-- ==========================================

--[[
表深拷贝
@param t: table - 要拷贝的表
@param seen: table - 已拷贝的表（内部使用）
@return: table - { success, copy, error }
]]--
function Utils.deepCopy(t, seen)
  if type(t) ~= "table" then
    return { success = false, error = "t must be a table" }
  end

  seen = seen or {}
  if seen[t] then
    return { success = true, copy = seen[t] }
  end

  local copy = {}
  seen[t] = copy

  for key, value in pairs(t) do
    if type(value) == "table" then
      local result = Utils.deepCopy(value, seen)
      if result.success then
        copy[key] = result.copy
      else
        return result
      end
    else
      copy[key] = value
    end
  end

  return { success = true, copy = copy }
end

--[[
表浅拷贝
@param t: table - 要拷贝的表
@return: table - { success, copy, error }
]]--
function Utils.shallowCopy(t)
  if type(t) ~= "table" then
    return { success = false, error = "t must be a table" }
  end

  local copy = {}
  for key, value in pairs(t) do
    copy[key] = value
  end

  return { success = true, copy = copy }
end

--[[
合并两个表
@param dest: table - 目标表
@param src: table - 源表
@param deep: boolean - 是否深拷贝（默认false）
@return: table - { success, merged, error }
]]--
function Utils.mergeTables(dest, src, deep)
  if type(dest) ~= "table" then
    return { success = false, error = "dest must be a table" }
  end

  if type(src) ~= "table" then
    return { success = false, error = "src must be a table" }
  end

  deep = deep or false

  for key, value in pairs(src) do
    if deep and type(value) == "table" then
      if type(dest[key]) ~= "table" then
        dest[key] = {}
      end
      local result = Utils.mergeTables(dest[key], value, deep)
      if not result.success then
        return result
      end
    else
      dest[key] = value
    end
  end

  return { success = true, merged = dest }
end

--[[
表长度（包含数组和哈希部分）
@param t: table - 要计算长度的表
@return: table - { success, length, error }
]]--
function Utils.tableLength(t)
  if type(t) ~= "table" then
    return { success = false, error = "t must be a table" }
  end

  local count = 0
  for _ in pairs(t) do
    count = count + 1
  end

  return { success = true, length = count }
end

--[[
检查表是否包含指定值
@param t: table - 要检查的表
@param value: any - 要查找的值
@return: table - { success, found, key, error }
]]--
function Utils.tableContains(t, value)
  if type(t) ~= "table" then
    return { success = false, error = "t must be a table" }
  end

  for key, val in pairs(t) do
    if val == value then
      return { success = true, found = true, key = key }
    end
  end

  return { success = true, found = false, key = nil }
end

--[[
反转数组
@param t: table - 要反转的数组
@return: table - { success, reversed, error }
]]--
function Utils.reverseArray(t)
  if type(t) ~= "table" then
    return { success = false, error = "t must be a table" }
  end

  local reversed = {}
  local length = #t

  for i = length, 1, -1 do
    reversed[length - i + 1] = t[i]
  end

  return { success = true, reversed = reversed }
end

--[[
数组去重
@param t: table - 要去重的数组
@return: table - { success, unique, error }
]]--
function Utils.uniqueArray(t)
  if type(t) ~= "table" then
    return { success = false, error = "t must be a table" }
  end

  local seen = {}
  local unique = {}

  for _, value in ipairs(t) do
    if not seen[value] then
      seen[value] = true
      unique[#unique + 1] = value
    end
  end

  return { success = true, unique = unique }
end

--[[
按指定键排序表
@param t: table - 要排序的表
@param key: string - 排序键
@param desc: boolean - 是否降序（默认false）
@return: table - { success, sorted, error }
]]--
function Utils.sortByKey(t, key, desc)
  if type(t) ~= "table" then
    return { success = false, error = "t must be a table" }
  end

  if type(key) ~= "string" then
    return { success = false, error = "key must be a string" }
  end

  desc = desc or false
  local sorted = Utils.shallowCopy(t).copy

  table.sort(sorted, function(a, b)
    if desc then
      return a[key] > b[key]
    else
      return a[key] < b[key]
    end
  end)

  return { success = true, sorted = sorted }
end

-- ==========================================
-- 类型检查和验证工具
-- ==========================================

--[[
检查是否为字符串
@param value: any - 要检查的值
@return: boolean
]]--
function Utils.isString(value)
  return type(value) == "string"
end

--[[
检查是否为数字
@param value: any - 要检查的值
@return: boolean
]]--
function Utils.isNumber(value)
  return type(value) == "number"
end

--[[
检查是否为整数
@param value: any - 要检查的值
@return: boolean
]]--
function Utils.isInteger(value)
  return type(value) == "number" and value == math.floor(value)
end

--[[
检查是否为表
@param value: any - 要检查的值
@return: boolean
]]--
function Utils.isTable(value)
  return type(value) == "table"
end

--[[
检查是否为函数
@param value: any - 要检查的值
@return: boolean
]]--
function Utils.isFunction(value)
  return type(value) == "function"
end

--[[
检查是否为布尔值
@param value: any - 要检查的值
@return: boolean
]]--
function Utils.isBoolean(value)
  return type(value) == "boolean"
end

--[[
检查是否为nil
@param value: any - 要检查的值
@return: boolean
]]--
function Utils.isNil(value)
  return value == nil
end

--[[
检查值是否在指定范围内
@param value: number - 要检查的值
@param min: number - 最小值
@param max: number - 最大值
@return: table - { success, inRange, error }
]]--
function Utils.isInRange(value, min, max)
  if type(value) ~= "number" then
    return { success = false, error = "value must be a number" }
  end

  if type(min) ~= "number" then
    return { success = false, error = "min must be a number" }
  end

  if type(max) ~= "number" then
    return { success = false, error = "max must be a number" }
  end

  return { success = true, inRange = value >= min and value <= max }
end

--[[
检查字符串是否为空
@param str: string - 要检查的字符串
@return: table - { success, isEmpty, error }
]]--
function Utils.isEmptyString(str)
  if type(str) ~= "string" then
    return { success = false, error = "str must be a string" }
  end

  return { success = true, isEmpty = str == "" }
end

--[[
检查表是否为空
@param t: table - 要检查的表
@return: table - { success, isEmpty, error }
]]--
function Utils.isEmptyTable(t)
  if type(t) ~= "table" then
    return { success = false, error = "t must be a table" }
  end

  return { success = true, isEmpty = next(t) == nil }
end

-- ==========================================
-- 字符串处理工具
-- ==========================================

--[[
字符串转小写
@param str: string - 要转换的字符串
@return: table - { success, result, error }
]]--
function Utils.toLowerCase(str)
  if type(str) ~= "string" then
    return { success = false, error = "str must be a string" }
  end

  return { success = true, result = str:lower() }
end

--[[
字符串转大写
@param str: string - 要转换的字符串
@return: table - { success, result, error }
]]--
function Utils.toUpperCase(str)
  if type(str) ~= "string" then
    return { success = false, error = "str must be a string" }
  end

  return { success = true, result = str:upper() }
end

--[[
字符串去除首尾空格
@param str: string - 要处理的字符串
@return: table - { success, result, error }
]]--
function Utils.trim(str)
  if type(str) ~= "string" then
    return { success = false, error = "str must be a string" }
  end

  return { success = true, result = str:match("^%s*(.-)%s*$") }
end

--[[
字符串分割
@param str: string - 要分割的字符串
@param delimiter: string - 分隔符（默认空格）
@return: table - { success, parts, error }
]]--
function Utils.split(str, delimiter)
  if type(str) ~= "string" then
    return { success = false, error = "str must be a string" }
  end

  delimiter = delimiter or " "
  if type(delimiter) ~= "string" then
    return { success = false, error = "delimiter must be a string" }
  end

  local parts = {}
  local pattern = string.format("([^%s]+)", delimiter)

  for part in string.gmatch(str, pattern) do
    parts[#parts + 1] = part
  end

  return { success = true, parts = parts }
end

--[[
字符串替换
@param str: string - 原字符串
@param old: string - 要替换的子串
@param new: string - 新子串
@return: table - { success, result, error }
]]--
function Utils.replace(str, old, new)
  if type(str) ~= "string" then
    return { success = false, error = "str must be a string" }
  end

  if type(old) ~= "string" then
    return { success = false, error = "old must be a string" }
  end

  if type(new) ~= "string" then
    return { success = false, error = "new must be a string" }
  end

  return { success = true, result = str:gsub(old, new) }
end

--[[
检查字符串是否以指定前缀开头
@param str: string - 要检查的字符串
@param prefix: string - 前缀
@return: table - { success, startsWith, error }
]]--
function Utils.startsWith(str, prefix)
  if type(str) ~= "string" then
    return { success = false, error = "str must be a string" }
  end

  if type(prefix) ~= "string" then
    return { success = false, error = "prefix must be a string" }
  end

  return { success = true, startsWith = str:sub(1, #prefix) == prefix }
end

--[[
检查字符串是否以指定后缀结尾
@param str: string - 要检查的字符串
@param suffix: string - 后缀
@return: table - { success, endsWith, error }
]]--
function Utils.endsWith(str, suffix)
  if type(str) ~= "string" then
    return { success = false, error = "str must be a string" }
  end

  if type(suffix) ~= "string" then
    return { success = false, error = "suffix must be a string" }
  end

  return { success = true, endsWith = str:sub(-#suffix) == suffix }
end

--[[
字符串格式化（数字转字符串）
@param value: number - 要格式化的数字
@param decimals: number - 小数位数（默认0）
@return: table - { success, result, error }
]]--
function Utils.formatNumber(value, decimals)
  if type(value) ~= "number" then
    return { success = false, error = "value must be a number" }
  end

  decimals = decimals or 0
  if type(decimals) ~= "number" or decimals < 0 then
    decimals = 0
  end

  local formatStr = "%." .. tostring(decimals) .. "f"
  return { success = true, result = string.format(formatStr, value) }
end

-- ==========================================
-- 时间和日期工具
-- ==========================================

--[[
获取当前时间戳（毫秒）
@return: table - { success, timestamp }
]]--
function Utils.getTimestamp()
  return { success = true, timestamp = os.time() * 1000 }
end

--[[
获取当前时间戳（秒）
@return: table - { success, timestamp }
]]--
function Utils.getTimestampSeconds()
  return { success = true, timestamp = os.time() }
end

--[[
格式化时间（秒转可读格式）
@param seconds: number - 秒数
@return: table - { success, formatted, error }
]]--
function Utils.formatTime(seconds)
  if type(seconds) ~= "number" or seconds < 0 then
    return { success = false, error = "seconds must be a non-negative number" }
  end

  local hours = math.floor(seconds / 3600)
  local minutes = math.floor((seconds % 3600) / 60)
  local secs = math.floor(seconds % 60)

  if hours > 0 then
    return { success = true, formatted = string.format("%d:%02d:%02d", hours, minutes, secs) }
  elseif minutes > 0 then
    return { success = true, formatted = string.format("%d:%02d", minutes, secs) }
  else
    return { success = true, formatted = string.format("%d", secs) }
  end
end

--[[
计算两个时间戳之间的差值（秒）
@param timestamp1: number - 第一个时间戳
@param timestamp2: number - 第二个时间戳
@return: table - { success, diff, error }
]]--
function Utils.timeDifference(timestamp1, timestamp2)
  if type(timestamp1) ~= "number" then
    return { success = false, error = "timestamp1 must be a number" }
  end

  if type(timestamp2) ~= "number" then
    return { success = false, error = "timestamp2 must be a number" }
  end

  return { success = true, diff = math.abs(timestamp1 - timestamp2) }
end

-- ==========================================
-- 碰撞检测工具
-- ==========================================

--[[
圆形碰撞检测
@param x1, y1: number - 第一个圆的中心坐标
@param r1: number - 第一个圆的半径
@param x2, y2: number - 第二个圆的中心坐标
@param r2: number - 第二个圆的半径
@return: table - { success, collided, error }
]]--
function Utils.checkCircleCollision(x1, y1, r1, x2, y2, r2)
  if type(x1) ~= "number" or type(y1) ~= "number" or type(r1) ~= "number" then
    return { success = false, error = "first circle parameters must be numbers" }
  end

  if type(x2) ~= "number" or type(y2) ~= "number" or type(r2) ~= "number" then
    return { success = false, error = "second circle parameters must be numbers" }
  end

  if r1 <= 0 or r2 <= 0 then
    return { success = false, error = "radii must be positive" }
  end

  local dx = x2 - x1
  local dy = y2 - y1
  local distance = math.sqrt(dx * dx + dy * dy)
  return { success = true, collided = distance < (r1 + r2) }
end

--[[
矩形碰撞检测（轴对齐）
@param x1, y1: number - 第一个矩形的左上角坐标
@param w1, h1: number - 第一个矩形的宽高
@param x2, y2: number - 第二个矩形的左上角坐标
@param w2, h2: number - 第二个矩形的宽高
@return: table - { success, collided, error }
]]--
function Utils.checkRectCollision(x1, y1, w1, h1, x2, y2, w2, h2)
  if type(x1) ~= "number" or type(y1) ~= "number" or type(w1) ~= "number" or type(h1) ~= "number" then
    return { success = false, error = "first rectangle parameters must be numbers" }
  end

  if type(x2) ~= "number" or type(y2) ~= "number" or type(w2) ~= "number" or type(h2) ~= "number" then
    return { success = false, error = "second rectangle parameters must be numbers" }
  end

  if w1 <= 0 or h1 <= 0 or w2 <= 0 or h2 <= 0 then
    return { success = false, error = "dimensions must be positive" }
  end

  local collided = (x1 < x2 + w2) and (x1 + w1 > x2) and (y1 < y2 + h2) and (y1 + h1 > y2)
  return { success = true, collided = collided }
end

--[[
点在矩形内检测
@param px, py: number - 点的坐标
@param x, y: number - 矩形的左上角坐标
@param w, h: number - 矩形的宽高
@return: table - { success, inside, error }
]]--
function Utils.pointInRect(px, py, x, y, w, h)
  if type(px) ~= "number" or type(py) ~= "number" then
    return { success = false, error = "point coordinates must be numbers" }
  end

  if type(x) ~= "number" or type(y) ~= "number" or type(w) ~= "number" or type(h) ~= "number" then
    return { success = false, error = "rectangle parameters must be numbers" }
  end

  if w <= 0 or h <= 0 then
    return { success = false, error = "dimensions must be positive" }
  end

  local inside = (px >= x) and (px <= x + w) and (py >= y) and (py <= y + h)
  return { success = true, inside = inside }
end

--[[
点在圆内检测
@param px, py: number - 点的坐标
@param cx, cy: number - 圆心坐标
@param r: number - 圆的半径
@return: table - { success, inside, error }
]]--
function Utils.pointInCircle(px, py, cx, cy, r)
  if type(px) ~= "number" or type(py) ~= "number" then
    return { success = false, error = "point coordinates must be numbers" }
  end

  if type(cx) ~= "number" or type(cy) ~= "number" or type(r) ~= "number" then
    return { success = false, error = "circle parameters must be numbers" }
  end

  if r <= 0 then
    return { success = false, error = "radius must be positive" }
  end

  local dx = px - cx
  local dy = py - cy
  local distance = math.sqrt(dx * dx + dy * dy)
  return { success = true, inside = distance <= r }
end

return Utils