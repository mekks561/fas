import {
  submitScoreSchema,
  listInputSchema,
  statsSchema,
} from '../../src/shared/schemas/leaderboard';
import type { ListInput, SubmitScoreInput } from '../../src/shared/schemas/leaderboard';

const parsedSubmit = submitScoreSchema.parse({
  playerId: 'u1',
  playerName: 'Alice',
  score: 1000,
  wave: 5,
  kills: 50,
});

// 错误 1: limit 传字符串 '五' 而非 number
const badInput1: ListInput = { limit: '五' };

// 错误 2: playerId 传数字 123 而非 string
const badSubmit: SubmitScoreInput = {
  playerId: 123,
  playerName: 'X',
  score: 100,
  wave: 1,
  kills: 0,
};

// 错误 3: 访问不存在的属性 nonexistent
const good = statsSchema.parse({
  totalPlayers: 10,
  topScore: 1000,
  avgScore: 500,
  difficultyDistribution: { easy: 2, normal: 5, hard: 2, expert: 1 },
});
console.log(good.nonexistent);

// 错误 4: string 变量被赋 number 值
const parsedStats = statsSchema.parse({
  totalPlayers: 1,
  topScore: 99,
  avgScore: 50,
  difficultyDistribution: { easy: 0, normal: 1, hard: 0, expert: 0 },
});
const s: string = parsedStats.topScore;
