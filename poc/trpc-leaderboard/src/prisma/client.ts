// ===================================================================
// Prisma Client 初始化 - 依赖注入 adapter
// 当前: @prisma/adapter-mariadb + mariadb (本地 MySQL 8.0, 端口 3306)
// 未来切 Neon: 改 3 处 (schema.provider + adapter + DATABASE_URL), 见底部注释
// ===================================================================

import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// 解析 DATABASE_URL (mysql://user:pass@host:port/dbname)
const url = new URL(process.env['DATABASE_URL']!);
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: url.username,
  password: url.password,
  database: url.pathname.replace('/', ''),
  connectionLimit: 5,
});

export const prisma = new PrismaClient({ adapter });

// ===================================================================
// Neon 切换指南 (未来注册 Neon 后):
// 注意: Neon 是 PostgreSQL Serverless, 需要同时改 datasource provider
//
// 改动 1/3: prisma/schema.prisma 改 datasource.db.provider
//    datasource db {
//      provider = "mysql"   // ← 改为 "postgresql"
//    }
//    generator client 的 output 保持不变或改回默认
//
// 改动 2/3: 本文件 (client.ts) 替换 adapter
//    npm uninstall mariadb @prisma/adapter-mariadb
//    npm install @prisma/adapter-neon
//    import { PrismaNeon } from '@prisma/adapter-neon';
//    import { PrismaClient } from '../generated/prisma/client.js';
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
