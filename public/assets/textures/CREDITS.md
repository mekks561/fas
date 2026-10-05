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

## 来源快照

- 仓库镜像：`shorepine/kenney`
- 钉定 commit：`3694c6879e487c108f55677be7dd2ca75b07cc3b`
- 许可：Kenney 全部素材为 CC0 1.0（见 https://kenney.nl/support ）
- 本地备用库：`.workbuddy/asset-cache/kenney/`（由 `node scripts/fetch-asset-reserve.mjs` 抓取，含全库快照与校验清单）

## 使用约定

1. 从备用库挑素材时，必须同步在对应 `CREDITS.md` 登记来源与用途，本文件就是纹理类的登记处。
2. 天幕在 `PlayCanvasEngine.createSkyDome()` 接入；贴图加载失败时回落纯色背景，不影响开局。
