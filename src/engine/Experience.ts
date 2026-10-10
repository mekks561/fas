/**
 * 经验 → 等级：唯一真源（纯函数，不碰存储）。
 *
 * 背景：关卡奖励配置里的 `rewards.experience`、成就面板/任务追踪显示的 `+N EXP`
 * 一直在界面层「发经验」，但**没有任何系统消费它** —— 等级来自「每清空一波 +1 级」
 * 的波次计数，与经验完全无关。这是典型的「界面承诺了系统不兑现」。
 *
 * 现在把等级的来源收敛到这一处：**等级 = 累计经验查表**，经验只从两个口入账
 * （清波 + 通关奖励，外加任务完成），统统走 `useGameStore.addExperience`。
 * 累计经验本身存在 store 里（与等级同一次写入、同一个持久化 key），所以这里
 * 只放「曲线」，不放存储 —— 避免出现第二个存储真源。
 *
 * 曲线标定（为什么是这两个分段）：
 * - 1~4 级：每级 100 点 = **1 波的经验**，与旧的「每清一波 +1 级」数学等价。
 *   第 1 关 3 波 + 通关奖励 100 = 400 点 → 4 级，和改之前完全一致（这一点很关键：
 *   改等级来源不该顺手改变已有的成长节奏与关卡解锁时机）。
 * - 5 级起：每级 200 点（步长翻倍）。目的是抑制「天赋点通胀」：如果一直 100/级，
 *   通关奖励会让等级涨得比改之前更快，玩家会更早拿满技能树。
 *
 * 关卡解锁门槛是 `recommendedLevelForIndex(i) = i * 2 + 1`，可解锁性由
 * `Experience.test.ts` 的「门槛可达性」用例锁住 —— 调曲线时测试会指出哪一关锁死了。
 */

/** 每清空一波发放的经验。同时也是 1~4 级的升级步长（1 波 = 1 级）。 */
export const EXP_PER_WAVE = 100;

/** 等级上限。关卡门槛最高只到 19（第 10 关），这里给足余量。 */
export const MAX_LEVEL = 99;

/** 5 级起的升级步长（= 2 波的量）。 */
export const EXP_PER_LEVEL_LATE = EXP_PER_WAVE * 2;

/**
 * 升到 `level` 级所需的**累计**经验。
 * 1 级恒为 0（新号就是 1 级）。
 */
export function expForLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 1) return 0;
  const target = Math.min(MAX_LEVEL, Math.floor(level));
  if (target <= 4) return (target - 1) * EXP_PER_WAVE;
  return 3 * EXP_PER_WAVE + (target - 4) * EXP_PER_LEVEL_LATE;
}

/**
 * 累计经验对应的等级（`expForLevel` 的逆函数）。
 *
 * 不变式：`expForLevel(levelForExp(e)) <= e`，且 `levelForExp(expForLevel(L)) === L`。
 */
export function levelForExp(exp: number): number {
  // NaN 当 0（脏数据回落），±Infinity 照常走公式（会被 MAX_LEVEL 夹住）
  if (Number.isNaN(exp)) return 1;
  const e = Math.max(0, Math.floor(exp));
  if (e < 3 * EXP_PER_WAVE) return Math.floor(e / EXP_PER_WAVE) + 1;
  const level = 4 + Math.floor((e - 3 * EXP_PER_WAVE) / EXP_PER_LEVEL_LATE);
  return Math.min(MAX_LEVEL, level);
}

/** 从当前累计经验升到下一级还需多少经验（已满级返回 0）。 */
export function expToNextLevel(exp: number): number {
  const level = levelForExp(exp);
  if (level >= MAX_LEVEL) return 0;
  const current = Number.isFinite(exp) ? Math.max(0, Math.floor(exp)) : 0;
  return Math.max(0, expForLevel(level + 1) - current);
}

/** 当前等级内的进度（0~1），供 HUD 经验条使用；满级恒为 1。 */
export function expProgressInLevel(exp: number): number {
  const level = levelForExp(exp);
  if (level >= MAX_LEVEL) return 1;
  const base = expForLevel(level);
  const next = expForLevel(level + 1);
  if (next <= base) return 1;
  const current = Number.isFinite(exp) ? Math.max(0, Math.floor(exp)) : base;
  return Math.min(1, Math.max(0, (current - base) / (next - base)));
}
