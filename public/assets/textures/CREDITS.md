# 纹理素材来源（public/assets/textures/）

本目录所有素材均为 **CC0 1.0（公有领域，可商用、无需署名）**。

## 清单

| 文件                           | 来源                   | 原始素材                                              | 尺寸      | 体积       | 用途                                                                                      |
| ------------------------------ | ---------------------- | ----------------------------------------------------- | --------- | ---------- | ----------------------------------------------------------------------------------------- |
| 战斗场景天幕                   | Kenney — Skyboxes      | `2d/Skyboxes/Skyboxes/skybox-{space,night,alien}.png` | 4096×2048 | 0.3~1.4 MB | 战斗天幕（直引 kenney 目录，不再存副本；映射见 `src/levels/index.ts` 的 SKYBOX_TEXTURES） |
| `particles/engine-flame.png`   | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/flame_01.png`     | 512×512   | 52 KB      | 玩家引擎尾焰（colorMap，由 colorGraph 染蓝白）                                            |
| `particles/missile-flame.png`  | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/flame_03.png`     | 512×512   | 48 KB      | 导弹尾焰                                                                                  |
| `particles/hit-light.png`      | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/light_01.png`     | 512×512   | 91 KB      | 子弹命中爆炸光球                                                                          |
| `particles/explosion-ring.png` | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/light_03.png`     | 512×512   | 97 KB      | 敌人死亡爆炸（环形冲击波光球）                                                            |
| `particles/boss-burst.png`     | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/star_05.png`      | 512×512   | 60 KB      | Boss / 重型敌机爆炸（六芒星光）                                                           |
| `particles/powerup-star.png`   | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/star_01.png`      | 512×512   | 41 KB      | 道具拾取特效（四芒星光）                                                                  |
| `particles/skill-flare.png`    | Kenney — Particle Pack | `2d/Particle Pack/PNG (Transparent)/flare_01.png`     | 512×512   | 41 KB      | 技能爆炸（镜头光晕横条）                                                                  |

### PBR 材质集（ambientCG，1K JPG）

| 文                      | 来源                        | 原始素材                   | 通道                                              | 体积   | 用途                          |
| ----------------------- | --------------------------- | -------------------------- | ------------------------------------------------- | ------ | ----------------------------- |
| `pbr/rock030/*`         | ambientCG — Rock030         | `Rock030_1K-JPG_*`         | Color + NormalGL + Roughness + AO                 | 4.9 MB | 小行星带（普通岩石）          |
| `pbr/rock058/*`         | ambientCG — Rock058         | `Rock058_1K-JPG_*`         | Color + NormalGL + Roughness + AO                 | 3.9 MB | 小行星带（岩石变体）          |
| `pbr/rock064/*`         | ambientCG — Rock064         | `Rock064_1K-JPG_*`         | Color + NormalGL + Roughness + AO                 | 4.4 MB | 小行星带（晶体岩专配，rockC） |
| `pbr/metalplates016a/*` | ambientCG — MetalPlates016A | `MetalPlates016A_1K-JPG_*` | Color + NormalGL + Roughness + AO + Metalness     | 2.5 MB | 空间站                        |
| `pbr/metal049a/*`       | ambientCG — Metal049A       | `Metal049A_1K-JPG_*`       | Color + NormalGL + Roughness + Metalness（无 AO） | 1.5 MB | 卫星                          |

- 粗糙度/金属度是**逐像素贴图**（`glossMap + glossInvert=true`，官方 glTF 导入器同款组合），
  不再是常量标量 —— 表面反射随贴图起伏。
- 岩石按外壳 GLB 分派三套材质（`rockSetForAsteroid`，确定性散列），
  晶体岩（rock_crystalsLarge*）单配 rockC。

## 来源快照

- 仓库镜像：`shorepine/kenney`
- 钉定 commit：`3694c6879e487c108f55677be7dd2ca75b07cc3b`
- 许可：Kenney 全部素材为 CC0 1.0（见 https://kenney.nl/support ）
- 本地备用库：`.workbuddy/asset-cache/kenney/`（由 `node scripts/fetch-asset-reserve.mjs` 抓取，含全库快照与校验清单）

### ambientCG 快照

- 许可：CC0 1.0（https://ambientcg.com ）
- 本地备用库：`.workbuddy/asset-cache/ambientcg/`（160 套，含逐套校验）
- 本目录只拷贝用到的通道（小写约定名 `color/normal/roughness/ao/metalness`）；
  全套原件（含 Displacement/NormalDX/3D 软件工程文件）留在备用库。
- ⚠ 2026-10-11 治理：早前整包拷入的 `pbr/ambientcg/` 18 套 117MB（PascalCase
  全套、零代码引用）已删除 —— 运行时只走上面的小写精选，原件永远在备用库可重取。

## 2026-10-05 资源库扩展（~557MB，素材库性质）

本轮把三库全量入库作为**素材储备**（多数尚未被运行时消费，属预期状态，
消费随功能接线逐步发生，用 `scripts/audit-asset-usage.mjs` 追踪）：

### 1. `public/assets/kenney/`（361MB，Kenney 全库快照）

- 许可：CC0 1.0（https://kenney.nl/support ）
- 内容：3d 49 kit / 2d 120+ kit / icons 8 套 / ui 9 套，与
  `.workbuddy/asset-cache/kenney/` 一致（含 index.tsv 清单）。
- 已消费：space kit（GLB 结构物）、Particle Pack（7 张粒子贴图）、
  Skyboxes（三张天幕：space/night/alien）。

### 3. `public/assets/textures/hdr/`（96MB，14 张）

- 许可：CC0 1.0（https://polyhaven.com ）
- 2026-10-11 起十关各配一张（ENV_HDRI 一一对应，含色温/亮度差异数据表），
  其中 4 张自备用库新拷（dusk_1/dusk_2/sunset 三张 puresky + industrial_sunset）。
- 环境光照走 `scene.envAtlas`（generateLightingSource → generateAtlas），
  天幕暂用 Kenney LDR 全景（ENV_HDRI 只管「光照从哪来」）。

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
