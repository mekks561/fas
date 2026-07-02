import React, { useState, useEffect, useCallback } from 'react';
import { GameScene } from './components/GameScene';
import { UIMode, MainMenu, LevelSelect, Settings } from './components/MainMenu';
import { GameHUD, DamageIndicator, KillFeed } from './components/GameHUD';
import {
  PauseMenu,
  GameOverScreen,
  LevelCompleteScreen,
  VictoryScreen,
} from './components/PauseMenu';
import { getUIManager, UIState, GameSettings } from './UIManager';
import { useGameStore } from './store/useGameStore';

interface GameContainerProps {
  onQuit?: () => void;
}

export const GameContainer: React.FC<GameContainerProps> = ({ onQuit }) => {
  const [uiState, setUIState] = useState<UIState>(getUIManager().getState());

  // 从 store 获取游戏状态
  const player = useGameStore((state) => state.player);
  const currentWave = useGameStore((state) => state.currentWave);
  const totalWaves = 5; // 默认总波数
  const enemyCount = useGameStore((state) => state.enemyCount);
  const fps = useGameStore((state) => state.fps);

  // 暂时使用空数组，后续可以从 store 扩展
  const kills: unknown[] = [];
  const damageIndicators: unknown[] = [];
  const activeEffects: unknown[] = [];

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

  const handleStartGame = useCallback((levelId: number) => {
    // 重置游戏状态
    useGameStore.getState().resetGame();
    getUIManager().startGame(levelId);
  }, []);

  const handleLevelSelect = useCallback(() => {
    getUIManager().showLevelSelect();
  }, []);

  const handleSettings = useCallback(() => {
    getUIManager().showSettings();
  }, []);

  const handleBackToMenu = useCallback(() => {
    useGameStore.getState().resetGame();
    getUIManager().showMainMenu();
  }, []);

  const handleQuit = useCallback(() => {
    if (onQuit) {
      onQuit();
    }
  }, [onQuit]);

  const handleResume = useCallback(() => {
    getUIManager().resume();
    useGameStore.getState().setGamePaused(false);
  }, []);

  const handleRestart = useCallback(() => {
    useGameStore.getState().resetGame();
    getUIManager().startGame(uiState.currentLevelId);
  }, [uiState.currentLevelId]);

  const handleSaveSettings = useCallback((settings: GameSettings) => {
    getUIManager().updateSettings(settings);
  }, []);

  const handleGameOver = useCallback(() => {
    getUIManager().showGameOver();
  }, []);

  const handleLevelComplete = useCallback(() => {
    getUIManager().showLevelComplete();
  }, []);

  const handleNextLevel = useCallback(() => {
    const nextLevelId = uiState.currentLevelId + 1;
    const levels = getUIManager().getLevels();

    if (nextLevelId <= levels.length) {
      useGameStore.getState().resetGame();
      getUIManager().startGame(nextLevelId);
    } else {
      getUIManager().setMode(UIMode.LEVEL_COMPLETE);
    }
  }, [uiState.currentLevelId]);

  const renderUI = () => {
    switch (uiState.mode) {
      case UIMode.MAIN_MENU:
        return (
          <MainMenu
            onStartGame={handleStartGame}
            onLevelSelect={handleLevelSelect}
            onSettings={handleSettings}
            onQuit={handleQuit}
          />
        );

      case UIMode.LEVEL_SELECT:
        return (
          <LevelSelect
            levels={uiState.levels.map((l) => ({
              id: l.id,
              name: l.name,
              description: l.description,
              difficulty: (l.difficulty as 'easy' | 'normal' | 'hard' | 'nightmare') || 'easy',
              recommendedLevel: l.recommendedLevel || 1,
              stars: l.stars || 0,
              maxStars: 3,
              unlocked: l.unlocked !== undefined ? l.unlocked : true,
              highScore: l.highScore,
              completionRate: l.completionRate,
              enemies: l.enemies || 10,
              waves: l.waves || 5,
            }))}
            onSelectLevel={handleStartGame}
            onBack={handleBackToMenu}
          />
        );

      case UIMode.SETTINGS:
        return (
          <Settings
            settings={uiState.settings}
            onSave={handleSaveSettings}
            onBack={handleBackToMenu}
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
            <KillFeed kills={kills} />
            {damageIndicators.map((d, i) => (
              <DamageIndicator
                key={`damage-${i}-${d.timestamp}`}
                damage={d.damage}
                position={d.position}
                isCritical={d.isCritical}
              />
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
                kills: kills.length,
              }}
            />
          </>
        );

      case UIMode.GAME_OVER:
        return (
          <GameOverScreen
            stats={{
              score: player.score,
              level: player.level,
              wave: currentWave,
              totalWaves: totalWaves,
              kills: kills.length,
              timePlayed: 0,
            }}
            onRestart={handleRestart}
            onMainMenu={handleBackToMenu}
          />
        );

      case UIMode.LEVEL_COMPLETE:
        const levels = getUIManager().getLevels();
        if (uiState.currentLevelId >= levels.length) {
          return (
            <VictoryScreen
              stats={{
                totalScore: player.score,
                totalKills: kills.length,
                totalTime: 0,
                levelsCompleted: levels.filter((l) => l.completed).length,
                bossesDefeated: levels.filter((l) => l.completed).length,
              }}
              onPlayAgain={handleRestart}
              onMainMenu={handleBackToMenu}
            />
          );
        }

        return (
          <LevelCompleteScreen
            stats={{
              levelId: uiState.currentLevelId,
              levelName: levels.find((l) => l.id === uiState.currentLevelId)?.name || '',
              score: player.score,
              wavesCompleted: currentWave,
              totalWaves: totalWaves,
              kills: kills.length,
              timePlayed: 0,
              bossDefeated: true,
            }}
            onNextLevel={handleNextLevel}
            onMainMenu={handleBackToMenu}
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
