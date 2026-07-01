import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/shadcn';
import { Card, CardContent, CardHeader } from './ui/shadcn';
import { Badge } from './ui/shadcn';
import { ArrowLeft, Lock, Star, Target, Zap, Medal, Trophy } from 'lucide-react';

export interface LevelData {
  id: number;
  name: string;
  description: string;
  difficulty: 'easy' | 'normal' | 'hard' | 'nightmare';
  recommendedLevel: number;
  stars: number;
  maxStars: number;
  unlocked: boolean;
  highScore?: number;
  enemies: number;
  waves: number;
}

interface LevelSelectProps {
  onSelectLevel: (levelId: number) => void;
  onBack: () => void;
  currentPlayerLevel?: number;
}

const defaultLevels: LevelData[] = [
  {
    id: 1,
    name: '新手训练',
    description: '学习基本操作，击败简单敌人',
    difficulty: 'easy',
    recommendedLevel: 1,
    stars: 0,
    maxStars: 3,
    unlocked: true,
    enemies: 20,
    waves: 5
  },
  {
    id: 2,
    name: '星际巡航',
    description: '穿越小行星带，遭遇巡逻队',
    difficulty: 'easy',
    recommendedLevel: 3,
    stars: 0,
    maxStars: 3,
    unlocked: false,
    enemies: 30,
    waves: 6
  },
  {
    id: 3,
    name: '陨石地带',
    description: '在密集陨石中作战，考验操控',
    difficulty: 'normal',
    recommendedLevel: 5,
    stars: 0,
    maxStars: 3,
    unlocked: false,
    enemies: 40,
    waves: 7
  },
  {
    id: 4,
    name: '敌舰基地',
    description: '突袭敌人基地，面对精英部队',
    difficulty: 'hard',
    recommendedLevel: 8,
    stars: 0,
    maxStars: 3,
    unlocked: false,
    enemies: 50,
    waves: 8
  },
  {
    id: 5,
    name: 'Boss战：星际帝王',
    description: '最终决战，击败星际帝王',
    difficulty: 'nightmare',
    recommendedLevel: 10,
    stars: 0,
    maxStars: 3,
    unlocked: false,
    enemies: 1,
    waves: 3
  }
];

const getDifficultyConfig = (difficulty: LevelData['difficulty']) => {
  switch (difficulty) {
    case 'easy': return { color: 'bg-green-500', label: '简单', textColor: 'text-green-400' };
    case 'normal': return { color: 'bg-blue-500', label: '普通', textColor: 'text-blue-400' };
    case 'hard': return { color: 'bg-red-500', label: '困难', textColor: 'text-red-400' };
    case 'nightmare': return { color: 'bg-purple-500', label: '噩梦', textColor: 'text-purple-400' };
  }
};

export const LevelSelect: React.FC<LevelSelectProps> = ({
  onSelectLevel,
  onBack,
  currentPlayerLevel = 1
}) => {
  const { t } = useTranslation();
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [levels] = useState<LevelData[]>(() => {
    const saved = localStorage.getItem('levelProgress');
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        return defaultLevels.map(level => ({
          ...level,
          ...progress[level.id],
          unlocked: level.id === 1 || currentPlayerLevel >= level.recommendedLevel
        }));
      } catch {
        return defaultLevels;
      }
    }
    return defaultLevels.map(level => ({
      ...level,
      unlocked: level.id === 1 || currentPlayerLevel >= level.recommendedLevel
    }));
  });

  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          setSelectedLevel(prev => Math.max(1, prev - 1));
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          setSelectedLevel(prev => Math.min(levels.length, prev + 1));
          break;
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          setSelectedLevel(prev => Math.max(1, prev - 1));
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          setSelectedLevel(prev => Math.min(levels.length, prev + 1));
          break;
        case 'Enter':
        case 'Space':
          e.preventDefault();
          const level = levels.find(l => l.id === selectedLevel);
          if (level?.unlocked) {
            onSelectLevel(selectedLevel);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onBack();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [levels, selectedLevel, onSelectLevel, onBack]);

  useEffect(() => {
    setShowAnimation(true);
  }, []);

  const handleLevelClick = useCallback((levelId: number) => {
    setSelectedLevel(levelId);
    const level = levels.find(l => l.id === levelId);
    if (level?.unlocked) {
      onSelectLevel(levelId);
    }
  }, [levels, onSelectLevel]);

  const selectedLevelData = levels.find(l => l.id === selectedLevel);

  return (
    <div className={`min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 p-4 md:p-8 transition-opacity duration-1000 ${showAnimation ? 'opacity-100' : 'opacity-0'}`}>
      <Card className="max-w-6xl mx-auto bg-slate-900/80 backdrop-blur-xl border-indigo-500/30 shadow-2xl shadow-indigo-500/20">
        <CardHeader className="flex items-center justify-between pb-6">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </Button>
          <h2 className="text-2xl font-bold text-white">{t('levelSelect.title')}</h2>
          <div className="w-20" />
        </CardHeader>

        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
            {levels.map((level, index) => {
              const diffConfig = getDifficultyConfig(level.difficulty);
              const isSelected = selectedLevel === level.id;
              const isUnlocked = level.unlocked;

              return (
                <div
                  key={level.id}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                    isSelected
                      ? 'border-yellow-400 bg-yellow-400/10 shadow-lg shadow-yellow-400/20 scale-[1.02]'
                      : isUnlocked
                        ? 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                        : 'border-slate-800 bg-slate-900/50 opacity-60'
                  }`}
                  onClick={() => handleLevelClick(level.id)}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                      isUnlocked ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white' : 'bg-slate-700 text-slate-500'
                    }`}>
                      {isUnlocked ? level.id : <Lock className="w-5 h-5" />}
                    </div>
                    <Badge className={`${diffConfig.color} text-white`}>
                      {diffConfig.label}
                    </Badge>
                  </div>

                  <h3 className={`font-bold mb-1 ${isUnlocked ? 'text-white' : 'text-slate-500'}`}>
                    {level.name}
                  </h3>
                  <p className="text-slate-500 text-xs mb-3 line-clamp-2">
                    {level.description}
                  </p>

                  <div className="flex items-center justify-center gap-1">
                    {Array.from({ length: level.maxStars }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < level.stars ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700'}`}
                      />
                    ))}
                  </div>

                  {!isUnlocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 rounded-xl">
                      <Lock className="w-8 h-8 text-slate-500 mb-2" />
                      <span className="text-slate-500 text-xs">{t('levelSelect.requiresLevel', { level: level.recommendedLevel })}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedLevelData && (
            <div className="space-y-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-white">
                      {selectedLevelData.name}
                    </h3>
                    <Badge className={`${getDifficultyConfig(selectedLevelData.difficulty).color} text-white`}>
                      {getDifficultyConfig(selectedLevelData.difficulty).label}
                    </Badge>
                  </div>

                  <p className="text-slate-400 text-sm mb-4">
                    {selectedLevelData.description}
                  </p>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                      <Target className="w-5 h-5 text-red-400 mx-auto mb-1" />
                      <span className="text-white font-bold">{selectedLevelData.enemies}</span>
                      <p className="text-slate-500 text-xs">{t('levelSelect.enemies')}</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                      <Zap className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                      <span className="text-white font-bold">{selectedLevelData.waves}</span>
                      <p className="text-slate-500 text-xs">{t('levelSelect.waves')}</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                      <Medal className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                      <span className="text-white font-bold">{selectedLevelData.recommendedLevel}</span>
                      <p className="text-slate-500 text-xs">{t('levelSelect.recommendedLevel')}</p>
                    </div>
                  </div>

                  {selectedLevelData.highScore !== undefined && (
                    <div className="flex items-center gap-2 text-yellow-400 mb-4 bg-yellow-400/10 rounded-lg p-3">
                      <Trophy className="w-5 h-5" />
                      <span className="font-medium">{t('levelSelect.highScore')}: {selectedLevelData.highScore.toLocaleString()}</span>
                    </div>
                  )}

                  <Button
                    variant="default"
                    size="lg"
                    className="w-full"
                    disabled={!selectedLevelData.unlocked}
                    onClick={() => selectedLevelData.unlocked && onSelectLevel(selectedLevelData.id)}
                  >
                    {selectedLevelData.unlocked ? t('levelSelect.startChallenge') : t('levelSelect.locked')}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-slate-600 text-xs mt-6">
        {t('levelSelect.navigateHint')}
      </p>
    </div>
  );
};

export default LevelSelect;
