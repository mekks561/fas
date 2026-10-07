# Fighter Game · 3D Space Shooter

> 基于 **PlayCanvas 2 + React 19** 的 3D 太空射击游戏。
> 当前版本 **`2.6.0`**，10 个关卡 / 12 种敌机 / 真实 Lua 5.4 运行时。

一个纯前端（可选后端）的浏览器 3D 太空射击游戏：程序化 + GLB 混合资产管线、
PBR + IBL 光照、数据驱动的关卡与波次、以及一套**真实在跑**的 Lua 脚本层
（技能 / 道具 / 统计 / 波次 / 敌机 AI）。

---

## 当前状态一览

| 维度         | 现状                                                                 |
| ------------ | -------------------------------------------------------------------- |
| 版本         | `2.6.0`（`package.json`）                                            |
| 主分支       | `master`                                                             |
| 关卡         | **10 关 × 3 波**，含 2 个 Boss 关（`src/levels/level-01..10.ts`）    |
| 敌机         | **12 种**（`EnemyType` 枚举），敌机 AI 有 TS / Lua 双后端可切        |
| 飞船活动范围 | X/Z **±50**、Y **±30**（`src/engine/arena.ts`；满速横穿约 2.7 秒）   |
| Lua 运行时   | **wasmoon 1.16 → Lua 5.4**，7 个 `.lua` 模块真实执行（带运行时自检） |
| 单元测试     | **389 个 / 25 个文件**（Vitest）                                     |
| 端到端脚本   | **19 个** `scripts/verify-*.mjs`（Playwright，真实浏览器驱动）       |
| 游戏资产     | `public/assets` 约 **568 MB / 53,495 个文件**                        |

---

## 技术栈（实测版本，取自 `package.json`）

### 前端 / 渲染

| 依赖                  | 版本         | 说明                                                                                |
| --------------------- | ------------ | ----------------------------------------------------------------------------------- |
| `playcanvas`          | **`2.23.0`** | 3D 引擎。**精确锁定**（非 `^`），从 1.x 迁移而来                                    |
| `react` / `react-dom` | `^19.2.6`    | UI 框架（`babel-plugin-react-compiler` 已在依赖中，尚未接入构建）                   |
| `typescript`          | `^6.0.3`     | 类型系统                                                                            |
| `vite`                | `^8.1.0`     | 构建（rolldown）。分区产物：playcanvas / react / radix / misc                       |
| `tailwindcss`         | `^4.3.2`     | 原子化 CSS（`@tailwindcss/vite`）                                                   |
| `zustand`             | `^5.0.14`    | 状态管理                                                                            |
| `@radix-ui/*`         | 15 个包      | 无样式可访问组件；封装在 `src/components/ui/shadcn/`（15 个组件，统一从该目录导入） |
| `lucide-react`        | `^1.23.0`    | 图标                                                                                |
| `i18next`             | `^26.3.4`    | 国际化（`zh` / `en`，见 `src/i18n/locales`）                                        |

### 脚本层（Lua）

| 依赖      | 版本      | 说明                                                  |
| --------- | --------- | ----------------------------------------------------- |
| `wasmoon` | `^1.16.0` | Lua 5.4 的 WASM 运行时；封装见 `src/lua/LuaEngine.ts` |

### 数据 / 网络

| 依赖                    | 版本       | 说明                                         |
| ----------------------- | ---------- | -------------------------------------------- |
| `@tanstack/react-query` | `^5.101.4` | 排行榜等异步状态                             |
| `@trpc/client`          | `^11.18.0` | 类型安全的 RPC 客户端（仅 type-only 引类型） |
| `zod`                   | `^3.25.76` | 运行时校验，**跨端唯一类型来源**             |
| `dexie`                 | `^4.4.4`   | IndexedDB 封装（本地存档 / 排行榜缓存）      |
| `superjson`             | `^2.2.6`   | 序列化（Date 等）                            |

### 测试 / 质量

| 依赖                    | 版本                  | 说明                                     |
| ----------------------- | --------------------- | ---------------------------------------- |
| `vitest`                | `^4.1.9`              | 单元测试（jsdom 环境）                   |
| `@playwright/test`      | `^1.61.1`             | 端到端测试 / 验证脚本                    |
| `msw`                   | `^2.15.0`             | 网络层打桩（TRPCProvider 测试）          |
| `eslint` / `oxlint`     | `^10.6.0` / `^1.76.0` | 双 linter（oxlint 走 lint-staged，更快） |
| `prettier`              | `^3.9.4`              | 格式化                                   |
| `husky` + `lint-staged` | `^9.1.7` / `^17.3.0`  | 提交前钩子                               |

### 后端（可选，独立子包 `server/`）

`Express 4.18` + `Prisma 7.8` + `helmet` + `cors` + `express-rate-limit`。
**游戏本体不依赖后端**，缺失时排行榜自动降级为本地 Mock（见下文）。

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认端口 5175，会自动打开浏览器）
npm run dev

# 3. 生产构建 + 本地预览
npm run build
npm run preview
```

> **构建提示**：`public/assets` 有 5 万多个文件，构建时绝大部分耗时花在把它拷进
> `dist/`（约 100 秒，属固有开销）。另外 Vite 的 `emptyOutDir` 清空旧的 `dist/`
> 极慢（450 MB 可能超过 20 分钟），**建议先手动 `rm -rf dist` 再 `npm run build`**。

### 常用命令

```bash
npm run dev              # 开发服务器（:5175）
npm run build            # 生产构建 → dist/
npm run preview          # 预览生产产物
npm run test             # Vitest（监听模式）
npx vitest run           # Vitest 单跑一遍（CI 用）
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
npm run lint:ox          # oxlint
npm run format           # Prettier 格式化
npm run audit:assets     # 审计 public/assets 使用率（LIVE / ORPHAN 五级判定）
npm run audit:dead-code  # 审计 src 死代码（LIVE / DEAD / TESTONLY）
```

### 环境变量

复制 `.env.example` 为 `.env`：

| 变量                        | 默认值                   | 说明                                                     |
| --------------------------- | ------------------------ | -------------------------------------------------------- |
| `VITE_SECURITY_KEY`         | `dev-only-fallback-key…` | AES-GCM 密钥派生基础（PBKDF2 10 万轮）。**生产必须替换** |
| `VITE_LEADERBOARD_PROVIDER` | `mock`                   | `mock` = 本地离线开发；`trpc` = 连 POC 后端              |
| `VITE_TRPC_URL`             | `http://localhost:2026`  | tRPC 端点，仅 `provider=trpc` 时生效                     |

### 调试参数（URL Query）

| 参数       | 作用                                                                 |
| ---------- | -------------------------------------------------------------------- |
| `?level=N` | 深链到第 N 关（1 基）。被锁关卡需先写入 `localStorage.levelProgress` |
| `?ai=lua`  | 敌机 AI 切到 Lua 后端（默认 `ts`）。**只影响之后生成的敌机**         |

---

## 仓库结构

这是一个 **pnpm workspace**（`pnpm-workspace.yaml`），根包之外还有几个独立子项目：

```
fighter-game/
├── src/
│   ├── engine/          # 游戏引擎核心（66 个模块：渲染/物理/AI/系统）
│   │   ├── arena.ts             # ★ 活动空间唯一真源（零依赖叶子）
│   │   ├── PlayCanvasEngine.ts  # PlayCanvas 封装
│   │   ├── GameplayManager.ts   # 玩法总装（各子系统初始化在此串起来）
│   │   ├── EnemySystem.ts / EnemyAI.ts / Enemy.ts
│   │   ├── LuaEnemyAIBridge.ts  # ★ Lua 敌机 AI 适配器
│   │   └── …（CameraSystem / WeaponSystem / SkillTreeManager / SurvivalModeManager …）
│   ├── lua/             # ★ Lua 脚本层
│   │   ├── LuaEngine.ts         # 运行时装配 + 模块装载 + 自检
│   │   ├── luaSources.ts        # .lua 源码注册表（构建期内联，唯一取源口）
│   │   ├── ai/enemy-ai.lua      # 敌机 AI 行为模板（457 行）
│   │   ├── wave/ powerup/ combat/ skills/ config/ utils.lua
│   │   └── tests/               # Lua 自测脚本（不进运行时注册表）
│   ├── levels/          # ★ 关卡配置唯一真源（level-01..10.ts + 派生层 index.ts）
│   ├── components/      # React 组件（游戏 UI 面板 + ui/ 基础组件）
│   ├── store/           # Zustand store
│   ├── services/        # 排行榜 provider（Mock / tRPC）、tRPC 客户端
│   ├── shared/schemas/  # Zod schema（跨端类型唯一来源）
│   ├── i18n/            # 国际化（zh / en）
│   ├── types/ config/ utils/ monitoring/ textures/
│   └── main.tsx         # 前端入口
├── public/assets/       # 游戏资产（约 568 MB / 5.3 万文件：GLB / 贴图 / 音频 / HDR）
├── scripts/             # 资产生成、审计、19 个 verify-*.mjs 端到端验证脚本
├── docs/                # 设计文档与验证截图（见「文档索引」）
├── server/              # 独立子包：Express + Prisma 后端（fighter-game-server 2.5.0）
├── poc/                 # 概念验证：trpc-leaderboard / neon-leaderboard
├── edge/                # Cloudflare Workers（wrangler）边缘函数
├── ai-training/         # Python 训练脚本与导出的模型（实验性）
├── tests/e2e/           # Playwright 测试用例
├── dist/                # 构建产物（含 public/ 原样拷贝，约 583 MB）
└── index.html
```

---

## 玩法与内容

### 核心循环

关卡制战役：**选关 → 波次战斗 → 升级/加点 → 通关结算 → 解锁下一关**。
另有独立的**生存模式**（无尽波次 + 独立进度与本地最高分记录）。

### 内容规模

- **战役**：10 关 × 3 波，第 5 关（Boss: Sentinel）与第 10 关（Boss: Overlord）为 Boss 关
- **敌机**：12 种（侦察 / 战斗机 / 轰炸机 / 坦克 / 刺客 / 无人机 / 精英 / 护卫舰 / 驱逐舰 / 3 种 Boss）
- **技能**：主动技能 + **技能树**加点（`SkillTreeManager` + `SkillTreeUI`）
- **道具**：多种随机掉落（`PowerupSystem`）
- **建造 / 升级**：局内三选一升级（`BuildSystem` + `UpgradeChoiceOverlay` + `config/build-upgrades.json`）
- **难度自适应**：按玩家表现动态缩放（`DifficultyManager`）
- **成长系统**：经验升级、金币与商店、云存档、成就、每日挑战、任务与剧情对话
- **双语言**：简体中文 / English

### 已接线的界面

主菜单、选关、HUD、暂停、结算、设置、成就、商店、技能树、生存模式、
每日挑战、排行榜、好友、剧情对话、任务追踪、连线提示。

> **多人游戏未实现**：`MultiplayerPanel.tsx` 存在但**没有任何入口引用**（属死代码），
> `MultiplayerSystem` 亦不可达。规划中，尚未开工。

---

## 架构要点：几个「唯一真源」

改代码前先认这几个文件，否则很容易踩到「一改就崩」的坑。

| 关注点                 | 唯一真源                                                                                        | 说明                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 关卡 / 敌机 / 波次配置 | `src/levels/*.ts` + `index.ts`                                                                  | `level-*.ts` 是数据，`index.ts` 只做**派生与再导出**                |
| **活动空间（arena）**  | `src/engine/arena.ts`                                                                           | **零依赖叶子**，不得 import 任何东西（否则会把 wasmoon 拖进热路径） |
| 波次状态               | `src/lua/wave/WaveManager.ts`                                                                   | 注入 `WavePlan[]` 走计划模式；未注入走 Lua 公式（生存模式）         |
| Lua 源码取用           | `src/lua/luaSources.ts`                                                                         | `getLuaSource(name)` 是**唯一取源口**（构建期内联）                 |
| 敌机类型换算           | `ENEMY_TYPE_TO_RUNTIME`（`levels/index.ts`）<br>`ENEMY_TYPE_TO_LUA_AI`（`LuaEnemyAIBridge.ts`） | 配置侧 `enemy-scout` ↔ 运行时侧 `scout` 的换算只允许写在这里        |
| 进度 / 金币            | `LevelProgress.ts` / `CreditsStore.ts`                                                          | 各自的唯一读写入口                                                  |

### 活动空间（arena）

「世界有多大」原本分散硬编码在 **5 处**（飞船钳制、敌机钳制、生成环、小行星带与
远景布景、弹丸回收半径），只改一处必出 bug（敌机追不出边界、敌机全从中心冒、
小行星带陷进场地被撞、弹丸在边缘被截断）。

现在全部由 `arena.ts` 派生，改 `ARENA_SCALE` 一个数即可整体缩放：

```ts
ARENA_SCALE = 2;              // 相对 1× 基准
PLAYER_BOUNDS     ±50/±30/±50 // 飞船
ENEMY_BOUNDS      ±60/±30/±60 // 敌机（保持比玩家大一圈的比例）
ENEMY_SPAWN       40~60, Y±20 // 刷怪环
ASTEROID_BELT     r 70~110, sizeScale 2
PROJECTILE_CULL_RADIUS         // = 敌机对角 + 60（派生，非魔数）
```

**两条设计约束**（有单测锁死，别破坏）：

1. **小行星带是「看得见的墙」**——带内缘 ≈ 场地盒子对角。放宽场地必须连带把带外移。
2. **球壳的角密度只由数量决定**，与半径无关 → 带外移 k 倍时**岩石尺寸 ×k、数量不变**，
   因此这次外移**没有新增任何 draw call**。布景同理（位置 ×k + 尺寸 ×k ⇒ 天空观感不变）。

护栏：`src/engine/arena.test.ts`（13 项：同倍关系 + 语义关系）、
`scripts/verify-arena-bounds.mjs`（14 项：**真实键盘飞行**，断言「输入 → 物理 → 钳制」链路）。

---

## Lua 运行时

`src/lua/**/*.lua` 是**真实执行**的 Lua 5.4 代码，不是占位。

### 为什么值得单独说

这套脚本层曾经**整整一行都没跑过**：`LuaEngine` 取的是 wasmoon 1.12 以前的
`wasmoon.factory` 单例，而依赖装的是 1.16（只导出 `LuaFactory`）→ 工厂恒为 `undefined`
→ 每次初始化都**静默降到 stub**，`doString` 是个空函数。之所以一直没暴露，是因为 stub
里是**行为等价的宿主 JS 复刻**：接口面有、行为面有，只有真实执行链路是断的。

现在已接通，并且加了几道防"假接线"的护栏：

- **运行时自检**：`doString('x = 40 + 2')` 读回必须是 `42` 且 `_VERSION` 以 `'Lua '` 开头，
  否则关闭引擎回落 stub。原因：某些环境能 `createEngine()`、`doString` 也不抛错，
  但 `global.get()` 恒返回 `() => {}`（wasm ↔ JS 桥是死的）——不拦就会**谎报 `mode='lua'`**，
  比降级更糟。
- **模块装载**：wasm 里没有文件系统，`require` 由 Lua 侧接管，从宿主注入的
  `__luaSources` 取已内联的源码；**取不到就 `error()`，不再静默返回空表**。
- **唯一取源口**：`.lua` 全部经 `getLuaSource()` 内联进产物。
  **不要**改回 `import.meta.glob(..., { as: 'raw' })`（Vite 8 下已失效且不报警告，
  产物会变成 `/assets/x-xxxx.lua` 这样的 URL 字符串——dev 正常、生产必炸），
  也**不要**用 `fetch('/src/lua/...')`（生产 404）。
- 三层护栏：模块级 `looksLikeSourcePath()` 校验 + 单测 + e2e `verify-lua-ai.mjs` 的 A3b。

### 模块清单（7 个）

| 文件                         | 职责                       | 迁移状态                  |
| ---------------------------- | -------------------------- | ------------------------- |
| `ai/enemy-ai.lua`            | 敌机 AI 行为模板（457 行） | ✅ **已由真实 Lua 驱动**  |
| `config/game-config.lua`     | 游戏配置                   | ✅ 真实 Lua               |
| `wave/wave-manager.lua`      | 波次编排                   | ⏳ `host: true`（迁移期） |
| `powerup/powerup-system.lua` | 道具掉落与效果             | ⏳ `host: true`（迁移期） |
| `combat/combat-stats.lua`    | 战斗统计 / 连击            | ⏳ `host: true`（迁移期） |
| `skills/skill-system.lua`    | 技能系统                   | ⏳ `host: true`（迁移期） |
| `utils.lua`                  | 公共工具                   | ✅ 被 `require` 复用      |

> **`host: true` 是迁移期标记**：带此标记的模块在真实 Lua 模式下**不执行 script**，
> 行为由宿主 JS 实现提供 —— 目的是「切换运行时不改变行为」，把风险留给逐个迁移。
> 迁移就是摘掉这个标记，逐个做、每个都断言行为等价。
> **完整迁移清单见 `docs/2026-10-07-Lua运行时接通与敌机AI接线.md`。**

### 敌机 AI 的 A/B 后端

```
?ai=ts （默认） → EnemyAI.ts       原生 TS 行为树
?ai=lua         → enemy-ai.lua     经 LuaEnemyAIBridge 适配
```

设计边界：

- **句柄常驻 Lua 侧**，跨边界只传数字/字符串；每帧 `sync(真值) → step → 读回 x/z/state/action`。
- **坐标映射**：Lua `x` → 世界 X，Lua `y` → 世界 Z；Y 轴由适配器「高度跟随」补全。
- **攻击是意图，不是伤害**：Lua 的 `action` 只表示攻击意愿，**伤害仍由 `Enemy.stats`
  （含难度缩放）决定** → 换 AI 后端不改数值平衡。
- **感知半径由宿主注入**：`enemy-ai.lua` 是通用模板，自带 `detectRange`（20/25/30）
  小于本作刷怪半径，直接用会让敌机在出生点发呆。
- **失败即永久摘除**，不回试（避免刷错误日志），并保留原生 AI 兜底。

---

## 质量保障

### 单元测试

```bash
npx vitest run     # 389 个测试 / 25 个文件，全绿
```

覆盖：AI 边界与换算表、Lua 源码注册表、运行时降级路径、排行榜 Provider
（含 4 条降级规则）、安全系统、资源管理器、波次计划、关卡派生层、存档等。

### 端到端验证（19 个脚本）

都是 Playwright 驱动**真实浏览器**（真实键盘输入、真实渲染），不是 mock：

```bash
# 1. 先起 dev server
npx vite --port 5177 --strictPort
# 2. 运行脚本（必须带 NO_PROXY，否则 playwright 访问 localhost 会超时）
VERIFY_URL=http://localhost:5177/ NO_PROXY=localhost,127.0.0.1 node scripts/verify-<名字>.mjs
```

| 脚本                                                               | 覆盖点                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| `verify-level-system`                                              | 关卡配置驱动（18 项）                                  |
| `verify-wave-plans`                                                | 波次计划（16 项，含 `?level=5` 深链 Boss 断言）        |
| `verify-arena-bounds`                                              | **真实键盘飞行**，活动边界（14 项，dev + 生产各跑）    |
| `verify-lua-ai`                                                    | Lua 敌机 AI 接线 + A/B 对照（21 项）                   |
| `verify-lua-runtime-prod`                                          | **生产构建**的 Lua 运行时冒烟（纯 console 证据，9 项） |
| `verify-environment`                                               | 环境光照 / 色调映射（14 项差分）                       |
| `verify-survival-wiring`                                           | 生存模式接线（36 项）                                  |
| `verify-glb-models` / `verify-glb-pivot`                           | GLB 模型加载与几何中心归一                             |
| `verify-pbr-materials`                                             | PBR 材质                                               |
| `verify-particle-textures`                                         | 粒子贴图                                               |
| `verify-postfx`                                                    | 后处理                                                 |
| `verify-icon-wiring` / `verify-audio-wiring`                       | 图标 / 音频接线                                        |
| `verify-wave-progression`                                          | 波次推进                                               |
| `verify-skilltree-wiring`                                          | 技能树（见「已知问题」）                               |
| …（`verify-audio` / `verify-asset-reserve` / `verify-final-wave`） | 见脚本头注释                                           |

> **「dev 绿、prod 炸」是真实存在的缺陷类别**（上面 Lua 取源那条就是）。
> 调试钩子被 `import.meta.env.DEV` 包着，生产会被整体剔除，
> 所以 `verify-lua-ai` **证明不了生产构建** —— 有生产风险的改动请额外走
> `npm run build` → `npm run preview -- --port 4180` → `verify-lua-runtime-prod`。

### 审计脚本

```bash
npm run audit:assets     # public/assets 使用率（LIVE / VERIFY / DATA / PRODUCED / ORPHAN）
npm run audit:dead-code  # src 可达性（LIVE / DEAD / TESTONLY）
```

`src` 的死代码已从 54 个文件 / 16,627 行清理到 **20 个 / 8,587 行**（LIVE 数始终 107，
未误伤活文件）。分类与处置建议见 `docs/2026-10-07-源码死簇审计与清理.md`。

---

## 已知问题与待办

### 已知缺陷（已定位，未修）

1. **技能树的属性未落到实体**。天赋点能加、统计数据也对（伤害 +5% / 生命 +10% /
   护盾 +10%），但实际生效属性没变 —— `SkillTreeManager` 的聚合结果**没有被
   `PlayerShip` / `WeaponSystem` 消费**。`verify-skilltree-wiring` 因此 25/28。
   （已用基线对照确认是既有问题，不是某次改动引入的回归。）
2. **Lua 模式下无人机不开火**。`enemy-ai.lua` 的 `PATROL` 模板不返回攻击动作。
   属模块设计导致的行为差异（非 bug），切后端前需决策。

### 陈旧脚本

- `scripts/verify-final-wave.mjs` 写于关卡系统引入「按关卡配置波数」上限之前，
  脚本里的 `startWave(9)` 会被 `waveNumber exceeds maxWaves` 拒绝（第 1 关只有 3 波），
  因此它会对「wave 10 专属」的断言报错（实际已正常结算胜利）。
  修法：改成 `startWave(maxWaves - 1)`，或深链到一个 10 波关卡。

### 待办

- 把 4 个 `host: true` 的 Lua 模块逐个迁到真实 Lua（先决条件已就绪）
- 修技能树属性接线（上面第 1 条）
- 多人游戏（UI 骨架在，系统与入口均未实现）
- 缓存治理：`src/engine` 仍有 20 个死文件待清理

---

## 文档索引

| 文档                                           | 内容                                       |
| ---------------------------------------------- | ------------------------------------------ |
| `CHANGELOG.md`                                 | 完整变更历史（Keep a Changelog 格式）      |
| `docs/2026-10-07-Lua运行时接通与敌机AI接线.md` | **Lua 运行时事实纠正、改造细节、迁移清单** |
| `docs/2026-10-07-飞船活动范围扩大.md`          | arena 唯一真源的设计与验证                 |
| `docs/2026-10-07-源码死簇审计与清理.md`        | 死代码分类与处置建议                       |
| `docs/2026-10-05-资源库利用率审计.md`          | 资产使用率审计                             |
| `docs/2026-10-03-playcanvas2-迁移执行记录.md`  | PlayCanvas 1.x → 2.x 迁移记录              |
| `docs/2026-10-03-项目现状体检.md`              | 项目全面体检                               |
| `docs/API_DESIGN.md` / `DATABASE_DESIGN.md`    | 后端接口与数据模型                         |
| `docs/dev-status.md`                           | 开发状态速览                               |
| `docs/verify/*.png`                            | 各验证脚本的截图证据                       |

---

## 排行榜架构（Phase 3: tRPC + React Query）

```
┌─────────────── GameOver / LeaderboardPanel / CloudSaveSystem ───────────────┐
│        useSubmitScore    useLeaderboardList / useMyRank / useStats          │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ @tanstack/react-query QueryClient
                               │   staleTime=30s, invalidateQueries(['leaderboard'])
┌──────────────────────────────▼──────────────────────────────────────────────┐
│ LeaderboardProvider Interface (list / submit / myRank / stats)              │
│   ├─ MockProvider   (localStorage + 内存种子，50 条)                         │
│   └─ TRPCProvider   (poc/trpc-leaderboard，4 条降级规则)                     │
└──────────────┬──────────────────────────┬───────────────────────────────────┘
               │ Zod 单一类型来源          │ tRPC (type-only import AppRouter)
               ▼                          ▼
       src/shared/schemas/        ../../poc/trpc-leaderboard/src/router
       leaderboard.ts             (零运行时耦合，仅类型)
```

### 4 条降级规则（TRPCProvider）

1. **空 URL / 构造失败** → 直用 MockProvider（不抛）
2. **`navigator.onLine === false`** → 降级 MockProvider
3. **网络错误 / HTTP 5xx** → `console.debug` 记录 + 降级 MockProvider
4. **Zod `BAD_REQUEST`** → **不降级，向上抛出**（保留错误可见性）

```bash
npm run typecheck:leaderboard:negative   # 负向类型测试：故意写坏必须被拒
npm run test:provider                    # Provider + schemas 综合测试
```

---

## 贡献

欢迎提交 Issue 和 Pull Request。

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/AmazingFeature`）
3. 提交更改（提交前 husky 会跑 `oxlint` + `prettier`）
4. 推送分支（`git push origin feature/AmazingFeature`）
5. 创建 Pull Request

**提 PR 前请确保**：`npx tsc --noEmit` 无错、`npx vitest run` 全绿、
改动涉及运行时行为的请附上对应 `verify-*.mjs` 的结果。

---

## 许可证

本项目采用 **MIT 许可证**（仓库中尚未放置 `LICENSE` 文件）。

第三方素材的来源与许可见 `public/assets/textures/CREDITS.md`、
`public/assets/models/CREDITS.md`。

---

**开始你的太空之旅！🚀**
