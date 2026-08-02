// ===================================================================
// tRPC 客户端 Demo - 展示端到端类型安全
// ⭐ 关键：仅 `import type { AppRouter }`，无运行时依赖服务端代码
// 所有调用的输入输出类型均由 AppRouter 自动推导
// ===================================================================

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
// 仅类型导入 - 客户端不打包服务端代码
import type { AppRouter } from '../src/router/index.js';

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:2026',
      transformer: superjson,
    }),
  ],
});

async function main() {
  console.log('=== tRPC 端到端类型安全 Demo ===\n');

  // 1. 查询排行榜 - limit/difficulty 有类型提示且默认值生效
  const entries = await client.leaderboard.list.query({ limit: 5 });
  console.log('📊 Top 5 排行榜:');
  entries.forEach((e, i) => {
    // e.timestamp 是 Date 类型（superjson 自动反序列化），非字符串
    console.log(
      `  #${i + 1} ${e.playerName} - ${e.score} 分 (wave ${e.wave}) @ ${e.timestamp.toISOString()}`,
    );
  });

  // 2. 提交分数 - 输入字段由 Zod schema 推导，传错字段名会编译报错
  const submitted = await client.leaderboard.submit.mutate({
    playerId: `demo_${Date.now()}`,
    playerName: 'TypeSafePlayer',
    score: 88888,
    wave: 25,
    kills: 180,
    accuracy: 0.92,
    maxCombo: 88,
    rankGrade: 'S',
    difficulty: 'hard',
  });
  console.log(`\n🏆 提交成功，当前排名 #${submitted.rank}，分数 ${submitted.score}`);

  // 3. 查询个人排名
  const myRank = await client.leaderboard.myRank.query({ playerId: submitted.playerId });
  console.log(`\n👤 我的最佳排名: ${myRank.rank ?? '未上榜'}`);

  // 4. 统计
  const stats = await client.leaderboard.stats.query();
  console.log(`\n📈 全榜统计:`, stats);

  // ⭐ 类型安全演示（取消注释下列任一行，tsc 会立即报错）:
  //
  // await client.leaderboard.list.query({ limit: '五' });        // ❌ string 不可赋给 number
  // await client.leaderboard.submit.mutate({ playerId: 123 });    // ❌ number 不可赋给 string
  // await client.leaderboard.list.query({ limit: 5 }).then(e => e[0].nonexistent); // ❌ 属性不存在
  // const bad: string = submitted.score;                          // ❌ number 不可赋给 string

  console.log('\n✅ 所有调用均通过类型检查（client 端无需手写任何类型定义）');
}

main().catch((err) => {
  console.error('Demo 失败（请确保 server 已启动: npm run dev）:', err);
  process.exit(1);
});
