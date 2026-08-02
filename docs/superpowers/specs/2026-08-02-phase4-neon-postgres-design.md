# Phase 4: Neon 真实数据库接入设计

> **日期**: 2026-08-02
> **状态**: Design Approved (brainstorming 完成, 待 writing-plans)
> **前置**: Phase 3 前端 tRPC + React Query 集成已完成 (commit ca412e4)

## 1. 概述

### 1.1 目标

将 `poc/trpc-leaderboard` 的内存存储替换为 **PostgreSQL 持久化**, 实现 tRPC server 的真实数据持久化。前端 TRPCProvider 连接真实 tRPC server (接 Postgres), MockProvider 保留为离线/开发兜底。

**核心交付**:

- Docker Compose 启动本地 Postgres 15
- Prisma 7 + `@prisma/adapter-pg` 连接本地 Postgres
- 复用 Neon POC 的 schema (已对齐前端契约)
- `store.ts` 从内存 Map 重写为 Prisma Client 实现
- tRPC router procedures 从同步改为 async (签名不变)
- Neon-ready 配置: 未来注册 Neon 后只需改 2 处 (DATABASE_URL + adapter)

### 1.2 非目标 (YAGNI)

- ❌ 认证系统 (playerId 仍硬编码 'default_player', 阶段五再做)
- ❌ 生产部署 (Vercel/Cloudflare, 阶段六)
- ❌ 现有 server/ MySQL 后端改造 (暂时保留, 阶段五决定去留)
- ❌ 数据迁移 (现有 MySQL 数据不迁移, Postgres 从空表 + seed 开始)
- ❌ 真实 Neon 连接 (无账号, 本地 Postgres 先行 + Neon-ready 配置)

### 1.3 背景

**Phase 3 完成状态**:

- 前端用 MockProvider/TRPCProvider 可插拔策略
- TRPCProvider type-only import `poc/trpc-leaderboard/src/router` 的 AppRouter 类型
- 4 条降级规则 (空URL/网络错误/5xx 降级 MockProvider; Zod 400 不降级)
- tRPC POC 用内存 Map 存储 (store.ts), 20 条 seed 数据

**现有后端契约错配** (memory 记录):

- 现有 `server/prisma/schema.prisma` (MySQL) 字段名与前端错配: `username` vs `playerName`, `level` vs `wave`, `gameDuration` vs `playTime`
- 返回格式错配: `{success, data}` vs 直接数组
- difficulty 大小写错配: `NORMAL` vs `normal`
- Neon POC (`poc/neon-leaderboard`) 已修正这些错配, schema 对齐前端

## 2. 架构总览

### 2.1 架构图

```
┌─────────────────── 前端 ( fighter-game/src/ ) ───────────────────┐
│  GameOver.tsx  LeaderboardPanel.tsx  CloudSaveSystem.ts           │
│       useSubmitScore   useLeaderboardList / useMyRank / useStats   │
│              @tanstack/react-query QueryClient                     │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ (type-only import AppRouter, 路径不变)
                           ▼
┌─────────────────── TRPCProvider ──────────────────────────────────┐
│  VITE_LEADERBOARD_PROVIDER=trpc + VITE_TRPC_URL=http://localhost:2026 │
│  4 条降级规则 → MockProvider (localStorage, 离线兜底)              │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ HTTP (tRPC batch + superjson)
                           ▼
┌─────────── poc/trpc-leaderboard/ (tRPC server, 端口 2026) ────────┐
│  src/server.ts          (createHTTPServer + CORS, 已有)           │
│  src/router/            (list/submit/myRank/stats, 已有, 不变)    │
│  src/store.ts     ◄─── 改造: 内存 Map → Prisma 实现               │
│  src/prisma/      ◄─── 新增: schema.prisma + client (复用 Neon POC)│
│  prisma.config.ts ◄─── 新增: Prisma 7 配置 (adapter-pg)           │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ Prisma Client (adapter-pg + pg)
                           ▼
┌─────────── Docker Compose Postgres 15 (端口 5432) ───────────────┐
│  database: leaderboard  user: lb_user / pass: lb_pass             │
│  volume: pgdata (持久化)                                           │
│  postgres-test (端口 5433, 测试用)                                 │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2 组件职责与变化

| 组件                                | 职责                       | 阶段四变化                              |
| ----------------------------------- | -------------------------- | --------------------------------------- |
| 前端组件/hooks                      | UI + React Query 状态管理  | **零改动** (Phase 3 已完成)             |
| TRPCProvider                        | tRPC client + 4 条降级规则 | **零改动** (降级到 MockProvider 仍有效) |
| `poc/trpc-leaderboard/src/router/`  | tRPC procedures            | **签名不变**, 内部加 async/await        |
| `poc/trpc-leaderboard/src/store.ts` | 数据访问层                 | **重写**: 内存 Map → Prisma Client      |
| `poc/trpc-leaderboard/src/prisma/`  | Prisma schema + client     | **新增** (复用 Neon POC schema)         |
| `docker-compose.yml`                | 本地 Postgres              | **新增**                                |
| `.env` / `.env.example`             | DATABASE_URL 等配置        | **新增后端环境变量**                    |

### 2.3 关键设计原则

1. **前端零改动**: Phase 3 的 type-only import 路径 `../../poc/trpc-leaderboard/src/router` 不变, TRPCProvider 降级策略不变。阶段四只动后端。
2. **procedure 签名不变**: `list/submit/myRank/stats` 的输入输出 Zod schema 不变, 只换 store 实现。前端类型安全不断。
3. **Neon-ready**: 用 `@prisma/adapter-pg` 连本地 Postgres, 未来切 Neon 只改 `DATABASE_URL` + 换 `@prisma/adapter-neon` (切换点集中在 `prisma/client.ts`)。
4. **降级保留**: 前端 TRPCProvider 的 4 条降级规则照常工作, 阶段四不破坏 Phase 3 的降级保证。

## 3. 数据模型与 Prisma 配置

### 3.1 schema.prisma (复用 Neon POC, 零改动)

拷贝 `poc/neon-leaderboard/prisma/schema.prisma` → `poc/trpc-leaderboard/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"   // Prisma 7: 只保留 provider, url 移到 prisma.config.ts
}

model LeaderboardEntry {
  id          String   @id @default(cuid())
  playerId    String
  playerName  String
  score       Int
  wave        Int      @default(1)
  kills       Int      @default(0)
  accuracy    Float?
  maxCombo    Int?
  bossesKilled   Int?
  elitesKilled   Int?
  playTime       Int?
  powerupsCollected Int?
  damageDealt    Int?
  damageTaken    Int?
  rankGrade   String?
  difficulty  String   @default("normal")
  timestamp   DateTime @default(now())
  createdAt   DateTime @default(now())

  @@index([score(sort: Desc)])                  // 榜首查询加速
  @@index([playerId, score(sort: Desc)])        // myRank 加速
  @@index([difficulty, score(sort: Desc)])      // difficulty filter 加速
  @@index([timestamp])                          // daily/weekly/monthly filter 加速
}
```

**设计要点**:

- 字段严格对齐前端 `LeaderboardEntryDTO` (Phase 3 的 Zod schema 单一来源)
- 4 个索引覆盖所有查询路径: 榜首 / myRank / difficulty filter / 时间 filter
- `timestamp` 服务器生成 (`@default(now())`), 避免客户端时钟偏差
- `id` 用 cuid, 避免自增 ID 暴露数据规模

### 3.2 prisma.config.ts (复用 Neon POC, 零改动)

```typescript
import { defineConfig } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    datasource: {
      url: process.env.DATABASE_URL!, // prisma migrate / db push 从此读取
    },
  },
});
```

### 3.3 Prisma Client 初始化 (新建, 用 adapter-pg)

新建 `poc/trpc-leaderboard/src/prisma/client.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// 依赖注入 adapter: 未来切 Neon 只需换这里 + DATABASE_URL
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
```

**Neon 切换点** (未来注册 Neon 后, 只改这一个文件):

```typescript
// 切换后:
import { PrismaNeon } from '@prisma/adapter-neon';
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
export const prisma = new PrismaClient({ adapter });
```

> **memory 约束**: `PrismaNeon` 构造函数接受 `neon.PoolConfig` 对象 (`{ connectionString }`), 不接受 `neon()` 返回的查询函数或 `Pool` 实例。

### 3.4 依赖 (package.json 新增)

```json
{
  "dependencies": {
    "@prisma/client": "^7.8.0",
    "@prisma/adapter-pg": "^6.4.0",
    "pg": "^8.13.0",
    "dotenv": "^16.6.1"
  },
  "devDependencies": {
    "prisma": "^7.8.0"
  },
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev --name init",
    "db:push": "prisma db push",
    "db:seed": "tsx scripts/seed.ts",
    "db:studio": "prisma studio"
  }
}
```

### 3.5 环境变量配置

**.env.example** (新建 `poc/trpc-leaderboard/.env.example`):

```bash
# 本地 Postgres (docker-compose 启动)
DATABASE_URL="postgresql://lb_user:lb_pass@localhost:5432/leaderboard"

# tRPC server 端口
PORT=2026

# 未来切 Neon 时改为:
# DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

**.env.test** (测试用, 端口 5433):

```bash
DATABASE_URL="postgresql://lb_user:lb_pass@localhost:5433/leaderboard_test"
```

### 3.6 docker-compose.yml (项目根目录新增)

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: fighter-leaderboard-db
    environment:
      POSTGRES_USER: lb_user
      POSTGRES_PASSWORD: lb_pass
      POSTGRES_DB: leaderboard
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U lb_user -d leaderboard']
      interval: 5s
      timeout: 3s
      retries: 10

  postgres-test:
    image: postgres:15-alpine
    container_name: fighter-leaderboard-db-test
    environment:
      POSTGRES_USER: lb_user
      POSTGRES_PASSWORD: lb_pass
      POSTGRES_DB: leaderboard_test
    ports:
      - '5433:5432'
    volumes:
      - pgdata-test:/var/lib/postgresql/data

volumes:
  pgdata:
  pgdata-test:
```

## 4. store.ts 重写 + router 改造

### 4.1 store.ts 重写 (内存 Map → Prisma Client)

**核心变化**: 5 个函数从同步改为异步 (Prisma 是异步的), 导出签名保持一致, router 只需加 `async/await`。

新建/重写 `poc/trpc-leaderboard/src/store.ts`:

- `insertEntry(input)`: `prisma.leaderboardEntry.create({ data: ... })`
- `listEntries(limit, difficulty?)`: `prisma.leaderboardEntry.findMany({ where, orderBy: { score: 'desc' }, take: limit })`
- `findBestByPlayer(playerId)`: `prisma.leaderboardEntry.findMany({ where: { playerId }, orderBy: { score: 'desc' }, take: 1 })`
- `countHigherThan(score)`: `prisma.leaderboardEntry.count({ where: { score: { gt: score } } })`
- `totalCount()`: `prisma.leaderboardEntry.count()`
- `seedIfEmpty()`: 幂等, `count > 0` 时跳过; 空表时 `createMany` 20 条种子

**字段映射**: SubmitScoreInput 的可选字段 (`accuracy?` 等) → Prisma 的 `null` (用 `?? null` 转换)。

### 4.2 router/leaderboard.ts 改造 (同步 → async)

**核心变化**: 4 个 procedure 的 `.query()` / `.mutation()` 回调加 `async`, 内部 `await` store 函数。

**输入输出 Zod schema 完全不变**, 前端类型安全不断。

**null/undefined 转换**: Prisma 可选字段返回 `null`, Zod `optional()` 期望 `undefined`。router 中用 `?? undefined` 转换:

```typescript
accuracy: e.accuracy ?? undefined,
maxCombo: e.maxCombo ?? undefined,
// ... 其余可选字段
```

### 4.3 类型兼容性

| 问题                                | 处理                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| Prisma `DateTime` vs Zod `z.date()` | 兼容: Prisma 返回 JS `Date` 对象, `z.date()` 接受 `Date`, superjson 自动序列化为 ISO 字符串 |
| Prisma `null` vs Zod `optional()`   | router 中用 `?? undefined` 转换                                                             |
| `StoredEntry` 类型                  | 不再需要 `id` 字段 (Prisma 自增 cuid), 但保留在接口中以兼容 seedIfEmpty 逻辑                |

### 4.4 seed 脚本

新建 `poc/trpc-leaderboard/scripts/seed.ts`:

```typescript
import 'dotenv/config';
import { seedIfEmpty } from '../src/store.js';

seedIfEmpty()
  .then(() => {
    console.log('[seed] done');
    process.exit(0);
  })
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  });
```

### 4.5 server.ts 启动流程

```typescript
import { seedIfEmpty } from './store.js';

await seedIfEmpty();   // 幂等: 空表才插入
const server = createHTTPServer({ ... });
server.listen(port, ...);
```

> **注意**: 顶层 `await seedIfEmpty()` 需要 ESM top-level await (tsx 支持, tsconfig 需 `module: "esnext"` + `target: "es2022"`)。

## 5. 数据流与降级策略

### 5.1 数据流 (正常路径)

```
前端 GameOver.tsx
  → useSubmitScore().mutateAsync({ playerId, score, ... })
  → submitScoreSchema.parse(input)  ← 前端 Zod 校验 (不触网)
  → getProvider().submit(input)     ← TRPCProvider.submit
  → tRPC client (httpBatchLink + superjson)
  → tRPC server leaderboard.submit mutation
  → .input(submitScoreSchema)  ← 服务端 Zod 校验 (双重保险)
  → await insertEntry(input)   ← Prisma create
  → await countHigherThan(score) ← Prisma count (gt)
  → return { ...entry, rank }  ← .output(leaderboardEntrySchema) 校验
  → Postgres (Docker, 端口 5432)
```

读取路径 (list/myRank/stats) 类似, React Query 自动缓存 + 30s staleTime + mutation onSuccess 失效重取。

### 5.2 降级策略 (Phase 3 的 4 条规则仍然有效, 无需改动)

前端 TRPCProvider 的降级基于 **tRPC 错误码**, 与后端存储无关。阶段四后端换 Postgres 后, 降级规则照常工作:

| 规则                           | 触发条件                                  | 阶段四表现                              |
| ------------------------------ | ----------------------------------------- | --------------------------------------- |
| **Rule 1** 空 URL / kind≠trpc  | `VITE_LEADERBOARD_PROVIDER=mock`          | 直接用 MockProvider (localStorage)      |
| **Rule 2** 网络错误            | Postgres 宕 / tRPC server 停 / 断网       | fetch 抛错 → 降级 MockProvider          |
| **Rule 3** HTTP 5xx            | tRPC server 内部错误 (如 Prisma 连接失败) | 降级 MockProvider                       |
| **Rule 4** Zod 400 BAD_REQUEST | 输入校验失败 (如 score<0)                 | **不降级**, 向上抛错 (前端显示错误提示) |

**关键保证**: Phase 3 的 TRPCProvider.ts **零改动**, 降级逻辑完全复用。

### 5.3 错误处理 (Prisma 错误 → tRPC 错误码)

tRPC server 默认把未捕获错误转为 `INTERNAL_SERVER_ERROR` (500), 触发 Rule 3 降级。需显式处理:

在 `poc/trpc-leaderboard/src/trpc.ts` 增强 `errorFormatter`:

- `P2002` 唯一约束冲突 → `BAD_REQUEST` (400), 不降级
- `P1001` 连接失败 → `INTERNAL_SERVER_ERROR` (500), 降级
- `P2025` 记录不存在 → `NOT_FOUND` (404), 降级
- Zod 校验失败 → `BAD_REQUEST` (400), 不降级
- 其他 → `INTERNAL_SERVER_ERROR` (500), 降级

### 5.4 Docker 启动 → 数据流就绪

```bash
# 1. 启动 Postgres
docker compose up -d postgres

# 2. 等待 healthy
docker compose ps   # 等到 status: healthy

# 3. 生成 Prisma Client + 建表
cd poc/trpc-leaderboard
npm run db:generate
npm run db:push       # 或 db:migrate

# 4. seed 种子数据
npm run db:seed

# 5. 启动 tRPC server (顶层 await seedIfEmpty 幂等)
npm run dev           # tsx watch src/server.ts, 端口 2026

# 6. 前端连真实后端
cd ../..
VITE_LEADERBOARD_PROVIDER=trpc VITE_TRPC_URL=http://localhost:2026 npm run dev
```

### 5.5 Neon 切换路径 (未来注册 Neon 后, 只改 2 处)

**改动 1**: `poc/trpc-leaderboard/src/prisma/client.ts` (换 adapter)

```typescript
// 从:
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// 改为:
import { PrismaNeon } from '@prisma/adapter-neon';
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
```

**改动 2**: `.env` (换 DATABASE_URL)

```bash
# 从:
DATABASE_URL="postgresql://lb_user:lb_pass@localhost:5432/leaderboard"
# 改为:
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

**其余零改动**: schema.prisma / prisma.config.ts / store.ts / router / 前端 全部不变。

**验证 Neon 切换**: 运行 `npm run db:push` + `npm run db:seed` + `npm run dev`, 前端 `VITE_LEADERBOARD_PROVIDER=trpc` 连接, 验证 list/submit/myRank/stats 正常。

## 6. 测试策略

### 6.1 测试层级

| 层级         | 测试对象                                     | 工具                        | 数据库                 | 数量       |
| ------------ | -------------------------------------------- | --------------------------- | ---------------------- | ---------- |
| **单测**     | store.ts (Prisma 数据访问)                   | vitest                      | test db (Docker, 隔离) | ~8 个      |
| **集成测试** | router procedures (list/submit/myRank/stats) | vitest + tRPC caller        | test db                | ~6 个      |
| **前端测试** | TRPCProvider 降级规则                        | vitest + msw (Phase 3 已有) | mock                   | 无需新增   |
| **端到端**   | 浏览器真连接                                 | browser_use                 | dev db                 | S4/S5 验证 |

### 6.2 单测设计: store.ts

新建 `poc/trpc-leaderboard/src/store.test.ts`, 覆盖:

- `insertEntry`: 插入一条记录, 返回完整字段, 默认值 (difficulty='normal')
- `listEntries`: 按 score 降序, limit 生效, difficulty filter 生效
- `findBestByPlayer`: 返回玩家最高分记录, 不存在返回 null
- `countHigherThan` + `totalCount`: 统计高于分数的记录数
- `seedIfEmpty`: 空表插入 20 条, 非空表幂等 (不重复插入)

每个测试前 `prisma.leaderboardEntry.deleteMany()` 清表。

### 6.3 集成测试设计: router procedures

新建 `poc/trpc-leaderboard/src/router/leaderboard.test.ts`, 用 `appRouter.createCaller(createContext({}))` 直接调用 procedure (不启动 HTTP):

- `list`: 返回按 rank 排序的列表
- `submit`: 提交后返回带 rank 的 entry
- `myRank`: 返回玩家最佳成绩的排名, 不存在返回 null
- `stats`: 返回正确的统计数据 (totalPlayers, topScore, avgScore)

### 6.4 测试数据库配置

docker-compose.yml 增加 `postgres-test` 服务 (端口 5433, db: leaderboard_test), `.env.test` 指向 test db, vitest setupFiles 加载 .env.test。

## 7. 验收标准

| 标准   | 验证内容                    | 通过条件                                                                                                                                                   |
| ------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** | 后端 typecheck              | `cd poc/trpc-leaderboard && npx tsc --noEmit` 退出码 0                                                                                                     |
| **S2** | store + router 测试         | `npm test` 全 PASS (~14 个测试)                                                                                                                            |
| **S3** | tRPC server 启动 + Postgres | `docker compose up -d` + `npm run db:push` + `npm run db:seed` + `npm run dev`, server 监听 2026, 日志显示 seed 20 条                                      |
| **S4** | 前端 TRPC 真连接 Postgres   | `VITE_LEADERBOARD_PROVIDER=trpc` 启动前端, LeaderboardPanel 显示 20 条 seed 数据 (playerName 带 `_${i}` 后缀, score 10000-210000), GameOver 提交后榜首更新 |
| **S5** | 降级规则有效                | 停 Postgres 容器, 前端 LeaderboardPanel 降级显示 MockProvider 数据 (150 条中文名), 不报错; 重启 Postgres 后恢复真实数据                                    |
| **S6** | Neon 切换路径文档化         | 设计文档中 Neon 切换步骤清晰 (改 2 处), 代码中 `prisma/client.ts` 有注释标记切换点                                                                         |

### 端到端验证流程 (S4/S5)

复用 Phase 3 的 browser_use 模式:

1. 启动后端 (docker compose + db:push + db:seed + npm run dev)
2. 启动前端 (VITE_LEADERBOARD_PROVIDER=trpc)
3. browser_use 验证:
   - 导航到 LeaderboardPanel, 检查 20 条 seed 数据
   - 检查 playerName 格式 (带 `_${i}` 后缀, 区别于 MockProvider 的中文名)
   - 触发 GameOver 提交, 验证榜首更新
   - 停 Postgres, 验证降级到 MockProvider (数据变为 150 条中文名)
   - 重启 Postgres, 验证恢复真实数据

## 8. 风险与决策记录

### 8.1 决策记录

| 决策           | 选项                                                    | 理由                                                           |
| -------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| 数据库         | Neon (本地 Postgres 先行)                               | scale-to-zero, 低锁定; 无账号时本地 Postgres + Neon-ready 配置 |
| server 位置    | 扩展 poc/trpc-leaderboard                               | 前端 type-only import 路径不变, 改动最小                       |
| Prisma adapter | @prisma/adapter-pg (本地) → @prisma/adapter-neon (未来) | Prisma 7 driver adapter 已 GA, 切换点集中                      |
| schema 来源    | 复用 Neon POC                                           | schema 已对齐前端契约, 零重复工作                              |
| Postgres 运行  | Docker Compose                                          | 环境一致, 团队协作友好                                         |
| 现有 server/   | 暂时保留                                                | 阶段五认证系统再决定去留                                       |

### 8.2 风险

| 风险                         | 影响 | 缓解                                                       |
| ---------------------------- | ---- | ---------------------------------------------------------- |
| Prisma 7 + adapter-pg 兼容性 | 中   | Neon POC 已验证 Prisma 7 + adapter-neon, adapter-pg 同模式 |
| Docker 未安装                | 高   | docker-compose 是标准工具, README 文档化安装步骤           |
| ESM top-level await          | 低   | tsx 支持, tsconfig 需 esnext + es2022                      |
| 测试数据库隔离               | 中   | 独立 postgres-test 容器 (端口 5433), beforeEach 清表       |
| Neon 切换未验证              | 低   | 无账号, 仅文档化切换路径; 未来注册后验证                   |

## 9. 附录: Neon 切换指南

未来注册 Neon (neon.tech) 后, 按以下步骤切换:

1. **注册 Neon 账号**: 访问 https://neon.tech, 注册并创建项目
2. **获取连接字符串**: 在 Neon 控制台获取 `DATABASE_URL` (格式: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`)
3. **安装 Neon adapter**: `cd poc/trpc-leaderboard && npm install @prisma/adapter-neon`
4. **修改 `src/prisma/client.ts`**: 换 `PrismaPg` → `PrismaNeon` (见 3.3 节)
5. **修改 `.env`**: 更新 `DATABASE_URL` 为 Neon 连接串
6. **建表 + seed**: `npm run db:push && npm run db:seed`
7. **启动验证**: `npm run dev`, 前端 `VITE_LEADERBOARD_PROVIDER=trpc` 连接, 验证 list/submit/myRank/stats
8. **(可选) 卸载 pg**: `npm uninstall pg @prisma/adapter-pg` (不再需要本地 Postgres)

---

**下一步**: 转入 writing-plans skill, 基于此设计文档创建详细实施计划。
