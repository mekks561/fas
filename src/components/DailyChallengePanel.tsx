/**
 * 每日挑战面板
 * 展示当日挑战配置（修饰器、倍率、目标）和历史记录，提供开始挑战按钮
 */

import React, { useMemo } from 'react';
import { Button } from './ui/shadcn';
import { Card, CardContent, CardHeader, CardTitle } from './ui/shadcn';
import { ArrowLeft, Play, Calendar, Trophy, Flame, Target, Zap } from 'lucide-react';
import {
  dailyChallengeManager,
  type DailyChallengeConfig,
  type DailyChallengeRecord,
} from '../engine/DailyChallengeManager';

interface DailyChallengePanelProps {
  onBack: () => void;
  onStartChallenge: () => void;
}

const difficultyLabels: Record<string, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
};

const difficultyColors: Record<string, string> = {
  easy: 'text-green-400',
  normal: 'text-blue-400',
  hard: 'text-red-400',
};

export const DailyChallengePanel: React.FC<DailyChallengePanelProps> = ({ onBack, onStartChallenge }) => {
  const challenge: DailyChallengeConfig = useMemo(
    () => dailyChallengeManager.getTodayChallenge(),
    [],
  );

  const todayRecord: DailyChallengeRecord = useMemo(
    () => dailyChallengeManager.getTodayRecord(),
    [],
  );

  const recentRecords: DailyChallengeRecord[] = useMemo(
    () => dailyChallengeManager.getRecentRecords(7),
    [],
  );

  const handleStart = () => {
    dailyChallengeManager.startDailyChallenge();
    onStartChallenge();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 顶栏 */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Calendar className="w-7 h-7 text-amber-400" />
            每日挑战
          </h1>
          <span className="text-sm text-slate-400 ml-auto">{challenge.date}</span>
        </div>

        {/* 今日挑战卡片 */}
        <Card className="bg-slate-900/80 border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-300">
              <Flame className="w-5 h-5" />
              今日挑战
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 基础信息 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-400 mb-1">基础难度</div>
                <div className={`text-lg font-bold ${difficultyColors[challenge.baseDifficulty]}`}>
                  {difficultyLabels[challenge.baseDifficulty]}
                </div>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-400 mb-1">目标波次</div>
                <div className="text-lg font-bold text-cyan-300">{challenge.targetWaves}</div>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-400 mb-1">分数倍率</div>
                <div className="text-lg font-bold text-amber-300">×{challenge.totalScoreMultiplier.toFixed(2)}</div>
              </div>
            </div>

            {/* 修饰器列表 */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-300 flex items-center gap-1">
                <Zap className="w-4 h-4 text-amber-400" />
                挑战修饰器（{challenge.modifiers.length}）
              </div>
              {challenge.modifiers.map((m) => (
                <div
                  key={m.type}
                  className="flex items-start gap-3 bg-slate-800/50 border border-slate-700 rounded-lg p-3"
                >
                  <span className="text-2xl flex-shrink-0">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{m.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                        ×{m.scoreMultiplier.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{m.description}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 今日记录 */}
            <div className="bg-slate-800/40 rounded-lg p-3">
              <div className="text-sm font-semibold text-slate-300 flex items-center gap-1 mb-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                今日记录
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div>
                  <div className="text-slate-400 text-xs">最佳分数</div>
                  <div className="font-bold text-yellow-300">{todayRecord.bestScore.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs">最佳波次</div>
                  <div className="font-bold text-cyan-300">{todayRecord.bestWave}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs">已通关</div>
                  <div className={`font-bold ${todayRecord.completed ? 'text-green-400' : 'text-slate-500'}`}>
                    {todayRecord.completed ? '是' : '否'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs">尝试次数</div>
                  <div className="font-bold text-slate-200">{todayRecord.attempts}</div>
                </div>
              </div>
            </div>

            {/* 开始按钮 */}
            <Button
              className="w-full bg-amber-600 hover:bg-amber-500 text-white text-lg py-6"
              onClick={handleStart}
            >
              <Play className="w-5 h-5 mr-2" />
              {todayRecord.attempts > 0 ? '再次挑战' : '开始挑战'}
            </Button>
          </CardContent>
        </Card>

        {/* 最近 7 天历史 */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-slate-300">
              <Target className="w-4 h-4 text-slate-400" />
              最近 7 天
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {recentRecords.map((r) => {
                const isToday = r.date === challenge.date;
                return (
                  <div
                    key={r.date}
                    className={`grid grid-cols-5 gap-2 items-center px-3 py-2 rounded text-sm ${
                      isToday ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/30'
                    }`}
                  >
                    <div className="text-slate-400 font-mono text-xs">
                      {r.date.slice(5)}
                      {isToday && <span className="ml-1 text-amber-400">•今日</span>}
                    </div>
                    <div className="text-right text-yellow-300 font-semibold">
                      {r.bestScore > 0 ? r.bestScore.toLocaleString() : '—'}
                    </div>
                    <div className="text-right text-cyan-300">{r.bestWave > 0 ? `W${r.bestWave}` : '—'}</div>
                    <div className="text-right">
                      {r.completed ? (
                        <span className="text-green-400 text-xs">已通关</span>
                      ) : r.attempts > 0 ? (
                        <span className="text-slate-500 text-xs">未通关</span>
                      ) : (
                        <span className="text-slate-600 text-xs">未参与</span>
                      )}
                    </div>
                    <div className="text-right text-slate-500 text-xs">{r.attempts > 0 ? `${r.attempts}次` : '—'}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-slate-500">
          每日挑战全球同步，所有玩家面对相同的挑战条件。种子 #{challenge.seed}
        </div>
      </div>
    </div>
  );
};

export default DailyChallengePanel;
