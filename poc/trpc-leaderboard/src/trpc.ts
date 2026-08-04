// ===================================================================
// tRPC 初始化 - transformer 用 superjson 支持 Date 等复杂类型序列化
// errorFormatter 映射 Prisma 错误码到 tRPC 错误码：
//   P2002 唯一约束冲突 -> BAD_REQUEST (不降级)
//   P2025 记录不存在  -> NOT_FOUND (降级)
//   其余错误保持默认 INTERNAL_SERVER_ERROR (降级)
// ===================================================================

import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { Prisma } from './generated/prisma/client.js';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    let code = shape.data.code;
    if (error.cause instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.cause.code === 'P2002') {
        code = 'BAD_REQUEST';
      }
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
