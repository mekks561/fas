/**
 * 高性能状态管理策略
 * 采用原子化订阅，避免对象引用变化导致的无限循环
 */

import { useGameStore } from './useGameStore';

// 游戏状态 Hooks - 原子化订阅
export const useGameState = () => {
  const isLoading = useGameStore((state) => state.isLoading);
  const isGamePaused = useGameStore((state) => state.isGamePaused);
  const isSceneReady = useGameStore((state) => state.isSceneReady);

  return { isLoading, isGamePaused, isSceneReady };
};

export const usePlayerState = () => {
  const health = useGameStore((state) => state.player.health);
  const maxHealth = useGameStore((state) => state.player.maxHealth);
  const shield = useGameStore((state) => state.player.shield);
  const maxShield = useGameStore((state) => state.player.maxShield);
  const score = useGameStore((state) => state.player.score);
  const level = useGameStore((state) => state.player.level);

  return { health, maxHealth, shield, maxShield, score, level };
};

export const useWaveState = () => {
  const currentWave = useGameStore((state) => state.currentWave);
  const waveProgress = useGameStore((state) => state.waveProgress);
  const enemyCount = useGameStore((state) => state.enemyCount);

  return { currentWave, waveProgress, enemyCount };
};

export const usePerformanceState = () => {
  const fps = useGameStore((state) => state.fps);
  const speed = useGameStore((state) => state.speed);
  const isBoostActive = useGameStore((state) => state.isBoostActive);

  return { fps, speed, isBoostActive };
};

// 游戏操作 Actions - 集中管理
export const useGameActions = () => {
  const setGamePaused = useGameStore((state) => state.setGamePaused);
  const resetGame = useGameStore((state) => state.resetGame);
  const setSceneReady = useGameStore((state) => state.setSceneReady);

  return { setGamePaused, resetGame, setSceneReady };
};

export const usePlayerActions = () => {
  const updatePlayerHealth = useGameStore((state) => state.updatePlayerHealth);
  const updatePlayerShield = useGameStore((state) => state.updatePlayerShield);
  const addScore = useGameStore((state) => state.addScore);

  return { updatePlayerHealth, updatePlayerShield, addScore };
};
