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

| 游戏内文件                  | Kenney 源模型                  | 三角面数 |
| --------------------------- | ------------------------------ | -------- |
| ships/ship-fighter.glb      | craft_speederA                 | 280      |
| ships/ship-bomber.glb       | craft_cargoA                   | 264      |
| ships/ship-cruiser.glb      | craft_cargoB                   | 380      |
| ships/ship-stealth.glb      | craft_speederC                 | 292      |
| ships/ship-corvette.glb     | craft_speederB                 | 270      |
| ships/ship-dreadnought.glb  | craft_miner                    | 384      |
| enemies/enemy-scout.glb     | craft_speederD                 | 322      |
| enemies/enemy-fighter.glb   | craft_racer                    | 280      |
| enemies/enemy-bomber.glb    | craft_cargoA（红系配色区分）   | 264      |
| enemies/enemy-tank.glb      | turret_double                  | 876      |
| enemies/enemy-assassin.glb  | alien                          | 292      |
| enemies/enemy-drone.glb     | meteor_detailed                | 196      |
| enemies/enemy-corvette.glb  | craft_speederA（红系配色区分） | 280      |
| enemies/enemy-destroyer.glb | craft_cargoB（红系配色区分）   | 380      |
| bosses/boss-sentinel.glb    | satelliteDish_large            | 186      |
| bosses/boss-overlord.glb    | hangar_largeA                  | 412      |

> Kenney space 套件只有 8 个飞船外壳，而游戏需要 6 艘玩家舰 + 8 种敌人，
> 因此 3 种敌人（bomber / corvette / destroyer）复用了玩家舰外壳，靠战斗中的
> 红系配色与缩放区分。这是素材数量约束下的取舍；若后续引入更多船型来源，
> 优先替换这三个。

## 尚未替换的

`projectiles/`（9 个）与 `effects/`（8 个）的 `.glb` 仍是旧的坏文件，运行时走
程序化生成，未接 GLB。`structures/` 同理（星球/星云这类天体用程序化球体更省体积）。
