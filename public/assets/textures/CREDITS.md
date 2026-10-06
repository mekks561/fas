# 纹理素材来源（public/assets/textures/）

本目录所有素材均为 **CC0 1.0（公有领域，可商用、无需署名）**。

## 清单

| 文件                           | 来源                   | 原始素材                                          | 尺寸      | 体积   | 用途                                           |
| ------------------------------ | ---------------------- | ------------------------------------------------- | --------- | ------ | ---------------------------------------------- |
| `skybox-space.png`             | Kenney — Skyboxes      | `2d/Skyboxes/Skyboxes/skybox-space.png`           | 4096×2048 | 272 KB | 战斗场景天幕（等距柱状全景，星点 + 紫蓝星云）  |
| `particles/engine-flame.png`   | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/flame_01.png` | 512×512   | 52 KB  | 玩家引擎尾焰（colorMap，由 colorGraph 染蓝白） |
| `particles/missile-flame.png`  | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/flame_03.png` | 512×512   | 48 KB  | 导弹尾焰                                       |
| `particles/hit-light.png`      | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/light_01.png` | 512×512   | 91 KB  | 子弹命中爆炸光球                               |
| `particles/explosion-ring.png` | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/light_03.png` | 512×512   | 97 KB  | 敌人死亡爆炸（环形冲击波光球）                 |
| `particles/boss-burst.png`     | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/star_05.png`  | 512×512   | 60 KB  | Boss / 重型敌机爆炸（六芒星光）                |
| `particles/powerup-star.png`   | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/star_01.png`  | 512×512   | 41 KB  | 道具拾取特效（四芒星光）                       |
| `particles/skill-flare.png`    | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/flare_01.png` | 512×512   | 41 KB  | 技能爆炸（镜头光晕横条）                       |

### PBR 材质集（ambientCG，1K JPG）

| 文件                                | 来源                        | 原始素材                               | 通道                                     | 体积   | 用途                    |
| ----------------------------------- | --------------------------- | -------------------------------------- | ---------------------------------------- | ------ | ----------------------- |
| `pbr/rock030/{color,roughness}.jpg` | ambientCG — Rock030         | `Rock030_1K-JPG_{Color,Roughness}.jpg` | Color + Roughness                        | 2.1 MB | 小行星带（40 个小行星） |
| `pbr/metalplates016a/*.jpg`         | ambientCG — MetalPlates016A | `MetalPlates016A_1K-JPG_*`             | Color + NormalGL + Roughness + Metalness | 1.8 MB | 空间站                  |
| `pbr/metal049a/*.jpg`               | ambientCG — Metal049A       | `Metal049A_1K-JPG_*`                   | Color + NormalGL + Roughness + Metalness | 1.1 MB | 卫星                    |

## 来源快照

- 仓库镜像：`shorepine/kenney`
- 钉定 commit：`3694c6879e487c108f55677be7dd2ca75b07cc3b`
- 许可：Kenney 全部素材为 CC0 1.0（见 https://kenney.nl/support ）
- 本地备用库：`.workbuddy/asset-cache/kenney/`（由 `node scripts/fetch-asset-reserve.mjs` 抓取，含全库快照与校验清单）

### ambientCG 快照

- 许可：CC0 1.0（https://ambientcg.com ）
- 本地备用库：`.workbuddy/asset-cache/ambientcg/`（18 套，含逐套校验）
- 本目录只拷贝用到的通道；未用的 NormalGL/Displacement/AO 留在备用库，需要时再取。
- 岩石只取 Color + Roughness：Kenney 岩石模型是低多边形平面着色，
  法线贴图收益极小，却要额外 2.5 MB，不值得。

## 2026-10-05 资源库扩展（~557MB，素材库性质）

本轮把三库全量入库作为**素材储备**（多数尚未被运行时消费，属预期状态，
消费随功能接线逐步发生，用 `scripts/audit-asset-usage.mjs` 追踪）：

### 1. `public/assets/kenney/`（361MB，Kenney 全库快照）

- 许可：CC0 1.0（https://kenney.nl/support ）
- 内容：3d 49 kit / 2d 120+ kit / icons 8 套 / ui 9 套，与
  `.workbuddy/asset-cache/kenney/` 一致（含 index.tsv 清单）。
- 已消费：space kit（GLB 结构物）、Particle Pack（7 张粒子贴图）、
  Skyboxes（skybox-space.png 天幕）。

### 2. `public/assets/textures/pbr/ambientcg/`（117MB，18 套全套）

- 许可：CC0 1.0（https://ambientcg.com ）
- 已消费 3 套：Rock030（小行星）/ MetalPlates016A（空间站）/ Metal049A（卫星），
  通道映射见 `PlayCanvasEngine.PBR_SETS`；其余 15 套为储备
  （SolarPanel 系→空间站扩展、Rock051/058/064→小行星随机化等）。

### 3. `public/assets/textures/hdr/`（80MB，polyhaven 夜空/月球 10 张）

- 许可：CC0 1.0（https://polyhaven.com ）
- 精选太空可用的 HDR 环境：moon_lab_4k / moonless_golf_2k / rogland_clear_night_2k /
  rogland_moonlit_night_2k / satara_night_no_lamps_2k / solitude_night_2k /
  qwantani_night_2k / qwantani_moonrise_2k / qwantani_moon_noon_2k / monochrome_studio_02_1k。
- 暂未接线：PlayCanvas 2.23 运行时无内建 skybox asset handler，
  equirect→prefiltered cubemap 需自建管线；接入时走 `scene.setSkybox()`
  并顺带提供 PBR 环境反射。

### 4. `public/assets/textures/ui/icons/`（14 张真图标，替换假色块）

- `icon-shield/defense/energy/star` ← Kenney Space Shooter Remastered Power-ups（CC0）
- `icon-gun/missile` ← Space Shooter Remastered Lasers（CC0）
- `icon-bomb` ← Space Shooter Remastered Meteors（CC0）
- `icon-damage` ← Space Shooter Remastered Damage（CC0）
- `icon-heart` ← Space Shooter Remastered UI playerLife1_blue（CC0）
- `icon-achieve/crosshair/clock/speed` ← Kenney Game Icons White 2x（CC0）
- `icon-character` ← Kenney Game Icons Expansion White 2x（CC0）
- 消费方：`ShopPanel` / `AchievementPanel` 经 `AssetIcon` 组件按 config
  的 icon 字段拼 URL 渲染，加载失败回落 emoji/★。
- ⚠️ 本目录（textures/ui/）根下的 40 个同名 PNG 是生成脚本产出的
  64×64 纯色方块（203~227 字节），是假料，勿再接线。

## 使用约定

1. 从备用库挑素材时，必须同步在对应 `CREDITS.md` 登记来源与用途，本文件就是纹理类的登记处。
2. 天幕在 `PlayCanvasEngine.createSkyDome()` 接入；贴图加载失败时回落纯色背景，不影响开局。
