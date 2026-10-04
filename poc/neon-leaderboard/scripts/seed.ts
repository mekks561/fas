// ===================================================================
// Seed 脚本 - 生成模拟排行榜数据用于验证查询性能
// 幂等：每次运行先清空再插入
// ===================================================================

import { prisma } from '../src/lib/prisma.js';
import 'dotenv/config';

const PLAYER_NAMES = [
  '星际猎人',
  '银河守卫',
  '宇宙战神',
  '光速战士',
  '暗夜游侠',
  '雷霆指挥官',
  '风暴使者',
  '烈焰骑士',
  '冰霜刺客',
  '暗影杀手',
  '星辰主宰',
  '虚空行者',
  '量子战士',
  '时空猎人',
  '永恒守护者',
  '无尽探索者',
  '银河霸主',
  '宇宙先锋',
  '星际王牌',
  '绝对王者',
];

const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert'] as const;
const RANK_GRADES = ['S', 'A', 'B', 'C', 'D'];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)]!;
}

async function main() {
  console.log('[Seed] 清空现有数据...');
  await prisma.leaderboardEntry.deleteMany({});

  console.log('[Seed] 生成 200 条模拟排行榜数据...');
  const records = Array.from({ length: 200 }, (_, i) => {
    const difficulty = pick(DIFFICULTIES);
    // 难度越高基础分越高
    const base = { easy: 5000, normal: 15000, hard: 40000, expert: 80000 }[difficulty]!;
    return {
      playerId: `player_seed_${i}`,
      playerName: `${pick(PLAYER_NAMES)}${i >= PLAYER_NAMES.length ? `_${i}` : ''}`,
      score: base + randInt(0, 200000),
      wave: randInt(3, 50),
      kills: randInt(20, 500),
      accuracy: Math.round(Math.random() * 100) / 100,
      maxCombo: randInt(5, 200),
      bossesKilled: randInt(0, 10),
      elitesKilled: randInt(0, 50),
      playTime: randInt(60, 3600),
      powerupsCollected: randInt(0, 30),
      damageDealt: randInt(1000, 50000),
      damageTaken: randInt(0, 5000),
      rankGrade: pick(RANK_GRADES),
      difficulty,
    };
  });

  // 批量插入
  await prisma.leaderboardEntry.createMany({ data: records });
  console.log(`[Seed] 完成，共插入 ${records.length} 条记录`);

  // 验证：查询 Top 5
  const top5 = await prisma.leaderboardEntry.findMany({
    orderBy: { score: 'desc' },
    take: 5,
    select: { playerName: true, score: true, difficulty: true },
  });
  console.log('[Seed] Top 5:');
  top5.forEach((e, i) => console.log(`  #${i + 1} ${e.playerName} - ${e.score} (${e.difficulty})`));
}

main()
  .catch((err) => {
    console.error('[Seed] 失败:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
