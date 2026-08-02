// ===================================================================
// tRPC Server - standalone HTTP 适配器
// 启动后监听 2026 端口，接受 /trpc 请求
// ===================================================================

import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { appRouter } from './router/index.js';
import { createContext } from './context.js';
import { seedIfEmpty } from './store.js';

// POC 初始数据
seedIfEmpty();

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
// createHTTPServer 不自动处理 OPTIONS，需要手动拦截
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
  // 非 OPTIONS 请求交给 tRPC handler
  for (const listener of originalListeners) {
    listener.call(server, req, res);
  }
});

server.listen(port, () => {
  console.log(`[tRPC] Leaderboard POC server running at http://localhost:${port}`);
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
