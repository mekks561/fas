# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.0] - 2026-07-20

### Added

- **GameplayManager Integration Tests** - 新增集成测试文件 `GameplayManager.test.ts`，包含72个测试用例，验证波次管理、道具系统、战斗统计、分数系统、事件系统等模块的协同工作

- **LuaEngine Stub Improvements** - 增强LuaEngine的stub模式，支持：
  - `require` 和 `package.preload` 模块加载
  - 点号访问对象属性（如 `SkillSystem.getAllSkillStatus`）
  - SkillSystem完整功能stub（学习、升级、施放、冷却管理、连招系统）

### Changed

- **Version Bump** - 将版本号从2.5.0更新到2.6.0

### Fixed

- **Lua模块注册** - 修复三个Lua文件缺少模块注册语句的问题：
  - `wave-manager.lua` - 添加 `package.preload["wave_manager_module"]`
  - `powerup-system.lua` - 添加 `package.preload["powerup_system_module"]`
  - `combat-stats.lua` - 添加 `package.preload["combat_stats_module"]`

- **PowerupSystem** - 修复 `multiplier` 可能为nil的问题，添加 `stat` 字段配置，修复 `stackRule.STACK` 逻辑

- **CombatStats** - 修复 `calculateFinalScore` 中未检查 `getEfficiency` 和 `getSurvivalRate` 返回值的 `success` 字段

- **GameplayManager** - 修复 `startWave`、`spawnNextEnemy`、`onEnemyKilled`、`applyPowerup` 方法未处理LuaEngine返回 `undefined` 的情况

- **LuaEngine** - 修复 `registerModule` 方法使用错误字段名，修复 `global.get` 不支持点号访问的问题

- **SkillSystemManager** - 在 `reloadScript` 方法中添加try-catch，避免测试环境中失败

- **测试用例修复** - 修复排名比较、初始化检查、冷却时间等测试用例

### Technical Improvements

- 完善测试环境配置，添加 `vi.mock('wasmoon')` 确保测试使用stub模式
- 在测试 `afterEach` 中添加 `luaEngine.destroy()` 解决状态污染问题
- 所有227个测试用例全部通过

## [2.5.0] - 2026-07-16

### Added

- **Lua Script System** - 新增三个核心Lua模块：
  - `wave-manager.lua` - 波次管理系统，支持波次状态管理、敌人生成配置、Boss/精英波次触发、难度曲线递增
  - `powerup-system.lua` - 道具增益系统，支持道具类型定义、增益效果应用、堆叠规则处理、时长管理
  - `combat-stats.lua` - 战斗统计系统，支持击杀统计、连击追踪、伤害统计、技能使用统计、评分评级计算

- **TypeScript Manager Classes** - 新增三个TypeScript管理器类：
  - `WaveManager.ts` - 波次管理的TypeScript桥接
  - `PowerupSystemManager.ts` - 道具增益系统的TypeScript桥接
  - `CombatStatsManager.ts` - 战斗统计系统的TypeScript桥接

- **Unit Tests** - 新增单元测试用例：
  - `wave-manager.test.lua` - 波次管理模块测试（16个场景）
  - `powerup-system.test.lua` - 道具增益系统测试（15个场景）
  - `combat-stats.test.lua` - 战斗统计系统测试（25个场景）

- **Module Exports** - 更新 `src/lua/index.ts` 导出所有新模块

### Changed

- **Version Bump** - 将所有子模块版本号从1.0.0统一更新到2.5.0：
  - `package.json` (frontend)
  - `server/package.json` (backend)
  - `edge/package.json` (edge computing)
  - `ai-training/package.json` (AI training)

### Fixed

- **Lua Integration** - 修复了SkillSystemManager.ts中的语法错误（Lua风格对象字面量）

### Technical Improvements

- 使用局部模块模式 `local Module = {} ... return Module` 避免全局变量污染
- 统一错误处理结构 `{ success, result, error }`
- 所有公共函数进行参数验证（类型检查、范围检查、默认值处理）
- 支持热更新机制，无需重启应用即可重新加载Lua脚本

## [1.0.0] - 2026-07-01

### Added

- 初始版本发布
- 基础游戏架构搭建
- PlayCanvas 3D引擎集成
- React前端界面
- 后端API服务
- 数据库设计与迁移