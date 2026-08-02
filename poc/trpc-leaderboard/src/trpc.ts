// ===================================================================
// tRPC 初始化 - transformer 用 superjson 支持 Date 等复杂类型序列化
// ===================================================================

import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Zod 错误细节透传给客户端
        zodError: error.cause instanceof Error ? error.cause : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
