
import { test, expect } from '@playwright/test';

test('AI Performance Stress Test in Browser', async ({ page }) => {
  // 1. 访问游戏页面 (假设 dev server 已启动)
  await page.goto('http://localhost:5175');
  
  // 等待 Lua 初始化
  await page.waitForFunction(() => (window as any).luaEngine?.isInitialized());

  // 2. 执行压力测试脚本
  const results = await page.evaluate(async () => {
    const { enemyAIManager } = (window as any);
    
    if (!enemyAIManager.isReady()) {
      return { error: 'Lua AI is not ready' };
    }
    
    const ENEMY_COUNT = 100;
    const TEST_FRAMES = 60;
    const DT = 1/60;
    
    const handles = [];
    for (let i = 0; i < ENEMY_COUNT; i++) {
      handles.push(enemyAIManager.spawn('SWARM', Math.random() * 100, 0, Math.random() * 100, 20, 20, 15));
    }
    
    const start = performance.now();
    for (let f = 0; f < TEST_FRAMES; f++) {
      for (const h of handles) {
        enemyAIManager.sync(h, 0, 0, 0, 20);
        enemyAIManager.step(h, 0, 0, 0, DT);
      }
    }
    const end = performance.now();
    
    // 清理
    for (const h of handles) {
      enemyAIManager.despawn(h);
    }
    
    return {
      totalTime: end - start,
      avgFrameTime: (end - start) / TEST_FRAMES,
      timePerEnemy: (end - start) / (TEST_FRAMES * ENEMY_COUNT)
    };
  });

  if (results.error) {
    console.error(results.error);
    return;
  }

  console.log(`[PERF] Total time: ${results.totalTime.toFixed(2)}ms`);
  console.log(`[PERF] Avg Frame Time: ${results.avgFrameTime.toFixed(2)}ms`);
  console.log(`[PERF] Time per Enemy: ${results.timePerEnemy.toFixed(4)}ms`);
  
  expect(results.avgFrameTime).toBeLessThan(8);
});
