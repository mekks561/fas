import React, { useEffect, useState, useCallback } from 'react';
import { Card, Progress, Button } from './ui/shadcn';

export enum LevelState {
  LOADING = 'loading',
  PLAYING = 'playing',
  WAVE_INCOMING = 'wave_incoming',
  WAVE_ACTIVE = 'wave_active',
  WAVE_COMPLETE = 'wave_complete',
  BOSS_APPROACHING = 'boss_approaching',
  BOSS_FIGHT = 'boss_fight',
  LEVEL_COMPLETE = 'level_complete',
  GAME_OVER = 'game_over',
  PAUSED = 'paused',
}

export interface LevelStats {
  levelName: string;
  wavesCompleted: number;
  totalKills: number;
}

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
      const initTimer = setTimeout(() => {
        setAnnouncementText(announcement);
        setShowAnnouncement(true);
      }, 0);

      const timer = setTimeout(() => {
        setShowAnnouncement(false);
      }, 2000);

      return () => {
        clearTimeout(initTimer);
        clearTimeout(timer);
      };
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

  const waveProgress = (currentWave / totalWaves) * 100;
  const bossProgress = bossMaxHealth > 0 ? (bossHealth / bossMaxHealth) * 100 : 0;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <Card className="absolute top-4 left-4 bg-black/60 border-gray-700 pointer-events-auto">
        <div className="text-white text-lg font-bold">{levelName}</div>
        <div className="text-gray-300 text-sm mt-1">
          Wave {currentWave} / {totalWaves}
        </div>
        <div className={`text-sm font-semibold mt-2 ${getStateColor(levelState)}`}>
          {getLevelStateText(levelState)}
        </div>
      </Card>

      <Card className="absolute top-4 right-4 bg-black/60 border-gray-700 pointer-events-auto">
        <div className="text-gray-300 text-sm">Enemies Remaining</div>
        <div className="text-white text-2xl font-bold mt-1">{enemiesRemaining}</div>
      </Card>

      {showAnnouncement && (
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <Card className="bg-black/80 border-yellow-500 px-8 py-4">
            <div className="text-yellow-500 text-3xl font-bold text-center animate-pulse">
              {announcementText}
            </div>
          </Card>
        </div>
      )}

      {isBossActive && bossMaxHealth > 0 && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-96 pointer-events-auto">
          <Card className="bg-black/80 border-red-600">
            <div className="text-red-500 text-lg font-bold text-center">{bossName}</div>
            <Progress
              value={bossProgress}
              className="h-4 mt-2"
              style={{ '--progress-color': '#ef4444' } as React.CSSProperties}
            />
            <div className="text-white text-sm text-center mt-1">
              {Math.ceil(bossHealth)} / {bossMaxHealth}
            </div>
          </Card>
        </div>
      )}

      {activeEffects.length > 0 && (
        <Card className="absolute bottom-4 left-4 bg-black/60 border-gray-700 pointer-events-auto">
          <div className="text-gray-300 text-sm mb-2">Active Effects</div>
          <div className="space-y-2">
            {activeEffects.map((effect) => (
              <div key={effect.type} className="flex items-center gap-2">
                <Progress
                  value={effect.remainingTime}
                  className="w-20 h-2"
                  style={{ '--progress-color': '#3b82f6' } as React.CSSProperties}
                />
                <div className="text-white text-xs">
                  {effect.type} (+{Math.round(effect.value * 100)}%)
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="absolute bottom-4 right-4 bg-black/60 border-gray-700 pointer-events-auto">
        <div className="text-gray-300 text-xs mb-2">Level Progress</div>
        <Progress
          value={waveProgress}
          className="w-32 h-2"
          style={{ '--progress-color': '#3b82f6' } as React.CSSProperties}
        />
        <div className="text-white text-xs mt-1">{Math.round(waveProgress)}% Complete</div>
      </Card>
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
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-auto">
      <div
        className={`text-center transition-all duration-1000 ${
          showContent ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-10'
        }`}
      >
        <div className="text-green-500 text-5xl font-bold mb-4">LEVEL COMPLETE!</div>

        <div className="text-white text-2xl mb-8">{stats.levelName}</div>

        <Card className="bg-black/60 border-gray-700 p-6 inline-block mb-8">
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
        </Card>

        <Button onClick={onContinue} size="lg">
          Continue to Next Level
        </Button>
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
    <div className="absolute inset-0 bg-black/90 flex items-center justify-center pointer-events-auto">
      <div className="text-center">
        <div className="text-red-600 text-6xl font-bold mb-4">GAME OVER</div>

        <div className="text-gray-400 text-xl mb-8">{levelName}</div>

        <Card className="bg-black/60 border-gray-700 p-6 mb-8">
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
        </Card>

        <div className="flex gap-4 justify-center">
          <Button onClick={onRetry} size="lg">
            Retry Level
          </Button>
          <Button onClick={onMainMenu} size="lg" variant="outline">
            Main Menu
          </Button>
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
      <Card
        className={`px-12 py-8 border-4 ${
          isBoss ? 'bg-red-900/90 border-red-500' : 'bg-blue-900/90 border-blue-500'
        }`}
      >
        <div
          className={`text-4xl font-bold text-center ${
            isBoss ? 'text-red-400' : 'text-blue-400'
          }`}
        >
          {isBoss ? '⚠ BOSS WAVE ⚠' : `WAVE ${waveNumber}`}
        </div>
        {!isBoss && (
          <div className="text-white text-xl text-center mt-2">{enemyCount} Enemies Incoming</div>
        )}
      </Card>
    </div>
  );
};
