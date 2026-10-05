# 模型素材来源与许可

本目录下的 `.glb` 模型来自 **Kenney**（https://kenney.nl）的 **Space Kit** 素材包。

- **许可**：CC0 1.0 Universal（公共领域贡献）。可商用、可修改、无需署名。
- **来源镜像**：https://github.com/shorepine/kenney （Kenney 官方素材的整理镜像，路径稳定）
- **固定版本**：commit `3694c6879e487c108f55677be7dd2ca75b07cc3b`
- **获取方式**：`node scripts/fetch-kenney-models.mjs`（含逐文件 GLB 结构校验）

## 为什么不用原先那批模型

原先本目录下的 `.glb` 由 `scripts/generate-models.js` 生成，实测发现两个问题：

1. **45/45 全部不是合法 GLB**：文件头把 JSON 长度写进了 version 字段、把二进制缓冲
   长度写进了总长字段，且 JSON/BIN 两个 chunk 头整个缺失 → 任何标准加载器都会拒收；
2. **每个只有 12–32 个三角面**（一个立方体就是 12 面），即使修好格式也没有画质可言。

## 映射关系

| 游戏内文件                         | Kenney 源模型                  | 三角面数 |
| ---------------------------------- | ------------------------------ | -------- |
| ships/ship-fighter.glb             | craft_speederA                 | 280      |
| ships/ship-bomber.glb              | craft_cargoA                   | 264      |
| ships/ship-cruiser.glb             | craft_cargoB                   | 380      |
| ships/ship-stealth.glb             | craft_speederC                 | 292      |
| ships/ship-corvette.glb            | craft_speederB                 | 270      |
| ships/ship-dreadnought.glb         | craft_miner                    | 384      |
| enemies/enemy-scout.glb            | craft_speederD                 | 322      |
| enemies/enemy-fighter.glb          | craft_racer                    | 280      |
| enemies/enemy-bomber.glb           | craft_cargoA（红系配色区分）   | 264      |
| enemies/enemy-tank.glb             | turret_double                  | 876      |
| enemies/enemy-assassin.glb         | alien                          | 292      |
| enemies/enemy-drone.glb            | meteor_detailed                | 196      |
| enemies/enemy-corvette.glb         | craft_speederA（红系配色区分） | 280      |
| enemies/enemy-destroyer.glb        | craft_cargoB（红系配色区分）   | 380      |
| bosses/boss-sentinel.glb           | satelliteDish_large            | 186      |
| bosses/boss-overlord.glb           | hangar_largeA                  | 412      |
| structures/meteor.glb              | meteor                         | 68       |
| structures/meteor_detailed.glb     | meteor_detailed                | 196      |
| structures/meteor_half.glb         | meteor_half                    | 44       |
| structures/rock_largeA.glb         | rock_largeA                    | 176      |
| structures/rock_largeB.glb         | rock_largeB                    | 172      |
| structures/rock_crystalsLargeA.glb | rock_crystalsLargeA            | 384      |
| structures/rock_crystalsLargeB.glb | rock_crystalsLargeB            | 380      |
| structures/rocks_smallA.glb        | rocks_smallA                   | 60       |
| structures/rocks_smallB.glb        | rocks_smallB                   | 48       |
| structures/station-hangar.glb      | hangar_largeB                  | 360      |
| structures/satellite-dish.glb      | satelliteDish_detailed         | 390      |

> Kenney space 套件只有 8 个飞船外壳（craft_*），而游戏需要 6 艘玩家舰 + 8 种敌人，
> 因此 3 种敌人（bomber / corvette / destroyer）复用了玩家舰外壳，靠战斗中的
> 红系配色与缩放区分。这是素材数量约束下的取舍；若后续引入更多船型来源，
> 优先替换这三个。
>
> 小行星带用的 9 种岩石外壳按「背景装饰」标准挑选：整块陨石只有 44–68 个三角面，
> 抓取脚本对 `structures/` 前缀的三角面阈值相应放宽到 40（仍高于原假素材的 12–32 面）；
> 低面数对一次渲染 40 个实例的小行星带反而是性能优点。

## 坏占位已全部清空（2026-10-05）

本目录现有 **27 个 `.glb`，全部是上表列出的 Kenney CC0 真模型**。旧 `generate-models.js`
产出的 45 个坏文件已全部移除：26 个被真模型取代，其余 **19 个无人引用直接删除**
（`projectiles/` 9 + `effects/` 8 + `bosses/` 2，约 368 KB）。

**清空依据**：这 19 个文件没有任何渲染路径引用——仅被死代码链
`GameResources.ts → GameResourceManager → ResourceDownloadTester` 的清单提及
（`ResourceDownloadTester` 全项目零 import），删除后无 404 风险。
`GameResources.ts` 清单里指向已删文件的 **29 条死条目已同步剪除**
（含早已删掉的 10 个 `structure-*.glb` 的条目），剩余 16 条全部指向真实存在的文件；
`scripts/download-models.js`（会把 Khronos 示例模型冒充游戏素材下载）已加停用守卫，
与 `generate-models.js` 的守卫同款。

**弹体与特效有意不留 GLB 素材**：

- 子弹是程序化发光球体、特效走粒子系统——这类对象本来就不该用静态网格渲染；
- 已查证 Kenney 3D 各包（space / blaster / tower-defense-classic 等）没有可用的
  弹体模型：`blaster` 包是 FPS 枪械（枪身 / 弹匣 / 瞄准镜），与太空战机弹体无关；
- 若未来确实要网格弹体：**先接线渲染、再找素材源**（`marble` 包的球体是候选），
  不要为无人消费的槽位引入新字节。
