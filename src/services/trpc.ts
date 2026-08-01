import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../poc/trpc-leaderboard/src/router';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export interface TRPCClientFactoryOptions {
  url: string;
}

export function createLeaderboardTRPCClient(options: TRPCClientFactoryOptions) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${options.url}/trpc`,
        transformer: superjson,
        headers() {
          return {
            'x-client': 'fighter-game-phase3',
          };
        },
      }),
    ],
  });
}

export type LeaderboardTRPCClient = ReturnType<typeof createLeaderboardTRPCClient>;
