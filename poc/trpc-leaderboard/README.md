# tRPC 11 + Zod 端到端类型安全 POC

> 阶段二·后端基础设施概念验证 · 2026-08

## 1. POC 目标

验证 **tRPC 11 + Zod** 在排行榜场景下的端到端类型安全能力，对比 Neon POC 中 **Hono + 手动 fetch** 方案，为后续技术选型提供依据。

### 核心验证项

- ✅ 客户端仅 `import type { AppRouter }` 即获得全部类型（零代码生成、零运行时依赖）
- ✅ 输入/输出类型由 Zod schema 单一来源推导
- ✅ 编译期捕获：字段名拼写错误、类型不匹配、缺失必填字段
- ✅ superjson transformer 自动处理 `Date` 等复杂类型序列化

## 2. 与 Hono POC 的对比

| 维度     | Hono + Zod (Neon POC)           | tRPC + Zod (本 POC)                  |
| -------- | ------------------------------- | ------------------------------------ |
| 类型安全 | ✅ Zod 校验输入，输出需手写 DTO | ✅✅ 端到端自动推导，零手写类型      |
| 客户端   | 手写 fetch + 手动类型断言       | `createTRPCClient<AppRouter>` 全自动 |
| 代码生成 | 不需要                          | **不需要**（仅类型导入）             |
| 协议     | 标准 HTTP/REST                  | HTTP + RPC 约定（可批量）            |
| 边缘部署 | ✅ Hono 原生 edge-ready         | ⚠️ 需适配（@trpc/server 支持 edge）  |
| 学习曲线 | 低（标准 REST）                 | 中（需理解 procedure/router）        |
| 缓存/CDN | ✅ HTTP 语义清晰                | ⚠️ POST 查询不利于 CDN 缓存          |
| 适用场景 | 公开 API、多端消费              | 前后端同栈、内部服务                 |

**结论**：

- 排行榜 **公开读取** 用 Hono/REST（利于 CDN 缓存、多端消费）
- 排行榜 **写入 + 个人数据** 用 tRPC（类型安全收益大、写入不缓存）
- 两者可共存：Hono 网关暴露公开 API，tRPC 处理认证后的类型安全操作

## 3. 目录结构

```
poc/trpc-leaderboard/
├── src/
│   ├── server.ts              # standalone HTTP server (端口 2026)
│   ├── trpc.ts                # initTRPC + superjson transformer
│   ├── context.ts             # 请求上下文
│   ├── store.ts               # 内存存储 + seed
│   ├── schemas/
│   │   └── leaderboard.ts     # ⭐ Zod schema（类型唯一来源，前后端共享）
│   └── router/
│       ├── index.ts           # AppRouter 聚合 + 导出 type
│       └── leaderboard.ts     # list/submit/myRank/stats procedures
├── client/
│   └── demo.ts                # 端到端类型安全演示
├── package.json
└── tsconfig.json
```

## 4. 类型安全原理

```
┌─────────────────┐         ┌─────────────────┐
│   Server        │         │   Client        │
│                 │         │                 │
│  Zod schema     │         │  import type    │
│      ↓          │         │  { AppRouter }  │
│  procedure      │ ───────▶│      ↓          │
│  .input/.output │  类型流  │  client.leader-│
│      ↓          │  向下游  │  board.list    │
│  appRouter      │         │  .query()      │
│      ↓          │         │      ↓          │
│  type AppRouter │         │  输入/输出类型  │
│  = typeof ...   │         │  全自动推导     │
└─────────────────┘         └─────────────────┘
```

关键：客户端 `import type { AppRouter }` 是**纯类型导入**，不打包任何服务端代码。类型从 server 流向 client，无需代码生成步骤（对比 GraphQL 需要 codegen）。

## 5. API Procedures

| 类型     | 路径                 | 输入                      | 输出                              |
| -------- | -------------------- | ------------------------- | --------------------------------- |
| query    | `leaderboard.list`   | `{ limit?, difficulty? }` | `LeaderboardEntry[]`              |
| mutation | `leaderboard.submit` | `SubmitScoreInput`        | `LeaderboardEntry`                |
| query    | `leaderboard.myRank` | `{ playerId }`            | `{ rank, entry }`                 |
| query    | `leaderboard.stats`  | -                         | `{ totalPlayers, avgScore, ... }` |
| query    | `health`             | -                         | `'ok'`                            |

## 6. 运行步骤

```powershell
cd h:\工作区\fighter-game\poc\trpc-leaderboard
npm install
npm run typecheck       # 验证类型
npm run dev             # 启动 server (端口 2026)
# 另开终端
npm run demo:client     # 运行端到端 demo
```

## 7. 类型安全演示

`client/demo.ts` 展示了类型推导。取消注释下列任一行，`tsc` 会立即报错：

```typescript
await client.leaderboard.list.query({ limit: '五' }); // ❌ string 不可赋给 number
await client.leaderboard.submit.mutate({ playerId: 123 }); // ❌ number 不可赋给 string
client.leaderboard.list.query({ limit: 5 }).then((e) => e[0].nonexistent); // ❌ 属性不存在
const bad: string = (await client.leaderboard.stats.query()).topScore; // ❌ number 不可赋给 string
```

## 8. 验证结果记录

| 验证项             | 状态 | 备注                                                   |
| ------------------ | ---- | ------------------------------------------------------ |
| typecheck 通过     | ✅   | `tsc --noEmit` 0 错误                                  |
| server 启动        | ✅   | 端口 2026，内存存储 + 20 条 seed                       |
| demo:client 端到端 | ✅   | list(Top5) / submit(88888→#10) / myRank / stats 全通过 |
| 类型错误捕获       | ✅   | negative test 4 类错误全部被 tsc 捕获（见下）          |

### Negative Test 结果（类型安全证明）

故意构造 4 类错误调用，`tsc` 全部捕获：

| 错误调用                             | tsc 报错                       |
| ------------------------------------ | ------------------------------ |
| `list.query({ limit: '五' })`        | TS2322: string 不可赋给 number |
| `submit.mutate({ playerId: 123 })`   | TS2322: number 不可赋给 string |
| `r3[0]?.nonexistent`                 | TS2339: 属性不存在             |
| `const bad: string = stats.topScore` | TS2322: number 不可赋给 string |

> 证明：客户端错误调用在**编译期**即被拦截，无需运行时或测试才发现。这是 tRPC 相比手写 fetch 的核心收益。

## 9. 与前端集成的路径

若采用 tRPC，前端 `LeaderboardService.ts` 改造为：

```typescript
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../server/src/router';

export const trpc = createTRPCReact<AppRouter>();

// 使用：trpc.leaderboard.list.useQuery({ limit: 50 })
// 完全类型安全，无需手写 LeaderboardEntry 的 API 调用代码
```

需权衡：tRPC 引入 `@tanstack/react-query` 依赖，但替代了手写的 `fetch` + 状态管理 + 类型定义三件套。
