# 2026年10月 开发日志存档

## 2026-10-03-playcanvas2-迁移执行记录.md

# PlayCanvas 1.62 → 2.23 迁移执行记录

> 执行时间：2026-10-03 23:05 – 23:30
> 对应清单：`docs/2026-10-03-playcanvas2-升级评估与迁移清单.md`
> 本次范围：**P1 / P3 / P4 / P5 / P6 / P7 六批 + torus 改自定义 Mesh**（P2 按约定留给你自己动手）

---

## 一、结论：六批全部完成，类型错误 35 → 11

| 验收项           | 迁移前    | 迁移后                                |
| ---------------- | --------- | ------------------------------------- |
| `tsc --noEmit`   | 35 个错误 | **11 个**                             |
| 其中本次目标错误 | 24 个     | **0 个**                              |
| 剩余             | —         | 10 个 P2（留给你的）+ 1 个 poc 子工程 |
| `vitest run`     | 344 / 345 | **344 / 345（完全不变）**             |
| `pnpm build`     | 通过      | **通过（14.87s）**                    |
| 开发服务器       | —         | ✅ 5175，全部改动模块转换正常         |

失败的那 1 个测试**与基线完全相同**：`GameResourceManager > should test slow download scenario` 超时（5s 限制）。它在迁移前就是这一个，不是本次引入。

---

## 二、我实际改了什么（12 个文件）

| 批次      | 改动                                                                             | 文件                                                                               |
| --------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **P1**    | `colorGraph` 去掉 `{ graph: ... }` 包装层 —— 6 处                                | Enemy · PlayerShip · PowerupSystem · SkillSystem · WeaponSystem ×2                 |
| **P3**    | `getPosition()` 加 `.clone()`（返回值在 Engine 2 变只读）—— 2 处调用点、6 个错误 | EnemyAI · PlayerShip                                                               |
| **P4**    | `scene.fog/fogColor/fogDensity` → `scene.fog.type/color/density`                 | PlayCanvasEngine                                                                   |
| **P5**    | 粒子选项改名 —— 8 处字面量                                                       | ObjectPool ×2 · Enemy · PlayerShip · PowerupSystem · SkillSystem · WeaponSystem ×2 |
| **P6**    | 模型 `type` 收窄为图元字面量联合 + 修 `diamond`                                  | EnhancedEnemy · LevelEditor · ObjectPool · **game-types.ts（新增共享类型）**       |
| **P7**    | `app.mouse` 空值守卫                                                             | LevelEditor                                                                        |
| **torus** | 改用 `pc.createTorus` 生成自定义 Mesh —— 2 处                                    | PlayCanvasEngine · EnhancedPlayCanvasEngine                                        |

### P7 的一处判断说明

清单里建议写 `if (!mouse) return;`。我改成了 **if 块**而不是提前 return：

```ts
const mouse = this.app.mouse;
if (mouse) {
  mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
  // ...
}
window.addEventListener('keydown', this.onKeyDown.bind(this));
```

原因：提前 return 会让**键盘监听也注册不上**。鼠标不可用时键盘仍然应该能用。

### P6 新增了共享类型 `PrimitiveModelType`

放在 `src/types/game-types.ts`，内容是引擎图元字面量联合（`'asset' | 'box' | ... | 'torus'`）。

这不只是为了消掉 2 个错误 —— 它让 `'diamond'` 这类非法图元名**在编译期就被拦住**。原来返回 `string`，非法值一直要到画面上才发现。

---

## 三、本次挖出 3 个「静默失效」陷阱（都比 P2 更隐蔽）

这三条的共同点：**引擎不报错、TypeScript 也不报错，但代码实际没生效**。

### 陷阱 1：`new pc.CurveSet(data, 'color')` 里那个 `'color'` 是硬 bug

`CurveSet` 的构造函数是 `constructor(...args)`，逻辑是：

```js
if (args.length > 1) {
  for (...) this.curves.push(new Curve(args[i]));   // 每个参数各当成一条曲线
}
```

也就是说，**只要传了第二个参数，原本的 3 条曲线分组就被破坏**。实测：

```
带 'color' 第二参数 -> 曲线数=2   ← 应为 3
不带第二参数        -> 曲线数=3   value(0.5) = 0.8 / 0.5 / 0
```

而且带 `'color'` 的那份在取值时**直接抛异常**：`TypeError: Cannot read properties of undefined (reading '0')`。

代码里共 **15 处**（6 处 P1 点 + `PowerupSystem.getColorCurve()` 里 9 处），全部已去掉。**这是在修真 bug，不是清理。**

### 陷阱 2：粒子组件有 4 个选项在 Engine 2 里根本不存在

我把 Engine 2 的合法选项表（组件 47 个 setter + 19 个覆盖项）拉出来逐项核对：

| 项目里用的  | Engine 2 状态                      | 正确写法                                 |
| ----------- | ---------------------------------- | ---------------------------------------- |
| `speed`     | ❌ 不存在                          | `initialVelocity`                        |
| `spread`    | ❌ 不存在                          | 无对应项 —— 方向改由 `emitterShape` 决定 |
| `sizeGraph` | ❌ 不存在                          | `scaleGraph`                             |
| `burst`     | ❌ **整个引擎实现文件里 0 次出现** | `loop: false` + `numParticles: N`        |

`burst` 的替换依据是**官方文档原话**：「If checked, the particle system will emit indefinitely. **Otherwise, it will emit the number of particles specified by the 'Particle Count' property and then stop.**」

`spread` 的替换依据（官方 Particle System 文档）：「box emitters direct particles along local Z-axis, while sphere emitters direct particles radially outward.」

**这一条要特别注意**：`burst` 被移除意味着原来 `rate: 0 + burst: N` 的写法在 Engine 2 下**一个粒子都不会发射** —— 所有爆炸特效都是隐形的。删掉 `spread` 则是行为中性的（它本来就被忽略）。

共 8 处字面量，全部已改。

### 陷阱 3：TypeScript 会漏报未知选项 —— 所以别拿「类型检查通过」当选项名的证据

这是最该记住的一条。

我一开始看到 `sizeGraph` 没被报错，以为它合法。做对照实验才发现：

| 实验                                                          | `sizeGraph` 报错吗 |
| ------------------------------------------------------------- | ------------------ |
| 单独一个 `addComponent('particlesystem', { sizeGraph: ... })` | ✅ 报              |
| 复刻项目里那个字面量（里面还有一处 `colorGraph` 的错）        | ❌ **不报**        |

也就是说：**同一个对象字面量里只要已经存在一处错误，TypeScript 就不再报告其它未知属性。** 实测每个字面量只报第一个未知项 —— 所以实际失效的选项是 14 处，而编译期只提示了 8 处。

推论：迁移期间「tsc 通过」≠「选项名都合法」。凡是引擎侧的字符串选项，都要拿合法选项表核，或者实际跑一遍看效果。

---

## 四、torus 自定义 Mesh 实测数据

`pc.createTorus(device, { ringRadius, tubeRadius })`（注意参数名是 **`ringRadius`**，不是 `radius`）。

用 `ringRadius = 2.0, tubeRadius = 0.4` 实测几何：

| 项              | 实测       | 期望                                 |
| --------------- | ---------- | ------------------------------------ |
| 顶点数 / 索引数 | 651 / 3600 | —                                    |
| 最大水平半径    | **2.400**  | ringRadius + tubeRadius = 2.400 ✅   |
| 最大垂直半径    | **0.400**  | tubeRadius = 0.400 ✅                |
| 对照：内建默认  | **0.500**  | 这就是参数被静默忽略时你会得到的尺寸 |

两个参数**各自独立生效**，`createTorus` 的函数签名保持不变，所有调用点零改动。

---

## 五、剩下 11 个错误，全是你自己动手的 P2

只剩两类，都与本次六批无关：

**A. 几何体尺寸（10 处）** —— Engine 2 的原始几何体是固定单位尺寸，`width/height/radius` 选项已被删除：

- `PlayCanvasEngine.ts`：`:206`(box) · `:219`(sphere) · `:235`(cylinder) · `:264`(star field 循环内) · `:499`(plane)
- `EnhancedPlayCanvasEngine.ts`：`:197` · `:210` · `:226` · `:267`
- `InstancedRenderer.ts`：`:98`

⚠️ 仍然成立：这些多余参数**不会抛运行时错误，只会被静默忽略**。改完**必须肉眼看画面**，构建通过不算验收。

**B. `poc/trpc-leaderboard/src/prisma/client.ts:11`** —— 独立子工程被本仓库 tsconfig 纳入所致，与 PlayCanvas 无关。

---

## 六、需要你定夺的 3 件事

### 1. `rate` 的单位可能一直是错的（建议优先看这条）

Engine 2 官方注释原文：`Sets the **minimal interval in seconds** between particle births.`
—— 也就是说 `rate` 是**间隔秒数**，不是「每秒多少个」。

而 `PlayerShip.ts:139` 写的是：

```ts
rate: 30, // 每秒 30 个粒子
```

按官方语义，`rate: 30` = **每 30 秒才出生一个粒子**。注释和代码矛盾了 900 倍。`WeaponSystem.ts` 的导弹尾焰也是 `rate: 30`。

我**没有改**这个 —— 它是画面手感参数，和 P2 同类，该由你定。若按注释的意图，应该写成 `rate: 0.033`。

### 2. `diamond` 我选了 `sphere`

`ObjectPool.ts` 里精英敌人原本用 `{ type: 'diamond' }` —— 这个图元名**在 Engine 1 里也是非法的**（合法联合只有 asset/box/capsule/cone/cylinder/plane/sphere/torus），所以它一直渲染不出预期形状，是**升级之前就存在的既存 bug**。

我改成了 `sphere`（配合 `setLocalScale(0.8, 1, 0.8)` 得到一个竖直椭球，且与 SCOUT 的颜色不同所以能区分）。如果你想要更接近「菱形」的观感，改成 `torus` 是一行的事。

### 3. 画面验收必须你来做

我只验证到「构建通过、测试不变、模块能转换、引擎 API 实测生效」。
**没有验证场景真的渲染出来了** —— 那需要肉眼看。P2 改完一起看：尺寸对不对、雾效在不在、爆炸粒子出不出来、尾焰颜色对不对。

---

## 七、回滚

本次迁移只改源码，一条命令回到升级前的引擎：

```bash
cp package.json.pre-pc2-bak package.json && cp pnpm-lock.yaml.pre-pc2-bak pnpm-lock.yaml && pnpm install
git checkout -- src/     # 撤回本次全部源码改动
```

⚠️ 但 `git checkout -- src/` 会**连带丢弃你迁移前就存在的未提交改动**（29 个文件）。要精确回滚，请只 checkout 上表第二节列出的 12 个文件。

---

## 八、收口：P2 迁移完成 + 首次真实画面验证（2026-10-04 补记）

### 结果

| 验收项           | 结果                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`   | **0 错误**（P2 十处全部改完；poc 最后 1 处 TS4111 一并修掉）                                      |
| `vitest run`     | 344 / 345 通过（唯一失败仍是既存超时，与基线相同）                                                |
| `pnpm build`     | 通过                                                                                              |
| **真实画面验证** | **通过** —— Playwright 真实加载游戏并进入战斗：星空、行星、小行星带、玩家舰全部正确渲染、尺寸正常 |
| 运行时错误       | **509 → 0**（修复了 Engine 2 移除 `Sound.play()` 造成的音频报错风暴）                             |

### P2 的改法（全在工厂函数内，调用点零改动）

换算依据为 Node 实测的 Engine 2 内建图元原始尺寸：box=1×1×1、sphere 直径 1、cylinder 直径 1/高 1、plane 在 XZ 平面 1×1（无厚度）。

| 函数                     | 写法                                                  |
| ------------------------ | ----------------------------------------------------- |
| createBox                | `setLocalScale(width, height, depth)`                 |
| createSphere             | `setLocalScale(2r, 2r, 2r)`                           |
| createCylinder           | `setLocalScale(2r, height, 2r)`                       |
| createPlane              | `setLocalScale(width, 1, height)`（height 对应 Z 轴） |
| InstancedRenderer 占位盒 | `setLocalScale(0.1, 0.1, 0.1)`                        |

### 音频修复 —— 第 4 个静默陷阱，只有运行时验证抓得到

`AudioSystem.playSound` 原来用 `as unknown as { play }` 强转去调 `Sound.play()` —— 该 API 在 Engine 2 已移除，且强转让 tsc 无从报错。已改为：

```ts
new pc.SoundInstance(this.app.soundManager, sound, { volume, loop }).play();
// 空间音效改用 pc.SoundInstance3d（旧的 spatialBlend / maxDistance 选项已不存在）
```

另确认：`app.audio` 在 Engine 2 上不存在，`playGeneratedSound` 的合成音兜底会静默失效（不报错、也没声）—— 已知问题，不阻塞。

### 发现的死代码（未接线，不在启动链上）

启动路径是 `GameScene.tsx → lazyImports.ts → PlayCanvasEngine`。`Enhanced*` 一族（EnhancedPlayCanvasEngine / EnhancedPlayerShip / EnhancedEnemy / EnhancedEnemySystem / EnhancedWeaponSystem）只被彼此引用，没有入口。其中 `createParticleSystem` 设置的 6 个属性（speed / colorStart / colorEnd / sizeStart / sizeEnd / emissionRate）在 Engine 2 全部不存在，且 `emitterShape: 'cone'` 不合法 —— **Engine 2 只有 box / sphere 两种发射器，没有 cone**。这些编译期抓不到（强转 + 项目自封装 API），留待决定死代码去留时一并处理。

### 复验工具

`scripts/pc2-visual-verify.mjs`：Playwright 打开游戏 → 「开始游戏」→「开始挑战」→ 抓运行时错误并截图到 `docs/verify/`。截图证据：`docs/verify/03-gameplay.png`（星空/行星/小行星/玩家舰渲染正常）。

### 下一步（带主语）

1. **你** → 自己玩一局（`pnpm dev`），确认手感：爆炸粒子出不出来（`burst` 迁移后语义变了）、音效是否正常、飞船尺寸对不对
2. **你** → 决定 `Enhanced*` 死代码去留（迁完 / 冻结 / 删除）
3. **你** → 在自己的终端跑 `pnpm prepare`（husky，lint-staged 目前不生效）
4. **你** → 处理那 29 个迁移前就存在的未提交改动 —— **现在基线全绿，正是提交的最佳时机**

---

_本文档记录的是实际执行结果与实测数据。所有引擎侧结论均来自 `node_modules/playcanvas/build/playcanvas.d.ts`（2,856,376 字节）的实际声明、`build/playcanvas.mjs` 实现代码，以及 Node 里直接运行的验证脚本，不是文档推测。_


---

## 2026-10-03-playcanvas2-升级评估与迁移清单.md

# PlayCanvas 1.62 → 2.23 升级评估与迁移清单

> 评估时间：2026-10-03 22:57
> 方式：**实装 2.23.0 后实测**（tsc / vitest / build），不是查文档推测
> 当前仓库状态：**playcanvas 已装 2.23.0，类型检查 35 个错误，构建与测试均通过**

---

## 〇、先把回滚说清楚

仓库现在处于「已换引擎、代码未迁移」的中间态。一条命令回退：

```bash
cp package.json.pre-pc2-bak package.json && cp pnpm-lock.yaml.pre-pc2-bak pnpm-lock.yaml && pnpm install
```

---

## 一、结论

**A 站得住脚，而且比原先设想的好得多。**

真正需要动脑的语义变更只有 **1 条**（几何体尺寸），其余 5 条都是机械替换。我之前倾向 B 是出于成本厌恶；实测数据出来后，A 更合理。

| 维度               | 1.62.0 → 2.23.0                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 类型错误           | 26 → **35**（+9）                                                                                                                 |
| 但其中最难解的部分 | **消失 20 个**：`VisualEffectSystem` 12 个 + `ProceduralTextureGenerator` 8 个                                                    |
| 单元测试           | 344/345 → **344/345（完全不变）**                                                                                                 |
| 生产构建           | ✅ 通过 → ✅ **通过**                                                                                                             |
| 引擎分块体积       | 1,366.74 kB → **2,483 kB（+86%）**                                                                                                |
| 版本活跃度         | 1.62.0 发 2023-03-29（三年半前）；1.x 终为 LTS 只修 bug；官方 Editor 已于 **2026-07-29 停用 Engine V1**；2.23.0 发 **2026-10-01** |

⚠️ **一处必须澄清**：两次构建耗时 65s vs 17.7s，看着像引擎变快了 3.7 倍 —— **不成立**。构建日志显示 65s 里有 61.3s 花在 `vite:prepare-out-dir`，也就是清空旧的 1808 个 dist 文件。第二次这个钩子只用了 14s。差的是清理开销，不是引擎性能。引擎本身没有实测到速度变化。

---

## 二、消失的 20 个错误（这是升级的真实收益）

`ProceduralTextureGenerator.ts` 用的 `pc.Compute` / `StorageBuffer` / `computeDispatch` / `supportsCompute` / `BUFFERUSAGE_COPY_SRC|DST` —— 这些 **就是 Engine 2 的 compute shader 能力**。原来它们「不存在」，是因为你锁在老版本上。

也就是说：**这段代码是按 Engine 2 写的，只是依赖一直没跟上。** 这反过来解释了为什么它能在 1.x 下"编译不过但项目没崩" —— 那条 GPU 路径从未真正执行过。

`VisualEffectSystem.ts` 的 12 个 `PostEffect` 类型冲突也随之消失。附带待办：`src/types/playcanvas.d.ts` 这个手工补丁文件可能已经多余，值得单独复查能否删除（**我没有验证过，不下结论**）。

---

## 三、35 个错误 → 7 种模式，逐条改法

### P1 · 删掉 `{ graph: ... }` 包装层 —— 6 处

| 位置                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/engine/Enemy.ts:382` · `src/engine/PlayerShip.ts:144` · `src/engine/PowerupSystem.ts:211` · `src/engine/SkillSystem.ts:248` · `src/engine/WeaponSystem.ts:397` · `src/engine/WeaponSystem.ts:565` |

```ts
// 1.x
colorGraph: {
  graph: new pc.CurveSet(
    [
      [0.6, 0.8, 1.0],
      [0.3, 0.5, 1.0],
      [0, 0, 0],
    ],
    'color',
  );
}

// 2.x —— 直接传 CurveSet
colorGraph: new pc.CurveSet([
  [0.6, 0.8, 1.0],
  [0.3, 0.5, 1.0],
  [0, 0, 0],
]);
```

依据：`colorGraph?: CurveSet | { type?: number; keys: number[][] }` —— 只接受 `CurveSet` 本体或 `{keys}` 对象，`{graph}` 这个包装已不存在。
**注意**：旧代码传给 `CurveSet` 的第二个参数 `'color'` 在新版构造函数（`constructor(...args: any[])`）里没有对应语义。改完**必须实跑确认颜色曲线真的在动**。

### P2 · 几何体尺寸改由 `setLocalScale` 承载 —— 12 处（本次唯一的语义变更）

**Engine 2 的原始几何体全部是单位尺寸**，官方注释原文：「geometry ... is rendered using the owning entity's final world transform」。

| type       | Engine 1                  | Engine 2                           |
| ---------- | ------------------------- | ---------------------------------- |
| `box`      | 可传 `width/height/depth` | 固定单位立方体，尺寸参数**已删除** |
| `sphere`   | 可传 `radius`             | 固定半径 **0.5**                   |
| `cylinder` | 可传 `radius/height`      | 固定 高 1 / 半径 0.5               |
| `capsule`  | 可传 `radius/height`      | 固定 高 2 / 半径 0.5               |
| `plane`    | 可传 `width/height`       | 固定 1×1                           |
| `torus`    | 可传 `radius/tubeRadius`  | 固定 ring 0.3 / tube 0.2           |

**好消息**：全项目的几何体创建集中在 5 个工厂函数里，**函数签名不用改，只改函数体**，所有调用点零改动。

```ts
// src/engine/PlayCanvasEngine.ts
createBox(name, width, height, depth, material)      // :196 → setLocalScale(width, height, depth)
createSphere(name, radius, material)                 // :215 → setLocalScale(r*2, r*2, r*2)
createCylinder(name, radius, height, material)       // :226 → setLocalScale(r*2, height, r*2)
createPlane(name, width, height, material)           // :479 → setLocalScale(width, 1, height)
createSphere(...)  # :264 createStarField 循环内      //      → 每颗星按 size 单独 setLocalScale
```

另有 3 处不在工厂函数内，需单独处理：`src/engine/EnhancedPlayCanvasEngine.ts:197/210/226/243/260`、`src/engine/InstancedRenderer.ts:98`。

> ### ⚠️ 本次升级最阴的坑
>
> 这些多余的 `width`/`radius` 属性在 2.x 里**不会抛运行时错误，只会被静默忽略**。结果是：类型错误只有 12 条，但运行起来**所有飞船、敌人、子弹都会变成 1×1×1 的单位大小** —— 游戏能跑，画面全错。
> 所以这一条**不能靠"能构建过"验收，必须肉眼看画面**。

**开放项（需你定夺）**：`createTorus(name, radius, tubeRadius, ...)` 在 Engine 2 下无法实现 —— 整体缩放会同时改变环半径和管半径，无法独立控制。三选一：① 接受近似（按 ring 缩放，管径将偏离）；② 改用自定义 Mesh；③ 暂时不用 torus。

### P3 · `getPosition()` 变为只读 —— 6 处

`src/engine/EnemyAI.ts:177-179` · `src/engine/PlayerShip.ts:282-285`

官方签名：`getPosition(): Readonly<Vec3>`（`playcanvas.d.ts:17930`）。

```ts
// 前
const currentPos = this.entity.getPosition();
// 后 —— 加一个 .clone()
const currentPos = this.entity.getPosition().clone();
```

后面已经有 `this.entity.setPosition(currentPos)`，行为不变。官方示例（`playcanvas.d.ts:12611`）也是这么写的。

### P4 · `Scene.fog` 迁到 `FogParams` —— 1 处

`src/engine/PlayCanvasEngine.ts:380-382`（`enableFog` 方法）

```ts
// 前
this.app.scene.fog = pc.FOG_EXP2;
this.app.scene.fogColor = color;
this.app.scene.fogDensity = density;

// 后
this.app.scene.fog.type = pc.FOG_EXP2;
this.app.scene.fog.color = color;
this.app.scene.fog.density = density;
```

依据：`get fog(): FogParams`（只读 getter，所以整体赋值被拒），而 `FogParams` 拥有 `type / color / density / start / end` —— `fogDensity → fog.density` 是 1:1 映射。

### P5 · 粒子发射器 `type` → `emitterShape` —— 2 处

`src/engine/ObjectPool.ts:139` · `:349`

```ts
// 前
this.entity.addComponent('particlesystem', { type: 'box', ... });
// 后
this.entity.addComponent('particlesystem', { emitterShape: pc.EMITTERSHAPE_BOX, ... });
```

依据：`set emitterShape(arg: number)`（`playcanvas.d.ts:54440`），且注释指明盒子形状的范围由 `emitterExtents`（Vec3）控制。

### P6 · 模型 `type` 收紧为字面量联合 —— 4 处

**一个改动连带修 3 处**：把 `src/engine/EnhancedEnemy.ts:271` 的 `getModelType(): string` 返回类型收窄为
`'asset'|'box'|'capsule'|'cone'|'cylinder'|'plane'|'sphere'|'torus'`。
同类问题在 `src/engine/LevelEditor.ts:577 / :672`（`getMeshType()`）。

`src/engine/ObjectPool.ts:243` 的 `{ type: 'diamond' }` —— **`diamond` 在 1.x 的合法联合里也不存在**（只有 asset/box/capsule/cone/cylinder/plane/sphere/torus）。**这是升级之前就存在的既存 bug**，只是 1.x 的类型更松没报出来。这条精英敌人一直渲染不出预期形状。请顺手决定它该用 `sphere` 还是 `torus`。

### P7 · 新增的空值守卫 —— 3 处

`src/engine/LevelEditor.ts:312-314`：`this.app.mouse.on(...)` 现在报「对象可能为 null」。

```ts
const mouse = this.app.mouse;
if (!mouse) return;
mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
```

### P8 · 与本升级无关的 1 处

`poc/trpc-leaderboard/src/prisma/client.ts:11` —— 独立子工程被本仓库 tsconfig 纳入所致，与 PlayCanvas 无关。

---

## 四、建议执行顺序

| 序  | 做什么                                                   | 做完的判据                     |
| --- | -------------------------------------------------------- | ------------------------------ |
| 1   | P3 + P4（共 7 处，纯机械、零风险）                       | 错误 35 → 28                   |
| 2   | P1（6 处）+ P5（2 处）                                   | 错误 28 → 20                   |
| 3   | P6（3 个函数签名 + 1 个 diamond）                        | 错误 20 → 16                   |
| 4   | P2 工厂函数 5 个（**先只改这一个文件**）                 | 错误 16 → 10                   |
| 5   | P2 剩余 7 处 + P7                                        | 类型检查归零（除 poc 那 1 个） |
| 6   | **肉眼看画面** —— 尺寸对不对、雾效在不在、粒子颜色动没动 | 这一步不能省                   |

**为什么 P2 排在后面**：它是唯一会改变画面的改动，前面四步先把机械债清掉，这样出问题时你能立刻定位到 P2。

---

## 五、本次产生的文件（都留着，便于回滚与复查）

| 文件                                                      | 性质                                        |
| --------------------------------------------------------- | ------------------------------------------- |
| `package.json` / `pnpm-lock.yaml`                         | 已改：playcanvas `^1.62.0` → `^2.23.0`      |
| `package.json.pre-pc2-bak` / `pnpm-lock.yaml.pre-pc2-bak` | 升级前备份                                  |
| `pc2-errors.txt`                                          | 35 个错误的完整原始输出                     |
| `pnpm-workspace.yaml`                                     | 上一轮建的（`allowBuilds: { msw: false }`） |
| `package-lock.json.npm-bak`                               | 上一轮 npm 锁文件备份                       |

---

_本文档是**迁移前的评估**：所有 API 结论均来自 `node_modules/playcanvas/build/playcanvas.d.ts`（2,856,376 字节）的实际声明，不是文档推测。_

> ⚠️ **本文档已过时（2026-10-03 23:30 起）**：P1 / P3 / P4 / P5 / P6 / P7 六批与 torus 改造**已执行完毕**。
> 实际执行结果、新挖出的 3 个静默失效陷阱、以及剩余待办，见 **`docs/2026-10-03-playcanvas2-迁移执行记录.md`**。
>
> 三处与本文档的差异，以执行记录为准：
>
> 1. **P5 不只是 `type` → `emitterShape`**：`burst` / `spread` / `speed` / `sizeGraph` 四个选项在 Engine 2 里**全部不存在**，本文档漏了后三个。
> 2. **P1 有 15 处，不是 6 处**：`PowerupSystem.getColorCurve()` 里还藏着 9 处同样的 `'color'` 参数。
> 3. **P4 的 `FogParams` 结论正确**，`type/color/density` 三个字段都可写，已按此改。


---

## 2026-10-03-项目现状体检.md

# 项目现状体检与修复记录 — Fighter Game

> 体检：2026-10-03 22:30 ｜ 修复复检：2026-10-03 22:45
> **结论：三处断点已全通。项目现在可以构建、可以测试、可以运行。** 剩 26 个类型错误，不拦运行。

---

## 一、修复前后对照

| 检查项     | 修复前                    | 修复后                               |
| ---------- | ------------------------- | ------------------------------------ |
| 关键依赖   | `playcanvas`、`fdir` 缺失 | 已装（pnpm 12.8.1 / node v22.22.2）  |
| 类型检查   | 69 个错误（60 个 = 缺包） | **26 个**（全部是真实类型问题）      |
| 单元测试   | `vitest` 起不来，0 个用例 | **344 / 345 通过**（19/20 文件全绿） |
| 生产构建   | 未验证                    | ✅ `pnpm build` 1m 5s 成功           |
| 开发服务器 | 未验证                    | ✅ `http://localhost:5175/` 已监听   |
| 锁文件     | npm + pnpm 两套并存       | 只剩 `pnpm-lock.yaml`                |
| 源码       | —                         | **一行未改**                         |

那个唯一失败的测试：`src/GameResourceManager.test.ts:123` "should test slow download scenario" —— 5 秒超时。这个文件正在被改动（也在 29 个未提交文件里），属于"慢下载"场景的时序测试。

---

## 二、这次实际改了什么（只有 3 处，全部可回滚）

| #   | 动作                                      | 涉及文件                                          | 怎么回滚                     |
| --- | ----------------------------------------- | ------------------------------------------------- | ---------------------------- |
| 1   | npm 锁文件挪成备份，**没有删除**          | `package-lock.json` → `package-lock.json.npm-bak` | `mv` 回来即可                |
| 2   | 新建 pnpm 配置，明确拒绝 `msw` 的构建脚本 | `pnpm-workspace.yaml`（新建）                     | 删掉该文件即可               |
| 3   | 用 pnpm 重装依赖                          | `node_modules/`（新增 `.pnpm/`，已由 pnpm 接管）  | 用备份锁文件跑 `npm install` |

### 为什么要写那条 `msw: false`

pnpm 12 把"有构建脚本但未表态"的包当成错误（`ERR_PNPM_IGNORED_BUILDS`），安装会以非 0 退出。查过 `msw` 的 `postinstall` 后确认：

- 它开头就有一个提前返回 —— **只有 `package.json` 里存在 `msw.workerDirectory` 字段才会执行复制**，本项目没有该字段；
- 项目里 `msw` 只被 `src/services/leaderboard/__tests__/TRPCProvider.test.ts` 以 `msw/node` 方式使用，**不需要** `mockServiceWorker.js`。

所以它是空操作，明确拒绝比放行更干净（放行反而会往 `public/` 里塞一个用不上的文件）。

---

## 三、剩余 26 个类型错误（按文件）

| 文件                                        | 数量 | 性质                         |
| ------------------------------------------- | ---- | ---------------------------- |
| `src/engine/VisualEffectSystem.ts`          | 12   | 后处理特效注册的类型冲突     |
| `src/engine/ProceduralTextureGenerator.ts`  | 8    | **API 版本错配**（见下）     |
| `src/engine/EnhancedPlayCanvasEngine.ts`    | 3    | 同 VisualEffectSystem        |
| `src/engine/LevelEditor.ts`                 | 1    | `GraphNode` 上没有 `destroy` |
| `src/engine/InstancedRenderer.ts`           | 1    | 参数类型不匹配               |
| `poc/trpc-leaderboard/src/prisma/client.ts` | 1    | 不该被本仓库 tsconfig 纳入   |

### 最该先看的一条：playcanvas 版本错配（路线问题，不是笔误）

`src/engine/ProceduralTextureGenerator.ts` 用了这些 API：

`pc.Compute` · `StorageBuffer` · `computeDispatch` · `supportsCompute` · `BUFFERUSAGE_COPY_SRC` · `BUFFERUSAGE_COPY_DST`

它们属于 **PlayCanvas 2.x** 的 GPU 计算着色器能力。而 `package.json` 锁的是 `"playcanvas": "^1.62.0"` —— caret 只在 1.x 内取最新，实际装的就是 **1.62.0**。也就是说，这些 API 在当前依赖版本里**根本不存在**。

两条路：

| 选  | 做法                                                | 代价                                             |
| --- | --------------------------------------------------- | ------------------------------------------------ |
| A   | 升级到 PlayCanvas 2.x                               | 大版本升级，破坏性变更未知，整个渲染层要重新验证 |
| B   | 把这段 GPU 计算路径降级 / 移除，退回 CPU 或普通贴图 | 少一个"程序化纹理"卖点，但**不影响能不能玩**     |

**倾向 B**：第一版的目标是能玩起来，不是画质。等游戏真的立住了再谈升级引擎。

### 另一大块：15 个 `PostEffect` 冲突

`VisualEffectSystem.ts` 与 `EnhancedPlayCanvasEngine.ts` 里的后处理特效注册调用报 `PostEffectWithUniforms` 不能赋给 `PostEffect`。根因在**类型声明层**：`src/types/playcanvas.d.ts` 是这个项目自己的类型补丁，它在第 60–62 行把 `BloomEffect / FxaaEffect / VignetteEffect` 重新声明成了 `typeof pc.PostEffect`，与 playcanvas 的真实声明冲突。

**关键判断：生产构建能过，说明运行时行为没问题。** 这是纯类型层的债，集中在 1–2 个文件就能收掉。

---

## 四、两个附带发现

1. **husky 钩子没装上**：`pnpm install` 的 prepare 阶段报了 `git command not found`，所以 `lint-staged` 目前不生效（`lint-staged` 配了 oxlint + prettier）。
2. **`poc/` 被主仓库的 tsconfig 纳入了类型检查** —— 上面那 1 个 `poc/` 错误就是这么来的。它是个独立子工程，有 24,668 个文件。

---

## 五、下一步清单（每条带主语）

| #   | 谁做   | 做什么                                               | 做完是什么样                     |
| --- | ------ | ---------------------------------------------------- | -------------------------------- |
| 1   | **你** | 在自己的终端跑一次 `pnpm prepare`                    | git 钩子装回，lint-staged 生效   |
| 2   | **你** | 定 playcanvas 走 A 还是 B（我倾向 B）                | 那条路线被钉死，8 个错误有归属   |
| 3   | **你** | 决定 `poc/` 是否从 tsconfig 排除                     | 类型错误降到 25 个               |
| 4   | **你** | 拿 `pnpm dev` 实际玩一局，看有没有黑屏/卡死          | 你对"它现在长什么样"有第一手判断 |
| 5   | **你** | 处理那 29 个未提交改动：编得过就提交，编不过先 stash | `git status` 干净                |

> 顺序有讲究：**先让基线绿了再动那 29 个文件**。现在动，你分不清是旧债还是新错。

---

## 六、战略判定：仍然冻结的

| ❌ 继续冻结        | 为什么                                 |
| ------------------ | -------------------------------------- |
| tRPC + Prisma 后端 | 前端有 mock provider，不装数据库也能玩 |
| 多人游戏           | 不影响单机能不能玩                     |
| `edge/` 边缘计算   | 同上                                   |
| `ai-training/`     | 同上                                   |
| 1500MB 资源目标    | 实际约 2MB（0.13%），是上线前的事      |

**体量提醒**：游戏本体 `src` 233 个文件，只占全仓约 **1%**；`poc` 24,668、`server` 14,018、`edge` 3,141、`dist` 1,808。真因不是「方法不对」（PlayCanvas + React + Zustand 选型合理），是**范围太大 + 工程欠账**。

---

_本文档只做记录。修复动作仅涉及锁文件、pnpm 配置与 node_modules，未改动任何一行源码。_


---

## 2026-10-04-下一步开发方向.md

# 下一步开发方向 — Fighter Game

> 定稿：2026-10-04 ｜ 依据：对仓库资产层、渲染层、资源管线做的一次实测扫描
> 你选的：「美术与音频质量升级」＋「接 GLB，改走真模型」
> 实测结论：**方向对，但"接现有那 45 个 GLB"这一步走不通。** 真正的原因是资产层从头到尾没有一个真素材。

---

## 一、位置

这是第 5 步，共 5 步（陪跑）。这一步只做一件事：按你现在的位置归因，给下一步。

> ✓ 想法 ／ ✓ 玩法 ／ ✓ 体量路线 ／ ✓ 清单 ／ ▶ 开工

---

## 二、你选的路线，和实测结果的冲突

你说的是「把那 45 个 `.glb` 接进渲染」。实测下来这件事有两个**互相独立**的拦路问题，任意一个都足以否掉它：

### 问题一：45 个文件全部不是合法的 GLB（45/45）

以 `ship-fighter.glb` 为例，文件头逐字节是这样的：

| 偏移  | 实际字节                | 应该是什么                     | 实际含义                         |
| ----- | ----------------------- | ------------------------------ | -------------------------------- |
| 0–3   | `67 6c 54 46`           | magic `glTF`                   | ✅ 对                            |
| 4–7   | `ff 03 00 00`           | `02 00 00 00`（version = 2）   | ❌ 写成了 **JSON 长度 1023**     |
| 8–11  | `e8 02 00 00`           | `f3 06 00 00`（文件总长 1779） | ❌ 写成了 **二进制缓冲长度 744** |
| 12–19 | 直接就是 `{"asset":...` | chunk 长度 + `JSON`            | ❌ **JSON chunk 头整个没写**     |
| 尾部  | 二进制缓冲直接跟上      | chunk 长度 + `BIN\0`           | ❌ **BIN chunk 头整个没写**      |

加起来：12 + 1023 + 744 = 1779 = 文件实际大小。**两个 chunk 头都被漏掉了。**

glTF 规范要求加载器先读 offset 12 的 chunk 长度；这里读到的是 `{` 的光栅字节，解析必然失败。**PlayCanvas、three.js、Babylon、Blender 都会拒收这批文件。**

**Bug 出处**：`scripts/generate-models.js` 第 236–239 行

```js
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // ✅ magic
header.writeUInt32LE(jsonBuffer.length, 4); // ❌ 这里该写 version = 2
header.writeUInt32LE(combinedBuffer.length, 8); // ❌ 这里该写文件总长度
// 并且完全没有写 chunk 头
```

### 问题二：就算把格式修好，这批模型也只有 12–32 个三角面

| 三角面数                       | 文件数 | 相当于         |
| ------------------------------ | ------ | -------------- |
| 12                             | 13 个  | **一个立方体** |
| 24                             | 3 个   | 两个立方体     |
| 28 / 32                        | 7 个   | 一个多面体     |
| 无法解析（内嵌贴图破坏了结构） | 22 个  | —              |

作为参照，一个立方体就是 12 个三角面。**这批"模型"比你现在运行时用代码生成的还要简陋。**

### 所以真实原因不是"没接线"

它们是 `scripts/generate-models.js` 的产物 —— 用脚本把图元烘成文件，不是美术素材。修 bug 能得到 45 个合法但空空如也的文件，**没有收益**。

---

## 三、资产层体检：三族资产，零个真素材

| 资产族  | 数量         | 来源                          | 实测情况                                                                      |
| ------- | ------------ | ----------------------------- | ----------------------------------------------------------------------------- |
| 3D 模型 | 45 个 / 712K | `scripts/generate-models.js`  | **45/45 结构非法**，12–32 三角面                                              |
| 音频    | 36 个 / 14M  | `scripts/generate-audio.js`   | 白噪/粉噪/正弦/方波合成；BGM 45 秒单声道 44.1kHz **未压缩 WAV**（单个 3.8MB） |
| 纹理    | 88 个 / 2.3M | `scripts/generate-assets*.js` | `sin/cos` 噪声图案程序化生成                                                  |

**渲染层的现状**：玩家舰与敌人走的是 `ProceduralModelGenerator.createShipModel()` / `createEnemyModel()` —— 代码现算几何，**从未加载过任何 `.glb`**。`.glb` 路径只出现在两处：`AssetManifest.ts`（全项目零引用的死代码）与 `GameResources.ts`（只被测试和手动测试面板引用）。

**一句话**：美术这条线不是"做了一半"，是**一直用假料在跑，而且跑得还行**。所以画面上限被料卡住了，不是被代码卡住了。

---

## 四、可行性确认（这条路能走通）

| 前置条件           | 实测结果                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| 引擎能不能加载 GLB | ✅ PlayCanvas **2.23.0** 含 `ContainerHandler`、`GlbParser`、`instantiateRenderEntity`、`loadFromUrl` |
| 能不能下载外部素材 | ✅ `raw.githubusercontent.com` / `cdn.jsdelivr.net` / `registry.npmjs.org` 均返回 200                 |
| 基线干不干净       | ✅ tsc 0 错误、单元测试 344/345、构建通过、画面验证通过                                               |

结论：**换料这件事技术上没有障碍，缺的只是料。**

---

## 五、归因表

| 症状                           | 真实原因                                                       | 处置                                       |
| ------------------------------ | -------------------------------------------------------------- | ------------------------------------------ |
| 「画面太丑」                   | 资产层全是脚本合成的占位物，且模型文件还是坏的                 | 换料，不是修代码                           |
| 「接 GLB 就能变好」            | 现有 `.glb` 既非法又低模                                       | 放弃"接线现有文件"，改为引入外部素材       |
| 「做完这个方向是不是就能上线」 | 环路（一局完整流程）尚未实测走通                               | 美术升级的同时，顺手把闭环跑一遍并记录断点 |
| 仓库体积问题                   | `poc` 24,668 / `server` 14,018 / `edge` 3,141 文件仍在冻结状态 | 维持冻结，不在这轮处理                     |

---

## 六、结论（条件式）

- 若你要的是**画面上限真的抬起来** → 走「换料」：引入外部真模型，先接 1 个验证管线，再批量。
- 若你要的是**马上能感觉到的变化** → 先做音频那条：14MB 未压缩 WAV 转 OGG，首包体积能降一个数量级。
- 若你要的是**先让别人玩到** → 那要先把闭环跑通再发，顺序在换料之后。

**建议：先换料，且只接一个模型。**

---

## 七、第一版清单

> 现在只做 **第 1 条**。做完再来找我接第 2 条。

| #   | 谁做 | 做什么                                                                                       | 做完是什么样                                                       | 依赖 |
| --- | ---- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---- |
| 1   | 你   | 下 1 个真实飞船模型（免费太空素材包 / glTF 官方样例），放进 `public/assets/models/external/` | 该目录里有一个来自外部、不是本项目脚本生成的 `.glb`                | —    |
| 2   | 你   | 跑一次离线校验：打印 magic / version / 总长 / chunk 头 / 三角面数                            | 输出显示 version=2、长度与文件相符、两个 chunk 头齐全、面数 > 1000 | 1    |
| 3   | 我   | 加一条 GLB 加载通道：`assets.loadFromUrl(url,'container')` → `instantiateRenderEntity()`     | 控制台打印出实例化出的 mesh 数量                                   | 2    |
| 4   | 我   | 玩家舰模型来源切到 GLB，程序化生成保留为回落                                                 | 玩家舰变成外部模型的形状；删掉外部文件后自动回落、不崩             | 3    |
| 5   | 你   | 完整跑一局，看画面并截图                                                                     | 你能明确说出"比之前好看还是难看"                                   | 4    |
| 6   | 我   | 批量替换：6 个舰 + 8 个敌人                                                                  | 战斗场景里所有实体都来自外部模型                                   | 5    |
| 7   | 我   | 修 `generate-models.js` 的 GLB 头写入 bug                                                    | 该脚本以后再产出的 `.glb` 能通过校验                               | —    |
| 8   | 你   | 音频：换真 BGM，或先把 WAV 转 OGG                                                            | 首包音频从 14MB 降到 2MB 以内                                      | —    |

**完成判据**：第 5 条是这轮的关键门 —— 只有你亲眼看过一局，才知道换料值不值。

---

## 八、这回不做的

| 不做                                           | 为什么                      |
| ---------------------------------------------- | --------------------------- |
| 修好那 45 个坏模型                             | 修完只有 12–32 面，等于没修 |
| 全部 45 个模型一次性替换                       | 一个验证不通，45 个都是白做 |
| 多人 / 好友 / 排行榜面板接线                   | 后端仍在冻结状态            |
| `poc` / `server` / `edge` / `ai-training` 开工 | 与"能不能玩、好不好看"无关  |
| 1500MB 资源目标                                | 与首包体积目标冲突，已作废  |
| 技能树 / 装备系统                              | 属于第二版                  |

---

## 九、我替你定的三项（可改）

1. **换料范围**：先只做玩家舰 1 个，不做全 45 个。—— 改法：你也可以选"先把舰和敌人一起换"。
2. **程序化生成保留为回落**：不删代码，GLB 加载失败就退回现在这套。—— 改法：也可以选"直接删掉程序化这条路"。
3. **音频排在模型之后**：第 8 条放在最后。—— 改法：也可以把音频提前到第 1 条之后，它见效最快。

---

## 十、还差你拍板的

- 模型来源：用免费素材包（Kenney / Quaternius 一类），还是你手上有现成的？
- 首发范围：只换玩家舰，还是舰 + 敌人一起？
- 音频：这轮换真素材，还是先只做格式压缩？

---

## 附：本次扫描用到的判据（下次可复用）

```
1. GLB 合法性：offset 4 必须是 0x00000002；offset 8 必须等于文件字节数；
   offset 12 处必须是 chunk 长度、offset 16 处必须是 'JSON'
2. 模型复杂度：累加 meshes[].primitives[].indices 的 accessor.count / 3
3. "是否真的被渲染引用"：全 src 搜 .glb 字符串，再逐个确认消费方是不是死代码
4. 反证法：如果渲染路径里出现 Procedural*Generator，说明资产生成在代码里，不在文件里
```

---

## 执行结果（2026-10-04 当晚）

方向确认后，同日完成了清单第 1–4 条（素材到位 + 管线接通），第 5 条（人工看一局）仍待你做。

**做了什么：**

| 项         | 结果                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| 素材来源   | Kenney **Space Kit**（CC0），经 `shorepine/kenney` 镜像，钉死 commit `3694c687`       |
| 新脚本     | `scripts/fetch-kenney-models.mjs` —— 抓取 + 逐文件 GLB 结构校验，可重复执行           |
| 换掉模型   | 16 个：6 玩家舰 + 8 敌人 + 2 Boss，全部校验通过，**186–876 三角**（原 12–32）         |
| 新引擎模块 | `src/engine/ModelAssetProvider.ts` —— GLB 加载 + 先占位后替换 + 失败回落程序化        |
| 接线点     | `PlayerShip.createPlayerShip()` 与 `Enemy.createEnemy()` 各一处，程序化模型保留为回落 |
| 战斗配色   | 敌人沿用原有 primaryColor，按"最大通道归一"叠色，保留原模型材质层次                   |

**验证结论：**

- `tsc --noEmit`：0 错误
- 单元测试：344/345（唯一失败是迁移前就存在的慢下载时序用例，与本次无关）
- 生产构建：通过，`dist/assets/models` 45 个模型全部就位
- 画面验证（Playwright）：`ships/ship-fighter.glb` 与 6 个 `enemy-fighter.glb` 均打印
  「已替换程序化模型」，**运行时错误 0 条**；截图 `docs/verify/glb-01-battle.png`
  可见带机翼/座舱/引擎块的完整低模飞船
- 许可与来源记录在 `public/assets/models/CREDITS.md`

**留给下一轮的：**

1. 你亲眼看一局（清单第 5 条）—— 判断观感与手感
2. 音频换真素材（清单第 8 条，14MB WAV 待处理）
3. 缩放/朝向若不顺眼，调 `ModelAssetProvider.ts` 顶部的 `SHIP_SCALE / ENEMY_YAW` 等常量
4. `projectiles/`（9 个）与 `effects/`（8 个）的坏 `.glb` 仍在仓库里，运行时未使用，
   建议下轮一并清掉或替换

---

## 执行结果（2026-10-04 续）—— 音频换真素材

清单第 8 条（音频换真素材）已完成。**同一条"假素材"的病根，这次出现在音频上。**

**体检结论（改动前）：**

| 项       | 数量 | 实际来源                                                                        |
| -------- | ---- | ------------------------------------------------------------------------------- |
| 音频文件 | 35   | 全部由 `generate-audio.js` 用正弦/白噪合成                                      |
| BGM 体积 | 13MB | 5 个 **未压缩 WAV**（44100Hz/16bit/单声道），`bgm-gameplay` 单个 3.8MB          |
| 孤儿槽位 | 10   | `sfx-death`/`sfx-shotgun`/`ui-hover` 等**只被生成脚本自己引用**，运行时无人使用 |
| 清单     | 1    | `audio-manifest.json` 是准确索引，但索引的是一批假素材                          |

**替换结果：**

| 指标       | 改动前           | 改动后                  | 变化      |
| ---------- | ---------------- | ----------------------- | --------- |
| 总体积     | 14 MB            | **6.58 MB**             | **−53%**  |
| 总时长     | 145 秒           | **≈432 秒（7.2 分钟）** | **+198%** |
| 每秒钟体积 | 约 97 KB/s       | 约 15 KB/s              | **−84%**  |
| 文件数     | 35（含 10 孤儿） | 25（全部在用）          | 去孤      |

**素材来源（全部 CC0，可商用免署名，逐条核对许可证）：**

- 音效 20 个 ← **Kenney**（Sci-Fi Sounds / Interface Sounds / Digital Audio），
  官网直链抓取；严格按**实测时长**择曲：`select_001` 仅 43ms、`bong_001` 仅 0.12s，
  都被判为"不成音"而弃用
- BGM 5 个 ← **OpenGameArt**，抓取时逐页读取内容页 `License(s)` 字段并断言为 CC0
  （过滤掉混在结果里的 CC-BY / CC-BY-SA / GPL 曲目）

**新增/改动：**

| 文件                                       | 作用                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `scripts/fetch-real-audio.mjs`             | 抓取 + 校验；所有远程产物按 sha256 钉死，上游变动即报错退出；附 `--check` 离线校验 |
| `scripts/verify-audio.mjs`                 | 真浏览器里逐文件 `AudioContext.decodeAudioData`，不是只看文件头                    |
| `src/engine/AudioSystem.ts`                | 25 处 URL 由 `.wav` 改为 `.ogg`/`.mp3`                                             |
| `audio-manifest.json`                      | 由"过期假数据"（URL 写 mp3、size 全 0、时长编造）重建为**真实索引**                |
| `public/assets/audio/CREDITS.md`           | 来源声明，同样由抓取脚本生成，避免手工抄错 25 行映射                               |
| `generate-audio.js` / `generate-models.js` | 加停用守卫：二者会覆盖真素材                                                       |

> **踩到一个隐蔽陷阱**：守卫最初写在 `require` 之后，等于**不可达**——因为
> `package.json` 是 `"type": "module"`，而这两个脚本是 CommonJS 写法，
> 模块求值阶段就会先因 `require is not defined` 崩溃。顺带查明：
> `scripts/` 下 **8 个 CommonJS 脚本在当前配置下都跑不起来**，
> 包括 `npm run generate:models` 与 `npm run download:models` 两条失效命令。

**验证结论：**

- 25/25 文件在真实浏览器里 **HTTP 200 且解码成功**，时长/采样率/声道均正确
- 游戏运行期对 `/assets/audio/` 的请求全部 200，**运行时错误 0 条**
- `tsc --noEmit`：0 错误
- 单元测试：344/345（唯一失败是既有慢下载时序用例，失败原因为
  `DownloadManager` 报 "No response body"，与音频无关）
- 生产构建：通过，`dist/assets/audio` 25 个音频、**0 个 WAV 残留**
- 提交 `eeb5cdf` 已推送

**本轮新查出的缺口（未擅自改）：**

1. **`menuMusic` 与 `bossMusic` 从不播放**。两条定义在 `AudioSystem.ts` 里，
   但全项目 grep 不到任何调用点。主菜单静音**原因不在素材**：
   `AudioManager.initialize()` 只在进入 3D 场景时用 `engine.getApp()` 调用，
   菜单阶段没有音频系统实例（PlayCanvas 的 `Sound` 依赖 `Application`）。
   要让它响需要给菜单单独做一条音频通路，属架构改动。
2. **模型侧还有 29 个坏 `.glb`（487 KB）**：`projectiles/` 9 + `effects/` 8 +
   `structures/` 10 + `bosses/` 2（`boss-collector` / `boss-tyrant` 上轮漏网）。
   引用链只到未接线的 `GameResources → GameResourceManager → ResourceDownloadTester`，
   删掉不影响运行，但属独立清理动作，已更新 `models/CREDITS.md` 记录准确数字。
3. **循环点与响度未处理**：`loop: true` 的曲目是整曲循环，未做无缝裁剪；
   多来源素材未统一 LUFS 响度（环境内无音频转码工具，需要 ffmpeg）。

---

## 执行结果（2026-10-04 续 2）—— 波次闭环打通：游戏现在可以真的通关了

归因表里那条「环路（一局完整流程）尚未实测走通」，这轮把它走通了 —— 而且一走就发现
**环路根本是断的**。修完 4 个缺陷后，波次 1→10 全通，末波 Boss 波真打完，结算界面正常弹出。

### 一、这轮修掉的 4 个缺陷

| #   | 症状                                                                                   | 真实原因                                                                                                                                 | 处置                                                                                  |
| --- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | 打完一波，游戏**永久静止**                                                             | `GameScene` 里**没有任何代码**在波次清空后启动下一波；`onWaveComplete` 只弹强化选择                                                      | 新增 `waveTransitionRef {nextWave,timer}` + 2.2s 波间延迟，在 update 循环里启动下一波 |
| 2   | 一次击杀**扣两次**波次计数                                                             | `EnemySystem.onEnemyKilled` 与 `GameplayManager.onEnemyKilled` 双方都调 `waveManager.onEnemyDefeated()`                                  | 收敛为**唯一权威点**（`GameplayManager`，它持有 `WaveManager`）                       |
| 3   | 非武器击杀**分数/统计/波次全丢**（`enemiesDefeated` 恒为 0）                           | `EnemySystem.update()` 把 `filter(isAlive)` 写在结算之前，上层遍历到的是**已剔空**的数组                                                 | 改序为**先整体回调结算、再 filter**（新增 `EnemiesDefeatedCallback`）                 |
| 4   | **末波（第 10 波 / Boss 波）被整个跳过**，游戏在它刚开始时就直接「通关」，随后整局冻结 | 关卡完成条件 `currentWave >= totalWaves && enemies.length === 0 && nextWave === null` 在末波**启动的同一帧**即成立（敌人要下一帧才生成） | 改用权威信号 `finalWaveClearedRef`（由 `onWaveComplete(末波)` 置位）                  |

### 二、第 4 条的定位过程（本轮最值得留存的一段）

现象是「第 10 波 `spawned=0` / `elapsed=0` / `alive=0`，永远不动」。**第一反应是波次生成逻辑坏了 —— 错了。**

| 步骤 | 动作                                                    | 得到的信息                                                                                             |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1    | 开局直接 `startWave(10)` 隔离测试                       | 生成**完全正常**（spawned 逐秒 +1、elapsed 递增）⇒ 排除 Boss 波生成逻辑                                |
| 2    | 改用 `startWave(9)`→清空→自然过渡到 10 复现             | 稳定复现；复现时间从 9 分钟压到 **1 分钟**                                                             |
| 3    | DEV 钩子里加计数器 `ticks / logicTicks / enemyUpdates`  | 冻结时三者**相等且不再增长**（278/274/274）⇒ 不是逻辑卡死，是**更新回调不再被调用**                    |
| 4    | 在页面里手动跑一次自己的 rAF 计数                       | **24 帧/400ms（活着）** ⇒ 浏览器正常，**是 PlayCanvas 自己的 tick 链断了**                             |
| 5    | 读 `playcanvas.dbg.mjs` 的 `tick()`                     | 只有 `if (!this.graphicsDevice) return;` 会**不重排下一帧就静默返回** ⇒ 停止原因只能是 `app.destroy()` |
| 6    | cleanup + `app.on('destroy')` + `webglcontextlost` 埋点 | 铁证：`Wave 10 started` → 0.1s 后 → `[GameScene] Cleanup: React 卸载` → `Application destroy`          |

**教训**：PlayCanvas 的 tick 链停止是**静默的** —— 不抛异常、`pageerror` 为空、`console.error` 为空。
**「没有任何报错」不能当作「没有出错」**。凡是「一切都停了但零报错」，优先怀疑渲染循环被销毁，
而不是业务逻辑。

### 三、验证

| 项             | 结果                                                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 波次闭环实测   | 波次 **1→2→…→10 全部推进**；第 10 波 `spawned=20 / defeated=20 / state=completed / progress=1`；`levelCompleteFired=true`；结算界面**「胜利！」**出现；**运行时错误 0** |
| 验证脚本       | `scripts/verify-wave-progression.mjs`（全 10 波，约 10 分钟）＋ `scripts/verify-final-wave.mjs`（快速回归版，约 1 分钟）                                                |
| `tsc --noEmit` | 0 错误                                                                                                                                                                  |
| `vitest run`   | **344 / 345**（唯一失败为 `GameResourceManager.test.ts` 慢速下载用例，会真实发起网络下载，环境相关的既有不稳定项）                                                      |
| `vite build`   | 通过（本地需用 `--outDir dist-verify` 绕开沙箱批量删除闸门）                                                                                                            |

**通关截图顺带抓出两个小 bug（已修）：**

1. 结算/暂停界面**「消灭敌人」恒为 0** —— store 的 `addKill()` 只累加 `killCount`，
   而界面读的是从未被写入的 `enemiesDefeated` 字段。已让二者同步累加（实测 0 → 38）。
2. 结算界面按钮显示**未翻译的原始键名** `gameOver.leaderboard` —— `zh/en` 语言包缺
   `gameOver.leaderboard` 键。已补「排行榜」/ `Leaderboard`。

> 经验：**自动化验证的截图要真的看一眼**。这两个 bug 任何断言都没覆盖，但截图里一眼可见。

见 `docs/verify/wave-victory.png`。

### 四、给下一轮

1. **你亲自跑一局**（清单第 5 条仍未做）—— 现在终于能打到通关了，观感/手感/难度曲线都值得你判断
2. 仍待决：`menuMusic` / `bossMusic` 的菜单音频通路（架构改动）、29 个坏 `.glb` 的清理
3. 新增的 DEV 调试钩子 `window.__waveDebug` 可直接用于后续任何战斗逻辑的自动化验证
   （`startWave` / `killAll` / `godMode` / `inspectEnemies` / `getState`），生产构建不含

---

## 执行结果（2026-10-04 续 3）—— 场景结构物换真模型：假料残余里最大的一块

「开始扩展资源吧」的落点选择：扫描后发现**渲染路径上还跑着的程序化假料**里，
最大的一块是**场景结构物** —— 小行星带 40 个（`createAsteroidField` 用球体+方盒拼）、
空间站 1 个（12 段环+对接口拼装）、卫星 1 个。它们从头到尾都在画面里，却全是代码现算的图元。
而 Kenney Space Kit 恰好有 9 种岩石/陨石外壳可用，视觉提升最直接。

**注意**：Kenney space 套件**没有**激光/导弹弹体模型，`projectiles/` 换真素材需要别的源；
子弹目前的程序化发光球体视觉上并不违和，优先级低。

### 做了什么

| 项       | 结果                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新增素材 | 11 个 CC0 模型：9 种小行星外壳 + 空间站（`hangar_largeB`）+ 卫星（`satelliteDish_detailed`），全部通过 GLB 结构校验（44–390 三角面）                |
| 抓取脚本 | `fetch-kenney-models.mjs` MAP 扩至 27 项；新增**按类别覆盖三角面阈值**（`structures/` → 40，背景低模不应按主角标准拒收，但仍高于假素材的 12–32 面） |
| 引擎扩展 | `ModelAssetProvider.upgradeStructure()` —— 结构物是「一个类型 → 多个候选外壳」，运行时随机选取，40 个小行星不同款；复用既有「占位+替换+回落」机制   |
| 接线点   | `PlayCanvasEngine.createAsteroidField`（40 个，包 holder 承载位置与自转）+ `GameScene` 的空间站/卫星（同样包 holder）                               |
| 清理     | 10 个被取代的坏 `structure-*.glb` 已 `git rm`（可 revert）；剩 19 个坏文件（projectiles 9 / effects 8 / bosses 2），更新 CREDITS.md 说明            |

### 验证（`scripts/verify-glb-models.mjs`，本轮升级了断言）

- **42 个结构物实体替换成功**（9 种变体全用上，分布 1–8 次不等）；舰 1 + 敌 6 同样在列
- 13 个模型文件全部 HTTP 200，共 199.3 KB；**加载失败警告 0、运行时错误 0**
- 截图 `docs/verify/glb-01-battle.png` / `glb-structures-wide.png`：玩家舰真模型清晰可见，
  陨石散布画面
- 基线：`tsc --noEmit` 0 错误；`vitest` 344/345（唯一失败仍是既有慢下载用例）；`vite build` 通过
  （产物在 `.workbuddy/tmp/dist-build/`，沙箱删除闸门仍在，`dist-verify/` 遗留问题同前）

### 本轮踩的坑（值得留存）

1. **验证脚本 `godMode?.()` 漏传 `true`** —— 钩子实现是 `if (p && on)`，`on` 为 `undefined`
   时整个调用静默空转，玩家照常被击毁，截图全是「游戏结束」界面。上一轮的波次脚本写的
   是 `godMode(true)` 所以没事；写新脚本时凭记忆漏了参数。**可选参数的调试钩子宁可设计成
   `godMode()` 默认 true，也不该让「忘传参」静默无效。**（本轮未改钩子签名，只修了脚本。）
2. **截图时序**：玩家在剧情对话期间就会被击毁，godMode 必须在 `waitForFunction(__waveDebug)`
   一就绪就开，不能等对话跳完。
3. **Read 工具的图片缓存**：同名文件重写后直接 Read 会命中缓存报「unchanged」，
   复制成新文件名再读即可（但哈希缓存跨路径也会命中，最可靠的还是文件 mtime + 尺寸）。

### 给下一轮（2026-10-05 更新）

1. ~~19 个坏 `.glb` 仍是死重量~~ → **已全部删除**（见下方「执行结果（2026-10-05）」）
2. ~~`menuMusic` / `bossMusic` 音频通路仍是架构欠账~~ → **已接线并实测通过**（同上）
3. 小行星带的观感（大小/密度/旋转速度）值得你亲眼看一局后反馈，调
   `ModelAssetProvider.structureScale()` 与 `createAsteroidField` 的半径参数即可
4. **死代码清理**（约 1800 行、零消费方）：`GameResources.ts` → `GameResourceManager` →
   `ResourceDownloadTester` 整条链，以及 `engine/AssetManifest.ts`（还引用着不存在的
   boss-devourer / phantom）、`engine/Game.ts`（未被任何地方 import）

## 执行结果（2026-10-05）—— 素材清空 + 音频接线

### 一、19 个坏占位模型全部删除（上午）

「换素材源」经查证**不成立**，改为只清不换，理由有三：

| 判据                       | 结果                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 有没有渲染消费方           | **没有**。仅被死代码链 `GameResources.ts → GameResourceManager → ResourceDownloadTester` 的清单提及（Tester 全项目零 import），删除无 404 风险 |
| Kenney 有无可用弹体素材    | **没有**。查证 `shorepine/kenney` 镜像 `3d/` 下全部 45 个包；`blaster` 包是 FPS 枪械（枪身/弹匣/瞄准镜）                                       |
| 该不该用 GLB 渲染子弹/特效 | **不该**。子弹=程序化发光球体、特效=粒子系统，这本来就是正确技术                                                                               |

动作：删除 `projectiles/`（9）、`effects/`（8）、`bosses/boss-collector|tyrant`（2）；
`GameResources.ts` 剪除 **29 条死条目**（19 个本轮 + 10 个此前已删的 structure 旧名）；
`scripts/download-models.js` 加停用守卫（它会把 Khronos 示例模型「鸭子/火柴人/立方体」
冒充成飞船/敌人/弹体下载进来）；`public/assets/models/` 现为 **27 个真模型、636 KB**。

### 二、音频接线：25 个音频文件此前只有 1 个真的会响

全仓 grep 的结论很刺眼：`gameMusic` 是唯一活着的音乐，4 首 BGM
（`bgm-mainmenu` / `bgm-boss` / `bgm-victory` / `bgm-story`）与**全部 7 个 UI 音效**
都是「定义了但没人播」的死定义——换素材时等于换了个没人听得见的。

**根因是架构性的，不是漏写调用**：音乐若挂在 GameScene 上
（`AudioManager.playMusic`），结算/返回菜单时 GameScene 被 React 卸载 →
`PlayCanvasEngine` 销毁 → `pc.Application.destroy()` → `soundManager` 随之销毁 →
**正在播的声音当场被掐断**。所以「胜利音乐」「主菜单音乐」放在 GameScene 里必然没声。

解法（新增 `src/engine/GlobalAudio.ts`）：

| 类别                                          | 通路                                | 理由                         |
| --------------------------------------------- | ----------------------------------- | ---------------------------- |
| 音乐（menu / game / boss / victory / defeat） | **GlobalAudio**（HTMLAudioElement） | 必须活过界面切换             |
| UI 音效（7 个）+ 结算音刺 + 阵亡爆炸          | **GlobalAudio**                     | 前者跨界面；后者会被卸载掐断 |
| 战斗内空间音效（开火/命中/爆炸/道具/护盾…）   | `AudioSystem`（`SoundInstance3d`）  | 需要 3D 定位                 |

顺带修掉两个**真 bug**：

1. **结算界面「重新开始」点了没反应** —— `handleRestart` 没把 `gameState` 切回 `PLAYING`，
   在 `GAME_OVER` 界面点它界面毫无变化（从暂停菜单进则正常）。
2. **重开一局后战斗音效全部静默失效** —— `AudioManager.initialize()` 原先只在「首次」
   初始化，而 GameScene 每次挂载都新建 `pc.Application`（旧的已 destroy），第二局起
   `soundManager` 已失效、音效静默死掉。现改为换 app 时销毁重建。

还移除了 `AudioSystem` 里那 5 条音乐定义（所有权归 GlobalAudio），避免同一批 BGM
被 PlayCanvas 预载解码一遍却没人播放 —— 实测 `bgm-story.ogg` 现在只在真的阵亡时才被请求。

### 验证（`scripts/verify-audio-wiring.mjs`，9/9 全绿）

真实浏览器跑完整链路，逐界面断言当前曲目：

```
菜单 → 战斗 → 末波 → 通关 → 重新开始 → 返回菜单
menu → game → boss → victory → game → menu
```

- 关键断言：**通关音乐在 GameScene 已卸载（canvas 消失、`Application destroy` 已触发）
  之后仍在播放** —— 这是本轮架构改动的直接证据
- 24 个音频请求全部 2xx（HTMLAudio 走 Range，返回 206 属正常，判据已按 2xx 放宽）
- 运行时错误 0；首次手势前 `current=null` 属浏览器自动播放策略下的正确行为
- 回归：`scripts/verify-final-wave.mjs` 仍全绿（末波 20/20 生成并清空 → 胜利界面）
- 基线：`tsc --noEmit` 0 错误；`vitest` 344/345（唯一失败仍是既有慢下载用例）；
  `vite build` 通过

### 本轮踩的坑（值得留存）

1. **「文件在」不等于「有人听见」**：素材替换完成后必须再查一遍**消费方**
   （`grep` 播放调用点），否则会把「换了素材但没人播放」当成已完成。
   本次 25 个音频里 18 个属于这种状态。
2. **验证断言别把成功状态判成失败**：HTMLAudio 走 Range 请求，dev server 返回
   `206 Partial Content` 是完全成功的下载，按「非 200 即失败」会把 4 首 BGM 全判红。
3. **断言时机要匹配浏览器策略**：首次用户手势前音频必然不出声，把「菜单音乐为空」
   判成失败是**脚本错**而非产品错 —— 正确的断言是「首次手势后 = menu」。

---

## 2026-10-05 执行：备用素材库 + 太空天幕

### 一、备用素材库（520 MB，多源 CC0）

`node scripts/fetch-asset-reserve.mjs` → `.workbuddy/asset-cache/`（gitignore，不进构建）：

| 源                     | 体量                | 内容                                                                                          |
| ---------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| Kenney（钉 `3694c68`） | 252 MB / 53098 文件 | 2d / 3d / ui / icons 全库快照（镜像不含音频）                                                 |
| Poly Haven             | 152 MB / 73 张      | `pure skies` 全量 1k、`moon_lab` 4k（唯一太空站环境）、暗夜净空 2k、摄影棚 1k                 |
| ambientCG              | 116 MB / 18 套      | 太阳能板 ×4、科幻装甲板 ×6、岩石 ×4、地表 ×2、通用金属 ×2（1K，含 Color/Normal/Roughness/AO） |

复用方式：从库里挑 → 复制进 `public/assets/` → 在对应 `CREDITS.md` 登记。
索引见 `asset-cache/INDEX.md`（按套件，✅ 标注本游戏高相关）；
校验：`node scripts/verify-asset-reserve.mjs`（10/10 通过）。

### 二、开发项：太空天幕（场景背景升级）

此前背景是「纯黑 + 300 颗程序化球体星星」，实测截图里真模型的小行星/舰船全浮在死黑中——
是画面上最弱的一环。本次：

- `PlayCanvasEngine.createSkyDome()`：天幕球**挂在相机下**（跟随相机 = 无限远背景，无视差穿帮）、
  `emissiveMap` 不受光照、`CULLFACE_FRONT` 只渲染内壁、异步加载失败回落深色；
- 贴图取自备用库：Kenney `2d/Skyboxes/skybox-space.png`（4096×2048 星云全景，仅 272 KB），
  已复制到 `public/assets/textures/` 并登记 `textures/CREDITS.md`；
- 近景星星 300 → 120（保留运动视差）。

实测：背景从死黑变为星云渐变（见 `docs/verify/glb-01-battle.png`）、0 加载失败、0 运行时错误；
`verify-glb-models.mjs` 42 个结构物替换仍全绿。

### 三、本轮踩的坑（值得留存）

1. **「500 MB 备用」的前提要先量**：Kenney 镜像全库只有 252 MB 且不含音频——
   单源根本凑不满，需先探测各源体量再定组成（本次 Kenney + Poly Haven + ambientCG 三源合成）。
2. **Windows 下喂 MSYS tar/unzip 必须用 POSIX 路径**（`/f/…`）：`F:/…` 先被当「主机:路径」，
   加 `--force-local` 后反斜杠又被转义坏，两种姿势都解不了压。
3. **本环境 `fs.rm` 走回收站且对大文件 ETIMEDOUT**：脚本里的删除必须可失败（`rmSoft`），
   且耗时段要有完成标记（`.reserve-ok`）才能幂等续跑。
4. **node 全量遍历 5 万文件会被安全层整进程杀掉（SIGTERM，零日志）**：
   已知文件数时用标记跳过遍历；确需统计时用 python `os.walk`（不被杀）。
5. **校验阈值要区分「已上线物件」与「结构库」**：模块化套件的地板平板只有 2-4 个三角形，
   属正常几何；假件判定靠 GLB 结构头（magic/version/chunk/JSON），不靠面数。

### 四、给下一轮

1. `textures/` 里还有 **88 个程序化假纹理**（effects 10 / environment 9 / pbr 29 / ui 40，
   约 1.4 MB），仅被死代码链（`AssetManifest` / `GameResources`）引用——候选清理对象；
2. 备用库里的 `3d/space-station`（97 个 GLB）与 `3d/modular-space`（40 个）尚未接入，
   可把场景从「1 站 + 1 卫星」扩成小型站群；
3. 死代码清理（`GameResources` 链 + `AssetManifest`，约 1800 行零消费方）仍待做。


---

## 2026-10-05-资源库利用率审计.md

# 资源库利用率审计报告

> 审计时间：2026-10-05
> 审计脚本：`scripts/audit-asset-usage.mjs`（可重复执行，`--json` 输出机读格式）
> 审计范围：`public/` 下全部资源文件（不含 `.md`）

---

## 一、总体结论

| 口径           | 数值                              |
| -------------- | --------------------------------- |
| 资源文件总数   | **278 个**                        |
| 资源总体积     | **10.04 MB**                      |
| 运行时真正加载 | **135 个（49%）/ 8.11 MB（81%）** |
| 运行时读不到   | **142 个（51%）/ 1.92 MB（19%）** |

**两个口径差得很大，原因只有一个：音频。**

`assets/audio` 占 6.59 MB（总体积的 66%），而它 **100% 在运行时使用**（25/26 个文件被音频系统直接引用，剩余 1 个 `audio-manifest.json` 只被验证脚本引用）。所以按体积算利用率有 81%，按文件数算只有 49%。

换句话说：**占地方的东西都在用，不值钱的东西堆了一大堆。**

---

## 二、分层明细

判定分级（从严到宽）：

| 分级         | 含义                                                          |
| ------------ | ------------------------------------------------------------- |
| **LIVE**     | 运行时源码引用（含 `fetch(\`/assets/xxx/${id}\`)` 动态拼接）  |
| **VERIFY**   | 仅被 `scripts/verify-*` / `tests/` 引用                       |
| **字段未通** | 配置 json 里以裸 id 提到，但活代码无路径拼接 → 永远加载不出来 |
| **悬空**     | 唯一引用者是没人加载的 json（实际就是 `manifest.json`）       |
| **自产**     | 只有生成脚本提到自己，无任何消费方                            |
| **孤儿**     | 全仓库无人提及                                                |

| 目录                 |    总数 |  运行时 | 仅验证 | 字段未通 |    悬空 |  自产 |  孤儿 |   有效率 |
| -------------------- | ------: | ------: | -----: | -------: | ------: | ----: | ----: | -------: |
| assets/textures      |      96 |      11 |      0 |       18 |      60 |     7 |     0 |  **11%** |
| assets/models        |      28 |      28 |      0 |        0 |       0 |     0 |     0 | **100%** |
| assets/audio         |      26 |      25 |      1 |        0 |       0 |     0 |     0 |  **96%** |
| assets/missions      |      20 |      20 |      0 |        0 |       0 |     0 |     0 |     100% |
| assets/shop          |      20 |      20 |      0 |        0 |       0 |     0 |     0 |     100% |
| assets/achievements  |      15 |      15 |      0 |        0 |       0 |     0 |     0 |     100% |
| assets/dialogues     |      10 |      10 |      0 |        0 |       0 |     0 |     0 |     100% |
| assets/enemies       |      10 |       0 |      0 |        0 |      10 |     0 |     0 |   **0%** |
| assets/levels        |      10 |       0 |      0 |        0 |      10 |     0 |     0 |   **0%** |
| assets/powerups      |      10 |       0 |      0 |        0 |      10 |     0 |     0 |   **0%** |
| assets/skills        |      10 |       0 |      0 |        0 |      10 |     0 |     0 |   **0%** |
| assets/weapons       |      10 |       0 |      0 |        0 |      10 |     0 |     0 |   **0%** |
| assets/ships         |       6 |       0 |      0 |        0 |       6 |     0 |     0 |   **0%** |
| assets/story         |       5 |       5 |      0 |        0 |       0 |     0 |     0 |     100% |
| assets/manifest.json |       1 |       0 |      0 |        0 |       0 |     0 |     1 |       0% |
| models/npc_ai.onnx   |       1 |       1 |      0 |        0 |       0 |     0 |     0 |     100% |
| **合计**             | **278** | **135** |  **1** |   **18** | **116** | **7** | **1** |  **49%** |

按体积：

| 目录                 |    体积 |  已加载 | 体积利用率 |
| -------------------- | ------: | ------: | ---------: |
| assets/audio         | 6.59 MB | 6.58 MB |   **100%** |
| assets/textures      | 2.82 MB | 0.96 MB |    **34%** |
| assets/models        | 0.53 MB | 0.53 MB |   **100%** |
| assets/manifest.json | 0.04 MB |       0 |         0% |
| 其余（json 配置类）  | 0.06 MB | 0.03 MB |        50% |

---

## 三、三类具体缺口

### 缺口 1：悬空 116 个（1.92 MB）—— 根因是 `manifest.json` 的虚假引用

`assets/textures/pbr/*.png`（29 张）、`environment/*.png`（9 张）、`effects/*.png`（10 张）、`ui/*.png`（大部分）以及全部 6 组数据 json，**唯一的"引用者"是 `public/assets/manifest.json`**。

而这个 40 KB 的 `manifest.json`：

- **零引用**——`src/` 里没有任何一行代码读它（grep `manifest.json` 在 `src/` 下无命中）
- 唯一提到它的是早已废弃的 `AssetManifest.ts`（下面第 5 节）

所以这是一条**自证的死链**：`manifest.json` 声称"我管着这些资源"，但它自己没人加载，它管的资源也就没人加载。

具体清单：

- **PBR 贴图 29 张 → 0 张在用**（`tex-concrete-01.png` 单张 947 KB，占整个 textures 目录 1/3）
- **环境贴图 9 张 → 3 张在用**（`env-nebula-01` / `env-space-01` / `env-station-01` 被天空盒用掉）
- **特效贴图 10 张 → 0 张在用**（`effect-explosion-01` 等，实际爆炸效果走的是粒子系统 + `textures/particles/`）

### 缺口 2：字段未通 18 个 —— ⚠️ 结论已修正：不该接，接了是降级

`assets/achievements/*.json` 和 `assets/shop/*.json` 里有这样的字段：

```json
{ "id": "achievement-01", "icon": "icon-achieve" }
{ "id": "shop-item-01",   "icon": "icon-character" }
```

对应文件 `textures/ui/icon-achieve.png`、`icon-character.png` 都实实在在躺在磁盘上。但是：

- **`ShopPanel.tsx`** 渲染的是 `{typeIcons[item.type] || '📦'}` —— **emoji 内置表**，`item.icon` 从头到尾没被读过
- **`AchievementPanel.tsx`** 渲染的是 `{isUnlocked ? '★' : '?'}` —— **硬编码字符**，`achievement.icon` 只在第 73 行被拷进 state，然后再没出现在 JSX 里

**而这 18 张"图标"实际全是 64×64 的纯色方块**——逐张解码 PNG 验证：

```
icon-star.png    64x64  不同颜色数=1  主色 = rgb(255,215,0) 纯金色块 ×4096 像素
icon-shield.png  64x64  不同颜色数=1  主色 = rgb(0,255,255) 纯青色块 ×4096 像素
icon-shop.png    64x64  不同颜色数=1  主色 = rgb(0,255,0)   纯绿色块 ×4096 像素
icon-heart.png   64x64  不同颜色数=1  主色 = rgb(255,0,0)   纯红色块 ×4096 像素
```

全部 40 个 ui 图标都只有 **203~227 字节**——一个 64×64 纯色位图压缩后就是这个体积，
任何真实图形都不可能这么小。它们是 `scripts/generate-assets-extended.js` 生成的占位色块。

**因此本项结论从"接线即可白捡"改为"是假料，不该接"**：
实际试接过一版（emoji → 色块），真机截图里 4096 像素的纯色方块在深色卡片上就是
一块无意义的色斑，观感明显差于 emoji。已回滚。正确做法是**换真图标**（Kenney 图标包
或 lucide 统一风格），而不是把色块接上屏。

> 方法论教训：**审计只查"有没有被引用"，不查"东西本身是什么"。**
> 把"引用了但没消费"一律当成"接线即可白捡"是错的 —— 必须先看素材质量。
> 另一个教训：看图工具会把 64×64 的纯色方块渲染出假细节（我第一眼真以为
> icon-shield 是个盾牌），**文件体积才是不会骗人的证据**。

### 缺口 3：数据 json 56 个 —— 与 TS 并行的"影子账本"

| 目录            | 文件数 | 状态                                                                            |
| --------------- | -----: | ------------------------------------------------------------------------------- |
| assets/enemies  |     10 | 内容在 `src/levels/*.ts` 里另有一份（`enemy-scout` 等名字出现在 TS 关卡定义中） |
| assets/levels   |     10 | 真源是 `src/levels/level-01.ts` ~ `level-10.ts`                                 |
| assets/powerups |     10 | `powerup-shield` / `powerup-speed` 等 id **在 `src/` 全库无命中**               |
| assets/skills   |     10 | `skill-dash` / `skill-blackhole` 等 id **全库无命中**                           |
| assets/weapons  |     10 | `weapon-laser` / `weapon-missile` 等 id **全库无命中**                          |
| assets/ships    |      6 | `ship-fighter` 等只出现在死文件 `ModelAssetProvider` / `AssetManifest` 里       |

后四组（powerups / skills / weapons / ships 共 36 个文件）描述的是一批**从未被实现的目录**：这些 json 是完整可用的策划案（含数值、稀有度、价格），但游戏里找不到任何消费这些 id 的代码。它们不等于"功能缺失"（护盾、加速、治疗在各自 System 里另有实现），而是**策划案写完了、接线没做**。

---

## 四、这 51% 的实际代价

死资源**并没有被摇树掉**，它们全部被打进构建产物：

```
dist/assets/            25 MB
├── textures/pbr/       29 个文件  ← 全部死资源
├── enemies/            10 个文件  ← 全部死资源
└── manifest.json       40 KB      ← 零引用
```

`public/` 下 10 MB 资源，1.92 MB 是纯陪跑。对一个要发到浏览器里跑的 WebGL 游戏，这部分是实打实的首包/带宽成本。

---

## 五、顺带查实的死代码链

本轮审计需要排除"假消费方"，因此顺带确认了一条 **1897 行**的零引用死代码：

| 文件                              | 行数 | 引用情况                                       |
| --------------------------------- | ---: | ---------------------------------------------- |
| `src/GameResources.ts`            |  794 | 仅被自己的测试和 `ResourceDownloadTester` 引用 |
| `src/engine/AssetManifest.ts`     |  539 | **全仓库零引用**（大小写不敏感 grep 无命中）   |
| `src/GameResourceManager.ts`      |  346 | 同上，循环依赖                                 |
| `src/ResourceDownloadTester.ts`   |  218 | **全仓库零引用**                               |
| `src/GameResourceManager.test.ts` |    — | 测试的是死代码                                 |

**关键点：`AssetManifest.ts` 是整个仓库里唯一一处把"资源 id → URL 路径"做映射的地方**（`/assets/textures/ui/${icon.id}.png` 这类拼接只在这里出现）。它一死，所有依赖 id 间接寻址的资源就全都成了孤儿——这正是缺口 1 和缺口 2 的共同根因。

---

## 六、建议处置（按性价比排序）

1. ~~先修字段未通（18 个）~~ → **已作废**，见缺口 2 的修正：它们是纯色占位块，
   接上屏是降级。正确动作是**换真图标**后才有接线价值。
2. **删死链，别删资源**
   先删 `manifest.json` + 1897 行死代码。删掉之后悬空资源的引用关系会更干净，再决定哪些资源要留。
3. **数据 json 二选一，不要并行**
   `enemies` / `levels` 的 json 与 `src/levels/*.ts` 二选一（建议留 TS，类型安全）；`powerups` / `skills` / `weapons` / `ships` 这 36 份要么接进对应 System 当配置源，要么归档到 `docs/` 别放 `public/`。
4. **清理无消费方的贴图**
   PBR 29 张（1.4 MB）+ 特效 10 张 + 环境 6 张。
   ~~先决定用不用，再决定删不删~~ → **已定**：pbr/ 里 5 张是纯棋盘格、大量是渐变，
   属于假料。真材质已由 ambientCG 三套（rock030 / metalplates016a / metal049a，
   共 3.7 MB）替代并应用到小行星带 / 空间站 / 卫星，见下节。假料可删。
5. **给构建加个体检**
   把 `scripts/audit-asset-usage.mjs` 接进 CI，输出 `runtime 利用率` 指标。低于阈值就告警，防止下一轮"生成器脚本造了一堆没人用的资源"重演。

---

## 七、已执行：ambientCG 真 PBR 接入（审计后的第一轮动作）

审计结论"pbr 29 张全是死料"之后，实际动作不是删，而是**先用真料顶上**：

| 项       | 内容                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| 接入素材 | ambientCG 三套 CC0 真材质：Rock030 / MetalPlates016A / Metal049A（1K JPG）             |
| 体积     | +3.7 MB（岩石只取 Color，金属两套取 Color + NormalGL）                                 |
| 应用位置 | 小行星带 40 个 → `rock`；空间站 → `metalPlates`；卫星 → `metal`                        |
| 引擎接口 | `preloadPbrTextures()` + `applyPbrMaterial(root, set)` + `applyPbrMaterialWhenReady()` |
| 时序处理 | GLB 替换往往早于贴图加载完成 → `onReplaced` 回调 + 未就绪登记回填                      |

**两个必须记住的技术事实**：

1. **PlayCanvas 的 `StandardMaterial` 没有 `roughnessMap`，只有 `glossMap`**，
   且两者极性相反（ambientCG 的 Roughness 图白=粗糙，glossMap 白=光滑）。
   直接把 ambientCG 的 Roughness 图当 glossMap 贴会把明暗关系整个弄反。
   所以本项目用**标量 roughness/metalness**，只贴 Color + Normal。
2. **必须开 `useMetalness = true`**，否则 metalness/roughness 根本不参与着色
   （PlayCanvas 默认走非金属的 diffuse+specular 路径）。

**验证（`scripts/verify-pbr-materials.mjs`，6/6 全绿）**：5 张 PBR 贴图请求全 2xx、
引擎日志 42 次 "PBR ... applied"、场景内 82/110 个网格挂上 PBR diffuseMap、
0 运行时错误。回归：`verify-glb-models` 42 个结构物替换仍全绿、tsc 0 错误、
vitest 344/345（既有慢下载用例）、build 通过。

**顺带修掉一个潜伏 bug**：`__waveDebug.godMode(on: boolean)` 必须传参才生效，
而验证脚本（包括既有的 `verify-glb-models.mjs`）全都写的是无参调用 `godMode?.()`——
**无敌从未真正开启过**，之前的截图全靠"抓得快"。已给参数加默认值 `on = true`。

审计后口径变化：textures 运行时引用 11 → **16**（+5 张 PBR 贴图），总体积 10.04 → **13.52 MB**。

---

## 附：判定方法说明

审计脚本做了四层判定，逐层收紧：

1. **直接命中**：把资源相对路径、`/assets/` 绝对路径、basename 作为 token，在源码语料里查找
2. **动态前缀**：正则提取 `/assets/(...)/${` 模板拼接，把整个目录判为"可寻址"，避免把 `fetch(\`/assets/shop/${id}.json\`)` 误判为死代码（**这一步是关键，否则会多误报 70 个**）
3. **排除假消费方**：生成脚本（`generate-*` / `fetch-*`）不算消费方——它们只是"自己造的自己列"；死代码文件不算消费方
4. **传递闭包**：只被"本身没人加载的 json"引用的资源降级为悬空

复杂度陷阱记录：`.json` 文件**不能**用 basename 做 token（否则生成脚本里的全量清单会让所有 json 命中，利用率虚报成 100%）。


---

## 2026-10-07-Lua运行时接通与敌机AI接线.md

# 真实 Lua 运行时接通 + 敌机 AI 接线

日期：2026-10-07
改动规模：`34 files changed, 978 insertions(+), 266 deletions(-)`（不含新增的 5 个文件）

---

## 0. 一句话

`src/lua/**/*.lua` **从未被执行过**——`LuaEngine` 找的工厂在装的 wasmoon 版本里不存在，
初始化每次都静默落到 stub。本轮接通真实运行时，把 `enemy-ai.lua`（457 行零调用）
接成第一个真实消费者，并顺手清掉了散落在 5 处的「dev 能跑、生产必炸」取源写法。

---

## 1. 事实纠正：此前「Lua 已跑起来」是错误口径

### 1.1 症状

`src/lua/LuaEngine.ts` 取工厂用的是：

```ts
const factory = (wasmoon as { factory?: unknown }).factory; // wasmoon 1.12 以前的 API
```

而 `package.json` 装的是 `wasmoon@^1.16.0`，**只导出 `LuaFactory`**，顶层与 `default` 上
都没有 `factory`。于是 `factory === undefined` → `tryCreateRealRuntime()` 恒失败 →
每次都走 `createStubLuaState()`。

`doString()` 在 stub 下是**空函数**。`registerModule(script)` 也变成只 `set()` 一下名字。

### 1.2 后果

- `src/lua/**/*.lua` 共 7 个模块文件、约 2000 行 Lua 代码，**一行都没跑过**。
- 「波次 / 道具 / 战斗统计 / 技能系统 4 块已真跑 Lua」——错误。实际跑的是
  `createStubLuaState()` 里**用宿主 JS 复刻的等价实现**（这也是为什么游戏一直"看起来正常"）。
- `enemy-ai.lua` 457 行零调用，无人发现。

### 1.3 为什么没被发现

因为 stub 是**行为等价**的复刻实现，没有报错、没有告警、接口调用全部返回合理值。
这是典型的「假接线」：**接口面有、行为面有、只有真实执行链路是断的**。

---

## 2. 改造一：接通真实 Lua 运行时

### 2.1 工厂解析（`resolveRuntimeFactory`）

分三层探测命名空间，因为 ESM / CJS / 被 mock 三种情况下导出形状不同：

| 层                      | 说明                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| `ns.LuaFactory`         | CJS `require('wasmoon')` 的顶层导出（22 个）                             |
| `ns.default.LuaFactory` | ESM `import * as wasmoon` 时，顶层 `Object.keys` 为空，全在 `default` 下 |
| `ns.factory`            | wasmoon 1.12 以前的旧单例 API，保底兼容                                  |

取属性用 `safeGet` 逐层 `try/catch`：**vitest 的模块代理对不存在的命名导出会直接抛错**
（`No "LuaFactory" export is defined on the "wasmoon" mock`），不兜住会让单测整体崩。

### 2.2 运行时自检（`selfTestRealRuntime`）—— 本轮最关键的一道闸

**「能实例化 ≠ 能用」**。实测：vitest/jsdom 下 `new LuaFactory().createEngine()` 能成功、
`doString` 不抛错，但 `global.get()` **恒返回 `() => {}`**——wasm ↔ JS 的桥是死的，
连模块里纯 Lua 定义的函数都取不回来。

不拦这个，`getRuntimeMode()` 会**谎报 `'lua'`**，所有 Lua 调用静默返回空 —— 比原来更糟，
因为连「掉到 stub」这个信号都没了。

```ts
real.doString('__luaSelfTestValue = 40 + 2');
const value = real.global.get<unknown>('__luaSelfTestValue');
const version = real.global.get<unknown>('_VERSION');
const ok = value === 42 && typeof version === 'string' && version.startsWith('Lua ');
```

两验（**算得出数** + **报得出真实版本号**）不过就 `close()` 并回落 stub。
`mode === 'lua'` 由此成为可信信号。

### 2.3 Lua 侧 `require` 装载器

wasm 里没有文件系统、也没有预加载器，`require` 无从取源。方案：

- 宿主注入 `__luaSources`：`import.meta.glob` 构建期内联的全部 `.lua` 源码；
- 宿主注入 `__hostModules`：迁移期遗留的 4 个宿主模块表；
- Lua 侧接管全局 `require`：命中 `__hostModules` 返回之；命中 `__luaSources` 走
  `load(src, '@'..name)()` 编译执行，返回值当模块表缓存；**都没有就 `error()`**。

最后一条是刻意的：**不再静默返回空表**。原来「取不到就给 `{}`」正是让假接线看起来像跑通了。

### 2.4 `initialize()` 的失败语义

**永不抛错**。任何一步（建实例 / 自检 / 注入宿主全局 / 装装载器）失败都整体回落 stub，
`console.warn` 记录原因。理由是这条链在游戏初始化路径上，Lua 环境问题不该把游戏一起带崩。

Node 下 wasmoon 直接 `Aborted(Assertion failed)`（`environ_get`），所以单测环境必然走回落分支——
单测因此围绕**降级路径与不变量**设计，真实 Lua 的行为由浏览器 e2e 覆盖。

### 2.5 `host: true`：迁移期行为等价标记

迁移期遗留的 5 个模块（`wave_manager` / `powerup_system` / `combat_stats` / `skill_system` /
`game_config`）在**真实 Lua 模式下不执行它们的 script**，行为由注入沙箱的宿主实现全局提供。

理由：它们的 script 是「Lua 代码 + 要求 `require("xxx_module")` 宿主模块」的混合体，
切到真实 Lua 后如果执行，取数路径会变成 Lua → 宿主模块，链路变长但**行为应当逐字节等价**——
那就干脆不执行，先保证「换运行时不改行为」。迁移是下一步的事，见 §5。

`skill_system` / `game_config` 的 script 里没有 stub 等价实现，执行它们本可以是净改进；
但为保持「一个开关控全部」，一并标了 `host: true`。

### 2.6 诊断出口

```ts
luaEngine.getRuntimeInfo(); // { mode, version, registeredModules,
//   availableLuaModules, loadedLuaModules, sourceRegistryErrors }
```

浏览器实测：`mode: "lua"`、`version: "Lua 5.4"`、`availableLuaModules: 13`。

---

## 3. 改造二：清掉 5 处「dev 能跑、生产必炸」的取源写法

### 3.1 抓法

接通运行时后，我把 `.lua` 源码的**取源处**全找了一遍，发现 5 处各自为政，其中 4 处是坏的：

| 文件                              | 原写法                                      | 生产构建下的实际行为 |
| --------------------------------- | ------------------------------------------- | -------------------- |
| `luaSources.ts`                   | `import.meta.glob(..., { as: 'raw' })`      | ⚠️ 见下              |
| `wave/WaveManager.ts`             | 同上                                        | 同上                 |
| `powerup/PowerupSystemManager.ts` | 同上                                        | 同上                 |
| `combat/CombatStatsManager.ts`    | 同上                                        | 同上                 |
| `skills/SkillSystemManager.ts`    | `fetch('/src/lua/skills/skill-system.lua')` | ❌ 必然 404          |
| `config/GameConfigManager.ts`     | `fetch('/src/lua/config/game-config.lua')`  | ❌ 必然 404          |

**`as: 'raw'` 在 Vite 8（rolldown）下已失效，且不报任何警告。**
实测构建产物：

```js
Io = `/assets/enemy-ai-CODabVe1.lua`; // ← 拿到的是 URL 字符串，不是源码
```

dev server 下 `as: 'raw'` 仍然有效 → **dev 全绿、生产必炸**。
而 `fetch('/src/lua/...')` 更直接：dev 下 Vite 会把 `/src/...` 当源码路径伺服，生产下这个目录不存在。

### 3.2 修法

全部收敛到唯一取源口 `luaSources.getLuaSource(name)`（构建期内联）：

```ts
const module = import.meta.glob(['./**/*.lua', '!./**/tests/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
```

另加三层护栏，让这类退化**再也藏不住**：

1. **模块级校验**：`looksLikeSourcePath()` 判定（不含换行且以 `.lua` 结尾 = 是路径不是源码），
   命中就跳过 + `console.error`，并登记进 `getLuaSourceRegistryErrors()`。
2. **单测护栏**：断言 `getLuaSourceRegistryErrors()` 为空、且每个模块源码都含换行。
3. **e2e 断言**：`A3b 源码注册表无退化条目`（node id 明确写了「拿到 URL 而非源码 = 生产必炸」）。

### 3.3 效果

- 构建产物里独立的 `.lua` 资源：**7 个 → 0 个**；
- `local EnemyAI = {}` 内联进主 chunk（实测 `dist/assets/index-*.js`）；
- `grep "fetch('/src/lua"` 在 `src/` 下只剩 3 处**注释**（都是在讲"别这么写"）。

---

## 4. 改造三：`enemy-ai.lua` 接线（A/B 可切）

### 4.1 模块侧（只读，未改一行）

`src/lua/ai/enemy-ai.lua`：457 行、`VERSION = "2.0.0"`，4 类 AI 模板：

| 类型         | speed | detectRange | 行为                                          |
| ------------ | ----- | ----------- | --------------------------------------------- |
| `PATROL`     | 2.0   | 10          | 巡逻，**不返回攻击动作**                      |
| `AGGRESSIVE` | 4.0   | 20          | 近战追击                                      |
| `SNIPER`     | 1.0   | 30          | 远程点射                                      |
| `BOSS`       | 3.0   | 25          | 血量过半切行为（`aggressive` ↔ `retreating`） |

### 4.2 桥接形态：句柄常驻 Lua 侧

跨边界只传数字/字符串，**不传表对象**（不同 wasmoon 版本对表写回语义不可靠）。
AI 的完整状态（`patrolTimer` / `attackCooldown` / `state` / 血量）留在 Lua 注册表里，
宿主每帧做 `sync(真值) → step → 读回`：

```lua
function __aiSpawn(typeKey, x, z, health, maxHealth, detectRange) → id
function __aiSync(id, x, z, health)
function __aiStep(id, px, pz, dt) → { x, z, state, behavior, action, damage, dirX, dirZ }
function __aiDespawn(id)
```

返回的是**扁平表，只含数字/字符串**。

### 4.3 坐标映射与权限边界

- Lua `x` → 世界 `X`，Lua `y` → 世界 `Z`；
- **Y 轴由适配器显式补全**（高度跟随，限幅 4 u/s）——Lua 模块是 2D 的；
- 位置钳制到与 `EnemyAI.moveTowards` 相同的 `±30 / ±15 / ±30`；
- **攻击：Lua 的 `action` 只是"意图"，伤害仍由 `Enemy.stats`（含难度缩放）决定**。
  换 AI 后端不改数值平衡。

### 4.4 感知半径必须由宿主注入

`enemy-ai.lua` 是**通用行为模板**，自带 `detectRange`（20/25/30）**小于本作刷怪半径**（20~30）。
直接用会让敌机在出生点发呆。宿主按原生 AI 的 `chaseRadius` 注入
（`EnemyAI.getDetectionRadius()` → Boss/Fighter/Tank/Scout 都是 35）。

### 4.5 敌人类型 → AI 类型（唯一换算处）

`src/engine/LuaEnemyAIBridge.ts` 的 `ENEMY_TYPE_TO_LUA_AI`：

| 敌机类型                                     | Lua AI       |
| -------------------------------------------- | ------------ |
| scout / fighter / assassin / elite           | `AGGRESSIVE` |
| bomber / tank / corvette / destroyer         | `SNIPER`     |
| drone                                        | `PATROL`     |
| boss-sentinel / boss-hive / boss-dreadnought | `BOSS`       |

键用**字符串字面量**（`scout` / `boss_sentinel`…）而不是 import 枚举，
既保编译期完整性检查（`Record<EnemyType, …>` 会强制覆盖），又**消除运行期循环依赖**。

### 4.6 摘钩点（`ExternalAIBrain`）

`EnemyAI` 新增挂载点，**失败即永久摘掉不回试**（避免刷错误日志）：

```ts
interface ExternalAIBrain {
  update(dt): boolean; // false = 该大脑失效，摘掉并回落原生行为
  getState(): AIState;
  consumeAttackIntent(): boolean;
  dispose(): void;
}
```

`Enemy.ts` 在 `startDeath()` 与 `destroy()` 两处都 `detachExternalBrain()`——
后者是兜底，因为 `destroyAll` / 重置关卡不走 `startDeath`，会漏句柄。

顺带解的题：`Enemy.ts ↔ EnemyAI.ts` 原存在**运行期循环**
（`EnemyAI` value-import `EnemyType`，`Enemy` value-import `EnemyAI`）。
改成 type-only import + 字符串字面量键的工厂表后，AI 逻辑变得「引擎无关」、可单测。

### 4.7 A/B 开关

`?ai=lua` 开、默认 `ts`。**只影响之后生成的敌机**（不热切已在场的）。
调试面 `window.__aiDebug`：`runtime()` / `getMode()` / `setMode()` / `stats()` / `inspect()` /
`forceLuaError()` / `pushEnemiesAway(radius)`。

> `__aiDebug` 与 `__waveDebug` 一样被 `import.meta.env.DEV` 包着，**生产构建会被剔除**——
> 所以生产验证另走 `verify-lua-runtime-prod.mjs`（纯 console 证据），见 §6.3。

---

## 5. 遗留与下一步

### 5.1 迁移清单：5 个 `host: true` 模块

按「宿主 JS 复刻 → 真实 Lua 执行」逐个迁移。先决条件已就绪（`require` 装载器可用、
取源已统一）。迁移每个模块时：

1. 摘掉 `registerModule({ ..., host: true })` 的 `host: true`；
2. 确认其 script 里的 `require('xxx_module')` 能从 `__hostModules` 取到（或改写为纯 Lua）；
3. 跑该模块的既有单测 + 对应 e2e，**断言行为逐字节等价**。

### 5.2 `PATROL` 不返回攻击动作

`enemy-ai.lua` 的 `updatePatrol` 不产出 `action`。因此 **Lua 模式下无人机不主动开火**。
已在代码注释与本文档写明；修法要么补 Lua 模块（改第三方模板，需评估），
要么在 `drone` 映射上避开 `PATROL`。**这是行为差异，不是 bug**，切换前需知。

### 5.3 既有失败：`verify-skilltree-wiring` 25/28

3 项失败（改造前就存在，**已用 stash 基线对照证明与本轮无关**）：

```
❌ 生命上限增量 = +10（基线 100 × 10%）: 实得=0
❌ 护盾上限 = 55（基线 50 × 1.1）:      实得=50
❌ 伤害倍率相对提升 5%:                 实得=1
```

现象：天赋点得成功、统计加成也对（`伤害 5% / 生命 10% / 护盾 10%`），
**只有「实际生效属性」没变**。即 `SkillTreeManager` 的聚合结果没有被
`PlayerShip` / `WeaponSystem` 在生成时消费。属于**既有的接线缺口**，另开一轮修。

### 5.4 `import.meta.glob` 的 `as` 选项

已全清。后续任何人写 `{ as: 'raw' }` 都会被 `looksLikeSourcePath` + 单测 + e2e 三层拦住。

---

## 6. 验证证据

### 6.1 静态与单测

| 项                 | 结果                          |
| ------------------ | ----------------------------- |
| `npx tsc --noEmit` | **0 错**                      |
| `npx vitest run`   | **375 / 375 通过（24 文件）** |

基线 352 → 375，净增 **23** 个测试：

- `src/lua/LuaEngine.test.ts`（新，10 项）：源码注册表 5 项（含「注册表里全是真实源码」护栏）、
  `initialize` 不抛错且模式可观测、`forceStub`、宿主模块两模式可取、`host:true` 脚本不执行
  （用 `error("should not run")` 反证）、destroy 后可重初始化。
- `src/engine/LuaEnemyAIBridge.test.ts`（新，13 项）：换算表覆盖全部 `EnemyType` 且反向无残留、
  Boss 系列统一 `BOSS`、`luaStateToAIState` 全覆盖、
  外部大脑挂载点（原生让位 / 状态回写 / 意图取走即清 / 摘掉后恢复 / 返回 false 永久摘掉 /
  detach 幂等 / **眩晕时不执行外部大脑**〔`duration` 口径是**毫秒**〕）、
  降级路径（ts 不挂脑、lua 模式但真实 Lua 不可用时优雅拒绝且原生行为照跑）。
  **刻意不 import playcanvas**（vitest 下是空 mock），用假实体 + 最小 `vec3` 替身。

### 6.2 dev server e2e：`scripts/verify-lua-ai.mjs` **21 / 21 全绿**

关键几条：

```
✅ A1 运行时模式                    "lua"
✅ A2 版本号来自真实 Lua            "Lua 5.4"
✅ A3 可 require 的 .lua 模块数     13
✅ A3b 源码注册表无退化条目         0
✅ B6 Lua 接管帧数                  "118,111,99"
✅ B7 桥接步进                     {"steps":328,"errors":0}
✅ B9 每架敌机的 Lua AI 类型        "AGGRESSIVE,AGGRESSIVE,AGGRESSIVE"
✅ B10 推远 26 单位后被带回         before [25,25.6,25.6] → after [11,10.3,10.3]
✅ C11 强制报错后兜底计数           {"fallbacks":3,"lastFallbackReason":"step-failed"}
✅ C12 兜底后摘脑但仍追击           minClosed 18.5
✅ D13 清场后注册表归零             0
✅ D14 波次仍能推进                 2
✅ E15c ts 模式无敌机挂 Lua 大脑    "false,false,false"
✅ E15d ts 模式不创建 Lua 句柄      {"spawned":0,"registrySize":0}
✅ E16 ts 原生同样把推远的带回来    minClosed 18.3
```

**关于 B10 的教训**：最初写的是「位置有没有变（位移 > 0.5）」→ 实得 `moved: 0`。
原因不是接线坏了，而是**敌机已经贴到玩家身上**（位置 `[0, 0, 0.02]`），
位移只剩 AGGRESSIVE 近战阈值（2.0）附近的微幅抖动 —— **假阴性**。
改成真正的行为断言：先 `pushEnemiesAway(26)` 摆到 26 单位环上，4 秒后看是否被带回。
位移速率 ~3.8 u/s，与模块 `AGGRESSIVE.speed = 4.0` 量级吻合 —— 交叉印证真实 Lua 在算。

### 6.3 生产构建验证：`scripts/verify-lua-runtime-prod.mjs` **9 / 9 全绿**

```bash
npx vite build
npx vite preview --port 4180 --strictPort
VERIFY_URL=http://localhost:4180/ node scripts/verify-lua-runtime-prod.mjs
```

```
✅ P1 真实 Lua 运行时已启用
✅ P2 未回落到 stub
✅ P3 enemy-ai.lua 已由真实 Lua 装载
     "[EnemyAIManager] 已接通 enemy-ai.lua v2.0.0（运行时 lua）"
✅ P3b 装载出的是 v2.0.0（Lua 侧读回）
✅ P4 无 enemy-ai.lua 装载失败
✅ P5 源码注册表无退化条目
✅ P6 无未捕获页面错误
✅ P7 战斗画布已渲染 / P7b HUD 正常
```

这个脚本存在的理由：调试钩子在生产被剔除，`verify-lua-ai.mjs` **证明不了生产构建**；
而"dev 绿、prod 炸"恰恰是本轮抓到的真实缺陷类别。它改用**纯 console 证据**——
`v2.0.0` 是 `enemy-ai.lua` 里 `EnemyAI.VERSION` 经 Lua 侧 `__aiProbe()` 读回来的，
伪造不出来（拿 URL 当源码 `load` 会直接抛语法错，落进「装载失败」分支）。

### 6.4 既有 e2e 回归

全绿：`verify-level-system`、`verify-wave-plans`、`verify-environment`（14 项）、
`verify-glb-models`、`verify-postfx`、`verify-survival-wiring`（36/36）、
`verify-wave-progression`、`verify-final-wave`、`verify-pbr-materials`（6/6）、
`verify-particle-textures`、`verify-icon-wiring`、`verify-audio-wiring`（9/9）。

唯一非全绿：`verify-skilltree-wiring` 25/28 —— 见 §5.3，**已证既有**。

### 6.5 `vite build`

成功（`✓ built in 1m 33s`），仅有既有的 chunk 体积告警与一条
`INEFFECTIVE_DYNAMIC_IMPORT`（`SkillSystem.ts` 同时静态与动态 import，既有问题）。

---

## 7. 踩过的坑（供后人少走）

1. **wasmoon 1.16 在 Node 下无法实例化**（`Aborted(Assertion failed)` / `environ_get`）。
   试过 `env -i`、补 `SYSTEMROOT`、最小脚本、直接 `LuaFactory` —— 全部 silent abort。
   **不要在 Node 下追真实 Lua**，单测围绕降级路径设计即可。
2. **vitest 的 wasmoon mock 对不存在的命名导出直接抛错** → 取属性必须 `safeGet` 逐层 try/catch。
3. **vitest 的 playcanvas 是空 mock**（无 `TONEMAP_LINEAR`）。
   `PlayCanvasEngine.TONEMAP_MODES` 原本是 `static readonly = { linear: pc.TONEMAP_LINEAR, … }`，
   **模块求值期**就读常量 → 任何 import 到它的场景都会在 vitest 下崩，且错误会**污染同批次其他文件**
   （先用 `vi.mock('wasmoon')` 的文件会让报错归因错位）。
   已改惰性 getter。新测试因此**不 import playcanvas**。
4. **`wasmoon.close()` 不是引擎上的方法**，是 `engine.global.close()`。
5. **真相在 5.4**：`math.clamp` 不存在；`#` 对 JS 传入的数组有效；
   Lua 数组返回 JS 时是真 `Array`（`list[0]` 是第一个元素）。
6. **`EnemyAI.duration` 单位是毫秒**（`updateStatusEffects` 里 `remainingTime -= dt * 1000`）。
   测试里 `addStatusEffect('stun', 5, 1)` 会当 5ms 立刻过期 —— 要传 `5000`。
7. **批量 e2e 回归时全部 `ERR_CONNECTION_REFUSED`**：多数脚本头部注释写的端口
   （5175/5176/5177/5178）与 dev server 实际端口不一致。统一 `VERIFY_URL` 即可。
   （脚本内 `BASE = process.env.VERIFY_URL || …` 的默认值与注释不一致，值得后续统一。）
8. **`git stash push -u` 会一并暂存被 e2e 改写的 `docs/verify/*.png`**，
   `pop` 时若期间跑过别的 e2e，会在这些截图上冲突 → 先 `git checkout -- <png>` 再 `pop`。
   恢复后务必逐文件比对内容（本项目 `core.autocrlf=true`，`diff` 会因 CRLF 报假差异）。


---

## 2026-10-07-飞船活动范围扩大.md

# 飞船活动范围扩大（世界整体 2×）

日期：2026-10-07
改动规模：12 个源文件修改 + 3 个新文件（`src/engine/arena.ts`、`arena.test.ts`、`scripts/verify-arena-bounds.mjs`）

---

## 0. 一句话

飞船此前被硬编码钳制在 X/Z ±25、Y ±15，配 `maxSpeed 15 × boost 2.5 = 37.5 u/s`，
**满速横穿全场不到 1.4 秒**——这就是"可移动空间过于有限"的直接来源。
本轮把世界整体放大 2 倍（飞船 ±50/±30/±50，横穿约 2.7 秒、体积 8 倍），
并把散落在 5 处的空间常量收口成唯一真源。

---

## 1. 现状诊断：空间不是"一个数"，是"五个数"

排查发现"世界有多大"分散硬编码在 5 处，彼此没有任何约束：

| 位置                     | 常量                                   | 旧值              |
| ------------------------ | -------------------------------------- | ----------------- |
| `PlayerShip.update`      | 飞船钳制                               | ±25 / ±15 / ±25   |
| `EnemyAI.moveTowards`    | 敌机钳制                               | ±30 / ±15 / ±30   |
| `EnemySystem.spawnEnemy` | 生成环半径 / Y 限幅                    | 20~30 / ±10       |
| `GameScene` 布景调用处   | 小行星带 / 星场 / 星云 / 行星 / 空间站 | 35~~55 / 20~~60 … |
| `WeaponSystem` 弹丸回收  | 距原点半径                             | 100               |

**这意味着"只把飞船钳制改大"必然出 bug**：

1. **敌机追不出原边界** —— 玩家跑到 40，敌机被卡在 30 的墙上看你，等于白给；
2. **生成环还在中间** —— 敌机全从场地中心冒出来，玩家到了边缘就"背后长敌机"；
3. **小行星带陷进场地** —— 带是有碰撞体的（`AsteroidSystem` 会扣血），飞船一放宽就撞进去；
4. **布景相对位置失真** —— 空间站原本在"远处"，现在飞船两步就到它脸上；
5. **弹丸被提前回收** —— 回收半径 100 是按旧场地写的，玩家在场地边缘开火时
   射程被截短（旧场地最大离原点仅 ~38，所以从没暴露过）。

## 2. 关键的既有设计：小行星带就是"看得见的墙"

旧值的几何关系不是随便写的：

```
飞船盒子对角线 = √(25² + 15² + 25²) ≈ 38.4
小行星带内缘   = 35
```

带内缘略小于对角 —— 即飞船在最极端的 3D 角落会**略微**探入带内，但基本相切。
**小行星带就是这个游戏的可视边界**：飞船被钳在带内，带外是"去不了的地方"。

所以"放宽飞船边界"必须连带把带外移，否则边界就不合理了（直接穿进岩石堆里）。

---

## 3. 方案：整体等比放大 2×，而不是各处拍脑袋

用户在三个量级（约 1.5× / 2× / 3×）中选了 **2×**。

采用"**世界是 1× 基准的等比放大**"而不是逐项手调，理由：

- 所有相对关系（敌机比玩家大一圈、带与场地相切、生成环与场地同比例）**自动保持**；
- 天空观感可以做到**逐像素不变**（见 §4.3）；
- 一处常量控制全部，将来想再调只改一个数。

### 新旧对照（k = 2）

| 项       | 1× 基准         | 现在                | 说明                      |
| -------- | --------------- | ------------------- | ------------------------- |
| 飞船钳制 | ±25 / ±15 / ±25 | **±50 / ±30 / ±50** | 体积 8×，横穿 1.3s → 2.7s |
| 敌机钳制 | ±30 / ±15 / ±30 | **±60 / ±30 / ±60** | 保持 1.2× 于玩家          |
| 生成环   | 20~30 / Y±10    | **40~60 / Y±20**    | 与场地同比例              |
| 小行星带 | r 35~55         | **r 70~110**        | 仍是"看得见的墙"          |
| 岩石尺寸 | ×1              | **×2**              | 见 §4.3                   |
| 弹丸回收 | 100（魔数）     | **150（派生）**     | 见 §4.4                   |

---

## 4. 实现要点

### 4.1 唯一真源：`src/engine/arena.ts`（零依赖叶子）

```ts
export const ARENA_SCALE = 2;
export const PLAYER_BOUNDS = { x: 50, y: 30, z: 50 };
export const ENEMY_BOUNDS = { x: 60, y: 30, z: 60 };
export const ENEMY_SPAWN = { ringInner: 40, ringOuter: 60, yLimit: 20 };
export const ASTEROID_BELT = { count: 40, innerRadius: 70, outerRadius: 110, sizeScale: 2 };
export const BACKDROP = { starField, nebulae, planets, structures };
export const PROJECTILE_CULL_RADIUS = Math.ceil(ENEMY_CORNER_DISTANCE) + 60;
```

**依赖方向的硬约束**：这个文件**不得 import 任何东西**。
因为场地边界要被引擎热路径（`PlayerShip` / `EnemyAI` / `EnemySystem` / `WeaponSystem`）
直接引用，若把它放进关卡派生层（`src/levels/index.ts`），会把整条
关卡配置链（含 `WaveManager` → `LuaEngine` → wasmoon）拖进热路径。

折中做法：真源在 `arena.ts`，`src/levels/index.ts` 从这里**再导出**，
保持"关卡/世界配置从 `'../levels'` 取"的既有习惯不破。

### 4.2 敌机边界：从"两处手工同步"变成"同一对象引用"

`LuaEnemyAIBridge.AI_WORLD_BOUNDS` 原本是一个**独立写的常量**（±30/±15/±30），
注释写着"与 `EnemyAI.moveTowards` 一致（两处必须同步）"——这正是会漂移的那种约定。

现在：

```ts
export const AI_WORLD_BOUNDS = ENEMY_BOUNDS; // 同一对象引用，物理上不可能漂移
```

换 AI 后端（`?ai=ts` / `?ai=lua`）不再可能给出不同的活动范围。
测试里用 `expect(AI_WORLD_BOUNDS).toBe(ENEMY_BOUNDS)` 锁死引用相等。

### 4.3 为什么岩石尺寸 ×2、数量却不变

这是本轮最划算的一笔账。

小行星带是**球壳**。球壳的"角密度"（每立体角多少颗）**只由数量决定**，与半径无关 ——
把 40 颗从 r=45 挪到 r=90，你抬头看到的岩石数量一模一样。

但每颗岩石的**视角尺寸**会随距离减半。所以只需把岩石尺寸 ×2，天空观感就完全一致。

结论：**数量保持 40 不变，尺寸 ×2**。这次外移**没有增加任何 draw call**。
（若按面积密度 naive 地 ×4 到 160 颗，反而会把带渲染得密一倍，且多 120 个 GLB 实例。）

### 4.4 弹丸回收半径：魔数变派生

旧值 100 是按旧场地写的。新敌机边界对角 = √(60²+30²+60²) = 90 ——
离 100 只剩 10 的余量，太脆弱。现在：

```ts
export const PROJECTILE_CULL_RADIUS = Math.ceil(ENEMY_CORNER_DISTANCE) + 60; // 150
```

派生自敌机边界 + 交战余量，并保证 `> ENEMY_CORNER_DISTANCE`（有测试锁住）。
将来再放大场地，这个值会自己跟上。

### 4.5 布景：位置 ×2 + 尺寸 ×2 ⇒ 天空构图不变

星云 / 行星 / 空间站 / 卫星的位置与尺寸**同倍**放大。从原点看，
方位与视角尺寸都不变 —— 玩家看到的天空和以前一样，只是整体后退了一倍，
飞船因此获得更大的活动体积而画面构图不被破坏。

顺带把原来两段几乎相同的结构物创建代码（station / satellite）收成一个循环，
数据（位置 / 朝向 / 尺寸 / PBR 材质）全部搬进 `BACKDROP.structures`。

### 4.6 `PlayCanvasEngine` 的两个生成函数加了 `sizeScale`

`createStarField(count, inner, outer, sizeScale=1)` 与
`createAsteroidField(count, center, inner, outer, sizeScale=1)`。
默认 1，不影响任何既有调用方；同时把小行星带的日志补上了半径与尺寸倍率
（e2e 据此断言带真的被移到了新场地之外）。

---

## 5. 验证

### 5.1 单测：`src/engine/arena.test.ts`（13 项，防漂移护栏）

两类断言：

- **A. 同倍关系**：所有派生值必须等于 1× 基准 × `ARENA_SCALE`。
  文件里存了一份**只读的 1× 基准**（旧版实际数值）作为参照物 ——
  防的是"调了 `ARENA_SCALE` / 手改了某个值，其他值没跟着走"。
- **B. 语义关系**：与倍数无关的相互约束 ——
  敌机边界 ⊇ 玩家边界（每轴）、生成环外径 ≥ 玩家半边长、
  小行星带内缘 > 玩家半边长、**带内缘/半边长 ∈ [1.4, √2]**（守住原有的相切关系）、
  弹丸回收半径 > 敌机对角距离、以及
  "放大后确实更宽敞"（体积比 = k³、旧版横穿 < 1.5s、新版 > 2.5s）。

### 5.2 e2e：`scripts/verify-arena-bounds.mjs` **14 / 14 全绿**

单测只能断言常量；这个脚本断言的是「**输入 → 物理 → 钳制**」这条生产链路的实际结果——
用**真实键盘输入**（`KeyW` / `Space` / `ArrowUp`）驱动飞船，从生产 `update` 循环
读回真实位置：

```
✅ A1 XZ 最远距离 > 30（旧上界 25）        50.0
✅ A2 从未越过新上界 50                    50.0
✅ A3 确实顶到了新上界（>= 49）             50.0
✅ B1 Y 最远 > 16（旧上界 15）              30.0
✅ B2 Y 从未越过新上界 30                   30.0
✅ B3 确实顶到了 Y 上界附近                  30.0
✅ B4 爬升阶段 XZ 仍未越界                   47.8
✅ C1b 小行星带 r=70~110, sizeScale=2
✅ C2 日志里不含旧半径 35~55（防回退）
✅ D1 无未捕获页面错误 / D2 战斗仍在推进
```

`A3` / `B3` 是关键：只断言"飞得比原来远"不够，必须证明**真的顶到了新上限**，
否则上限改成 1000 也能过 A1。

选第 2 关（陨石航道）而不是第 1 关：只有第 2 关 `environment.asteroidField = true`，
才能一并验证小行星带被移出（C 组断言）。

**dev 与生产构建各跑一遍，都是 14/14**：

```bash
# dev
npx vite --port 5177 --strictPort
VERIFY_URL=http://localhost:5177/ node scripts/verify-arena-bounds.mjs
# 生产
npx vite build && npx vite preview --port 4180 --strictPort
VERIFY_URL=http://localhost:4180/ node scripts/verify-arena-bounds.mjs
```

生产侧只改了一处：`__waveDebug` 被 `import.meta.env.DEV` 剔除，D2 退化为读 HUD 文案。
`__playerDebug`（`PlayerShip` 里无条件挂载）在两种构建下都在，所以飞行断言两边通用 ——
于是「放宽边界」这件事在**真正会被玩家跑到的产物**里也得到了实证。

### 5.3 回归矩阵

| 脚本                                  | 结果                                                |
| ------------------------------------- | --------------------------------------------------- |
| `verify-lua-ai`                       | ✅ 全部通过（21 项）—— 敌机边界变了，A/B 对照仍全绿 |
| `verify-wave-plans`                   | ✅ 全部通过                                         |
| `verify-level-system`                 | ✅ 全部通过                                         |
| `verify-survival-wiring`              | ✅ 36/36                                            |
| `verify-wave-progression`             | ✅ 波次 1→2→3 正常推进                              |
| `verify-environment`                  | ✅ 14/14                                            |
| `verify-glb-models`                   | ✅ 通过（结构物 2 个实体替换、0 加载失败）          |
| `verify-pbr-materials`                | ✅ 6/6                                              |
| `verify-particle-textures`            | ✅ 9/9                                              |
| `verify-postfx`                       | ✅ 12/12                                            |
| `verify-icon-wiring`                  | ✅ 全部通过                                         |
| `verify-audio-wiring`                 | ✅ 9/9                                              |
| `vitest run`                          | ✅ **389/389（25 文件）**，基线 375 → +14           |
| `npx tsc --noEmit`                    | ✅ 0 错                                             |
| `npx vite build`                      | ✅ 成功（2m01s）                                    |
| `verify-arena-bounds`（生产 preview） | ✅ 14/14                                            |

**两个已知非本轮问题的脚本**（都做了基线对照/考证）：

- `verify-skilltree-wiring` 25/28 —— 既有失败（技能树聚合结果未被
  `PlayerShip`/`WeaponSystem` 消费），上一轮已用 stash 基线证实，见
  `docs/2026-10-07-Lua运行时接通与敌机AI接线.md` §5.3。
- `verify-final-wave` **末波 ❌ / 关卡完成触发 ❌** —— **陈旧脚本，与本轮无关**。
  考证：脚本写于 `7832a8df`（10-05），当时 `maxWaves` 还是 Lua 默认 **10** 波；
  次日 `0d473420`（关卡系统接通）引入 `setMaxWaves(levelConfig.waves.length)`，
  第 1 关变成 3 波 → 脚本里的 `startWave(9)` 从此被
  `waveNumber exceeds maxWaves` 拒绝，于是它只是把 3 波打完，然后对自己
  "wave 10 专属"的两个断言报 ❌（日志里其实已经打出 `✅ 关卡完成`、结算界面 `胜利=true`）。
  已用 `git stash` 在改造前基线上复跑，结果**逐字一致**（末波 ❌ / wave=3）。
  **建议**：改成 `startWave(maxWaves - 1)` 或深链到一个 10 波关卡。

---

## 6. 遗留与说明

1. **3D 极角仍会略微探入小行星带**（对角 ≈76.8 vs 带内缘 70，探入 ~6.8）。
   这是 1× 就有的关系（38.4 vs 35），本轮**刻意保持**而不是顺手改掉 ——
   改了就是行为变更。带很稀疏（40 颗分布在整层球壳），实际撞上的概率很低。
   想彻底杜绝：把 `ASTEROID_BELT.innerRadius` 提到 ≥ 78 即可，
   `arena.test.ts` 的相切关系断言会提醒你同步改基准。
2. **想再调大小**：改 `ARENA_SCALE`（或直接改 `PLAYER_BOUNDS` 并同步其他值），
   `arena.test.ts` 的 13 项断言会告诉你哪一处没跟上。
3. 相机（`CameraSystem`）没有世界边界，纯跟随，无需改动。
4. 小行星碰撞只扣血不推位置（`AsteroidSystem.ts:62`），飞行测试不受干扰。


---

## 2026-10-07-源码死簇审计与清理.md

# 源码死簇审计与清理

日期：2026-10-07
脚本：`scripts/audit-dead-code.mjs`（可复跑）

## 结论

`src` 下 193 个模块，**只有 107 个能从生产入口走到（55%）**。排查出 **54 个死文件 / 16,627 行**。
清理分两步执行：**阶段 1**（有明确活替代品的弃用架构，14 文件 / 3,853 行）、
**阶段 2-A**（有活替代品的旧版重复残留，20 文件 / 4,153 行）。
余下 **20 个 / 8,587 行**是「无替代品的功能」，需决定接线 / 冻结 / 删除。

| 指标                   | 清理前            | 阶段 1 后         | 阶段 2-A 后          |
| ---------------------- | ----------------- | ----------------- | -------------------- |
| src 模块总数           | 193               | 179               | 159                  |
| 生产可达（LIVE）       | 107               | **107**           | **107**              |
| 死代码（DEAD）         | 54 个 / 16,627 行 | 40 个 / 12,760 行 | **20 个 / 8,587 行** |
| 仅测试使用（TESTONLY） | 11                | 11                | 11                   |

> **LIVE 在三个阶段都是 107**——删掉的全是死文件，没有一个活文件被误伤。
> 这是这类清理唯一可靠的安全指标。

## 为什么上一轮没发现

上一轮的 `audit-asset-usage.mjs` 只覆盖 `public/assets`（资源文件），**源码层是它的盲区**。
证据：`Enhanced*` 一族早在 2026-10-03 的迁移记录里就被写明「只被彼此引用，没有入口，
留待决定死代码去留时一并处理」——留到了今天。

本轮补上 `scripts/audit-dead-code.mjs`：从入口做 import 图可达性分析，结论可复现、不依赖人工 grep。

## 方法

- **入口**：`src/main.tsx`（`index.html` 里唯一的 module script）+ `vitest.config.ts` 的
  `setupFiles`。漏掉后者会把 `setupTests.ts`（369 行）误判成死代码。
- **判定**：从入口 BFS，能走到 = LIVE；走不到但被 `*.test.ts` 引用 = TESTONLY；其余 = DEAD。
- **关键处理**：
  - **先剥离注释再提依赖**。否则文件头「用法示例」里的 `* import { X } from './x'` 会被当成
    真实依赖边，把死文件误判成活文件（方向保守，但会严重低估问题规模）。加这步前后
    DEAD 数都是 54——说明原先那 2 处「无法解析的说明符」确实只是注释噪音，没有漏报。
  - `import(变量)` 这类静态分析的盲区**单列 DYN**，命中即标 ⚠。实测本项目 0 处，
    且 `import.meta.glob` 只用在 `.lua` 文本资源上——**不存在约定式加载**，判定可靠。
  - 输出每个死文件的「首个导出声明 + 头部注释首句」，供人工分类。
- **复现**：`node scripts/audit-dead-code.mjs`（摘要）／`--list`（完整清单）／`--json`（机器可读）。

## 阶段 1：已删除（14 文件 / 3,853 行）

判据：**每一行都有活替代品，且有第三方佐证（文档/迁移记录）**。

| 删除                                     | 行数 | 活替代品 / 佐证                                                                                                                             |
| ---------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine/Game.ts`                     | 1014 | 死根。它 import 了 AnimationSystem / DebugSystem / LevelEditor / MultiplayerSystem 一整排系统，自己却零入口；实际启动路径是 `GameScene.tsx` |
| `src/engine/EnhancedPlayCanvasEngine.ts` | 513  | `PlayCanvasEngine.ts`（GameScene 实际使用）                                                                                                 |
| `src/engine/EnhancedPlayerShip.ts`       | 519  | `PlayerShip.ts`                                                                                                                             |
| `src/engine/EnhancedEnemy.ts`            | 500  | `Enemy.ts` / `EnemySystem.ts`                                                                                                               |
| `src/engine/EnhancedEnemySystem.ts`      | 298  | `EnemySystem.ts`                                                                                                                            |
| `src/engine/EnhancedWeaponSystem.ts`     | 279  | `WeaponSystem.ts`                                                                                                                           |
| `src/GameEngineCore.ts`                  | 319  | `PlayCanvasEngine.ts`                                                                                                                       |
| `src/GameContainer.tsx`                  | 254  | `src/App.tsx`                                                                                                                               |
| `src/components/App.tsx`                 | 53   | `src/App.tsx`（main.tsx 引的是根目录那个）                                                                                                  |
| `src/main.ts`                            | 15   | `src/main.tsx`（index.html 引的是这个）                                                                                                     |
| `src/index.ts`                           | 25   | 无 lib 构建模式，纯残留                                                                                                                     |
| `src/game/index.ts`                      | 24   | 直接引用各模块（`game/GameStateMachine` 仍活着）                                                                                            |
| `src/components/GameSceneLazy.tsx`       | 21   | `App.tsx` 里直接 `lazy(() => import('./components/GameScene'))`                                                                             |
| `src/engine/lazyImports.ts`              | 32   | GameScene 改用类型级 `import('...')` 直接指向真实模块                                                                                       |

**`Enhanced*` 一族为什么必须删而不是接线**：它们按旧版 Engine 1 API 写，
2026-10-03 迁移时已查明 `createParticleSystem` 的 6 个属性（speed / colorStart / colorEnd /
sizeStart / sizeEnd / emissionRate）在 Engine 2 **全部不存在**，`emitterShape: 'cone'` 也不合法。
**这些错编译期抓不到**（强转 + 项目自封装 API），接线即可运行是不可能的——只能重写，而功能已有活实现。

## 阶段 2-A：已删除（20 文件 / 4,153 行）

判据同上（每行都有活替代品）。删前另做**反向依赖检查**——待删文件若被「仅测试引用」的
模块引用，删了会连带炸单测：实测仅 2 处命中且均安全（`utils/ObjectPool.test.ts` 引的是
**utils 版**、不是要删的 engine 版；`GameplayManager.ts` 引的是 **engine 版成就系统**，
正好证明要删的 `game/AchievementSystem` 无人用）。

| 删除                                                                                                                                                                        | 行数 | 理由                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/GameStateManager.ts`                                                                                                                                                   | 194  | 被活的 `src/game/GameStateMachine.ts`（App.tsx 引用）取代，同概念两份                                                                    |
| `src/EffectSystem.ts`                                                                                                                                                       | 173  | 被活的 `engine/VisualEffectSystem.ts` 取代                                                                                               |
| `src/engine/ObjectPool.ts`                                                                                                                                                  | 491  | 与 `src/utils/ObjectPool.ts` 重复一套；utils 版有单测覆盖，engine 版无                                                                   |
| `src/game/AchievementSystem.ts`                                                                                                                                             | 309  | 与 `src/engine/AchievementSystem.ts` 重名两份                                                                                            |
| `src/game/CombatSystem.ts` + `GameEventBus.ts`                                                                                                                              | 325  | `src/game/` 下未接线的旧核心模块（同目录 `GameStateMachine` 才是活的那个）                                                               |
| `src/UIManager.ts`                                                                                                                                                          | 329  | 旧 DOM 式 UI 管理，已被 React 组件体系取代                                                                                               |
| `src/AudioGenerator.ts` + `engine/ProceduralAudioGenerator.ts`                                                                                                              | 551  | 活的音频链是 `AudioSystem` + `GlobalAudio`                                                                                               |
| `src/DownloadManager.ts` + `FileStorageManager.ts` + `components/ResourceDownloadUI.tsx` + `ResourceTestUI.tsx` + `ResourceLoadingProgress.tsx` + `types/resource-types.ts` | 907  | **上一轮死链清理的同族残骸**（`GameResources.ts` / `GameResourceManager.ts` / `ResourceDownloadTester.ts` 已删），整条资源下载线只剩这些 |
| `src/hooks/useInputManager.ts` + `engine/InputSystem.ts`                                                                                                                    | 614  | 输入有三套实现（含 `src/InputManager.ts`），活的输入在 `PlayerShip` + GameScene 内联                                                     |
| `src/store/useGameStateHooks.ts`                                                                                                                                            | 60   | 被活的 `useGameStore` 取代                                                                                                               |
| `src/lua/examples.ts`                                                                                                                                                       | 188  | Lua 集成示例，非生产代码                                                                                                                 |
| `src/components/ErrorOverlay.tsx`                                                                                                                                           | 32   | 零引用 UI                                                                                                                                |

小计 **4,153 行**（上表各行合计，已全部删除）。

## 阶段 2-B：无替代品的功能（需决策：接线 / 冻结 / 删除）

这些**不是垃圾**，是「做完了没接」或「计划中没做」——按 wiring-gap-audit 的口径，
这是最值得接线的部分，不能一刀切删。

| 功能线           | 文件                                                                                                                                                                                                                   | 行数  | 现状与判据                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| **联机**         | `engine/MultiplayerSystem.ts` / `MultiplayerClient.ts` / `components/MultiplayerPanel.tsx`                                                                                                                             | 1700  | README 至今挂着未勾选的 `- [ ] 多人游戏`；`GAME_DEVELOPMENT_DIRECTION.md` 标为「⏳ 计划中 P1」，且注明「后端仍在冻结状态」 |
| **关卡编辑器**   | `engine/LevelEditor.ts`                                                                                                                                                                                                | 1081  | 开发工具，1081 行且**已按 Engine 2 修过**（迁移记录里有它的 fix），但没有任何入口 UI                                       |
| **引擎能力系统** | `ProceduralTextureGenerator` / `AnimationSystem` / `DebugSystem` / `MobileSystem` / `ComputePhysics` / `AINPCController` / `ScreenAdapter` / `MemoryManager` / `AssetBundleSystem` / `LODSystem` / `PBRMaterialSystem` | 5,209 | 都是独立能力模块（LOD / 对象池 / 移动端适配 / 物理），与当前玩法无耦合；接线成本中等，收益取决于后续方向                   |
| **性能监控**     | `components/PerformancePanel.tsx` / `PerformanceOverlay.tsx` / `engine/PerformanceMonitor.ts`（105 行版）/ `monitoring/PerformanceMonitor.ts`（175 行版）                                                              | 560   | 面板 + 两套 Monitor 实现，零入口；作为开发期工具接起来成本低                                                               |
| **关卡 UI**      | `components/LevelUI.tsx`                                                                                                                                                                                               | 327   | 与现有 `LevelSelect.tsx` 职责重叠                                                                                          |
| **成就（旧）**   | 见 2-A                                                                                                                                                                                                                 | —     | 已在阶段 2-A 删除                                                                                                          |

## 阶段 3：TESTONLY（11 个 / 2,554 行）

生产不可达、但被单测覆盖——**删了会连带删测试**，处置需谨慎。

| 文件                            | 行数 | 备注                                              |
| ------------------------------- | ---- | ------------------------------------------------- |
| `src/engine/ResourceManager.ts` | 672  | 与已删的 `GameResourceManager.ts` 同族            |
| `src/engine/SecuritySystem.ts`  | 421  | 反作弊/校验，零生产引用                           |
| `src/InputManager.ts`           | 401  | 输入三套之一（另一套活的在 PlayerShip）           |
| `src/engine/EventSystem.ts`     | 385  | 事件总线，零生产引用                              |
| `src/setupTests.ts`             | 369  | **测试基础设施，不是死代码**（vitest setupFiles） |
| `src/engine/FeedbackSystem.ts`  | 305  | 打击反馈                                          |
| `src/utils/ObjectPool.ts`       | 175  | 见 2-A                                            |
| `src/ScoreSystem.ts`            | 175  | 计分                                              |
| `src/types/game-types.ts`       | 145  | 共享类型（可能仍被 TYPEONLY 引用）                |
| `src/ResourceValidator.ts`      | 67   | MD5 校验                                          |
| `src/types/index.ts`            | 40   | barrel                                            |

## 重要提醒：清理的收益不是包体积

**死代码不会进 bundle**——Vite 只打包从入口可达的模块，`src` 里这些文件本来就没进过 `dist/`。
本轮收益是**可维护性与编译面**：tsc / 单测 / 检索时的信噪比，以及「改错文件」这一类事故。
真正影响 `dist` 体积的是上一轮 `public/assets` 的清理（那批是原样拷贝进产物的）。

## 验证口径

改动后必须全绿才算数：

```
npx tsc --noEmit                     # 0 错
npx vitest run                       # 基线全绿（348/348）
node scripts/audit-dead-code.mjs     # DEAD 只降不升
```

e2e 回归（需先 `npx vite --port 5177 --strictPort`，且 **`NO_PROXY=localhost,127.0.0.1`**）：
`verify-icon-wiring` / `verify-pbr-materials` / `verify-particle-textures` / `verify-audio-wiring` /
`verify-level-system` / `verify-wave-plans`。


---

## 2026-10-10-成就系统接线.md

# 成就系统接线（2026-10-10）

## 原状：两套并行真源，面板永远全锁

接线前成就系统是「两端各一套数据、中间全断」：

| 层                         | 内容                                                                        | 问题                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 面板 `AchievementPanel`    | `fetch('/assets/achievements/achievement-01..15.json')`（content 层 15 条） | 读的是**死 key**：`localStorage.unlockedAchievements` 全仓**无任何写入方** → 永远 0/15 全锁                   |
| 运行时 `AchievementSystem` | 22 条 TS 硬编码定义                                                         | 只 `addScore`，JSON 里写的 experience/credits 从未入账；且四条分数成就因 `highestScore` 累加语义 bug **白送** |
| 上游统计                   | —                                                                           | `shotsFired` / `shotsHit` / `skillsUsed` / Boss 具体类型 / 无伤通关 / 最快通关：**全部零供给方**              |

content JSON 里另有 5 条 `story_complete` 成就要求「完成章节」，但任务链里
mission-02 依赖不存在的 `transport-ship` 玩法 → 这 5 条**不可达**，未迁入（见下）。

## 接线后的结构

```
战斗事件（击杀/开火/命中/技能/受伤/道具/关卡结算）
        ↓ 唯一漏斗
AchievementSystem（唯一真源：32 条定义 + 统计 + 判定 + 奖励发放）
        ↓ getSnapshot()（只读）
AchievementPanel（纯视图：图标 + 进度条 + 奖励合计）
```

- **定义表收敛为一份**：32 条（运行时 22 条 + 从 content JSON 迁入 10 条）。
  5 条 `story_complete` 未迁（不可达成，成因写在 `AchievementSystem.ts` 文件头）。
- **条件全部声明式**（`AchievementCondition` 判别联合 + `evaluateCondition` 纯函数），
  替代原先的巨型 `switch(def.id)`，因此可被单测逐条覆盖。
- **奖励真入账**：`rewards { experience, credits, score }`，经验走
  `useGameStore.addExperience`（等级由经验推导），信用点走 `CreditsStore`。
  `paid` 凭证保证只发一次，老存档（只发过分数的）会**补发**经验/信用点。
- **面板是只读视图**：不再 fetch JSON，不再碰 localStorage 死 key。
  `public/assets/achievements/` 15 个 JSON 已删除。

## 统计语义（改判定逻辑前必看）

| 语义   | 字段                                                                                                               | 说明                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| 累加   | `totalKills` / `totalDeaths` / `powerupsCollected` / `distanceTraveled` / `noDamageClears` / `missionsCompleted` … | 调用方每次报增量                            |
| 取最大 | `highestScore` / `highestWave`                                                                                     | **不能累加也不能覆盖**（`MAX_FIELDS` 守护） |
| 取最快 | `fastestClearSeconds`                                                                                              | 0 = 还没通关过，不是「0 秒通关」            |
| 记录表 | `enemiesKilledByType` / `bossKillsByType` / `skillsUsed`（`RECORD_FIELDS`）                                        | 按键累加                                    |

### 顺带修掉的既有缺陷：`highestScore` 累加

接线前 `updateStats({ highestScore })` 走累加语义——每杀一个敌人都把**当前总分**
再加一遍，四条分数成就第一关就白送、奖励经济严重失真。已改为取最大，
单测覆盖 `[1200, 3000, 2500, 8000, 4000] → 8000`。

### 词表陷阱

`bossKillsByType` 的 key 必须是**运行时词表**（`boss_sentinel` / `boss_overlord`，
`EnemySystem.getType()` 的返回值），不是配置侧的 `boss-sentinel`。
换算唯一入口是 `ENEMY_TYPE_TO_RUNTIME`（单测有护栏）。

## 本轮补齐的上游统计通道

| 通道          | 实现位置                                                                    | 服务的成就    |
| ------------- | --------------------------------------------------------------------------- | ------------- |
| 命中率        | `WeaponSystem` 新增 `shotsFired`/`shotsHit` 计数 + `getAccuracyStats()`     | 神射手系列    |
| 技能使用      | `SkillSystem.setOnSkillActivated()` 回调（仅真激活成功时回调）              | 技能系列      |
| Boss 具体类型 | `GameplayManager` 击杀上报加 `bossKillsByType`                              | Boss 猎人系列 |
| 无伤通关      | `PlayerShip.damageTaken`（唯一受伤入口累计）→ 关卡结算读 `getDamageTaken()` | 无伤系列      |
| 最快通关      | `GameScene.levelStartTimeRef` → 结算时算秒                                  | 速度狂魔      |
| 任务完成数    | `StoryMissionManager.getProgressStats().completed`（1Hz 同步）              | 任务系列      |

1Hz 低频同步块只放「连续量」（命中率/任务数/存活时长）；离散事件在各自事件点即时上报。

## 防白送的护栏

- `fastClear`：`fastestClearSeconds === 0`（从未通关）→ `current = 0`，不许判成。
- `accuracy`：夹取到 ≤100%（分裂弹会打出 >100%）。
- `allAchievements`：求值时排除自己，避免自指。

## 验证

| 层                                              | 结果                         | 覆盖                                                                                                                              |
| ----------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`                                  | 0 错                         | —                                                                                                                                 |
| `vitest run`                                    | **474/474**（基线 438，+36） | 定义表完整性（含图标文件真实存在、Boss key 在运行时词表内）、六种条件 kind、统计语义、奖励发放/只发一次/老存档补发、`getSnapshot` |
| `verify-achievements.mjs`（新）                 | **38/38**                    | 面板=真源、战斗事件喂统计、击杀→解锁→奖励入账、关卡结算按真实记录、面板↔存储交叉校对、`?level=5` 深链 Boss                        |
| `verify-lua-runtime-prod.mjs` P9（新）          | **16/16**                    | **生产构建**下：面板 32 条 + 32 条进度条、不再请求已删 JSON、零 404（截图 `docs/verify/lua-runtime-prod.png`）                    |
| `verify-skilltree-wiring.mjs`                   | **33/33**                    | 顺带修复（见下）                                                                                                                  |
| `verify-meta-progression` / `verify-final-wave` | 38/38 / 5/5                  | 回归无伤                                                                                                                          |

## 顺带修复：`verify-skilltree-wiring` 的「手动排波」缺陷

成就接线后该脚本长期卡在「累计经验 370 < 400」。探针实证根因在**脚本**而非产品：

1. **手动 `startWave(w)` 与引擎自身的波间过渡抢排同一波**。
   `onWaveComplete(n)` 会排定 `waveTransition = { nextWave: n+1, timer: 2.2s }` 由
   update 循环自行启动；脚本又在它到点前手动 `startWave(n+1)` → 同一波被启动两次，
   波号被回退（日志可见 `Wave 3 started` 之后又出现 `Wave 2 started`），末波永远等不到清空。
2. **用「等级上涨」当「本波已清空」的代理信号**。成就也发经验后这个信号失效——
   实测循环是被 `killer_10` 的 +50 经验骗出去的：
   370 = 2 波×100 + first_blood 20 + high_score 100 + killer_10 50，
   末波压根没完成，关卡奖励自然没发。

修复：不手动排波，只负责「关强化弹窗 + 清场上敌人」，让引擎自己的波间过渡走完
1→2→3；结束条件改为**关卡结算真的触发**（从 console 捕获
`[GameScene] Level complete: final wave cleared`——轮询 `levelCompleteFired` 不可靠，
因为关卡完成会立刻卸载 GameScene、调试钩子随之消失）。

## 已知未做（如实记录）

- 5 条 `story_complete` 成就未迁入（任务链 mission-02 依赖不存在的 `transport-ship`）。
- `highestScore`/`highestWave` 只在击杀与波次完成处上报，其他得分来源（如任务奖励分）
  不进成就统计——影响面小，未处理。
- 面板无「解锁动画/通知」，解锁只有 console 日志（奖励照发）。


---

## 2026-10-10-下一步开发方向.md

# 下一步开发方向 — Fighter Game（2026-10-10 版）

> 定稿：2026-10-10 ｜ 依据：源码全仓扫描 + `audit:assets` / `audit:dead-code` + 真实浏览器探针
> 一句话结论：**游戏「打得通」，但「成长」是断的。** 建议下一步做元进度闭环，而不是继续加美术。

---

## 一、位置

这是第 5 步，共 5 步（陪跑）。这一步只做一件事：按你现在的位置归因，给下一步。

> ✓ 想法 ／ ✓ 玩法 ／ ✓ 体量路线 ／ ✓ 清单 ／ ▶ 开工

---

## 二、先纠错：上一轮记的「技能树缺陷」是我判错了

上一轮（10-07）我把 `verify-skilltree-wiring` 的 3 项失败记成「**技能树聚合结果未被
`PlayerShip` / `WeaponSystem` 消费**」，还写进了 README 和长期记忆。**这个归因是错的。**

代码里明明有消费点（`GameScene` 每帧把 `SkillTreeManager → SkillBonusAdapter` 的结果推进
`PlayerShip` / `WeaponSystem`）。我直接跑了探针，第二局实测：

| 项目     | 期望        | 实测     | 判定 |
| -------- | ----------- | -------- | ---- |
| 生命上限 | 110（+10%） | **110**  | ✅   |
| 护盾上限 | 55（+10%）  | **82.5** | ✅   |
| 伤害倍率 | 1.05（+5%） | **1.05** | ✅   |

> 82.5 看着不像 55，其实完全对：技能加成的基线是**当前关卡**的基础护盾，第 1 关 50、
> 第 2 关 75，75 × 1.1 = 82.5。脚本写死 55 是它自己的问题。

**真实原因（脚本时序，不是产品缺陷）：**

| 证据                          | 含义                                               |
| ----------------------------- | -------------------------------------------------- |
| `canvas: false`               | 断言时 GameScene 已卸载（React 组件不在 DOM 里了） |
| `__waveDiag.ticks: 202 → 202` | PlayCanvas 的 update 回调**已经停了**              |
| `levelCompleteFired: true`    | 第 1 关只有 **3 波**，脚本清完 3 波 = **直接通关** |

脚本流程是「清 3 波 → 加点 → 读局内属性」。而第 1 关总共就 3 波 —— 清完那一刻关卡结束、
GameScene 卸载，`playerRef` 还握着**已经冻结的旧 PlayerShip**，于是读回的是加点前的 100/50/1。

`verify-final-wave.mjs` 是**同一类问题的第二个实例**：脚本里的世界（10 波）已经不存在了
（关卡制改成每关按配置波数）。这两个脚本都写于关卡系统上线之前。

**处置**：这是脚本 bug，不是游戏 bug。已在下面的清单里列为一条（约 10 行改动：
加点后重新进一关再断言）。**README 与记忆里的错误口径需要一并纠正。**

---

## 三、实测：三条成长链，一条真、两条假

把「玩家投入 → 得到回报」这条线全仓扫了一遍，结果是**一条真链 + 两条假链**：

| 链                          | 产出侧              | 消费侧                                       | 判定                  |
| --------------------------- | ------------------- | -------------------------------------------- | --------------------- |
| 波次 → 等级 → 天赋点 → 属性 | 每波 +1 级          | `SkillBonusAdapter` → PlayerShip/Weapon      | ✅ **真链**（已实测） |
| 通关 → **金币** → 商店      | 全战役共 **19,250** | 商店只扣钱 + 记 `purchasedItems`             | ❌ **断在最后一环**   |
| 通关/成就/任务 → **经验**   | 全战役共 **3,850**  | **零消费方**（代码注释自己写着"暂无消费方"） | ❌ **纯装饰**         |

### 假链一：商店（买了什么也不发生）

| 证据                                                        | 含义                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `localStorage.purchasedItems` 的唯一读取方是 ShopPanel 自己 | 只够把按钮变成「已购买 ✓」                                                 |
| `shop-item-*.json` 的 `attributes` 字段无人读               | 「重型巡洋舰：生命 200 / 护盾 100 / 速度 50 / 火力 30 / 武器位 4」是纯文本 |
| `subtype`（cruiser / stealth / dreadnought）无人读          | 换船这件事在代码里不存在                                                   |
| 全仓搜 `selectShip` / `currentShip` = 0 处                  | 没有任何"选船"入口                                                         |
| 关卡 `rewards.unlocks` 只用于 `console.log`                 | `['ship-fighter']` / `['skill-missile-strike']` … 全是装饰                 |

**算一下经济**：通关全部 10 关累计 19,250 金币。商店里最便宜的飞船 **15,000**
（重型巡洋舰），最贵的黑洞发生器 **100,000**。

→ 也就是说：**玩家把整个战役打通，刚好够买一艘船 —— 而买了什么也不会发生。**

### 假链二：经验值（界面在发，系统不收）

结算、成就面板、任务追踪都在显示 `+N EXP`（全战役 3,850）。但没有任何系统消费它 ——
等级来自**波次计数**，与 EXP 无关。属于「界面承诺了系统不兑现」。

### 顺带确认的两件事

- **生存模式**：接线完整（`verify-survival-wiring` 36/36）。
- **未接线的备用素材**：备用库里 `3d/space-station`（97 个 GLB）+ `3d/modular-space`（40 个）
  仍没接入，可作为后续把「1 站 + 1 卫星」扩成站群的料。

---

## 四、两个候选方向

|          | **A. 元进度闭环**（推荐）                            | **B. 部署体积治理**                             |
| -------- | ---------------------------------------------------- | ----------------------------------------------- |
| 解决什么 | 打完没理由再来一局；花了钱没反馈                     | 583 MB 产物发不出去                             |
| 玩家感知 | **强**（金币有去处、船能换、进度看得见）             | 无（纯可交付性）                                |
| 范围     | 商店 + EXP 两条链，各 1–2 个消费点                   | 只动 `public/`，不碰 `src/` 逻辑                |
| 实测依据 | `purchasedItems` / `attributes` / `unlocks` 零消费方 | 无消费方素材 **422.87 MB / 52,506 文件**（92%） |
| 现行数字 | 全战役 19,250 金币 vs 最便宜飞船 15,000              | `public/assets` 458.93 MB → `dist` **583 MB**   |
| 风险     | 低（新增，不改既有平衡）                             | 中（删错资源会 404；需按 LIVE 清单白名单保留）  |
| 依赖     | 无                                                   | `audit:assets` 已就绪 + 备用库可重下载          |

### 为什么推荐 A 而不是 B

B 的数字更吓人（92% 是死重量），但它是**一次性整理**，随时可做、不改玩法。
A 是**游戏本身缺的那块**：现在这个游戏"能打通"，但通关之后金币、经验、商店三样东西
一起失效 —— 玩家第二次打开的理由就没了。而且 A 里有两条是**看起来做完了但其实无效**的
功能，正是这个项目一直在猎杀的那一类缺陷。

> 若你的目标是**这周就把链接发给别人玩**，那顺序反过来：先 B（不发 583 MB），A 紧随。

---

## 五、归因表

| 症状                               | 真实原因                                                    | 处置                                               |
| ---------------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| 「打完一遍就没动力了」             | 金币唯一消耗口（商店）的产出无效；EXP 完全无消费方          | 接 A，不是加关卡                                   |
| 「商店买了没反应」                 | `purchasedItems` 无下游读取方；`attributes` 字段无人消费    | 建 `OwnedItems` 真源 + 接属性出口                  |
| 「技能树加了点没变化」（上轮记录） | **判错了** —— 是脚本在关卡通关、场景卸载后才断言            | 改脚本时序；纠正文档                               |
| 「验证脚本总有两三个红的」         | 两个脚本写于关卡系统上线之前，脚本里的"10 波世界"已不存在   | 修 `verify-skilltree-wiring` / `verify-final-wave` |
| 「构建要 2 分钟」                  | 其中约 100 秒是把 `public/`（39k 文件）原样拷进 `dist`      | B 的一部分收益                                     |
| 「仓库 583 MB」                    | `public/assets` 里 92% 体积无消费方（Kenney 全库只用到 1%） | B                                                  |

---

## 六、第一版清单

> **现在只做第 1 条。** 做完再来找我接第 2 条。

| #   | 谁做 | 做什么                                                                                           | 做完是什么样                                                       | 依赖 |
| --- | ---- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ---- |
| 1   | 你   | 定一句话规则：金币买到的东西，是**永久全局加成**（买完自动生效），还是**可选装备栏**（买完要选） | 你能用一句话说清「我买了重型巡洋舰之后，下一局会发生什么」         | —    |
| 2   | 我   | 新建 `OwnedItems` 真源（与 `CreditsStore` 同构，localStorage），`ShopPanel` 写入改到它           | 买到的东西进了一个**有下游读取方**的存储里，而不是只改自己的 UI    | 1    |
| 3   | 我   | 让已购物品折算成属性，接进现有合并点（`SkillBonusAdapter` 那一处，与技能树同一条路）             | 已购的船/模块，在下一局里能从 `PlayerShip` / `WeaponSystem` 读出来 | 2    |
| 4   | 你   | 打一局攒钱 → 买最便宜的那件 → 再进一局，看属性条/手感是否变化                                    | 你能明确说出「有变化 / 没变化」                                    | 3    |
| 5   | 我   | EXP 二选一：接进等级（替掉现在"每波 +1"），或从奖励界面**撤掉显示**                              | 不再有「界面发了、系统没收」的字段                                 | —    |
| 6   | 我   | 修 `verify-skilltree-wiring` 的时序：加点后**重新进一关**再断言；顺带修 `verify-final-wave`      | 两个脚本恢复全绿，且不再依赖"10 波世界"这个已不存在的前提          | —    |
| 7   | 我   | 纠正 README 与 `.workbuddy/memory` 里「技能树属性未生效」的错误口径                              | 仓库里的文档不再谎报缺陷                                           | —    |

**完成判据**：第 4 条是这轮的关键门 —— 只有你亲手买过一次、并且下一局真的感觉到差别，
这条闭环才算通。前 3 条我做完都只是"代码看着对"。

---

## 七、这回不做的

| 不做                                                                                                     | 为什么                                                                               |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 加新关卡 / 新敌机                                                                                        | 现在缺的不是量，是**通关之后的理由**                                                 |
| 再换一批美术素材                                                                                         | 画面上限这半年已经抬过好几轮，边际收益已很低                                         |
| 多人游戏                                                                                                 | `MultiplayerSystem`（956 行）+ `MultiplayerClient`（426 行）都是**死代码**，且无后端 |
| `host: true` 的 4 个 Lua 模块迁移                                                                        | 纯工程内部，玩家零感知，与"能不能玩"无关                                             |
| 20 个死文件 / 8,587 行清理（含 `LevelEditor` 1081 行）                                                   | 锦上添花，等 A 做完再说                                                              |
| 11 个「只被测试引用」的文件（`ResourceManager` 672 行、`SecuritySystem` 421 行、`InputManager` 401 行…） | 现在的状态是**测试在测生产不可达的代码**，属独立议题                                 |
| 把 `public/assets` 全量瘦身（方向 B）                                                                    | 除非你决定这周就发布；否则排在 A 之后                                                |

---

## 八、我替你定的三项（惯例·可改）

1. **金币买到的东西默认走「永久全局加成」** —— 不引入装备栏 UI，改动最小。
   —— 改法：也可以选「可选装备栏」（要加一个选择界面）或「只做外观涂装」。
2. **先把商店接活，EXP 只做"不再骗人"**（撤显示或简单接进等级），不做完整经验曲线。
   —— 改法：也可以把 EXP 做成真正的等级来源，替换现在的"每波 +1"。
3. **不新增任何美术/音频/关卡** —— 这轮只做接线与纠错。
   —— 改法：也可以顺手把备用库的 `space-station`（97 个 GLB）接进来扩场景。

---

## 九、还差你拍板的

- **买船之后是什么效果**：全局永久加成（最简单）／ 可选装备栏／ 只换外观？
- **金币价格要不要调**：现在打完全战役 19,250，只够买最便宜那艘船 —— 是"设计如此"（长期目标），还是该整体下调？
- **EXP**：撤掉显示，还是接成真正的等级来源？
- **要不要顺带做方向 B**（583 MB → 约 160 MB）？还是先只做 A？

---

## 附：本次扫描用到的判据（下次可复用）

```
1. "功能是不是假的"最快判据：查它的存储/输出有没有**下游读取方**。
   grep 写入端 → 看读取端是不是只有它自己（ShopPanel 读 purchasedItems 只为了改按钮文字）
2. 数据字段有没有人用：grep 字段名（attributes / subtype / unlocks），0 处 = 装饰
3. 经济闭环算总账：把产出侧全加起来（19,250），除以最便宜的道具（15,000）= 1.28
   —— 这个比值直接告诉你"玩家能不能摸到"
4. 断言读到的值是不是活值：先看承载它的场景还在不在（canvas 在不在、tick 还在不在）
   —— `__waveDiag.ticks` 停在某个值不动 = PlayCanvas 的 app 已经 destroy 了
5. 脚本的假设要跟着系统演进复核：写脚本时的"10 波世界"现在是"每关 3 波"
```


---

## 2026-10-10-元进度闭环.md

# 元进度闭环：商店买到的东西，下一局真的生效

> 定稿：2026-10-10 ｜ 方向 A（`docs/2026-10-10-下一步开发方向.md` 推荐项）
> 一句话规则：**金币买到的东西是永久全局加成 —— 买完自动生效，下一局就带上。**

---

## 一、改之前：三条成长链，一条真、两条假

上一轮把「玩家投入 → 得到回报」这条线全仓扫了一遍，结论是一真两假：

| 链                          | 产出侧              | 消费侧                                  | 改前判定            |
| --------------------------- | ------------------- | --------------------------------------- | ------------------- |
| 波次 → 等级 → 天赋点 → 属性 | 每波 +1 级          | `SkillBonusAdapter` → PlayerShip/Weapon | ✅ 真链（已实测）   |
| 通关 → **金币** → 商店      | 全战役共 **19,250** | 商店只扣钱 + 记 `purchasedItems`        | ❌ **断在最后一环** |
| 通关/成就/任务 → **经验**   | 全战役共 **3,850**  | 零消费方（代码注释自陈"暂无消费方"）    | ❌ **纯装饰**       |

两条假链的判据都很硬：

- `localStorage.purchasedItems` 的**唯一读取方是 ShopPanel 自己**（只够把按钮变成
  「已购买 ✓」）；`shop-item-*.json` 的 `attributes`（生命/护盾/速度/火力）全仓无人读；
  `subtype`（cruiser/stealth/dreadnought）无人读；全仓搜 `selectShip` / `currentShip` = **0 处**。
- 经验：结算/成就/任务界面都在显示 `+N EXP`，但等级来自**波次计数**，与经验无关。

后果：**打通全战役攒到的 19,250 信用点，买下最便宜那艘 15,000 的船，下一局什么也不发生。**

---

## 二、改了什么

### 2.1 新增三个模块（各自单一职责）

| 模块                        | 职责                                                              | 存储                      |
| --------------------------- | ----------------------------------------------------------------- | ------------------------- |
| `src/engine/OwnedItems.ts`  | 已购物品**唯一真源**（含属性快照 + 旧 key 一次性迁移 + 自检护栏） | localStorage `ownedItems` |
| `src/engine/MetaBonuses.ts` | 已购物品 → 属性加成的**唯一换算表**，并合并进战斗修饰符           | 无（纯函数）              |
| `src/engine/Experience.ts`  | 经验 → 等级的**唯一曲线**（纯函数）                               | 无（纯函数）              |

三个模块都在文件头写清了「为什么」，并且各自带一份防漂移护栏：

- `OwnedItems.getOwnedItemsStorageIssues()` —— 单测断言它为空。旧 key 复活、
  有类型却没属性快照（会导致加成静默消失）都会被报出来。
- `MetaBonuses` 的换算表 + 倍率夹取（0.1 ~ 10）—— 策划写错数量级不会让玩家得到荒谬属性。
- `Experience` 的曲线 + **关卡解锁门槛可达性**用例 —— 以后调曲线时，测试会直接指出
  是哪一关变得开不了，而不是等玩家玩到那儿才发现。

### 2.2 收口改造

| 位置                     | 改前                                       | 改后                                                      |
| ------------------------ | ------------------------------------------ | --------------------------------------------------------- |
| `ShopPanel.tsx`          | 扣钱 + 写 `purchasedItems`（无下游）       | 扣钱 + `grantOwnedItem(属性快照)`；新增「已购加成条」     |
| `ShopPanel.tsx` 消耗品   | 能买、买完什么也不发生                     | 标「即将开放」并禁用（没有背包系统就不该卖）              |
| `GameScene.tsx` 合并点   | 局内三选一 + 技能树                        | 再加一层**元进度（最外层乘区）**                          |
| `GameScene.tsx` 升级     | `setPlayerLevel(level + 1)`（波次计数）    | `addExperience(EXP_PER_WAVE)`，等级**由经验推导**         |
| `GameScene.tsx` 关卡结算 | 信用点真入账、经验只 `console.log`         | 两者都真入账（经验走同一个 `addExperience`）              |
| `GameScene.tsx` 任务奖励 | 只显示、不发放                             | `subscribe` 差分识别新完成任务 → 经验 + 信用点入账        |
| `PlayerShip.ts`          | 主色硬编码 `[0.2,0.5,0.8]`                 | 接受 `tint`（涂装），程序化模型与 GLB tint 共用同一个颜色 |
| `useGameStore.ts`        | 只持久化 `player.{score,level}`            | 加 `experience`（元进度真源），并按曲线反推老存档         |
| `useGameStore.ts` / HUD  | store 的 `maxHealth/maxShield` 恒为 100/50 | 新增 `setPlayerMaxHealth/Shield`，每帧先推上限再推当前值  |

### 2.3 合并顺序（写死）

```
局内三选一（BuildSystem） → 技能树（SkillBonusAdapter） → 元进度（MetaBonuses）
```

顺序只影响浮点末位，但固定下来才好推理：元进度是「永久全局加成」，语义上就该在最外层再乘一次。

---

## 三、换算表（唯一真源：`MetaBonuses.ts` 文件头）

| 商店字段      | 通道                       | 语义     | 换算                 |
| ------------- | -------------------------- | -------- | -------------------- |
| `health`      | `maxHealthBonus`           | 生命上限 | **绝对值** `+= v`    |
| `shield`      | 护盾上限                   | 护盾上限 | **绝对值** `+= v`    |
| `speed`       | `maxSpeedMultiplier`       | 移动速度 | 百分比 `×(1+v/100)`  |
| `damage`      | `damageMultiplier`         | 武器伤害 | 百分比 `×(1+v/100)`  |
| `fireRate`    | `fireRateMultiplier`       | 射击间隔 | `÷v`（v=2 → 快一倍） |
| `weaponSlots` | `weaponSlotsBonus`         | 武器槽位 | `+= v`（仅记录）     |
| `damageBonus` | `damageMultiplier`         | 伤害     | 分数 `×(1+v)`        |
| `shieldBonus` | `maxShieldMultiplier`      | 护盾上限 | 分数 `×(1+v)`        |
| `speedBonus`  | `maxSpeedMultiplier`       | 速度     | 分数 `×(1+v)`        |
| `energyBonus` | `maxBoostEnergyMultiplier` | 加速能量 | 分数 `×(1+v)`        |

口径说明：

1. 生命/护盾走**绝对值**，因为商店卡片写的就是「生命: +200」「护盾: +100」，按字面兑现。
   速度/伤害没有可加的标量，按百分比理解 —— **UI 也同步补了 `%` 后缀**，
   避免出现「卡片写 +50、实际是 +50%」这种界面骗人。
2. `fireRate` 是每秒发数（plasma=2、sniper=0.5），1 为中性，所以「射速加倍 = 间隔减半」，
   与 `WeaponModifiers.fireRateMultiplier` 的极性一致。
3. `weaponSlots` **只记录不消费**：本作 `WeaponSystem` 没有槽位概念，不假装它能生效。
4. 消耗品不进入数值换算（无背包系统），涂装走 `getOwnedHullTint()`（贴图名 → 主色）。
5. 护盾顺序：**先加舰体绝对值，再乘模块倍率** —— 「买船给的护盾也享受护盾模块加成」
   比反过来更符合直觉。

经验曲线（`Experience.ts`）：1~4 级每级 100 点（= 1 波，与旧的「每清一波 +1 级」**数学等价**），
5 级起步长 200 点（抑制天赋点通胀）。这样改等级来源**不会顺带改动**已有的成长节奏与关卡解锁时机。

---

## 四、验证证据（都是生产路径上的真实读数）

### 4.1 单元测试

```
npx vitest run      → 28 文件 / 438 用例全绿（基线 389，本次 +49）
npx tsc --noEmit    → 0 错
```

新增 49 例分三份：`OwnedItems.test.ts`（16）/ `MetaBonuses.test.ts`（21）/ `Experience.test.ts`（12）。

### 4.2 元进度闭环 e2e（`scripts/verify-meta-progression.mjs`，**38/38**）

一遍跑完 A→D 四段，每一段都读生产路径上的真实对象：

| 段  | 做了什么                                       | 断言到的真实值                                                                       |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| A   | 空手进商店                                     | 「已购 0 件 / 暂无永久加成」；消耗品标「即将开放」且无购买按钮                       |
| B   | 买「伤害强化模块」(10000) → 进第 1 关          | `WeaponSystem.buildMods.damageMultiplier = 1.1`；生命 100 / 护盾 50 不受影响         |
| C   | 模拟攒钱 → 买「重型巡洋舰」+「红色涂装」→ 再进 | 生命 **300**、护盾 **150**、伤害 **1.43**、速度倍率 **1.5**、主色 `[0.78,0.18,0.18]` |
| D   | 预置旧 `purchasedItems` → 重载                 | 商店仍显示「已购 1 件」，旧 key 被清掉，迁移记录**不假装**已生效                     |

D 段的读数是**从 `PlayerShip` / `WeaponSystem` 内部状态读出来的**，不是元进度自己的自述 ——
这是「加成真的走到了战斗系统」而不是「函数算得对」的区别。

C 段还顺手抓出并修掉了一个**会让玩家「买完看不见变化」**的 HUD 缺陷：
`useGameStore.player.maxHealth/maxShield` 恒为默认 100/50，而
`updatePlayerHealth/updatePlayerShield` 会**按 store 里的上限夹取** ——
于是真值已经是 300/150，HUD 属性条却还停在「100/100」「50/50」。
修法：新增 `setPlayerMaxHealth/Shield`（值不变时不写 state，避免每帧无谓重渲染），
每帧**先推上限、再推当前值**。现在脚本断言 HUD 文本里确实出现 `HP 300/300` 与 `Shield x/150`。

另外该脚本还断言了一行 console：`[GameScene] 元进度：已购 3 件，加成 [...]` ——
这条日志**不在 `import.meta.env.DEV` 分支里**，生产构建同样会打印，见 4.4。

### 4.3 两个陈旧脚本的修复

| 脚本                      | 问题                                                        | 处置                                                       | 结果              |
| ------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- | ----------------- |
| `verify-skilltree-wiring` | 通关（场景已卸载）后才读属性，读到冻结的旧 `PlayerShip`     | 加点后**重新进第 1 关**再断言；改为绝对断言 + 证明陷阱存在 | 25/28 → **30/30** |
| `verify-final-wave`       | 写死 `startWave(9)` / `wave >= 10`，而世界已是「每关 3 波」 | 一律从 `getState().totalWaves` 推导                        | ❌ → **5/5**      |

> ⚠ **上一轮把技能树这三项失败归因成「加成未被消费」，那是误判。**
> 真凶是脚本时序：第 1 关只有 3 波，清完 3 波 = 直接通关 → GameScene 卸载 →
> `__waveDiag.ticks` 冻结、`playerRef` 握着旧对象。重进一关后三项全达标
> （生命 110、护盾 55、伤害 1.05）。README 与长期记忆里的错误口径已一并纠正。

### 4.4 生产构建

```
rm -rf dist && npx vite build      （约 2 分钟，其中 ~100s 是把 public/ 拷进 dist）
npx vite preview --port 4180 --strictPort
NO_PROXY=localhost,127.0.0.1 VERIFY_URL=http://localhost:4180/ node scripts/verify-lua-runtime-prod.mjs
```

结果 **11/11**（原 7 项 Lua 证据全绿 + 新增 P8/P8b）。P8 段的证据是这行生产日志：

```
[GameScene] 元进度：已购 2 件，加成 [生命 +200 / 护盾 +100 / 速度 +50% / 伤害 +43% / 武器槽 +4]
```

脚本用 `addInitScript` 预置两件已购物品（巡洋舰 + 伤害强化模块），等价于「玩家刚买完」，
于是生产构建下元进度的整条读取路径都被真的走到，而不是只证明「函数在 dev 里算得对」。

### 4.5 既有 e2e 回归

`verify-level-system`、`verify-wave-plans`、`verify-survival-wiring`（36/36）、
`verify-lua-ai`、`verify-arena-bounds`（14/14）、`verify-icon-wiring` —— 全绿。

---

## 五、这一轮不做（明确记录，别当成漏了）

| 不做                                   | 为什么                                                                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 装备栏 / 换船 UI（`selectShip`）       | 本轮口径是「永久全局加成」，不做选择界面。已购的船直接生效                                                                                                                                                              |
| 消耗品（背包 + 使用时机）              | 需要一套局内道具栏。当前**没有卖**它（标「即将开放」），而不是卖了不生效                                                                                                                                                |
| 成就面板的 EXP                         | 它是**另一套平行数据**：面板读 `/assets/achievements/*.json`，而运行时 `AchievementSystem` 用的是另一份定义（`reward.score`）；且 `localStorage.unlockedAchievements` **全仓没有任何写入方** → 面板永远全锁。属独立议题 |
| `rewards.unlocks` 真正解锁飞船/技能    | 现在仍只 `console.log`。它是「解锁内容」而非「数值加成」，与元进度是两件事                                                                                                                                              |
| 部署体积（方向 B，583 MB → 约 160 MB） | 排在 A 之后，见 `audit:assets`                                                                                                                                                                                          |

---

## 六、复用的判据（下次还能用）

```
1. "功能是不是假的"最快判据：查它的存储/输出有没有**下游读取方**。
   grep 写入端 → 看读取端是不是只有它自己。
2. 数据字段有没有人用：grep 字段名（attributes / subtype / unlocks），0 处 = 装饰。
3. 界面上的单位必须与换算表一致：卡片写「+50」而实际是「+50%」也是一种骗人。
4. 读属性前先确认承载它的场景还活着（canvas 在不在、tick 还在不在）——
   `__waveDiag.ticks` 停在某个值不动 = PlayCanvas 的 app 已经 destroy。
5. 改「来源」（等级从哪来）时必须先算一遍旧节奏，否则会顺手改掉关卡解锁时机。
   本轮的护法是 `Experience.test.ts` 的门槛可达性用例。
```


---

## 2026-10-12-NAS部署与一键脚本.md

# NAS 部署与一键脚本（2026-10-12）

## 一、这次做了什么

1. `git push`（实际本地已与远端同步在 `4a2da113`，无待推送提交）。
2. 把**最新构建**推到 NAS，替换 `http://192.168.1.45:8095` 上的旧版。
3. 新增 `scripts/deploy-nas.mjs`：把这次靠手敲的命令固化成可重复执行的一条链。

**为什么值得单独推一次**：上一轮修的「生产构建 Lua 运行时靠 unpkg 取 wasm、断网即静默死掉」
是个**只在离网环境暴露**的缺陷——NAS 正是离网/内网环境。也就是说线上那套在修复前
Lua 一直是死的，而本地 `dev` 一切正常。这条只能靠部署到 NAS 才能证伪。

## 二、部署结果

| 项       | 值                                                              |
| -------- | --------------------------------------------------------------- |
| 产物     | 231.1MB / 53,354 个文件                                         |
| 传输     | 单流 tar.gz，**2.8 秒**（82.5MB/s）                             |
| 完整性   | md5 双端一致（`b3a00ac5…`）                                     |
| 切换     | `site` → `site.bak` 保留，新产物就位，容器重启并自检 `http=200` |
| 线上入口 | `/assets/index-Cb8fDXIj.js`                                     |
| 线上验证 | `verify-lua-runtime-prod` **16/16**                             |

16/16 里两条是这轮的重点：

- `[LuaEngine] 真实 Lua 运行时已启用（Lua 5.4，13 个 .lua 模块可 require）`
  → 上一轮的 wasm 随包发布修复**确实上线了**。
- HUD 文案含 `Q 导弹打击 E 护盾爆发 T 时间减缓 G 过载驱动`
  → 本轮新增的技能名标注**也上线了**。

## 三、脚本怎么用

```bash
node scripts/deploy-nas.mjs              # 构建 + 传输 + 切换 + 验证
node scripts/deploy-nas.mjs --no-build   # 复用现有 dist/
node scripts/deploy-nas.mjs --dry-run    # 只构建打包看体积，不碰 NAS
```

覆盖项：`NAS_HOST` / `NAS_DIR` / `NAS_URL` / `NAS_CONTAINER` / `KEEP_BACKUP=0`。

脚本链：**构建 → 单流打包 → 传输入远端 → md5 校验 → 解压到 `site.new` → 产物自检（入口 /
assets / wasm）→ 切目录（旧版留 `site.bak`）→ `docker restart` → 容器自检 → 浏览器侧探测**。

失败即中止：任何一步非零退出都不继续往下切目录，所以**线上不会出现半成品**。最后打印回滚命令。

## 四、这轮踩的三个坑（都写进脚本注释了）

### 1. `tar -czf C:\...` 被当成远程归档

```
tar (child): Cannot connect to C: resolve failed
```

GNU tar 把归档参数里的 `host:path` 当远程语法，Windows 盘符 `C:` 正好命中。
**修法**：归档名与 `-C` 都用相对路径（脚本里 `cwd` 已设为仓库根）。

### 2. 换完目录必须重启容器

静态站的 compose 是 `./site:/usr/share/nginx/html:ro`。**bind mount 绑的是目录 inode**，
`mv site site.bak && mv site.new site` 之后容器仍指向旧 inode →
现象是「部署脚本说成功了，页面一点没变」。所以切换后必须 `docker restart` 重新解析挂载。

（这也是为什么不能简单地「解压覆盖」了事：覆盖虽不用重启，但带 hash 的旧资源会无限堆积。）

### 3. playwright 探针的两个陷阱

- 探针脚本写在系统临时目录 → `ERR_MODULE_NOT_FOUND: playwright`。
  **ESM 解析依赖是按脚本文件自身位置向上找 `node_modules`，不看 cwd**。必须写在项目内。
- 必须 `executablePath` 钉 `chromium-1228`：Playwright 包要 `chromium-1234`，本机只装了 1228，
  不钉就报 `Executable doesn't exist`。全部 `verify-*.mjs` 都这么做，保持一致。

## 五、还留着的

- NAS 上 `site.bak` 是旧版（约 500MB，供回滚）。确认新版稳定后可删：
  `KEEP_BACKUP=0 node scripts/deploy-nas.mjs`，或手动 `rm -rf site.bak`。
- 备用库 Quaternius 那批素材仍在等 Google Drive 的 24h 公共配额刷新，之后重跑
  `node scripts/fetch-asset-reserve.mjs` 补抓。
- 上一轮遗留待你拍板：**导弹打击一次发两轮**（5 + 2×等级，实发两倍）是否改成一轮
  （改则动平衡）；**`rewards.unlocks` 是否接成真链**（把「通关解锁」从 `console.log`
  变成真解锁商店物品/技能）。


---

## 2026-10-12-操作手感与技能条标注.md

# 操作手感与技能条标注（2026-10-12）

> 起因是两条玩家反馈：**「技能名称要备注上」**（技能条只有图标，看不出哪个是哪个）
> 和 **「操作的感觉太僵硬」**。两条都修完，且都上了可测护栏。

---

## 一、技能条名称标注 + 「激活中」高亮接线

### 问题

- 技能条四个槽位里只有图标 + 键位字母，冷却中一起变灰时完全分不出谁是谁。
- `SkillInfo.isActive` 恒为 `false`：界面上有一套「激活中」的黄框高亮样式，
  但数据永远是假的 —— 又一个「界面写了、线没接」的死字段。

### 修法

- `GameHUD.SkillBar`：每个槽位下方加技能名小标签（`data-testid="skill-name-N"`），
  名字来自 `skillSlots` 真源（HUD 不写死字符串），按钮带 `title` 悬浮说明。
- `useGameStore.skills` 增 `active: Record<SkillSlotKey, boolean>` + `setSkillActive`；
  值没变时返回原 state，zustand 用 `Object.is` 整帧跳过通知，GameScene 逐帧调用无渲染代价。
- `GameScene` 每帧把 `SkillSystem.getActiveSkills()` 同步进 store；
  HUD 的 `isActive` 从 store 读真值 —— 激活时按钮亮黄框 + 名称变黄。

## 二、操作手感：旋转从「开关式」改成「惯性式」

### 僵硬的数据级真因（`PlayerShip.updateRotation`）

1. **旋转是开关式的**：`rotateLocal(输入 × 角速度 × dt)` —— 键盘是 0/1 信号，
   按下瞬间满速 540°/秒、松手瞬间归零。起步一个硬拐点、停转没有过渡、无法微调，
   像用鼠标拖一个方块。
2. **俯仰倍率乘了两次**：`pitchSpeed × effRot`，而 `effRot` 里已含 `rotationSpeed(3)`，
   实际 1080°/秒 = 偏航的两倍，与字段注释「俯仰 2.0 < 偏航 3」的意图正好相反。
3. **boost 是硬台阶**：`canBoost` 一为真速度立刻 ×2.5，起步那一下画面被"顶"一下。

### 修法（三处，全部集中在 PlayerShip）

- **一阶惯性**（`angularSmoothing = { rise: 24, fall: 13 }`）：输入先变成「目标角速度」，
  实际角速度用指数逼近追它。按键约 90ms 爬升、松手约 230ms 滑行；
  **稳态角速度不变** —— 物理平衡、最大速率、天赋倍率全部没动，改的只是过渡曲线。
- **固定子步进**：把本帧切成 ≤1/60s 的小片逐片逼近。不做这一步，惯性是帧率相关的
  —— dt 一大（掉帧、低端机）`1-exp(-24×0.1)≈0.91` 一帧到位，「顺滑」恰好在最需要它的
  机器上先消失。单帧总推进量钳 100ms（切标签页回来时不会空转几十步）。
- **俯仰口径修正**：360°/秒（原先 1080°/秒），三轴同一口径「基准角速度 × 倍率」。
- **boost 倍率渐入渐出**（`boostBlend`，时间常数 125ms，同样钳步长）。

## 三、护栏（手感必须可测，不能只靠"感觉顺了"）

- **新脚本 `scripts/verify-flight-feel.mjs`（12/12）**：在页面内用 rAF 采
  `__playerDebug.angularVelocity` 时间序列，断言——
  - 稳态角速度 ≈ 540°/s（偏航）/ 360°/s（俯仰）：**只改了过渡、没动平衡**；
  - 爬升 54ms、滑行 259ms（理论 90/230ms，量化误差内吻合）：**不是一帧跳变**；
  - 滑行中间值 ≥ 2 个：**渐变而非阶跃**（这条与采样率无关，最硬）；
  - 俯仰不再快于偏航；按 W 真的位移；无控制台错误。
  - 环境注记：无头 SwiftShader 是软渲染，1280×720 只有 ~10fps 采不到爬升段，
    脚本用 800×450 视口把帧率顶到 ~19fps；帧率过低时爬升断言自动降级并说明。
- **`verify-skill-activation.mjs` 52 → 68 项**：新增「HUD 技能名 === 真源名字（逐字比对，
  不硬编码）」+「点击后 store.active 同步为真」+「按钮进入高亮态」。
- `__playerDebug` 增 `angularVelocity / finalSpeed / boostBlend`（手感可测真值）；
  `SkillSystem.getSlotSnapshot()` 增 `name`（真源名字，供 e2e 比对）。

## 四、验证总账

| 验证                              | 结果                 |
| --------------------------------- | -------------------- |
| `tsc --noEmit`                    | 0 错                 |
| `vitest run`                      | **489/489**          |
| `verify-flight-feel.mjs`（新）    | **12/12**            |
| `verify-skill-activation.mjs`     | **68/68**（52 → 68） |
| `verify-arena-bounds.mjs`（回归） | 14/14                |

## 五、调手感只动两个数

`PlayerShip.angularSmoothing`：`rise`（按键爬升速率，越大越跟手）与 `fall`
（松手滑行速率，越小越飘）。当前 24/13 ≈ "90ms 爬升、230ms 滑行"。
想更跟手就加 rise，想更飘就减 fall。


---

## 2026-10-12-导弹打击真伤害接线.md

# 导弹打击接成真伤害（伤害 7.5）

> 2026-10-12。范围：**只接「导弹打击」一个技能**。时间减缓 / 过载驱动的效果层仍然是空的，
> 见文末「遗留」。

## 一、接线前：技能对战斗毫无影响

`SkillSystem.ts` 全文 634 行里，`damage` 这个词出现 **0 次**。敌人受伤的唯一入口
`Enemy.takeDamage()` 全仓只有一个调用方：`WeaponSystem.ts:511`（子弹）。技能从不调它。

| 技能     | 冷却 / 持续 | 代码里的真实效果                                                | 判定 |
| -------- | ----------- | --------------------------------------------------------------- | ---- |
| 导弹打击 | 15s / 2s    | 7 枚锥体飞出 + 爆炸粒子，**无伤害**                             | 装饰 |
| 护盾爆发 | 20s / 0.5s  | `player.addShield(50 + level×25)`                               | 真   |
| 时间减缓 | 30s / 5s    | 无（`getTimeScale()` 全仓零调用方）                             | 装饰 |
| 过载驱动 | 25s / 4s    | 无（`getSpeedMultiplier()`/`getFireRateMultiplier()` 零调用方） | 装饰 |

而 HUD 上写着「发射多枚导弹攻击前方敌人」「减缓所有敌人的移动和攻击速度」
「大幅提升移动速度和武器射速」—— 三条都是假的。

**为什么 68/68 的 e2e 没抓到**：`verify-skill-activation.mjs` 断的是「冷却写入」
「store.active 同步」「HUD 高亮」「技能名 DOM」——全是**状态链路**，一条都没断言效果。
这是本项目第三个同类盲区（前两个：`.lua` 取源、wasm 取源）。

## 二、这次改了什么

### 1. 真源：`SkillWorld` 结构化注入口（不 import EnemySystem）

```ts
export interface SkillDamageTarget {
  isAlive(): boolean;
  getPosition(): pc.Vec3;
  takeDamage(amount: number): void;
}
export interface SkillWorld {
  enemiesInRadius(center: pc.Vec3, radius: number): SkillDamageTarget[];
}
```

写成**结构化接口**而不是 `import type { Enemy }`：技能模块只需要「活着吗 / 在哪 / 挨打」
三件事，引入 `Enemy` 会把整条刷怪/模型链拖进来。`Enemy` 天然满足这三个方法，匹配由编译期保证。

`GameScene` 注入（闭包读 `enemySystemRef.current`，保证查的是此刻场上的敌人）：

```ts
world: {
  enemiesInRadius: (center, radius) =>
    (enemySystemRef.current?.getEnemies() ?? []).filter(
      (enemy) => enemy.isAlive() && center.clone().sub(enemy.getPosition()).length() <= radius,
    ),
}
```

**`world` 为空时技能只播特效、不结算伤害** —— 技能模块不能假设场上一定有敌人系统
（单测、未接线的场景都走这条路）。

### 2. 数值（唯一的调参处）

```ts
public static readonly EXPLOSION_DAMAGE = 7.5;   // 单枚导弹爆炸伤害（用户指定）
public static readonly EXPLOSION_RADIUS = 12;    // 爆炸半径（世界单位）
```

口径：**等级只增加导弹数量（`5 + level × 2`），不改单发伤害**。
这样「一次施放的伤害上限」随等级线性增长，而单发数值是一个可断言的真值。
（HUD、e2e 都从这里读，不许另抄一份。）

半径 12 的依据是刷怪几何，不是手感偏好：导弹落点在玩家前方 50、横向铺开 ±10，
敌人自 40~60 的环上刷出 —— 12 让相邻导弹的爆炸圈连成一片，又不至于一发覆盖全场。

### 3. 伤害结算抽成纯函数

```ts
export function applyExplosionDamage(targets, damage): { hits: number; damage: number };
```

抽出来是为了能在 Node 下单测：`explodeMissile` 里满是 `new pc.Entity()`，
出了浏览器就跑不了；但「谁挨打、挨几点」不该被浏览器绑死。

**发放值 ≠ 掉血量**：`Enemy.takeDamage` 内部还要扣 `armor × 0.5` 且至少造成 1 点。
两者故意分开，免得 e2e 用发放值去对掉血量。

### 4. 堵掉「幽灵第二轮」

旧闸门是 `if (this.missiles.length > 0) return;`。导弹在 1.5s 全部爆炸
（每枚从数组 `splice` 掉）→ 数组清空 → 持续期还剩 0.5s → **下一帧又补发一轮 7 枚**。
第二轮飞出去 0.5s 后随 `endSkill()` 被销毁，既不爆炸也不造成伤害。

那时技能没有伤害，所以「多发一轮空包弹」只算浪费；现在有真伤害了，
玩家会看到「第二轮打出去毫无反应」。改成 `if (this.fired)`，
在 `endSkill()` 里复位（「一轮」的边界就是持续期，写成同一个事实）。

### 5. 顺带修掉帧率相关行为（位置 + 引爆都改由帧驱动）

旧实现在同一件事上用了两套 wall-clock 机制，**都与真实帧间隔无关**：

- 位置：`setInterval(16ms)` + 固定位移 `30 × 0.016`
- 引爆：`setTimeout(1500ms)`

60fps 下恰好等价于 30 单位/秒，看着没问题。但实测无头浏览器（SwiftShader ~10fps）里
1.5s 只飞了约 **7 单位**（应为 45），引爆时点也被主线程拖后（e2e 实测：持续期已过 0.1s
仍有 3 枚没爆）。这与项目里「惯性必须帧率无关」是同一条纪律。

现在：

- `advanceMissiles(dt)` 每帧推进位置，**计时用真实 dt、位移钳到 0.1s**
  （计时若也被钳，连续低帧率下累计会变慢，导弹迟迟不爆、最后被 `endSkill()` 直接收走）；
- 引爆判据是 `missileElapsed[i] >= 1.5`，倒序遍历（`explodeMissile` 会 splice）。

**附带修好一个口径**：游戏暂停时技能不再推进 → 导弹既不会飞也不会爆。
旧实现里暂停期间 `setTimeout` 照常到期，回来时会一次爆完。

### 6. 清掉一个死字段

`targetPositions` 只被 `push`、**从来没有人读** —— 典型装饰字段。
方向（`missileDirections`）才是帧推进真正需要的东西，于是用它顶掉。
`missileElapsed` 也是平行数组，三者进出场同步 `splice`（错位一次就会串位）。

### 7. 效果层观测口

`window.__skillDebug.missile()` → `{ explosions, hits, damage, explosionDamage, explosionRadius, missilesInFlight }`。
`window.__waveDebug.placeEnemy(i, x, y, z)` 是**唯一会改世界状态**的调试钩子，
只搬位置、绝不碰血量或存活状态（掉血必须由技能自己造成）。

## 三、验证

**单测 507 → 513**（新增 `src/engine/SkillSystem.test.ts` 6 项：命中数/伤害合计/跳过死亡目标/
空列表/单次结算/伤害真值 7.5 与半径下限）。`tsc` 0 错。

**新脚本 `scripts/verify-skill-damage.mjs` 18/18**：

```
✅ 单发爆炸伤害 7.5 / 爆炸半径 12（从 SkillSystem 读，不抄数字）
✅ 效果层读数：爆炸 7 次 / 命中 9 次 / 发放伤害 67.5
✅ 飞行路径敌人血量合计：60 → 0（子弹命中数 0 → 0）
✅ 发放伤害 === 命中数 × 7.5
✅ 敌人的血量真的下降了
✅ 1.6s 后仍在飞的导弹数（采样）
```

两处关键设计：

1. **敌人铺成 38 / 44 / 50 三个采样点**，不是赌一个精确落点：实际爆点在前方 45 上下浮动，
   铺成一段无论爆点落在哪都有敌人在半径里。
2. **归因**：脚本全程不给任何输入 → 玩家不开火 → 用「窗口内子弹命中数没变」
   把「掉血」锁死在技能身上。实测 3 个敌人（合计 60 血）全灭，而 `shotsHit` 全程为 0。

**反向验证（护栏有效性）**：把闸门临时改回 `missiles.length === 0`，重跑 →
`❌ 1.6s 后仍在飞的导弹数: 实得=7 期望=0`。说明这条断言真能抓到幽灵轮，不是假护栏。

**既有 e2e 零连带失败**：`verify-skill-activation` 68/68、`verify-unlocks` 69/69、
`verify-meta-progression` 38/38、`verify-achievements` 38/38、`verify-skilltree-wiring` 33/33。

**生产链**（`vite build` + `vite preview`）`verify-lua-runtime-prod` 16/16。

## 四、遗留

- **时间减缓 / 过载驱动的效果层仍然是空的**。`getTimeScale()` / `getSpeedMultiplier()` /
  `getFireRateMultiplier()` 依旧零调用方，HUD 上那两句描述依旧是假的。
  建议按同样的三步走：先接线、再调数值、最后补效果层 e2e。
  现成的接线点都在每帧热路径上，不必新建系统：
  - 时间减缓 → `GameScene` 每帧 `skillSystem.update(dt)` 旁边取 `getTimeScale()` 乘进敌机 dt
  - 过载驱动 → `player` 的 boost 与 `WeaponSystem` 的射速
- **数值需要人定**：时缓慢几倍、过载快几倍，直接决定打起来是什么手感。
- **导弹的落点是硬编码的世界 `-Z` 方向 50 处**，不随玩家朝向旋转
  （「攻击前方敌人」只在玩家朝世界 -Z 时字面成立）。这次没动它，但口径要记着。
- 上一轮遗留：NAS 上 `site.bak`（约 546MB 回滚备份）留还是删 —— 实测重建一次
  是「构建 2.5 分钟 + 部署 4 秒」，建议留着当秒级回滚路径。


---

## 2026-10-12-技能激活口径统一与静默失效修复.md

# 技能激活口径统一与静默失效修复（2026-10-12）

> 一句话结论：**4 个战斗技能里有 3 个在 HUD / 触屏路径上点了没反应，而控制台一声不响。**
> 根因是「同一个技能 id 在三处各写一套」，加上一处 `as SkillType` 强转绕过了类型检查。
> 修复过程中又连带抓出一个：导弹技能会在引擎销毁后继续开火，每次打击产 10 条未捕获异常。

---

## 一、位置

这是第 5 步，共 5 步（陪跑）。这一步只做一件事：修掉上一步扫出来的接线缺陷，并给它上护栏。

> ✓ 想法 ／ ✓ 玩法 ／ ✓ 体量路线 ／ ✓ 清单 ／ ▶ 开工

---

## 二、缺陷一：技能 id 三套口径（主缺陷）

### 症状

点 HUD 技能条上的「护盾爆发 / 时间减缓」，屏幕没有任何反应、冷却条却开始转；
只有「导弹打击」和键盘 Q/E/T/G 是好的。

### 证据链

| #   | 事实                                                                         | 位置                           |
| --- | ---------------------------------------------------------------------------- | ------------------------------ |
| 1   | 枚举定义是 camelCase：`MISSILE_STRIKE = 'missileStrike'`                     | `SkillSystem.ts:6`             |
| 2   | 触屏回调传 snake_case 字符串：`activateSkill('missile_strike' as SkillType)` | `GameScene.tsx:323`（共 4 处） |
| 3   | HUD 槽位表同样是字符串数组，且带 `as SkillType[]`                            | `GameScene.tsx:2006-2010`      |
| 4   | 查表按枚举值做键：`this.skills.set(skill.getConfig().type, skill)`           | `SkillSystem.ts:407`           |
| 5   | miss 时**静默** `return false`                                               | `SkillSystem.ts:385`           |
| 6   | 冷却无条件写入，与是否激活无关                                               | `GameScene.tsx:324`            |

合成结果：**对象只以 `'missileStrike'` 为键注册，调用方却拿 `'missile_strike'` 去查** →
4 个技能里 3 个恒 miss。`as SkillType` 这个强转把 TS 的防线拆了，`return false` 又把运行时的
证据吞了 —— 于是它一直没人发现。

> `overdrive` 是唯一两者偶然同名的，所以「过载驱动」在 HUD 上能用；这也解释了为什么
> 此前没人觉得"技能全坏"，只是"有几个键不灵"。

### 缺陷二（同源）：冷却有两份口径

| 位置                                     | 值                   |
| ---------------------------------------- | -------------------- |
| 技能真实冷却（`SkillConfig.cooldown`）   | 15 / 20 / 30 / 25    |
| store `maxCooldowns`（HUD 冷却环的分母） | **8 / 10 / 15 / 20** |

后果：冷却环提前 7~15 秒转完，玩家以为能按了，按下去还是没反应 —— 与缺陷一叠加，
"技能坏了"的体感被进一步放大。界面上的数字与真值不符，本身就是一种骗人。

---

## 三、修法：把三套口径收成一个零依赖叶子

新增 **`src/engine/skillSlots.ts`**（与 `src/engine/arena.ts` 同一套做法：真源必须是零依赖叶子）。

| 导出                   | 内容                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `SkillType`            | 技能 id 词表（camelCase，唯一）                             |
| `SKILL_SLOT_ORDER`     | 槽位顺序 = 键盘 `Q/E/T/G` = HUD 从左到右 = `skill1..skill4` |
| `SKILL_SLOT_KEYS`      | `['skill1','skill2','skill3','skill4']`                     |
| `SKILL_SLOT_CONFIGS`   | 4 个技能的全部数值与文案（冷却/持续/名称/图标/快捷键）      |
| `SKILL_SLOT_COOLDOWNS` | store `maxCooldowns` 的初值，由 `SKILL_SLOT_CONFIGS` 派生   |

`SkillSystem.ts` 只做**再导出**（既有 import 点不动），store 的 `maxCooldowns` 改为
`{ ...SKILL_SLOT_COOLDOWNS }`。**要改冷却/顺序/名称，只改这一个文件。**

**为什么真源不能放在 `SkillSystem.ts`**：它 import 了 `PlayCanvasGameEngine`，而 store 与
Node 单测都要读这份配置 —— 放进去会把 PlayCanvas 拖进 store，并让单测环境直接炸
（`wasmoon` 在 Node 下 Aborted）。这条与 `arena.ts` 的理由完全相同。

### GameScene 侧：三条路径收敛成一个入口

```ts
/** HUD 点击 / 触屏按钮 / 键盘 Q E T G 全部走这里 */
const activateSkillSlot = useCallback((index: number): boolean => {
  const system = skillSystemRef.current;
  const slotKey = SKILL_SLOT_KEYS[index];
  const type = SKILL_SLOT_ORDER[index];
  if (!system || !slotKey || !type) return false;
  if (!system.activateSkill(type)) return false; // ← 冷却只在这一支写
  useGameStore.getState().setSkillCooldown(slotKey, SKILL_SLOT_CONFIGS[type].cooldown);
  return true;
}, []);
```

顺带把键盘的 4 个 `case 'KeyQ' / 'KeyE' / ...` 换成**表驱动**：键位字母由
`config.keyBinding` 反推，不再「HUD 写一遍 Q、键盘再写一遍 KeyQ」。HUD 技能条的名称 /
快捷键 / 顺序 / 冷却也全部改由真源派生（只保留 HUD 自己的图标词汇 `clock` / `zap`）。

### 让静默失效变成可见

```ts
if (!skill) {
  console.warn(`[SkillSystem] 未知技能 id "${type}"，忽略激活。已知 id：${...}`);
  return false;
}
```

这是本次最重要的一行。**静默的 `return false` 是这个缺陷藏了两轮的唯一原因。**

---

## 四、缺陷三：导弹技能在引擎销毁后继续开火（连带抓出）

e2e 第一次跑就冒出 **10 条未捕获异常**：

```
TypeError: Cannot read properties of null (reading 'systems')
    at _Entity.addComponent            (playcanvas.js)
    at PlayCanvasGameEngine.addParticleSystem (PlayCanvasEngine.ts:412)
    at MissileStrikeSkill.explodeMissile      (SkillSystem.ts:155)
```

| 环节       | 事实                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 爆炸定时   | `setTimeout(explodeMissile, 1500)`，一次 5 枚                                                                                   |
| 补发第二轮 | 第一轮 1.5s 全爆完时技能仍在持续期（duration 2s）→ `executeSkillEffect` 又排一轮                                                |
| 第二轮到期 | 3.0s 之后 —— 玩家往往已经离开关卡，**引擎已 `destroy()`**                                                                       |
| 崩点       | `new pc.Entity('explosion')` 拿不到 application → `addComponent('particlesystem')` 内部读 `this._app.systems`，`_app` 为 `null` |
| 计数       | **一枚导弹一条**，实测 10 条                                                                                                    |

此前只有键盘按 Q 会走这条路，所以异常一直安静地躺在控制台里；这次 HUD 路径修好后才浮出来。

### 修法

1. `Skill` 增加 `disposed` 闸门；`activate()` 遇已销毁直接拒绝；`destroy()` 先立闸。
2. `MissileStrikeSkill` 登记 `timers` / `intervals`；`endSkill()` 与 `destroy()` 一次性清空。
3. `explodeMissile` 加第二道闸：**导弹已不在 `this.missiles` 名单里就丢弃**（迟到的回声）。
4. `GameScene` 的 cleanup 顺序改为 **技能系统先销毁 → 再销毁引擎**。

> 修完后未捕获异常从 25 条降到 11 条，技能相关 **0**。剩余全是 wasmoon / PlayCanvas 的 dev 噪声
> （`ASSERT FAILED: Could not find current application`、`still waiting on run dependencies` 等），
> 与本轮无关，已在验证脚本里单列，不掩盖也不让它把脚本长期拖红。

---

## 五、缺陷四：生产构建的 Lua 运行时其实一直死着（跑生产链时抓出）

技能改完照例走「生产构建验证链」（`vite build` → `vite preview` →
`verify-lua-runtime-prod.mjs`），结果 **16 项里 4 项红**：真实 Lua 运行时没启用，回落 stub。

### 证据

```
[LuaEngine] 真实 Lua 运行时启动失败，回落宿主实现: Failed to fetch
[LuaEngine] 未启用真实 Lua 运行时，使用宿主 JS 实现（stub）——src/lua/**/*.lua 不会被执行
[LuaEngine] Registered module: enemy_ai (stub)
```

读 wasmoon 的源码才看清：

```js
// wasmoon/dist/index.js  LuaFactory.constructor
if (customWasmUri === undefined) {
  if (isBrowser) customWasmUri = `https://unpkg.com/wasmoon@${version}/dist/glue.wasm`;
}
```

**不传 `customWasmUri` 时，wasmoon 在浏览器里硬编码去 unpkg.com 取那 271KB 的 wasm。**
而项目的 `resolveRuntimeFactory()` 一直是 `new FactoryCtor()` —— 裸构造，什么都没传。

| 场景                         | 结果                                                                        |
| ---------------------------- | --------------------------------------------------------------------------- |
| dev / prod + 能连外网        | 悄悄从 CDN 下载，**看起来一切正常**                                         |
| 断网、代理不通、CDN 被墙     | `Failed to fetch` → **整个 Lua 运行时静默回落 stub**，只留一句 console 警告 |
| NAS 内网部署（实际交付形态） | 同上 —— 也就是**线上那套根本没有 Lua**                                      |

这属于项目已经记录在案的同一类缺陷（「dev 绿、prod 炸」），只是这次换成了 wasm 取源，
而不是 `.lua` 取源。

### 修法

```ts
// wasm 随包发布，彻底断开 CDN 依赖
import glueWasmUrl from 'wasmoon/dist/glue.wasm?url';
...
return async () => new FactoryCtor(glueWasmUrl).createEngine();
```

`?url` 让 Vite 把 wasm 当资源产出（实测 → `dist/assets/glue-Dlydm7r2.wasm`，271,581 字节，
与 `node_modules/wasmoon/dist/glue.wasm` 一致），dev 与生产构建都对得上，无需手工拷贝。

**结果：生产链 16/16 全绿，P1 报告 `真实 Lua 运行时已启用（Lua 5.4，13 个 .lua 模块可 require）`。**

---

## 六、护栏

| 层   | 内容                                                                                                                                                                        | 结果       |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 单测 | `src/engine/skillSlots.test.ts`（9 项）：配置键与槽位表互相锁死、每条 `config.type === 键`、**store 冷却分母 === 技能真值**、枚举值必须 camelCase（防 `as SkillType` 复发） | 488 项全绿 |
| e2e  | `scripts/verify-skill-activation.mjs`：真实浏览器里**分别用 HUD 点击与键盘**激活 4 个技能，断言技能真的进入激活态与冷却；另测"冷却中连按不重置"、"无技能相关控制台错误"     | **52/52**  |
| 观测 | `__skillDebug.skills()`（读 SkillSystem 真值）与 `__skillDebug.hudSkills()`（读 store 显示值）并列暴露，专门为了让脚本分辨"显示值"与"真值"                                  | —          |
| 回归 | `verify-skilltree-wiring` 33/33、`verify-achievements` 38/38、`verify-lua-runtime-prod` **16/16**（修 wasm CDN 前是 12/16）、`tsc --noEmit` 0 错                            | 无回归     |

---

## 七、这回不做的

| 不做                                          | 为什么                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| HUD 技能条激活时亮黄框（`isActive` 恒 false） | 需要新增 store 字段并每帧写入，纯外观；`isReady` 判定不依赖它，不影响可用性 |
| 把「一次导弹打击发两轮」改成一轮              | 5 枚还是 10 枚是**平衡数值**，不是接线问题；改它 = 改手感，应由你拍板       |
| 让 `rewards.unlocks` 真正解锁内容             | 仍只 `console.log`（见 `docs/2026-10-10-下一步开发方向.md`），是另一条链    |
| 迁 `host: true` 的 4 个 Lua 模块              | 纯工程内部，玩家零感知                                                      |

---

## 八、还差你拍板的

- **导弹打击一次发两轮（5 + 2×等级，实发两倍）**：是设计如此，还是该只发一轮？
- **要不要顺手把 HUD 的"技能激活中"高亮补上**（外观，约 20 行）？
- **NAS 上那套要不要重新构建部署一遍**？本次修掉的「Lua 生产环境静默回落 stub」意味着
  线上那套的 Lua 一直是死的（`http://192.168.1.45:8095`），值得重新推一次。
- **下一轮做什么**：`rewards.unlocks` 接成真链（解锁商店物品 / 技能）／ 打击感第二批 ／ 部署体积治理？

---

## 附：这次用到的判据（下次可复用）

```
1. "点了没反应"类缺陷的通用查法：看调用方传的字符串，与接收方注册用的键，
   是不是**同一个词表**。有 `as XXX` 强转的地方优先怀疑（它把编译期防线拆了）。
2. 静默 `return false` 是缺陷的藏身处：任何"查表 miss 就返回"的分支，
   都该在 miss 时至少 console.warn 一次并列出合法取值。
3. 同一个数值在 UI 与逻辑各写一份 = 一定会错开。UI 的分母必须来自逻辑的真源。
4. 延迟回调（setTimeout/setInterval）持有引擎对象的地方，必须显式登记 + 在销毁时清空，
   否则"销毁后开火"只会表现为一串与技术无关的 TypeError。
5. e2e 抓到的未捕获异常要打印堆栈并去重 —— 只报"错误数 25"是查不动的。
6. **"随包发布的二进制/素材"要检查它是不是在运行时从外网取的**：
   任何 `new Ctor()` 没传 URL 的第三方 wasm/wasm 加载器都值得怀疑。
   dev 能跑 ≠ 生产能跑，外网能跑 ≠ 内网能跑。判据：断网跑一遍生产链。
```


---

## 2026-10-12-解锁链路接线.md

# 解锁链路接线：把 `rewards.unlocks` 从装饰变成真链

> 结论先说：10 个关卡里逐条写着的 `rewards.unlocks` 此前**没有任何下游消费方**。
> 本轮建立了唯一真源 `UnlockRegistry`，把技能门控、舰体可选、商店门槛三处接成真链。
> 单测 489 → **507**（+18），新脚本 `verify-unlocks.mjs` **69/69**，
> 既有 19 个 e2e 脚本零连带失败。

---

## 一、接线前的事实：数据齐了，没人读

`src/levels/level-*.ts` 的 `rewards` 里逐条写着：

| 关  | `unlocks`              |
| --- | ---------------------- |
| 1   | `ship-fighter`         |
| 2   | `skill-missile-strike` |
| 3   | `ship-bomber`          |
| 4   | `skill-shield-burst`   |
| 5   | `ship-cruiser`         |
| 6   | `skill-time-slow`      |
| 7   | `ship-stealth`         |
| 8   | `skill-overdrive`      |
| 9   | `ship-corvette`        |
| 10  | `ship-dreadnought`     |

全项目**唯一**的读取方式是 GameScene 结算里的一句 `console.log`：把数组 `join('/')` 打出来。
它不改任何状态，也不存在任何判定函数 —— 玩家通关后，除了控制台多一行字，什么也没发生。

### 更糟的是：三处「看起来能拦、其实都没拦」

| 解锁类别  | 表面上的消费方                     | 真相                                                   |
| --------- | ---------------------------------- | ------------------------------------------------------ |
| `skill-*` | `SkillSystem` 构造                 | 无条件注册 4 个技能，`activateSkill` 从不问解锁        |
| `ship-*`  | `PlayerShip` 的 `config.shipModel` | **全仓零调用方传这个字段**，永远回落 `'fighter'`       |
| 商店门槛  | 商店卡片的「要求等级: N」          | 只是渲染 `item.level`，`handlePurchase` 里没有任何校验 |

三处互相独立，各自把解锁架空了。玩家甚至能在第 1 关就用出第 8 关才该给的「过载驱动」，
商店里点一下就买到 30 级的舰船 —— 只要你有钱。

### 一条悬空数据

`level-10` 的 `unlocks: ['achievement-master']` 在成就表里**不存在**
（成就是 `skill_master` / `mission_master` / `legendary_pilot`…）。
而 `StoryMissionManager.ChapterRewards` 把 `unlocks: string[]` 与 `achievement?: string`
写成**两个字段**，说明 `unlocks` 本就不该放成就 id。属于早期文案笔误沉淀成了数据。

---

## 二、现在的口径

### 2.1 一个词表：`src/engine/UnlockRegistry.ts`

6 舰体 + 4 技能 = 与 10 关一一对应，全部登记在此。任何「解锁 id → 人类可读名」的换算
只允许写在这一处。

### 2.2 一个派生：幂等派生 > 事件发放

「已授予」集合由 `LevelProgress` 的**通关记录现算**：

```ts
export function getGrantedUnlockIds(
  progress: LevelProgressMap = getLevelProgress(),
  ownedShipSubtypes?: readonly string[],
): Set<string>;
```

组成三条：

1. 通关记录里 `cleared === true` 的关卡 → 其 `rewards.unlocks` 全部授予；
2. `starter` 舰体（`ship-fighter`）无条件授予；
3. 商店买到的船顺带解锁对应外观（`HULL_BY_SHOP_SUBTYPE`）。

**为什么不写成「通关那一刻 setState 发一次」**：事件式天然会漏发 ——
老存档（解锁功能上线前就通关了）、换设备、清缓存后重打、直接改 localStorage 深链进关，
这四种情况都会得到「通关了但没解锁」。幂等派生的好处是**任何时刻读都得到同一组结果**，
不需要补发逻辑，也不可能漏发。

### 2.3 三类真消费方

**① 技能门控（`SkillSystem`）**

```ts
constructor(player, engine, options: SkillSystemOptions = {}) {
  this.granted = options.grantedUnlockIds ?? getGrantedUnlockIds();
  for (const type of SKILL_SLOT_ORDER) {
    if (!isSkillUnlocked(type, this.granted)) continue;
    this.registerSkill(factories[type]());
  }
}
```

`isSkillUnlocked()` 对**未登记**的 id 返回 `true`（不误锁），只对「登记了但还没通关解锁」
的返回 `false`。`activateSkill` 区分两种 miss：

- 已实现在 `SKILL_SLOT_ORDER` 里（只是没解锁）→ 静默 `return false`（这是**门控**，不是错误）；
- 否则 → `console.warn` 并列出已知 id（这是**词表错位**，必须喊）。

这个区分是必要的：上一轮「4 个技能里 3 个点了没反应」的缺陷，正是被静默 `return false`
藏了两轮才被发现。

**② 舰体可选（机库面板 + `PlayerShip`）**

- 真源 `src/engine/SelectedHull.ts`：`getSelectedHull()` / `setSelectedHull()`，
  存档值非法或**当前不可用**时回落 `fighter`（存档不可信；进度清空后 `cruiser` 会自动回落）。
- 入口 `src/components/HangarPanel.tsx`：主菜单「机库」，`data-testid="hangar-hull-<id>"` 等。
- 出口 `PlayerShip` 的 `shipModel` 由 `getSelectedHull(unlockSnapshot.granted)` 提供，
  新增 `getShipModelType(): ShipModelType` 便于验证脚本读**渲染侧真值**（而不是 UI 选中值）。

**③ 商店货架门槛（`ShopPanel`）**

新增 `evaluateItemGate(item, snapshot, playerLevel)` —— **显示与购买用同一个函数**。
舰船门槛查 `HULL_BY_SHOP_SUBTYPE` + `getUnlockSnapshot()`；其余物品真比 `player.level`。
「🔒 未解锁」不再是纯装饰文案。

### 2.4 护栏

```ts
export function getUnlockRegistryErrors(): string[]; // 悬空奖励 / 永不授予 / 前缀漂移
```

- 关卡数据里出现的 id **必须全部登记**（钉死 `achievement-master` 那类悬空 id）；
- 登记过的 id **必须真的有某一关授予它**（防「永不授予」的死条目）；
- 前缀必须与 id 语义一致。

以及编译期词表对齐：

```ts
import type { ShipModelType } from './ProceduralModelGenerator';
type AssertTrue<T extends true> = T;
export type HullIdIsSubsetOfShipModelType = AssertTrue<HullId extends ShipModelType ? true : false>;
export type ShipModelTypeIsSubsetOfHullId = AssertTrue<ShipModelType extends HullId ? true : false>;
```

`import type` 编译后擦除，**不产生运行时依赖** —— 既拿到了双向类型锁，又不会把
PlayCanvas 拖进 zustand store 与 Node 单测。

---

## 三、舰体为什么只是「外观 + 进度」，不带属性

商店已经在卖「舰体 + 属性」的东西（`shop-item-01/02/03` 分别是重型巡洋舰 / 隐形战机 /
无畏舰，各带一套生命/护盾/速度/伤害加成），那条链路是通的
（`OwnedItems` → `MetaBonuses` → 每局开局合并）。

若舰体再自带一套属性，同一件事就有了**两个真源**，而且名字还重：
「我**买**的那艘巡洋舰」和「我**开**的那艘巡洋舰」会变成两个不同的东西。

所以划清：**属性归商店，外观与解锁进度归 `UnlockRegistry`**。
反过来，买了商店的船也顺带解锁对应外观，避免「刚买了一艘船却还开着初始机」。
若将来要给舰体加属性，**唯一入口是 `UnlockRegistry.ts` 的 `HULL_DEFS`**。

---

## 四、依赖纪律

`UnlockRegistry` 只 import 纯数据 / 零依赖叶子：

- `skillSlots`（零依赖叶子）
- `LevelProgress`（只碰 localStorage）
- `OwnedItems`（同上）
- `../levels`（关卡配置**零 import**，纯字面量）

**绝不 import 引擎实现**，否则本模块会把 PlayCanvas / wasmoon 拖进 zustand store 与
Node 单测（wasmoon 在 Node 下必 Aborted）。这与 `arena.ts` / `skillSlots.ts` 是同一套做法。

---

## 五、验证

### 5.1 单测：489 → 507

`src/engine/UnlockRegistry.test.ts`（18 项，全绿）：

- 注册表自检为空（`getUnlockRegistryErrors()` 长度为 0）
- 关卡 id 集合 ≡ 登记集合（双向）
- 十关奖励序列 = 6 舰体 + 4 技能交替，第 10 关为 `ship-dreadnought`
- 恰好一艘 `starter`
- 幂等派生（同一状态读两次结果相同）
- 商店买到的船顺带解锁外观

### 5.2 e2e：`scripts/verify-unlocks.mjs` **69/69**

| 段  | 内容                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **全新存档**：机库只有 `fighter`、5 艘锁；商店舰船锁 + 等级门槛真判；进关 4 槽全锁、按 Q/E 冷却仍为 0                                   |
| B   | **真打一局通关第 2 关** → `levelProgress["2"].cleared === true`、控制台打出解锁内容、重进后导弹打击 `unlocked === true` 且按 Q 真进冷却 |
| C   | 预置通关 1..5：机库/技能/商店**三处同时**变化；`PlayerShip` 渲染侧真值 `hull() === 'cruiser'`                                           |
| D   | 6 个 `ship-*.glb` 全部 HTTP 200                                                                                                         |
| E   | 进度清空后舰体回落 `fighter`                                                                                                            |
| F   | 无「未知技能 id」告警、无未捕获异常                                                                                                     |

**B 段是最关键的一条**：它不能用预置数据造假 —— 必须真的进第 2 关、真的把波次清完、
真的从 console 捕获到解锁日志，然后重新进关才能观察到技能解锁。这条断言证明了
「通关 → 落库 → 派生 → 门控」是**一条活链**。

关键输出：

```
✅ 4 个槽位**全部未注册**到 SkillSystem: 实得=true 期望=true
✅ 按 Q/E 后 store 冷却**仍为 0**（锁定的技能真的放不出来）: 实得=true 期望=true
✅ levelProgress["2"].cleared === true（通关真的落库了）: 实得=true 期望=true
✅ 通关第 2 关后，导弹打击已注册到 SkillSystem: 实得=true 期望=true
✅ PlayerShip 实际使用的舰体 = cruiser（渲染侧真值）: 实得=cruiser 期望=cruiser
✅ 当前舰体回落到 fighter（存档里存的 cruiser 已不可用）: 实得=true 期望=true
✅ 未出现「未知技能 id」告警（锁定 ≠ 词表错位）: 实得=0 期望=0
```

截图：`docs/verify/unlocks-01-hangar-fresh.png` … `unlocks-06-cruiser-ingame.png`

### 5.3 既有脚本回归（零连带失败）

技能门控改变了行为，故须回归全部 e2e：

| 脚本                                                                               | 结果   |
| ---------------------------------------------------------------------------------- | ------ |
| verify-skill-activation                                                            | 68/68  |
| verify-meta-progression                                                            | 38/38  |
| verify-achievements                                                                | 38/38  |
| verify-skilltree-wiring                                                            | 33/33  |
| verify-survival-wiring                                                             | 36/36  |
| verify-flight-feel                                                                 | 12/12  |
| verify-arena-bounds                                                                | 14/14  |
| verify-environment                                                                 | 14 项  |
| verify-level-system / wave-plans / final-wave / lua-ai / postfx / wave-progression | 全通过 |
| verify-pbr-materials / audio-wiring / icon-wiring / glb-models / particle-textures | 全通过 |

`verify-skill-activation` / `verify-achievements` / `verify-meta-progression` 三个脚本
新增了预置：`scripts/lib/unlock-seed.mjs` 的 `seedClearedThrough(n)` / `applyProgressSeed(page, n)`
只覆盖 `levelProgress`，让它们在「全解锁」状态下测原本的技能行为
（元进度脚本另预置 `fighter-game-save`：level 5 / exp 500）。

---

## 六、改动清单

### 新增

- `src/engine/UnlockRegistry.ts` —— 解锁唯一真源
- `src/engine/UnlockRegistry.test.ts` —— 18 项
- `src/engine/SelectedHull.ts` —— 机库选择真源
- `src/components/HangarPanel.tsx` —— 机库面板
- `scripts/lib/unlock-seed.mjs` —— 验证脚本共用预置
- `scripts/verify-unlocks.mjs` —— 69 项

### 修改

- `src/levels/level-10.ts` —— 修悬空奖励 `achievement-master` → `ship-dreadnought`
- `src/engine/SkillSystem.ts` —— 门控 + `unlocked`/`unlockLevel` 快照 + 两种 miss 区分
- `src/engine/PlayerShip.ts` —— 新增 `getShipModelType()`
- `src/components/GameScene.tsx` —— 注入解锁集、`getSelectedHull`、解锁日志、`__skillDebug.unlocks()/hull()`
- `src/components/GameHUD.tsx` —— 锁定槽位渲染 🔒 + 虚线边框 + 解锁提示行
- `src/components/ShopPanel.tsx` —— `evaluateItemGate` 统一显示与购买判定
- `src/game/GameStateMachine.ts` / `src/App.tsx` / `src/components/MainMenu.tsx` —— 机库路由
- `scripts/verify-skill-activation.mjs` / `verify-achievements.mjs` / `verify-meta-progression.mjs` —— 加预置

---

## 七、上线

代码提交 `29663d2c` 已推送（`origin/master === master`）。

部署到 NAS：`node scripts/deploy-nas.mjs --no-build`
→ 231.1MB / 53,360 文件，单流传输 4.0s（57.8MB/s），md5 双端一致（`02e89559…`），
`site.bak` 保留回滚。

线上验收 `VERIFY_URL=http://192.168.1.45:8095/ node scripts/verify-lua-runtime-prod.mjs`
**16/16**，其中 P7b 的 HUD 文案直接印证解锁门控在生产构建里生效：

```
SKILLS 🔒 导弹打击 通关第 2 关解锁 🔒 护盾爆发 通关第 4 关解锁
```

（技能名来自 `skillSlots` 真源，解锁提示来自 `UnlockRegistry.getUnlockLevel()`，
两处都是本轮接的链。）

### 部署脚本本轮踩的坑（已写进脚本注释）

| 现象                                     | 原因                                                                                | 处置                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `md5sum` spawn 报 **EBUSY**              | 本环境里 spawn 外部命令大多 EBUSY（`node`/`bash`/`sh`/`mv` 全中，`ssh`/`tar` 正常） | md5 改用 Node 内建 `crypto` 流式算                              |
| `node` spawn 探针报 **EBUSY**            | 同上                                                                                | 探针失败只警告，**不再让整次部署报错**（线上此刻已切完）        |
| `fs.renameSync(dist)` 报 **EPERM**       | brokered-fs shim 禁止 Node 改动目录，与目标路径无关                                 | 脚本改为「改名失败即报错并打印 `mv` 命令」，**故意不 fallback** |
| 前台 `mv dist` 报 **Permission denied**  | **`vite preview` 占着 dist** —— Windows 下目录内有打开的文件就不能改名              | 清理前先停掉任何服务 `dist` 的进程                              |
| 后台任务里 `mv` 报 **Permission denied** | 后台沙箱更严                                                                        | 改名必须走**前台** Bash                                         |

由此确立了清 `dist` 的正确姿势（比「先删再构建」快 1500 倍）：
**`mv dist "../_dist-old-$(date +%s)"`（0.8 秒）→ `npx vite build`（2 分 30 秒）。**

---

## 八、遗留

- **`StoryMissionManager.ChapterRewards.unlocks` 仍是另一个词表**：剧情章节也写 `unlocks`，
  但剧情系统尚未接线（与关卡解锁是两回事）。若将来开通剧情，需决定二者是合并还是分列。
- 上一轮遗留待拍板：导弹打击一次发两轮是否改一轮；NAS 上 `site.bak`（约 500MB）留还是删。


---


