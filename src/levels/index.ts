import { level01Config } from './level-01';
import { level02Config } from './level-02';
import { level03Config } from './level-03';
import { level04Config } from './level-04';
import { level05Config } from './level-05';
import { level06Config } from './level-06';
import { level07Config } from './level-07';
import { level08Config } from './level-08';
import { level09Config } from './level-09';
import { level10Config } from './level-10';
import type { WavePlan } from '../lua/wave/WaveManager';

export type { WavePlan };

export { level01Config } from './level-01';
export { level02Config } from './level-02';
export { level03Config } from './level-03';
export { level04Config } from './level-04';
export { level05Config } from './level-05';
export { level06Config } from './level-06';
export { level07Config } from './level-07';
export { level08Config } from './level-08';
export { level09Config } from './level-09';
export { level10Config } from './level-10';

export type LevelConfig = typeof level01Config;

export const getAllLevels = (): LevelConfig[] => [
  level01Config,
  level02Config,
  level03Config,
  level04Config,
  level05Config,
  level06Config,
  level07Config,
  level08Config,
  level09Config,
  level10Config,
];

export const getLevelById = (id: string): LevelConfig | undefined => {
  return getAllLevels().find((level) => level.id === id);
};

export const getLevelByIndex = (index: number): LevelConfig | undefined => {
  return getAllLevels()[index];
};

// ---------------------------------------------------------------------------
// 派生层：把策划配置翻译成运行时能直接用的值。
// 这里是全仓唯一「关卡配置 → 运行参数」的映射处；新增字段时只改这里。
// ---------------------------------------------------------------------------

/**
 * 关卡天幕 id → 贴图 URL。
 * Kenney「Skyboxes」（CC0），见 public/assets/textures/CREDITS.md。
 * 未登记的 id（或加载失败）由调用方回落默认天幕。
 *
 * ⚠ 天幕贴图是**风格化的 LDR 全景图**（4096×2048 PNG），与 ENV_HDRI 的物理 HDR
 * 是两套东西：天幕决定「你看到什么」，ENV_HDRI 决定「光照从哪来、什么颜色」。
 * 两者同键但不要求同源 —— 太空场景里「深空天幕 + 有色温的环境光」是常见搭配
 * （远处恒星/星云照亮舰体，天空本身仍是黑的）。
 *
 * Kenney 只有 5 张可选，其中 day(0.75)/morning(0.91) 亮度太高，配深空夜战会
 * 「天比舰亮」，故 10 关只在 space/night/alien 三张里按环境光色温搭配。
 */
export const SKYBOX_TEXTURES: Record<string, string> = {
  //        id                  天幕              搭配的环境光（色温）
  'env-space-01': '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-space.png', // 深蓝星云 ← 中性冷灰
  'env-debris-01': '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-night.png', // 夜空 ← 微暖暗
  'env-station-01': '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-alien.png', // 紫调异形 ← 影棚中性
  'env-deep-01': '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-space.png', // 深空 ← 极暗
  'env-sentinel-01': '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-space.png', // 深蓝 ← 亮中性
  'env-hidden-01': '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-night.png', // 夜空 ← 强冷蓝
  'env-fleet-01': '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-night.png', // 夜空 ← 冷蓝工业
  'env-maelstrom-01': '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-night.png', // 夜空 ← 暖暗
  'env-approach-01': '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-night.png', // 夜空 ← 暖橙
  'env-overlord-01': '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-alien.png', // 紫调异形 ← 冷蓝紫
};

/**
 * 默认天幕（未登记的 id / 关卡配置缺失时回落）。
 * 与 SKYBOX_TEXTURES 指向同一批 Kenney 素材 —— 这里保留一份显式常量，
 * 是为了让「回落」也有唯一真源，而不是散落在调用方里的字面量路径。
 */
export const DEFAULT_SKYBOX = '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-space.png';

/**
 * 关卡光照档位 → 主平行光强度（normal 档 = 原硬编码值 1.5）。
 * 档位取值来自 levels/*.ts（normal/dim/bright/dark/dramatic 五种），
 * 缺项按 normal 回落。数值为初始手感值，可调。
 */
export const LEVEL_LIGHTING: Record<string, { sunIntensity: number }> = {
  dark: { sunIntensity: 0.7 },
  dim: { sunIntensity: 1.0 },
  normal: { sunIntensity: 1.5 },
  dramatic: { sunIntensity: 1.8 },
  bright: { sunIntensity: 2.1 },
};

// ─── 画质：环境光照（IBL）与色调映射 ─────────────────────────────────────────
//
// 两件事分开：
//  1. ENV_HDRI —— 环境贴图。等距柱状（2:1）HDR，由 EnvLighting 预滤波成
//     envAtlas 挂在 scene 上，给金属/粗糙材质提供「环境反射 + 环境漫射」。
//     来源 Poly Haven（CC0），见 public/assets/textures/CREDITS.md 第 3 节。
//  2. TONEMAP + EXPOSURE_BY_LIGHTING —— 高光滚降曲线（保持亮部不过曝、暗部有细节）
//     与按关卡光照档位做的曝光补偿，避免暗关卡配新曲线后整体发灰。

/**
 * 关卡天幕 id → 环境贴图（HDR，equirect 2:1）。
 * 与 SKYBOX_TEXTURES 同键：一次选环境，同时决定「反射的环境」。
 * 未登记的 id 由调用方回落 DEFAULT_ENV_HDRI。
 *
 * 十关十张，每关一套「亮度 × 色温」组合 —— 这是本作「氛围差异化」的主要手段。
 * 原先 10 关只用 3 张，且实测**色温全是近中性**（天空 R-B 在 ±0.03 内），
 * 无论打哪一关，舰体受光都是同一种灰白 → 画面上「每关都一样」。
 *
 * 下表是实测数据（天空半球平均色，equirect 上半球均值）：
 *
 *   id                  亮度     暖度(R−B)   特征
 *   env-deep-01         0.072    +0.016    极暗（纯黑深空）
 *   env-debris-01       0.210    +0.074    暗·微暖
 *   env-maelstrom-01    0.259    +0.203    暗·暖（暖色轮廓光）
 *   env-space-01        0.303    −0.013    暗·中性（基准）
 *   env-station-01      0.441    +0.028    中·影棚中性
 *   env-fleet-01        0.883    −0.364    亮·冷蓝（工业）
 *   env-overlord-01     1.094    −0.294    亮·冷蓝紫
 *   env-hidden-01       1.100    −0.620    亮·强冷蓝
 *   env-approach-01     1.187    +0.375    亮·暖橙
 *   env-sentinel-01     1.219    −0.028    亮·中性
 *
 * 新增的 4 张（fleet/hidden/overlord/approach）来自备用素材库
 * `.workbuddy/asset-cache/polyhaven/`：它们是库里少见的「有色温倾向」的天空
 * （其余 100+ 张同样偏中性，换上也不会有氛围差异）。
 */
export const ENV_HDRI: Record<string, string> = {
  'env-space-01': '/assets/textures/hdr/rogland_clear_night_2k.hdr', // 1 初次接触：基准深空
  'env-debris-01': '/assets/textures/hdr/moonless_golf_2k.hdr', // 2 陨石航道：无月暗场
  'env-station-01': '/assets/textures/hdr/monochrome_studio_02_1k.hdr', // 3 空间站防御：人工白光
  'env-deep-01': '/assets/textures/hdr/satara_night_no_lamps_2k.hdr', // 4 深空：近乎全黑
  'env-sentinel-01': '/assets/textures/hdr/qwantani_moonrise_2k.hdr', // 5 Boss·哨兵：月出强光
  'env-hidden-01': '/assets/textures/hdr/qwantani_dusk_1_puresky_2k.hdr', // 6 隐藏基地：强冷蓝
  'env-fleet-01': '/assets/textures/hdr/industrial_sunset_puresky_2k.hdr', // 7 舰队战：冷蓝工业
  'env-maelstrom-01': '/assets/textures/hdr/solitude_night_2k.hdr', // 8 漩涡：暖色暗场
  'env-approach-01': '/assets/textures/hdr/qwantani_sunset_puresky_2k.hdr', // 9 最终接近：暖橙
  'env-overlord-01': '/assets/textures/hdr/qwantani_dusk_2_puresky_2k.hdr', // 10 Boss·帝王：冷蓝紫
};

/** 环境贴图默认值（未登记天幕 id / 生存模式）。 */
export const DEFAULT_ENV_HDRI = '/assets/textures/hdr/rogland_clear_night_2k.hdr';

/** 色调映射曲线（与 PlayCanvas 的 TONEMAP_* 常量同名，由引擎侧换算成数值）。 */
export type ToneMappingMode = 'linear' | 'filmic' | 'hejl' | 'aces' | 'aces2' | 'neutral';

/** 全局色调映射档位（惯例·可改）。 */
export const TONEMAP: { mode: ToneMappingMode; exposure: number } = {
  mode: 'aces2',
  exposure: 1.0,
};

/**
 * 关卡光照档位 → 曝光补偿系数（惯例·可改）。
 * 换 ACES 曲线后整体会比线性略暗，暗档多补、亮档少补，保持各关「该亮的地方亮」。
 */
export const EXPOSURE_BY_LIGHTING: Record<string, number> = {
  dark: 1.35,
  dim: 1.15,
  normal: 1.0,
  dramatic: 1.0,
  bright: 0.9,
};

/**
 * 关卡难度 → 引擎难度三档。
 * 策划用四档（easy/medium/hard/extreme）描述关卡，引擎只吃三档，
 * 这里是唯一的换算处（此前关卡难度根本没传给 gameplayManager）。
 */
export const ENGINE_DIFFICULTY: Record<string, 'easy' | 'normal' | 'hard'> = {
  easy: 'easy',
  medium: 'normal',
  hard: 'hard',
  extreme: 'hard',
};

/**
 * 小行星带与可活动空间的其他几何参数。
 *
 * **真源已迁到 `src/engine/arena.ts`**（零依赖叶子模块）——移到那里的原因：
 * 场地边界要被引擎热路径（PlayerShip / EnemyAI / EnemySystem / WeaponSystem）
 * 直接引用，若放在本派生层会把整条关卡配置链（含 WaveManager → LuaEngine → wasmoon）
 * 拖进热路径。此处只做再导出，保持「关卡/世界配置从 '../levels' 取」的既有习惯。
 */
export {
  ARENA_SCALE,
  ASTEROID_BELT,
  BACKDROP,
  ENEMY_BOUNDS,
  ENEMY_SPAWN,
  PLAYER_BOUNDS,
  PROJECTILE_CULL_RADIUS,
} from '../engine/arena';

/**
 * 关卡解锁门槛（惯例·可改）：按关卡序号推导，第 1 关恒解锁。
 * 原 LevelSelect 的 recommendedLevel 是硬编码在各关卡对象里的平行数据。
 */
export const recommendedLevelForIndex = (index: number): number =>
  index === 0 ? 1 : index * 2 + 1;

/** 关卡敌人总数（各波敌人 count 求和），用于选关界面展示。 */
export const totalEnemiesOf = (level: LevelConfig): number =>
  level.waves.reduce((sum, wave) => sum + wave.enemies.reduce((s, e) => s + e.count, 0), 0);

/** 关卡波数（= 配置里的波次定义条数）。 */
export const waveCountOf = (level: LevelConfig): number => level.waves.length;

/**
 * 关卡敌人配置 id → 运行时敌人类型 id（EnemySystem.enemyTypeFromString 词表）。
 * 配置用策划词表（enemy- 前缀 / 连字符 boss 名），运行时用无前缀下划线词表 ——
 * 此前两套词表没有任何换算，配置类型直接落到 EnemySystem 的 FIGHTER 兜底。
 * 这里是唯一的换算处；未知类型原样透传（仍由 EnemySystem 兜底）。
 */
export const ENEMY_TYPE_TO_RUNTIME: Record<string, string> = {
  'enemy-scout': 'scout',
  'enemy-fighter': 'fighter',
  'enemy-bomber': 'bomber',
  'enemy-tank': 'tank',
  'enemy-assassin': 'assassin',
  'enemy-drone': 'drone',
  'enemy-corvette': 'corvette',
  'enemy-destroyer': 'destroyer',
  'boss-sentinel': 'boss_sentinel',
  'boss-overlord': 'boss_overlord',
};

/** 一波的运行时生成计划：按生成顺序展开的敌人类型列表。类型定义归 WaveManager。 */

/**
 * 把关卡的显式波次表翻译成运行时生成计划，交给 WaveManager.setLevelWaves。
 * 注入后波次的敌人数量/类型/boss 判定全部由关卡数据决定；
 * 每项 spawnDelay（配置里的生成间隔）暂未被运行时消费，仍用 EnemySystem 的统一节拍。
 */
export const buildWavePlans = (level: LevelConfig): WavePlan[] =>
  level.waves.map((wave) => ({
    waveNumber: wave.number,
    enemyTypes: wave.enemies.flatMap((entry) => {
      const type = ENEMY_TYPE_TO_RUNTIME[entry.type] ?? entry.type;
      return Array.from({ length: entry.count }, () => type);
    }),
  }));

/**
 * UI 中文显示名。数据源仍是 levels/*.ts（英文为策划原文，也是 id 的依据），
 * 这里只做展示层本地化；缺项时回落配置里的英文名。新增关卡只需补一行。
 */
export const LEVEL_LOCALE: Record<string, { name: string; description: string }> = {
  'level-01': { name: '初次接触', description: '你的第一个任务：击败敌方侦察机，证明自己。' },
  'level-02': { name: '陨石航道', description: '在密集陨石中穿行，护送补给舰队。' },
  'level-03': { name: '星云伏击', description: '星云深处有埋伏，小心从背后出现的敌机。' },
  'level-04': { name: '废弃空间站', description: '潜入废弃空间站，清剿盘踞的敌军。' },
  'level-05': { name: '精英中队', description: '敌方精英中队出动，火力与装甲都更强。' },
  'level-06': { name: '深空遭遇', description: '孤军深入，迎面撞上敌方主力巡航编队。' },
  'level-07': { name: '小行星要塞', description: '敌军把小行星改造成要塞，正面突破它。' },
  'level-08': { name: '母舰外围', description: '突破母舰外围防线，敌方王牌尽出。' },
  'level-09': { name: '跳帮突袭', description: '贴脸跳帮，在极近距离的混战中活下来。' },
  'level-10': { name: '星际帝王', description: '最终决战：击败星际帝王，终结这场战争。' },
};
