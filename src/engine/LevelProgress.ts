/**
 * 关卡进度（通关记录 + 星级）的唯一读写入口。
 *
 * 背景：LevelSelect 一直在读 localStorage 的 `levelProgress`，但**没有任何
 * 代码写过它** —— 结果星星永远 0、通关记录永远为空，「下一关解锁」无从判定。
 * 这里补齐写入侧，并与读侧收敛到同一个 key。
 *
 * 存储选型与 CreditsStore 一致：localStorage（本机），清缓存会丢。
 */

const PROGRESS_KEY = 'levelProgress';

export interface LevelRecord {
  /** 是否已通关。 */
  cleared: boolean;
  /** 最佳星级（0-3）。 */
  stars: number;
  /** 最高分。 */
  highScore?: number;
  /** 最近一次通关时间（ISO）。 */
  clearedAt?: string;
}

export type LevelProgressMap = Record<string, LevelRecord>;

/** 读取全部关卡进度；损坏或缺失时返回空表。 */
export function getLevelProgress(): LevelProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LevelProgressMap) : {};
  } catch {
    return {};
  }
}

/** 某关是否已通关（1 基 id）。 */
export function isLevelCleared(levelId: number): boolean {
  return Boolean(getLevelProgress()[String(levelId)]?.cleared);
}

/**
 * 记录一次通关。星级取历史最好成绩，不会因一次低星覆盖高星。
 * @param levelId 1 基关卡 id
 * @param stars 本次星级（0-3）
 * @param score 本次分数（可选，取历史最高）
 */
export function markLevelCleared(levelId: number, stars: number, score?: number): LevelRecord {
  const map = getLevelProgress();
  const key = String(levelId);
  const prev = map[key];
  const record: LevelRecord = {
    cleared: true,
    stars: Math.max(prev?.stars ?? 0, Math.min(3, Math.max(0, Math.floor(stars)))),
    highScore: Math.max(prev?.highScore ?? 0, score ?? 0),
    clearedAt: new Date().toISOString(),
  };
  map[key] = record;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    /* 隐私模式下写入失败不应中断游戏流程 */
  }
  return record;
}
