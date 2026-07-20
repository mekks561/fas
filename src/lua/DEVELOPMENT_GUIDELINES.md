# Lua 脚本开发规范

## 一、开发流程

### 1.1 需求分析
- 明确脚本的核心功能和使用场景
- 定义输入输出参数及边界条件
- 确定与TypeScript端的接口契约

### 1.2 设计阶段
- 采用模块化设计，拆分独立函数
- 规划数据结构和状态管理
- 设计错误处理机制

### 1.3 开发实现
- 遵循Lua语言规范，使用有意义的变量名
- 添加必要的注释说明
- 编写单元测试验证功能

### 1.4 测试验证
- 使用测试框架验证关键功能
- 进行性能分析和优化
- 验证边界条件和异常情况

### 1.5 部署上线
- 确保脚本兼容性
- 处理与其他系统的交互逻辑
- 准备热更新方案

## 二、代码规范

### 2.1 命名规范

```lua
-- ✅ 推荐
local MAX_HEALTH = 100
local playerState = { health = 100, speed = 5 }

function calculateDamage(base, multiplier)
    return base * multiplier
end

-- ❌ 不推荐
local maxHealth = 100  -- 常量应全大写
local ps = { h = 100, s = 5 }  -- 使用缩写降低可读性
function calcDmg(b, m) return b * m end  -- 函数名过于简短
```

### 2.2 注释规范

```lua
--[[
==========================================
模块/函数功能说明
==========================================
]]--

-- 单行注释：说明变量用途
local speed = 5.0  -- 移动速度

--[[
多行注释：说明函数功能、参数、返回值
@param baseDamage: number - 基础伤害
@param playerBonus: number - 玩家加成
@param difficultyMultiplier: number - 难度倍率
@return: table - { success, damage, error }
]]--
function calculateDamage(baseDamage, playerBonus, difficultyMultiplier)
    return math.floor(baseDamage * (1 + playerBonus) * difficultyMultiplier)
end
```

### 2.3 模块结构规范

所有Lua脚本必须使用局部模块模式，避免全局变量污染。

```lua
--[[
==========================================
模块文件头部注释
功能概述、作者、版本、注意事项
==========================================
]]--

local ModuleName = {}

-- 版本信息
ModuleName.VERSION = "1.0.0"
ModuleName.AUTHOR = "Fighter Game Team"

-- 私有配置数据（局部变量，不对外暴露）
local configData = {
    key1 = value1,
    key2 = value2
}

--[[
==========================================
私有函数（以下划线开头或使用local声明）
==========================================
]]--
local function _privateHelper(arg1, arg2)
    -- 内部辅助逻辑
    return arg1 + arg2
end

--[[
==========================================
公共接口（所有公共函数必须进行参数验证）
==========================================
]]--
function ModuleName.publicMethod(param1, param2)
    -- 参数类型验证
    if type(param1) ~= "string" then
        return { success = false, error = "param1 must be a string" }
    end
    
    -- 参数值验证
    if type(param2) ~= "number" or param2 < 0 then
        return { success = false, error = "param2 must be a non-negative number" }
    end
    
    -- 实现逻辑
    return { success = true, result = "success" }
end

--[[
==========================================
模块导出
==========================================
]]--
return ModuleName
```

### 2.4 参数验证标准

所有公共函数必须进行参数验证，遵循以下规则：

1. **类型检查**：验证每个参数的类型是否符合预期
2. **范围检查**：对数字类型进行范围验证（非负、正整数等）
3. **默认值处理**：对可选参数提供合理默认值
4. **错误返回**：统一返回 `{ success = false, error = "错误信息" }`

```lua
function GameConfig.getDifficultyConfig(level)
    -- 类型验证
    if type(level) ~= "string" then
        return { success = false, error = "level must be a string" }
    end
    
    -- 值验证
    local config = configData.difficulty[level]
    if not config then
        -- 提供默认值而不是报错
        return { success = true, config = configData.difficulty.normal }
    end
    
    return { success = true, config = config }
end

function EnemyAI.createEnemyAI(typeName, x, y)
    -- 必需参数验证
    if type(typeName) ~= "string" then
        return { success = false, error = "typeName must be a string" }
    end
    
    -- 可选参数默认值处理
    if type(x) ~= "number" then
        x = 0
    end
    
    if type(y) ~= "number" then
        y = 0
    end
    
    -- 业务逻辑验证
    local config = aiTypes[typeName]
    if not config then
        return { success = false, error = "unknown AI type: " .. typeName }
    end
    
    return { success = true, enemy = enemyInstance }
end
```

### 2.5 错误处理机制

统一使用 `{ success, result, error }` 返回结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 操作是否成功 |
| result | any | 成功时返回的结果数据 |
| error | string | 失败时的错误描述信息 |

```lua
-- ✅ 推荐：统一错误返回
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

-- ❌ 不推荐：使用error()抛出异常
function unsafeDistance(x1, y1, x2, y2)
    if type(x1) ~= "number" then
        error("x1 must be a number")
    end
    -- ...
end
```

## 三、最佳实践

### 3.1 避免全局变量

```lua
-- ✅ 推荐：使用局部模块
local SkillSystem = {}

function SkillSystem.createSkill(skillId)
    -- 实现
end

return SkillSystem

-- ❌ 不推荐：全局变量
SkillSystem = {}

function SkillSystem.createSkill(skillId)
    -- 实现
end
```

### 3.2 性能优化

```lua
-- ✅ 缓存计算结果
local cache = {}
local function getCachedResult(key)
    if not cache[key] then
        cache[key] = expensiveCalculation(key)
    end
    return cache[key]
end

-- ✅ 避免重复创建表
local tempVector = { x = 0, y = 0 }

function calculateVector(x1, y1, x2, y2)
    tempVector.x = x2 - x1
    tempVector.y = y2 - y1
    return tempVector
end

-- ✅ 使用局部变量加速访问
local math_sqrt = math.sqrt
local table_insert = table.insert

function calculateDistance(x1, y1, x2, y2)
    local dx = x2 - x1
    local dy = y2 - y1
    return math_sqrt(dx * dx + dy * dy)
end

-- ✅ 在update函数中缓存常用属性
function EnemyAI.updateAI(enemy, playerX, playerY, deltaTime)
    -- 性能优化：缓存局部变量
    local dx = playerX - enemy.x
    local dy = playerY - enemy.y
    local distance = math.sqrt(dx * dx + dy * dy)
    
    -- 避免重复计算
    if distance < enemy.detectRange then
        -- 使用缓存的dx, dy, distance
    end
end
```

### 3.3 状态管理

```lua
local StateMachine = {}
StateMachine.__index = StateMachine

function StateMachine.new(initialState)
    local self = setmetatable({}, StateMachine)
    self.currentState = initialState
    self.states = {
        idle = {
            enter = function() print("Entering idle") end,
            update = function(dt) -- idle logic end,
            exit = function() print("Exiting idle") end
        },
        active = {
            enter = function() print("Entering active") end,
            update = function(dt) -- active logic end,
            exit = function() print("Exiting active") end
        }
    }
    return self
end

function StateMachine:setState(newState)
    if self.states[self.currentState] then
        self.states[self.currentState].exit()
    end
    self.currentState = newState
    if self.states[self.currentState] then
        self.states[self.currentState].enter()
    end
end

function StateMachine:update(deltaTime)
    if self.states[self.currentState] then
        self.states[self.currentState].update(deltaTime)
    end
end
```

### 3.4 工具函数复用

将常用的工具函数抽取到 `utils.lua` 模块，避免代码重复：

```lua
-- utils.lua 提供统一的工具接口
local Utils = {}

-- 数学工具
function Utils.distance(x1, y1, x2, y2) ... end
function Utils.lerp(start, endVal, t) ... end
function Utils.clamp(val, min, max) ... end

-- 表操作工具
function Utils.deepCopy(t) ... end
function Utils.mergeTables(dest, src) ... end

-- 类型检查工具
function Utils.isNumber(value) ... end
function Utils.isString(value) ... end

-- 碰撞检测工具
function Utils.checkCircleCollision(...) ... end
function Utils.checkRectCollision(...) ... end

return Utils
```

## 四、测试规范

### 4.1 单元测试结构

使用 LuaUnit 测试框架，测试文件存放在 `tests/` 目录：

```lua
--[[
==========================================
游戏配置模块单元测试
==========================================
]]--
local GameConfig = require('config/game-config')

-- 测试获取难度配置
do
    local result = GameConfig.getDifficultyConfig('easy')
    assertTrue(result.success, 'getDifficultyConfig returns success')
    assertEqual(10.0, result.config.waveInterval, 'easy waveInterval')
end

do
    local result = GameConfig.getDifficultyConfig('invalid')
    assertTrue(result.success, 'invalid level falls back to normal')
    assertEqual('normal', result.config.enemySpeedMultiplier, 'fallback config')
end

-- 测试参数验证
do
    local result = GameConfig.getDifficultyConfig(123)
    assertFalse(result.success, 'number level returns failure')
    assertEqual('level must be a string', result.error, 'error message')
end

-- 测试伤害计算
do
    local result = GameConfig.calculateDamage(100, 0.5, 1.2)
    assertTrue(result.success, 'calculateDamage returns success')
    assertEqual(180, result.damage, 'damage calculation')
end

-- 测试边界条件
do
    local result = GameConfig.calculateDamage(-10, 0.5, 1.0)
    assertFalse(result.success, 'negative baseDamage returns failure')
end

-- 测试波次配置
do
    local result = GameConfig.getWaveEnemyCount(1)
    assertTrue(result.success, 'getWaveEnemyCount returns success')
    assertEqual(5, result.count, 'wave 1 enemy count')
end

do
    local result = GameConfig.getWaveEnemyCount(5)
    assertEqual(8, result.count, 'wave 5 enemy count with growth')
end

-- 测试Boss波次判断
do
    assertTrue(GameConfig.isBossWave(5).isBoss, 'wave 5 is boss wave')
    assertFalse(GameConfig.isBossWave(3).isBoss, 'wave 3 is not boss wave')
end

-- 测试碰撞检测
do
    local result = GameConfig.checkCircleCollision(0, 0, 5, 3, 4, 1)
    assertTrue(result.success, 'checkCircleCollision returns success')
    assertTrue(result.collided, 'circles collide')
end

do
    local result = GameConfig.checkCircleCollision(0, 0, 1, 10, 10, 1)
    assertFalse(result.collided, 'circles do not collide')
end
```

### 4.2 测试覆盖范围

| 测试类型 | 覆盖内容 |
|----------|----------|
| 功能测试 | 核心功能正确性 |
| 边界测试 | 空参数、异常值、边界条件 |
| 性能测试 | 函数执行时间、内存使用 |
| 集成测试 | 与TypeScript端交互 |
| 回归测试 | 修改后验证原有功能 |

### 4.3 测试命名规范

测试函数命名格式：`test[模块名][功能名]`

```lua
-- 示例测试用例命名
testGameConfigGetDifficultyConfig
testGameConfigCalculateDamage
testEnemyAICreateEnemyAI
testEnemyAIUpdateAI
testUtilsDistance
testUtilsDeepCopy
```

## 五、热更新规范

### 5.1 热更新流程

```lua
--[[
热更新安全检查
]]--
function onHotReload(newScript)
    -- 1. 保存当前状态
    local savedState = saveCurrentState()
    
    -- 2. 验证新脚本
    local success, error = pcall(function()
        loadstring(newScript)()
    end)
    
    if success then
        -- 3. 加载新脚本
        loadstring(newScript)()
        
        -- 4. 恢复状态
        restoreState(savedState)
        
        print("Hot reload successful")
    else
        -- 5. 回滚
        print("Hot reload failed:", error)
        print("Using previous version")
    end
end
```

### 5.2 热更新注意事项

- 保存关键状态（玩家数据、配置参数）
- 验证新脚本语法和逻辑正确性
- 处理状态兼容性（新版本可能需要迁移旧数据）
- 提供回滚机制

## 六、性能考虑

### 6.1 性能敏感区域

| 区域 | 优化策略 |
|------|----------|
| 每帧更新 | 避免创建新对象、缓存计算结果 |
| AI决策 | 减少距离计算、使用状态机 |
| 碰撞检测 | 使用空间分区、简化算法 |
| 字符串操作 | 避免频繁拼接、使用表代替 |

### 6.2 性能分析工具

```lua
-- 性能计时器
local function benchmark(name, func, ...)
    local start = os.clock()
    local result = func(...)
    local elapsed = os.clock() - start
    
    print(string.format("[Benchmark] %s took %.4fms", name, elapsed * 1000))
    return result
end

-- 使用示例
local result = benchmark("calculateDamage", calculateDamage, 100, 0.5, 1.2)
```

## 七、与TypeScript交互规范

### 7.1 数据传递

```lua
-- Lua 端：返回结构化数据
function getSkillStatus(skillId)
    local skill = LearnedSkills[skillId]
    if not skill then
        return nil
    end
    
    return {
        id = skillId,
        name = skill.name,
        state = skill.state,
        level = skill.level,
        currentCooldown = skill.currentCooldown,
        cooldownPercent = (skill.cooldown > 0) and (skill.currentCooldown / skill.cooldown * 100) or 0
    }
end
```

### 7.2 错误传递

```lua
-- Lua 端：返回错误信息
function castSkill(skillId, caster, target, resources)
    local canCast, reason = canCastSkill(skillId, resources)
    if not canCast then
        return {
            success = false,
            error = reason,
            skillId = skillId
        }
    end
    
    -- 执行逻辑
    return {
        success = true,
        skillId = skillId,
        effects = calculateEffects(skillId, caster, target),
        remainingCooldown = cooldown
    }
end
```

## 八、版本兼容性

### 8.1 版本管理

```lua
local MODULE_VERSION = "1.0.0"
local MIN_LUA_VERSION = "5.1"

-- 版本检查
function checkVersion()
    local luaVersion = _VERSION:match("Lua (%d+%.%d+)")
    if luaVersion < MIN_LUA_VERSION then
        error("Requires Lua " .. MIN_LUA_VERSION .. " or higher")
    end
    return true
end
```

### 8.2 向后兼容

- 保留旧函数接口
- 提供迁移工具
- 记录变更日志

---

## 附录

### A. 常用工具函数

```lua
-- 数学工具
local MathUtils = {}

MathUtils.clamp = function(val, min, max)
    if val < min then return min end
    if val > max then return max end
    return val
end

MathUtils.lerp = function(a, b, t)
    return a + (b - a) * t
end

MathUtils.distance = function(x1, y1, x2, y2)
    local dx = x2 - x1
    local dy = y2 - y1
    return math.sqrt(dx * dx + dy * dy)
end

return MathUtils
```

### B. 代码审查清单

- [ ] 变量和函数命名是否清晰有意义？
- [ ] 是否避免了全局变量？
- [ ] 是否使用了局部模块模式？
- [ ] 是否有参数验证？
- [ ] 是否使用了统一的错误处理结构？
- [ ] 是否添加了必要的注释？
- [ ] 是否有单元测试覆盖？
- [ ] 是否考虑了性能优化？
- [ ] 是否兼容现有版本？

### C. 目录结构规范

```
src/lua/
├── ai/                    # AI行为模块
│   └── enemy-ai.lua       # 敌人AI逻辑
├── config/                # 配置模块
│   └── game-config.lua    # 游戏配置
├── skills/                # 技能系统
│   └── skill-system.lua   # 技能逻辑
├── tests/                 # 单元测试
│   ├── game-config.test.lua
│   ├── enemy-ai.test.lua
│   └── utils.test.lua
├── utils.lua              # 通用工具模块
└── DEVELOPMENT_GUIDELINES.md  # 开发规范文档
```

---

**文档版本**: 2.0.0  
**最后更新**: 2026-07-14  
**适用项目**: Fighter Game Lua Script System