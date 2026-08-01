/// <reference types="vite/client" />

interface ImportMeta {
  glob: <T = { [key: string]: () => Promise<{ default: T }> }>(
    pattern: string,
    options?: { as?: 'raw' | 'url'; eager?: boolean },
  ) => { [key: string]: string };
}

interface ImportMetaEnv {
  readonly VITE_SECURITY_KEY?: string;
  readonly VITE_LEADERBOARD_PROVIDER: 'mock' | 'trpc';
  readonly VITE_TRPC_URL?: string;
}
