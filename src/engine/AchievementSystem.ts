import { useGameStore } from '../store/useGameStore';
import { addCredits } from './CreditsStore';

/**
 * 成就系统 —— **全项目成就定义、判定与奖励的唯一真源**。
 *
 * 本轮（2026-10-10）接线前的状况，是个典型的「两套并行真源」：
 *
 * | | 运行时（本文件） | 成就面板 |
 * |---|---|---|
 * | 定义 | 22 条硬编码 TS | `public/assets/achievements/*.json`（15 条） |
 * | id | `first_blood` … | `achievement-01` … |
 * | 存储 | `localStorage.achievementProgress`（真在写） | `localStorage.unlockedAchievements`（**全仓无写入方**） |
 * | 奖励 | 只 `addScore` | JSON 里写着 experience / credits，无人发 |
 *
 * 后果：面板永远全锁（读的那个 key 没有任何代码写过），而运行时系统的
 * 22 条虽然真的会解锁，玩家却看不见；`shop-item` 那一轮的结论在这里同样成立 ——
 * **判「功能是不是假的」最快办法：查它的存储有没有下游读取方。**
 *
 * 现在的口径：
 * 1. **一个定义表**：运行时统计向的成就 + 从 content 层 JSON 迁进来的成就，同表同 id 空间；
 * 2. **一个进度存储**：`achievementProgress`；
 * 3. **一个奖励出口**：解锁即发经验 + 信用点（+ 分数），且每条只发一次
 *    （`AchievementProgress.paid` 是发放凭证，兼作老存档补发依据）；
 * 4. 面板只是这张表的**只读视图**，不再 fetch 任何 JSON。
 *
 * 关于「迁进来的成就」：原 15 条 content 层 JSON 里有 5 条是 `story_complete`
 * （通关 `story-chapter-01..05`）。全项目**没有「关卡 ↔ 剧情章节」映射**
 * （`src/levels/*.ts` 无章节字段；`StoryMissionManager` 只跟踪 `mission-01..20`
 * 与 `currentChapterId`，不跟踪章节完成），且 `mission-02` 起依赖游戏里
 * **不存在的玩法**（护航运输船 `transport-ship`）—— 即使接上判定也永远不可达。
 * 因此这 5 条**未迁入**，详见 `docs/2026-10-10-成就系统接线.md`。
 */

export enum AchievementCategory {
  COMBAT = 'combat',
  SURVIVAL = 'survival',
  COLLECTION = 'collection',
  SKILL = 'skill',
  MISSION = 'mission',
  SPECIAL = 'special',
}

export enum AchievementRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

/**
 * 达成条件（声明式）。
 *
 * 这里刻意不写成 `switch (def.id)` 的长链：条件一旦变成代码，就再也无法被
 * 「一条数据行」审阅 —— 而这正是上一轮两套真源漂移的原因之一。声明式条件可以
 * 被纯函数 `evaluateCondition()` 逐条求值，也就能被单测逐条覆盖。
 */
export type AchievementCondition =
  /** 直接取一个标量统计值比阈值 */
  | { kind: 'stat'; stat: ScalarStatKey }
  /** 记录型统计求和（如 `skillsUsed` 的各技能次数） */
  | { kind: 'recordSum'; stat: 'skillsUsed' }
  /** 记录型统计取某个 key（如按具体类型统计的击杀、按技能统计的使用次数） */
  | {
      kind: 'recordKey';
      stat: 'enemiesKilledByType' | 'bossKillsByType' | 'skillsUsed';
      key: string;
    }
  /** 命中率百分比 = shotsHit / shotsFired × 100（无射击时为 0） */
  | { kind: 'accuracy' }
  /** 最快通关秒数 ≤ limit（**从未通关时恒不达成**，不能把 0 当成「瞬间通关」） */
  | { kind: 'fastClear'; limit: number }
  /** 除自己以外的所有成就都已解锁 */
  | { kind: 'allAchievements' };

export type ScalarStatKey =
  | 'totalKills'
  | 'totalDeaths'
  | 'highestWave'
  | 'highestScore'
  | 'totalPlayTime'
  | 'powerupsCollected'
  | 'distanceTraveled'
  | 'shotsFired'
  | 'shotsHit'
  | 'missionsCompleted'
  | 'noDamageClears'
  | 'survivalBestTime';

export interface AchievementStats {
  totalKills: number;
  totalDeaths: number;
  highestWave: number;
  highestScore: number;
  totalPlayTime: number;
  enemiesKilledByType: Record<string, number>;
  /**
   * 按**具体敌机类型**统计的 Boss 击杀（`boss-sentinel` / `boss-overlord`）。
   * `enemiesKilledByType` 里的 boss 会被折叠成一个 `boss` 键（那是「累计杀几个
   * Boss」的语义），而「杀掉某一型 Boss」需要保留具体类型 —— 两件事，两个字段。
   */
  bossKillsByType: Record<string, number>;
  powerupsCollected: number;
  skillsUsed: Record<string, number>;
  distanceTraveled: number;
  shotsFired: number;
  shotsHit: number;
  /** 已完成的任务数（来自 `StoryMissionManager.getProgressStats().completed`） */
  missionsCompleted: number;
  /** 无伤通关的关卡数（来自每关结算时 `PlayerShip.getDamageTaken() === 0`） */
  noDamageClears: number;
  /** 通关最快用时（秒）；**0 表示还没通关过**，不是「0 秒通关」 */
  fastestClearSeconds: number;
  /** 生存模式单局最佳存活时间（秒） */
  survivalBestTime: number;
}

export interface AchievementRewards {
  experience: number;
  credits: number;
  score?: number;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  /** UI 图标资源 id，对应 `/assets/textures/ui/icons/<icon>.png` */
  icon: string;
  /** 图标资源缺失时回落显示的字符（保证面板永远可渲染） */
  glyph: string;
  requirement: number;
  condition: AchievementCondition;
  rewards: AchievementRewards;
}

export interface AchievementProgress {
  current: number;
  isUnlocked: boolean;
  unlockedAt?: number;
  notificationShown: boolean;
  /** 奖励是否已发放。兼作老存档的补发依据（老系统只发过分数，没发经验/信用点）。 */
  paid?: boolean;
}

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  [AchievementCategory.COMBAT]: '战斗',
  [AchievementCategory.SURVIVAL]: '生存',
  [AchievementCategory.COLLECTION]: '收集',
  [AchievementCategory.SKILL]: '技巧',
  [AchievementCategory.MISSION]: '任务',
  [AchievementCategory.SPECIAL]: '特殊',
};

export const ACHIEVEMENT_RARITY_META: Record<
  AchievementRarity,
  { label: string; color: string; glow: string }
> = {
  [AchievementRarity.COMMON]: { label: '普通', color: '#9ca3af', glow: 'rgba(156,163,175,0.3)' },
  [AchievementRarity.UNCOMMON]: { label: '精良', color: '#22c55e', glow: 'rgba(34,197,94,0.4)' },
  [AchievementRarity.RARE]: { label: '稀有', color: '#3b82f6', glow: 'rgba(59,130,246,0.4)' },
  [AchievementRarity.EPIC]: { label: '史诗', color: '#a855f7', glow: 'rgba(168,85,247,0.5)' },
  [AchievementRarity.LEGENDARY]: { label: '传说', color: '#f59e0b', glow: 'rgba(245,158,11,0.6)' },
};

/**
 * 成就定义表 —— 唯一真源。
 *
 * id 词表分为两组，各自不得漂移：
 * - 运行时统计向：`first_blood` / `killer_*` / `survivor_*` / `high_score_*` …（原有 id 保持不变，
 *   老存档的解锁状态因此不丢）；
 * - 由 content 层 JSON 迁入的：`boss_sentinel` / `boss_overlord` / `mission_veteran` /
 *   `mission_master` / `flawless` / `speedrun` / `survival_expert` / `legendary_pilot`
 *   （原 `achievement-10..15`；旧 id 从未被任何存储写过，所以改名是安全的）。
 */
const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // ───────────────────────── 战斗：击杀累计 ─────────────────────────
  {
    id: 'first_blood',
    name: '初出茅庐',
    description: '击败第一个敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.COMMON,
    icon: 'icon-crosshair',
    glyph: '⚔️',
    requirement: 1,
    condition: { kind: 'stat', stat: 'totalKills' },
    rewards: { experience: 20, credits: 100, score: 100 },
  },
  {
    id: 'killer_10',
    name: '新晋杀手',
    description: '击败 10 个敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.COMMON,
    icon: 'icon-gun',
    glyph: '🗡️',
    requirement: 10,
    condition: { kind: 'stat', stat: 'totalKills' },
    rewards: { experience: 50, credits: 300, score: 500 },
  },
  {
    id: 'killer_50',
    name: '沙场老将',
    description: '击败 50 个敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.UNCOMMON,
    icon: 'icon-damage',
    glyph: '⚔️',
    requirement: 50,
    condition: { kind: 'stat', stat: 'totalKills' },
    rewards: { experience: 150, credits: 800, score: 2000 },
  },
  {
    // 合并自：运行时「杀戮机器」+ content 层「屠夫」（同一条件：累计 100 杀）
    id: 'killer_100',
    name: '屠杀机器',
    description: '累计击败 100 个敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.RARE,
    icon: 'icon-damage',
    glyph: '💀',
    requirement: 100,
    condition: { kind: 'stat', stat: 'totalKills' },
    rewards: { experience: 300, credits: 1500, score: 5000 },
  },
  {
    id: 'killer_500',
    name: '死亡使者',
    description: '累计击败 500 个敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.EPIC,
    icon: 'icon-bomb',
    glyph: '☠️',
    requirement: 500,
    condition: { kind: 'stat', stat: 'totalKills' },
    rewards: { experience: 1000, credits: 5000, score: 20000 },
  },
  {
    // 迁入自 content 层「歼灭者」（kill_count 1000）
    id: 'killer_1000',
    name: '歼灭者',
    description: '累计击败 1000 个敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.EPIC,
    icon: 'icon-bomb',
    glyph: '☠️',
    requirement: 1000,
    condition: { kind: 'stat', stat: 'totalKills' },
    rewards: { experience: 2000, credits: 10000, score: 30000 },
  },
  {
    id: 'elite_hunter',
    name: '精英猎手',
    description: '击败 10 个精英敌人',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.RARE,
    icon: 'icon-star',
    glyph: '🏆',
    requirement: 10,
    condition: { kind: 'recordKey', stat: 'enemiesKilledByType', key: 'elite' },
    rewards: { experience: 400, credits: 2000, score: 3000 },
  },
  {
    id: 'boss_slayer',
    name: 'Boss 克星',
    description: '击败 5 个 Boss',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.EPIC,
    icon: 'icon-defense',
    glyph: '👹',
    requirement: 5,
    condition: { kind: 'recordKey', stat: 'enemiesKilledByType', key: 'boss' },
    rewards: { experience: 800, credits: 4000, score: 10000 },
  },
  {
    // 迁入自 content 层「Boss 杀手」（boss_defeat boss-sentinel）。
    // key 用**运行时**词表（`boss_sentinel`），因为击杀结算处拿到的是
    // `enemy.getType()` 的运行时类型；两套词表的换算只在 `ENEMY_TYPE_TO_RUNTIME`
    // 一处，`AchievementSystem.test.ts` 有护栏用例把它锁死。
    id: 'boss_sentinel',
    name: '哨兵终结者',
    description: '击败哨兵型 Boss',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.RARE,
    icon: 'icon-defense',
    glyph: '🛡️',
    requirement: 1,
    condition: { kind: 'recordKey', stat: 'bossKillsByType', key: 'boss_sentinel' },
    rewards: { experience: 500, credits: 3000, score: 5000 },
  },
  {
    // 迁入自 content 层「终结者」（boss_defeat boss-overlord）
    id: 'boss_overlord',
    name: '霸主终结者',
    description: '击败霸主型 Boss',
    category: AchievementCategory.COMBAT,
    rarity: AchievementRarity.LEGENDARY,
    icon: 'icon-star',
    glyph: '👑',
    requirement: 1,
    condition: { kind: 'recordKey', stat: 'bossKillsByType', key: 'boss_overlord' },
    rewards: { experience: 5000, credits: 20000, score: 50000 },
  },

  // ───────────────────────── 生存 ─────────────────────────
  {
    id: 'survivor_30s',
    name: '初生牛犊',
    description: '累计存活 30 秒',
    category: AchievementCategory.SURVIVAL,
    rarity: AchievementRarity.COMMON,
    icon: 'icon-clock',
    glyph: '⏱️',
    requirement: 30,
    condition: { kind: 'stat', stat: 'totalPlayTime' },
    rewards: { experience: 30, credits: 150, score: 100 },
  },
  {
    id: 'survivor_5min',
    name: '久经沙场',
    description: '累计存活 5 分钟',
    category: AchievementCategory.SURVIVAL,
    rarity: AchievementRarity.UNCOMMON,
    icon: 'icon-clock',
    glyph: '🛡️',
    requirement: 300,
    condition: { kind: 'stat', stat: 'totalPlayTime' },
    rewards: { experience: 200, credits: 1000, score: 1000 },
  },
  {
    id: 'survivor_10min',
    name: '铁壁防御',
    description: '累计存活 10 分钟',
    category: AchievementCategory.SURVIVAL,
    rarity: AchievementRarity.RARE,
    icon: 'icon-clock',
    glyph: '🏰',
    requirement: 600,
    condition: { kind: 'stat', stat: 'totalPlayTime' },
    rewards: { experience: 500, credits: 2500, score: 3000 },
  },
  {
    // 迁入自 content 层「生存专家」（survival_time 600）——
    // 与 survivor_10min 的区别是**数据源不同**：这里读的是生存模式单局最佳，
    // 不是累计时长。两条是「累计」与「单局」两种口径，不是重复。
    id: 'survival_expert',
    name: '生存专家',
    description: '在生存模式中单局存活 10 分钟',
    category: AchievementCategory.SURVIVAL,
    rarity: AchievementRarity.EPIC,
    icon: 'icon-clock',
    glyph: '🕐',
    requirement: 600,
    condition: { kind: 'stat', stat: 'survivalBestTime' },
    rewards: { experience: 1000, credits: 5000, score: 8000 },
  },
  {
    id: 'wave_5',
    name: '波次先锋',
    description: '到达第 5 波',
    category: AchievementCategory.SURVIVAL,
    rarity: AchievementRarity.UNCOMMON,
    icon: 'icon-star',
    glyph: '🌊',
    requirement: 5,
    condition: { kind: 'stat', stat: 'highestWave' },
    rewards: { experience: 150, credits: 800, score: 2000 },
  },
  {
    id: 'wave_10',
    name: '波次领主',
    description: '到达第 10 波',
    category: AchievementCategory.SURVIVAL,
    rarity: AchievementRarity.RARE,
    icon: 'icon-star',
    glyph: '👑',
    requirement: 10,
    condition: { kind: 'stat', stat: 'highestWave' },
    rewards: { experience: 400, credits: 2000, score: 5000 },
  },

  // ───────────────────────── 收集 ─────────────────────────
  {
    id: 'collector_10',
    name: '拾取达人',
    description: '拾取 10 个道具',
    category: AchievementCategory.COLLECTION,
    rarity: AchievementRarity.COMMON,
    icon: 'icon-energy',
    glyph: '📦',
    requirement: 10,
    condition: { kind: 'stat', stat: 'powerupsCollected' },
    rewards: { experience: 50, credits: 300, score: 500 },
  },
  {
    id: 'collector_50',
    name: '收藏家',
    description: '拾取 50 个道具',
    category: AchievementCategory.COLLECTION,
    rarity: AchievementRarity.UNCOMMON,
    icon: 'icon-energy',
    glyph: '🎁',
    requirement: 50,
    condition: { kind: 'stat', stat: 'powerupsCollected' },
    rewards: { experience: 250, credits: 1200, score: 2000 },
  },
  {
    id: 'health_collector',
    name: '生命汲取',
    description: '通过道具恢复 100 次生命',
    category: AchievementCategory.COLLECTION,
    rarity: AchievementRarity.UNCOMMON,
    icon: 'icon-heart',
    glyph: '❤️',
    requirement: 100,
    condition: { kind: 'recordKey', stat: 'enemiesKilledByType', key: 'health' },
    rewards: { experience: 200, credits: 1000, score: 1500 },
  },

  // ───────────────────────── 技巧 ─────────────────────────
  {
    id: 'skill_master',
    name: '技能大师',
    description: '使用技能 50 次',
    category: AchievementCategory.SKILL,
    rarity: AchievementRarity.UNCOMMON,
    icon: 'icon-energy',
    glyph: '✨',
    requirement: 50,
    condition: { kind: 'recordSum', stat: 'skillsUsed' },
    rewards: { experience: 250, credits: 1200, score: 2500 },
  },
  {
    id: 'missile_master',
    name: '导弹专家',
    description: '使用导弹技能 20 次',
    category: AchievementCategory.SKILL,
    rarity: AchievementRarity.RARE,
    icon: 'icon-missile',
    glyph: '🚀',
    requirement: 20,
    condition: { kind: 'recordKey', stat: 'skillsUsed', key: 'missileStrike' },
    rewards: { experience: 300, credits: 1500, score: 3000 },
  },
  {
    id: 'shield_master',
    name: '护盾大师',
    description: '使用护盾技能 30 次',
    category: AchievementCategory.SKILL,
    rarity: AchievementRarity.RARE,
    icon: 'icon-shield',
    glyph: '🛡️',
    requirement: 30,
    condition: { kind: 'recordKey', stat: 'skillsUsed', key: 'shieldBurst' },
    rewards: { experience: 300, credits: 1500, score: 3000 },
  },
  {
    // 迁入自 content 层「不死之身」（no_damage_mission）；
    // 描述按**实际判定**改写：全项目没有「任务」结算口径，能判定的是「关卡」。
    id: 'flawless',
    name: '不死之身',
    description: '不受任何伤害通关一关',
    category: AchievementCategory.SKILL,
    rarity: AchievementRarity.EPIC,
    icon: 'icon-shield',
    glyph: '🛡️',
    requirement: 1,
    condition: { kind: 'stat', stat: 'noDamageClears' },
    rewards: { experience: 800, credits: 4000, score: 6000 },
  },
  {
    // 迁入自 content 层「速度狂魔」（speed_run 300）
    id: 'speedrun',
    name: '速度狂魔',
    description: '5 分钟内通关一关',
    category: AchievementCategory.SKILL,
    rarity: AchievementRarity.RARE,
    icon: 'icon-speed',
    glyph: '⚡',
    requirement: 1,
    condition: { kind: 'fastClear', limit: 300 },
    rewards: { experience: 600, credits: 3000, score: 4000 },
  },

  // ───────────────────────── 任务 ─────────────────────────
  {
    // 迁入自 content 层「战场老兵」（mission_count 5）
    id: 'mission_veteran',
    name: '战场老兵',
    description: '累计完成 5 个任务',
    category: AchievementCategory.MISSION,
    rarity: AchievementRarity.COMMON,
    icon: 'icon-achieve',
    glyph: '🎖️',
    requirement: 5,
    condition: { kind: 'stat', stat: 'missionsCompleted' },
    rewards: { experience: 200, credits: 1000, score: 1000 },
  },
  {
    // 迁入自 content 层「任务大师」（mission_count 20）
    id: 'mission_master',
    name: '任务大师',
    description: '累计完成 20 个任务',
    category: AchievementCategory.MISSION,
    rarity: AchievementRarity.RARE,
    icon: 'icon-achieve',
    glyph: '🏅',
    requirement: 20,
    condition: { kind: 'stat', stat: 'missionsCompleted' },
    rewards: { experience: 1000, credits: 5000, score: 5000 },
  },

  // ───────────────────────── 特殊 ─────────────────────────
  {
    id: 'high_score_1000',
    name: '初露锋芒',
    description: '单局获得 1000 分',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.COMMON,
    icon: 'icon-star',
    glyph: '⭐',
    requirement: 1000,
    condition: { kind: 'stat', stat: 'highestScore' },
    rewards: { experience: 100, credits: 500, score: 200 },
  },
  {
    id: 'high_score_10000',
    name: '声名鹊起',
    description: '单局获得 10000 分',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.UNCOMMON,
    icon: 'icon-star',
    glyph: '🌟',
    requirement: 10000,
    condition: { kind: 'stat', stat: 'highestScore' },
    rewards: { experience: 300, credits: 1500, score: 1000 },
  },
  {
    id: 'high_score_50000',
    name: '名震四方',
    description: '单局获得 50000 分',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.RARE,
    icon: 'icon-star',
    glyph: '💫',
    requirement: 50000,
    condition: { kind: 'stat', stat: 'highestScore' },
    rewards: { experience: 800, credits: 4000, score: 5000 },
  },
  {
    id: 'high_score_100000',
    name: '传奇之路',
    description: '单局获得 100000 分',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.EPIC,
    icon: 'icon-star',
    glyph: '🔥',
    requirement: 100000,
    condition: { kind: 'stat', stat: 'highestScore' },
    rewards: { experience: 2000, credits: 10000, score: 10000 },
  },
  {
    id: 'perfectionist',
    name: '完美主义者',
    description: '单局命中率达到 100%',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.LEGENDARY,
    icon: 'icon-crosshair',
    glyph: '🎯',
    requirement: 100,
    condition: { kind: 'accuracy' },
    rewards: { experience: 3000, credits: 15000, score: 20000 },
  },
  {
    // 迁入自 content 层「传奇飞行员」（all_achievements）
    id: 'legendary_pilot',
    name: '传奇飞行员',
    description: '解锁其余全部成就',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.LEGENDARY,
    icon: 'icon-star',
    glyph: '👑',
    requirement: 0, // 由 condition 决定（其余成就总数 - 1）
    condition: { kind: 'allAchievements' },
    rewards: { experience: 10000, credits: 50000, score: 100000 },
  },
];

const STORAGE_KEY = 'achievementProgress';

/** 全零统计基线。导出供单测与其它模块构造「干净起点」，避免手抄 16 个字段。 */
export function createEmptyAchievementStats(): AchievementStats {
  return {
    totalKills: 0,
    totalDeaths: 0,
    highestWave: 0,
    highestScore: 0,
    totalPlayTime: 0,
    enemiesKilledByType: {},
    bossKillsByType: {},
    powerupsCollected: 0,
    skillsUsed: {},
    distanceTraveled: 0,
    shotsFired: 0,
    shotsHit: 0,
    missionsCompleted: 0,
    noDamageClears: 0,
    fastestClearSeconds: 0,
    survivalBestTime: 0,
  };
}

/** 记录型统计字段 —— `updateStats` 用它们区分「累加」与「合并」。 */
const RECORD_FIELDS = ['enemiesKilledByType', 'bossKillsByType', 'skillsUsed'] as const;
type RecordField = (typeof RECORD_FIELDS)[number];

function isRecordField(key: keyof AchievementStats): key is RecordField {
  return (RECORD_FIELDS as readonly string[]).includes(key as string);
}

/**
 * 语义为「取最大值」的字段 —— 名字里带 highest、跨局累积，**既不能累加也不能覆盖**。
 *
 * 接线前的真实缺陷：`GameplayManager.onEnemyKilled` 用 `updateStats({ highestScore })`
 * 推当前分，而 `updateStats` 是**累加**语义 —— 每次击杀都把当前总分再加一遍。
 * 结果一局下来 `highestScore` 能涨到几万到几十万，四条分数成就（1000/10000/
 * 50000/100000）会在第一关里挨个白送，连带奖励经济全部失真。
 * 这里把语义收到系统内部，调用方怎么写都不会漂。
 */
const MAX_FIELDS = ['highestScore', 'highestWave'] as const;
type MaxField = (typeof MAX_FIELDS)[number];

function isMaxField(key: keyof AchievementStats): key is MaxField {
  return (MAX_FIELDS as readonly string[]).includes(key as string);
}

/**
 * 条件求值 —— **纯函数**，成就判定的全部逻辑都在这里。
 *
 * `unlockedIds` 只被 `allAchievements` 用到（它要数「除自己以外」解锁了几条）。
 * 返回值语义：`current` 是该条件的当前进度值，`requirement` 是达成阈值；
 * `current >= requirement` 即达成。这样面板能直接画进度条，不需要自己再解释条件。
 */
export function evaluateCondition(
  def: AchievementDefinition,
  stats: AchievementStats,
  unlockedIds: ReadonlySet<string>,
  definitions: readonly AchievementDefinition[],
): { current: number; requirement: number } {
  const condition = def.condition;

  switch (condition.kind) {
    case 'stat':
      return { current: stats[condition.stat] ?? 0, requirement: def.requirement };

    case 'recordSum': {
      const record = stats[condition.stat] ?? {};
      const sum = Object.values(record).reduce((a, b) => a + (Number(b) || 0), 0);
      return { current: sum, requirement: def.requirement };
    }

    case 'recordKey': {
      const record = stats[condition.stat] ?? {};
      return { current: record[condition.key] ?? 0, requirement: def.requirement };
    }

    case 'accuracy': {
      if (stats.shotsFired <= 0) return { current: 0, requirement: def.requirement };
      const pct = (stats.shotsHit / stats.shotsFired) * 100;
      // 分裂弹/穿透弹可能让命中数超过开火数，夹到 100 以免出现「120% 命中率」
      return { current: Math.min(100, pct), requirement: def.requirement };
    }

    case 'fastClear': {
      // 0 = 从未通关。绝不能把 0 当成「0 秒通关」，否则刚进游戏就会白送。
      if (stats.fastestClearSeconds <= 0) return { current: 0, requirement: 1 };
      return { current: stats.fastestClearSeconds <= condition.limit ? 1 : 0, requirement: 1 };
    }

    case 'allAchievements': {
      // 分子/分母都是「**其余**成就」—— 把自己排除在外，否则这条永远无法达成
      let unlockedOthers = 0;
      let others = 0;
      for (const other of definitions) {
        if (other.id === def.id) continue;
        others++;
        if (unlockedIds.has(other.id)) unlockedOthers++;
      }
      return { current: unlockedOthers, requirement: Math.max(1, others) };
    }
  }
}

export function getAchievementDefinitions(): readonly AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS;
}

export interface AchievementSnapshotEntry extends AchievementDefinition {
  progress: AchievementProgress;
}

export interface AchievementSnapshot {
  entries: AchievementSnapshotEntry[];
  stats: AchievementStats;
  total: number;
  unlocked: number;
  completion: number;
  earnedExperience: number;
  earnedCredits: number;
}

export class AchievementSystem {
  private achievements: Map<string, AchievementProgress> = new Map();
  private stats: AchievementStats = createEmptyAchievementStats();
  private listeners: ((achievement: AchievementDefinition) => void)[] = [];
  /** 防抖：只有真正发生过变更（解锁/进度推进）才写 localStorage。 */
  private dirty = false;

  constructor() {
    this.loadProgress();
  }

  public initialize(): void {
    // 这里的每一步都是幂等的：补定义只补缺的、补发奖励有 paid 凭证、判定只对
    // 未解锁的生效。所以可以放心被多次调用（GameplayManager 开局调一次、
    // 成就面板每次打开再调一次，两条路径都不会重复发奖）。
    this.seedDefinitions();
    this.payOutstandingRewards();
    this.checkAchievements();
    this.flush();
  }

  /**
   * 确保定义表里的每条成就都有对应的进度记录。
   *
   * 必须能重复调用：`resetProgress()` 会先清空 map 再重建。早先的写法是
   * `initialize()` 开头 `if (this.initialized) return;` —— 于是重置之后 map 是空的，
   * 而 `updateStats` 里的 `if (!progress) return;` 会让**任何成就都不再解锁**
   * （静默失效，不报错），所以这里把「补表」独立出来。
   */
  private seedDefinitions(): void {
    ACHIEVEMENT_DEFINITIONS.forEach((def) => {
      if (!this.achievements.has(def.id)) {
        this.achievements.set(def.id, {
          current: 0,
          isUnlocked: false,
          notificationShown: false,
          paid: false,
        });
      }
    });
  }

  private isRecordFieldKey(key: keyof AchievementStats): key is RecordField {
    return isRecordField(key);
  }

  /** 累加式更新（击杀 +1、道具 +1 这类）。 */
  public updateStats(updates: Partial<AchievementStats>): void {
    Object.keys(updates).forEach((rawKey) => {
      const key = rawKey as keyof AchievementStats;
      const value = updates[key];
      if (value === undefined) return;

      if (typeof value === 'number') {
        if (this.isRecordFieldKey(key)) return; // 记录字段不接受数字累加
        if (isMaxField(key)) {
          this.applyMax(key, value);
        } else if (key === 'fastestClearSeconds') {
          this.setFastestClear(value);
        } else {
          (this.stats[key] as number) += value;
        }
      } else if (typeof value === 'object' && value !== null && this.isRecordFieldKey(key)) {
        const current = this.stats[key] as Record<string, number>;
        const merged = { ...current };
        Object.entries(value as Record<string, number>).forEach(([k, v]) => {
          merged[k] = (merged[k] ?? 0) + (Number(v) || 0);
        });
        this.stats[key] = merged;
      }
    });

    this.markDirtyAndCommit();
  }

  /** 覆盖式更新（最高分、累计时长、命中数这类「真值」）。 */
  public setStats(updates: Partial<AchievementStats>): void {
    Object.keys(updates).forEach((rawKey) => {
      const key = rawKey as keyof AchievementStats;
      const value = updates[key];
      if (value === undefined) return;

      if (key === 'fastestClearSeconds' && typeof value === 'number') {
        this.setFastestClear(value);
        return;
      }

      if (typeof value === 'number') {
        if (this.isRecordFieldKey(key)) return;
        if (isMaxField(key)) {
          this.applyMax(key, value);
          return;
        }
        (this.stats[key] as number) = value;
      } else if (typeof value === 'object' && value !== null && this.isRecordFieldKey(key)) {
        this.stats[key] = value as Record<string, number>;
      }
    });

    this.markDirtyAndCommit();
  }

  /** 取最大值（`highestScore` / `highestWave`）。 */
  private applyMax(key: MaxField, value: number): void {
    if (!Number.isFinite(value)) return;
    if (value > this.stats[key]) {
      this.stats[key] = value;
    }
  }

  /** 最快通关只接受「更小且非零」的值，避免被覆盖成更差成绩。 */
  private setFastestClear(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const current = this.stats.fastestClearSeconds;
    if (current <= 0 || seconds < current) {
      this.stats.fastestClearSeconds = seconds;
    }
  }

  private markDirtyAndCommit(): void {
    this.checkAchievements();
    this.flush();
  }

  private checkAchievements(): void {
    const unlockedIds = new Set<string>();
    this.achievements.forEach((p, id) => {
      if (p.isUnlocked) unlockedIds.add(id);
    });

    ACHIEVEMENT_DEFINITIONS.forEach((def) => {
      const progress = this.achievements.get(def.id);
      if (!progress) return;

      const { current, requirement } = evaluateCondition(
        def,
        this.stats,
        unlockedIds,
        ACHIEVEMENT_DEFINITIONS,
      );

      if (progress.current !== current) {
        progress.current = current;
        this.dirty = true;
      }

      if (!progress.isUnlocked && current >= requirement) {
        this.unlockAchievement(def, progress);
        unlockedIds.add(def.id);
      }
    });
  }

  private unlockAchievement(def: AchievementDefinition, progress: AchievementProgress): void {
    progress.isUnlocked = true;
    progress.unlockedAt = Date.now();
    this.dirty = true;

    this.grantRewards(def, progress);

    this.listeners.forEach((listener) => listener(def));
    console.log(
      `[Achievement] 解锁：${def.name}（${def.id}）→ 经验 +${def.rewards.experience}、` +
        `信用点 +${def.rewards.credits}${def.rewards.score ? `、分数 +${def.rewards.score}` : ''}`,
    );
  }

  private grantRewards(def: AchievementDefinition, progress: AchievementProgress): void {
    const { experience, credits, score } = def.rewards;
    const store = useGameStore.getState();
    if (score) store.addScore(score);
    if (experience) store.addExperience(experience);
    if (credits) addCredits(credits);
    progress.paid = true;
  }

  /** 补发老存档里「已解锁但从未发过经验/信用点」的奖励（一次性）。 */
  private payOutstandingRewards(): void {
    let count = 0;
    let exp = 0;
    let credits = 0;
    ACHIEVEMENT_DEFINITIONS.forEach((def) => {
      const progress = this.achievements.get(def.id);
      if (!progress || !progress.isUnlocked || progress.paid) return;
      const store = useGameStore.getState();
      store.addExperience(def.rewards.experience);
      addCredits(def.rewards.credits);
      progress.paid = true;
      count++;
      exp += def.rewards.experience;
      credits += def.rewards.credits;
      this.dirty = true;
    });
    if (count > 0) {
      console.log(
        `[Achievement] 补发未结算奖励：${count} 条 → 经验 +${exp}、信用点 +${credits}` +
          `（旧版本解锁时只发分数，经验/信用点从未入账）`,
      );
    }
  }

  public onAchievementUnlocked(callback: (achievement: AchievementDefinition) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public getAchievement(id: string): AchievementDefinition | undefined {
    return ACHIEVEMENT_DEFINITIONS.find((a) => a.id === id);
  }

  public getAchievementProgress(id: string): AchievementProgress | undefined {
    return this.achievements.get(id);
  }

  public getAllAchievements(): AchievementSnapshotEntry[] {
    const unlockedIds = new Set<string>();
    this.achievements.forEach((p, id) => {
      if (p.isUnlocked) unlockedIds.add(id);
    });

    return ACHIEVEMENT_DEFINITIONS.map((def) => {
      const stored = this.achievements.get(def.id);
      const { current, requirement } = evaluateCondition(
        def,
        this.stats,
        unlockedIds,
        ACHIEVEMENT_DEFINITIONS,
      );
      const progress: AchievementProgress = stored
        ? { ...stored, current, isUnlocked: stored.isUnlocked || current >= requirement }
        : { current, isUnlocked: current >= requirement, notificationShown: false, paid: false };
      // requirement 用**求值结果**而不是定义里的占位值：
      // `allAchievements` 的阈值不是常量（= 其余成就总数），定义里只能写 0，
      // 面板直接读定义会画出「0/0」这种空进度条。
      return { ...def, requirement, progress };
    });
  }

  public getAchievementsByCategory(category: AchievementCategory): AchievementSnapshotEntry[] {
    return this.getAllAchievements().filter((a) => a.category === category);
  }

  public getUnlockedCount(): number {
    let count = 0;
    this.achievements.forEach((progress) => {
      if (progress.isUnlocked) count++;
    });
    return count;
  }

  public getTotalCount(): number {
    return ACHIEVEMENT_DEFINITIONS.length;
  }

  public getCompletionPercentage(): number {
    return (this.getUnlockedCount() / this.getTotalCount()) * 100;
  }

  public getStats(): AchievementStats {
    return { ...this.stats };
  }

  /**
   * 面板用的只读快照 —— 面板是这张表的**视图**，自己不算任何东西。
   * `earnedExperience` / `earnedCredits` 合计的是**已解锁**成就的奖励，
   * 与界面顶部那两个数字的含义一致（是"已拿到手的"，不是"总数的"）。
   */
  public getSnapshot(): AchievementSnapshot {
    const entries = this.getAllAchievements();
    const unlocked = entries.filter((e) => e.progress.isUnlocked);
    return {
      entries,
      stats: this.getStats(),
      total: entries.length,
      unlocked: unlocked.length,
      completion: entries.length > 0 ? (unlocked.length / entries.length) * 100 : 0,
      earnedExperience: unlocked.reduce((sum, e) => sum + e.rewards.experience, 0),
      earnedCredits: unlocked.reduce((sum, e) => sum + e.rewards.credits, 0),
    };
  }

  public resetProgress(): void {
    this.achievements.clear();
    this.stats = createEmptyAchievementStats();
    this.dirty = true;
    this.seedDefinitions();
    this.checkAchievements();
    this.flush();
  }

  /** 只重置解锁状态、保留统计数据（验证脚本用的可控入口）。 */
  public resetUnlocks(): void {
    this.achievements.clear();
    this.seedDefinitions();
    this.dirty = true;
    this.checkAchievements();
    this.flush();
  }

  private flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.saveProgress();
  }

  private saveProgress(): void {
    const data = {
      achievements: Array.from(this.achievements.entries()),
      stats: this.stats,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[Achievement] 进度写入失败', e);
    }
  }

  private loadProgress(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const data = JSON.parse(saved) as {
        achievements?: [string, AchievementProgress][];
        stats?: Partial<AchievementStats>;
      };
      if (Array.isArray(data.achievements)) {
        this.achievements = new Map(data.achievements);
      }
      // 老存档缺新字段（bossKillsByType / missionsCompleted / …）→ 用空值补齐，
      // 否则 evaluateCondition 会读到 undefined。spread undefined 是安全 no-op。
      this.stats = { ...createEmptyAchievementStats(), ...data.stats };
    } catch {
      console.warn('[Achievement] 进度读取失败，按空进度处理');
    }
  }
}

export const achievementSystem = new AchievementSystem();
export default achievementSystem;
