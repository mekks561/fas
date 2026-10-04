// ===================================================================
// Prisma Client 初始化（Neon Serverless Driver Adapter）
// 使用 @neondatabase/serverless 通过 HTTP/WebSocket 连接 Neon
// 支持 scale-to-zero：无连接时 Neon 自动挂起，按需唤醒
// ===================================================================

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import 'dotenv/config';

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      '[Prisma] DATABASE_URL 未设置。请复制 .env.example 为 .env 并填入 Neon 连接字符串。',
    );
  }

  // PrismaNeon adapter 接受 PoolConfig（连接配置），内部管理 Neon WebSocket Pool
  // Neon scale-to-zero：空闲时数据库挂起，请求到来时按需唤醒
  const adapter = new PrismaNeon({ connectionString: databaseUrl });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['query', 'warn', 'error'],
  });
}

// 开发环境复用 client 避免热重载泄漏连接
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[Database] Neon Postgres connection established');
  } catch (error) {
    console.error('[Database] Neon connection failed:', error);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('[Database] Neon connection closed');
  } catch (error) {
    console.error('[Database] Error closing connection:', error);
  }
}
