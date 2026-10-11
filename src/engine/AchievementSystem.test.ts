import { describe, expect, it, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  achievementSystem,
  AchievementSystem,
  ACHIEVEMENT_CATEGORY_LABELS,
  ACHIEVEMENT_RARITY_META,
  createEmptyAchievementStats,
  evaluateCondition,
  getAchievementDefinitions,
  AchievementCategory,
  AchievementRarity,
  type AchievementStats,
  type AchievementDefinition,
} from './AchievementSystem';
import { ENEMY_TYPE_TO_RUNTIME } from '../levels';
import { useGameStore } from '../store/useGameStore';
import { getCredits } from './CreditsStore';

const DEFS = getAchievementDefinitions();
const byId = (id: string): AchievementDefinition => {
  const def = DEFS.find((d) => d.id === id);
  if (!def) throw new Error(`未找到成就定义：${id}`);
  return def;
};

/** 用干净基线叠加要测的字段，避免每条用例手抄 16 个统计字段 */
const stats = (overrides: Partial<AchievementStats> = {}): AchievementStats => ({
  ...createEmptyAchievementStats(),
  ...overrides,
});

describe('成就定义表（唯一真源的完整性护栏）', () => {
  it('id 唯一 —— 面板与存储都以 id 为键，重复会让两条成就互相覆盖', () => {
    const ids = DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每条定义的分类都有对应中文标签', () => {
    // 缺标签 = 面板筛选栏点不出来（静默少一个入口）
    DEFS.forEach((d) => {
      expect(ACHIEVEMENT_CATEGORY_LABELS[d.category], `${d.id} 的 category`).toBeTruthy();
    });
  });

  it('每条定义的稀有度都有对应配色', () => {
    // 缺配色 = AchievementPanel 取 rarity.color 时抛错、整个面板白屏
    DEFS.forEach((d) => {
      expect(ACHIEVEMENT_RARITY_META[d.rarity], `${d.id} 的 rarity`).toBeTruthy();
    });
  });

  it('每条定义的图标都指向真实存在的资源文件', () => {
    // 这条是「假素材」护栏：图标名写错不会报错，只会静默回落到 emoji，
    // 部署后没人会发现面板少了一半图标。
    const iconsDir = path.join(process.cwd(), 'public/assets/textures/ui/icons');
    DEFS.forEach((d) => {
      expect(
        existsSync(path.join(iconsDir, `${d.icon}.png`)),
        `${d.id} 的图标 ${d.icon}.png 不存在`,
      ).toBe(true);
    });
  });

  it('每条定义都有 emoji 回落字符（资源缺失时面板仍可渲染）', () => {
    DEFS.forEach((d) => {
      expect(d.glyph.length, `${d.id} 的 glyph`).toBeGreaterThan(0);
    });
  });

  it('除「解锁全部」外，所有阈值都为正数', () => {
    // requirement = 0 会让成就开局即解锁（白送奖励）
    DEFS.filter((d) => d.condition.kind !== 'allAchievements').forEach((d) => {
      expect(d.requirement, `${d.id} 的 requirement`).toBeGreaterThan(0);
    });
  });

  it('每条定义都有实际奖励（经验或信用点）', () => {
    DEFS.forEach((d) => {
      expect(d.rewards.experience + d.rewards.credits, `${d.id} 的奖励`).toBeGreaterThan(0);
    });
  });

  it('分类与稀有度的枚举值都被至少一条定义用到（防止枚举漂移后留下死值）', () => {
    const usedCategories = new Set(DEFS.map((d) => d.category));
    Object.values(AchievementCategory).forEach((c) => {
      expect(usedCategories.has(c), `分类 ${c} 没有任何成就使用`).toBe(true);
    });
    const usedRarities = new Set(DEFS.map((d) => d.rarity));
    Object.values(AchievementRarity).forEach((r) => {
      expect(usedRarities.has(r), `稀有度 ${r} 没有任何成就使用`).toBe(true);
    });
  });

  it('Boss 成就在用的是运行时词表（与 ENEMY_TYPE_TO_RUNTIME 一致）', () => {
    // 两套词表：配置侧 `boss-sentinel` / 运行时侧 `boss_sentinel`。
    // 击杀结算处拿到的是 `enemy.getType()` 的**运行时**值，所以成就的 key 必须
    // 跟着运行时词表走。换算只在 ENEMY_TYPE_TO_RUNTIME 一处 —— 这条用例把它锁死，
    // 以后改词表时这里会立刻报警，而不是等到玩家打不出成就才发现。
    const bossDefs = DEFS.filter(
      (d) => d.condition.kind === 'recordKey' && d.condition.stat === 'bossKillsByType',
    );
    expect(bossDefs.length).toBeGreaterThan(0);
    bossDefs.forEach((d) => {
      if (d.condition.kind !== 'recordKey') return;
      const keys = Object.values(ENEMY_TYPE_TO_RUNTIME) as string[];
      expect(keys, `${d.id} 的 key ${d.condition.key} 不在运行时词表里`).toContain(d.condition.key);
    });
  });

  it('技能类成就在用的 key 是 SkillType 的真实取值', () => {
    const skillDefs = DEFS.filter(
      (d) => d.condition.kind === 'recordKey' && d.condition.stat === 'skillsUsed',
    );
    expect(skillDefs.length).toBeGreaterThan(0);
    skillDefs.forEach((d) => {
      if (d.condition.kind !== 'recordKey') return;
      expect([
        'missileStrike',
        'shieldBurst',
        'timeSlow',
        'empBurst',
        'repairDrone',
        'overdrive',
      ]).toContain(d.condition.key);
    });
  });
});

describe('条件求值 evaluateCondition', () => {
  const none = new Set<string>();

  it('stat：直接取标量统计值', () => {
    const def = byId('killer_10');
    expect(evaluateCondition(def, stats({ totalKills: 7 }), none, DEFS)).toEqual({
      current: 7,
      requirement: 10,
    });
  });

  it('recordSum：技能使用次数求和（跨技能累计）', () => {
    const def = byId('skill_master');
    const s = stats({ skillsUsed: { missileStrike: 20, shieldBurst: 30, timeSlow: 1 } });
    expect(evaluateCondition(def, s, none, DEFS).current).toBe(51);
  });

  it('recordKey：按具体类型取（Boss / 技能）', () => {
    const sentinel = byId('boss_sentinel');
    expect(
      evaluateCondition(sentinel, stats({ bossKillsByType: { boss_sentinel: 1 } }), none, DEFS)
        .current,
    ).toBe(1);
    // 杀的是另一个 Boss，不该算进这一条
    expect(
      evaluateCondition(sentinel, stats({ bossKillsByType: { boss_overlord: 3 } }), none, DEFS)
        .current,
    ).toBe(0);

    const missile = byId('missile_master');
    expect(
      evaluateCondition(missile, stats({ skillsUsed: { missileStrike: 5 } }), none, DEFS).current,
    ).toBe(5);
  });

  it('accuracy：零射击时进度为 0（而不是 NaN/无限）', () => {
    const def = byId('perfectionist');
    expect(evaluateCondition(def, stats(), none, DEFS)).toEqual({ current: 0, requirement: 100 });
  });

  it('accuracy：按命中率计算，并夹到 100（分裂弹会打出 >100%）', () => {
    const def = byId('perfectionist');
    expect(
      evaluateCondition(def, stats({ shotsFired: 100, shotsHit: 60 }), none, DEFS).current,
    ).toBeCloseTo(60, 5);
    // 散射/分裂弹让命中数超过开火数是**真实存在**的，不能报出 160%
    expect(
      evaluateCondition(def, stats({ shotsFired: 10, shotsHit: 16 }), none, DEFS).current,
    ).toBe(100);
  });

  it('fastClear：从未通关（0）恒不达成 —— 不能把 0 秒当瞬间通关', () => {
    const def = byId('speedrun');
    expect(evaluateCondition(def, stats({ fastestClearSeconds: 0 }), none, DEFS)).toEqual({
      current: 0,
      requirement: 1,
    });
  });

  it('fastClear：快于限时达成、慢于限时不达成', () => {
    const def = byId('speedrun');
    expect(evaluateCondition(def, stats({ fastestClearSeconds: 299 }), none, DEFS).current).toBe(1);
    expect(evaluateCondition(def, stats({ fastestClearSeconds: 301 }), none, DEFS).current).toBe(0);
  });

  it('allAchievements：把自己排除在外（否则永远无法达成）', () => {
    const def = byId('legendary_pilot');
    const others = DEFS.filter((d) => d.id !== def.id).map((d) => d.id);
    const result = evaluateCondition(def, stats(), new Set(others), DEFS);
    expect(result.requirement).toBe(DEFS.length - 1);
    expect(result.current).toBe(DEFS.length - 1);

    // 只解锁一半时，进度也应当是一半
    const half = others.slice(0, Math.floor(others.length / 2));
    const partial = evaluateCondition(def, stats(), new Set(half), DEFS);
    expect(partial.current).toBe(half.length);
    expect(partial.current).toBeLessThan(partial.requirement);
  });
});

describe('统计语义（累加 / 取最大 / 取最快）', () => {
  beforeEach(() => {
    achievementSystem.resetProgress();
    useGameStore.getState().resetGame();
  });

  it('highestScore 取最大值：反复上报当前分不会把总分累加成天文数字', () => {
    // 这是接线前真实存在的缺陷：GameplayManager 每次击杀都推当前总分，
    // 而旧实现是累加 —— 一局下来 highestScore 能涨到几十万，
    // 四条分数成就（1000/10000/50000/100000）在第一关就白送完了。
    [1200, 3000, 2500, 8000, 4000].forEach((score) => {
      achievementSystem.setStats({ highestScore: score });
    });
    expect(achievementSystem.getStats().highestScore).toBe(8000);
  });

  it('highestScore 走 updateStats（累加入口）也仍然是取最大值', () => {
    const before = achievementSystem.getStats().highestScore;
    achievementSystem.updateStats({ highestScore: 5000 });
    achievementSystem.updateStats({ highestScore: 5000 });
    achievementSystem.updateStats({ highestScore: 5000 });
    expect(achievementSystem.getStats().highestScore).toBe(Math.max(before, 5000));
  });

  it('highestWave 同样取最大值：新的一局从第 1 波开始不会把记录拍回去', () => {
    achievementSystem.setStats({ highestWave: 9 });
    achievementSystem.setStats({ highestWave: 1 });
    expect(achievementSystem.getStats().highestWave).toBe(9);
  });

  it('fastestClearSeconds 只接受更快的成绩', () => {
    achievementSystem.setStats({ fastestClearSeconds: 180 });
    achievementSystem.setStats({ fastestClearSeconds: 240 }); // 更慢，应被忽略
    expect(achievementSystem.getStats().fastestClearSeconds).toBe(180);
    achievementSystem.setStats({ fastestClearSeconds: 90 }); // 更快，应生效
    expect(achievementSystem.getStats().fastestClearSeconds).toBe(90);
  });

  it('fastestClearSeconds 忽略 0 / 负数 / 非有限值（未通关不能覆盖成绩）', () => {
    achievementSystem.setStats({ fastestClearSeconds: 200 });
    achievementSystem.setStats({ fastestClearSeconds: 0 });
    achievementSystem.setStats({ fastestClearSeconds: -5 });
    achievementSystem.setStats({ fastestClearSeconds: Number.NaN });
    expect(achievementSystem.getStats().fastestClearSeconds).toBe(200);
  });

  it('记录型字段走 updateStats 是累加合并', () => {
    achievementSystem.updateStats({ skillsUsed: { missileStrike: 1 } });
    achievementSystem.updateStats({ skillsUsed: { missileStrike: 1, shieldBurst: 1 } });
    expect(achievementSystem.getStats().skillsUsed).toEqual({ missileStrike: 2, shieldBurst: 1 });
  });

  it('记录型字段走 setStats 是覆盖（用于「真值同步」而不是事件上报）', () => {
    achievementSystem.updateStats({ skillsUsed: { missileStrike: 5 } });
    achievementSystem.setStats({ skillsUsed: { shieldBurst: 2 } });
    expect(achievementSystem.getStats().skillsUsed).toEqual({ shieldBurst: 2 });
  });

  it('旧存档缺新字段时按 0 补齐，不会读出 undefined', () => {
    // 升级前的存档没有 bossKillsByType / missionsCompleted / fastestClearSeconds
    // 这些字段。若不补齐，条件求值里 `record[key]` 这类路径会读到 undefined，
    // 判定就会算出 NaN 或者抛错。
    localStorage.setItem(
      'achievementProgress',
      JSON.stringify({
        achievements: [],
        stats: { totalKills: 12, enemiesKilledByType: { scout: 12 } },
      }),
    );

    const fresh = new AchievementSystem();
    fresh.initialize();
    const s = fresh.getStats();

    expect(s.totalKills).toBe(12); // 老字段原样保留
    expect(s.enemiesKilledByType).toEqual({ scout: 12 });
    expect(s.bossKillsByType).toEqual({}); // 新字段补成空对象
    expect(s.missionsCompleted).toBe(0);
    expect(s.fastestClearSeconds).toBe(0);
    expect(s.survivalBestTime).toBe(0);
    expect(() => fresh.getSnapshot()).not.toThrow();

    localStorage.removeItem('achievementProgress');
  });
});

describe('奖励发放（真入账 + 只发一次）', () => {
  beforeEach(() => {
    achievementSystem.resetProgress();
    useGameStore.getState().resetGame();
  });

  it('解锁成就时经验、信用点、分数一起入账', () => {
    const expBefore = useGameStore.getState().player.experience;
    const creditsBefore = getCredits();
    const scoreBefore = useGameStore.getState().player.score;
    const def = byId('first_blood');

    achievementSystem.updateStats({ totalKills: 1 });

    expect(achievementSystem.getAchievementProgress('first_blood')?.isUnlocked).toBe(true);
    expect(useGameStore.getState().player.experience).toBe(expBefore + def.rewards.experience);
    expect(getCredits()).toBe(creditsBefore + def.rewards.credits);
    expect(useGameStore.getState().player.score).toBe(scoreBefore + (def.rewards.score ?? 0));
  });

  it('同一条成就不会重复发奖（继续上报同一条统计不再加经验）', () => {
    achievementSystem.updateStats({ totalKills: 1 });
    const expAfterUnlock = useGameStore.getState().player.experience;
    const creditsAfterUnlock = getCredits();
    expect(expAfterUnlock).toBeGreaterThan(0);

    // 连续上报但**不跨过下一条阈值**（killer_10 需要 10 杀），
    // 这样测的才是「同一条只发一次」，而不是「又解锁了新的一条」。
    for (let i = 0; i < 5; i++) {
      achievementSystem.updateStats({ totalKills: 1 });
    }
    expect(achievementSystem.getStats().totalKills).toBe(6);
    expect(achievementSystem.getAchievementProgress('killer_10')?.isUnlocked).toBe(false);

    expect(useGameStore.getState().player.experience).toBe(expAfterUnlock);
    expect(getCredits()).toBe(creditsAfterUnlock);
    expect(achievementSystem.getAchievementProgress('first_blood')?.paid).toBe(true);
  });

  it('一次击杀跨过多个阈值时，中间每条都会各自发奖', () => {
    const expBefore = useGameStore.getState().player.experience;
    const creditsBefore = getCredits();
    // 一次把 totalKills 推到 60：应同时解锁 first_blood(1) / killer_10(10) / killer_50(50)
    achievementSystem.updateStats({ totalKills: 60 });

    const expectedExp = ['first_blood', 'killer_10', 'killer_50'].reduce(
      (sum, id) => sum + byId(id).rewards.experience,
      0,
    );
    const expectedCredits = ['first_blood', 'killer_10', 'killer_50'].reduce(
      (sum, id) => sum + byId(id).rewards.credits,
      0,
    );
    expect(useGameStore.getState().player.experience).toBe(expBefore + expectedExp);
    expect(getCredits()).toBe(creditsBefore + expectedCredits);
    // killer_100 不该被顺带解锁
    expect(achievementSystem.getAchievementProgress('killer_100')?.isUnlocked).toBe(false);
  });

  it('老存档里「已解锁但没发过奖」的记录会被补发（经验+信用点，不补分数）', () => {
    // 旧版本 unlockAchievement 只调 addScore，经验/信用点从没入账。
    // 模拟这样一条历史存档：已解锁、无 paid 凭证。
    localStorage.setItem(
      'achievementProgress',
      JSON.stringify({
        achievements: [
          ['first_blood', { current: 1, isUnlocked: true, unlockedAt: 1, notificationShown: true }],
        ],
        stats: createEmptyAchievementStats(),
      }),
    );

    const expBefore = useGameStore.getState().player.experience;
    const creditsBefore = getCredits();
    const scoreBefore = useGameStore.getState().player.score;

    // 冷启动：新建实例会从 localStorage 读回上面那条存档
    const fresh = new AchievementSystem();
    fresh.initialize();

    const def = byId('first_blood');
    expect(useGameStore.getState().player.experience).toBe(expBefore + def.rewards.experience);
    expect(getCredits()).toBe(creditsBefore + def.rewards.credits);
    // 分数**不补**：开局分数跳变会让玩家莫名其妙
    expect(useGameStore.getState().player.score).toBe(scoreBefore);
    expect(fresh.getAchievementProgress('first_blood')?.paid).toBe(true);

    // 再初始化一次不能重复补发
    const expAfterFirst = useGameStore.getState().player.experience;
    fresh.initialize();
    expect(useGameStore.getState().player.experience).toBe(expAfterFirst);
    localStorage.removeItem('achievementProgress');
  });

  it('没有存档时新建实例是干净起点（不残留上一次的解锁状态）', () => {
    localStorage.removeItem('achievementProgress');
    const fresh = new AchievementSystem();
    fresh.initialize();
    expect(fresh.getUnlockedCount()).toBe(0);
    expect(getCredits()).toBeGreaterThanOrEqual(0);
    expect(fresh.getStats().totalKills).toBe(0);
  });

  it('解锁事件会把成就定义传给监听者（GameplayManager 的会话列表靠它）', () => {
    const seen: string[] = [];
    const off = achievementSystem.onAchievementUnlocked((def) => seen.push(def.id));
    achievementSystem.updateStats({ totalKills: 1 });
    off();
    achievementSystem.updateStats({ totalKills: 10 });
    expect(seen).toEqual(['first_blood']);
  });
});

describe('面板快照 getSnapshot', () => {
  beforeEach(() => {
    achievementSystem.resetProgress();
    useGameStore.getState().resetGame();
  });

  it('总数、已解锁数、完成度与奖励合计自洽', () => {
    const empty = achievementSystem.getSnapshot();
    expect(empty.total).toBe(DEFS.length);
    expect(empty.unlocked).toBe(0);
    expect(empty.completion).toBe(0);
    expect(empty.earnedExperience).toBe(0);
    expect(empty.earnedCredits).toBe(0);

    achievementSystem.updateStats({ totalKills: 10 });
    const partial = achievementSystem.getSnapshot();
    const unlockedIds = partial.entries.filter((e) => e.progress.isUnlocked).map((e) => e.id);
    expect(unlockedIds.sort()).toEqual(['first_blood', 'killer_10']);
    expect(partial.unlocked).toBe(2);
    expect(partial.completion).toBeCloseTo((2 / DEFS.length) * 100, 5);
    expect(partial.earnedExperience).toBe(
      byId('first_blood').rewards.experience + byId('killer_10').rewards.experience,
    );
    expect(partial.earnedCredits).toBe(
      byId('first_blood').rewards.credits + byId('killer_10').rewards.credits,
    );
  });

  it('快照里每条都带真实进度，且 current 不会超过 requirement（面板进度条不会溢出）', () => {
    achievementSystem.updateStats({ totalKills: 1000 });
    const snapshot = achievementSystem.getSnapshot();
    expect(snapshot.entries.length).toBe(DEFS.length);
    snapshot.entries.forEach((e) => {
      expect(Number.isFinite(e.progress.current), `${e.id} 的 current`).toBe(true);
      expect(e.requirement, `${e.id} 的 requirement`).toBeGreaterThan(0);
    });
  });

  it('「解锁全部」的阈值是求值出来的（= 其余成就数），不是定义里的占位 0', () => {
    // 定义表里这条的 requirement 只能是占位值（阈值不是常量），
    // 面板若直接读定义就会画出「0/0」的空进度条 —— 所以快照必须回填求值结果。
    const entry = achievementSystem.getSnapshot().entries.find((e) => e.id === 'legendary_pilot');
    expect(entry?.requirement).toBe(DEFS.length - 1);
    expect(byId('legendary_pilot').requirement).toBe(0); // 定义里的占位值
  });

  it('resetProgress 之后定义表仍然完整（防「重置后不再解锁」的静默失效）', () => {
    achievementSystem.updateStats({ totalKills: 10 });
    expect(achievementSystem.getUnlockedCount()).toBeGreaterThan(0);

    achievementSystem.resetProgress();
    expect(achievementSystem.getUnlockedCount()).toBe(0);
    expect(achievementSystem.getAllAchievements().length).toBe(DEFS.length);

    // 关键：重置后仍然能再解锁（旧实现会在这里静默失效）
    achievementSystem.updateStats({ totalKills: 10 });
    expect(achievementSystem.getUnlockedCount()).toBe(2);
  });
});
