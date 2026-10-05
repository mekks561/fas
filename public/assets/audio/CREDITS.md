# 音频素材来源与许可

本目录下的 **25 个音频文件全部是真实素材**（真实录音 / 真实作曲），来源统一为
**CC0 1.0 Universal（公共领域贡献）**：可商用、可修改、**无需署名**。
原先由 `scripts/generate-audio.js` 合成的 35 个 WAV 已全部移除。

- **获取方式**：`node scripts/fetch-real-audio.mjs`
  所有远程产物按 sha256 钉死；重新运行若上游已变动会直接报错退出，不会静默换料。
- **校验方式**：`node scripts/fetch-real-audio.mjs --check`
  只校验已落地的文件（逐文件解析 OGG/MP3 结构并读出真实时长），不联网。

## 为什么替换

原音频有两个独立问题：

1. **不是真素材**：35 个 WAV 全部由 `generate-audio.js` 用正弦波/白噪合成，
   听感是"测试音"，不是子弹、爆炸或音乐；
2. **体积失控**：14 MB 里 13 MB 是 5 个 BGM，且**全部是未压缩 WAV**
   （44100Hz / 16bit / 单声道），其中 `bgm-gameplay.wav` 单个就有 3.8 MB。

替换后：**总体积 14 MB → 6.58 MB**（减少约 53%），
而**总时长反而从 145 秒增加到 7.2 分钟**——
即"每秒钟音频的体积成本"降了一个数量级。

## 背景音乐（5 个，OpenGameArt）

| 游戏内文件             | 曲目                                              | 用途                        | 时长    | 大小    | 许可                                                  | 来源页                                                         |
| ---------------------- | ------------------------------------------------- | --------------------------- | ------- | ------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| `bgm/bgm-mainmenu.ogg` | Another space background track / ObservingTheStar | menuMusic —— 主菜单环境音乐 | 134.43s | 768 KB  | CC0 1.0                                               | https://opengameart.org/content/another-space-background-track |
| `bgm/bgm-gameplay.ogg` | Spacecrusher                                      | gameMusic —— 常规战斗       | 70.29s  | 1425 KB | CC0 1.0                                               | https://opengameart.org/content/spacecrusher                   |
| `bgm/bgm-boss.ogg`     | Battle Zero (2022 remaster)                       | bossMusic —— Boss 战        | 99.00s  | 1938 KB | CC0 1.0                                               | https://opengameart.org/content/battle-zero                    |
| `bgm/bgm-victory.mp3`  | space fanfare                                     | victoryMusic —— 胜利结算    | 24.48s  | 482 KB  | CC0 1.0 （该条目同时标注 CC-BY 3.0，我们按 CC0 使用） | https://opengameart.org/content/space-fanfare                  |
| `bgm/bgm-story.ogg`    | Dark Intro                                        | defeatMusic —— 失败/剧情    | 80.57s  | 1592 KB | CC0 1.0                                               | https://opengameart.org/content/dark-intro                     |

> 体积合计 6205 KB，时长合计 6.8 分钟。

## 音效（20 个，Kenney）

| 游戏内文件                       | 来源包                  | 源文件                         | 用途                                       | 时长  | 大小   |
| -------------------------------- | ----------------------- | ------------------------------ | ------------------------------------------ | ----- | ------ |
| `effects/sfx-laser.ogg`          | Kenney Sci-Fi Sounds    | laserSmall_000.ogg             | 玩家主炮，短促清脆                         | 0.24s | 7 KB   |
| `effects/sfx-plasma.ogg`         | Kenney Sci-Fi Sounds    | laserLarge_000.ogg             | 敌方能量弹，更低沉                         | 0.68s | 25 KB  |
| `effects/sfx-explosion.ogg`      | Kenney Sci-Fi Sounds    | lowFrequency_explosion_000.ogg | 爆炸，带低频冲击                           | 2.00s | 14 KB  |
| `effects/sfx-shield.ogg`         | Kenney Sci-Fi Sounds    | forceField_000.ogg             | 护盾/力场                                  | 0.95s | 25 KB  |
| `effects/sfx-damage.ogg`         | Kenney Sci-Fi Sounds    | impactMetal_000.ogg            | 金属受击                                   | 0.63s | 15 KB  |
| `effects/sfx-missile.ogg`        | Kenney Digital Audio    | phaserUp3.ogg                  | 导弹发射（上升音，原推进器音长达 5s 过冗） | 0.52s | 7 KB   |
| `effects/sfx-boss-roar.ogg`      | Kenney Sci-Fi Sounds    | spaceEngineLow_000.ogg         | Boss 低吼（引擎低频）                      | 5.00s | 97 KB  |
| `effects/sfx-nuke.ogg`           | Kenney Sci-Fi Sounds    | explosionCrunch_004.ogg        | 核爆（1.98s 长炸裂）                       | 1.98s | 77 KB  |
| `effects/sfx-blackhole.ogg`      | Kenney Sci-Fi Sounds    | engineCircular_000.ogg         | 黑洞嗡鸣（循环引擎）                       | 5.00s | 173 KB |
| `effects/sfx-powerup.ogg`        | Kenney Digital Audio    | powerUp1.ogg                   | 拾取道具                                   | 1.20s | 9 KB   |
| `effects/sfx-powerup-spawn.ogg`  | Kenney Digital Audio    | phaseJump1.ogg                 | 道具生成/跃迁                              | 0.47s | 7 KB   |
| `effects/sfx-heal.ogg`           | Kenney Digital Audio    | powerUp5.ogg                   | 治疗                                       | 0.44s | 6 KB   |
| `effects/sfx-wave-start.ogg`     | Kenney Digital Audio    | threeTone1.ogg                 | 波次开始提示                               | 0.83s | 7 KB   |
| `effects/sfx-level-complete.ogg` | Kenney Digital Audio    | pepSound1.ogg                  | 通关                                       | 0.52s | 6 KB   |
| `ui/ui-click.ogg`                | Kenney Interface Sounds | click_001.ogg                  | 点击                                       | 0.10s | 5 KB   |
| `ui/ui-select.ogg`               | Kenney Interface Sounds | select_003.ogg                 | 选择/悬停（select_001 仅 43ms，不成音）    | 0.38s | 7 KB   |
| `ui/ui-success.ogg`              | Kenney Interface Sounds | confirmation_001.ogg           | 确认成功                                   | 0.29s | 9 KB   |
| `ui/ui-error.ogg`                | Kenney Interface Sounds | error_001.ogg                  | 错误                                       | 0.16s | 7 KB   |
| `ui/ui-levelup.ogg`              | Kenney Interface Sounds | confirmation_004.ogg           | 升级                                       | 0.49s | 12 KB  |
| `ui/ui-achievement.ogg`          | Kenney Interface Sounds | maximize_005.ogg               | 成就（上行提示音，bong_001 仅 0.12s 过短） | 0.53s | 20 KB  |

> 体积合计 535 KB，时长合计 22.4 秒。

## 接线状态（2026-10-05 已接入并通过实测）

25 个音频文件此前**只有 `gameMusic` 一处真正被播放**，其余 4 首 BGM 与全部 7 个 UI 音效
都是「定义了但全项目 grep 不到调用点」的死定义。现已全部接线，实测通过
（`scripts/verify-audio-wiring.mjs`，9/9 断言、24 个音频请求全 2xx、运行时错误 0）：

| 声音                                   | 播放时机                          | 通路                            |
| -------------------------------------- | --------------------------------- | ------------------------------- |
| `bgm-mainmenu.ogg`                     | 主菜单 / 关卡选择 / 各面板        | GlobalAudio                     |
| `bgm-gameplay.ogg`                     | 战斗（第 1–9 波）                 | GlobalAudio                     |
| `bgm-boss.ogg`                         | **末波（Boss 波）**               | GlobalAudio                     |
| `bgm-victory.mp3`                      | 通关结算界面                      | GlobalAudio                     |
| `bgm-story.ogg`                        | 阵亡结算界面                      | GlobalAudio                     |
| `ui-*.ogg`（7 个）                     | 菜单/结算按钮点击、悬停；强化选定 | GlobalAudio                     |
| `sfx-level-complete` / `sfx-explosion` | 通关音刺 / 阵亡爆炸               | GlobalAudio（必须活过 Unmount） |
| 其余 `sfx-*.ogg`                       | 开火、命中、爆炸、道具、护盾等    | AudioManager（需要 3D 定位）    |

**为什么音乐必须走 GlobalAudio**：音乐原先挂在 GameScene 上（`AudioManager.playMusic`），
而结算/返回菜单时 GameScene 被 React 卸载 → `PlayCanvasEngine` 销毁 →
`pc.Application.destroy()` → `soundManager` 随之销毁 → 正在播的声音**当场被掐断**。
所以「胜利音乐」「主菜单音乐」放在 GameScene 里等于没有。现在音乐与跨界面音效走
`src/engine/GlobalAudio.ts`（基于 HTMLAudioElement，不依赖 PlayCanvas 生命周期），
战斗内的空间音效仍留在 `AudioSystem`。

## 已知遗留问题

1. **队列表已无死定义**：`AudioSystem.ts` 里那 5 条音乐定义已移除（音乐所有权归
   `GlobalAudio`），不再出现「PlayCanvas 预载解码一遍、却没人播放」的双份开销。
   实测 `bgm-story.ogg` 现在只在真的阵亡时才被请求。
2. **自动播放策略**：浏览器要求先有用户手势才能出声，因此**主菜单音乐会等到玩家第一次
   点击/按键后才响**（这是浏览器行为，无法绕过；已是业界标准做法）。已实现
   「解锁前记下要放的曲子，解锁瞬间补播」，所以不会漏掉。
3. **循环点未做精确处理**：`loop: true` 的曲目是按整曲循环，未做无缝裁剪
   （环境内没有可用的音频转码工具）。若听出接缝，需要引入 ffmpeg 重新裁切。
4. **响度未归一**：各素材来自不同作者，未做统一响度（LUFS）处理，
   个别音效可能偏响或偏轻，可在 `AudioSystem.ts` 的 `volume` 字段微调。

## 上游溯源

**Kenney 音频包**（https://kenney.nl/assets/category:Audio）——CC0，官网直链下载：

| 素材包                  | 归档 sha256（钉死）                                                |
| ----------------------- | ------------------------------------------------------------------ |
| Kenney Sci-Fi Sounds    | `119340f351a5098ad814f78719438c0da355a9ce8a4c8a3af6a8d48aa3d49e04` |
| Kenney Interface Sounds | `f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232` |
| Kenney Digital Audio    | `24e6ce28b76a6d8c89cff4d331e0965ff5c3de8a73c612028e9d363cc64e4f06` |

> 其中 Sci-Fi Sounds 的哈希与第三方公开记录的官方 1.0 归档哈希一致
> （`119340f351a5098ad814f78719438c0da355a9ce8a4c8a3af6a8d48aa3d49e04`），
> 可作为素材未被改动、确实来自官方的旁证。

**OpenGameArt 曲目**（https://opengameart.org）——每条的许可证都在抓取时逐页核对过
（读取内容页 `License(s)` 字段并断言为 CC0），来源页见上表。
