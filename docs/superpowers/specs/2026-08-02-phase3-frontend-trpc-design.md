# 阶段三设计：前端 tRPC + React Query DX 改造

> 日期：2026-08-02
> 状态：设计稿待 review
> 范围：仅 `src/` 前端代码，不动 `server/`、`poc/`、`edge/`
> 前置：阶段二 POC（Neon + Prisma、tRPC + Zod）均已验证通过

---

## 1. 目标与成功判定

### 1.1 目标

承接阶段二 tRPC POC 的类型安全验证成果，将排行榜服务从「纯 mock + 手写订阅发布」改造为「Zod 单一类型来源 + Provider 可插拔策略 + @tanstack/react-query 状态管理」。**在不接入真实数据库的前提下**，证明架构的正确性和对开发体验的提升。

### 1.2 成功判定（验收标准）

| #   | 指标                                                                                                        | 判定方法       |
| --- | ----------------------------------------------------------------------------------------------------------- | -------------- |
| S1  | `npm run typecheck` 全局 0 错误                                                                             | CI / 手动运行  |
| S2  | 新增 Provider 单元 + 集成测试全部通过                                                                       | `npm run test` |
| S3  | `VITE_LEADERBOARD_PROVIDER=trpc` + 启动 tRPC POC server 时，LeaderboardPanel 显示真实数据（非 mock 随机名） | 手动           |
| S4  | `VITE_LEADERBOARD_PROVIDER=mock` 时，行为与改造前完全一致（不破坏旧体验）                                   | 手动对比       |
| S5  | GameOver 提交分数后，LeaderboardPanel「我的排名」自动刷新，无需手动刷新页面                                 | 手动           |

---

## 2. 架构设计

### 2.1 目录结构变更

```
src/
├── shared/
│   └── schemas/
│       └── leaderboard.ts          # NEW：Zod schema 单一类型来源
├── services/
│   ├── trpc.ts                     # NEW：@trpc/client + QueryClient 单例
│   └── leaderboard/
│       ├── types.ts                # NEW：LeaderboardProvider 接口 + ProviderKind
│       ├── MockProvider.ts         # NEW：现有 generateMockEntries() 搬入
│       ├── TRPCProvider.ts         # NEW：@trpc/client 包装，失败降级 Mock
│       └── index.ts                # MOD：单例入口 + React Query hooks
├── engine/
│   └── CloudSaveSystem.ts          # MOD：getLeaderboard/submitScore → 走 Provider
├── components/
│   ├── LeaderboardPanel.tsx        # MOD：useLeaderboardList hook，取消 service prop
│   └── GameOver.tsx                # MOD：useSubmitScore hook，取消 new LeaderboardService
└── App.tsx                         # MOD：包裹 QueryClientProvider 最外层
```

### 2.2 新增依赖（3 个，均为生产依赖）

| 包                      | 版本约束 | 作用                                                          | 估算 gzipped |
| ----------------------- | -------- | ------------------------------------------------------------- | ------------ |
| `@trpc/client`          | ^11.0.0  | tRPC 客户端（类型来自 POC 的 `AppRouter type`，零运行时耦合） | ~40KB        |
| `@tanstack/react-query` | ^5.62.0  | 查询缓存 + 状态管理，替代手写 `Set<() => void>` 订阅          | ~20KB        |
| `superjson`             | ^2.2.2   | `Date/BigInt/Map/Set` 序列化对齐（tRPC transformer 要求）     | ~12KB        |

合计：~72KB gzipped。

### 2.3 不做什么（YAGNI 边界）

- 不动 `server/`、`poc/`、`edge/` 目录
- 不引入 `@trpc/react-query`（用 vanilla client + 原生 React Query，减少一层封装）
- 不改动 Dexie 本地 `GameDatabase.ts`（继续作为离线兜底）
- 不实现 `RESTProvider`（仅在 `types.ts` 预留枚举位，阶段四可选）
- 不新增 Playwright E2E（阶段四补）

---

## 3. 组件职责与接口定义

### 3.1 共享 Schema：`src/shared/schemas/leaderboard.ts`

类型唯一来源。从 `poc/trpc-leaderboard/src/schemas/leaderboard.ts` 拷贝，**关键调整**：

- `leaderboardEntrySchema.timestamp` 改为 `z.number()`（毫秒），**不再依赖 superjson 的 Date→ISO 转换**。原因：`CloudSaveSystem.ts` 的 LeaderboardEntry 契约明确为 `timestamp: number`，保持一致性避免客户端二次转换。
- `listInputSchema` 新增 `filter` 字段（对齐前端 `LeaderboardFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'friends'`），MockProvider 按 filter 范围生成不同分数区间。

导出：

```typescript
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
  timestamp: z.number(), // 毫秒时间戳，对齐 CloudSaveSystem 契约
  rank: z.number(),
  // 可选字段同上，省略
});
export type LeaderboardEntryDTO = z.infer<typeof leaderboardEntrySchema>;

export const listInputSchema = z.object({
  limit: z.number().min(1).max(500).default(50),
  difficulty: difficultySchema.optional(),
  filter: z.enum(['all', 'daily', 'weekly', 'monthly', 'friends']).default('all'),
});
export type ListInput = z.infer<typeof listInputSchema>;
```

### 3.2 Provider 策略接口：`src/services/leaderboard/types.ts`

```typescript
import type {
  SubmitScoreInput,
  LeaderboardEntryDTO,
  ListInput,
} from '../../shared/schemas/leaderboard';

export interface LeaderboardProvider {
  list(input: ListInput): Promise<LeaderboardEntryDTO[]>;
  submit(input: SubmitScoreInput): Promise<LeaderboardEntryDTO>;
  myRank(playerId: string): Promise<{
    rank: number | null;
    entry: LeaderboardEntryDTO | null;
  }>;
  stats(): Promise<{
    totalPlayers: number;
    avgScore: number;
    topScore: number;
    todayGames: number;
  }>;
}

export type ProviderKind = 'mock' | 'trpc' | 'rest';
```

MockProvider 和 TRPCProvider 实现同一接口，切换时上层零改动。

### 3.3 单例 + React Query Hooks：`src/services/leaderboard/index.ts`

```typescript
// 单例 provider（按 VITE_LEADERBOARD_PROVIDER 选择，默认 mock）
let provider: LeaderboardProvider | null = null;
export function getProvider(): LeaderboardProvider {
  /* lazy 初始化，失败降级 Mock */
}

// ===== React Query Hooks（组件层 API）=====

export function useLeaderboardList(input: ListInput) {
  return useQuery({
    queryKey: ['leaderboard', 'list', input.filter, input.difficulty, input.limit],
    queryFn: () => getProvider().list(input),
    staleTime: 30_000,
  });
}

export function useSubmitScore() {
  const qc = useQueryClient();
  return useMutation({
    // 提交前 Zod runtime 校验：输入不合法直接抛，不触网
    mutationFn: (input: SubmitScoreInput) => {
      submitScoreSchema.parse(input);
      return getProvider().submit(input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leaderboard'] }),
  });
}

export function useMyRank(playerId: string) {
  /* useQuery 封装 */
}
export function useLeaderboardStats() {
  /* useQuery 封装 */
}
```

### 3.4 Provider 实现要点

**MockProvider**：

- 抽取现有 `LeaderboardService.generateMockEntries()` 逻辑，按 `ListInput.filter` 生成对应分数区间（现有实现已按 daily/weekly/monthly/all 生成不同 baseScore）
- `filter=friends`：MockProvider 返回排名 10-25 区间的种子玩家模拟"好友榜"，不调用真实社交关系
- `submit()` 推入内存数组、排序、计算 rank，写 `localStorage['leaderboard']`（保持现有 entry 结构，timestamp 同样是 number 毫秒，格式兼容）
- **不写 Dexie**：Dexie 是 CloudSaveSystem 的职责

**TRPCProvider**：

- tRPC client 指向 `VITE_TRPC_URL`（默认 `http://localhost:2026`），transformer 用 superjson（entry timestamp 已是 number，但 AppRouter 其他 procedure 仍可能需要 Date 序列化）
- `import type { AppRouter } from '../../../poc/trpc-leaderboard/src/router/index'`：纯类型导入，客户端不打包 POC 代码
- 降级策略（4 条规则）：
  1. `VITE_LEADERBOARD_PROVIDER !== 'trpc'` 或 `VITE_TRPC_URL` 为空 → 直接返回 MockProvider
  2. `navigator.onLine === false` → 降级 MockProvider
  3. 请求失败（HTTP 5xx / AbortError / TypeError fetch 失败） → 降级 MockProvider + console.debug
  4. 请求失败是 Zod 校验错误（`err.cause instanceof ZodError` 或 tRPC `code=BAD_REQUEST`）→ **不降级**（属于真正的契约错配），向上抛错 + console.warn
- `filter=friends` 字段在当前 POC 的 `AppRouter.leaderboard.list.input` schema 中**尚未声明**。因类型安全，直接传入会触发 tsc 编译期报错。处理方式：TRPCProvider 在转发时执行 `inputForTRPC = { limit, difficulty }`（Omit filter 字段），filter 仅用于**客户端后处理**（将 POC 返回的列表按 filter 范围二次模拟过滤）。这保证编译通过，等 POC/后端升级 schema 后可切换为原生过滤

### 3.5 调用点改造

| 文件                                                                                          | 现状                                                                       | 改造                                                                                                 |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [App.tsx](file:///h:/工作区/fighter-game/src/App.tsx#L16)                                     | `new LeaderboardService()` 传参 + TooltipProvider/ToastProvider 包裹       | 最外层加 `QueryClientProvider client={queryClient}`；删除 `new`；删除 leaderboardService prop 传递   |
| [GameOver.tsx](file:///h:/工作区/fighter-game/src/components/GameOver.tsx#L77)                | `new LeaderboardService().submitScore(score,wave,kills,details)` 返回 rank | 调 `useSubmitScore().mutateAsync(payload)` 得 `entry.rank`；成功后 Toast 提示                        |
| [LeaderboardPanel.tsx](file:///h:/工作区/fighter-game/src/components/LeaderboardPanel.tsx#L8) | 接收 `service: LeaderboardService` prop + service.subscribe 手动订阅       | 改为 `const { data, isLoading, error } = useLeaderboardList(input)`；三态渲染，移除 subscribe        |
| [CloudSaveSystem.ts](file:///h:/工作区/fighter-game/src/engine/CloudSaveSystem.ts#L450)       | `fetch('${endpoint}/leaderboard')` 从未工作，失败走本地                    | 改为 `getProvider().list({limit})`；失败回退 `gameDatabase.getLeaderboard(limit)`（现有 Dexie 本地） |

---

## 4. 数据流与错误处理

### 4.1 三条核心数据流

**（A）打开排行榜面板**：`LeaderboardPanel` → `useLeaderboardList({limit:50})` → React Query 查缓存 → 未命中则 `getProvider().list()` → Mock 生成 或 tRPC 调用（失败降级）→ 缓存 30s → 组件渲染 data/loading/error。

**（B）游戏结束提交**：`GameOver` 按钮 → `useSubmitScore().mutateAsync(payload)` → `submitScoreSchema.parse(payload)` 前端校验（失败直接 Toast）→ 成功则 `invalidateQueries(['leaderboard'])` → LeaderboardPanel 自动重渲染；同时并行调用 `CloudSaveSystem` 的 Dexie 本地存档。

**（C）离线场景**：`navigator.onLine === false` 时，`getProvider()` 直接返回 MockProvider，跳过 tRPC 请求。

### 4.2 错误分层表

| 层级                       | 触发                   | 处理                                            | 用户感知                      |
| -------------------------- | ---------------------- | ----------------------------------------------- | ----------------------------- |
| 输入 Zod 校验              | `parse(score<0)` 等    | mutation 抛错，未触网                           | Toast「提交信息异常」         |
| tRPC URL 不通 / 请求 abort | fetch rejected         | 单请求降级 MockProvider                         | 无感知（仍显示 mock 数据）    |
| tRPC 服务端 Zod 校验失败   | 响应 400 + zodError    | 不降级，Toast「服务端校验失败」+ `console.warn` | Toast 警告                    |
| 浏览器离线                 | navigator.onLine=false | getProvider() 强制 MockProvider                 | Toast「离线模式」（首次提示） |
| 组件运行时崩溃             | ErrorBoundary 捕获     | 展示 ErrorOverlay，不波及其他页面               | ErrorOverlay                  |

### 4.3 降级决策规则（保证不阻塞主流程）

```typescript
// 伪代码，TRPCProvider 的兜底语义
async function list(input) {
  if (!trpcUrl || !navigator.onLine) return mockProvider.list(input);
  try {
    return await client.leaderboard.list.query(input);
  } catch (e) {
    // 服务端 Zod 校验失败不降级（应视为真错误上报）
    if (isZodValidationError(e)) throw e;
    // 其他错误：降级，埋 debug log
    console.debug('[TRPCProvider] list failed, fall back to mock', e);
    return mockProvider.list(input);
  }
}
```

---

## 5. 测试策略

### 5.1 测试矩阵

| 类型                               | 覆盖                                                                                          | 工具                                               | 位置                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Unit                               | `MockProvider`：list 按 filter 分数区间、submit 写 localStorage、myRank 无记录时 null         | Vitest + expect                                    | `src/services/leaderboard/__tests__/MockProvider.test.ts`                                |
| Unit                               | `TRPCProvider`：请求失败触发降级、服务端 Zod 错误不降级、VITE_TRPC_URL 为空直接 Mock          | Vitest + mock fetch（msw）                         | `src/services/leaderboard/__tests__/TRPCProvider.test.ts`                                |
| Unit                               | `submitScoreSchema` / `listInputSchema` 边缘 case（边界值、负数、超长字符串）`safeParse` 失败 | Vitest                                             | `src/shared/schemas/__tests__/leaderboard.test.ts`                                       |
| Integration                        | hook 生命周期：useSubmitScore 成功后，useLeaderboardList 的 queryKey 被 invalidate 返回新值   | @testing-library/react + QueryClientProvider       | `src/services/leaderboard/__tests__/hooks.test.tsx`                                      |
| Typecheck                          | 编译期类型正确性                                                                              | `tsc --noEmit` 纳入 CI                             | CI `typecheck` job                                                                       |
| Negative Type Test（4 类故意错误） | `limit:'五'`、`playerId:123`、`entry.nonexistent`、`const s:string=stats.topScore`            | 独立脚本 + tsc（**不纳入全局 typecheck**，会失败） | `tests/types/leaderboard-negative.ts` + 脚本 `scripts/typecheck-leaderboard-negative.sh` |

### 5.2 Negative Type Test 说明

- Negative test 的语义是「验证 tsc **会报错**」= 通过
- 因此它**不能**放入 `npm run typecheck`（会让 CI 红）
- 单独提供跨平台 Node 脚本 `scripts/typecheck-leaderboard-negative.mjs`，调用 tsc 后反转退出码；在 `package.json` 中挂接为：
  ```json
  "typecheck:leaderboard:negative": "node scripts/typecheck-leaderboard-negative.mjs"
  ```
  语义：tsc 发现 4 类错误并以非零退出码结束 → 脚本视为通过（exit 0）；若 tsc 意外通过（0 errors）→ 脚本退出码 1（失败）。跨 Windows/PowerShell、macOS、Linux。

---

## 6. 实施步骤（可直接作为 implementation plan）

| 阶段 | 任务                                                                                                                 | 预计时长 | 产出                               |
| ---- | -------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------- |
| 0    | 安装依赖：@trpc/client、@tanstack/react-query、superjson                                                             | 5 min    | package.json 更新                  |
| 1    | 拷贝并微调共享 schema：`src/shared/schemas/leaderboard.ts` + 环境变量类型声明                                        | 10 min   | 新增 2 个文件                      |
| 2    | Provider 类型 + MockProvider 实现                                                                                    | 15 min   | types.ts + MockProvider.ts         |
| 3    | TRPCProvider 实现（含降级语义） + `services/trpc.ts`（QueryClient 单例 + tRPC client 工厂）                          | 20 min   | TRPCProvider.ts + trpc.ts          |
| 4    | `services/leaderboard/index.ts`：单例入口 + 4 个 React Query hooks                                                   | 15 min   | index.ts                           |
| 5    | 组件改造：App.tsx（QueryClientProvider）、GameOver.tsx（useSubmitScore）、LeaderboardPanel.tsx（useLeaderboardList） | 20 min   | MOD 3 文件                         |
| 6    | CloudSaveSystem.ts 改造：getLeaderboard / submitScore 走 Provider，失败 Dexie 兜底                                   | 10 min   | MOD 1 文件                         |
| 7    | 单元测试（MockProvider/TRPCProvider/schema）+ integration hooks 测试                                                 | 25 min   | 新增 3-4 个 test 文件              |
| 8    | Negative Type Test 独立脚本                                                                                          | 10 min   | tests/types/ + package.json script |
| 9    | 文档补充：README 更新「排行榜架构」一节；`VITE_*` 环境变量写入 `.env.example`                                        | 10 min   | README + .env.example              |
| 10   | 运行 `npm run typecheck` + `npm run test` + 手动 4 条验收标准                                                        | 10 min   | 验证通过                           |

合计：≈ 145 分钟（2.5 小时）。

---

## 7. 与阶段二 POC 的衔接

- 类型来源：`AppRouter type` 通过 **type-only import** 从 `poc/trpc-leaderboard/` 导入（`import type { AppRouter } from '../../../poc/trpc-leaderboard/src/router/index'`），客户端零运行时耦合
- 共享 Schema：`src/shared/schemas/leaderboard.ts` 与 POC 里对应文件保持字段一致（仅 timestamp 改 number），后续合并为 monorepo 内部 package
- 手动验证 S3：开启 `poc/trpc-leaderboard` 的 server（`npm run dev`），前端 `VITE_LEADERBOARD_PROVIDER=trpc` 即可观察到 Top 5 为 `星际猎人/银河守卫/...`（POC seed 固定名）而非 mock 的随机名
