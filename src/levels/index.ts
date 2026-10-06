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
 */
export const SKYBOX_TEXTURES: Record<string, string> = {
  'env-space-01': '/assets/textures/skybox-space.png',
  'env-nebula-01': '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-night.png',
  'env-station-01': '/assets/kenney/2d/Skyboxes/Skyboxes/skybox-alien.png',
};

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

/** 小行星带半径与数量（environment.asteroidField 为 true 时启用）。 */
export const ASTEROID_FIELD = { count: 40, innerRadius: 35, outerRadius: 55 } as const;

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
