
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { enemyAIManager } from '../lua';

describe('AI Performance Stress Test', () => {
  beforeAll(async () => {
    await enemyAIManager.initialize();
  });

  afterAll(() => {
    enemyAIManager.destroy();
  });

  it('should measure Lua AI overhead for 100 swarm enemies', async () => {
    if (!enemyAIManager.isReady()) {
      console.warn('Skipping test: Lua AI is not ready (possibly stub mode)');
      return;
    }

    const ENEMY_COUNT = 100;
    const TEST_FRAMES = 60; 
    const DT = 1/60;
    
    const handles: number[] = [];
    for (let i = 0; i < ENEMY_COUNT; i++) {
      const handle = enemyAIManager.spawn(
        'SWARM',
        Math.random() * 100 - 50,
        0,
        Math.random() * 100 - 50,
        20,
        20,
        15
      );
      if (handle > 0) handles.push(handle);
    }

    expect(handles.length).toBe(ENEMY_COUNT);
    
    const start = performance.now();
    
    for (let frame = 0; frame < TEST_FRAMES; frame++) {
      for (const handle of handles) {
        enemyAIManager.sync(handle, Math.random() * 10, 0, Math.random() * 10, 20);
        enemyAIManager.step(handle, 0, 0, 0, DT);
      }
    }
    
    const end = performance.now();
    const totalTime = end - start;
    const avgFrameTime = totalTime / TEST_FRAMES;
    const timePerEnemy = totalTime / (TEST_FRAMES * ENEMY_COUNT);
    
    console.log(`[PERF] Total time for ${TEST_FRAMES} frames: ${totalTime.toFixed(2)}ms`);
    console.log(`[PERF] Average time per frame: ${avgFrameTime.toFixed(2)}ms`);
    console.log(`[PERF] Average time per enemy step: ${timePerEnemy.toFixed(4)}ms`);
    
    // 清理
    for (const handle of handles) {
      enemyAIManager.despawn(handle);
    }

    // 断言：每帧 AI 开销不应超过 8ms (给渲染留一半时间)
    expect(avgFrameTime).toBeLessThan(8);
  });
});
