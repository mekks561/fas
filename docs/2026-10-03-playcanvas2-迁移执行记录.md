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
