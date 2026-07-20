import React, { Suspense, lazy } from 'react';

const GameScene = lazy(() => import('./GameScene'));

interface GameSceneLazyProps {
  onGameOver: () => void;
  onLevelComplete?: () => void;
}

export const GameSceneLazy: React.FC<GameSceneLazyProps> = ({ onGameOver, onLevelComplete }) => {
  return (
    <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/80">
      <div className="text-white text-lg">Loading game engine...</div>
    </div>}>
      <GameScene onGameOver={onGameOver} onLevelComplete={onLevelComplete} />
    </Suspense>
  );
};

export default GameSceneLazy;
