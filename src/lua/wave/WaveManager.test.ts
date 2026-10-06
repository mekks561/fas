import { beforeEach, describe, expect, it } from 'vitest';
import { WaveManager } from './WaveManager';
import type { WavePlan } from './WaveManager';

/**
 * 计划模式单测：关卡显式波次表优先于 Lua 公式。
 * 计划模式下 WaveManager 完全不触碰 Lua，因此无需初始化即可确定性验证。
 */
const level01Plans: WavePlan[] = [
  { waveNumber: 1, enemyTypes: ['scout', 'scout', 'scout'] },
  { waveNumber: 2, enemyTypes: ['scout', 'scout', 'scout', 'scout', 'scout'] },
  { waveNumber: 3, enemyTypes: ['scout', 'scout', 'scout', 'scout', 'fighter', 'fighter'] },
];

/** level-05 风格：末波只有一个 boss。 */
const level05Plans: WavePlan[] = [
  { waveNumber: 1, enemyTypes: ['fighter', 'fighter', 'fighter', 'fighter', 'fighter'] },
  { waveNumber: 2, enemyTypes: ['tank', 'tank', 'tank', 'bomber', 'bomber'] },
  { waveNumber: 3, enemyTypes: ['boss_sentinel'] },
];

describe('WaveManager 计划模式（关卡显式波次表）', () => {
  let wm: WaveManager;

  beforeEach(() => {
    wm = new WaveManager();
    wm.setLevelWaves(level01Plans);
  });

  it('startWave 用显式波次表的数量（3），而非 Lua 公式（≥5）', () => {
    const result = wm.startWave(1);
    expect('error' in result && result.error).toBe(false);
    expect(result).toMatchObject({
      success: true,
      waveNumber: 1,
      enemyCount: 3,
      isBossWave: false,
      isEliteWave: false,
    });
    if ('enemyTypes' in result) {
      expect(result.enemyTypes).toEqual(['scout', 'scout', 'scout']);
    }
  });

  it('spawnNextEnemy 按计划顺序产出类型，超额后拒绝', () => {
    wm.startWave(1);
    const types: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = wm.spawnNextEnemy();
      if (i < 3) {
        expect('error' in r).toBe(false);
        if (!('error' in r)) types.push(r.enemy.type);
      } else {
        expect('error' in r).toBe(true);
      }
    }
    expect(types).toEqual(['scout', 'scout', 'scout']);
  });

  it('spawnNextEnemy 返回的 config 带 isBoss/isElite 标记', () => {
    wm.setLevelWaves(level05Plans);
    wm.startWave(3);
    const r = wm.spawnNextEnemy();
    expect('error' in r).toBe(false);
    if (!('error' in r)) {
      expect(r.enemy.type).toBe('boss_sentinel');
      expect(r.enemy.isBoss).toBe(true);
      expect(r.totalToSpawn).toBe(1);
    }
  });

  it('onEnemyDefeated 打满该波数量 → isWaveComplete + state completed', () => {
    wm.startWave(1);
    let complete = false;
    for (let i = 0; i < 3; i++) {
      const r = wm.onEnemyDefeated('scout');
      expect('error' in r).toBe(false);
      if (!('error' in r)) complete = r.isWaveComplete;
    }
    expect(complete).toBe(true);
    expect(wm.getWaveState().currentState).toBe('completed');
  });

  it('onEnemyDefeated 后再多报一次击杀 → 拒绝（防重复结算）', () => {
    wm.startWave(1);
    for (let i = 0; i < 3; i++) wm.onEnemyDefeated('scout');
    const extra = wm.onEnemyDefeated('scout');
    // 波已 completed，不再是 active，多出的击杀不应把 remaining 推成负数
    expect('error' in extra).toBe(true);
    expect(wm.getWaveState().enemiesRemaining).toBe(0);
  });

  it('boss 判定由数据决定：第 3 波含 boss 类型即 boss 波（修「末波永不是 boss」）', () => {
    wm.setLevelWaves(level05Plans);
    expect(wm.isBossWave(1)).toBe(false);
    expect(wm.isBossWave(3)).toBe(true); // 旧公式 3 % 5 ≠ 0 → 永远 false
    expect(wm.isEliteWave(3)).toBe(false);
    const started = wm.startWave(3);
    expect(started).toMatchObject({ success: true, isBossWave: true, enemyCount: 1 });
  });

  it('getWaveState 反映计划进度（waveNumber/maxWaves/remaining）', () => {
    wm.setMaxWaves(3);
    wm.startWave(1);
    wm.spawnNextEnemy();
    wm.onEnemyDefeated('scout');
    const state = wm.getWaveState();
    expect(state).toMatchObject({
      waveNumber: 1,
      maxWaves: 3,
      enemiesSpawned: 1,
      enemiesDefeated: 1,
      enemiesRemaining: 2,
      isBossWave: false,
    });
    expect(state.progress).toBeCloseTo(1 / 3);
  });

  it('calculateEnemyCount / generateEnemyTypes / isEliteWave 均按计划返回', () => {
    expect(wm.calculateEnemyCount(2)).toBe(5);
    expect(wm.generateEnemyTypes(3)).toEqual([
      'scout',
      'scout',
      'scout',
      'scout',
      'fighter',
      'fighter',
    ]);
    expect(wm.isEliteWave(3)).toBe(false);
    // 超出计划的波号：无数据 → 空结果
    expect(wm.calculateEnemyCount(4)).toBe(0);
    expect(wm.isBossWave(4)).toBe(false);
  });

  it('getNextWaveNumber 尊重 maxWaves：末波之后为 null', () => {
    wm.setMaxWaves(3);
    wm.startWave(3);
    expect(wm.getNextWaveNumber()).toBeNull();
    wm.startWave(1);
    expect(wm.getNextWaveNumber()).toBe(2);
  });

  it('reset 保留计划与 maxWaves，只重置波次状态', () => {
    wm.setMaxWaves(3);
    wm.startWave(1);
    wm.onEnemyDefeated('scout');
    expect(wm.reset()).toBe(true);
    const state = wm.getWaveState();
    expect(state).toMatchObject({
      waveNumber: 1,
      maxWaves: 3,
      enemiesRemaining: 0,
      currentState: 'waiting',
    });
    // 计划仍在：可再次开波
    expect(wm.startWave(2)).toMatchObject({ success: true, enemyCount: 5 });
  });

  it('setLevelWaves(null) 回落 Lua 路径（未初始化时按原语义拒绝）', () => {
    wm.setLevelWaves(null);
    expect(wm.getWavePlanCount()).toBe(0);
    const result = wm.startWave(1);
    expect(result).toEqual({ success: false, error: 'not_initialized' });
  });

  it('注入计划时 maxWaves 同步为计划波数（防陈旧值破坏末波判定）', () => {
    wm.setMaxWaves(10); // 模拟 GameScene 在注入前调用 setMaxWaves（走 Lua 路径）
    wm.setLevelWaves(level01Plans);
    expect(wm.getWaveState().maxWaves).toBe(3);
    expect(wm.getNextWaveNumber()).not.toBeNull();
  });
});
