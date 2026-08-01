import type {
  SubmitScoreInput,
  ListInput,
  LeaderboardEntryDTO,
  MyRankResult,
  LeaderboardStatsDTO,
} from '../../shared/schemas/leaderboard';

export type ProviderKind = 'mock' | 'trpc';

export interface SubmitResult {
  rank: number;
  entry: LeaderboardEntryDTO;
}

export interface LeaderboardProvider {
  readonly kind: ProviderKind;
  list(input: ListInput): Promise<LeaderboardEntryDTO[]>;
  submit(input: SubmitScoreInput): Promise<SubmitResult>;
  myRank(playerId: string): Promise<MyRankResult>;
  stats(): Promise<LeaderboardStatsDTO>;
}
