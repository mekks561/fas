# Phase 4 Neon Postgres 接入实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `poc/trpc-leaderboard` 的内存存储替换为**本地 PostgreSQL for Windows**（单实例 + 两个 database：`leaderboard` 开发库 + `leaderboard_test` 测试库），Prisma 7 + `@prisma/adapter-pg`，前端零改动，Neon-ready 配置（未来切 Neon 只改 2 处）。

**Architecture:** 扩展 `poc/trpc-leaderboard`，复用 Neon POC 的 schema（已对齐前端契约），store.ts 从内存 Map 重写为 Prisma Client 实现，router procedures 从同步改为 async（签名不变）。前端 TRPCProvider 的 4 条降级规则零改动。**本环境 Docker Hub 全部阻断，改用本地 PostgreSQL 安装（非 Docker）**，一个 Postgres 实例下建两个 database 替代 Docker 两个容器。

**Tech Stack:** Prisma 7 + `@prisma/adapter-pg` + pg + **PostgreSQL 17 for Windows (本地安装)** + Vitest + tRPC 11 + superjson

**Spec:** `docs/superpowers/specs/2026-08-02-phase4-neon-postgres-design.md`

**环境适配变更记录（2026-08-03）**：

- 原计划：Docker Compose Postgres 15（dev 5432 + test 5433 两个容器）
- 实际：所有 Docker Hub 镜像源（registry-1.docker.io + 国内镜像）全部 443 端口阻断，无法拉取镜像
- 适配：改用 PostgreSQL 17 for Windows 本地安装（一个实例 + 两个 database）
  - dev 库：`leaderboard`（端口 5432，连接串 `postgresql://postgres:<pw>@localhost:5432/leaderboard`）
  - test 库：`leaderboard_test`（同实例同端口 5432，连接串 `postgresql://postgres:<pw>@localhost:5432/leaderboard_test`）
  - Neon-ready 切换不变：未来仍只需改 `client.ts`（adapter 切换） + `.env`（DATABASE_URL 切换）

---

## File Structure

| 文件                                                  | 操作               | 职责                                              |
| ----------------------------------------------------- | ------------------ | ------------------------------------------------- |
| `docker-compose.yml` (项目根)                         | Created ✅         | 保留（环境恢复 Docker 后可用）                    |
| `poc/trpc-leaderboard/prisma/schema.prisma`           | Create             | Prisma schema（复用 Neon POC，4 索引）            |
| `poc/trpc-leaderboard/prisma.config.ts`               | Create             | Prisma 7 配置（url 从 DATABASE_URL 读）           |
| `poc/trpc-leaderboard/src/prisma/client.ts`           | Create             | PrismaClient 初始化（adapter-pg + Neon 切换注释） |
| `poc/trpc-leaderboard/src/store.ts`                   | Rewrite            | 内存 Map → Prisma Client（5 函数 async）          |
| `poc/trpc-leaderboard/src/store.test.ts`              | Create             | store 单测（连 test db，beforeEach 清表）         |
| `poc/trpc-leaderboard/src/router/leaderboard.ts`      | Modify             | 同步 → async + null/undefined 转换                |
| `poc/trpc-leaderboard/src/router/leaderboard.test.ts` | Create             | router 集成测试（tRPC caller）                    |
| `poc/trpc-leaderboard/src/trpc.ts`                    | Modify             | errorFormatter 增强 Prisma 错误码映射             |
| `poc/trpc-leaderboard/scripts/seed.ts`                | Create             | seed 脚本（幂等）                                 |
| `poc/trpc-leaderboard/src/server.ts`                  | Modify             | 顶层 await seedIfEmpty()                          |
| `poc/trpc-leaderboard/vitest.config.ts`               | Create             | vitest 配置（setupFiles 加载 .env.test）          |
| `poc/trpc-leaderboard/package.json`                   | Modify             | 新增依赖 + db scripts + test script               |
| `poc/trpc-leaderboard/.env.example`                   | Create             | 环境变量示例（本地 Postgres 连接串格式）          |
| `poc/trpc-leaderboard/.env`                           | Create (gitignore) | 本地环境变量（连接开发库 leaderboard）            |
| `poc/trpc-leaderboard/.env.test`                      | Create             | 测试环境变量（连接测试库 leaderboard_test）       |
| `poc/trpc-leaderboard/.gitignore`                     | Modify             | 添加 .env                                         |

---

## Task 1: 复用现有 MySQL 8.0 实例 + 新建两个独立 database

**Files:** 无新文件 (使用 root 账号创建 database + 用户)

**前置验证 (已完成)**:

- MySQL80 服务 Running，端口 3306 LISTENING ✅
- mysqld 进程 PID 6740 ✅
- `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe` 存在 ✅
- root 密码: `123456` ✅
- 两个 database + lb_user 账号已创建并授权 ✅
  - `fighter_leaderboard` (dev 库)
  - `fighter_leaderboard_test` (test 库)
  - 专用账号: `lb_user:lb_pass` (最小权限: 仅两个库的 ALL PRIVILEGES，不用 root 连接应用)
  - docker-compose.yml 保留 (commit bbd71bc)，如未来恢复 Docker 环境可重新启用

- [x] **Step 1: 创建 database fighter_leaderboard**

已完成 (CREATE DATABASE IF NOT EXISTS + utf8mb4_unicode_ci)

- [x] **Step 2: 创建 database fighter_leaderboard_test**

已完成

- [x] **Step 3: 创建专用账号 lb_user (密码 lb_pass)**

已完成 (CREATE USER IF NOT EXISTS)

- [x] **Step 4: 授权两个 database + FLUSH PRIVILEGES**

已完成

- [x] **Step 5: 验证 lb_user 连接两个 database**

已完成

**如需从零重跑 (MySQL root 权限)**:

```powershell
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$env:MYSQL_PWD = "123456"
& $mysql -h localhost -u root -e "CREATE DATABASE IF NOT EXISTS fighter_leaderboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
& $mysql -h localhost -u root -e "CREATE DATABASE IF NOT EXISTS fighter_leaderboard_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
& $mysql -h localhost -u root -e "CREATE USER IF NOT EXISTS 'lb_user'@'localhost' IDENTIFIED BY 'lb_pass';"
& $mysql -h localhost -u root -e "GRANT ALL PRIVILEGES ON fighter_leaderboard.* TO 'lb_user'@'localhost';"
& $mysql -h localhost -u root -e "GRANT ALL PRIVILEGES ON fighter_leaderboard_test.* TO 'lb_user'@'localhost';"
& $mysql -h localhost -u root -e "FLUSH PRIVILEGES;"
```

---

## Task 2: Prisma 依赖 + MySQL schema + 配置 + 建表

**Files:**

- Modify: `poc/trpc-leaderboard/package.json`
- Create: `poc/trpc-leaderboard/prisma/schema.prisma`
- Create: `poc/trpc-leaderboard/prisma.config.ts`
- Create: `poc/trpc-leaderboard/.env.example`
- Create: `poc/trpc-leaderboard/.env`
- Modify: `poc/trpc-leaderboard/.gitignore`

**MySQL 注意项 (与原 PostgreSQL 方案差异)**:

1. datasource provider: `postgresql` → `mysql`
2. adapter: `@prisma/adapter-pg + pg` → `@prisma/adapter-mysql2 + mysql2`
3. DATABASE_URL 格式: `postgresql://` → `mysql://user:pass@host:port/db`
4. id 类型: MySQL cuid 对应 `@db.VarChar(30)` 够用，Prisma 默认 `@db.VarChar(25)`
5. Float? 对应 MySQL `DOUBLE`
6. DateTime → MySQL `DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)`
7. string? difficulty → `@db.VarChar(20) DEFAULT 'normal'`
8. Neon 切换: 未来改 3 处 + 重新建空表 (provider / adapter / DATABASE_URL)
9. @@index: MySQL 支持 `@db.VarChar` 前缀索引，但整列索引也 OK

- [ ] **Step 1: 安装 Prisma 依赖 (MySQL)**

Run (cwd: `poc/trpc-leaderboard`):

```bash
npm install @prisma/client@^7.8.0 @prisma/adapter-mysql2@^6.4.0 mysql2@^3.12.0 dotenv@^16.6.1
npm install -D prisma@^7.8.0
```

Expected: 依赖安装成功，`package.json` 更新

- [ ] **Step 2: 添加 db scripts 到 package.json**

Modify `poc/trpc-leaderboard/package.json` 的 `scripts` 块，替换/添加为：

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "demo:client": "tsx client/demo.ts",
    "demo:typecheck": "tsc --noEmit client/demo.ts --strict --moduleResolution bundler --module ESNext --target ES2022 --types node --skipLibCheck 2>&1 || echo 'typecheck done'",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev --name init",
    "db:push": "prisma db push",
    "db:seed": "tsx scripts/seed.ts",
    "db:studio": "prisma studio",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: 创建 prisma/schema.prisma (mysql provider)**

注意: MySQL 8.0 原生支持 DateTime(3) 精度，Float 转 DOUBLE，字符串加 @db.VarChar(xx) 限制，difficulty/score/wave/kills 加 @db.VarChar 或 @db.UnsignedSmallInt。

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
}

model LeaderboardEntry {
  id          String   @id @default(cuid()) @db.VarChar(30)
  playerId    String   @db.VarChar(64)
  playerName  String   @db.VarChar(32)
  score       Int
  wave        Int      @default(1) @db.UnsignedSmallInt
  kills       Int      @default(0) @db.UnsignedInt
  accuracy    Float?
  maxCombo    Int?     @db.UnsignedInt
  bossesKilled   Int?  @db.UnsignedSmallInt
  elitesKilled   Int?  @db.UnsignedMediumInt
  playTime       Int?  @db.UnsignedInt
  powerupsCollected Int? @db.UnsignedMediumInt
  damageDealt    Int?  @db.UnsignedInt
  damageTaken    Int?  @db.UnsignedInt
  rankGrade   String?   @db.VarChar(4)
  difficulty  String    @default("normal") @db.VarChar(20)
  timestamp   DateTime  @default(now()) @db.DateTime(3)
  createdAt   DateTime  @default(now()) @db.DateTime(3)

  @@index([score(sort: Desc)])
  @@index([playerId, score(sort: Desc)])
  @@index([difficulty, score(sort: Desc)])
  @@index([timestamp])
}
```

- [ ] **Step 4: 创建 prisma.config.ts** (不变)

```typescript
import { defineConfig } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    datasource: {
      url: process.env.DATABASE_URL!,
    },
  },
});
```

- [ ] **Step 5: 创建 .env.example (MySQL 连接串)**

```bash
# 本地 MySQL 8.0 (现有实例, 端口 3306)
DATABASE_URL="mysql://lb_user:lb_pass@localhost:3306/fighter_leaderboard"

# tRPC server 端口
PORT=2026

# 未来切 Neon 时改为 (需要同时改 schema.provider = "postgresql" + adapter 换 @prisma/adapter-neon):
# schema.prisma: datasource db.provider 改为 postgresql
# prisma/client.ts: 用 PrismaNeon({ connectionString })
# .env:
# DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

- [ ] **Step 6: 创建 .env (复制 .env.example)**

```bash
DATABASE_URL="mysql://lb_user:lb_pass@localhost:3306/fighter_leaderboard"
PORT=2026
```

- [ ] **Step 7: 更新 .gitignore 添加 .env**

确认 `poc/trpc-leaderboard/.gitignore` 包含：

```
node_modules
dist
.env
.env.test
*.log
```

如果 `.env` 未在 .gitignore 中，添加它。

- [ ] **Step 8: 生成 Prisma Client**

Run (cwd: `poc/trpc-leaderboard`): `npm run db:generate`
Expected: `✔ Generated Prisma Client` 输出

- [ ] **Step 9: 建表 (db push)**

Run (cwd: `poc/trpc-leaderboard`): `npm run db:push`
Expected: `🚀 Your database is now in sync with your schema.` 输出

- [ ] **Step 10: 验证表已创建 (MySQL 命令行)**

Run: `$env:MYSQL_PWD="lb_pass"; & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h localhost -u lb_user fighter_leaderboard -e "SHOW TABLES;"`
Expected: 输出包含 `LeaderboardEntry` 表，以及 DESCRIBE 显示字段

- [ ] **Step 11: Commit**

```bash
cd ../..
git add poc/trpc-leaderboard/package.json poc/trpc-leaderboard/package-lock.json poc/trpc-leaderboard/prisma/ poc/trpc-leaderboard/prisma.config.ts poc/trpc-leaderboard/.env.example poc/trpc-leaderboard/.gitignore
git commit -m "feat(phase4): prisma 7 mysql schema + adapter-mysql2 config + db push"
```

---

## Task 3: Prisma Client (adapter-mysql2) + Neon 切换注释

**Files:**

- Create: `poc/trpc-leaderboard/src/prisma/client.ts`

- [ ] **Step 1: 创建 src/prisma/client.ts**

```typescript
// ===================================================================
// Prisma Client 初始化 - 依赖注入 adapter
// 当前: @prisma/adapter-mysql2 + mysql2 (本地 MySQL 8.0)
// 未来切 Neon: 改 3 处 (schema.provider + adapter + DATABASE_URL), 见底部注释
// ===================================================================

import { PrismaClient } from '@prisma/client';
import { PrismaMysql2 } from '@prisma/adapter-mysql2';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({ uri: process.env.DATABASE_URL });
const adapter = new PrismaMysql2(pool);

export const prisma = new PrismaClient({ adapter });

// ===================================================================
// Neon 切换指南 (未来注册 Neon 后):
// 注意: Neon 是 PostgreSQL Serverless, 需要同时改 datasource provider
//
// 改动 1/3: schema.prisma 改 datasource.db.provider
//    datasource db {
//      provider = "mysql"   // ← 改为 "postgresql"
//    }
//
// 改动 2/3: 本文件 (client.ts) 替换 adapter
//    npm uninstall mysql2 @prisma/adapter-mysql2
//    npm install @prisma/adapter-neon
//    import { PrismaNeon } from '@prisma/adapter-neon';
//    const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
//    export const prisma = new PrismaClient({ adapter });
//
// 改动 3/3: .env 改 DATABASE_URL
//    DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
//
// 最后: npm run db:generate && npm run db:push (在 Neon 上重建空表)
//
// 注意: PrismaNeon 接受 { connectionString } 对象, 不接受 neon() 或 Pool 实例
// ===================================================================
```

- [ ] **Step 2: 验证 typecheck**

Run (cwd: `poc/trpc-leaderboard`): `npm run typecheck`
Expected: 退出码 0（无错误）

- [ ] **Step 3: Commit**

```bash
cd ../..
git add poc/trpc-leaderboard/src/prisma/client.ts
git commit -m "feat(phase4): prisma client with adapter-mysql2 + neon switch guide (3 changes)"
```

---

## Task 4: vitest 测试配置 (test db 隔离)

**Files:**

- Modify: `poc/trpc-leaderboard/package.json` (添加 vitest 依赖)
- Create: `poc/trpc-leaderboard/vitest.config.ts`
- Create: `poc/trpc-leaderboard/.env.test`

- [ ] **Step 1: 安装 vitest**

Run (cwd: `poc/trpc-leaderboard`):

```bash
npm install -D vitest@^2.1.0
```

Expected: vitest 安装成功

- [ ] **Step 2: 创建 .env.test**

```bash
# 本地 MySQL 8.0 test database (同实例, 独立 database, 端口仍 3306)
DATABASE_URL="mysql://lb_user:lb_pass@localhost:3306/fighter_leaderboard_test"
PORT=2026
```

- [ ] **Step 3: 创建 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';

// 加载 .env.test (覆盖 .env)
loadEnv({ path: '.env.test' });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000, // Prisma 测试可能较慢
    hookTimeout: 15000,
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

- [ ] **Step 4: 创建 src/test-setup.ts**

```typescript
// vitest setup: 确保 .env.test 已加载
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.test' });

// 确保 test db 连接串正确 (指向 fighter_leaderboard_test, 而非 fighter_leaderboard)
if (!process.env.DATABASE_URL?.includes('fighter_leaderboard_test')) {
  throw new Error(
    `[test-setup] DATABASE_URL 必须指向 test db (fighter_leaderboard_test), 当前: ${process.env.DATABASE_URL}`,
  );
}
```

- [ ] **Step 5: 建 test db 表**

Run (cwd: `poc/trpc-leaderboard`):

```powershell
# 临时用 .env.test 的 DATABASE_URL 在 test db 建表
$env:DATABASE_URL="mysql://lb_user:lb_pass@localhost:3306/fighter_leaderboard_test"; npm run db:push
```

Expected: `🚀 Your database is now in sync with your schema.`

- [ ] **Step 6: 验证 test db 表**

Run:

```powershell
$env:MYSQL_PWD="lb_pass"; & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h localhost -u lb_user fighter_leaderboard_test -e "SHOW TABLES; DESCRIBE LeaderboardEntry;"
```

Expected: 输出包含 `LeaderboardEntry` 表及其字段

- [ ] **Step 7: Commit**

```bash
cd ../..
git add poc/trpc-leaderboard/package.json poc/trpc-leaderboard/package-lock.json poc/trpc-leaderboard/vitest.config.ts poc/trpc-leaderboard/src/test-setup.ts poc/trpc-leaderboard/.env.test
git commit -m "test(phase4): vitest config + test db isolation (fighter_leaderboard_test)"
```

---

## Task 5: store.ts 重写 (TDD)

**Files:**

- Create: `poc/trpc-leaderboard/src/store.test.ts` (测试先行)
- Rewrite: `poc/trpc-leaderboard/src/store.ts` (Prisma 实现)

- [ ] **Step 1: 写 store.test.ts (failing)**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from './prisma/client.js';
import {
  insertEntry,
  listEntries,
  findBestByPlayer,
  countHigherThan,
  totalCount,
  seedIfEmpty,
} from './store.js';

beforeEach(async () => {
  await prisma.leaderboardEntry.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('store - insertEntry', () => {
  it('插入一条记录，返回完整字段', async () => {
    const entry = await insertEntry({
      playerId: 'p1',
      playerName: 'Alice',
      score: 1000,
      wave: 5,
      kills: 10,
    });
    expect(entry.id).toBeDefined();
    expect(entry.playerId).toBe('p1');
    expect(entry.score).toBe(1000);
    expect(entry.difficulty).toBe('normal');
    expect(entry.timestamp).toBeInstanceOf(Date);
  });

  it('可选字段为 null (未提供时)', async () => {
    const entry = await insertEntry({
      playerId: 'p1',
      playerName: 'Alice',
      score: 1000,
      wave: 5,
      kills: 10,
    });
    expect(entry.accuracy).toBeNull();
    expect(entry.maxCombo).toBeNull();
    expect(entry.bossesKilled).toBeNull();
  });

  it('可选字段有值 (提供时)', async () => {
    const entry = await insertEntry({
      playerId: 'p1',
      playerName: 'Alice',
      score: 1000,
      wave: 5,
      kills: 10,
      accuracy: 0.85,
      maxCombo: 50,
      difficulty: 'hard',
    });
    expect(entry.accuracy).toBe(0.85);
    expect(entry.maxCombo).toBe(50);
    expect(entry.difficulty).toBe('hard');
  });
});

describe('store - listEntries', () => {
  it('按 score 降序返回，limit 生效', async () => {
    await insertEntry({ playerId: 'p1', playerName: 'A', score: 100, wave: 1, kills: 0 });
    await insertEntry({ playerId: 'p2', playerName: 'B', score: 300, wave: 1, kills: 0 });
    await insertEntry({ playerId: 'p3', playerName: 'C', score: 200, wave: 1, kills: 0 });
    const list = await listEntries(2);
    expect(list).toHaveLength(2);
    expect(list[0]!.score).toBe(300);
    expect(list[1]!.score).toBe(200);
  });

  it('difficulty filter 生效', async () => {
    await insertEntry({
      playerId: 'p1',
      playerName: 'A',
      score: 100,
      wave: 1,
      kills: 0,
      difficulty: 'hard',
    });
    await insertEntry({
      playerId: 'p2',
      playerName: 'B',
      score: 200,
      wave: 1,
      kills: 0,
      difficulty: 'easy',
    });
    const list = await listEntries(10, 'hard');
    expect(list).toHaveLength(1);
    expect(list[0]!.playerId).toBe('p1');
  });
});

describe('store - findBestByPlayer', () => {
  it('返回该玩家最高分记录', async () => {
    await insertEntry({ playerId: 'p1', playerName: 'A', score: 100, wave: 1, kills: 0 });
    await insertEntry({ playerId: 'p1', playerName: 'A', score: 300, wave: 1, kills: 0 });
    await insertEntry({ playerId: 'p1', playerName: 'A', score: 200, wave: 1, kills: 0 });
    const best = await findBestByPlayer('p1');
    expect(best?.score).toBe(300);
  });

  it('玩家不存在返回 null', async () => {
    const best = await findBestByPlayer('nobody');
    expect(best).toBeNull();
  });
});

describe('store - countHigherThan + totalCount', () => {
  it('统计高于分数的记录数', async () => {
    await insertEntry({ playerId: 'p1', playerName: 'A', score: 100, wave: 1, kills: 0 });
    await insertEntry({ playerId: 'p2', playerName: 'B', score: 300, wave: 1, kills: 0 });
    await insertEntry({ playerId: 'p3', playerName: 'C', score: 200, wave: 1, kills: 0 });
    expect(await countHigherThan(150)).toBe(2);
    expect(await totalCount()).toBe(3);
  });
});

describe('store - seedIfEmpty', () => {
  it('空表时插入 20 条种子', async () => {
    await seedIfEmpty();
    expect(await totalCount()).toBe(20);
  });

  it('非空表时不重复插入 (幂等)', async () => {
    await insertEntry({ playerId: 'manual', playerName: 'M', score: 1, wave: 1, kills: 0 });
    await seedIfEmpty();
    expect(await totalCount()).toBe(1);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run (cwd: `poc/trpc-leaderboard`): `npm test`
Expected: FAIL — `Cannot find module './store.js'` 或 store 函数不存在（因为还是旧的同步实现）

- [ ] **Step 3: 重写 store.ts (Prisma 实现)**

完整替换 `poc/trpc-leaderboard/src/store.ts`：

```typescript
// ===================================================================
// 数据访问层 - Prisma Client 实现 (Postgres)
// 5 个 async 函数: insertEntry / listEntries / findBestByPlayer /
//                  countHigherThan / totalCount / seedIfEmpty
// ===================================================================

import { prisma } from './prisma/client.js';
import type { SubmitScoreInput, Difficulty } from './schemas/leaderboard.js';

export interface StoredEntry {
  id: string;
  playerId: string;
  playerName: string;
  score: number;
  wave: number;
  kills: number;
  accuracy: number | null;
  maxCombo: number | null;
  bossesKilled: number | null;
  elitesKilled: number | null;
  playTime: number | null;
  powerupsCollected: number | null;
  damageDealt: number | null;
  damageTaken: number | null;
  rankGrade: string | null;
  difficulty: string;
  timestamp: Date;
}

export async function insertEntry(input: SubmitScoreInput): Promise<StoredEntry> {
  const created = await prisma.leaderboardEntry.create({
    data: {
      playerId: input.playerId,
      playerName: input.playerName,
      score: input.score,
      wave: input.wave,
      kills: input.kills,
      accuracy: input.accuracy ?? null,
      maxCombo: input.maxCombo ?? null,
      bossesKilled: input.bossesKilled ?? null,
      elitesKilled: input.elitesKilled ?? null,
      playTime: input.playTime ?? null,
      powerupsCollected: input.powerupsCollected ?? null,
      damageDealt: input.damageDealt ?? null,
      damageTaken: input.damageTaken ?? null,
      rankGrade: input.rankGrade ?? null,
      difficulty: input.difficulty ?? 'normal',
    },
  });
  return created as StoredEntry;
}

export async function listEntries(limit: number, difficulty?: Difficulty): Promise<StoredEntry[]> {
  const entries = await prisma.leaderboardEntry.findMany({
    where: difficulty ? { difficulty } : undefined,
    orderBy: { score: 'desc' },
    take: limit,
  });
  return entries as StoredEntry[];
}

export async function findBestByPlayer(playerId: string): Promise<StoredEntry | null> {
  const entries = await prisma.leaderboardEntry.findMany({
    where: { playerId },
    orderBy: { score: 'desc' },
    take: 1,
  });
  return (entries[0] as StoredEntry | undefined) ?? null;
}

export async function countHigherThan(score: number): Promise<number> {
  return prisma.leaderboardEntry.count({
    where: { score: { gt: score } },
  });
}

export async function totalCount(): Promise<number> {
  return prisma.leaderboardEntry.count();
}

export async function seedIfEmpty(): Promise<void> {
  const count = await totalCount();
  if (count > 0) return;

  const names = ['星际猎人', '银河守卫', '宇宙战神', '光速战士', '暗夜游侠'];
  const difficulties: Difficulty[] = ['easy', 'normal', 'hard', 'expert'];
  const data = Array.from({ length: 20 }, (_, i) => ({
    playerId: `seed_${i}`,
    playerName: `${names[i % names.length]!}_${i}`,
    score: 10000 + Math.floor(Math.random() * 200000),
    wave: 5 + Math.floor(Math.random() * 30),
    kills: 20 + Math.floor(Math.random() * 200),
    accuracy: Math.random(),
    maxCombo: Math.floor(Math.random() * 100),
    difficulty: difficulties[i % difficulties.length]!,
  }));
  await prisma.leaderboardEntry.createMany({ data });
}
```

- [ ] **Step 4: 运行测试验证通过**

Run (cwd: `poc/trpc-leaderboard`): `npm test`
Expected: 全部 8 个测试 PASS

- [ ] **Step 5: Commit**

```bash
cd ../..
git add poc/trpc-leaderboard/src/store.ts poc/trpc-leaderboard/src/store.test.ts
git commit -m "feat(phase4): rewrite store.ts with prisma client (TDD, 8 tests pass)"
```

---

## Task 6: router async 改造 + null 转换

**Files:**

- Modify: `poc/trpc-leaderboard/src/router/leaderboard.ts`

- [ ] **Step 1: 改造 router/leaderboard.ts (同步 → async + null/undefined 转换)**

完整替换 `poc/trpc-leaderboard/src/router/leaderboard.ts`：

```typescript
// ===================================================================
// tRPC Leaderboard Router
// 每个 procedure 的 .input(zodSchema) 同时提供：
//   1. 运行时校验（拒绝非法输入）
//   2. 编译期类型（客户端自动推导，无需手写类型）
// .output(zodSchema) 校验响应结构，防止服务端返回脏数据
// ===================================================================

import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import {
  submitScoreSchema,
  leaderboardEntrySchema,
  myRankSchema,
  listInputSchema,
} from '../schemas/leaderboard.js';
import {
  insertEntry,
  listEntries,
  findBestByPlayer,
  countHigherThan,
  totalCount,
} from '../store.js';

// Prisma StoredEntry (null) → Zod optional (undefined) 的转换辅助
function toDTO(
  e: {
    playerId: string;
    playerName: string;
    score: number;
    wave: number;
    kills: number;
    accuracy: number | null;
    maxCombo: number | null;
    bossesKilled: number | null;
    elitesKilled: number | null;
    playTime: number | null;
    powerupsCollected: number | null;
    damageDealt: number | null;
    damageTaken: number | null;
    rankGrade: string | null;
    timestamp: Date;
  },
  rank: number,
) {
  return {
    playerId: e.playerId,
    playerName: e.playerName,
    score: e.score,
    wave: e.wave,
    kills: e.kills,
    timestamp: e.timestamp,
    rank,
    accuracy: e.accuracy ?? undefined,
    maxCombo: e.maxCombo ?? undefined,
    bossesKilled: e.bossesKilled ?? undefined,
    elitesKilled: e.elitesKilled ?? undefined,
    playTime: e.playTime ?? undefined,
    powerupsCollected: e.powerupsCollected ?? undefined,
    damageDealt: e.damageDealt ?? undefined,
    damageTaken: e.damageTaken ?? undefined,
    rankGrade: e.rankGrade ?? undefined,
  };
}

export const leaderboardRouter = router({
  // 查询排行榜 - query
  list: publicProcedure
    .input(listInputSchema)
    .output(z.array(leaderboardEntrySchema))
    .query(async ({ input }) => {
      const { limit, difficulty } = input;
      const entries = await listEntries(limit, difficulty);
      return entries.map((e, i) => toDTO(e, i + 1));
    }),

  // 提交分数 - mutation
  submit: publicProcedure
    .input(submitScoreSchema)
    .output(leaderboardEntrySchema)
    .mutation(async ({ input }) => {
      const stored = await insertEntry(input);
      const rank = (await countHigherThan(stored.score)) + 1;
      return toDTO(stored, rank);
    }),

  // 个人最佳排名 - query
  myRank: publicProcedure
    .input(z.object({ playerId: z.string().min(1) }))
    .output(myRankSchema)
    .query(async ({ input }) => {
      const best = await findBestByPlayer(input.playerId);
      if (!best) return { rank: null, entry: null };
      const rank = (await countHigherThan(best.score)) + 1;
      return {
        rank,
        entry: toDTO(best, rank),
      };
    }),

  // 统计 - query
  stats: publicProcedure.query(async () => {
    const entries = await listEntries(500);
    const total = await totalCount();
    const scores = entries.map((e) => e.score);
    const sum = scores.reduce((a, b) => a + b, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayGames = entries.filter((e) => e.timestamp >= today).length;
    return {
      totalPlayers: total,
      avgScore: total > 0 ? Math.round(sum / total) : 0,
      topScore: scores[0] ?? 0,
      todayGames,
    };
  }),
});
```

- [ ] **Step 2: 验证 typecheck**

Run (cwd: `poc/trpc-leaderboard`): `npm run typecheck`
Expected: 退出码 0（无错误）

- [ ] **Step 3: Commit**

```bash
cd ../..
git add poc/trpc-leaderboard/src/router/leaderboard.ts
git commit -m "refactor(phase4): router async + null/undefined DTO conversion"
```

---

## Task 7: trpc.ts errorFormatter (Prisma 错误码映射)

**Files:**

- Modify: `poc/trpc-leaderboard/src/trpc.ts`

- [ ] **Step 1: 增强 trpc.ts errorFormatter**

完整替换 `poc/trpc-leaderboard/src/trpc.ts`：

```typescript
// ===================================================================
// tRPC 初始化 - transformer 用 superjson 支持 Date 等复杂类型序列化
// errorFormatter: Prisma 错误码 → tRPC 错误码映射
// ===================================================================

import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { Prisma } from '@prisma/client';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Prisma 错误码映射
    let code = shape.data.code;
    if (error.cause instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 唯一约束冲突 → BAD_REQUEST (不降级, 显示错误)
      if (error.cause.code === 'P2002') {
        code = 'BAD_REQUEST';
      }
      // P2025 记录不存在 → NOT_FOUND (降级)
      if (error.cause.code === 'P2025') {
        code = 'NOT_FOUND';
      }
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        code,
        // Zod 错误细节透传给客户端
        zodError: error.cause instanceof Error ? error.cause : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
```

- [ ] **Step 2: 验证 typecheck**

Run (cwd: `poc/trpc-leaderboard`): `npm run typecheck`
Expected: 退出码 0（无错误）

- [ ] **Step 3: Commit**

```bash
cd ../..
git add poc/trpc-leaderboard/src/trpc.ts
git commit -m "feat(phase4): trpc errorFormatter map prisma error codes (P2002/P2025)"
```

---

## Task 8: router 集成测试 (TDD)

**Files:**

- Create: `poc/trpc-leaderboard/src/router/leaderboard.test.ts`

- [ ] **Step 1: 写 router/leaderboard.test.ts**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../prisma/client.js';
import { appRouter } from './index.js';
import { createContext } from '../context.js';

const caller = appRouter.createCaller(createContext());

beforeEach(async () => {
  await prisma.leaderboardEntry.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('router - list procedure', () => {
  it('返回按 rank 排序的列表', async () => {
    await prisma.leaderboardEntry.createMany({
      data: [
        { playerId: 'p1', playerName: 'A', score: 100, wave: 1, kills: 0 },
        { playerId: 'p2', playerName: 'B', score: 300, wave: 1, kills: 0 },
      ],
    });
    const list = await caller.leaderboard.list({ limit: 10 });
    expect(list).toHaveLength(2);
    expect(list[0]!.rank).toBe(1);
    expect(list[0]!.score).toBe(300);
    expect(list[1]!.rank).toBe(2);
    expect(list[1]!.score).toBe(100);
  });

  it('limit 生效', async () => {
    await prisma.leaderboardEntry.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        playerId: `p${i}`,
        playerName: `P${i}`,
        score: 100 - i,
        wave: 1,
        kills: 0,
      })),
    });
    const list = await caller.leaderboard.list({ limit: 2 });
    expect(list).toHaveLength(2);
  });
});

describe('router - submit procedure', () => {
  it('提交后返回带 rank 的 entry', async () => {
    await prisma.leaderboardEntry.create({
      data: { playerId: 'p1', playerName: 'A', score: 500, wave: 1, kills: 0 },
    });
    const result = await caller.leaderboard.submit({
      playerId: 'p2',
      playerName: 'B',
      score: 1000,
      wave: 5,
      kills: 10,
    });
    expect(result.rank).toBe(1);
    expect(result.score).toBe(1000);
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('可选字段正确返回', async () => {
    const result = await caller.leaderboard.submit({
      playerId: 'p1',
      playerName: 'A',
      score: 100,
      wave: 1,
      kills: 0,
      accuracy: 0.9,
      maxCombo: 50,
      difficulty: 'hard',
    });
    expect(result.accuracy).toBe(0.9);
    expect(result.maxCombo).toBe(50);
  });
});

describe('router - myRank procedure', () => {
  it('返回玩家最佳成绩的排名', async () => {
    await prisma.leaderboardEntry.create({
      data: { playerId: 'p1', playerName: 'A', score: 200, wave: 1, kills: 0 },
    });
    await prisma.leaderboardEntry.create({
      data: { playerId: 'p2', playerName: 'B', score: 500, wave: 1, kills: 0 },
    });
    const result = await caller.leaderboard.myRank({ playerId: 'p1' });
    expect(result.rank).toBe(2);
    expect(result.entry?.score).toBe(200);
  });

  it('玩家不存在返回 null', async () => {
    const result = await caller.leaderboard.myRank({ playerId: 'nobody' });
    expect(result.rank).toBeNull();
    expect(result.entry).toBeNull();
  });
});

describe('router - stats procedure', () => {
  it('返回正确的统计数据', async () => {
    await prisma.leaderboardEntry.createMany({
      data: [
        { playerId: 'p1', playerName: 'A', score: 100, wave: 1, kills: 0 },
        { playerId: 'p2', playerName: 'B', score: 300, wave: 1, kills: 0 },
      ],
    });
    const stats = await caller.leaderboard.stats();
    expect(stats.totalPlayers).toBe(2);
    expect(stats.topScore).toBe(300);
    expect(stats.avgScore).toBe(200);
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run (cwd: `poc/trpc-leaderboard`): `npm test`
Expected: 全部测试 PASS（store 8 个 + router 8 个 = 16 个）

- [ ] **Step 3: Commit**

```bash
cd ../..
git add poc/trpc-leaderboard/src/router/leaderboard.test.ts
git commit -m "test(phase4): router integration tests (8 tests, tRPC caller)"
```

---

## Task 9: seed 脚本 + server.ts 启动流程

**Files:**

- Create: `poc/trpc-leaderboard/scripts/seed.ts`
- Modify: `poc/trpc-leaderboard/src/server.ts`

- [ ] **Step 1: 创建 scripts/seed.ts**

```typescript
// ===================================================================
// Seed 脚本 - 幂等插入 20 条种子数据
// 用法: npm run db:seed
// ===================================================================

import 'dotenv/config';
import { seedIfEmpty } from '../src/store.js';
import { totalCount } from '../src/store.js';

seedIfEmpty()
  .then(async () => {
    const count = await totalCount();
    console.log(`[seed] done, total entries: ${count}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  });
```

- [ ] **Step 2: 修改 server.ts (顶层 await seedIfEmpty)**

Modify `poc/trpc-leaderboard/src/server.ts`，在 `seedIfEmpty()` 调用处改为顶层 await。

替换文件开头的 `seedIfEmpty();` 调用为：

```typescript
// ===================================================================
// tRPC Server - standalone HTTP 适配器
// 启动后监听 2026 端口，接受 /trpc 请求
// ===================================================================

import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { appRouter } from './router/index.js';
import { createContext } from './context.js';
import { seedIfEmpty } from './store.js';

// POC 初始数据 (幂等: 空表才插入)
await seedIfEmpty();

const port = Number(process.env.PORT ?? 2026);

const server = createHTTPServer({
  router: appRouter,
  createContext,
  responseMeta() {
    return {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-client',
      },
    };
  },
});

// 处理 CORS 预检请求（OPTIONS）
const originalListeners = server.listeners('request');
server.removeAllListeners('request');
server.on('request', (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-client',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }
  for (const listener of originalListeners) {
    listener.call(server, req, res);
  }
});

server.listen(port, () => {
  console.log(`[tRPC] Leaderboard server running at http://localhost:${port}`);
  console.log('[tRPC] 示例请求:');
  console.log(
    `  curl "http://localhost:${port}/leaderboard.list?input=%7B%22json%22%3A%7B%22limit%22%3A5%7D%7D"`,
  );
});

// 优雅关闭
const shutdown = () => {
  console.log('\n[tRPC] shutting down...');
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

- [ ] **Step 3: 运行 seed 脚本**

Run (cwd: `poc/trpc-leaderboard`): `npm run db:seed`
Expected: `[seed] done, total entries: 20`

- [ ] **Step 4: 启动 server 验证**

Run (cwd: `poc/trpc-leaderboard`): `npm run dev` (后台运行)
Expected: `[tRPC] Leaderboard server running at http://localhost:2026`

- [ ] **Step 5: 验证 list 请求**

Run: `curl "http://localhost:2026/leaderboard.list?input=%7B%22json%22%3A%7B%22limit%22%3A3%7D%7D"`
Expected: 返回 JSON，包含 3 条 seed 数据（playerName 带 `_${i}` 后缀）

- [ ] **Step 6: 停止 server**

停止后台运行的 `npm run dev`

- [ ] **Step 7: Commit**

```bash
cd ../..
git add poc/trpc-leaderboard/scripts/seed.ts poc/trpc-leaderboard/src/server.ts
git commit -m "feat(phase4): seed script + server.ts top-level await seedIfEmpty"
```

---

## Task 10: 端到端验证 S1-S6

**Files:** 无新文件，验证已有代码

- [ ] **Step 1: S1 后端 typecheck**

Run (cwd: `poc/trpc-leaderboard`): `npm run typecheck`
Expected: 退出码 0

- [ ] **Step 2: S2 store + router 测试**

确保 test db 运行: `docker compose up -d postgres-test`
Run (cwd: `poc/trpc-leaderboard`): `npm test`
Expected: 全部 16 个测试 PASS

- [ ] **Step 3: S3 tRPC server 启动 + Postgres**

确保 dev db 运行: `docker compose up -d postgres`
Run (cwd: `poc/trpc-leaderboard`):

```bash
npm run db:push      # 确保表结构最新
npm run db:seed      # 插入 seed
npm run dev          # 启动 server
```

Expected:

- `db:push` 输出 `🚀 Your database is now in sync`
- `db:seed` 输出 `[seed] done, total entries: 20`
- `npm run dev` 输出 `[tRPC] Leaderboard server running at http://localhost:2026`

- [ ] **Step 4: S4 前端 TRPC 真连接 Postgres**

在另一个终端，启动前端:

```bash
cd h:\工作区\fighter-game
VITE_LEADERBOARD_PROVIDER=trpc VITE_TRPC_URL=http://localhost:2026 npm run dev
```

Expected: 前端启动，控制台无错误

- [ ] **Step 5: S4 浏览器验证 (browser_use)**

用 browser_use 导航到前端 LeaderboardPanel:

1. 访问前端 URL (如 http://localhost:5173)
2. 导航到排行榜面板
3. 验证显示 20 条 seed 数据
4. 验证 playerName 格式带 `_${i}` 后缀（如 `星际猎人_0`, `银河守卫_1`）
5. 验证 score 在 10000-210000 范围
   Expected: 显示 20 条数据，数据来自 Postgres（非 MockProvider 的 150 条中文名）

- [ ] **Step 6: S4 GameOver 提交验证**

用 browser_use 或手动:

1. 触发 GameOver 提交分数（如 score=999000000）
2. 验证榜首更新为新提交的分数
3. 验证 Postgres 中数据已持久化: `docker compose exec postgres psql -U lb_user -d leaderboard -c "SELECT \"playerId\", score FROM \"LeaderboardEntry\" ORDER BY score DESC LIMIT 1;"`
   Expected: 榜首为新提交的记录，Postgres 中有该记录

- [ ] **Step 7: S5 降级规则验证**

1. 停止 Postgres dev 容器: `docker compose stop postgres`
2. 前端 LeaderboardPanel 刷新
3. 验证降级到 MockProvider: 显示 150 条中文名数据（非 20 条 seed）
4. 验证控制台无报错（降级日志 `TRPCProvider:list fallback to mock`）
5. 重启 Postgres: `docker compose start postgres`
6. 等待 healthy: `docker compose ps` (等 postgres 状态为 healthy)
7. 刷新前端，验证恢复真实数据（20 条 seed）
   Expected: 停 Postgres 后降级 MockProvider，重启后恢复

- [ ] **Step 8: S6 Neon 切换路径文档化**

验证 `poc/trpc-leaderboard/src/prisma/client.ts` 底部有 Neon 切换指南注释（Task 3 已添加）。
验证设计文档 `docs/superpowers/specs/2026-08-02-phase4-neon-postgres-design.md` 第 9 节有 Neon 切换指南。
Expected: 两处都有清晰的切换步骤（改 2 处: client.ts + DATABASE_URL）

- [ ] **Step 9: 停止所有服务**

```bash
# 停前端 dev server
# 停 tRPC server (npm run dev)
docker compose stop
```

- [ ] **Step 10: 更新 plan 文档 Status**

Modify `docs/superpowers/plans/2026-08-02-phase4-neon-postgres.md` 顶部，添加完成标记:

```
**Status:** Completed (S1-S6 全部通过)
```

- [ ] **Step 11: Final Commit**

```bash
cd ../..
git add docs/superpowers/plans/2026-08-02-phase4-neon-postgres.md
git commit -m "chore(phase4): mark S1-S6 verification pass + plan completed"
```

---

## 自审 Checklist

- [x] **Spec coverage**: 设计文档 9 节全部覆盖
  - 第 1 节概述 → 全部 task 覆盖目标和非目标
  - 第 2 节架构总览 → Task 1-9 实现架构
  - 第 3 节数据模型 → Task 2-3 (schema + client)
  - 第 4 节 store 重写 → Task 5-6 (store + router)
  - 第 5 节降级策略 → Task 7 (errorFormatter) + Task 10 S5 验证
  - 第 6 节测试策略 → Task 4-5-8 (vitest + store + router 测试)
  - 第 7 节验收标准 → Task 10 S1-S6
  - 第 8 节风险 → 已在 task 中缓解
  - 第 9 节 Neon 切换 → Task 3 注释 + Task 10 S6 验证
- [x] **Placeholder scan**: 无 TBD/TODO/占位符，所有 step 有完整代码
- [x] **Type consistency**: store.ts 函数签名 (insertEntry/listEntries/findBestByPlayer/countHigherThan/totalCount/seedIfEmpty) 在 Task 5/6/8/9 一致; toDTO 辅助函数在 Task 6 定义并在 router 使用
