// ===================================================================
// Prisma 7 配置 - 连接 URL 从 schema 移至此处
// Prisma 7 架构：schema 只声明 provider，运行时连接通过 adapter 传入 PrismaClient
// Migrate 工具链从此文件读取 datasource URL
// ===================================================================

import { defineConfig } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    datasource: {
      // 用于 prisma migrate / prisma db push
      url: process.env.DATABASE_URL!,
    },
  },
});
