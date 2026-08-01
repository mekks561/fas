/**
 * App 主组件
 * 管理游戏的整体UI状态
 */

import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MainMenu } from './components/MainMenu';
import { useGameStore } from './store/useGameStore';
import { GameState } from './game/GameStateMachine';
import { FriendService } from './engine/FriendService';
import { gameplayManager } from './engine/GameplayManager';
import { dailyChallengeManager } from './engine/DailyChallengeManager';
import { queryClient } from './services/trpc';
import { getProvider } from './services/leaderboard';
import './App.css';

const friendService = new FriendService();

const GameScene = lazy(() =>
  import('./components/GameScene').then((m) => ({ default: m.GameScene })),
);
const LevelSelect = lazy(() =>
  import('./components/LevelSelect').then((m) => ({ default: m.LevelSelect })),
);
const Settings = lazy(() => import('./components/Settings').then((m) => ({ default: m.Settings })));
const PauseMenu = lazy(() =>
  import('./components/PauseMenu').then((m) => ({ default: m.PauseMenu })),
);
const GameOver = lazy(() => import('./components/GameOver').then((m) => ({ default: m.GameOver })));
const AchievementPanel = lazy(() =>
  import('./components/AchievementPanel').then((m) => ({ default: m.AchievementPanel })),
);
const ShopPanel = lazy(() =>
  import('./components/ShopPanel').then((m) => ({ default: m.ShopPanel })),
);
const LeaderboardPanel = lazy(() =>
  import('./components/LeaderboardPanel').then((m) => ({ default: m.LeaderboardPanel })),
);
const FriendPanel = lazy(() =>
  import('./components/FriendPanel').then((m) => ({ default: m.FriendPanel })),
);
const DailyChallengePanel = lazy(() =>
  import('./components/DailyChallengePanel').then((m) => ({ default: m.DailyChallengePanel })),
);

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
    <div className="w-64 space-y-4">
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse"
          style={{ width: '60%' }}
        />
      </div>
      <p className="text-center text-slate-500 text-sm">Loading...</p>
    </div>
  </div>
);

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [isPaused, setIsPaused] = useState(false);

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

  // 预初始化 Leaderboard Provider（Phase 3: tRPC + React Query）
  useEffect(() => {
    getProvider();
  }, []);

  // 键盘事件监听（暂停）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && gameState === GameState.PLAYING) {
        setIsPaused((prev) => !prev);
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
  const handleSelectLevel = useCallback(
    (levelId: number) => {
      setSelectedLevel(levelId);
      resetGame();
      setSceneReady(false);
      setGameState(GameState.PLAYING);
    },
    [resetGame, setSceneReady],
  );

  // 继续游戏
  const handleContinueGame = useCallback(() => {
    setSceneReady(true);
    setGameState(GameState.PLAYING);
  }, [setSceneReady]);

  // 打开设置
  const handleSettings = useCallback(() => {
    setGameState(GameState.SETTINGS);
  }, []);

  // 打开成就
  const handleAchievements = useCallback(() => {
    setGameState(GameState.ACHIEVEMENTS);
  }, []);

  // 打开商店
  const handleShop = useCallback(() => {
    setGameState(GameState.SHOP);
  }, []);

  // 打开排行榜
  const handleLeaderboard = useCallback(() => {
    setGameState(GameState.LEADERBOARD);
  }, []);

  // 打开好友
  const handleFriends = useCallback(() => {
    setGameState(GameState.FRIENDS);
  }, []);

  // 打开每日挑战面板
  const handleDailyChallenge = useCallback(() => {
    setGameState(GameState.DAILY_CHALLENGE);
  }, []);

  // 从每日挑战面板开始挑战
  const handleStartDailyChallenge = useCallback(() => {
    dailyChallengeManager.startDailyChallenge();
    resetGame();
    setSceneReady(false);
    setGameState(GameState.PLAYING);
  }, [resetGame, setSceneReady]);

  // 关闭设置
  const handleCloseSettings = useCallback(() => {
    if (gameState === GameState.SETTINGS) {
      setGameState(GameState.MENU);
    }
  }, [gameState]);

  // 返回主菜单
  const handleBackToMenu = useCallback(() => {
    // 若处于每日挑战模式中途退出，清理挑战状态
    if (dailyChallengeManager.isDailyChallengeActive()) {
      dailyChallengeManager.stopDailyChallenge();
    }
    setGameState(GameState.MENU);
    setSceneReady(false);
    setIsPaused(false);
  }, [setSceneReady]);

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

    const stats = gameplayManager.getStats();

    // 注：排行榜分数提交已迁移至 GameOver.tsx 内部的 useSubmitScore hook（Task 8）

    // 若处于每日挑战模式，提交挑战结果并退出挑战模式
    if (dailyChallengeManager.isDailyChallengeActive()) {
      const challengeConfig = dailyChallengeManager.getActiveChallenge();
      const victory = useGameStore.getState().isVictory;
      // 挑战完成判定：游戏胜利 或 达到目标波次
      const reachedTargetWaves =
        challengeConfig !== null && (stats?.wavesCompleted || 0) >= challengeConfig.targetWaves;
      dailyChallengeManager.submitResult(
        stats?.score || 0,
        stats?.wavesCompleted || 0,
        victory || reachedTargetWaves,
      );
      dailyChallengeManager.stopDailyChallenge();
    }
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

  // 从 GameplayManager 获取战斗详细统计
  const combatStats = useMemo(() => {
    return gameplayManager.getStats();
  }, []);

  // 从 GameplayManager 获取分数明细
  const scoreBreakdown = useMemo(() => {
    return gameplayManager.getScoreBreakdown();
  }, []);

  // 从 GameplayManager 获取排名
  const finalRank = useMemo(() => {
    return gameplayManager.getStats()?.rank || null;
  }, []);

  // 从 GameplayManager 获取本局解锁的成就
  const unlockedAchievements = useMemo(() => {
    const achievements = gameplayManager.getUnlockedAchievementsThisSession();
    return achievements.map((a) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
    }));
  }, []);

  // 统计数据
  const gameStats = useMemo(
    () => ({
      score: playerScore,
      highScore: parseInt(localStorage.getItem('highScore') || '0'),
      wave: currentWave,
      level: playerLevel,
      enemiesDefeated: enemiesDefeated,
      timeElapsed: combatStats?.playTime || 0,
      accuracy: combatStats?.accuracy || 0,
    }),
    [playerScore, currentWave, playerLevel, enemiesDefeated, combatStats],
  );

  // 暂停菜单统计
  const pauseStats = useMemo(
    () => ({
      score: playerScore,
      wave: currentWave,
      level: playerLevel,
      enemiesDefeated: enemiesDefeated,
      timeElapsed: 0,
    }),
    [playerScore, currentWave, playerLevel, enemiesDefeated],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-container">
        {/* 主菜单 */}
        {gameState === GameState.MENU && (
          <MainMenu
            onStartGame={handleStartGame}
            onContinueGame={hasSavedGame ? handleContinueGame : undefined}
            onSettings={handleSettings}
            onAchievements={handleAchievements}
            onShop={handleShop}
            onLeaderboard={handleLeaderboard}
            onFriends={handleFriends}
            onDailyChallenge={handleDailyChallenge}
            hasSavedGame={hasSavedGame}
          />
        )}

        {/* 关卡选择 */}
        {gameState === GameState.LEVEL_SELECT && (
          <Suspense fallback={<PageLoader />}>
            <LevelSelect
              onSelectLevel={handleSelectLevel}
              onBack={handleBackToMenu}
              currentPlayerLevel={playerLevel}
            />
          </Suspense>
        )}

        {/* 设置面板 */}
        {gameState === GameState.SETTINGS && (
          <Suspense fallback={<PageLoader />}>
            <Settings onClose={handleCloseSettings} />
          </Suspense>
        )}

        {/* 成就面板 */}
        {gameState === GameState.ACHIEVEMENTS && (
          <Suspense fallback={<PageLoader />}>
            <AchievementPanel onBack={handleBackToMenu} />
          </Suspense>
        )}

        {/* 商店面板 */}
        {gameState === GameState.SHOP && (
          <Suspense fallback={<PageLoader />}>
            <ShopPanel onBack={handleBackToMenu} />
          </Suspense>
        )}

        {/* 排行榜面板 */}
        {gameState === GameState.LEADERBOARD && (
          <Suspense fallback={<PageLoader />}>
            <LeaderboardPanel onBack={handleBackToMenu} />
          </Suspense>
        )}

        {/* 好友面板 */}
        {gameState === GameState.FRIENDS && (
          <Suspense fallback={<PageLoader />}>
            <FriendPanel onBack={handleBackToMenu} service={friendService} />
          </Suspense>
        )}

        {/* 每日挑战面板 */}
        {gameState === GameState.DAILY_CHALLENGE && (
          <Suspense fallback={<PageLoader />}>
            <DailyChallengePanel
              onBack={handleBackToMenu}
              onStartChallenge={handleStartDailyChallenge}
            />
          </Suspense>
        )}

        {/* 游戏场景 */}
        {gameState === GameState.PLAYING && (
          <>
            <Suspense fallback={<PageLoader />}>
              <GameScene onGameOver={handleGameOver} onLevelComplete={handleLevelComplete} />
            </Suspense>

            {/* 暂停菜单 */}
            {isPaused && (
              <Suspense fallback={<PageLoader />}>
                <PauseMenu
                  onResume={handleResume}
                  onRestart={handleRestart}
                  onSettings={handleSettings}
                  onMainMenu={handleBackToMenu}
                  currentStats={pauseStats}
                />
              </Suspense>
            )}
          </>
        )}

        {/* 游戏结束 */}
        {gameState === GameState.GAME_OVER && (
          <Suspense fallback={<PageLoader />}>
            <GameOver
              isVictory={isVictory}
              stats={gameStats}
              combatStats={combatStats}
              scoreBreakdown={scoreBreakdown}
              finalRank={finalRank || undefined}
              unlockedAchievements={unlockedAchievements}
              onRestart={handleRestart}
              onMainMenu={handleBackToMenu}
              onNextLevel={selectedLevel < 5 ? handleNextLevel : undefined}
              onLeaderboard={handleLeaderboard}
            />
          </Suspense>
        )}
      </div>
    </QueryClientProvider>
  );
}

export default App;
