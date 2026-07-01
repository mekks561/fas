import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from './ui/shadcn';
import { Card, CardContent, CardFooter } from './ui/shadcn';
import { Badge } from './ui/shadcn';
import { Play, ArrowRight, Settings, Star, Trophy, Medal } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useTranslation } from 'react-i18next';

interface MainMenuProps {
  onStartGame: () => void;
  onContinueGame?: () => void;
  onSettings: () => void;
  onCredits?: () => void;
  hasSavedGame?: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartGame,
  onContinueGame,
  onSettings,
  onCredits,
  hasSavedGame = false
}) => {
  const [selectedOption, setSelectedOption] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false);
  
  const playerScore = useGameStore((state) => state.player.score);
  const playerLevel = useGameStore((state) => state.player.level);
  const { t } = useTranslation();

  const menuOptions = useMemo(() => [
    { id: 'start', label: t('menu.startGame'), icon: Play, action: onStartGame, primary: true },
    ...(hasSavedGame ? [{ id: 'continue', label: t('menu.continueGame'), icon: ArrowRight, action: onContinueGame }] : []),
    { id: 'settings', label: t('menu.settings'), icon: Settings, action: onSettings },
    ...(onCredits ? [{ id: 'credits', label: t('menu.credits'), icon: Star, action: onCredits }] : []),
  ], [hasSavedGame, onStartGame, onContinueGame, onSettings, onCredits, t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          setSelectedOption(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
        case 'KeyS':
          setSelectedOption(prev => Math.min(menuOptions.length - 1, prev + 1));
          break;
        case 'Enter':
        case 'Space':
          e.preventDefault();
          menuOptions[selectedOption]?.action?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOptions, selectedOption]);

  useEffect(() => {
    setShowAnimation(true);
  }, []);

  const handleClick = useCallback((index: number, action?: () => void) => {
    setSelectedOption(index);
    if (action) {
      setTimeout(action, 100);
    }
  }, []);

  const renderStars = useMemo(() => {
    const stars = [];
    for (let i = 0; i < 50; i++) {
      const style = {
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 3}s`,
        animationDuration: `${2 + Math.random() * 3}s`
      };
      stars.push(
        <div key={i} className="absolute w-1 h-1 bg-white rounded-full opacity-60 animate-pulse" style={style} />
      );
    }
    return stars;
  }, []);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 relative overflow-hidden transition-opacity duration-1000 ${showAnimation ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 overflow-hidden">
        {renderStars}
      </div>

      <Card className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border-purple-500/30 shadow-2xl shadow-purple-500/20 relative z-10">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-lg">
              SPACE FIGHTER
            </h1>
            <p className="text-slate-400 text-sm md:text-base">
              3A Quality Space Combat Game
            </p>
            
            {hasSavedGame && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Badge variant="outline" className="border-purple-500 text-purple-300">
                  {t('menu.currentProgress')}: Level {playerLevel}
                </Badge>
                <Badge variant="outline" className="border-yellow-500 text-yellow-300">
                  {t('menu.score')}: {playerScore.toLocaleString()}
                </Badge>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {menuOptions.map((option, index) => {
              const IconComponent = option.icon;
              return (
                <div
                  key={option.id}
                  className={`relative ${selectedOption === index ? 'scale-[1.02]' : ''} transition-transform duration-200`}
                  onClick={() => handleClick(index, option.action)}
                  onMouseEnter={() => setSelectedOption(index)}
                >
                  <Button
                    variant={option.primary ? 'default' : 'outline'}
                    size="lg"
                    className={`w-full h-14 text-base font-semibold transition-all duration-200 ${
                      selectedOption === index 
                        ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900' 
                        : ''
                    } ${option.primary ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500' : ''}`}
                    onClick={() => option.action?.()}
                  >
                    <IconComponent className="w-5 h-5" />
                    {option.label}
                  </Button>
                  
                  {selectedOption === index && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2">
                      <ArrowRight className="w-5 h-5 text-yellow-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-center gap-4 pt-0">
          <p className="text-slate-500 text-xs">
            {t('menu.navigateHint')}
          </p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-yellow-400">
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-medium">{t('menu.best')}: {playerScore.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-purple-400">
              <Medal className="w-4 h-4" />
              <span className="text-xs font-medium">Level: {playerLevel}</span>
            </div>
          </div>
          <p className="text-slate-600 text-xs mt-2">
            {t('common.version')} | PlayCanvas Engine
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default MainMenu;