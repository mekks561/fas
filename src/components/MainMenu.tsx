import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/shadcn';
import {
  LucideGlobe,
  LucideBox,
  LucideZap,
  LucideSettings,
  LucideShield,
  LucideActivity,
  LucideTrendingUp,
  LucideTrophy,
  LucideUsers,
  LucideInfo,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { globalAudio } from '../engine/GlobalAudio';
import { useTranslation } from 'react-i18next';
import './MainMenu.css';

interface MainMenuProps {
  onStartGame: () => void;
  onContinueGame?: () => void;
  onSettings: () => void;
  onAchievements?: () => void;
  onShop?: () => void;
  onHangar?: () => void;
  onSkillTree?: () => void;
  onSurvival?: () => void;
  onLeaderboard?: () => void;
  onFriends?: () => void;
  onDailyChallenge?: () => void;
  hasSavedGame?: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartGame,
  onSettings,
  onAchievements,
  onShop,
  onHangar,
  onSkillTree,
  onSurvival,
  onLeaderboard,
}) => {
  const [showAnimation, setShowAnimation] = useState(false);
  useTranslation();

  const playerScore = useGameStore((state) => state.player.score);
  const playerLevel = useGameStore((state) => state.player.level);
  const galacticStatus = useGameStore((state) => state.galacticStatus);

  useEffect(() => {
    const timer = setTimeout(() => setShowAnimation(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleAction = (action?: () => void) => {
    globalAudio.playCue('uiClick');
    if (action) action();
  };

  const handleStartStrategic = () => {
    globalAudio.playCue('uiClick');
    onStartGame();
  };

  const getFactionName = (id: string) => {
    const names: Record<string, string> = {
      trade_union: '贸易联盟',
      scavengers: '拾荒者',
      imperial_guard: '帝国卫队',
      void_cult: '虚空教派',
      neutral: '中立势力',
    };
    return names[id] || id;
  };

  const getFactionColor = (id: string) => {
    const colors: Record<string, string> = {
      trade_union: 'blue',
      scavengers: 'orange',
      imperial_guard: 'red',
      void_cult: 'purple',
      neutral: 'gray',
    };
    return colors[id] || 'blue';
  };

  return (
    <div className={`command-center-root ${showAnimation ? 'active' : ''}`}>
      {/* 动态背景：扫描线与粒子 */}
      <div className="command-bg">
        <div className="scanline"></div>
        <div className="grid-overlay"></div>
      </div>

      {/* 顶部状态栏 */}
      <header className="command-header">
        <div className="header-left">
          <LucideActivity className="w-5 h-5 text-blue-400 animate-pulse" />
          <span className="text-xs tracking-[0.3em] font-bold text-blue-300">
            SYSTEM STATUS: OPTIMAL
          </span>
        </div>
        <div className="header-center">
          <h1 className="game-title-v3">GALACTIC COMMAND</h1>
        </div>
        <div className="header-right">
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] text-white/40 uppercase">Pilot Level</div>
              <div className="text-sm font-bold text-blue-400">LVL {playerLevel}</div>
            </div>
            <div className="w-px h-6 bg-white/10"></div>
            <div className="text-right">
              <div className="text-[10px] text-white/40 uppercase">Total Credits</div>
              <div className="text-sm font-bold text-yellow-400">
                {playerScore.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主控制台布局 */}
      <main className="command-main">
        {/* 左侧：战略情报面板 */}
        <section className="command-sidebar-left">
          <Card className="glass-panel h-full border-none">
            <CardContent className="p-6 space-y-8">
              <div>
                <h3 className="panel-title">
                  <LucideTrendingUp className="w-4 h-4" /> 银河动态指标
                </h3>
                <div className="mt-4 space-y-4">
                  <div className="stat-item">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>冲突指数</span>
                      <span
                        className={
                          galacticStatus.conflictIndex > 0.7 ? 'text-red-400' : 'text-yellow-400'
                        }
                      >
                        {galacticStatus.conflictIndex > 0.7 ? 'HIGH' : 'STABLE'}
                      </span>
                    </div>
                    <div className="progress-bar-v3">
                      <div
                        className={`fill ${galacticStatus.conflictIndex > 0.7 ? 'bg-red-500' : 'bg-yellow-500'}`}
                        style={{ width: `${galacticStatus.conflictIndex * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>贸易活跃度</span>
                      <span className="text-blue-400">
                        {galacticStatus.tradeActivity > 0.6 ? 'BOOMING' : 'NORMAL'}
                      </span>
                    </div>
                    <div className="progress-bar-v3">
                      <div
                        className="fill bg-blue-500"
                        style={{ width: `${galacticStatus.tradeActivity * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="panel-title">
                  <LucideUsers className="w-4 h-4" /> 派系影响力
                </h3>
                <div className="mt-4 space-y-2">
                  {Object.entries(galacticStatus.factionInfluence).map(([faction, value]) => (
                    <div key={faction} className="faction-dot-item">
                      <div className={`dot bg-${getFactionColor(faction)}-500`}></div>
                      <span className="text-xs">{getFactionName(faction)}</span>
                      <span className="ml-auto text-xs text-white/50">{value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 中间：核心操作区 */}
        <section className="command-center-hub">
          <div className="hub-content">
            <div className="tactical-display">
              <div className="circle-scanner"></div>
              <div className="ship-wireframe"></div>
            </div>

            <div className="primary-actions">
              <button className="btn-v3-primary" onClick={handleStartStrategic}>
                <LucideGlobe className="w-6 h-6" />
                <div className="text-left">
                  <div className="text-lg font-bold">银河战略指挥</div>
                  <div className="text-[10px] opacity-60">ENTER STAR MAP & SECTORS</div>
                </div>
              </button>

              <div className="secondary-grid">
                <button className="btn-v3-secondary" onClick={() => handleAction(onHangar)}>
                  <LucideBox className="w-5 h-5" />
                  <span>机库整备</span>
                </button>
                <button className="btn-v3-secondary" onClick={() => handleAction(onSkillTree)}>
                  <LucideZap className="w-5 h-5" />
                  <span>科技矩阵</span>
                </button>
                <button className="btn-v3-secondary" onClick={() => handleAction(onSurvival)}>
                  <LucideShield className="w-5 h-5" />
                  <span>模拟训练</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 右侧：情报与配置 */}
        <section className="command-sidebar-right">
          <div className="space-y-4">
            <button className="btn-v3-icon-label" onClick={() => handleAction(onLeaderboard)}>
              <LucideTrophy className="w-5 h-5" />
              <span>荣誉榜</span>
            </button>
            <button className="btn-v3-icon-label" onClick={() => handleAction(onAchievements)}>
              <LucideTrophy className="w-5 h-5" />
              <span>成就记录</span>
            </button>
            <button className="btn-v3-icon-label" onClick={() => handleAction(onShop)}>
              <LucideTrendingUp className="w-5 h-5" />
              <span>黑市终端</span>
            </button>
            <button className="btn-v3-icon-label" onClick={() => handleAction(onSettings)}>
              <LucideSettings className="w-5 h-5" />
              <span>系统配置</span>
            </button>
          </div>

          <div className="mt-auto p-4 glass-panel rounded-lg">
            <div className="flex items-center gap-2 mb-2 text-white/40">
              <LucideInfo className="w-4 h-4" />
              <span className="text-[10px] uppercase font-bold">Intelligence Feed</span>
            </div>
            <div className="space-y-1">
              {galacticStatus.intelligenceFeed.map((feed, index) => (
                <p
                  key={index}
                  className="text-[10px] leading-relaxed text-blue-200/60 border-l border-blue-500/30 pl-2"
                >
                  {feed}
                </p>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* 底部装饰条 */}
      <footer className="command-footer">
        <div className="footer-line"></div>
        <div className="text-[10px] text-white/20 tracking-widest mt-2 uppercase">
          Version 3.0.0 | Engine: PlayCanvas WebGPU | Node Status: Connected
        </div>
      </footer>
    </div>
  );
};

export default MainMenu;
