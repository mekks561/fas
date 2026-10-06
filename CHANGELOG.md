# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-10-06

### Added

- **资源库扩展至 500MB 量级（~571MB，素材库性质）** - 三库全量入库（全部 CC0，
  详见 `public/assets/textures/CREDITS.md`）：
  - `public/assets/kenney/` 全库快照 361MB（3d 49 kit / 2d 120+ kit / icons 8 套 / ui 9 套，5.3 万文件）；
  - `public/assets/textures/pbr/ambientcg/` 18 套全套 117MB（此前只入 3 套的部分通道）；
  - `public/assets/textures/hdr/` polyhaven 夜空/月球 HDR 10 张 80MB（暂未接线，
    PlayCanvas 2.23 无内建 skybox asset handler，equirect→cubemap 管线待建）。
- **真 UI 图标替换纯色假料** - `textures/ui/icons/` 14 张（Kenney Space Shooter
  Remastered + Game Icons，按语义挑选）；新增 `AssetIcon` 组件（config icon id →
  URL 拼接 + onError 回落 emoji/★），`ShopPanel`（20 张卡）与 `AchievementPanel`
  （15 张卡）的 icon 字段从此真正上屏——修复审计发现的「字段未通」缺口。
  原 `textures/ui/` 根下 40 个 64×64 纯色方块确认为假料，不再有消费方。

### Discovered（本轮新发现、未接线）

- `src/levels/` 整个模块（index + 10 个 level 配置，含波次/玩家/环境）在 src 中
  **零消费**——`skybox` 字段无人读的根因。接活它需连波次系统一起接，列为下一轮候选。

### Verified

- `verify-icon-wiring.mjs` 5/5（商店 20 + 成就 15 张图标全部加载、0 个 404）；
  tsc 0 错误；vitest 344/345（唯一失败为既有 GameResourceManager 慢下载用例）；
  vite build 通过（dist 585MB）。

### Added（关卡系统接通，commit `0d473420`）

- **src/levels 从死数据变唯一真源** - LevelSelect 删 60 行硬编码 5 关，改读
  `getAllLevels()`（5→10 关）；解锁规则 = 第 1 关/上一关已通关/等级达标。
- **派生层**（`src/levels/index.ts`）：`SKYBOX_TEXTURES`（Kenney 天空盒）、
  `LEVEL_LIGHTING`（5 档主光强度）、`ENGINE_DIFFICULTY`（策划 4 档 → 引擎 3 档，
  词表不一致会崩 UI 的坑在此收口）、`ASTEROID_FIELD`、`recommendedLevelForIndex`、
  `totalEnemiesOf`/`waveCountOf`、`LEVEL_LOCALE` 中文名。
- **GameScene 按配置初始化**：天幕图/光照/小行星带开关/玩家初始生命护盾/波次上限；
  新增 `__levelDebug` 观测钩子。
- **LevelProgress**（进度读写单一入口 + 星级取历史最好，7 单测）与
  **CreditsStore**（金币统一入口，关卡奖励 credits 入账，ShopPanel 接入）。
- App `?level=N` 深链（1 基）。

### Verified（关卡系统）

- `verify-level-system.mjs` 18/18（含第 1 vs 第 2 关天幕/行星带/护盾/光照差分断言）；
  vitest 351/352；build 通过（dist 585MB）。

### Added（波次计划接线，本轮）

- **关卡显式波次表驱动运行时** - 此前战役波次由 Lua 公式生成
  （`5×1.1^(n-1)×难度`），关卡配置的波次表（enemy-scout×3 等）从未被消费，
  且配置词表（`enemy-` 前缀/`boss-sentinel` 连字符）EnemySystem 根本不认识。
  - `src/levels/index.ts` 新增 `ENEMY_TYPE_TO_RUNTIME`（两套词表唯一换算处）
    与 `buildWavePlans()`（波次表 → 运行时生成计划）；
  - `WaveManager` 新增**计划模式**：注入计划后敌人数量/类型/boss 判定全部由
    关卡数据决定（不触碰 Lua），未注入（生存模式）保持 Lua 公式路径不变；
  - GameScene 战役注入计划 / 生存显式清空。

### Fixed（本轮）

- **「末波永不是 boss」** - 旧公式 boss = `wave % 5 == 0`，战役波数常 < 5 →
  boss 波根本轮不到；现 boss 判定由数据决定（该波含 boss 类型即 boss 波，
  level-05 哨兵 / level-10 帝王按配置出场）。
- **注入计划时 maxWaves 陈旧值** - GameScene 先 `setMaxWaves(3)`（走 Lua）、
  再注入计划，planState 保留 Lua 侧旧值 → 末波判定永不成立、关卡无法结算；
  现注入计划时 maxWaves 同步取计划波数。

### Verified（波次计划）

- 新增 `WaveManager.test.ts` 12 单测（计划模式全确定性，不依赖 Lua）；
- 新增 `scripts/verify-wave-plans.mjs` 16/16：level-01 三波 3/5/6 敌人全按计划
  （公式会给 4/4/4）、打完触发关卡完成；?level=5 末波 isBossWave=true、
  boss_sentinel×1 实际生成、击杀触发结算；
- 回归：`verify-level-system.mjs` 18/18、`verify-wave-progression.mjs` 闭环全绿
  （3 波 14 敌全灭、胜利文案出现、0 运行时错误）；tsc 0 错；vitest 362/363
  （唯一失败为既有慢下载用例）。

## [Unreleased] - 2026-10-05

### Added

- **资源库利用率审计 + ambientCG 真 PBR 接入** - 新增 `scripts/audit-asset-usage.mjs`
  （四层判定：直接命中 → 动态前缀 → 排除假消费方 → 传递闭包，`--json` 可机读）与
  `docs/2026-10-05-资源库利用率审计.md`。结论：278 个资源 / 10.04MB 里运行时只加载
  135 个（49%）/ 8.11MB（81%）——两个口径差一倍纯粹因为音频占 66% 体积且 100% 在用；
  真正读不到的是 142 个 / 1.92MB，根因是 `manifest.json` 自证死链 + `AssetManifest.ts`
  （全仓唯一做 id→URL 映射的文件）是死代码。审计后第一轮动作不是删而是**先用真料顶上**：
  从备用库接入 ambientCG 三套 CC0 真材质（Rock030 / MetalPlates016A / Metal049A，1K JPG，
  共 3.7MB），应用到小行星带 40 个（rock）/ 空间站（metalPlates）/ 卫星（metal），
  替换 Kenney 纯色低模的平色材质。引擎新增 `preloadPbrTextures()` +
  `applyPbrMaterial(root, set)` + `applyPbrMaterialWhenReady()`（GLB 替换往往早于贴图
  加载完成，`onReplaced` 回调 + 未就绪登记回填）。配套 `scripts/verify-pbr-materials.mjs`
  （6 断言全绿：贴图请求全 2xx → 引擎日志 42 次 applied → 场景内 82/110 网格挂上
  diffuseMap → 0 运行时错误）。审计同时纠正了一个此前的乐观结论：`textures/ui/` 那
  40 个"图标"（含配置里 18 个未消费的 icon 字段）实际全是 **64×64 纯色方块**
  （逐张解码验证：单色 ×4096 像素、仅 203~227 字节），接上屏是降级不是白捡——
  试接过一版已回滚，正解是换真图标。

### Fixed

- **`__waveDebug.godMode()` 从未生效** - 钩子签名是 `godMode(on: boolean)` 必须传参，
  而所有验证脚本（含既有的 `verify-glb-models.mjs`）都写成无参调用 `godMode?.()`，
  **无敌从未真正开启过**，此前的战斗截图全靠"抓得快"。已给参数加默认值 `on = true`。

### Added

- **后处理系统正式接通（bloom / 暗角 / 色彩校正）** - `VisualEffectSystem`（原 953 行）
  此前整段被注释在 GameScene 渲染路径外，理由是「可能破坏渲染管线」；真实原因是它按
  PlayCanvas 1.x 的 API 写，迁到 2.x 后三处致命错叠加，构造函数第一句就抛异常被
  try/catch 咽掉——整套后处理从未真正生效过：① `PostEffectQueue` 构造签名是
  `(app, camera)`，原代码强转成 `(device)` 只传 graphicsDevice → 队列 `camera` 为
  undefined，基类构造里 `camera.on('set:rect')` 即抛；② `CameraComponent.postEffects`
  是只读 getter（相机构造时就自建队列），原代码强转赋值 → 严格模式 TypeError，
  正确做法是**复用相机自带队列**；③ `PostEffect` 在 2.x 退化为占位基类，不再接受
  shader、没有 `init()`/`setUniform()`，自定义效果必须继承并覆写 `render()`——
  把 uniform 写进 `device.scope` 再调 `drawQuad()`。重写为 `ShaderPostEffect`
  （单遍，uniform 经 scope 每帧刷新）+ `BloomPostEffect`（亮部提取 → 可分离高斯
  横/纵两遍 → 合成；中间缓冲按输入一半分辨率**惰性**创建，窗口缩放自动重建），
  删除已死的单遍 bloom / FXAA（与 MSAA 冗余）/ SSAO 空壳。关键坑：uniform 必须在
  `drawQuad` 之前绑定，未绑定的 sampler 会被引擎悄悄回落成 `builtInTextures.pink`
  （不报错、画面糊成粉色）。GameScene 正式接入 `cinematic` 预设，bloom 让上一轮的
  粒子尾焰/爆炸真正发光。配套 `scripts/verify-postfx.mjs`（12 断言全绿：队列启用 /
  效果数 3 / 相机渲染目标已切离屏 → 画面有真实内容 → 暗角差分（关掉后变亮
  0.043→0.077）→ bloom 差分（辉光带像素 14351→17104）→ 击杀结算仍正常）。
- **粒子特效贴图（消除「纯色光团」廉价感）** - 此前所有粒子系统（引擎尾焰/导弹尾焰/命中
  爆炸/敌机死亡爆炸/道具拾取/技能爆炸）的 colorMap 都是引擎默认的纯白小圆点——视觉上
  是一团纯色。本轮从备用库 Kenney Particle Pack 挑选 7 张白色发光形状贴图（512×512
  透明 PNG，共 ~430 KB，CC0），利用 PlayCanvas 粒子着色器的 `tex.rgb × colorGraph.rgb`
  特性：**只需换贴图、无需动任何颜色配置**，颜色仍由各系统既有 colorGraph 染出。
  引擎侧新增 `preloadParticleTextures()`（开局一次性预加载，7 张全部就绪后新建粒子
  同步取用）与 `addParticleSystem()`（`colorMapUrl` 就绪即应用、未就绪登记回填——
  覆盖「常驻尾焰创建于贴图加载前」的时序）。敌机死亡爆炸按体量分贴图（普通用环形
  冲击波光球，Boss/重型用六芒星光）。配套 `scripts/verify-particle-textures.mjs`
  （9 断言全绿：7/7 就绪 → 常驻尾焰 colorMap 已回填 → 爆炸截图可见贴图纹理）。
- **生存模式接通（又一个 1,064 行「做完没接」的半成品）** - `SurvivalModeManager`（437 行
  - 374 行测试）+ `SurvivalModeUI`（253 行）此前零消费：`update(dt)` / `recordEnemyDefeat`
    没有任何生产代码调用（状态机永远停在 menu），UI 没有入口，连 CSS 都不存在。
    接线设计——**敌人只有 WaveManager 一个真源**：生存管理器 `setExternalControl(true)`
    交出波次生成权（只保留计时/统计/状态机，避免两边波次人数不一致导致提前完成），GameScene
    做桥接——检出它的 currentWave 前进就让 EnemySystem 启动对应波次；波次无尽
    （`setMaxWaves(999)`）且永不触发通关结算，阵亡即结束。主菜单新增「生存模式」；
    开局倒计时 / 战斗 HUD（波次/分数/时间/连击，`pointer-events:none` 不挡操作）/
    波间过渡 / 结算入榜全链路可玩，本地最高分榜（前 10 名）持久化。配套
    `SurvivalModeUI.css`（全量补齐，选择器限定在面板容器内防全局污染）与
    `scripts/verify-survival-wiring.mjs`（36 断言全绿：入口→倒计时→桥接出真敌人→
    清波波号前进+分数击杀上涨→第 3 波精英标记→阵亡结算→提交名字入榜→重开）。
- **技能树全链路接通（此前是 1,284 行「两端全断」的半成品）** - `SkillTreeManager`（670 行，
  12 天赋/等级发点/localStorage 持久化）+ `SkillTreeUI`（344 行）此前全项目零消费：
  没有任何生产代码调用 `setPlayerLevel`（等级恒 1、天赋点恒 0、12 个天赋全部点不动），
  `getStats()` 也没有任何战斗代码读取（点了也不会变强），UI 没有入口。本轮三段全接：
  ① **升级源**：每清一波玩家等级 +1（store 的 `player.level` 为唯一真源，跨局累积——
  `resetGame` 保留它）；② **属性出口**：新增 `SkillBonusAdapter` 把天赋加成合并进
  BuildSystem 的修饰符（相乘/相加，非覆盖），局内三选一与跨局技能树两条强化线同时生效；
  ③ **UI 入口**：主菜单新增「技能树」（`GameState.SKILL_TREE` + lazy 加载）。
  配套 `scripts/verify-skilltree-wiring.mjs`（28 断言全绿：清 3 波 → 升 3 级得 3 点 →
  点 3 个天赋 → 实测 PlayerShip 生命 100→110、护盾 50→55、武器伤害倍率 ×1.05 ——
  读的是战斗系统内部状态而非技能树自述）。
- **备用素材库（多源 CC0，520 MB）** - 新增 `scripts/fetch-asset-reserve.mjs`，一次性预抓三个
  CC0 源到 `.workbuddy/asset-cache/`（`.gitignore` 已忽略：**不进 `public/`、不参与构建、
  不进版本库**），后续开发随时取用：Kenney 全库快照（252 MB，与 `fetch-kenney-models.mjs`
  钉同一 commit）+ Poly Haven HDRI 73 张（152 MB，`pure skies` 全量 / 月面实验室 4k /
  暗夜净空 / 摄影棚）+ ambientCG PBR 材质 18 套（116 MB，太阳能板 / 科幻装甲板 / 岩石 / 地表）。
  幂等可续抓（`.reserve-ok` 完成标记 + 压缩包 gzip 预检复用）、断网可从磁盘重建清单、
  单源失败不拖垮全局。配套 `scripts/verify-asset-reserve.mjs`（GLB 结构抽样 / Radiance 魔数 /
  PBR 贴图完整性 / manifest 对账）。产出 `manifest.json`（逐文件 URL/sha256/许可）与
  `INDEX.md`（按套件索引，标注本游戏高相关项）。
- **太空天幕（场景背景升级）** - `PlayCanvasEngine.createSkyDome()`：挂在**相机**下的大球内壁
  （位置跟随相机 ⇒ 无限远背景，无视差穿帮），`emissiveMap` 不受光照影响，
  `CULLFACE_FRONT` 只渲染内壁。贴图用 Kenney Skyboxes 的 `skybox-space.png`
  （4096×2048 星云全景，272 KB，CC0）异步加载，失败回落深色背景不阻塞开局。
  近景星星 300 → 120 颗（保留运动视差，远处的星空交给天幕）。实测背景从
  「死黑 + 白点」变为星云渐变，0 加载失败、0 运行时错误。
- **`public/assets/textures/CREDITS.md`** - 纹理类素材来源登记表（首个条目：天幕贴图）。

### Fixed

- **SurvivalModeUI 的条件 Hook（零引用期间未暴露）** - `useEffect` 写在
  `if (state === 'gameOver')` 分支体内：状态一切换 hook 调用数量就变，React 会抛
  "Rendered more hooks than during the previous render" 并让整个面板崩溃。
  已上移到组件顶层（ref 保证同一局只处理一次，离开 gameOver 后复位）。
- **同一波会重复触发 onWaveComplete（发放升级后暴露）** - `GameplayManager.onEnemyKilled`
  判定波次完成的条件里有一条「当前 wave state 已是 completed」，`killAll()`／大型爆炸
  这类一次性多杀会让后续每个击杀都再次命中它。既有的「排下一波」「弹强化选择」恰好
  幂等所以一直没人察觉；升级发点不幂等，实测清 1 波涨了 4 级。已在 GameScene 用
  「已发放波号」去重，一波只发一次。
- **波次完成弹强化选择并暂停游戏期间，天赋加成推不进战斗系统** - 修饰符同步原先在
  update 回调的「非暂停」判断内；玩家正是在暂停窗口里加点，加成要等关掉弹窗才生效。
  同步属于状态派生而非游戏逻辑，已移出暂停判断（暂停时也保持一致）。
- **`download()` 无超时** - `fetch-asset-reserve.mjs` 的下载在连接挂起时会永久阻塞
  （实测卡在 `SolarPanel002` 7 分钟+），已加 `AbortSignal.timeout(120s)`。
- **Windows 路径喂给 MSYS tar/unzip** - `F:\…` 会被 GNU tar 当成「远程主机:路径」
  （报 `Cannot connect to F: resolve failed`），加 `--force-local` 后反斜杠又被转义坏；
  统一转为 POSIX 路径（`/f/…`）解决。
- **删除不再中断抓取** - 本环境 `fs.rm` 被安全层接管走回收站，对大文件会 `ETIMEDOUT`
  并炸掉整个脚本；新增 `rmSoft()` 尽力而为删除 + `.reserve-ok` 完成标记（重跑跳过已完成段）。

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
