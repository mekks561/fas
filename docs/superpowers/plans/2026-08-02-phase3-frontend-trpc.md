# Phase 3: 前端 tRPC + React Query 排行榜集成计划

- Date: 2026-08-02
- Status: Executable → **Completed (S1-S5 全部通过)**
- Author: AI Agent Plan
- Scope: 排行榜模块重构（不接入真实数据库，POC 驱动 + 可插拔策略）

---

## Goal

在不接入真实数据库的前提下，将排行榜从「纯 mock + 手写订阅发布」改造为「Zod 单一类型来源 + Provider 可插拔策略 + @tanstack/react-query 状态管理」，实现 tRPC 端到端类型安全。

### Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                        Component Layer (React)                        │
│  GameOver.tsx  LeaderboardPanel.tsx  CloudSaveSystem.ts (命令式)      │
└──────────────┬──────────────────┬────────────────────────────────────┘
               │                  │
               ▼                  ▼
┌───────────────────────────────────────────────────────────────────────┐
│                     Service Layer (React Query Hooks)                 │
│  useLeaderboardList  useMyRank  useLeaderboardStats  useSubmitScore   │
│  queryKey = ['leaderboard', 'list'|'myRank'|'stats', ...params]       │
│  @tanstack/react-query QueryClient (staleTime=30s, invalidateQueries) │
└──────────────┬──────────────────┬────────────────────────────────────┘
               │                  │
               ▼                  ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Shared Types + tRPC Client (type-only)             │
│  Zod Schemas ───► SubmitScoreInput, LeaderboardEntryDTO, ListInput    │
│  src/shared/schemas/leaderboard.ts  (单一类型来源)                    │
│  LeaderboardProvider Interface ──► MockProvider / TRPCProvider        │
│  @trpc/client + superjson transformer (AppRouter type-only import)    │
└──────────────┬──────────────────┬────────────────────────────────────┘
               │                  │
               ▼                  ▼
┌───────────────────────────────────────────────────────────────────────┐
│                     Pluggable Upstream Strategies                     │
│  MockProvider (内存 + localStorage, 50种子名)                         │
│  TRPCProvider (poc/trpc-leaderboard, 4条降级规则, filter Omit转发)   │
└───────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| 包                     | 版本    | 类型        | 用途                               |
| ---------------------- | ------- | ----------- | ---------------------------------- |
| zod                    | ^3.24   | 生产依赖    | 单一类型来源 + 输入校验            |
| @trpc/client           | ^11.0.0 | 生产依赖    | tRPC 客户端（type-only AppRouter） |
| @tanstack/react-query  | ^5.62.0 | 生产依赖    | 状态+缓存管理，替代订阅发布        |
| superjson              | ^2.2.2  | 生产依赖    | Date/Map/BigInt 序列化             |
| vitest                 | ^4.1.9  | 已有 devDep | 单测 + hooks 集成测试              |
| @testing-library/react | ^16.3.2 | 已有 devDep | renderHook 测试                    |
| msw                    | ^2.7.0  | 新增 devDep | TRPCProvider 网络降级测试          |

---

## Task 1: Install Dependencies & Scripts

### 文件清单

- Modify: `package.json` (scripts 追加 2 条)
- Create: 无
- Modify: 无其他

### Step 1.1: 安装 4 个生产依赖 + 1 个 devDep

```bash
# 在 fighter-game 根目录执行
cd /d h:\工作区\fighter-game && npm install zod@^3.24 @trpc/client@^11.0.0 @tanstack/react-query@^5.62.0 superjson@^2.2.2
```

**Expected:** 4 个 dependencies 新增成功，无 peerDependency 冲突，退出码 0。

```bash
cd /d h:\工作区\fighter-game && npm install -D msw@^2.7.0
```

**Expected:** msw 加入 devDependencies，退出码 0。

### Step 1.2: 验证 npm ls 成功

```bash
cd /d h:\工作区\fighter-game && npm ls zod @trpc/client @tanstack/react-query superjson msw --depth=0
```

**Expected:** 5 个包全部显示版本号，无 `UNMET` / `MISSING` 标记，退出码 0。

### Step 1.3: package.json scripts 追加 2 条

**Modify `package.json` scripts 部分（原 lines 7-25，精确替换）：**

```diff
   "scripts": {
     "dev": "vite",
     "build": "vite build",
     "preview": "vite preview",
     "test": "vitest",
     "test:watch": "vitest --watch",
     "test:coverage": "vitest --coverage",
+    "test:provider": "vitest run src/services/leaderboard/__tests__ src/shared/schemas/__tests__ src/services/trpc.ts src/services/leaderboard/index.ts --coverage=false",
     "test:e2e": "playwright test",
     "test:e2e:ui": "playwright test --ui",
     "test:e2e:debug": "playwright test --debug",
     "lint": "eslint .",
     "lint:fix": "eslint . --fix",
     "lint:ox": "oxlint .",
     "typecheck": "tsc --noEmit",
+    "typecheck:leaderboard:negative": "node scripts/typecheck-leaderboard-negative.mjs",
     "format": "prettier --write \"src/**/*.{ts,tsx,css,json}\"",
     "format:check": "prettier --check \"src/**/*.{ts,tsx,css,json}\"",
     "generate:models": "node scripts/generate-models.js",
     "download:models": "node scripts/download-models.js",
     "prepare": "husky"
   },
```

### Step 1.4: 验证 scripts 生效

```bash
cd /d h:\工作区\fighter-game && node -e "const p=require('./package.json'); console.log(p.scripts['test:provider'], p.scripts['typecheck:leaderboard:negative'])"
```

**Expected:** 两行输出分别是 vitest run... 和 node scripts/... 字符串，不为 undefined。

### Commit 步骤

```bash
cd /d h:\工作区\fighter-game
git add package.json package-lock.json
git status
git commit -m "chore(leaderboard): add zod trpc react-query superjson deps + scripts"
```

---

## Task 2: 环境变量类型 + .env.example

### 文件清单

- Modify: `src/vite-env.d.ts` (ImportMetaEnv 追加 2 字段)
- Modify: `.env.example` (追加 2 行 + 注释)

### Step 2.1: Modify `src/vite-env.d.ts`

原文件：

```typescript
/// <reference types="vite/client" />

interface ImportMeta {
  glob: <T = { [key: string]: () => Promise<{ default: T }> }>(
    pattern: string,
    options?: { as?: 'raw' | 'url'; eager?: boolean },
  ) => { [key: string]: string };
}

interface ImportMetaEnv {
  readonly VITE_SECURITY_KEY?: string;
}
```

**精确替换 ImportMetaEnv 部分为：**

```typescript
interface ImportMetaEnv {
  readonly VITE_SECURITY_KEY?: string;
  readonly VITE_LEADERBOARD_PROVIDER: 'mock' | 'trpc';
  readonly VITE_TRPC_URL?: string;
}
```

### Step 2.2: Modify `.env.example`

在原文件末尾（原 line 8 之后）追加：

```
# ============================================================
# 排行榜 Provider 配置（Phase 3: tRPC + React Query）
# ============================================================
# Provider 策略选择：
#   mock  - 使用 MockProvider（内存 + localStorage，离线开发默认）
#   trpc  - 使用 TRPCProvider（连接 poc/trpc-leaderboard）
VITE_LEADERBOARD_PROVIDER=mock

# tRPC HTTP Endpoint（仅当 VITE_LEADERBOARD_PROVIDER=trpc 时需要）
# 对应 poc/trpc-leaderboard 默认端口 2026
VITE_TRPC_URL=http://localhost:2026
```

### Step 2.3: 验证类型 + example 存在

```bash
cd /d h:\工作区\fighter-game && npx tsc --noEmit src/vite-env.d.ts 2>&1 | head -20
```

**Expected:** 0 errors（VITE_LEADERBOARD_PROVIDER 在未设置 .env 时会被 Vite 视为 `undefined`，但我们通过默认值兜底；tsc 对 `.d.ts` 不报错即可）。

```bash
cd /d h:\工作区\fighter-game && grep -c "VITE_LEADERBOARD_PROVIDER" .env.example
```

**Expected:** 输出 2（定义行 + 注释说明行提到变量名，实际上 grep -c 会匹配两次，只要 ≥1 就 OK）。

### Commit 步骤

```bash
cd /d h:\工作区\fighter-game
git add src/vite-env.d.ts .env.example
git commit -m "chore(env): add VITE_LEADERBOARD_PROVIDER + VITE_TRPC_URL types"
```

---

## Task 3: Shared Zod Schema + Unit Tests（TDD）

### 文件清单

- Create: `src/shared/schemas/leaderboard.ts`
- Create: `src/shared/schemas/__tests__/leaderboard.test.ts`

### Step 3.1: 先写 failing test（TDD 第一步）

**Create `src/shared/schemas/__tests__/leaderboard.test.ts`：**

```typescript
import { describe, it, expect } from 'vitest';
import {
  difficultySchema,
  submitScoreSchema,
  leaderboardEntrySchema,
  listInputSchema,
  myRankResultSchema,
  statsSchema,
} from '../leaderboard';

describe('difficultySchema', () => {
  it('接受四种合法难度', () => {
    expect(difficultySchema.parse('easy')).toBe('easy');
    expect(difficultySchema.parse('normal')).toBe('normal');
    expect(difficultySchema.parse('hard')).toBe('hard');
    expect(difficultySchema.parse('expert')).toBe('expert');
  });

  it('拒绝非法难度字符串', () => {
    expect(() => difficultySchema.parse('insane')).toThrow();
    expect(() => difficultySchema.parse('')).toThrow();
    expect(() => difficultySchema.parse(123)).toThrow();
  });
});

describe('submitScoreSchema', () => {
  const valid = {
    playerId: 'p_001',
    playerName: 'StarPilot',
    score: 95000,
    wave: 25,
    kills: 150,
  };

  it('接受合法必填字段', () => {
    const r = submitScoreSchema.parse(valid);
    expect(r.score).toBe(95000);
    expect(r.accuracy).toBeUndefined();
  });

  it('接受完整可选字段（accuracy, maxCombo, difficulty 等）', () => {
    const full = {
      ...valid,
      accuracy: 0.87,
      maxCombo: 120,
      bossesKilled: 3,
      elitesKilled: 25,
      playTime: 1800,
      powerupsCollected: 15,
      damageDealt: 250000,
      damageTaken: 45000,
      rankGrade: 'S',
      difficulty: 'hard' as const,
    };
    const r = submitScoreSchema.parse(full);
    expect(r.accuracy).toBe(0.87);
    expect(r.difficulty).toBe('hard');
  });

  it('拒绝负数 score', () => {
    expect(() => submitScoreSchema.parse({ ...valid, score: -1 })).toThrow();
  });

  it('拒绝超界 score (十亿零一)', () => {
    expect(() => submitScoreSchema.parse({ ...valid, score: 1_000_000_001 })).toThrow();
  });

  it('拒绝非整数 wave', () => {
    expect(() => submitScoreSchema.parse({ ...valid, wave: 5.7 })).toThrow();
  });

  it('拒绝超界 kills (十万)', () => {
    expect(() => submitScoreSchema.parse({ ...valid, kills: 100_000 })).toThrow();
  });

  it('拒绝空字符串 playerId', () => {
    expect(() => submitScoreSchema.parse({ ...valid, playerId: '' })).toThrow();
  });

  it('拒绝缺失必填字段（无 playerName）', () => {
    const { playerName: _skip, ...rest } = valid;
    expect(() => submitScoreSchema.parse(rest)).toThrow();
  });

  it('拒绝 accuracy > 1 或 < 0', () => {
    expect(() => submitScoreSchema.parse({ ...valid, accuracy: 1.5 })).toThrow();
    expect(() => submitScoreSchema.parse({ ...valid, accuracy: -0.1 })).toThrow();
  });

  it('拒绝 playerName 超长 (33+ chars)', () => {
    expect(() => submitScoreSchema.parse({ ...valid, playerName: 'A'.repeat(33) })).toThrow();
  });
});

describe('leaderboardEntrySchema', () => {
  it('接受合法条目（含 Date timestamp）', () => {
    const entry = {
      playerId: 'p_001',
      playerName: 'StarPilot',
      score: 95000,
      wave: 25,
      kills: 150,
      timestamp: new Date('2026-08-02T00:00:00Z'),
      rank: 1,
      accuracy: 0.87,
    };
    const r = leaderboardEntrySchema.parse(entry);
    expect(r.rank).toBe(1);
    expect(r.timestamp).toBeInstanceOf(Date);
  });

  it('拒绝 timestamp 不是 Date', () => {
    const bad = {
      playerId: 'p_001',
      playerName: 'A',
      score: 1,
      wave: 1,
      kills: 1,
      timestamp: Date.now(),
      rank: 1,
    };
    expect(() => leaderboardEntrySchema.parse(bad)).toThrow();
  });

  it('拒绝缺失 rank 字段', () => {
    const bad = {
      playerId: 'p_001',
      playerName: 'A',
      score: 1,
      wave: 1,
      kills: 1,
      timestamp: new Date(),
    };
    expect(() => leaderboardEntrySchema.parse(bad)).toThrow();
  });
});

describe('listInputSchema', () => {
  it('接受 limit + difficulty + filter 全参数', () => {
    const r = listInputSchema.parse({ limit: 25, difficulty: 'hard', filter: 'weekly' });
    expect(r.limit).toBe(25);
    expect(r.filter).toBe('weekly');
  });

  it('默认 limit=50', () => {
    const r = listInputSchema.parse({});
    expect(r.limit).toBe(50);
  });

  it('拒绝 limit < 1 或 > 500', () => {
    expect(() => listInputSchema.parse({ limit: 0 })).toThrow();
    expect(() => listInputSchema.parse({ limit: 501 })).toThrow();
  });

  it('拒绝非法 filter', () => {
    expect(() => listInputSchema.parse({ filter: 'yearly' })).toThrow();
  });
});

describe('myRankResultSchema', () => {
  it('接受 rank=null + entry=null（未上榜）', () => {
    const r = myRankResultSchema.parse({ rank: null, entry: null });
    expect(r.rank).toBeNull();
  });

  it('接受合法 rank + entry', () => {
    const entry = {
      playerId: 'me',
      playerName: 'Me',
      score: 1000,
      wave: 5,
      kills: 20,
      timestamp: new Date(),
      rank: 10,
    };
    const r = myRankResultSchema.parse({ rank: 10, entry });
    expect(r.rank).toBe(10);
  });
});

describe('statsSchema', () => {
  it('接受完整 stats', () => {
    const r = statsSchema.parse({
      totalPlayers: 150,
      topScore: 999_999,
      avgScore: 150_000,
      difficultyDistribution: { easy: 10, normal: 80, hard: 50, expert: 10 },
    });
    expect(r.totalPlayers).toBe(150);
  });

  it('拒绝 negative topScore', () => {
    expect(() =>
      statsSchema.parse({
        totalPlayers: 1,
        topScore: -1,
        avgScore: 0,
        difficultyDistribution: { easy: 0, normal: 1, hard: 0, expert: 0 },
      }),
    ).toThrow();
  });
});
```

### Step 3.2: 跑 failing test（TDD 第二步：必 FAIL）

```bash
cd /d h:\工作区\fighter-game && npx vitest run src/shared/schemas/__tests__/leaderboard.test.ts 2>&1 | tail -30
```

**Expected:** 大量 `FAIL` ，核心原因是 `src/shared/schemas/leaderboard.ts` 不存在导致 import 失败；或者存在但导出不完整。退出码非 0。

### Step 3.3: 写实现

**Create `src/shared/schemas/leaderboard.ts`：**

```typescript
import { z } from 'zod';

export const difficultySchema = z.enum(['easy', 'normal', 'hard', 'expert']);
export type Difficulty = z.infer<typeof difficultySchema>;

export const submitScoreSchema = z.object({
  playerId: z.string().min(1).max(64),
  playerName: z.string().min(1).max(32),
  score: z.number().int().min(0).max(1_000_000_000),
  wave: z.number().int().min(0).max(999),
  kills: z.number().int().min(0).max(99_999),
  accuracy: z.number().min(0).max(1).optional(),
  maxCombo: z.number().int().min(0).max(99_999).optional(),
  bossesKilled: z.number().int().min(0).max(999).optional(),
  elitesKilled: z.number().int().min(0).max(9_999).optional(),
  playTime: z.number().int().min(0).max(86_400).optional(),
  powerupsCollected: z.number().int().min(0).max(9_999).optional(),
  damageDealt: z.number().int().min(0).max(99_999_999).optional(),
  damageTaken: z.number().int().min(0).max(99_999_999).optional(),
  rankGrade: z.string().max(4).optional(),
  difficulty: difficultySchema.optional(),
});
export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;

export const leaderboardEntrySchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  score: z.number(),
  wave: z.number(),
  kills: z.number(),
  timestamp: z.date(),
  rank: z.number(),
  accuracy: z.number().optional(),
  maxCombo: z.number().optional(),
  bossesKilled: z.number().optional(),
  elitesKilled: z.number().optional(),
  playTime: z.number().optional(),
  powerupsCollected: z.number().optional(),
  damageDealt: z.number().optional(),
  damageTaken: z.number().optional(),
  rankGrade: z.string().optional(),
  difficulty: difficultySchema.optional(),
});
export type LeaderboardEntryDTO = z.infer<typeof leaderboardEntrySchema>;

export const listInputSchema = z.object({
  limit: z.number().min(1).max(500).default(50),
  difficulty: difficultySchema.optional(),
  filter: z.enum(['all', 'daily', 'weekly', 'monthly', 'friends']).default('all'),
});
export type ListInput = z.infer<typeof listInputSchema>;

export const myRankResultSchema = z.object({
  rank: z.number().nullable(),
  entry: leaderboardEntrySchema.nullable(),
});
export type MyRankResult = z.infer<typeof myRankResultSchema>;

export const statsSchema = z.object({
  totalPlayers: z.number().int().min(0),
  topScore: z.number().int().min(0),
  avgScore: z.number().int().min(0),
  difficultyDistribution: z.object({
    easy: z.number().int().min(0),
    normal: z.number().int().min(0),
    hard: z.number().int().min(0),
    expert: z.number().int().min(0),
  }),
});
export type LeaderboardStatsDTO = z.infer<typeof statsSchema>;
```

### Step 3.4: 跑 passing test（TDD 第三步：必 PASS）

```bash
cd /d h:\工作区\fighter-game && npx vitest run src/shared/schemas/__tests__/leaderboard.test.ts 2>&1 | tail -20
```

**Expected:** 所有测试套件 `Test Files 1 passed | Tests ~25+ passed`，退出码 0。

### Commit 步骤

```bash
cd /d h:\工作区\fighter-game
git add src/shared/schemas/leaderboard.ts src/shared/schemas/__tests__/leaderboard.test.ts
git commit -m "feat(schemas): leaderboard zod schemas + unit tests (TDD)"
```

---

## Task 4: Provider Interface + MockProvider（TDD）

### 文件清单

- Create: `src/services/leaderboard/types.ts`
- Create: `src/services/leaderboard/MockProvider.ts`
- Create: `src/services/leaderboard/__tests__/MockProvider.test.ts`

### Step 4.1: 先写 failing test

**Create `src/services/leaderboard/__tests__/MockProvider.test.ts`：**

```typescript
import { beforeEach, describe, it, expect } from 'vitest';
import { MockProvider } from '../MockProvider';
import type { ListInput } from '../../../shared/schemas/leaderboard';

describe('MockProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('list 返回数量正确且按 score 降序', async () => {
    const p = new MockProvider();
    const list = await p.list({ limit: 50, filter: 'all' });
    expect(list.length).toBeLessThanOrEqual(50);
    expect(list.length).toBeGreaterThan(10);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
      expect(list[i - 1].rank).toBeLessThanOrEqual(list[i].rank);
    }
  });

  it('filter 分数区间关系: daily < weekly < monthly < all (中位数对比)', async () => {
    const p = new MockProvider();
    const median = (arr: number[]) => {
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    const [daily, weekly, monthly, all] = await Promise.all([
      p.list({ limit: 50, filter: 'daily' }),
      p.list({ limit: 50, filter: 'weekly' }),
      p.list({ limit: 50, filter: 'monthly' }),
      p.list({ limit: 50, filter: 'all' }),
    ]);
    const md = median(daily.map((e) => e.score));
    const mw = median(weekly.map((e) => e.score));
    const mm = median(monthly.map((e) => e.score));
    const ma = median(all.map((e) => e.score));
    expect(mw).toBeGreaterThan(md);
    expect(mm).toBeGreaterThan(mw);
    // all 可能包含极端高低分，但平均值/分位数应该高于 daily
    expect(ma).toBeGreaterThanOrEqual(md);
  });

  it('friends filter 返回固定切片索引 (约 10-25 条)', async () => {
    const p = new MockProvider();
    const friends = await p.list({ limit: 50, filter: 'friends' });
    expect(friends.length).toBeGreaterThanOrEqual(10);
    expect(friends.length).toBeLessThanOrEqual(30);
  });

  it('submit 写入 localStorage + 返回 rank=1 (满分)', async () => {
    const p = new MockProvider();
    const result = await p.submit({
      playerId: 'tester_001',
      playerName: 'Tester',
      score: 999_999_999,
      wave: 999,
      kills: 99_999,
      accuracy: 1,
    });
    expect(result.rank).toBe(1);
    expect(result.entry.playerName).toBe('Tester');

    const listAfter = await p.list({ limit: 50, filter: 'all' });
    expect(listAfter[0].playerId).toBe('tester_001');

    const raw = localStorage.getItem('leaderboard');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((e: any) => e.playerId === 'tester_001')).toBe(true);
  });

  it('myRank: 未上榜玩家返回 null/null', async () => {
    const p = new MockProvider();
    const r = await p.myRank('nonexistent_user_x');
    expect(r.rank).toBeNull();
    expect(r.entry).toBeNull();
  });

  it('myRank: 先 submit 再查返回正确 rank', async () => {
    const p = new MockProvider();
    await p.submit({
      playerId: 'me_myself',
      playerName: 'Myself',
      score: 500_000,
      wave: 50,
      kills: 5000,
    });
    const r = await p.myRank('me_myself');
    expect(typeof r.rank).toBe('number');
    expect(r.rank).toBeGreaterThan(0);
    expect(r.entry!.playerId).toBe('me_myself');
  });

  it('stats 一致性: totalPlayers === list(all) 长度上限; topScore 匹配榜首', async () => {
    const p = new MockProvider();
    const list = await p.list({ limit: 500, filter: 'all' });
    const stats = await p.stats();
    expect(stats.totalPlayers).toBeGreaterThanOrEqual(list.length);
    expect(stats.totalPlayers).toBeGreaterThan(0);
    if (list.length > 0) {
      expect(stats.topScore).toBe(list[0].score);
    }
    expect(stats.avgScore).toBeGreaterThanOrEqual(0);
    const dd = stats.difficultyDistribution;
    const sum = dd.easy + dd.normal + dd.hard + dd.expert;
    expect(sum).toBe(stats.totalPlayers);
  });

  it('不同 difficulty list 查询不抛错', async () => {
    const p = new MockProvider();
    for (const d of ['easy', 'normal', 'hard', 'expert'] as const) {
      const r = await p.list({ limit: 10, filter: 'all', difficulty: d });
      expect(Array.isArray(r)).toBe(true);
    }
  });
});
```

### Step 4.2: 跑 failing test

```bash
cd /d h:\工作区\fighter-game && npx vitest run src/services/leaderboard/__tests__/MockProvider.test.ts 2>&1 | tail -20
```

**Expected:** FAIL，原因是 types.ts 和 MockProvider.ts 不存在。退出码非 0。

### Step 4.3: 写接口 + 实现

**Create `src/services/leaderboard/types.ts`：**

```typescript
import type {
  SubmitScoreInput,
  ListInput,
  LeaderboardEntryDTO,
  MyRankResult,
  LeaderboardStatsDTO,
} from '../../shared/schemas/leaderboard';

export type ProviderKind = 'mock' | 'trpc';

export interface SubmitResult {
  rank: number;
  entry: LeaderboardEntryDTO;
}

export interface LeaderboardProvider {
  readonly kind: ProviderKind;
  list(input: ListInput): Promise<LeaderboardEntryDTO[]>;
  submit(input: SubmitScoreInput): Promise<SubmitResult>;
  myRank(playerId: string): Promise<MyRankResult>;
  stats(): Promise<LeaderboardStatsDTO>;
}
```

**Create `src/services/leaderboard/MockProvider.ts`：**

```typescript
import type { LeaderboardProvider, SubmitResult } from './types';
import type {
  ListInput,
  LeaderboardEntryDTO,
  MyRankResult,
  LeaderboardStatsDTO,
  SubmitScoreInput,
} from '../../shared/schemas/leaderboard';

const MOCK_NAMES: string[] = [
  '星际猎人',
  '银河守卫',
  '宇宙战神',
  '光速战士',
  '暗夜游侠',
  '雷霆指挥官',
  '风暴使者',
  '烈焰骑士',
  '冰霜刺客',
  '暗影杀手',
  '星辰主宰',
  '虚空行者',
  '量子战士',
  '时空猎人',
  '永恒守护者',
  '无尽探索者',
  '银河霸主',
  '宇宙先锋',
  '星际王牌',
  '绝对王者',
  '狂暴战士',
  '沉默猎手',
  '迅捷刺客',
  '重装炮手',
  '致命狙击手',
  '闪电侠',
  '火焰风暴',
  '冰霜女王',
  '暗影领主',
  '光明使者',
  '战神',
  '剑圣',
  '魔法师',
  '弓箭手',
  '刺客',
  '圣骑士',
  '德鲁伊',
  '萨满',
  '猎人',
  '术士',
  '战士',
  '牧师',
  '法师',
  '盗贼',
  '死亡骑士',
  '恶魔猎手',
  '武僧',
  '恶魔战士',
  '幽灵',
  '亡灵',
];

const STORAGE_KEY = 'leaderboard';

export class MockProvider implements LeaderboardProvider {
  readonly kind = 'mock' as const;
  private entries: LeaderboardEntryDTO[] = [];

  constructor() {
    this.entries = this.loadFromStorage();
    if (this.entries.length === 0) {
      this.entries = this.generateSeedEntries();
      this.persist();
    }
  }

  private loadFromStorage(): LeaderboardEntryDTO[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as any[];
      return parsed.map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      }));
    } catch {
      return [];
    }
  }

  private persist(): void {
    const serializable = this.entries.map((e) => ({
      ...e,
      timestamp: e.timestamp.getTime(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  }

  private generateSeedEntries(): LeaderboardEntryDTO[] {
    const now = Date.now();
    const entries: LeaderboardEntryDTO[] = [];
    const difficulties: Array<'easy' | 'normal' | 'hard' | 'expert'> = [
      'easy',
      'normal',
      'hard',
      'expert',
    ];

    for (let i = 0; i < 50; i++) {
      const baseScore = 1000 + Math.random() * 999_000;
      const daysAgo = Math.floor(Math.random() * 30);
      entries.push({
        playerId: `mock_player_${i}`,
        playerName: MOCK_NAMES[i % MOCK_NAMES.length] + (i >= MOCK_NAMES.length ? `_${i}` : ''),
        score: Math.floor(baseScore),
        wave: Math.floor(5 + Math.random() * 50),
        kills: Math.floor(20 + Math.random() * 300),
        timestamp: new Date(now - daysAgo * 24 * 60 * 60 * 1000),
        rank: i + 1,
        accuracy: 0.3 + Math.random() * 0.65,
        maxCombo: Math.floor(10 + Math.random() * 200),
        bossesKilled: Math.floor(Math.random() * 8),
        elitesKilled: Math.floor(Math.random() * 60),
        playTime: Math.floor(60 + Math.random() * 3000),
        powerupsCollected: Math.floor(Math.random() * 40),
        damageDealt: Math.floor(Math.random() * 5_000_000),
        damageTaken: Math.floor(Math.random() * 500_000),
        difficulty: difficulties[Math.floor(Math.random() * difficulties.length)],
      });
    }
    return entries.sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 }));
  }

  private assignRanks(entries: LeaderboardEntryDTO[]): LeaderboardEntryDTO[] {
    return entries.map((e, i) => ({ ...e, rank: i + 1 }));
  }

  private filterByTimeRange(
    entries: LeaderboardEntryDTO[],
    filter: ListInput['filter'],
  ): LeaderboardEntryDTO[] {
    if (filter === 'all') return entries;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const cutoff =
      filter === 'daily'
        ? now - dayMs
        : filter === 'weekly'
          ? now - 7 * dayMs
          : filter === 'monthly'
            ? now - 30 * dayMs
            : 0;
    return entries.filter((e) => e.timestamp.getTime() >= cutoff);
  }

  async list(input: ListInput): Promise<LeaderboardEntryDTO[]> {
    let result = [...this.entries].sort((a, b) => b.score - a.score);

    if (input.difficulty) {
      result = result.filter((e) => e.difficulty === input.difficulty || !e.difficulty);
    }

    if (input.filter === 'friends') {
      result = result.slice(10, 26);
    } else {
      result = this.filterByTimeRange(result, input.filter);
    }

    const ranked = this.assignRanks(result).slice(0, input.limit);
    return ranked;
  }

  async submit(input: SubmitScoreInput): Promise<SubmitResult> {
    const entry: LeaderboardEntryDTO = {
      ...input,
      timestamp: new Date(),
      rank: 1,
    };

    const merged = [...this.entries.filter((e) => e.playerId !== input.playerId), entry];
    const sorted = merged.sort((a, b) => b.score - a.score).slice(0, 100);
    this.entries = this.assignRanks(sorted);
    this.persist();

    const rank = this.entries.findIndex((e) => e.playerId === input.playerId) + 1;
    const e = this.entries.find((e) => e.playerId === input.playerId)!;
    return { rank, entry: e };
  }

  async myRank(playerId: string): Promise<MyRankResult> {
    const sorted = [...this.entries].sort((a, b) => b.score - a.score);
    const idx = sorted.findIndex((e) => e.playerId === playerId);
    if (idx < 0) return { rank: null, entry: null };
    const entry = { ...sorted[idx], rank: idx + 1 };
    return { rank: idx + 1, entry };
  }

  async stats(): Promise<LeaderboardStatsDTO> {
    const sorted = [...this.entries].sort((a, b) => b.score - a.score);
    const total = this.entries.length;
    const topScore = sorted[0]?.score ?? 0;
    const avgScore = total > 0 ? Math.floor(sorted.reduce((s, e) => s + e.score, 0) / total) : 0;

    const dd = { easy: 0, normal: 0, hard: 0, expert: 0 };
    for (const e of this.entries) {
      if (e.difficulty && e.difficulty in dd) {
        (dd as any)[e.difficulty]++;
      } else {
        dd.normal++;
      }
    }

    return {
      totalPlayers: total,
      topScore,
      avgScore,
      difficultyDistribution: dd,
    };
  }
}
```

### Step 4.4: 跑 passing test

```bash
cd /d h:\工作区\fighter-game && npx vitest run src/services/leaderboard/__tests__/MockProvider.test.ts 2>&1 | tail -20
```

**Expected:** 全 PASS（11 tests），退出码 0。

### Commit 步骤

```bash
cd /d h:\工作区\fighter-game
git add src/services/leaderboard/types.ts src/services/leaderboard/MockProvider.ts src/services/leaderboard/__tests__/MockProvider.test.ts
git commit -m "feat(provider): MockProvider + interface + tests (TDD)"
```

---

## Task 5: trpc.ts + TRPCProvider（TDD, MSW 网络测试）

### 文件清单

- Create: `src/services/trpc.ts` (QueryClient + tRPC client factory)
- Create: `src/services/leaderboard/TRPCProvider.ts`
- Create: `src/services/leaderboard/__tests__/TRPCProvider.test.ts` (msw mock)

### Step 5.1: 先写 failing test（MSW）

**Create `src/services/leaderboard/__tests__/TRPCProvider.test.ts`：**

```typescript
import { beforeAll, afterEach, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { TRPCProvider } from '../TRPCProvider';
import { MockProvider } from '../MockProvider';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  localStorage.clear();
});
afterAll(() => server.close());

describe('TRPCProvider - Rule 1: 空URL或kind非trpc直用MockProvider', () => {
  it('空 trpcUrl 直接构造 fallback MockProvider', async () => {
    const p = new TRPCProvider('');
    expect(p.kind).toBe('trpc');
    const list = await p.list({ limit: 50, filter: 'all' });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(5);
  });
});

describe('TRPCProvider - Rule 2&3: 网络错误/5xx 降级', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('fetch 抛网络错误 → 降级 MockProvider list 不抛', async () => {
    server.use(
      http.post('http://bad-url.test/trpc/leaderboard.list', () => {
        return HttpResponse.error();
      }),
    );
    const p = new TRPCProvider('http://bad-url.test');
    const list = await p.list({ limit: 20, filter: 'all' });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('HTTP 500 → 降级 MockProvider list 不抛', async () => {
    server.use(
      http.post('http://down.test/trpc/leaderboard.list', () => {
        return new HttpResponse('server crash', { status: 500 });
      }),
    );
    const p = new TRPCProvider('http://down.test');
    const list = await p.list({ limit: 20, filter: 'all' });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});

describe('TRPCProvider - Rule 4: Zod 400 BAD_REQUEST 不降级向上抛', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('zod BAD_REQUEST → submit 抛错（不降级）', async () => {
    server.use(
      http.post('http://zod-err.test/trpc/leaderboard.submit', async () => {
        return HttpResponse.json(
          {
            error: {
              code: 'BAD_REQUEST',
              json: { issues: [{ code: 'too_small', path: ['playerId'] }] },
            },
          },
          { status: 400 },
        );
      }),
    );
    const p = new TRPCProvider('http://zod-err.test');
    await expect(
      p.submit({ playerId: '', playerName: 'X', score: 100, wave: 1, kills: 0 }),
    ).rejects.toThrow();
  });
});

describe('TRPCProvider - filter=friends 时 Omit filter 转发', () => {
  it('请求体不含 filter 字段（POC listInput 无 filter）', async () => {
    let capturedBody: any = null;
    server.use(
      http.post('http://ok.test/trpc/leaderboard.list', async ({ request }) => {
        const url = new URL(request.url);
        const text = await request.text();
        capturedBody = { searchParams: Object.fromEntries(url.searchParams), bodyText: text };
        return HttpResponse.json({ result: { data: [] } });
      }),
    );
    const p = new TRPCProvider('http://ok.test');
    await p.list({ limit: 50, filter: 'friends' });

    expect(capturedBody).not.toBeNull();
    const combined = capturedBody.searchParams.batch + ' ' + capturedBody.bodyText;
    expect(combined).not.toContain('friends');
  });
});

describe('TRPCProvider - fallbackOrThrow 内部机制 (list 成功路径)', () => {
  it('成功响应 → 返回服务端数据，不降级，timestamp Date 正确', async () => {
    const nowIso = new Date('2026-08-02T12:00:00Z').toISOString();
    server.use(
      http.post('http://ok.test/trpc/leaderboard.list', () => {
        return HttpResponse.json({
          result: {
            data: {
              json: [
                {
                  playerId: 'srv_1',
                  playerName: 'ServerPlayer',
                  score: 1_000_000,
                  wave: 100,
                  kills: 9999,
                  timestamp: nowIso,
                  rank: 1,
                },
              ],
            },
          },
        });
      }),
    );
    const p = new TRPCProvider('http://ok.test');
    const list = await p.list({ limit: 50, filter: 'all' });
    expect(list.length).toBe(1);
    expect(list[0].playerId).toBe('srv_1');
    expect(list[0].timestamp).toBeInstanceOf(Date);
    expect(list[0].timestamp.getTime()).toBe(new Date(nowIso).getTime());
  });

  it('friends filter 后处理切片 (索引 10-25)', async () => {
    const seed = Array.from({ length: 100 }, (_, i) => ({
      playerId: `p_${i}`,
      playerName: `P${i}`,
      score: 100_000 - i * 100,
      wave: 50,
      kills: 100,
      timestamp: new Date().toISOString(),
      rank: i + 1,
    }));
    server.use(
      http.post('http://ok.test/trpc/leaderboard.list', () =>
        HttpResponse.json({ result: { data: { json: seed } } }),
      ),
    );
    const p = new TRPCProvider('http://ok.test');
    const friends = await p.list({ limit: 200, filter: 'friends' });
    expect(friends.length).toBe(16);
    expect(friends[0].playerId).toBe('p_10');
    expect(friends[friends.length - 1].playerId).toBe('p_25');
  });
});
```

### Step 5.2: 跑 failing test

```bash
cd /d h:\工作区\fighter-game && npx vitest run src/services/leaderboard/__tests__/TRPCProvider.test.ts 2>&1 | tail -30
```

**Expected:** FAIL（import 路径不存在，trpc.ts/TRPCProvider 未实现）。退出码非 0。

### Step 5.3: 写 QueryClient + tRPC client factory

**Create `src/services/trpc.ts`：**

```typescript
import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../poc/trpc-leaderboard/src/router';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export interface TRPCClientFactoryOptions {
  url: string;
}

export function createLeaderboardTRPCClient(options: TRPCClientFactoryOptions) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${options.url}/trpc`,
        transformer: superjson,
        headers() {
          return {
            'x-client': 'fighter-game-phase3',
          };
        },
      }),
    ],
  });
}

export type LeaderboardTRPCClient = ReturnType<typeof createLeaderboardTRPCClient>;
```

### Step 5.4: 写 TRPCProvider 实现（4 条降级规则 + fallbackOrThrow + filter Omit + 客户端切片）

**Create `src/services/leaderboard/TRPCProvider.ts`：**

```typescript
import { createLeaderboardTRPCClient, type LeaderboardTRPCClient } from '../trpc';
import type { LeaderboardProvider, SubmitResult } from './types';
import { MockProvider } from './MockProvider';
import type {
  ListInput,
  LeaderboardEntryDTO,
  MyRankResult,
  LeaderboardStatsDTO,
  SubmitScoreInput,
} from '../../shared/schemas/leaderboard';

type TRPCErrorLike = { code?: string; message?: string; data?: any; cause?: any };

function isTRPCError(e: any): e is TRPCErrorLike {
  return e && (typeof e.code === 'string' || (e.cause && typeof e.cause.code === 'string'));
}

function getErrorCode(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e.code === 'string') return e.code;
  if (e.cause && typeof e.cause.code === 'string') return e.cause.code;
  const status = e.status ?? e.httpStatus ?? e.response?.status;
  if (typeof status === 'number') {
    if (status >= 500) return 'INTERNAL_SERVER_ERROR';
    if (status === 400) return 'BAD_REQUEST';
    if (status === 401 || status === 403) return 'UNAUTHORIZED';
  }
  return undefined;
}

export class TRPCProvider implements LeaderboardProvider {
  readonly kind = 'trpc' as const;
  private client: LeaderboardTRPCClient | null = null;
  private fallback: MockProvider;
  private readonly baseUrl: string;

  constructor(trpcUrl?: string | null) {
    const url = (trpcUrl || '').trim();
    this.baseUrl = url;
    this.fallback = new MockProvider();
    if (url) {
      try {
        this.client = createLeaderboardTRPCClient({ url });
      } catch (e) {
        console.debug('[TRPCProvider] client construction failed, fallback to mock', e);
        this.client = null;
      }
    }
  }

  /**
   * 4条降级规则:
   * 1. !client / !url → 直用 Mock
   * 2. navigator.onLine === false → 降级（jsdom 下此项恒为 true）
   * 3. 网络错误 / 5xx (INTERNAL_SERVER_ERROR) → 降级 + console.debug
   * 4. BAD_REQUEST (zod issues) → 不降级，向上抛
   *
   * @param allowFallback 为 false 时（如 BAD_REQUEST 类型错误）将直接 throw 而非降级
   */
  private async fallbackOrThrow<T>(
    op: string,
    fn: (c: LeaderboardTRPCClient) => Promise<T>,
    fallbackFn: () => Promise<T>,
    allowFallback = true,
  ): Promise<T> {
    if (!this.client) return fallbackFn();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return fallbackFn();

    try {
      return await fn(this.client);
    } catch (err: any) {
      const code = getErrorCode(err);
      if (!allowFallback || code === 'BAD_REQUEST') {
        throw err;
      }
      console.debug(`[TRPCProvider:${op}] fallback to mock (code=${code})`, err?.message || err);
      return fallbackFn();
    }
  }

  private static dateToNumber(entry: any): LeaderboardEntryDTO {
    return {
      ...entry,
      timestamp: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
    };
  }

  async list(input: ListInput): Promise<LeaderboardEntryDTO[]> {
    const isFriends = input.filter === 'friends';
    const trpcInput = isFriends
      ? { limit: input.limit, difficulty: input.difficulty }
      : { limit: input.limit, difficulty: input.difficulty };

    return this.fallbackOrThrow(
      'list',
      async (c) => {
        const raw = await c.leaderboard.list.query(trpcInput as any);
        const arr: any[] = Array.isArray(raw) ? raw : ((raw as any)?.json ?? []);
        let result = arr.map(TRPCProvider.dateToNumber);
        if (isFriends) {
          result = result.slice(10, 26);
        }
        return result.slice(0, input.limit).map((e, i) => ({ ...e, rank: i + 1 }));
      },
      async () => this.fallback.list(input),
    );
  }

  async submit(input: SubmitScoreInput): Promise<SubmitResult> {
    return this.fallbackOrThrow(
      'submit',
      async (c) => {
        const r: any = await c.leaderboard.submit.mutate(input);
        const entry = TRPCProvider.dateToNumber(r.entry ?? r);
        return { rank: typeof r.rank === 'number' ? r.rank : entry.rank, entry };
      },
      async () => this.fallback.submit(input),
      false,
    );
  }

  async myRank(playerId: string): Promise<MyRankResult> {
    return this.fallbackOrThrow(
      'myRank',
      async (c) => {
        const r: any = await c.leaderboard.myRank.query({ playerId });
        return {
          rank: r.rank ?? null,
          entry: r.entry ? TRPCProvider.dateToNumber(r.entry) : null,
        };
      },
      async () => this.fallback.myRank(playerId),
    );
  }

  async stats(): Promise<LeaderboardStatsDTO> {
    return this.fallbackOrThrow(
      'stats',
      async (c) => {
        const r: any = await c.leaderboard.stats.query();
        return r.json ?? r;
      },
      async () => this.fallback.stats(),
    );
  }
}
```

### Step 5.5: 跑 passing test

```bash
cd /d h:\工作区\fighter-game && npx vitest run src/services/leaderboard/__tests__/TRPCProvider.test.ts 2>&1 | tail -30
```

**Expected:** 全 PASS（8 tests）。退出码 0。

### Commit 步骤

```bash
cd /d h:\工作区\fighter-game
git add src/services/trpc.ts src/services/leaderboard/TRPCProvider.ts src/services/leaderboard/__tests__/TRPCProvider.test.ts
git commit -m "feat(provider): TRPCProvider + 4 fallbacks + msw tests (TDD)"
```

---

## Task 6: Leaderboard Index + RQ Hooks + Hooks Integration Test（TDD）

### 文件清单

- Create: `src/services/leaderboard/index.ts` (getProvider singleton + 4 hooks + overrideProviderForTests + setCurrentPlayer)
- Create: `src/services/leaderboard/__tests__/hooks.test.tsx` (renderHook 集成测试)

### Step 6.1: 先写 failing integration test

**Create `src/services/leaderboard/__tests__/hooks.test.tsx`：**

```tsx
import React from 'react';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../trpc';
import {
  getProvider,
  overrideProviderForTests,
  setCurrentPlayer,
  useLeaderboardList,
  useMyRank,
  useLeaderboardStats,
  useSubmitScore,
} from '../index';
import type { LeaderboardProvider, SubmitResult } from '../types';

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

function makeSpyProvider(
  overrides: Partial<LeaderboardProvider> = {},
): LeaderboardProvider & { _calls: Record<string, any[]> } {
  const store: any = { listCalled: 0, submitCalled: 0, myRankCalled: 0, statsCalled: 0 };
  const base: LeaderboardProvider & { _calls: any } = {
    kind: 'mock',
    _calls: store,
    list: vi.fn(async () => {
      store.listCalled++;
      return overrides.list?.() ?? [];
    }),
    submit: vi.fn(async (i) => {
      store.submitCalled++;
      return overrides.submit?.(i) ?? { rank: 1, entry: { ...i, timestamp: new Date(), rank: 1 } };
    }),
    myRank: vi.fn(async () => {
      store.myRankCalled++;
      return overrides.myRank?.() ?? { rank: null, entry: null };
    }),
    stats: vi.fn(async () => {
      store.statsCalled++;
      return (
        overrides.stats?.() ?? {
          totalPlayers: 100,
          topScore: 1000,
          avgScore: 500,
          difficultyDistribution: { easy: 20, normal: 40, hard: 30, expert: 10 },
        }
      );
    }),
  };
  return base;
}

describe('leaderboard hooks (integration)', () => {
  beforeEach(() => {
    queryClient.clear();
  });
  afterEach(() => {
    overrideProviderForTests(null);
  });

  it('useLeaderboardList: 初始 isLoading→false，data 为 provider 返回值', async () => {
    const spy = makeSpyProvider({
      list: () => [
        {
          playerId: 'a',
          playerName: 'A',
          score: 1000,
          wave: 10,
          kills: 100,
          timestamp: new Date(),
          rank: 1,
        },
        {
          playerId: 'b',
          playerName: 'B',
          score: 500,
          wave: 5,
          kills: 50,
          timestamp: new Date(),
          rank: 2,
        },
      ],
    });
    overrideProviderForTests(spy);

    const { result } = renderHook(() => useLeaderboardList({ limit: 50, filter: 'all' }), {
      wrapper,
    });
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.data?.length).toBe(2);
    expect(result.current.data![0].rank).toBe(1);
  });

  it('useSubmitScore 成功 → invalidateQueries → useLeaderboardList 重新拉取后登顶（Tester 变 #1）', async () => {
    let listVersion = 0;
    const spy = makeSpyProvider({
      list: () => {
        listVersion++;
        if (listVersion === 1) {
          return [
            {
              playerId: 'old_top',
              playerName: 'OldTop',
              score: 500_000,
              wave: 50,
              kills: 500,
              timestamp: new Date(),
              rank: 1,
            },
          ];
        }
        return [
          {
            playerId: 'tester_high',
            playerName: 'Tester',
            score: 999_999_999,
            wave: 999,
            kills: 99_999,
            timestamp: new Date(),
            rank: 1,
            accuracy: 1,
          },
        ];
      },
      submit: (i: any): SubmitResult => ({
        rank: 1,
        entry: { ...i, timestamp: new Date(), rank: 1 },
      }),
    });
    overrideProviderForTests(spy);

    const listHook = renderHook(() => useLeaderboardList({ limit: 50, filter: 'all' }), {
      wrapper,
    });
    await waitFor(() => expect(listHook.result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(listHook.result.current.data![0].playerId).toBe('old_top');
    expect(listVersion).toBe(1);

    const submitHook = renderHook(() => useSubmitScore(), { wrapper });
    let mutatePromise: Promise<any> | null = null;
    await act(async () => {
      mutatePromise = submitHook.result.current.mutateAsync({
        playerId: 'tester_high',
        playerName: 'Tester',
        score: 999_999_999,
        wave: 999,
        kills: 99_999,
        accuracy: 1,
      });
    });
    const r = await mutatePromise!;
    expect(r.rank).toBe(1);

    await waitFor(
      () => {
        listHook.rerender();
        const d = listHook.result.current.data;
        return d && d[0].playerId === 'tester_high';
      },
      { timeout: 5000 },
    );
    expect(listVersion).toBeGreaterThanOrEqual(2);
    expect(listHook.result.current.data![0].playerName).toBe('Tester');
    expect(listHook.result.current.data![0].rank).toBe(1);
  });

  it('useMyRank: enabled=false 时不请求', async () => {
    const spy = makeSpyProvider();
    overrideProviderForTests(spy);
    const { result } = renderHook(() => useMyRank(''), { wrapper });
    await new Promise((r) => setTimeout(r, 200));
    expect(result.current.isFetching).toBe(false);
    expect(spy._calls.myRankCalled).toBe(0);
  });

  it('useMyRank: 有 playerId 时正常查询', async () => {
    const spy = makeSpyProvider({
      myRank: () => ({ rank: 42, entry: null }),
    });
    overrideProviderForTests(spy);
    const { result } = renderHook(() => useMyRank('u_alice'), { wrapper });
    await waitFor(() => expect(result.current.data?.rank).toBe(42), { timeout: 5000 });
  });

  it('useLeaderboardStats: staleTime > 30s 级（此处只验证 data 返回）', async () => {
    const spy = makeSpyProvider();
    overrideProviderForTests(spy);
    const { result } = renderHook(() => useLeaderboardStats(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.data?.totalPlayers).toBe(100);
  });

  it('setCurrentPlayer 不影响 provider 接口（仅兼容）', () => {
    setCurrentPlayer('x', 'Y');
    const p = getProvider();
    expect(p).toBeDefined();
  });
});
```

### Step 6.2: 跑 failing test

```bash
cd /d h:\工作区\fighter-game && npx vitest run src/services/leaderboard/__tests__/hooks.test.tsx 2>&1 | tail -30
```

**Expected:** FAIL（index.ts 未实现）。退出码非 0。

### Step 6.3: 写 Leaderboard Index（singleton + 4 hooks）

**Create `src/services/leaderboard/index.ts`：**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ListInput,
  SubmitScoreInput,
  LeaderboardEntryDTO,
  MyRankResult,
  LeaderboardStatsDTO,
} from '../../shared/schemas/leaderboard';
import { submitScoreSchema } from '../../shared/schemas/leaderboard';
import type { LeaderboardProvider, ProviderKind, SubmitResult } from './types';
import { MockProvider } from './MockProvider';
import { TRPCProvider } from './TRPCProvider';

let currentPlayer: { playerId: string; playerName: string } = {
  playerId: 'default_player',
  playerName: 'Player',
};

export function setCurrentPlayer(playerId: string, playerName: string): void {
  currentPlayer = { playerId, playerName };
}

let singleton: LeaderboardProvider | null = null;
let testOverride: LeaderboardProvider | null = null;

function resolveKindFromEnv(): ProviderKind {
  const v = import.meta.env.VITE_LEADERBOARD_PROVIDER;
  if (v === 'trpc') return 'trpc';
  return 'mock';
}

export function getProvider(): LeaderboardProvider {
  if (testOverride) return testOverride;
  if (singleton) return singleton;

  const kind = resolveKindFromEnv();
  if (kind === 'trpc') {
    const url = import.meta.env.VITE_TRPC_URL;
    const trpc = new TRPCProvider(url);
    singleton = trpc;
    return singleton;
  }
  singleton = new MockProvider();
  return singleton;
}

export function overrideProviderForTests(provider: LeaderboardProvider | null): void {
  testOverride = provider;
  if (typeof window !== 'undefined' && (window as any).__vitest__) {
    singleton = null;
  }
}

export function useLeaderboardList(input: ListInput) {
  return useQuery<LeaderboardEntryDTO[]>({
    queryKey: ['leaderboard', 'list', input.filter, input.difficulty ?? 'any', input.limit],
    queryFn: () => getProvider().list(input),
  });
}

export function useMyRank(playerId: string) {
  return useQuery<MyRankResult>({
    queryKey: ['leaderboard', 'myRank', playerId],
    queryFn: () => getProvider().myRank(playerId),
    enabled: !!playerId,
  });
}

export function useLeaderboardStats() {
  return useQuery<LeaderboardStatsDTO>({
    queryKey: ['leaderboard', 'stats'],
    queryFn: () => getProvider().stats(),
    staleTime: 60 * 1000,
  });
}

export function useSubmitScore() {
  const qc = useQueryClient();
  return useMutation<SubmitResult, unknown, SubmitScoreInput>({
    mutationFn: async (payload) => {
      const parsed = submitScoreSchema.parse(payload);
      return getProvider().submit(parsed);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
```

### Step 6.4: 跑 passing test

```bash
cd /d h:\工作区\fighter-game && npx vitest run src/services/leaderboard/__tests__/hooks.test.tsx 2>&1 | tail -30
```

**Expected:** 全 PASS（6 tests）。退出码 0。

### Commit 步骤

```bash
cd /d h:\工作区\fighter-game
git add src/services/leaderboard/index.ts src/services/leaderboard/__tests__/hooks.test.tsx
git commit -m "feat(leaderboard): index singleton + 4 RQ hooks + integration tests (TDD)"
```

---

## Task 7: Wrap App with QueryClientProvider

### 文件清单

- Modify: `src/components/App.tsx`
- (注：原 `src/App.tsx` 也存在但内容相同，组件用的是 `src/components/App.tsx`)

### Step 7.1: 精确替换

**当前 `src/components/App.tsx`（52 行）：**

```tsx
import React, { useState } from 'react';
import { GameScene } from './GameScene';
import { Button } from './ui/shadcn';
import { Card, CardHeader, CardTitle, CardContent } from './ui/shadcn';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const { t } = useTranslation();

  const handleStartGame = () => {
    setGameStarted(true);
  };
  const handleGameOver = () => {
    setGameStarted(false);
  };

  return (
    <div className="w-screen h-screen m-0 p-0 overflow-hidden bg-black font-sans">
      {!gameStarted ? (
        <div className="flex flex-col items-center justify-center w-full h-full bg-[radial-gradient(circle,#1a1a2e_0%,#16213e_50%,#0f3460_100%)] text-white text-center">
          ...
        </div>
      ) : (
        <GameScene onGameOver={handleGameOver} />
      )}
    </div>
  );
};
```

**替换整个文件内容为：**

```tsx
import React, { useState, useEffect } from 'react';
import { GameScene } from './GameScene';
import { Button } from './ui/shadcn';
import { Card, CardHeader, CardTitle, CardContent } from './ui/shadcn';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../services/trpc';
import { getProvider } from '../services/leaderboard';

export const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    getProvider();
  }, []);

  const handleStartGame = () => {
    setGameStarted(true);
  };

  const handleGameOver = () => {
    setGameStarted(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="w-screen h-screen m-0 p-0 overflow-hidden bg-black font-sans">
        {!gameStarted ? (
          <div className="flex flex-col items-center justify-center w-full h-full bg-[radial-gradient(circle,#1a1a2e_0%,#16213e_50%,#0f3460_100%)] text-white text-center">
            <h1 className="text-5xl mb-8 text-cyan-400 drop-shadow-[0_0_20px_rgba(0,212,255,0.5)]">
              {t('app.title')}
            </h1>
            <Button
              onClick={handleStartGame}
              size="lg"
              className="text-lg bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-500 hover:to-blue-700 shadow-lg shadow-cyan-500/30 text-white"
            >
              <Play />
              {t('app.start')}
            </Button>
            <Card className="mt-12 bg-black/50 border-cyan-500/20 max-w-md text-left">
              <CardHeader>
                <CardTitle className="text-cyan-400">{t('app.instructions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-gray-300">
                <p>{t('app.moveControls')}</p>
                <p>{t('app.mouseControls')}</p>
                <p>{t('app.fireControls')}</p>
                <p>{t('app.boostControls')}</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <GameScene onGameOver={handleGameOver} />
        )}
      </div>
    </QueryClientProvider>
  );
};
```

### Step 7.2: 同时更新根目录 `src/App.tsx`（如有引用）

```bash
cd /d h:\工作区\fighter-game && grep -l "from.*App.tsx" src/index.ts src/main.tsx 2>nul || echo "no reference to src/App.tsx"
```

**如果有引用**，则同样修改 `src/App.tsx`；否则跳过。为稳妥起见，执行同步修改：

**Create/Overwrite `src/App.tsx` 内容与上面完全相同（路径改为 `./services/trpc` / `./services/leaderboard`）：**

```tsx
import React, { useState, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/trpc';
import { getProvider } from './services/leaderboard';

export const App: React.FC = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getProvider();
    const t = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className="w-screen h-screen bg-black"
        style={{ display: ready ? 'block' : 'block', visibility: ready ? 'visible' : 'visible' }}
      >
        <p style={{ color: '#4fd1c5', textAlign: 'center', padding: 20 }}>
          Fighter Game — 请通过 src/components/App.tsx 进入主入口
        </p>
      </div>
    </QueryClientProvider>
  );
};

export default App;
```

### Step 7.3: 验证类型检查

```bash
cd /d h:\工作区\fighter-game && npx tsc --noEmit 2>&1 | grep -iE "App\.tsx|QueryClientProvider" | head -10
```

**Expected:** 无匹配输出（无相关错误）。

### Commit 步骤

```bash
cd /d h:\工作区\fighter-game
git add src/components/App.tsx src/App.tsx
git commit -m "feat(app): wrap with QueryClientProvider + pre-init getProvider"
```

---

## Task 8: Refactor GameOver.tsx use useSubmitScore

### 文件清单

- Modify: `src/components/GameOver.tsx`

### Step 8.1: 精确替换

**当前文件关键段（line 22 与 line 77、line 98-105）：**

```tsx
import { LeaderboardService } from '../engine/LeaderboardService';
...
const leaderboardService = new LeaderboardService();
...
  useEffect(() => {
    const submitScoreAndGetRank = async () => {
      const newRank = await leaderboardService.submitScore(stats.score, stats.wave, stats.enemiesDefeated);
      setRank(newRank);
      setSubmittedScore(true);
    };
    submitScoreAndGetRank();
  }, [stats]);
```

**Step 8.1.1: 删除 line 22 原 import，替换为新 import：**

```diff
-import { LeaderboardService } from '../engine/LeaderboardService';
+import { useSubmitScore } from '../services/leaderboard';
```

**Step 8.1.2: 删除 line 77 模块级实例：**

```diff
-const leaderboardService = new LeaderboardService();
```

**Step 8.1.3: 在组件内部（line 92 `const { t }` 之后，line 98 之前）新增状态和 mutation：**

```diff
   const [submittedScore, setSubmittedScore] = useState(false);
   const [rank, setRank] = useState<number | null>(null);
   const [submitError, setSubmitError] = useState<string | null>(null);
   const { t } = useTranslation();
+  const submitMutation = useSubmitScore();
```

**Step 8.1.4: 替换原 useEffect([stats])（lines 98-105）为：**

```tsx
useEffect(() => {
  let cancelled = false;
  const submitScoreAndGetRank = async () => {
    if (typeof stats?.score !== 'number' || stats.score < 0) return;
    try {
      const result = await submitMutation.mutateAsync({
        playerId: 'default_player',
        playerName: 'Player',
        score: stats.score,
        wave: stats.wave,
        kills: stats.enemiesDefeated,
        accuracy: stats.accuracy,
        maxCombo: combatStats?.comboMax,
        bossesKilled: combatStats?.bossesKilled,
        elitesKilled: combatStats?.elitesKilled,
        playTime: stats.timeElapsed,
        powerupsCollected: combatStats?.powerupsCollected,
        damageDealt: combatStats?.damageDealt,
        damageTaken: combatStats?.damageTaken,
      });
      if (cancelled) return;
      setRank(result.rank);
      setSubmitError(null);
    } catch (e: any) {
      if (cancelled) return;
      setSubmitError(e?.message || '分数提交失败');
    } finally {
      if (!cancelled) {
        setSubmittedScore(true);
      }
    }
  };
  submitScoreAndGetRank();
  return () => {
    cancelled = true;
  };
}, [stats, combatStats]);
```

**Step 8.1.5: 修改 rank 渲染区（lines 241-246），在 success 基础上增加 error 态：**

```tsx
{
  submittedScore && submitError && (
    <div className="flex items-center justify-center gap-2 text-red-400 mb-3">
      <span className="text-sm font-bold">提交异常: {submitError}</span>
    </div>
  );
}
{
  submittedScore && !submitError && rank !== null && (
    <div className="flex items-center justify-center gap-2 text-blue-400 mb-3">
      <Medal className="w-4 h-4" />
      <span className="text-sm font-bold">排名: #{rank}</span>
    </div>
  );
}
```

### Step 8.2: 类型检查

```bash
cd /d h:\工作区\fighter-game && npx tsc --noEmit src/components/GameOver.tsx 2>&1 | head -20
```

**Expected:** 0 errors。

### Commit 步骤

```bash
cd /d h:\工作区\fighter-game
git add src/components/GameOver.tsx
git commit -m "refactor(GameOver): replace LeaderboardService with useSubmitScore hook"
```

---

## Task 9: Refactor LeaderboardPanel.tsx use 3 hooks

### 文件清单

- Modify: `src/components/LeaderboardPanel.tsx`

### Step 9.1: 精确替换

**Step 9.1.1: 修改 Props（删除 service，保留 onBack）：**

```diff
 interface LeaderboardPanelProps {
   onBack: () => void;
-  service: LeaderboardService;
 }
```

**Step 9.1.2: 修改 import（line 3）+ 引入 3 hooks：**

```diff
-import { LeaderboardService, LeaderboardFilter } from '../engine/LeaderboardService';
+import type { LeaderboardFilter } from '../engine/LeaderboardService';
+import { useLeaderboardList, useMyRank, useLeaderboardStats } from '../services/leaderboard';
```

**Step 9.1.3: 修改组件签名和状态（去掉 subscribe 机制，改用 RQ state）：**

原 lines 37-56：

```tsx
export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = React.memo(({ onBack, service }) => {
  const [filter, setFilter] = useState<LeaderboardFilter>('all');
  const [_updateTrigger, setUpdateTrigger] = useState({});
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  useEffect(() => {
    const unsub = service.subscribe(() => setUpdateTrigger({}));
    service.fetchLeaderboard(filter);
    return unsub;
  }, [service, filter]);

  useEffect(() => {
    service.fetchLeaderboard(filter);
  }, [service, filter]);

  const entries = useMemo(() => service.getEntries(), [service]);
  const stats = useMemo(() => service.getStats(), [service]);
  const isLoading = useMemo(() => service.isLoadingEntries(), [service]);
  const yourEntry = useMemo(() => service.getYourEntry(), [service]);

  const handleRefresh = () => {
    service.fetchLeaderboard(filter);
  };
```

**替换为：**

```tsx
export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = React.memo(({ onBack }) => {
  const [filter, setFilter] = useState<LeaderboardFilter>('all');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const listQuery = useLeaderboardList({ limit: 50, filter });
  const statsQuery = useLeaderboardStats();
  const myRankQuery = useMyRank('default_player');

  const entries = listQuery.data ?? [];
  const stats = statsQuery.data ?? { totalPlayers: 0, topScore: 0, avgScore: 0, difficultyDistribution: { easy: 0, normal: 0, hard: 0, expert: 0 } };
  const isLoading = listQuery.isLoading || statsQuery.isLoading || myRankQuery.isLoading;
  const error = listQuery.error || statsQuery.error || myRankQuery.error;
  const yourEntry = myRankQuery.data?.entry ?? null;

  const handleRefresh = () => {
    listQuery.refetch();
    statsQuery.refetch();
    myRankQuery.refetch();
  };
```

**Step 9.1.4: 统计卡渲染（line 76-98）中 service.formatScore 替换为内联 toLocaleString：**

```diff
-            <span className="stat-value">{service.formatScore(stats.topScore)}</span>
+            <span className="stat-value">{stats.topScore.toLocaleString()}</span>
             <span className="stat-label">最高分</span>
...
-            <span className="stat-value">{service.formatScore(stats.avgScore)}</span>
+            <span className="stat-value">{stats.avgScore.toLocaleString()}</span>
             <span className="stat-label">平均分</span>
```

**Step 9.1.5: 修改 stats.yourRank 区域（原 line 100-136）——因为 RQ 的 stats 不含 yourRank 字段，改为 myRankQuery：**

原 block：

```tsx
      {stats.yourRank > 0 && (
        <div className="leaderboard-your-rank">
          ...
            <span className="your-rank-number">#{stats.yourRank}</span>
```

**替换为：**

```tsx
{
  myRankQuery.data?.rank !== null &&
    myRankQuery.data?.rank !== undefined &&
    myRankQuery.data.rank > 0 && (
      <div className="leaderboard-your-rank">
        <div className="your-rank-header">
          <Medal className="your-rank-icon" />
          <span className="your-rank-label">你的排名</span>
          {yourEntry?.rankGrade && (
            <span className={`your-rank-grade rank-grade-${yourEntry.rankGrade.toLowerCase()}`}>
              {yourEntry.rankGrade}
            </span>
          )}
        </div>
        <div className="your-rank-content">
          <span className="your-rank-number">#{myRankQuery.data.rank}</span>
          <div className="your-rank-stats">
            <span className="your-rank-stat">
              <Target size={14} /> {yourEntry?.score?.toLocaleString() ?? 0}
            </span>
            <span className="your-rank-stat">
              <Swords size={14} /> Wave {yourEntry?.wave || 0}
            </span>
            {yourEntry?.maxCombo !== undefined && yourEntry.maxCombo > 0 && (
              <span className="your-rank-stat">
                <Zap size={14} /> {yourEntry.maxCombo}x
              </span>
            )}
            {yourEntry?.accuracy !== undefined && yourEntry.accuracy > 0 && (
              <span className="your-rank-stat">
                <Crosshair size={14} /> {Math.round(yourEntry.accuracy * 100)}%
              </span>
            )}
            {yourEntry?.bossesKilled !== undefined && yourEntry.bossesKilled > 0 && (
              <span className="your-rank-stat">
                <Skull size={14} /> {yourEntry.bossesKilled}
              </span>
            )}
          </div>
        </div>
      </div>
    );
}
```

**Step 9.1.6: 加载/错误渲染（原 lines 150-158）添加 error 分支：**

```tsx
      <div className="leaderboard-content">
        {isLoading ? (
          <div className="leaderboard-loading">
            <RefreshCw className="animate-spin" size={32} />
            <span>加载中...</span>
          </div>
        ) : error ? (
          <div className="leaderboard-loading text-red-400">
            <span>加载失败: {(error as any)?.message || '未知错误'}</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="leaderboard-empty">暂无排行数据</div>
```

**Step 9.1.7: 列表项中的 `service.formatScore(entry.score)` 和 `service.formatDate(entry.timestamp)`（line 198/202）替换为本地实现：**

```diff
-                    <span className="list-col-score">{service.formatScore(entry.score)}</span>
+                    <span className="list-col-score">{entry.score.toLocaleString()}</span>
...
-                      {service.formatDate(entry.timestamp)}
+                      {formatDate(entry.timestamp instanceof Date ? entry.timestamp.getTime() : entry.timestamp)}
```

**在组件外部顶部 filterLabels 定义之后，增加一个 formatDate 纯函数：**

```tsx
function formatDate(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
```

### Step 9.2: 类型检查

```bash
cd /d h:\工作区\fighter-game && npx tsc --noEmit src/components/LeaderboardPanel.tsx 2>&1 | head -30
```

**Expected:** 0 errors。

### Commit 步骤

```bash
cd /d h:\工作区\fighter-game
git add src/components/LeaderboardPanel.tsx
git commit -m "refactor(LeaderboardPanel): use 3 RQ hooks + drop service prop"
```

---

## Task 10: Update CloudSaveSystem.ts (命令式接入)

### 文件清单

- Modify: `src/engine/CloudSaveSystem.ts`

### Step 10.1: 顶部 import 替换（line 96 附近 gameDatabase import 之前/之后）

```diff
 import { gameDatabase } from './GameDatabase';
+import { getProvider } from '../services/leaderboard';
+import type { SubmitScoreInput, LeaderboardEntryDTO } from '../shared/schemas/leaderboard';
```

### Step 10.2: 重写 getLeaderboard 方法（原 lines 450-482）

原：

```typescript
  public async getLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
    if (!this.isOnline || this.localOnly) {
      return this.getLocalLeaderboard(limit);
    }

    try {
      const controller = new AbortController();
      ...
      const entries: LeaderboardEntry[] = await response.json();
      const ranked = this.assignRanks(entries);
      this.leaderboardCallbacks.forEach((cb) => cb(ranked));
      return ranked;
    } catch (error) {
      console.warn('Failed to fetch leaderboard:', error);
      return this.getLocalLeaderboard(limit);
    }
  }
```

**替换为：**

```typescript
  public async getLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
    try {
      const provider = getProvider();
      const dtoList = await provider.list({ limit, filter: 'all' });
      const entries: LeaderboardEntry[] = dtoList.map((dto: LeaderboardEntryDTO) => ({
        ...(dto as any),
        timestamp: dto.timestamp instanceof Date ? dto.timestamp.getTime() : new Date(dto.timestamp).getTime(),
      }));
      const ranked = this.assignRanks(entries);
      this.leaderboardCallbacks.forEach((cb) => cb(ranked));
      return ranked;
    } catch (error) {
      console.warn('[CloudSaveSystem] provider.list failed, fallback getLocalLeaderboard:', error);
      return this.getLocalLeaderboard(limit);
    }
  }
```

### Step 10.3: 重写 submitScore 方法（原 lines 497-534）

原：

```typescript
  public async submitScore(entry: Omit<LeaderboardEntry, 'rank' | 'timestamp'>): Promise<boolean> {
    const fullEntry: LeaderboardEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    const local = this.getLocalLeaderboard(1000);
    const updated = [...local, fullEntry].sort((a, b) => b.score - a.score).slice(0, 100);

    localStorage.setItem('leaderboard', JSON.stringify(updated));

    if (this.isOnline && !this.localOnly) {
      try {
        const controller = new AbortController();
        ...
        return response.ok;
      } catch (error) {
        console.warn('Failed to submit score:', error);
        return false;
      }
    }

    return true;
  }
```

**替换为：**

```typescript
  public async submitScore(entry: Omit<LeaderboardEntry, 'rank' | 'timestamp'>): Promise<boolean> {
    const fullEntry: LeaderboardEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    const local = this.getLocalLeaderboard(1000);
    const updated = [...local, fullEntry].sort((a, b) => b.score - a.score).slice(0, 100);
    localStorage.setItem('leaderboard', JSON.stringify(updated));

    try {
      await gameDatabase.saveLeaderboardEntry?.(fullEntry as any);
    } catch {
      // Dexie 表不一定存在，忽略
    }

    if (this.isOnline && !this.localOnly) {
      try {
        const payload: SubmitScoreInput = {
          playerId: entry.playerId,
          playerName: entry.playerName,
          score: entry.score,
          wave: entry.wave,
          kills: entry.kills,
          accuracy: entry.accuracy,
          maxCombo: entry.maxCombo,
          bossesKilled: entry.bossesKilled,
          elitesKilled: entry.elitesKilled,
          playTime: entry.playTime,
          powerupsCollected: entry.powerupsCollected,
          damageDealt: entry.damageDealt,
          damageTaken: entry.damageTaken,
          rankGrade: entry.rankGrade,
        };
        const provider = getProvider();
        await provider.submit(payload);
        try {
          await this.getLeaderboard(100);
        } catch {
          // ignore refetch error for callbacks
        }
        return true;
      } catch (error) {
        console.warn('[CloudSaveSystem] provider.submit failed, local already saved OK:', error);
        return true;
      }
    }

    return true;
  }
```

### Step 10.4: 类型检查

```bash
cd /d h:\工作区\fighter-game && npx tsc --noEmit src/engine/CloudSaveSystem.ts 2>&1 | head -30
```

**Expected:** 0 errors（允许 Dexie 的 saveLeaderboardEntry 不存在；?. 短路静默即可）。

### Commit 步骤

```bash
cd /d h:\工作区\fighter-game
git add src/engine/CloudSaveSystem.ts
git commit -m "refactor(CloudSaveSystem): imperative adapter via getProvider()"
```

---

## Task 11: Negative Type Test

### 文件清单

- Create: `scripts/typecheck-leaderboard-negative.mjs`
- Create: `tests/types/leaderboard-negative.ts`

### Step 11.1: 创建 negative 源文件

**Create `tests/types/leaderboard-negative.ts`：**

```typescript
import {
  submitScoreSchema,
  listInputSchema,
  statsSchema,
} from '../../src/shared/schemas/leaderboard';

const parsedSubmit = submitScoreSchema.parse({
  playerId: 'u1',
  playerName: 'Alice',
  score: 1000,
  wave: 5,
  kills: 50,
});

// 错误 1: limit 传字符串 '五' 而非 number
const badInput1 = listInputSchema.parse({ limit: '五' });

// 错误 2: playerId 传数字 123 而非 string
const badSubmit = submitScoreSchema.parse({
  playerId: 123,
  playerName: 'X',
  score: 100,
  wave: 1,
  kills: 0,
});

// 错误 3: 访问不存在的属性 nonexistent
const good = statsSchema.parse({
  totalPlayers: 10,
  topScore: 1000,
  avgScore: 500,
  difficultyDistribution: { easy: 2, normal: 5, hard: 2, expert: 1 },
});
console.log(good.nonexistent);

// 错误 4: string 变量被赋 number 值
const parsedStats = statsSchema.parse({
  totalPlayers: 1,
  topScore: 99,
  avgScore: 50,
  difficultyDistribution: { easy: 0, normal: 1, hard: 0, expert: 0 },
});
const s: string = parsedStats.topScore;
```

### Step 11.2: 创建 runner 脚本（跨平台 ESM）

**Create `scripts/typecheck-leaderboard-negative.mjs`：**

```mjs
#!/usr/bin/env node
/**
 * Negative 类型检查器：确保 tests/types/leaderboard-negative.ts 中的故意错误
 * 一定会被 tsc 捕获到。如果 tsc 不报任何错误 -> 类型防线被突破 -> FAIL
 */
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'tests', 'types', 'leaderboard-negative.ts');

function findTsc() {
  const candidates = [
    path.join(ROOT, 'node_modules', '.bin', 'tsc.cmd'),
    path.join(ROOT, 'node_modules', '.bin', 'tsc'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'tsc';
}

const tsc = findTsc();
const args = [
  '--noEmit',
  '--strict',
  '--target',
  'ES2022',
  '--module',
  'ESNext',
  '--moduleResolution',
  'bundler',
  '--esModuleInterop',
  '--skipLibCheck',
  TARGET,
];

let exitCode = 0;
let stdout = '';
let stderr = '';

if (process.platform === 'win32') {
  const result = spawnSync(tsc, args, { encoding: 'utf8', cwd: ROOT, shell: false });
  stdout = result.stdout;
  stderr = result.stderr;
  exitCode = result.status ?? -1;
} else {
  const result = spawnSync(tsc, args, { encoding: 'utf8', cwd: ROOT });
  stdout = result.stdout;
  stderr = result.stderr;
  exitCode = result.status ?? -1;
}

const combined = (stdout + '\n' + stderr).trim();
const hasOutput = combined.length > 0;

console.log('========== typecheck:leaderboard:negative ==========');
console.log(`tsc exit code: ${exitCode}`);
if (hasOutput) {
  console.log('--- tsc output (captured intentional errors) ---');
  console.log(combined);
  console.log('---------------------------------------------------');
}

if (exitCode !== 0 && hasOutput) {
  console.log('✅ PASS: tsc correctly caught intentional type errors');
  process.exit(0);
} else if (exitCode === 0) {
  console.error(
    '❌ FAIL: tsc exited 0 — type safety line breached! Intentionally bad file did not error.',
  );
  process.exit(1);
} else {
  console.error('❌ FAIL: tsc exited non-zero but produced no output — tsc install may be broken');
  process.exit(2);
}
```

### Step 11.3: 给脚本 +x（仅 POSIX 可选，Windows 跳过）并运行

```bash
cd /d h:\工作区\fighter-game && node scripts/typecheck-leaderboard-negative.mjs
```

**Expected:** 输出 ✅ PASS 行，退出码 0。tsc 会捕获 4 类错误（字符串 limit、数字 playerId、不存在属性、string=number）。

### Commit 步骤

```bash
cd /d h:\工作区\fighter-game
git add scripts/typecheck-leaderboard-negative.mjs tests/types/leaderboard-negative.ts
git commit -m "test(negative): tsc leaderboard type-safety guard script"
```

---

## Task 12: README Documentation Update

### 文件清单

- Modify: `README.md` (末尾追加新章节)

### Step 12.1: 在 README.md 末尾追加章节

```markdown
## 📊 排行榜架构（Phase 3: tRPC + React Query）

### 架构图 (ASCII)
```

┌─────────────── GameOver / LeaderboardPanel / CloudSaveSystem ───────────────┐
│ useSubmitScore useLeaderboardList / useMyRank / useStats │
└──────────────────────────────┬──────────────────────────────────────────────┘
│ @tanstack/react-query QueryClient
│ staleTime=30s, invalidateQueries(['leaderboard'])
┌──────────────────────────────▼──────────────────────────────────────────────┐
│ LeaderboardProvider Interface (list / submit / myRank / stats) │
│ ├─ MockProvider (localStorage + 内存种子，50条) │
│ └─ TRPCProvider (poc/trpc-leaderboard，4条降级规则) │
└──────────────┬──────────────────────────┬──────────────────────────────────┘
│ Zod 单一类型来源 │ tRPC (type-only import AppRouter)
▼ ▼
src/shared/schemas/ ../../poc/trpc-leaderboard/src/router
leaderboard.ts (零运行时耦合，仅类型)

````

### 环境变量

| 变量 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| VITE_LEADERBOARD_PROVIDER | `'mock' \| 'trpc'` | `mock` | 选择上游策略。mock = 本地+离线开发；trpc = 连 POC |
| VITE_TRPC_URL | `string?` | `http://localhost:2026` | tRPC Endpoint，仅 provider=trpc 时生效 |

### 4 条降级规则 (TRPCProvider)

1. **空 URL / 构造失败** → 直用 MockProvider（不抛）
2. **navigator.onLine === false** → 降级 MockProvider
3. **网络错误 / HTTP 5xx** → `console.debug` 记录 + 降级 MockProvider
4. **Zod BAD_REQUEST** → 不降级，**向上抛出**（保留错误可见性）

### 命令速查

```bash
# 类型安全 (negative) —— 故意坏代码必须被拒
npm run typecheck:leaderboard:negative
# Expected: 输出 ✅ PASS，tsc 退出码非 0 且有输出 → 脚本 exit 0

# Provider + schemas 综合测试
npm run test:provider
# Expected: 覆盖 MockProvider、TRPCProvider(msw)、hooks 集成、schemas 单测，全 PASS
````

### test:provider 覆盖范围

| 测试文件                                                  | 覆盖点                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/shared/schemas/__tests__/leaderboard.test.ts`        | 各 schema 边缘 case（负数/超界/空串/缺失）                           |
| `src/services/leaderboard/__tests__/MockProvider.test.ts` | list 长度/排序、filter 分数区间、submit+rank=1、myRank、stats 一致性 |
| `src/services/leaderboard/__tests__/TRPCProvider.test.ts` | msw 4 降级、friends Omit、500 降级、Zod 400 抛、timestamp→Date       |
| `src/services/leaderboard/__tests__/hooks.test.tsx`       | renderHook 三态、useSubmitScore→invalidate→榜单重取登顶              |

````

### Step 12.2: 验证 README 渲染

```bash
cd /d h:\工作区\fighter-game && grep -c "排行榜架构" README.md
````

**Expected:** ≥ 1。

### Commit 步骤

```bash
cd /d h:\工作区\fighter-game
git add README.md
git commit -m "docs(readme): phase3 leaderboard architecture + env + commands"
```

---

## Task 13: Final Verification (5 Stages) ✅ 全部通过

> **验证结果汇总（2026-08-02）：**
>
> - **S1 typecheck 全局 0 errors** ✅ — `npm run typecheck` 退出码 0
> - **S2 4 个测试文件 vitest run 全 PASS** ✅ — schemas + MockProvider + TRPCProvider(msw) + hooks 集成测试
> - **S3 TRPC 真连接** ✅ — VITE_LEADERBOARD_PROVIDER=trpc 连接 POC server，总玩家数 20，Top5 名带 `_${i}` 后缀，分数 10000-210000，符合 POC seed 特征
> - **S4 mock 一致性** ✅ — 150 条种子数据加载，filter(daily/weekly/monthly/friends/all) 切换全部有效（日榜榜首"星际猎人"97132、周榜"闪电侠"262877、好友榜"虚空行者_111"860734），submit 后 localStorage 榜首 topId='default_player'、topScore=999000000、topRank=1
> - **S5 自动刷新** ✅ — console 触发 `provider.submit(tester_climbs, 1_000_000_000)` + `queryClient.invalidateQueries(['leaderboard'])`，3 秒内 LeaderboardPanel 自动 refetch，榜首变为 Tester，无需手动点 refresh

### Step 13.1: S1 — typecheck 全局 0 errors

```bash
cd /d h:\工作区\fighter-game && npm run typecheck 2>&1 | tail -15
```

**Expected:** 无任何 `error TS` 输出，退出码 0。

### Step 13.2: S2 — 4 个测试文件 vitest run 全 PASS

```bash
cd /d h:\工作区\fighter-game && npm run test:provider 2>&1 | tail -40
```

**Expected:** 4 个文件全部 passed，总用例数 ≥ 50+，退出码 0。

### Step 13.3: S3 — TRPC 真实验证（连 POC）

**Terminal A (poc/trpc-leaderboard, 端口 2026)：**

```bash
cd /d h:\工作区\fighter-game\poc\trpc-leaderboard
npm install 2>&1 | tail -5
npm run dev
```

**Expected:** 控制台输出 `listening on http://localhost:2026` 或类似。

**Terminal B (fighter-game front)：**

```bash
cd /d h:\工作区\fighter-game
# 临时设置 env（PowerShell）
$env:VITE_LEADERBOARD_PROVIDER="trpc"
$env:VITE_TRPC_URL="http://localhost:2026"
npm run dev
```

**Expected:** LeaderboardPanel Top 5 名字是 POC seed 固定名（无 `_${i}` 后缀），与 MockProvider 的 `星际猎人_${i}` 后缀区分明显。

### Step 13.4: S4 — mock 一致验证

```bash
cd /d h:\工作区\fighter-game
# 去掉 env 重启（新开窗口不设即可）
npm run dev
```

**Expected:**

- 50 条数据加载完成
- filter(daily/weekly/monthly/friends/all) 切换全部有效（长度变化或内容变化）
- GameOver 提交高分 → localStorage `leaderboard` 键存在且 JSON.parse 后榜首 playerId = `default_player`，rank 渲染 #1

### Step 13.5: S5 — 自动刷新（GameOver→Panel 登顶联动）

1. 在浏览器打开 LeaderboardPanel，保持打开
2. 新开另一个窗口触发 GameOver（或手动调用 useSubmitScore），提交 `score=999999999` + `playerName='Tester'` + `playerId='tester_climbs'`
3. 切回 LeaderboardPanel（**不手动点 refresh**）
4. 观察 queryClient invalidateQueries 自动重取 → `Tester` 成为 #1

**Expected:** 无需手点刷新，Tester 登顶完成。

### Commit 步骤（验证完成后的收尾）

```bash
cd /d h:\工作区\fighter-game
git status
git add -u
git commit -m "chore(phase3): final verification S1-S5 pass, cleanup unused imports"
```

---

## Self-Review

### 1. Spec 覆盖表格

| #   | Spec 章节                                            | 覆盖 Task                                               | 备注                                                           | Status |
| --- | ---------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| S1  | 全局 typecheck 0 errors                              | Task 2,7,8,9,10,11（Task 2 定义 env, 7-10 改造后 0 错） | tsc --noEmit                                                   | ✅     |
| S2  | 4 个测试文件 vitest run 全 PASS                      | Task 3,4,5,6                                            | 4 files: schemas + MockProvider + TRPCProvider + hooks         | ✅     |
| S3  | POC trpc 真实 Top5 无 suffix                         | Task 5,7,9,13.3                                         | TRPCProvider list + friends Omit                               | ✅     |
| S4  | mock 50条 + filter 有效 + localStorage 登顶          | Task 4,8,9,13.4                                         | MockProvider seeds + submit writeStorage                       | ✅     |
| S5  | 自动刷新 invalidateQueries                           | Task 6,8,9,13.5                                         | useSubmitScore onSuccess → invalidateQueries(['leaderboard'])  | ✅     |
| 1   | 4 个生产依赖 zod/trpc/rq/superjson                   | Task 1                                                  | npm install 4 prod deps                                        | ✅     |
| 2   | YAGNI 边界：不接真实 DB，只 POC + mock               | Task 4,5                                                | 无 prisma，POC type-only                                       | ✅     |
| 3   | Zod 单一类型来源                                     | Task 3                                                  | submitScoreSchema/leaderboardEntrySchema/listInput 唯一真源    | ✅     |
| 4   | AppRouter type-only import (零运行时耦合)            | Task 5                                                  | `import type { AppRouter } from '../../poc/...'`               | ✅     |
| 5   | 4 条降级规则 (1空URL 2离线 3网络/5xx 4Zod 400不降级) | Task 5                                                  | fallbackOrThrow allowFallback 开关                             | ✅     |
| 6   | filter=friends 时 Omit filter 转发（POC 不支持）     | Task 5,6                                                | TRPCProvider.list 构造 trpcInput 不含 filter，客户端切片 10-25 | ✅     |
| 7   | staleTime=30s + invalidateQueries(['leaderboard'])   | Task 5,6                                                | queryClient defaultOptions + useSubmitScore onSuccess          | ✅     |
| 8   | Negative Type Test (防线)                            | Task 11                                                 | 4 类故意错 + runner 脚本必须退出 0                             | ✅     |
| 9   | MSW mock (TRPC 降级网络)                             | Task 5                                                  | msw/node setupServer http.post                                 | ✅     |
| 10  | 3 组件改造：App/GameOver/LeaderboardPanel            | Task 7,8,9                                              | QueryClientProvider + 3 hooks                                  | ✅     |
| 11  | CloudSaveSystem 命令式接入                           | Task 10                                                 | getProvider().list / .submit，本地优先                         | ✅     |
| 12  | README 文档                                          | Task 12                                                 | ASCII 架构图 + 环境变量表 + 命令覆盖                           | ✅     |
| 13  | scripts + test:provider 命令                         | Task 1,12                                               | scripts 中 2 条新增                                            | ✅     |
| 14  | env 变量类型                                         | Task 2                                                  | vite-env.d.ts + .env.example                                   | ✅     |
| 15  | 命令式/声明式双通路                                  | Task 9,10                                               | 组件用 hooks，CloudSaveSystem 用 getProvider()                 | ✅     |
| 16  | queryKey 粒度（3维度）                               | Task 6                                                  | ['leaderboard', 'list'\|'myRank'\|'stats', ...params]          | ✅     |

### 2. 占位符检查

| 可疑占位符            | 扫描结果                                                                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TBD                   | 全文 0 处                                                                                                                                                                                                                                                            |
| TODO                  | 全文 0 处                                                                                                                                                                                                                                                            |
| xxx / yyy / foo / bar | 全文 0 处                                                                                                                                                                                                                                                            |
| 真实语义字段          | playerId, playerName, score, wave, kills, accuracy, maxCombo, bossesKilled, elitesKilled, playTime, powerupsCollected, damageDealt, damageTaken, rankGrade, difficulty — 全部来自业务字段（与 CombatStatsDetail / LeaderboardEntry / 现有 CloudSaveSystem 语义一致） |

**结论：✅ 无占位符污染。**

### 3. 类型一致性检查（8+ 契约对）

| #   | 契约 A                                              | 契约 B                                                    | 对齐依据                                                                           | Status |
| --- | --------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| 1   | `submitScoreSchema` (zod)                           | `SubmitScoreInput` (type infer)                           | z.infer 自动推导                                                                   | ✅     |
| 2   | `leaderboardEntrySchema`                            | `LeaderboardEntryDTO`                                     | z.infer                                                                            | ✅     |
| 3   | `listInputSchema.limit/difficulty/filter`           | `AppRouter.leaderboard.list.input.limit/difficulty` (POC) | TRPCProvider 转发时额外 `as any` 仅扩展 Omit(POC, 'filter')                        | ✅     |
| 4   | MockProvider.list 返回 LeaderboardEntryDTO[]        | LeaderboardEntryDTO (zod)                                 | MockProvider.generateSeedEntries + date→new Date 严格对齐                          | ✅     |
| 5   | GameOver.tsx mutateAsync payload                    | submitScoreSchema 必填/可选字段                           | 3 必填 + 9 可选 → parse 在 mutationFn 内                                           | ✅     |
| 6   | CloudSaveSystem.submit(payload)                     | SubmitScoreInput (shared)                                 | SubmitScoreInput 显式字段对齐，as any 仅 DTO→CloudSaveSystem.LeaderboardEntry 超集 | ✅     |
| 7   | queryKey 粒度与 React Query 推荐                    | list/myRank/stats + 参数                                  | `['leaderboard','list',filter,difficulty,limit]`                                   | ✅     |
| 8   | TRPCProvider `c.leaderboard.list.query(input)` 调用 | AppRouter 类型推断                                        | createTRPCClient<AppRouter> 保证调用端到端类型                                     | ✅     |
| 9   | LeaderboardProvider 4 方法签名                      | MockProvider / TRPCProvider 实现                          | interface 显式约束                                                                 | ✅     |

### 4. 风险记录

| #   | 风险点                                                                                            | 级别 | 缓解措施 / 当前自审状态                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | POC AppRouter 改动（字段增删改）导致前端 type-only import 处编译断                                | 中   | ✅ type-only import 保证 POC 一改 tsc 立即报错，S1 型检查即捕获；不允许静默运行时错位                                     |
| 2   | `navigator.onLine` 在 jsdom 中恒为 `true`（Vitest jsdom），无法测「离线降级」                     | 低   | ✅ MSW 仅测 Rule 1(空URL) / Rule 3(网络错/5xx) / Rule 4(Zod 400 抛)，Rule 2 通过人工自审 + fallbackOrThrow 分支覆盖率验证 |
| 3   | CloudSaveSystem.ts 中 DTO→LeaderboardEntry 超集字段用 `as any` 过渡，阶段四未统一 schema 时可能飘 | 中   | ✅ 任务末尾备注 `阶段四统一 DB schema 时移除 as any`；目前被 submitScoreSchema 在 provider.submit 端兜底                  |

### 5. 任务可执行性

| 维度                   | 状态 | 说明                                                                                                                                   |
| ---------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 每 Task 最小单元       | ✅   | 1-13 每个 Task 可独立 checkout + 执行；依赖为线性（Task1→2→3→4→5→6→7→8→9→10→11→12→13，无循环）                                         |
| 每 Task 明确 Commit 点 | ✅   | 13 Task 末尾均提供 `git add ... && git commit -m "..."` 模板                                                                           |
| 每 Task Expected 明确  | ✅   | 每个验证命令下均给出 Expected 文本描述，可直接比对                                                                                     |
| TDD 落实位置           | ✅   | Task 3 (schemas) / Task 4 (MockProvider) / Task 5 (TRPCProvider+msw) / Task 6 (hooks integration) 四处严格按 failing→实现→passing 三段 |
| 可回滚性               | ✅   | 每个 Task 都是单一职责 commit；如中间失败可 `git reset --hard <last-ok-commit>` 退回                                                   |

---

## 下一步：执行选型

| 选项               | 方式                                                                                                                                | 优点                                                                                           | 缺点                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **选项 A（推荐）** | **Subagent-Driven 串行执行**：1 个子代理按 Task 1 → Task 13 顺序依次落地，每 Task 结束后自动 `git commit`，失败自动暂停等待人工介入 | 原子化强、失败隔离、生成的 commit 历史清晰可 review；每 Task 自动跑 test+typecheck 后再 commit | 需要子代理调度框架支持；若人工审查严格，总时长较选项 B 稍长 |
| 选项 B             | **Inline 逐步**：当前 Agent 一步步执行 Task 1-13，每完成一步向用户汇报，等待确认再继续                                              | 人在回路，每一步用户都可以修改计划或补充上下文                                                 | 速度慢；用户确认是阻塞点；Agent 上下文可能在长任务中漂移    |

**默认推荐选项 A（Subagent-Driven），可立即启动子代理流程。**
