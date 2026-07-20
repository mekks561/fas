/// <reference types="vite/client" />

interface ImportMeta {
  glob: <T = { [key: string]: () => Promise<{ default: T }> }>(
    pattern: string,
    options?: { as?: 'raw' | 'url'; eager?: boolean }
  ) => { [key: string]: string };
}
