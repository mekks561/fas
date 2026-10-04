// ===================================================================
// Neon Leaderboard POC - Hono Server 入口
// Hono：2026 主流 edge/serverless Web 框架，与 Neon 协同部署
// ===================================================================

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import 'dotenv/config';

import { connectDB, disconnectDB } from './lib/prisma.js';
import leaderboardRouter from './routes/leaderboard.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

// 简易 API Key 鉴权（POC 阶段；生产替换为 JWT/Clerk Auth）
app.use('/leaderboard/*', async (c, next) => {
  // GET 公开读取（排行榜为公开数据）
  if (c.req.method === 'GET') {
    return next();
  }
  const apiKey = c.req.header('Authorization')?.replace('Bearer ', '');
  if (apiKey !== process.env.API_KEY) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return next();
});

app.route('/leaderboard', leaderboardRouter);

app.get('/health', (c) => c.json({ status: 'ok', ts: Date.now() }));

const port = Number(process.env.PORT ?? 8787);

async function main() {
  await connectDB();
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[Server] Neon Leaderboard POC running at http://localhost:${info.port}`);
  });
}

main().catch(async (err) => {
  console.error('[Server] Fatal startup error:', err);
  await disconnectDB();
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n[Server] SIGINT received, shutting down...');
  await disconnectDB();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  console.log('\n[Server] SIGTERM received, shutting down...');
  await disconnectDB();
  process.exit(0);
});
