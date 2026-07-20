import React, { useState, useEffect, useCallback } from 'react';
import { GameScene } from './components/GameScene';
import { MainMenu } from './components/MainMenu';
import { LevelSelect } from './components/LevelSelect';
import { Settings } from './components/Settings';
import { GameHUD } from './components/GameHUD';
import { PauseMenu } from './components/PauseMenu';
import { GameOver as GameOverScreen } from './components/GameOver';
import { LevelUI, LevelState } from './components/LevelUI';
import { getUIManager, UIState, UIMode } from './UIManager';
import { useGameStore } from './store/useGameStore';

interface GameContainerProps {
  onQuit?: () => void;
}

export const GameContainer: React.FC<GameContainerProps> = () => {
  const [uiState, setUIState] = useState<UIState>(() => getUIManager().getState());

  // 从 store 获取游戏状态
  const player = useGameStore((state) => state.player);
  const currentWave = useGameStore((state) => state.currentWave);
  const totalWaves = 5; // 默认总波数
  const enemyCount = useGameStore((state) => state.enemyCount);
  const fps = useGameStore((state) => state.fps);

  interface KillData {
    id: string;
    name: string;
    score: number;
    timestamp: number;
  }

  interface DamageIndicatorData {
    id: string;
    damage: number;
    position: { x: number; y: number };
    isCritical: boolean;
    timestamp: number;
  }

  interface ActiveEffectData {
    type: string;
    icon: string;
    remainingTime: number;
    duration: number;
    value: number;
  }

  const kills: KillData[] = [];
  const damageIndicators: DamageIndicatorData[] = [];
  const activeEffects: ActiveEffectData[] = [];

  useEffect(() => {
    const uiManager = getUIManager();

    const unsubscribe = uiManager.subscribeToState((state) => {
      setUIState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (uiState.mode === UIMode.PLAYING) {
          getUIManager().pause();
          useGameStore.getState().setGamePaused(true);
        } else if (uiState.mode === UIMode.PAUSED) {
          getUIManager().resume();
          useGameStore.getState().setGamePaused(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiState.mode]);

  const handleStartGame = useCallback(() => {
    useGameStore.getState().resetGame();
    getUIManager().startGame(1);
  }, []);

  const handleSettings = useCallback(() => {
    getUIManager().showSettings();
  }, []);

  const handleBackToMenu = useCallback(() => {
    useGameStore.getState().resetGame();
    getUIManager().showMainMenu();
  }, []);

  const handleResume = useCallback(() => {
    getUIManager().resume();
    useGameStore.getState().setGamePaused(false);
  }, []);

  const handleRestart = useCallback(() => {
    useGameStore.getState().resetGame();
    getUIManager().startGame(uiState.currentLevelId);
  }, [uiState.currentLevelId]);

  const handleGameOver = useCallback(() => {
    getUIManager().showGameOver();
  }, []);

  const handleLevelComplete = useCallback(() => {
    getUIManager().showLevelComplete();
  }, []);

  const renderUI = () => {
    switch (uiState.mode) {
      case UIMode.MAIN_MENU:
        return (
          <MainMenu
            onStartGame={handleStartGame}
            onSettings={handleSettings}
          />
        );

      case UIMode.LEVEL_SELECT:
        return (
          <LevelSelect
            onSelectLevel={handleStartGame}
            onBack={handleBackToMenu}
          />
        );

      case UIMode.SETTINGS:
        return (
          <Settings
            onClose={handleBackToMenu}
          />
        );

      case UIMode.PLAYING:
        return (
          <>
            <GameHUD
              health={player.health}
              maxHealth={player.maxHealth}
              shield={player.shield}
              maxShield={player.maxShield}
              score={player.score}
              level={player.level}
              wave={currentWave}
              totalWaves={totalWaves}
              enemiesRemaining={enemyCount}
              fps={uiState.settings.showFPS ? fps : undefined}
              activeEffects={activeEffects}
              bossHealth={0}
              bossMaxHealth={0}
              bossName=""
            />
            {damageIndicators.map((d) => (
              <div
                key={`damage-${d.id}-${d.timestamp}`}
                className="absolute text-red-500 font-bold text-xl"
                style={{ left: d.position.x, top: d.position.y }}
              >
                -{d.damage}
              </div>
            ))}
          </>
        );

      case UIMode.PAUSED:
        return (
          <>
            <GameHUD
              health={player.health}
              maxHealth={player.maxHealth}
              shield={player.shield}
              maxShield={player.maxShield}
              score={player.score}
              level={player.level}
              wave={currentWave}
              totalWaves={totalWaves}
              enemiesRemaining={enemyCount}
            />
            <PauseMenu
              onResume={handleResume}
              onRestart={handleRestart}
              onSettings={handleSettings}
              onMainMenu={handleBackToMenu}
              currentStats={{
                score: player.score,
                wave: currentWave,
                level: player.level,
                enemiesDefeated: kills.length,
                timeElapsed: 0,
              }}
            />
          </>
        );

      case UIMode.GAME_OVER:
        return (
          <GameOverScreen
            isVictory={false}
            stats={{
              score: player.score,
              highScore: 0,
              level: player.level,
              wave: currentWave,
              enemiesDefeated: kills.length,
              timeElapsed: 0,
              accuracy: 0,
            }}
            onRestart={handleRestart}
            onMainMenu={handleBackToMenu}
          />
        );

      case UIMode.LEVEL_COMPLETE:
        const levels = getUIManager().getLevels();
        return (
          <LevelUI
            levelName={levels.find((l) => l.id === uiState.currentLevelId)?.name || ''}
            currentWave={currentWave}
            totalWaves={totalWaves}
            levelState={LevelState.LEVEL_COMPLETE}
            enemiesRemaining={0}
            announcement="Level Complete"
            isBossActive={false}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* 游戏场景 - 只在 Playing 或 Paused 模式显示 */}
      {(uiState.mode === UIMode.PLAYING || uiState.mode === UIMode.PAUSED) && (
        <GameScene onGameOver={handleGameOver} onLevelComplete={handleLevelComplete} />
      )}

      {/* UI 层 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 pointer-events-auto">{renderUI()}</div>
      </div>
    </div>
  );
};

export default GameContainer;
