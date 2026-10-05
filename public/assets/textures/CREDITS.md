# 纹理素材来源（public/assets/textures/）

本目录所有素材均为 **CC0 1.0（公有领域，可商用、无需署名）**。

## 清单

| 文件               | 来源              | 原始素材                                | 尺寸      | 体积   | 用途                                          |
| ------------------ | ----------------- | --------------------------------------- | --------- | ------ | --------------------------------------------- |
| `skybox-space.png` | Kenney — Skyboxes | `2d/Skyboxes/Skyboxes/skybox-space.png` | 4096×2048 | 272 KB | 战斗场景天幕（等距柱状全景，星点 + 紫蓝星云） |

## 来源快照

- 仓库镜像：`shorepine/kenney`
- 钉定 commit：`3694c6879e487c108f55677be7dd2ca75b07cc3b`
- 许可：Kenney 全部素材为 CC0 1.0（见 https://kenney.nl/support ）
- 本地备用库：`.workbuddy/asset-cache/kenney/`（由 `node scripts/fetch-asset-reserve.mjs` 抓取，含全库快照与校验清单）

## 使用约定

1. 从备用库挑素材时，必须同步在对应 `CREDITS.md` 登记来源与用途，本文件就是纹理类的登记处。
2. 天幕在 `PlayCanvasEngine.createSkyDome()` 接入；贴图加载失败时回落纯色背景，不影响开局。
