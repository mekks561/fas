import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { survivalModeManager, SurvivalModeState } from '../engine/SurvivalModeManager';
import './SurvivalModeUI.css';

interface SurvivalModeUIProps {
  onStartGame: () => void;
  onBackToMenu: () => void;
}

export const SurvivalModeUI: React.FC<SurvivalModeUIProps> = React.memo(
  ({ onStartGame, onBackToMenu }) => {
    const { t } = useTranslation();
    const [state, setState] = useState<SurvivalModeState>('menu');
    const [stats, setStats] = useState(survivalModeManager.getStats());
    const [waveConfig, setWaveConfig] = useState(survivalModeManager.getCurrentWaveConfig());
    const [highScores, setHighScores] = useState(survivalModeManager.getHighScores());
    const [preparingTimer, setPreparingTimer] = useState(0);
    const [transitionTimer, setTransitionTimer] = useState(0);
    const [showNameInput, setShowNameInput] = useState(false);
    const [playerName, setPlayerName] = useState('');

    const updateState = useCallback(() => {
      setState(survivalModeManager.getState());
      setStats(survivalModeManager.getStats());
      setWaveConfig(survivalModeManager.getCurrentWaveConfig());
      setHighScores(survivalModeManager.getHighScores());
      setPreparingTimer(Math.ceil(survivalModeManager.getPreparingTimer()));
      setTransitionTimer(Math.ceil(survivalModeManager.getTransitionTimer()));
    }, []);

    useEffect(() => {
      const interval = setInterval(updateState, 100);
      return () => clearInterval(interval);
    }, [updateState]);

    const handleStartGame = () => {
      survivalModeManager.startGame();
      // 清掉上一局的结算残留（重开时不该还挂着名字输入框）
      setShowNameInput(false);
      setPlayerName('');
      onStartGame();
    };

    // 结算副作用：必须在组件顶层注册。
    //
    // 原实现把它写在 `if (state === 'gameOver')` 的分支体内 —— 那是**条件调用 Hook**，
    // 状态一切换 hook 调用数量就变，React 会抛
    // "Rendered more hooks than during the previous render" 并让整个面板崩溃。
    // 用 ref 保证同一局只处理一次，离开 gameOver 后复位以便重开。
    const gameOverHandledRef = useRef(false);
    useEffect(() => {
      if (state !== 'gameOver') {
        gameOverHandledRef.current = false;
        return;
      }
      if (!gameOverHandledRef.current) {
        gameOverHandledRef.current = true;
        if (survivalModeManager.isHighScore(survivalModeManager.getStats().score)) {
          setShowNameInput(true);
        }
      }
    }, [state]);

    const handleSubmitName = () => {
      survivalModeManager.addHighScore(playerName);
      setShowNameInput(false);
      setHighScores(survivalModeManager.getHighScores());
    };

    const handleBack = () => {
      survivalModeManager.stopGame();
      onBackToMenu();
    };

    if (state === 'menu') {
      return (
        <div className="survival-menu">
          <h2 className="survival-title">{t('survival.modeTitle')}</h2>
          <p className="survival-description">{t('survival.description')}</p>

          <div className="survival-stats-preview">
            <div className="stat-item">
              <span className="stat-label">{t('survival.highScore')}</span>
              <span className="stat-value">
                {survivalModeManager.formatScore(survivalModeManager.getHighScore())}
              </span>
            </div>
          </div>

          {highScores.length > 0 && (
            <div className="survival-leaderboard">
              <h3 className="leaderboard-title">{t('survival.leaderboard')}</h3>
              <div className="leaderboard-list">
                {highScores.slice(0, 5).map((score) => (
                  <div key={score.rank} className="leaderboard-item">
                    <span className={`rank-badge ${score.rank <= 3 ? `top-${score.rank}` : ''}`}>
                      {score.rank}
                    </span>
                    <span className="player-name">{score.name}</span>
                    <span className="player-score">
                      {survivalModeManager.formatScore(score.score)}
                    </span>
                    <span className="player-wave">
                      {t('survival.wave')} {score.wave}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="survival-start-btn" onClick={handleStartGame}>
            {t('survival.start')}
          </button>
          <button className="survival-back-btn" onClick={handleBack}>
            {t('survival.back')}
          </button>
        </div>
      );
    }

    if (state === 'preparing') {
      return (
        <div className="survival-preparing">
          <h2 className="preparing-title">{t('survival.preparing')}</h2>
          <div className="preparing-countdown">{preparingTimer}</div>
          <p className="preparing-wave">{t('survival.wave')} 1</p>
        </div>
      );
    }

    if (state === 'playing') {
      return (
        <div className="survival-hud">
          <div className="hud-left">
            <div className="wave-info">
              <span className="wave-label">{t('survival.wave')}</span>
              <span className="wave-number">{stats.currentWave}</span>
              {waveConfig?.isBossWave && (
                <span className="wave-badge boss-wave">{t('survival.bossWave')}</span>
              )}
              {waveConfig?.isEliteWave && !waveConfig.isBossWave && (
                <span className="wave-badge elite-wave">{t('survival.eliteWave')}</span>
              )}
            </div>
            <div className="wave-progress">
              <div
                className="progress-bar"
                style={{ width: `${survivalModeManager.getWaveProgress() * 100}%` }}
              />
            </div>
            <div className="enemies-count">
              <span className="remaining-label">
                {t('survival.remaining')}: {survivalModeManager.getRemainingEnemiesInWave()}
              </span>
            </div>
          </div>

          <div className="hud-center">
            <div className="survival-score">{survivalModeManager.formatScore(stats.score)}</div>
          </div>

          <div className="hud-right">
            <div className="survival-time">
              <span className="time-label">{t('survival.time')}</span>
              <span className="time-value">
                {survivalModeManager.formatTime(stats.survivalTime)}
              </span>
            </div>
            <div className="survival-stats">
              <div className="mini-stat">
                <span className="mini-label">{t('survival.kills')}</span>
                <span className="mini-value">{stats.enemiesDefeated}</span>
              </div>
              <div className="mini-stat">
                <span className="mini-label">{t('survival.combo')}</span>
                <span className="mini-value">{stats.maxCombo}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (state === 'waveTransition') {
      return (
        <div className="survival-transition">
          <h2 className="transition-title">{t('survival.waveComplete')}</h2>
          <p className="transition-wave">
            {t('survival.wave')} {stats.currentWave} {t('survival.completed')}
          </p>
          <p className="transition-reward">
            {t('survival.reward')}: +{survivalModeManager.formatScore(waveConfig?.rewardScore || 0)}
          </p>
          <div className="transition-countdown">{transitionTimer}</div>
          <p className="transition-next">
            {t('survival.nextWave')} {stats.currentWave + 1}
          </p>
        </div>
      );
    }

    if (state === 'gameOver') {
      return (
        <div className="survival-gameover">
          <h2 className="gameover-title">{t('survival.gameOver')}</h2>

          <div className="gameover-stats">
            <div className="gameover-stat">
              <span className="stat-label">{t('survival.finalScore')}</span>
              <span className="stat-value">{survivalModeManager.formatScore(stats.score)}</span>
            </div>
            <div className="gameover-stat">
              <span className="stat-label">{t('survival.wavesSurvived')}</span>
              <span className="stat-value">{stats.currentWave}</span>
            </div>
            <div className="gameover-stat">
              <span className="stat-label">{t('survival.survivalTime')}</span>
              <span className="stat-value">
                {survivalModeManager.formatTime(stats.survivalTime)}
              </span>
            </div>
            <div className="gameover-stat">
              <span className="stat-label">{t('survival.enemiesDefeated')}</span>
              <span className="stat-value">{stats.enemiesDefeated}</span>
            </div>
            <div className="gameover-stat">
              <span className="stat-label">{t('survival.maxCombo')}</span>
              <span className="stat-value">{stats.maxCombo}</span>
            </div>
          </div>

          {showNameInput ? (
            <div className="name-input-modal">
              <h3 className="modal-title">{t('survival.newHighScore')}</h3>
              <input
                type="text"
                className="name-input"
                placeholder={t('survival.enterName')}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={12}
              />
              <button className="submit-name-btn" onClick={handleSubmitName}>
                {t('survival.submit')}
              </button>
            </div>
          ) : (
            <>
              <button className="survival-restart-btn" onClick={handleStartGame}>
                {t('survival.playAgain')}
              </button>
              <button className="survival-back-btn" onClick={handleBack}>
                {t('survival.backToMenu')}
              </button>
            </>
          )}
        </div>
      );
    }

    return null;
  },
);

export default SurvivalModeUI;
