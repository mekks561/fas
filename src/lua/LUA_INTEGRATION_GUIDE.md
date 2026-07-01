# Lua 集成开发指南

## 概述

本项目集成了 Lua 脚本系统，使用 `wasmoon` (Lua WebAssembly VM) 在浏览器和 Node.js 环境中运行 Lua 代码。

## 目录结构

```
src/lua/
├── types.ts              # 类型定义
├── LuaEngine.ts          # 核心 Lua 引擎
├── index.ts              # 模块导出
├── examples.ts           # 使用示例
├── ai/
│   ├── EnemyAIManager.ts # AI 管理器
│   └── enemy-ai.lua      # AI 行为脚本
└── config/
    ├── GameConfigManager.ts  # 配置管理器
    └── game-config.lua       # 游戏配置脚本
```

## 快速开始

### 1. 初始化

```typescript
import { enemyAIManager, gameConfigManager } from './lua';

// 初始化 Lua 系统
await enemyAIManager.initialize();
await gameConfigManager.initialize();
```

### 2. 创建敌人 AI

```typescript
import { enemyAIManager, type AIType } from './lua';

// 创建敌人
const enemy = enemyAIManager.createEnemy('AGGRESSIVE');

// 更新 AI
const action = enemyAIManager.update(
  enemy,       // 敌人实例
  playerX,     // 玩家 X 坐标
  playerY,     // 玩家 Y 坐标
  deltaTime    // 时间步长
);

// 处理动作
if (action) {
  switch (action.action) {
    case 'melee':
      console.log('近战攻击！伤害:', action.damage);
      break;
    case 'shoot':
      console.log('远程射击！伤害:', action.damage);
      break;
  }
}
```

### 3. 使用游戏配置

```typescript
import { gameConfigManager, type DifficultyLevel, type WeaponType } from './lua';

// 获取难度配置
const hardConfig = gameConfigManager.getDifficultyConfig('hard');

// 获取武器配置
const weapon = gameConfigManager.getWeaponConfig('spread');

// 计算伤害
const damage = gameConfigManager.calculateDamage(100, 0.5, 1.2);

// 计算分数
const score = gameConfigManager.calculateScore('boss', 'nightmare', 2.0);
```

## 敌人 AI 类型

| 类型 | 速度 | 探测范围 | 伤害 | 血量 | 行为 |
|------|------|----------|------|------|------|
| PATROL | 2.0 | 10.0 | 5.0 | 50 | 巡逻 |
| AGGRESSIVE | 4.0 | 20.0 | 10.0 | 80 | 追击 |
| SNIPER | 1.0 | 30.0 | 20.0 | 30 | 远程 |
| BOSS | 3.0 | 25.0 | 15.0 | 500 | 混合 |

## 难度等级

| 等级 | 波次间隔 | 敌人生成率 | 速度倍率 | 分数倍率 |
|------|----------|------------|----------|----------|
| easy | 10.0s | 1.0x | 0.8x | 1.0x |
| normal | 7.0s | 1.5x | 1.0x | 1.5x |
| hard | 5.0s | 2.0x | 1.2x | 2.0x |
| nightmare | 3.0s | 3.0x | 1.5x | 3.0x |

## 热更新

### 重新加载 AI 脚本

```typescript
await enemyAIManager.reloadScript();
```

### 重新加载配置

```typescript
await gameConfigManager.reloadConfig();
```

### 重新加载所有模块

```typescript
import { luaEngine } from './lua';

luaEngine.reloadAllModules();
```

## 直接使用 Lua 引擎

### 执行 Lua 代码

```typescript
import { luaEngine } from './lua';

luaEngine.doString(`
  function add(a, b)
    return a + b
  end
`);

const result = luaEngine.call<number>('add', 1, 2);
console.log(result); // 3
```

### 注册模块

```typescript
luaEngine.registerModule({
  name: 'my_module',
  script: `
    function myFunction(x)
      return x * 2
    end
  `
});
```

### 设置全局变量

```typescript
luaEngine.setGlobal('myGlobal', { value: 42 });
const value = luaEngine.getGlobal('myGlobal');
```

## 编写 Lua 脚本

### 基本语法

```lua
-- 变量
local name = "value"

-- 函数
function greet(person)
  return "Hello, " .. person
end

-- 表（类似 JSON/对象）
local config = {
  health = 100,
  damage = 10,
  items = { "sword", "shield" }
}

-- 条件语句
if config.health > 50 then
  print("Good health!")
else
  print("Low health!")
end

-- 循环
for i = 1, 10 do
  print(i)
end
```

### 示例：自定义敌人行为

```lua
-- 在 enemy-ai.lua 中添加新的 AI 类型

CUSTOM_AI = {
  HEALER = {
    name = "healer",
    speed = 2.0,
    detectRange = 15.0,
    damage = 3.0,
    health = 60.0,
    behavior = "support"
  }
}

function updateHealer(enemy, playerX, playerY, allies, deltaTime)
  -- 保持中等距离
  local dx = playerX - enemy.x
  local dy = playerY - enemy.y
  local distance = math.sqrt(dx * dx + dy * dy)

  -- 治疗范围内有盟友则治疗
  for _, ally in ipairs(allies) do
    local allyDist = math.distance(enemy.x, enemy.y, ally.x, ally.y)
    if allyDist < 10 and ally.health < ally.maxHealth then
      ally.health = math.min(ally.maxHealth, ally.health + 5 * deltaTime)
      return { action = "heal", target = ally }
    end
  end

  -- 否则攻击玩家
  if distance < enemy.detectRange and enemy.attackCooldown <= 0 then
    enemy.attackCooldown = 1.5
    return { action = "shoot", x = dx, y = dy, damage = enemy.damage }
  end

  return nil
end
```

## 调试

### 开启调试模式

```typescript
import { LuaEngine } from './lua';

const engine = new LuaEngine({ debug: true });
await engine.initialize();
```

### 错误处理

```typescript
try {
  const result = luaEngine.call<number>('someFunction', arg);
} catch (error) {
  console.error('Lua error:', error);
}
```

## 性能考虑

1. **避免频繁调用**: Lua 函数调用有开销，尽量批量处理
2. **缓存结果**: 对于不变化的计算，缓存 Lua 结果
3. **限制脚本复杂度**: 复杂的 Lua 脚本会影响性能

## 下一步

- 查看 `examples.ts` 了解完整用法
- 修改 `enemy-ai.lua` 自定义敌人行为
- 修改 `game-config.lua` 调整游戏平衡
- 实现更多 Lua 脚本模块（如技能系统、关卡生成等）

---

**注意**: Lua 引擎需要在浏览器/Node.js 环境完全加载后才能使用。确保在初始化前等待 WASM 文件加载完成。
