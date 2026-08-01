import React from 'react';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../trpc';
import {
  getProvider,
  overrideProviderForTests,
  setCurrentPlayer,
  useLeaderboardList,
  useMyRank,
  useLeaderboardStats,
  useSubmitScore,
} from '../index';
import type { LeaderboardProvider, SubmitResult } from '../types';

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

function makeSpyProvider(
  overrides: Partial<LeaderboardProvider> = {},
): LeaderboardProvider & { _calls: Record<string, any[]> } {
  const store: any = { listCalled: 0, submitCalled: 0, myRankCalled: 0, statsCalled: 0 };
  const base: LeaderboardProvider & { _calls: any } = {
    kind: 'mock',
    _calls: store,
    list: vi.fn(async () => {
      store.listCalled++;
      return overrides.list?.() ?? [];
    }),
    submit: vi.fn(async (i) => {
      store.submitCalled++;
      return overrides.submit?.(i) ?? { rank: 1, entry: { ...i, timestamp: new Date(), rank: 1 } };
    }),
    myRank: vi.fn(async () => {
      store.myRankCalled++;
      return overrides.myRank?.() ?? { rank: null, entry: null };
    }),
    stats: vi.fn(async () => {
      store.statsCalled++;
      return (
        overrides.stats?.() ?? {
          totalPlayers: 100,
          topScore: 1000,
          avgScore: 500,
          difficultyDistribution: { easy: 20, normal: 40, hard: 30, expert: 10 },
        }
      );
    }),
  };
  return base;
}

describe('leaderboard hooks (integration)', () => {
  beforeEach(() => {
    queryClient.clear();
  });
  afterEach(() => {
    overrideProviderForTests(null);
  });

  it('useLeaderboardList: 初始 isLoading→false，data 为 provider 返回值', async () => {
    const spy = makeSpyProvider({
      list: () => [
        {
          playerId: 'a',
          playerName: 'A',
          score: 1000,
          wave: 10,
          kills: 100,
          timestamp: new Date(),
          rank: 1,
        },
        {
          playerId: 'b',
          playerName: 'B',
          score: 500,
          wave: 5,
          kills: 50,
          timestamp: new Date(),
          rank: 2,
        },
      ],
    });
    overrideProviderForTests(spy);

    const { result } = renderHook(() => useLeaderboardList({ limit: 50, filter: 'all' }), {
      wrapper,
    });
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.data?.length).toBe(2);
    expect(result.current.data![0].rank).toBe(1);
  });

  it('useSubmitScore 成功 → invalidateQueries → useLeaderboardList 重新拉取后登顶（Tester 变 #1）', async () => {
    let listVersion = 0;
    const spy = makeSpyProvider({
      list: () => {
        listVersion++;
        if (listVersion === 1) {
          return [
            {
              playerId: 'old_top',
              playerName: 'OldTop',
              score: 500_000,
              wave: 50,
              kills: 500,
              timestamp: new Date(),
              rank: 1,
            },
          ];
        }
        return [
          {
            playerId: 'tester_high',
            playerName: 'Tester',
            score: 999_999_999,
            wave: 999,
            kills: 99_999,
            timestamp: new Date(),
            rank: 1,
            accuracy: 1,
          },
        ];
      },
      submit: (i: any): SubmitResult => ({
        rank: 1,
        entry: { ...i, timestamp: new Date(), rank: 1 },
      }),
    });
    overrideProviderForTests(spy);

    const listHook = renderHook(() => useLeaderboardList({ limit: 50, filter: 'all' }), {
      wrapper,
    });
    await waitFor(() => expect(listHook.result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(listHook.result.current.data![0].playerId).toBe('old_top');
    expect(listVersion).toBe(1);

    const submitHook = renderHook(() => useSubmitScore(), { wrapper });
    let mutatePromise: Promise<any> | null = null;
    await act(async () => {
      mutatePromise = submitHook.result.current.mutateAsync({
        playerId: 'tester_high',
        playerName: 'Tester',
        score: 999_999_999,
        wave: 999,
        kills: 99_999,
        accuracy: 1,
      });
    });
    const r = await mutatePromise!;
    expect(r.rank).toBe(1);

    await waitFor(
      () => {
        listHook.rerender();
        const d = listHook.result.current.data;
        return d && d[0].playerId === 'tester_high';
      },
      { timeout: 5000 },
    );
    expect(listVersion).toBeGreaterThanOrEqual(2);
    expect(listHook.result.current.data![0].playerName).toBe('Tester');
    expect(listHook.result.current.data![0].rank).toBe(1);
  });

  it('useMyRank: enabled=false 时不请求', async () => {
    const spy = makeSpyProvider();
    overrideProviderForTests(spy);
    const { result } = renderHook(() => useMyRank(''), { wrapper });
    await new Promise((r) => setTimeout(r, 200));
    expect(result.current.isFetching).toBe(false);
    expect(spy._calls.myRankCalled).toBe(0);
  });

  it('useMyRank: 有 playerId 时正常查询', async () => {
    const spy = makeSpyProvider({
      myRank: () => ({ rank: 42, entry: null }),
    });
    overrideProviderForTests(spy);
    const { result } = renderHook(() => useMyRank('u_alice'), { wrapper });
    await waitFor(() => expect(result.current.data?.rank).toBe(42), { timeout: 5000 });
  });

  it('useLeaderboardStats: staleTime > 30s 级（此处只验证 data 返回）', async () => {
    const spy = makeSpyProvider();
    overrideProviderForTests(spy);
    const { result } = renderHook(() => useLeaderboardStats(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.data?.totalPlayers).toBe(100);
  });

  it('setCurrentPlayer 不影响 provider 接口（仅兼容）', () => {
    setCurrentPlayer('x', 'Y');
    const p = getProvider();
    expect(p).toBeDefined();
  });
});
