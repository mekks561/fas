import React, { useState } from 'react';
import { GameScene } from './GameScene';
import { Button } from './ui/shadcn';
import { Card, CardHeader, CardTitle, CardContent } from './ui/shadcn';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const { t } = useTranslation();

  const handleStartGame = () => {
    setGameStarted(true);
  };

  return (
    <div className="w-screen h-screen m-0 p-0 overflow-hidden bg-black font-sans">
      {!gameStarted ? (
        <div className="flex flex-col items-center justify-center w-full h-full bg-[radial-gradient(circle,#1a1a2e_0%,#16213e_50%,#0f3460_100%)] text-white text-center">
          <h1 className="text-5xl mb-8 text-cyan-400 drop-shadow-[0_0_20px_rgba(0,212,255,0.5)]">{t('app.title')}</h1>
          <Button
            onClick={handleStartGame}
            size="lg"
            className="text-lg bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-500 hover:to-blue-700 shadow-lg shadow-cyan-500/30 text-white"
          >
            <Play />
            {t('app.start')}
          </Button>
          <Card className="mt-12 bg-black/50 border-cyan-500/20 max-w-md text-left">
            <CardHeader>
              <CardTitle className="text-cyan-400">{t('app.instructions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-gray-300">
              <p>{t('app.moveControls')}</p>
              <p>{t('app.mouseControls')}</p>
              <p>{t('app.fireControls')}</p>
              <p>{t('app.boostControls')}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <GameScene />
      )}
    </div>
  );
};
