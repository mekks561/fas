/**
 * App 主组件
 * 管理游戏的整体UI状态
 */

import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MainMenu } from './components/MainMenu';
import { useGameStore } from './store/useGameStore';
import { GameState } from './game/GameStateMachine';
import { getAllLevels } from './levels';
import { markLevelCleared } from './engine/LevelProgress';
import { FriendService } from './engine/FriendService';
import { gameplayManager } from './engine/GameplayManager';
import { dailyChallengeManager } from './engine/DailyChallengeManager';
import { globalAudio } from './engine/GlobalAudio';
import { skillTreeManager } from './engine/SkillTreeManager';
import { survivalModeManager } from './engine/SurvivalModeManager';
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
const SkillTreeUI = lazy(() =>
  import('./components/SkillTreeUI').then((m) => ({ default: m.SkillTreeUI })),
);
const SurvivalModeUI = lazy(() =>
  import('./components/SurvivalModeUI').then((m) => ({ default: m.SurvivalModeUI })),
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
  // 起始关卡：支持 ?level=N 深链（1 基，用于调试与自动化验证直达指定关；
  // 越界或非法值回落第 1 关）。
  const [selectedLevel, setSelectedLevel] = useState<number>(() => {
    const raw = new URLSearchParams(window.location.search).get('level');
    const n = raw ? Number.parseInt(raw, 10) : 1;
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(n, getAllLevels().length);
  });
  const [isPaused, setIsPaused] = useState(false);
  /**
   * 当前这一局是「战役关卡」还是「生存模式」。
   *
   * 两者共用 GameScene 这条战斗管线，差别只在：波次是否无尽、阵亡后回到哪个界面。
   * 真源放在 App（而不是 GameScene 内部状态），因为「阵亡后去哪」是 App 的路由决策。
   */
  const [runMode, setRunMode] = useState<'campaign' | 'survival'>('campaign');

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

  // 音乐随界面切换。走 globalAudio（独立于 GameScene 的音频通道）：
  // 若挂在 GameScene 上，结算/返回菜单时组件卸载会把声音一起销毁，
  // 导致「胜利音乐」「主菜单音乐」实际听不到。
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      globalAudio.playMusic('game');
    } else if (gameState === GameState.GAME_OVER) {
      globalAudio.playMusic(isVictory ? 'victory' : 'defeat');
    } else {
      // MENU / LEVEL_SELECT / SETTINGS / 各面板
      globalAudio.playMusic('menu');
    }
  }, [gameState, isVictory]);

  // 技能树与玩家等级同步。
  //
  // `player.level` 是**跨局累积的元进度**（resetGame 会保留它），而
  // SkillTreeManager 自带一套 localStorage 持久化。两者必须对齐，否则会出现
  // 「等级涨了但天赋点没涨」。这里把 store 定为唯一真源：等级一变就同步过去。
  //
  // setPlayerLevel 内部按**差值**发点（level - oldLevel），所以重复同步同一
  // 等级不会重复发点；首次运行时 store 里是持久化等级、manager 里还是初始 1 级，
  // 也能一次性把该有的点数补齐。
  useEffect(() => {
    skillTreeManager.setPlayerLevel(playerLevel);
  }, [playerLevel]);

  // 开始新游戏 - 打开关卡选择
  const handleStartGame = useCallback(() => {
    setGameState(GameState.LEVEL_SELECT);
  }, []);

  // 选择关卡后开始游戏
  const handleSelectLevel = useCallback(
    (levelId: number) => {
      setSelectedLevel(levelId);
      setRunMode('campaign');
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

  // 打开技能树
  const handleSkillTree = useCallback(() => {
    setGameState(GameState.SKILL_TREE);
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

  // 打开生存模式面板
  const handleSurvival = useCallback(() => {
    setGameState(GameState.SURVIVAL);
  }, []);

  // 生存模式：开始一局。
  // startGame()（进入 preparing 倒计时）由面板内部的「开始」按钮调用，
  // 这里只负责切路由与清理上一局残留。
  const handleSurvivalStart = useCallback(() => {
    setRunMode('survival');
    resetGame();
    setSceneReady(false);
    setGameState(GameState.PLAYING);
  }, [resetGame, setSceneReady]);

  // 生存模式：返回主菜单（结束会话，把状态机复位回 menu）
  const handleSurvivalBack = useCallback(() => {
    survivalModeManager.stopGame();
    setRunMode('campaign');
    setGameState(GameState.MENU);
    setSceneReady(false);
  }, [setSceneReady]);

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
    // 之前这里没有切回 PLAYING：在结算界面点「重新开始」时 gameState 仍是 GAME_OVER，
    // 界面不会变、GameScene 也不会重新挂载 —— 按钮等于没反应。
    setGameState(GameState.PLAYING);
  }, [resetGame, setSceneReady]);

  // 游戏结束
  const handleGameOver = useCallback(() => {
    setIsPaused(false);

    // 生存模式阵亡：回到生存模式面板，由它的 gameOver 界面负责结算与最高分榜
    // （不走战役结算界面 GameOver.tsx）。生存状态机已经在 GameScene 检测到
    // 玩家阵亡时切到 gameOver。
    if (runMode === 'survival') {
      setGameState(GameState.SURVIVAL);
      return;
    }

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
  }, [runMode]);

  // 关卡完成
  const handleLevelComplete = useCallback(() => {
    // 记录通关与星级（localStorage 的 levelProgress 此前只读不写，
    // 导致星星恒为 0、下一关没有解锁依据）。
    // 星级按通关时剩余生命比例评定（惯例·可改）：>=80% 三星、>=40% 两星、否则一星。
    const { health, maxHealth } = useGameStore.getState().player;
    const ratio = maxHealth > 0 ? health / maxHealth : 1;
    const stars = ratio >= 0.8 ? 3 : ratio >= 0.4 ? 2 : 1;
    const record = markLevelCleared(selectedLevel, stars);
    console.log(
      `[App] 关卡 ${selectedLevel} 通关：${stars} 星（剩余生命 ${Math.round(ratio * 100)}%），最佳 ${record.stars} 星`,
    );

    setIsPaused(false);
    setVictory(true);
    setGameState(GameState.GAME_OVER);
  }, [setVictory, selectedLevel]);

  // 下一关
  const handleNextLevel = useCallback(() => {
    const nextLevel = Math.min(selectedLevel + 1, getAllLevels().length);
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
            onSkillTree={handleSkillTree}
            onSurvival={handleSurvival}
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
              initialLevel={selectedLevel}
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

        {/* 技能树面板 */}
        {gameState === GameState.SKILL_TREE && (
          <Suspense fallback={<PageLoader />}>
            <SkillTreeUI onBack={handleBackToMenu} />
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
              <GameScene
                mode={runMode}
                levelIndex={selectedLevel - 1}
                onGameOver={handleGameOver}
                onLevelComplete={handleLevelComplete}
              />
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

        {/* 生存模式面板：菜单态与战斗态都常驻。
            战斗时它渲染 HUD 覆盖层（波次/分数/时间），必须排在 GameScene 之后
            才能盖在 canvas 之上；阵亡后由它的 gameOver 分支显示结算与最高分榜。 */}
        {(gameState === GameState.SURVIVAL ||
          (gameState === GameState.PLAYING && runMode === 'survival')) && (
          <Suspense fallback={<PageLoader />}>
            <SurvivalModeUI onStartGame={handleSurvivalStart} onBackToMenu={handleSurvivalBack} />
          </Suspense>
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
              onNextLevel={selectedLevel < getAllLevels().length ? handleNextLevel : undefined}
              onLeaderboard={handleLeaderboard}
            />
          </Suspense>
        )}
      </div>
    </QueryClientProvider>
  );
}

export default App;
