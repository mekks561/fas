import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.test' });

if (!process.env.DATABASE_URL?.includes('fighter_leaderboard_test')) {
  throw new Error(
    `[test-setup] DATABASE_URL must point to test db (fighter_leaderboard_test), got: ${process.env.DATABASE_URL}`,
  );
}
