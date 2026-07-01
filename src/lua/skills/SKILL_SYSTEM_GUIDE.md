# 技能系统使用说明文档

## 概述

技能系统是 fighter-game 项目中使用 Lua 脚本实现的核心功能模块，提供了完整的技能管理、施放、升级和连招系统。

---

## 功能特性

### 核心功能

| 功能 | 描述 |
|------|------|
| **技能学习** | 根据角色等级和前置条件学习新技能 |
| **技能升级** | 提升技能等级，增强效果，减少冷却 |
| **技能施放** | 支持主动技能、被动技能、终极技能 |
| **冷却管理** | 自动冷却追踪，冷却结束自动恢复 |
| **连招系统** | 技能组合触发额外奖励效果 |
| **热更新** | 运行时更新技能脚本无需重启 |

### 技能类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `active` | 主动技能，需要手动触发 | 基础攻击、强力射击 |
| `passive` | 被动技能，自动生效 | 攻击强化、暴击精通 |
| `toggle` | 切换技能，开关状态 | (可扩展) |
| `ultimate` | 终极技能，高消耗大效果 | 终极爆发 |

### 效果类型

| 类型 | 说明 |
|------|------|
| `damage` | 直接伤害 |
| `dot` | 持续伤害（Damage Over Time） |
| `heal` | 立即治疗 |
| `hot` | 持续治疗（Heal Over Time） |
| `buff` | 增益效果 |
| `debuff` | 减益效果 |
| `shield` | 护盾 |
| `stun` | 眩晕控制 |
| `knockback` | 击退效果 |
| `area` | 范围效果 |

---

## 快速开始

### 1. 初始化

```typescript
import { skillSystemManager } from './lua';

// 初始化技能系统
await skillSystemManager.initialize();
```

### 2. 学习技能

```typescript
// 学习基础攻击技能（角色等级 5）
skillSystemManager.learnSkill('basic_attack', 5, []);

// 学习需要前置的技能
skillSystemManager.learnSkill('power_shot', 10, ['basic_attack']);
```

### 3. 施放技能

```typescript
// 定义施放者和目标
const caster = {
  x: 0,
  y: 0,
  stats: {
    damage: 100,
    critChance: 10,
    critDamage: 50
  }
};

const target = { x: 50, y: 50 };
const resources = { mana: 100, energy: 100, health: 100 };

// 施放技能
const result = skillSystemManager.castSkill('basic_attack', caster, target, resources);

if (result.success) {
  console.log(`施放成功: ${result.skillName}`);
  console.log(`效果: ${JSON.stringify(result.effects)}`);
}
```

### 4. 更新冷却

```typescript
// 每帧更新冷却时间
const deltaTime = 0.016; // ~60 FPS
const readySkills = skillSystemManager.updateCooldowns(deltaTime);

// 冷却结束的技能
readySkills.forEach(skillId => {
  console.log(`${skillId} 已就绪`);
});
```

---

## API 文档

### SkillSystemManager 类

#### `initialize(): Promise<void>`
初始化技能系统，加载 Lua 脚本引擎。

#### `learnSkill(skillId, playerLevel, learnedSkillIds): boolean`
学习新技能。

| 参数 | 类型 | 说明 |
|------|------|------|
| skillId | string | 技能 ID |
| playerLevel | number | 角色当前等级 |
| learnedSkillIds | string[] | 已学习技能 ID 列表 |

#### `upgradeSkill(skillId): { success: boolean; newLevel: number }`
升级技能。

#### `canCastSkill(skillId, resources): { canCast: boolean; reason: string }`
检查技能是否可用。

#### `castSkill(skillId, caster, target, resources): CastResult`
施放技能。

| 参数 | 类型 | 说明 |
|------|------|------|
| caster | object | 施放者信息 `{ x, y, stats }` |
| target | object | 目标信息 `{ x, y }` 或 `null` |
| resources | object | 当前资源 `{ mana, energy, health }` |

#### `updateCooldowns(deltaTime): string[]`
更新所有技能冷却，返回就绪的技能 ID。

#### `getSkillStatus(skillId): SkillInstance | null`
获取单个技能状态。

#### `getAllSkillStatus(): SkillInstance[]`
获取所有已学习技能状态。

#### `resetCooldown(skillId): boolean`
重置指定技能冷却（特殊情况使用）。

#### `startCombo(): boolean`
开始连招追踪。

#### `addToCombo(skillId): { success: boolean; comboName: string }`
添加技能到连招序列。

#### `checkComboBonus(): { type: string; multiplier: number } | null`
检查并获取连招奖励效果。

#### `reloadScript(): Promise<void>`
热更新技能脚本。

---

## 技能定义

### 预定义技能

| 技能 ID | 名称 | 类型 | 冷却 | 消耗 | 解锁等级 |
|----------|------|------|------|------|----------|
| basic_attack | 基础攻击 | active | 0.5s | 0 能量 | 1 |
| power_shot | 强力射击 | active | 3.0s | 20 能量 | 5 |
| spread_shot | 散射弹幕 | active | 2.0s | 30 能量 | 10 |
| quick_heal | 快速恢复 | active | 5.0s | 15 法力 | 3 |
| regen_aura | 恢复光环 | active | 10.0s | 30 法力 | 8 |
| speed_boost | 疾风加速 | active | 15.0s | 20 能量 | 5 |
| shield | 能量护盾 | active | 20.0s | 40 法力 | 12 |
| ultimate_burst | 终极爆发 | ultimate | 60.0s | 100 法力 | 20 |
| attack_boost_passive | 攻击强化 | passive | - | - | 2 |
| health_boost_passive | 生命强化 | passive | - | - | 4 |
| critical_passive | 暴击精通 | passive | - | - | 10 |

### 技能树结构

```
基础攻击 (等级 1)
├── 强力射击 (等级 5)
│   └── 终极爆发 (等级 20) ※ 需要散射弹幕
└── 散射弹幕 (等级 10)
    └── 终极爆发 (等级 20) ※ 需要强力射击

快速恢复 (等级 3)
└── 恢复光环 (等级 8)

攻击强化 (等级 2)
└── 暴击精通 (等级 10)

生命强化 (等级 4)
```

---

## 连招系统

### 预定义连招

| 连招名称 | 技能序列 | 时间窗口 | 奖励效果 |
|----------|----------|----------|----------|
| 快速连射 | 基础攻击 ×3 → 强力射击 | 1.0s | 伤害 +50% |
| 治疗连击 | 快速恢复 → 恢复光环 | 2.0s | 治疗 +30% |
| 终极蓄力 | 散射弹幕 → 疾风加速 → 能量护盾 → 终极爆发 | 3.0s | 伤害 ×2 |

### 使用示例

```typescript
// 开始连招
skillSystemManager.startCombo();

// 添加技能
skillSystemManager.addToCombo('basic_attack');
skillSystemManager.addToCombo('basic_attack');
skillSystemManager.addToCombo('basic_attack');
const result = skillSystemManager.addToCombo('power_shot');

// 检查是否完成连招
if (result.comboName === '快速连射') {
  const bonus = skillSystemManager.checkComboBonus();
  console.log(`连招完成！伤害倍率: ${bonus?.multiplier}`);
}
```

---

## 测试

### 运行测试

```typescript
import { runSkillSystemTests } from './lua';

// 执行手动测试
await runSkillSystemTests();
```

### 单元测试覆盖

测试文件：[SkillSystem.test.ts](file:///h:/工作区/fighter-game/src/lua/skills/SkillSystem.test.ts)

覆盖范围：
- ✅ 基础功能（初始化、学习、升级）
- ✅ 技能施放（可用检查、施放结果）
- ✅ 冷却系统（更新、重置、恢复）
- ✅ 边界条件（空值、无效值、极端值）
- ✅ 连招系统（开始、添加、奖励）
- ✅ 状态查询（单个、全部）
- ✅ 稭定性（多次初始化、大量操作）

---

## 最佳实践

### 1. 技能定义规范

```lua
-- 在 skill-system.lua 中添加新技能
NEW_SKILL = {
    id = "new_skill",
    name = "新技能",
    description = "技能描述",
    type = SkillSystem.SkillType.ACTIVE,
    effects = {
        { type = SkillSystem.EffectType.DAMAGE, value = 30, scaling = 1.2 }
    },
    cost = { type = SkillSystem.ResourceType.ENERGY, value = 25 },
    cooldown = 4.0,
    range = 80,
    duration = 0,
    icon = "new_skill_icon",
    level = 1,
    maxLevel = 5,
    unlockLevel = 15,
    prerequisites = { "power_shot" }
}
```

### 2. 性能优化

- 避免频繁的 Lua 调用，批量处理冷却更新
- 缓存技能状态，减少重复查询
- 使用 TypeScript 处理简单计算，复杂逻辑用 Lua

### 3. 错误处理

```typescript
// 始终检查初始化状态
if (!skillSystemManager) {
  console.warn('Skill system not initialized');
  return;
}

// 处理施放失败
const result = skillSystemManager.castSkill(skillId, caster, target, resources);
if (!result.success) {
  console.error(`Skill cast failed: ${result.error}`);
  // 根据错误类型处理
  switch (result.error) {
    case 'skill_not_learned':
      // 提示学习技能
      break;
    case 'cooldown_active':
      // 显示冷却进度
      break;
    case 'insufficient_resource':
      // 提示资源不足
      break;
  }
}
```

---

## 文件结构

```
src/lua/skills/
├── skill-system.lua        # Lua 脚本核心（800+ 行）
├── SkillSystemManager.ts   # TypeScript 管理器
├── SkillSystem.test.ts     # 单元测试文件
└── SKILL_SYSTEM_GUIDE.md   # 本文档
```

---

## 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2026-06-28 | 初始版本，包含完整技能系统 |

---

## 常见问题

### Q: 如何添加新技能？
A: 在 `skill-system.lua` 的 `SkillTemplates` 中添加新技能定义，然后在 TypeScript 中调用 `learnSkill`。

### Q: 如何修改技能效果？
A: 直接修改 Lua 脚本中的技能定义，使用 `reloadScript()` 热更新。

### Q: 如何自定义连招？
A: 在 `SkillCombos` 表中添加新的连招定义。

### Q: Lua 脚本出错怎么办？
A: 查看 `[LuaEngine]` 日志输出，使用 `debug: true` 选项获取详细信息。

---

**文档版本: 1.0.0**
**最后更新: 2026-06-28**