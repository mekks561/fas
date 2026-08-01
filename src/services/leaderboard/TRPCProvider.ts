import { createLeaderboardTRPCClient, type LeaderboardTRPCClient } from '../trpc';
import type { LeaderboardProvider, SubmitResult } from './types';
import { MockProvider } from './MockProvider';
import type {
  ListInput,
  LeaderboardEntryDTO,
  MyRankResult,
  LeaderboardStatsDTO,
  SubmitScoreInput,
} from '../../shared/schemas/leaderboard';

type TRPCErrorLike = { code?: string; message?: string; data?: any; cause?: any };

function isTRPCError(e: any): e is TRPCErrorLike {
  return e && (typeof e.code === 'string' || (e.cause && typeof e.cause.code === 'string'));
}

function getErrorCode(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e.code === 'string') return e.code;
  if (e.cause && typeof e.cause.code === 'string') return e.cause.code;
  const status = e.status ?? e.httpStatus ?? e.response?.status;
  if (typeof status === 'number') {
    if (status >= 500) return 'INTERNAL_SERVER_ERROR';
    if (status === 400) return 'BAD_REQUEST';
    if (status === 401 || status === 403) return 'UNAUTHORIZED';
  }
  return undefined;
}

export class TRPCProvider implements LeaderboardProvider {
  readonly kind = 'trpc' as const;
  private client: LeaderboardTRPCClient | null = null;
  private fallback: MockProvider;
  private readonly baseUrl: string;

  constructor(trpcUrl?: string | null) {
    const url = (trpcUrl || '').trim();
    this.baseUrl = url;
    this.fallback = new MockProvider();
    if (url) {
      try {
        this.client = createLeaderboardTRPCClient({ url });
      } catch (e) {
        console.debug('[TRPCProvider] client construction failed, fallback to mock', e);
        this.client = null;
      }
    }
  }

  /**
   * 4条降级规则:
   * 1. !client / !url → 直用 Mock
   * 2. navigator.onLine === false → 降级（jsdom 下此项恒为 true）
   * 3. 网络错误 / 5xx (INTERNAL_SERVER_ERROR) → 降级 + console.debug
   * 4. BAD_REQUEST (zod issues) → 不降级，向上抛
   *
   * @param allowFallback 为 false 时（如 BAD_REQUEST 类型错误）将直接 throw 而非降级
   */
  private async fallbackOrThrow<T>(
    op: string,
    fn: (c: LeaderboardTRPCClient) => Promise<T>,
    fallbackFn: () => Promise<T>,
    allowFallback = true,
  ): Promise<T> {
    if (!this.client) return fallbackFn();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return fallbackFn();

    try {
      return await fn(this.client);
    } catch (err: any) {
      const code = getErrorCode(err);
      if (!allowFallback || code === 'BAD_REQUEST') {
        throw err;
      }
      console.debug(`[TRPCProvider:${op}] fallback to mock (code=${code})`, err?.message || err);
      return fallbackFn();
    }
  }

  private static dateToNumber(entry: any): LeaderboardEntryDTO {
    return {
      ...entry,
      timestamp: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
    };
  }

  async list(input: ListInput): Promise<LeaderboardEntryDTO[]> {
    const isFriends = input.filter === 'friends';
    const trpcInput = isFriends
      ? { limit: input.limit, difficulty: input.difficulty }
      : { limit: input.limit, difficulty: input.difficulty };

    return this.fallbackOrThrow(
      'list',
      async (c) => {
        const raw = await c.leaderboard.list.query(trpcInput as any);
        const arr: any[] = Array.isArray(raw) ? raw : ((raw as any)?.json ?? []);
        let result = arr.map(TRPCProvider.dateToNumber);
        if (isFriends) {
          result = result.slice(10, 26);
        }
        return result.slice(0, input.limit).map((e, i) => ({ ...e, rank: i + 1 }));
      },
      async () => this.fallback.list(input),
    );
  }

  async submit(input: SubmitScoreInput): Promise<SubmitResult> {
    return this.fallbackOrThrow(
      'submit',
      async (c) => {
        const r: any = await c.leaderboard.submit.mutate(input);
        const entry = TRPCProvider.dateToNumber(r.entry ?? r);
        return { rank: typeof r.rank === 'number' ? r.rank : entry.rank, entry };
      },
      async () => this.fallback.submit(input),
      false,
    );
  }

  async myRank(playerId: string): Promise<MyRankResult> {
    return this.fallbackOrThrow(
      'myRank',
      async (c) => {
        const r: any = await c.leaderboard.myRank.query({ playerId });
        return {
          rank: r.rank ?? null,
          entry: r.entry ? TRPCProvider.dateToNumber(r.entry) : null,
        };
      },
      async () => this.fallback.myRank(playerId),
    );
  }

  async stats(): Promise<LeaderboardStatsDTO> {
    return this.fallbackOrThrow(
      'stats',
      async (c) => {
        const r: any = await c.leaderboard.stats.query();
        return r.json ?? r;
      },
      async () => this.fallback.stats(),
    );
  }
}
