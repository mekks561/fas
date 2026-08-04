import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.test' });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000,
    hookTimeout: 15000,
    setupFiles: ['./src/test-setup.ts'],
    // 多个测试文件共享同一个数据库，必须串行执行以避免数据竞争
    fileParallelism: false,
  },
});
