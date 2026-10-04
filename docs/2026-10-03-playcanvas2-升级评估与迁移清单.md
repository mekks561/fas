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
