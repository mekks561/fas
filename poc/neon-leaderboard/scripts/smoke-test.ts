// ===================================================================
// Smoke Test - 端到端验证运行中的 POC API
// 前置：先启动 server (npm run dev)，再运行本脚本
// 验证项：健康检查、获取排行榜、提交分数、个人排名、统计
// ===================================================================

const BASE = process.env.POC_URL ?? 'http://localhost:8787';
const API_KEY = process.env.API_KEY ?? 'poc-dev-key-change-me';

let passed = 0;
let failed = 0;

// 响应类型定义（对齐前端 LeaderboardEntry 契约）
interface EntryDTO {
  playerId: string;
  playerName: string;
  score: number;
  wave: number;
  kills: number;
  timestamp: number;
  rank: number;
  accuracy?: number;
  maxCombo?: number;
  rankGrade?: string;
  [k: string]: unknown;
}
interface MyRankDTO {
  rank: number | null;
  entry: EntryDTO | null;
}
interface StatsDTO {
  totalPlayers: number;
  avgScore: number;
  topScore: number;
  totalKills: number;
  avgKills: number;
  todayGames: number;
}
interface ErrorBody {
  error?: string;
  issues?: unknown[];
}

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}: ${(err as Error).message}`);
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log(`[Smoke] 目标: ${BASE}\n`);

  await check('GET /health', async () => {
    const r = await fetch(`${BASE}/health`);
    assert(r.ok, `status ${r.status}`);
    const body = (await r.json()) as { status: string; ts: number };
    assert(body.status === 'ok', 'status !== ok');
  });

  await check('GET /leaderboard 返回数组', async () => {
    const r = await fetch(`${BASE}/leaderboard?limit=10`);
    assert(r.ok, `status ${r.status}`);
    const data = (await r.json()) as EntryDTO[];
    assert(Array.isArray(data), '应为数组');
    if (data.length > 0) {
      const first = data[0]!;
      assert(typeof first.playerId === 'string', 'playerId 应为 string');
      assert(typeof first.timestamp === 'number', 'timestamp 应为 number(毫秒)');
      assert(typeof first.rank === 'number', 'rank 应为 number');
    }
  });

  await check('POST /leaderboard 提交分数', async () => {
    const r = await fetch(`${BASE}/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        playerId: `smoke_${Date.now()}`,
        playerName: 'SmokeTester',
        score: 99999,
        wave: 20,
        kills: 150,
        accuracy: 0.85,
        maxCombo: 50,
        rankGrade: 'S',
        difficulty: 'hard',
      }),
    });
    assert(r.status === 201, `status ${r.status}`);
    const entry = (await r.json()) as EntryDTO;
    assert(entry.rank >= 1, 'rank 应 >= 1');
    assert(entry.score === 99999, 'score 不匹配');
  });

  await check('POST /leaderboard 无 API Key 应 401', async () => {
    const r = await fetch(`${BASE}/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: 'no_auth',
        playerName: 'X',
        score: 1,
        wave: 1,
        kills: 0,
      }),
    });
    assert(r.status === 401, `应 401，实际 ${r.status}`);
  });

  await check('POST /leaderboard 非法 score 应 400', async () => {
    const r = await fetch(`${BASE}/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        playerId: 'invalid',
        playerName: 'X',
        score: -1,
        wave: 1,
        kills: 0,
      }),
    });
    assert(r.status === 400, `应 400，实际 ${r.status}`);
    // 确认返回的是错误结构而非抛异常
    const body = (await r.json()) as ErrorBody;
    assert(body.error !== undefined, '应包含 error 字段');
  });

  await check('GET /leaderboard/my-rank', async () => {
    const r = await fetch(`${BASE}/leaderboard/my-rank?playerId=player_seed_0`);
    assert(r.ok, `status ${r.status}`);
    const body = (await r.json()) as MyRankDTO;
    assert(body.rank === null || typeof body.rank === 'number', 'rank 类型错误');
  });

  await check('GET /leaderboard/stats', async () => {
    const r = await fetch(`${BASE}/leaderboard/stats`);
    assert(r.ok, `status ${r.status}`);
    const stats = (await r.json()) as StatsDTO;
    assert(typeof stats.totalPlayers === 'number', 'totalPlayers 缺失');
    assert(typeof stats.topScore === 'number', 'topScore 缺失');
  });

  await check('GET /leaderboard?difficulty=expert 按难度筛选', async () => {
    const r = await fetch(`${BASE}/leaderboard?difficulty=expert&limit=5`);
    assert(r.ok, `status ${r.status}`);
    const data = (await r.json()) as EntryDTO[];
    assert(Array.isArray(data), '应为数组');
  });

  await check('GET /leaderboard?difficulty=xxx 非法难度应 400', async () => {
    const r = await fetch(`${BASE}/leaderboard?difficulty=xxx`);
    assert(r.status === 400, `应 400，实际 ${r.status}`);
  });

  console.log(`\n[Smoke] 结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[Smoke] 致命错误:', err);
  process.exit(1);
});
