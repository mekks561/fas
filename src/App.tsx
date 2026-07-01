/**
 * App 主组件
 * 管理游戏的整体UI状态
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { GameScene } from './components/GameScene';
import { MainMenu } from './components/MainMenu';
import { Settings } from './components/Settings';
import { PauseMenu } from './components/PauseMenu';
import { GameOver } from './components/GameOver';
import { LevelSelect } from './components/LevelSelect';
import { useGameStore } from './store/useGameStore';
import { GameState } from './game/GameStateMachine';
import './App.css';

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [isPaused, setIsPaused] = useState(false);
  
  const isSceneReady = useGameStore((state) => state.isSceneReady);
  const isVictory = useGameStore((state) => state.isVictory);
  const setSceneReady = useGameStore((state) => state.setSceneReady);
  const setVictory = useGameStore((state) => state.setVictory);
  const resetGame = useGameStore((state) => state.resetGame);
  
  const playerScore = useGameStore((state) => state.player.score);
  const playerLevel = useGameStore((state) => state.player.level);
  const currentWave = useGameStore((state) => state.currentWave);
  const enemiesDefeated = useGameStore((state) => state.enemiesDefeated);

  // 检查是否有保存的游戏
  const hasSavedGame = useMemo(() => {
    const saved = localStorage.getItem('savedGame');
    return saved !== null;
  }, []);

  // 键盘事件监听（暂停）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && gameState === GameState.PLAYING) {
        setIsPaused(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // 开始新游戏 - 打开关卡选择
  const handleStartGame = useCallback(() => {
    setGameState(GameState.LEVEL_SELECT);
  }, []);

  // 选择关卡后开始游戏
  const handleSelectLevel = useCallback((levelId: number) => {
    setSelectedLevel(levelId);
    resetGame();
    setSceneReady(true);
    setGameState(GameState.PLAYING);
  }, [resetGame, setSceneReady]);

  // 继续游戏
  const handleContinueGame = useCallback(() => {
    setSceneReady(true);
    setGameState(GameState.PLAYING);
  }, [setSceneReady]);

  // 打开设置
  const handleSettings = useCallback(() => {
    setGameState(GameState.SETTINGS);
  }, []);

  // 关闭设置
  const handleCloseSettings = useCallback(() => {
    if (gameState === GameState.SETTINGS) {
      setGameState(GameState.MENU);
    }
  }, [gameState]);

  // 返回主菜单
  const handleBackToMenu = useCallback(() => {
    setGameState(GameState.MENU);
    setSceneReady(false);
    setIsPaused(false);
  }, [setSceneReady]);

  // 返回关卡选择
  const handleBackToLevelSelect = useCallback(() => {
    setGameState(GameState.LEVEL_SELECT);
  }, []);

  // 暂停继续
  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);

  // 重新开始
  const handleRestart = useCallback(() => {
    setIsPaused(false);
    resetGame();
    setSceneReady(true);
  }, [resetGame, setSceneReady]);

  // 游戏结束
  const handleGameOver = useCallback(() => {
    setIsPaused(false);
    setGameState(GameState.GAME_OVER);
  }, []);

  // 关卡完成
  const handleLevelComplete = useCallback(() => {
    setIsPaused(false);
    setVictory(true);
    setGameState(GameState.GAME_OVER);
  }, [setVictory]);

  // 下一关
  const handleNextLevel = useCallback(() => {
    const nextLevel = Math.min(selectedLevel + 1, 5);
    setSelectedLevel(nextLevel);
    resetGame();
    setSceneReady(true);
    setGameState(GameState.PLAYING);
  }, [selectedLevel, resetGame, setSceneReady]);

  // 统计数据
  const gameStats = useMemo(() => ({
    score: playerScore,
    highScore: parseInt(localStorage.getItem('highScore') || '0'),
    wave: currentWave,
    level: playerLevel,
    enemiesDefeated: enemiesDefeated,
    timeElapsed: 0, // TODO: 从游戏状态获取
    accuracy: 0.85 // TODO: 从游戏状态获取
  }), [playerScore, currentWave, playerLevel, enemiesDefeated]);

  // 暂停菜单统计
  const pauseStats = useMemo(() => ({
    score: playerScore,
    wave: currentWave,
    level: playerLevel,
    enemiesDefeated: enemiesDefeated,
    timeElapsed: 0
  }), [playerScore, currentWave, playerLevel, enemiesDefeated]);

  return (
    <div className="app-container">
      {/* 主菜单 */}
      {gameState === GameState.MENU && (
        <MainMenu
          onStartGame={handleStartGame}
          onContinueGame={hasSavedGame ? handleContinueGame : undefined}
          onSettings={handleSettings}
          hasSavedGame={hasSavedGame}
        />
      )}

      {/* 关卡选择 */}
      {gameState === GameState.LEVEL_SELECT && (
        <LevelSelect
          onSelectLevel={handleSelectLevel}
          onBack={handleBackToMenu}
          currentPlayerLevel={playerLevel}
        />
      )}

      {/* 设置面板 */}
      {gameState === GameState.SETTINGS && (
        <Settings onClose={handleCloseSettings} />
      )}

      {/* 游戏场景 */}
      {(gameState === GameState.PLAYING && isSceneReady) && (
        <>
          <GameScene onGameOver={handleGameOver} onLevelComplete={handleLevelComplete} />
          
          {/* 暂停菜单 */}
          {isPaused && (
            <PauseMenu
              onResume={handleResume}
              onRestart={handleRestart}
              onSettings={handleSettings}
              onMainMenu={handleBackToMenu}
              currentStats={pauseStats}
            />
          )}
        </>
      )}

      {/* 游戏结束 */}
      {gameState === GameState.GAME_OVER && (
        <GameOver
          isVictory={isVictory}
          stats={gameStats}
          onRestart={handleRestart}
          onMainMenu={handleBackToMenu}
          onNextLevel={selectedLevel < 5 ? handleNextLevel : undefined}
        />
      )}
    </div>
  );
}

export default App;