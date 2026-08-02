// ===================================================================
// App Router - 根路由聚合
// 导出 AppRouter 类型，客户端通过 `import type` 获得端到端类型
// 这是 tRPC 类型安全的核心：类型从 server 流向 client，无需代码生成
// ===================================================================

import { router, publicProcedure } from '../trpc.js';
import { leaderboardRouter } from './leaderboard.js';

export const appRouter = router({
  leaderboard: leaderboardRouter,
  health: publicProcedure.query(() => 'ok' as const),
});

// ⭐ 关键导出：客户端仅导入此类型（零运行时依赖）
export type AppRouter = typeof appRouter;
