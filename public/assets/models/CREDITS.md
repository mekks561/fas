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

## 尚未替换的（19 个旧坏文件，约 368 KB）

本目录曾有 45 个由 `generate-models.js` 生成的坏 `.glb`（GLB 头错误、12–32 面）。
其中 **26 个已换成 Kenney 真模型**（舰 6 + 敌 8 + Boss 2 + 结构物 11，见上表）；
被取代的 10 个 `structures/structure-*.glb` 已删除。其余 **19 个坏文件**仍在仓库里：

| 目录           | 坏文件数 | 体积   | 运行时是否引用                                                          |
| -------------- | -------- | ------ | ----------------------------------------------------------------------- |
| `projectiles/` | 9        | 136 KB | 否（仅 `GameResources.ts`，该清单未接线）                               |
| `effects/`     | 8        | 204 KB | 否（同上）                                                              |
| `bosses/`      | 2        | 28 KB  | 否（`boss-collector.glb` 连清单都没引用；`boss-tyrant.glb` 仅清单引用） |

- 渲染路径只会用到 `ModelAssetProvider` 里登记的那 27 个（boss 只映射了
  `boss_sentinel` / `boss_overlord` 两个；结构物只映射了 asteroid / space_station /
  satellite 三类）。
- 注意：Kenney space 套件**没有**激光/导弹弹体模型，`projectiles/` 若要换真素材
  需要引入其它素材源（当前子弹是程序化发光球体，视觉上并不违和，优先级低）。
- `GameResources.ts` → `GameResourceManager` → `ResourceDownloadTester` 这条链
  **没有任何应用侧入口**（`ResourceDownloadTester` 只被自己引用），因此这些引用
  不代表真的会去下载。
- 结论：这 19 个文件目前是**纯死重量**，删掉不会影响运行；但那属于独立的清理动作，
  未经确认不擅自删除。
