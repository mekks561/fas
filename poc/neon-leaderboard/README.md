# Neon + Prisma 排行榜 API POC

> 阶段二·后端基础设施概念验证 · 2026-08

## 1. POC 目标

验证将排行榜服务从现有 **Express + Prisma + MySQL** 迁移到 **Neon (Serverless Postgres) + Prisma 7 + Hono** 的可行性与收益，并打通与前端 `CloudSaveSystem` / `LeaderboardService` 的端到端契约。

### 核心验证项

- Neon Serverless Driver Adapter 能否与 Prisma 7 协同工作
- Neon `scale-to-zero` 在游戏排行榜场景下的冷启动延迟
- 数据模型能否精确对齐前端 `LeaderboardEntry`（修复现有 MySQL 的契约错配）
- Hono + Zod 在端到端类型安全上的表现（为 tRPC POC 铺垫）

## 2. 为什么选 Neon（而非 Supabase）

| 维度          | Neon                   | Supabase                         |
| ------------- | ---------------------- | -------------------------------- |
| 定位          | 纯 Serverless Postgres | Postgres 全栈平台                |
| scale-to-zero | ✅ 免费                | ❌ 需付费                        |
| 数据库分支    | ✅ Git-like 分支       | ❌                               |
| 供应商锁定    | 低（纯 Postgres）      | 高（Auth/Storage/Realtime 耦合） |
| 迁移成本      | 低（仅换连接串）       | 高（需适配平台 API）             |

**结论**：项目已有完整 Express 后端（Auth/JWT/Socket.io），不需要 Supabase 的全栈能力。Neon 的纯 Postgres + scale-to-zero 更适合排行榜这种"读多写少、有闲时"的场景，且锁定最低。

## 3. 技术栈

| 层             | 选型                                            | 版本 | 理由                                    |
| -------------- | ----------------------------------------------- | ---- | --------------------------------------- |
| Web 框架       | Hono                                            | 4.6  | 2026 edge/serverless 主流，与 Neon 协同 |
| ORM            | Prisma                                          | 7.8  | 与现有 server 一致，复用团队知识        |
| DB             | Neon Postgres                                   | -    | Serverless，scale-to-zero               |
| Driver Adapter | @prisma/adapter-neon + @neondatabase/serverless | -    | HTTP 连接，适配 serverless              |
| 校验           | Zod                                             | 3.24 | 端到端类型安全基础，为 tRPC 铺路        |
| 运行时         | Node.js                                         | ≥20  | LTS                                     |

## 4. 与现有 MySQL 后端的契约对比

**关键修复**：现有 MySQL schema 与前端 `LeaderboardEntry` 存在错配，本 POC 修正如下。

| 字段                              | 现有 MySQL          | 前端 LeaderboardEntry | 本 POC                              |
| --------------------------------- | ------------------- | --------------------- | ----------------------------------- |
| 玩家标识                          | `userId Int` (外键) | `playerId string`     | `playerId String` ✅                |
| 时间戳                            | `DateTime`          | `number` (毫秒)       | `DateTime` 存储，API 转 `number` ✅ |
| accuracy/maxCombo/bossesKilled 等 | ❌ 缺失             | ✅ 可选字段           | ✅ 全部支持 ✅                      |
| difficulty                        | `String` (NORMAL)   | 未在 Entry 中         | `enum easy/normal/hard/expert` ✅   |

> 现有 `server/src/routes/leaderboard.ts` 返回 `{success, data}` 包装；前端 `CloudSaveSystem.getLeaderboard` 直接期望 `LeaderboardEntry[]` 数组 —— 这是已发现的契约 bug。本 POC 直接返回数组，对齐前端。

## 5. 目录结构

```
poc/neon-leaderboard/
├── prisma/
│   └── schema.prisma          # 对齐前端 LeaderboardEntry 的数据模型
├── src/
│   ├── index.ts               # Hono server 入口
│   ├── lib/
│   │   └── prisma.ts          # Prisma + Neon adapter 初始化
│   ├── routes/
│   │   └── leaderboard.ts     # 4 个 API 端点
│   └── schemas/
│       └── leaderboard.ts     # Zod schema（类型唯一来源）
├── scripts/
│   ├── seed.ts                # 200 条模拟数据
│   └── smoke-test.ts          # 端到端 API 验证（9 项）
├── .env.example
├── package.json
└── tsconfig.json
```

## 6. API 端点

| 方法 | 路径                                       | 鉴权    | 说明                                  |
| ---- | ------------------------------------------ | ------- | ------------------------------------- |
| GET  | `/leaderboard?limit=100&difficulty=normal` | 公开    | 返回 `LeaderboardEntry[]`（带 rank）  |
| POST | `/leaderboard`                             | API Key | 提交分数，返回带 rank 的 entry（201） |
| GET  | `/leaderboard/my-rank?playerId=xxx`        | 公开    | 返回玩家历史最佳排名                  |
| GET  | `/leaderboard/stats`                       | 公开    | 全榜统计                              |
| GET  | `/health`                                  | 公开    | 健康检查                              |

## 7. 运行步骤

### 前置：获取 Neon 连接串

1. 注册 https://console.neon.tech（免费档即可）
2. 创建项目，复制 **Pooled connection** URL

### 安装与配置

```powershell
cd h:\工作区\fighter-game\poc\neon-leaderboard
npm install
copy .env.example .env
# 编辑 .env 填入 DATABASE_URL / API_KEY
```

### 数据库迁移与种子

```powershell
npm run db:generate
npm run db:migrate          # 创建 leaderboardEntry 表（Prisma 7 从 prisma.config.ts 读取连接 URL）
npm run db:seed             # 插入 200 条模拟数据
```

> **Prisma 7 架构说明**：schema 文件仅声明 `provider`，连接 URL 已移至 `prisma.config.ts`；运行时通过 `PrismaNeon` driver adapter 传入 `PrismaClient`。这是 Prisma 7 的破坏性变更，与 6.x 不同。

### 启动与验证

```powershell
npm run dev                 # 启动 Hono server (端口 8787)
# 另开终端
npm run test:smoke          # 运行 9 项端到端 smoke test
```

### 类型检查

```powershell
npm run typecheck
```

## 8. 验证结果记录

本地已验证项（无需 Neon 账号）：

| 验证项            | 状态 | 备注                                                                                       |
| ----------------- | ---- | ------------------------------------------------------------------------------------------ |
| typecheck 通过    | ✅   | `tsc --noEmit` 0 错误（适配 Prisma 7 新架构）                                              |
| Prisma generate   | ✅   | v7.9.1，生成 `@prisma/client`                                                              |
| Prisma 7 架构适配 | ✅   | schema 移除 url/directUrl，新增 `prisma.config.ts`；`PrismaNeon` 用 `PoolConfig` 而非 Pool |
| smoke-test 类型   | ✅   | 9 项端到端用例类型检查通过                                                                 |

待真实 Neon 账号验证项：

| 验证项              | 状态 | 备注                          |
| ------------------- | ---- | ----------------------------- |
| migrate 成功        | ⏳   | 需 DATABASE_URL               |
| seed 插入 200 条    | ⏳   | 需 DB 连接                    |
| smoke test 9/9 通过 | ⏳   | 需 server 运行                |
| Neon 冷启动延迟     | ⏳   | 需实际测量 scale-to-zero 唤醒 |
| Top 100 查询延迟    | ⏳   | 需实际测量                    |

## 9. 已知 Gap 与后续计划

1. **无 Auth**：POC 用简易 API Key，生产应复用现有 server 的 JWT 中间件
2. **无缓存层**：现有 MySQL server 有 Redis 缓存，POC 暂未引入；Neon 可结合边缘缓存
3. **未做压力测试**：scale-to-zero 冷启动在高频写入下的表现需压测验证
4. **difficulty 契约**：前端 `submitScore` 不传 difficulty，POC 默认 `normal`；需在前端补传或从玩家 settings 读取

## 10. 与 tRPC POC 的衔接

本 POC 的 Zod schema（`src/schemas/leaderboard.ts`）将作为后续 **tRPC + Zod 端到端类型安全 POC** 的输入：

- tRPC router 直接复用同一套 Zod schema 做输入校验
- 前端通过 `trpc-react` 获得完全类型安全的调用（无需手写 API client）
- 对比 Hono + 手动 fetch 的开发体验与类型安全性
