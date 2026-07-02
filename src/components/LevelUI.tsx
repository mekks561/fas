import React, { useEffect, useState, useCallback } from 'react';
import { LevelState, LevelStats } from '../LevelSystem';

interface LevelUIProps {
  levelName: string;
  currentWave: number;
  totalWaves: number;
  levelState: LevelState;
  enemiesRemaining: number;
  announcement: string;
  isBossActive: boolean;
  bossHealth?: number;
  bossMaxHealth?: number;
  bossName?: string;
  activeEffects?: { type: string; remainingTime: number; value: number }[];
}

export const LevelUI: React.FC<LevelUIProps> = ({
  levelName,
  currentWave,
  totalWaves,
  levelState,
  enemiesRemaining,
  announcement,
  isBossActive,
  bossHealth = 0,
  bossMaxHealth = 0,
  bossName = 'Boss',
  activeEffects = [],
}) => {
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');

  useEffect(() => {
    if (announcement) {
      setAnnouncementText(announcement);
      setShowAnnouncement(true);

      const timer = setTimeout(() => {
        setShowAnnouncement(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [announcement]);

  const getLevelStateText = useCallback((state: LevelState): string => {
    switch (state) {
      case LevelState.LOADING:
        return 'Loading...';
      case LevelState.PLAYING:
        return 'Playing';
      case LevelState.WAVE_INCOMING:
        return 'Wave Incoming';
      case LevelState.WAVE_ACTIVE:
        return 'Wave Active';
      case LevelState.WAVE_COMPLETE:
        return 'Wave Complete';
      case LevelState.BOSS_APPROACHING:
        return 'Boss Approaching';
      case LevelState.BOSS_FIGHT:
        return 'Boss Fight';
      case LevelState.LEVEL_COMPLETE:
        return 'Level Complete!';
      case LevelState.GAME_OVER:
        return 'Game Over';
      case LevelState.PAUSED:
        return 'Paused';
      default:
        return '';
    }
  }, []);

  const getStateColor = useCallback((state: LevelState): string => {
    switch (state) {
      case LevelState.BOSS_APPROACHING:
      case LevelState.BOSS_FIGHT:
        return 'text-red-500';
      case LevelState.LEVEL_COMPLETE:
        return 'text-green-500';
      case LevelState.GAME_OVER:
        return 'text-red-700';
      case LevelState.PAUSED:
        return 'text-yellow-500';
      default:
        return 'text-white';
    }
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Level Info - Top Left */}
      <div className="absolute top-4 left-4 bg-black/60 rounded-lg p-4">
        <div className="text-white text-lg font-bold">{levelName}</div>
        <div className="text-gray-300 text-sm">
          Wave {currentWave} / {totalWaves}
        </div>
        <div className={`text-sm font-semibold mt-1 ${getStateColor(levelState)}`}>
          {getLevelStateText(levelState)}
        </div>
      </div>

      {/* Enemy Counter - Top Right */}
      <div className="absolute top-4 right-4 bg-black/60 rounded-lg p-4">
        <div className="text-gray-300 text-sm">Enemies Remaining</div>
        <div className="text-white text-2xl font-bold">{enemiesRemaining}</div>
      </div>

      {/* Wave Announcement - Center */}
      {showAnnouncement && (
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="bg-black/80 rounded-xl px-8 py-4 border-2 border-yellow-500">
            <div className="text-yellow-500 text-3xl font-bold text-center animate-pulse">
              {announcementText}
            </div>
          </div>
        </div>
      )}

      {/* Boss Health Bar - Top Center */}
      {isBossActive && bossMaxHealth > 0 && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-96">
          <div className="bg-black/80 rounded-lg p-3 border-2 border-red-600">
            <div className="text-red-500 text-lg font-bold text-center mb-2">{bossName}</div>
            <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-700 to-red-500 transition-all duration-300"
                style={{ width: `${(bossHealth / bossMaxHealth) * 100}%` }}
              />
            </div>
            <div className="text-white text-sm text-center mt-1">
              {Math.ceil(bossHealth)} / {bossMaxHealth}
            </div>
          </div>
        </div>
      )}

      {/* Active Effects - Bottom Left */}
      {activeEffects.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-black/60 rounded-lg p-4">
          <div className="text-gray-300 text-sm mb-2">Active Effects</div>
          <div className="space-y-2">
            {activeEffects.map((effect, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-20 bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${effect.remainingTime}%` }}
                  />
                </div>
                <div className="text-white text-xs">
                  {effect.type} (+{Math.round(effect.value * 100)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini Map Indicator - Bottom Right */}
      <div className="absolute bottom-4 right-4 bg-black/60 rounded-lg p-3">
        <div className="text-gray-300 text-xs mb-2">Level Progress</div>
        <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
            style={{ width: `${(currentWave / totalWaves) * 100}%` }}
          />
        </div>
        <div className="text-white text-xs mt-1">
          {Math.round((currentWave / totalWaves) * 100)}% Complete
        </div>
      </div>
    </div>
  );
};

interface LevelCompleteScreenProps {
  stats: LevelStats;
  score: number;
  onContinue: () => void;
}

export const LevelCompleteScreen: React.FC<LevelCompleteScreenProps> = ({
  stats,
  score,
  onContinue,
}) => {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
      <div
        className={`text-center transition-all duration-1000 ${showContent ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-10'}`}
      >
        <div className="text-green-500 text-5xl font-bold mb-4">LEVEL COMPLETE!</div>

        <div className="text-white text-2xl mb-8">{stats.levelName}</div>

        <div className="bg-black/60 rounded-xl p-6 mb-8 inline-block">
          <div className="grid grid-cols-2 gap-6 text-left">
            <div>
              <div className="text-gray-400 text-sm">Waves Completed</div>
              <div className="text-white text-xl font-bold">{stats.wavesCompleted}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Total Kills</div>
              <div className="text-white text-xl font-bold">{stats.totalKills}</div>
            </div>
            <div className="col-span-2">
              <div className="text-gray-400 text-sm">Score Earned</div>
              <div className="text-yellow-500 text-2xl font-bold">{score.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <button
          onClick={onContinue}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition-colors pointer-events-auto"
        >
          Continue to Next Level
        </button>
      </div>
    </div>
  );
};

interface GameOverScreenProps {
  levelName: string;
  wavesCompleted: number;
  totalKills: number;
  onRetry: () => void;
  onMainMenu: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  levelName,
  wavesCompleted,
  totalKills,
  onRetry,
  onMainMenu,
}) => {
  return (
    <div className="absolute inset-0 bg-black/90 flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-600 text-6xl font-bold mb-4">GAME OVER</div>

        <div className="text-gray-400 text-xl mb-8">{levelName}</div>

        <div className="bg-black/60 rounded-xl p-6 mb-8">
          <div className="grid grid-cols-2 gap-6 text-left">
            <div>
              <div className="text-gray-400 text-sm">Waves Survived</div>
              <div className="text-white text-xl font-bold">{wavesCompleted}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Enemies Destroyed</div>
              <div className="text-white text-xl font-bold">{totalKills}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={onRetry}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition-colors pointer-events-auto"
          >
            Retry Level
          </button>
          <button
            onClick={onMainMenu}
            className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition-colors pointer-events-auto"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};

interface WaveAnnouncementProps {
  waveNumber: number;
  enemyCount: number;
  isBoss?: boolean;
}

export const WaveAnnouncement: React.FC<WaveAnnouncementProps> = ({
  waveNumber,
  enemyCount,
  isBoss = false,
}) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className={`rounded-2xl px-12 py-8 border-4 ${
          isBoss ? 'bg-red-900/90 border-red-500' : 'bg-blue-900/90 border-blue-500'
        } animate-announcement`}
      >
        <div
          className={`text-4xl font-bold text-center ${isBoss ? 'text-red-400' : 'text-blue-400'}`}
        >
          {isBoss ? '⚠ BOSS WAVE ⚠' : `WAVE ${waveNumber}`}
        </div>
        {!isBoss && (
          <div className="text-white text-xl text-center mt-2">{enemyCount} Enemies Incoming</div>
        )}
      </div>
    </div>
  );
};
