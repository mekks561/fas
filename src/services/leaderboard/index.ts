import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ListInput,
  SubmitScoreInput,
  LeaderboardEntryDTO,
  MyRankResult,
  LeaderboardStatsDTO,
} from '../../shared/schemas/leaderboard';
import { submitScoreSchema } from '../../shared/schemas/leaderboard';
import type { LeaderboardProvider, ProviderKind, SubmitResult } from './types';
import { MockProvider } from './MockProvider';
import { TRPCProvider } from './TRPCProvider';

// setCurrentPlayer 保留 API 兼容：当前 provider 不依赖显式 currentPlayer
// （GameOver.tsx 直接在 useSubmitScore payload 中传 playerId/playerName）
export function setCurrentPlayer(_playerId: string, _playerName: string): void {
  // no-op: 保留 API 兼容，provider 通过 useSubmitScore 的 payload 获取玩家信息
}

let singleton: LeaderboardProvider | null = null;
let testOverride: LeaderboardProvider | null = null;

function resolveKindFromEnv(): ProviderKind {
  const v = import.meta.env.VITE_LEADERBOARD_PROVIDER;
  if (v === 'trpc') return 'trpc';
  return 'mock';
}

export function getProvider(): LeaderboardProvider {
  if (testOverride) return testOverride;
  if (singleton) return singleton;

  const kind = resolveKindFromEnv();
  if (kind === 'trpc') {
    const url = import.meta.env.VITE_TRPC_URL;
    const trpc = new TRPCProvider(url);
    singleton = trpc;
    return singleton;
  }
  singleton = new MockProvider();
  return singleton;
}

export function overrideProviderForTests(provider: LeaderboardProvider | null): void {
  testOverride = provider;
  if (typeof window !== 'undefined' && (window as any).__vitest__) {
    singleton = null;
  }
}

export function useLeaderboardList(input: ListInput) {
  return useQuery<LeaderboardEntryDTO[]>({
    queryKey: ['leaderboard', 'list', input.filter, input.difficulty ?? 'any', input.limit],
    queryFn: () => getProvider().list(input),
  });
}

export function useMyRank(playerId: string) {
  return useQuery<MyRankResult>({
    queryKey: ['leaderboard', 'myRank', playerId],
    queryFn: () => getProvider().myRank(playerId),
    enabled: !!playerId,
  });
}

export function useLeaderboardStats() {
  return useQuery<LeaderboardStatsDTO>({
    queryKey: ['leaderboard', 'stats'],
    queryFn: () => getProvider().stats(),
    staleTime: 60 * 1000,
  });
}

export function useSubmitScore() {
  const qc = useQueryClient();
  return useMutation<SubmitResult, unknown, SubmitScoreInput>({
    mutationFn: async (payload) => {
      const parsed = submitScoreSchema.parse(payload);
      return getProvider().submit(parsed);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
