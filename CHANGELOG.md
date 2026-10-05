# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-10-04

### Added

- **场景结构物换真模型（小行星带 / 空间站 / 卫星）** - 从 Kenney Space Kit 再引入 11 个 CC0 模型：
  9 种岩石/陨石外壳（`meteor` / `meteor_detailed` / `meteor_half` / `rock_largeA/B` /
  `rock_crystalsLargeA/B` / `rocks_smallA/B`）、空间站外壳（`hangar_largeB`）、卫星
  （`satelliteDish_detailed`）。`ModelAssetProvider` 扩展 `upgradeStructure()`——结构物是
  「一个类型对应多个候选外壳」，运行时随机选取，40 个小行星不再同款；沿用
  「程序化模型先占位 + GLB 异步替换 + 失败静默回落」机制。`createAsteroidField` 的 40 个
  小行星与场景中的空间站/卫星均已接线；实测 42 个实体替换成功、13 个模型文件全部 200、
  运行时错误 0。被取代的 10 个坏 `structure-*.glb` 已删除。
- **波次闭环推进（可完整通关）** - `GameScene` 新增 `waveTransitionRef`（待启动波次 + 倒计时）与
  `WAVE_START_DELAY = 2.2s`。`onWaveComplete` 现在**无条件**为下一波排定启动，update 循环在非暂停
  且未弹强化选择时倒计时到点后调用 `startWave(n+1)`。此前无任何代码推进波次，一波打完游戏永久静止。
- **`EnemySystem.EnemiesDefeatedCallback`** - 新增 `(enemies: Enemy[]) => void` 类型与
  `setEnemiesDefeatedCallback()`，每帧把本帧所有阵亡敌人**整体**回调给上层统一结算。
- **DEV 调试钩子 `window.__waveDebug`** - `import.meta.env.DEV` 门控（生产构建不含）：
  `startWave(n)` / `getState()` / `killAll()` / `godMode(on)` / `inspectEnemies()` / `killOne(i)`；
  配套 `window.__waveDiag` 更新循环计数（`ticks` / `logicTicks` / `enemyUpdates`）。
- **`scripts/verify-wave-progression.mjs`** - Playwright 闭环验证脚本，用调试钩子驱动 10 波全流程，
  rAF 劫持计数 + 逐帧敌人采样 + 冻结检测。
- **`src/engine/GlobalAudio.ts`（全局音乐 / 界面音效通道）** - 基于 HTMLAudioElement 的
  独立音频通道，不依赖 `pc.Application` 生命周期，因此音乐能活过界面切换。API：
  `playMusic('menu'|'game'|'boss'|'victory'|'defeat')`、`playCue(...)`（UI 音效 + 结算音刺）、
  `setMuted` / `setMusicVolume` / `setCueVolume`；首次用户手势时自动解锁并补播解锁前请求的曲子
  （浏览器自动播放策略）。职责切分：**音乐与跨界面音效走 GlobalAudio，战斗内空间音效留在
  `AudioSystem`**。
- **`scripts/verify-audio-wiring.mjs`** - 音频接线验证脚本：真实浏览器跑
  「菜单 → 战斗 → 末波 → 通关 → 重新开始 → 返回菜单」，逐界面断言当前在放哪首曲子，
  并统计 `/assets/audio/` 的请求状态（含 HTMLAudio 的 206 Partial Content）。

### Changed

- **`fetch-kenney-models.mjs` 三角面阈值支持按类别覆盖** - 新增 `MIN_TRIANGLES_OVERRIDE`：
  `structures/` 前缀阈值放宽到 40。背景装饰类低模（整块陨石仅 44–68 面）不应按
  主角模型的标准（100 面）拒收，但下限仍须高于假素材的 12–32 面。
- **波次推进收敛为唯一权威点** - 波次计数改由 `GameplayManager.onEnemyKilled` 统一负责
  （它持有 `WaveManager`）；`EnemySystem.onEnemyKilled` 退化为「返回该敌人基础分 + 处理道具掉落」，
  不再调用 `waveManager.onEnemyDefeated`。
- **关卡完成判定改用权威信号** - 由 `currentWave >= totalWaves` 改为 `finalWaveClearedRef`
  （由 `onWaveComplete(waveNumber >= totalWaves)` 置位），避免末波刚启动、敌人尚未生成时误判通关。
- **`GameplayManager.baseScores` 补键** - 原表仅含 Lua stub 类型名（`basic`/`fast`/…），
  补齐引擎侧 `EnemyType` 取值（`scout`/`fighter`/`bomber`/`assassin`/`drone`/`corvette`/
  `destroyer`/`boss_sentinel`/`boss_overlord`），否则引擎路径下除 tank/elite/boss 外一律得 100 分。

### Fixed

- **打完一波后游戏永久静止、永远无法通关** - 波次推进逻辑完全缺失（详见 Added 第 1 条）。
- **末波（第 10 波 / Boss 波）被整个跳过** - 关卡完成条件在末波**启动的同一帧**即成立
  （波号已达上限、敌人要到下一帧才生成、`nextWave` 刚置 null）⇒ 立即触发 `onLevelComplete()`
  → App 切到 GAME_OVER → GameScene 被 React 卸载 → `engine.destroy()` → PlayCanvas `app.destroy()`
  → tick 链静默停止，表现为「游戏突然冻结」。现要求末波**真正被清空**才结算。
- **非武器击杀漏结算** - `EnemySystem.update()` 原先把 `filter(isAlive)` 放在结算之前，导致
  用技能/撞击等方式击杀的敌人分数、战斗统计、波次计数全部丢失（现象：`enemiesDefeated` 恒为 0）。
  现改为**先回调结算、再 filter 移除**。
- **一次击杀扣两次波次计数** - `EnemySystem` 与 `GameplayManager` 双方都调用 `onEnemyDefeated`，
  波次会在敌人还剩一半时提前判定完成。
- **击杀分数重复累加** - `GameScene` 的阵亡回调既 `addScore(totalScore)`，又经
  `GameplayManager.onEnemyKilled` 事件再 `addScore(score)`。现只在事件链上记一次分。
- **结算/暂停界面「消灭敌人」恒为 0** - store 的 `addKill()` 只累加 `killCount`，而
  `GameOver` / `PauseMenu` 读取的是从未被写入的 `enemiesDefeated` 字段。现两者同步累加
  （`resetGame` 本就会重置二者）。
- **结算界面出现未翻译的键名 `gameOver.leaderboard`** - `zh.json` / `en.json` 的
  `gameOver` 段缺少 `leaderboard` 键，按钮直接显示原始键名。已补「排行榜」/ `Leaderboard`。
- **PlayCanvas 2 `ParticleSystemComponent` 无 `start()`** - `Enemy` / `ObjectPool` / `PowerupSystem` /
  `SkillSystem` 中的 `particlesystem.start()` 改为 `play()`（Engine 2 仅提供 `play()`）。
- **4 首 BGM 与 7 个 UI 音效「定义了却从不播放」** - 全仓只有 `gameMusic` 一处
  `playMusic` 调用；`bgm-mainmenu` / `bgm-boss` / `bgm-victory` / `bgm-story` 与全部
  `ui-*.ogg` 都是死定义（换素材时换了个没人听得见）。根因是**架构性**的：音乐若挂在
  GameScene 上，结算/返回菜单时组件卸载 → `pc.Application.destroy()` → `soundManager`
  销毁 → 声音当场被掐断。现改为：音乐由 `App` 依据 `gameState` + `isVictory` 驱动、
  走独立通道 `GlobalAudio`；末波（Boss 波）切 `bossMusic` + `bossRoar`；
  通关/阵亡的音刺与爆炸声也改走 GlobalAudio（否则会被卸载掐断）。
- **结算界面「重新开始」按钮点了没反应** - `handleRestart` 只重置了 store 与暂停状态，
  没有把 `gameState` 切回 `PLAYING`，因此在 `GAME_OVER` 界面点它时界面毫无变化
  （从暂停菜单进则正常）。现补上 `setGameState(GameState.PLAYING)`。
- **重开一局后战斗音效全部静默失效** - `AudioManager.initialize()` 原先只在
  「首次」初始化（`if (!instance)`），而 GameScene 每次挂载都会新建 `pc.Application`
  （旧的已 destroy、`soundManager` 失效），导致第二局起所有音效静默失效。
  现改为**换 app 时销毁旧实例并重建**（新增 `isInitialized()` / `getApp()` /
  `getCurrentMusic()`）。
- **音乐双份开销** - 移除 `AudioSystem` 中 5 条音乐定义（所有权归 `GlobalAudio`），
  避免同一批 BGM 被 PlayCanvas 预载解码一遍却没人播放；实测 `bgm-story.ogg`
  现在只在真的阵亡时才被请求。

### Removed

- **19 个坏占位模型全部清空，`public/assets/models/` 只剩真素材（27 个 CC0 模型）** -
  删除 `projectiles/`（9）、`effects/`（8）、`bosses/boss-collector.glb` + `boss-tyrant.glb`，
  共约 368 KB。依据：这 19 个文件没有任何渲染路径引用，仅被死代码链
  `GameResources.ts → GameResourceManager → ResourceDownloadTester` 的清单提及。
- **`GameResources.ts` 清单中的 29 条死条目** - 指向已删文件的条目全部剪除
  （19 个本轮删除的 + 10 个此前已删的 `structure-*.glb`），剩余 16 条全部指向真实文件，
  测试所依赖的「数量 > 0 / md5 为字符串」断言不受影响。
- **`scripts/download-models.js` 加停用守卫** - 该脚本会把 Khronos glTF 示例模型
  （Duck / CesiumMan / Cube 等）冒充成飞船/敌人/弹体下载进 `public/assets/models/`；
  守卫与 `generate-models.js` 同款（置于 `require` 之前）。
- 弹体与特效**有意不留 GLB 素材**：子弹是程序化发光球体、特效走粒子系统，本就不该用
  静态网格渲染；Kenney 3D 各包无可用弹体模型（`blaster` 包是 FPS 枪械）。
  详见 `public/assets/models/CREDITS.md`。

### Verification

- `tsc --noEmit`：0 错误
- `vitest run`：344 / 345 通过（唯一失败为 `GameResourceManager.test.ts` 的慢速下载用例，
  该用例会真实发起网络下载，属环境相关的既有不稳定用例）
- `vite build`：成功（另见下方 Note）
- 波次闭环实测：波次 1→2→…→10 全通，第 10 波 `spawned=20 / defeated=20 / state=completed`，
  关卡完成触发，结算界面「胜利！」出现，运行时错误 0

### Note

- `vite build` 直接执行会被沙箱的 safe-delete 防护拦截（Vite 需清空既有 `dist/assets`，359 文件
  超过 50 的批量删除阈值）。本地校验可用 `npx vite build --outDir dist-verify`。

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
