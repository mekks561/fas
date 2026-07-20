import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Medal, Award, Clock, Users, Star, Target, Swords, RefreshCw, ChevronDown, Zap, Heart, Crosshair, Skull } from 'lucide-react';
import { LeaderboardService, LeaderboardFilter } from '../engine/LeaderboardService';
import './LeaderboardPanel.css';

interface LeaderboardPanelProps {
  onBack: () => void;
  service: LeaderboardService;
}

const filterLabels: Record<LeaderboardFilter, string> = {
  all: '全部',
  daily: '日榜',
  weekly: '周榜',
  monthly: '月榜',
  friends: '好友',
};

const rankColors: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-slate-300',
  3: 'text-amber-600',
};

const rankBgColors: Record<number, string> = {
  1: 'bg-yellow-400/10 border-yellow-400/30',
  2: 'bg-slate-300/10 border-slate-300/30',
  3: 'bg-amber-600/10 border-amber-600/30',
};

const rankIcons: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = React.memo(({ onBack, service }) => {
  const [filter, setFilter] = useState<LeaderboardFilter>('all');
  const [_updateTrigger, setUpdateTrigger] = useState({});
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  useEffect(() => {
    const unsub = service.subscribe(() => setUpdateTrigger({}));
    service.fetchLeaderboard(filter);
    return unsub;
  }, [service, filter]);

  useEffect(() => {
    service.fetchLeaderboard(filter);
  }, [service, filter]);

  const entries = useMemo(() => service.getEntries(), [service]);
  const stats = useMemo(() => service.getStats(), [service]);
  const isLoading = useMemo(() => service.isLoadingEntries(), [service]);
  const yourEntry = useMemo(() => service.getYourEntry(), [service]);

  const handleRefresh = () => {
    service.fetchLeaderboard(filter);
  };

  const getRankIcon = (rank: number) => {
    if (rank <= 3) return rankIcons[rank];
    return `${rank}`;
  };

  return (
    <div className="leaderboard-panel">
      <div className="leaderboard-header">
        <button className="leaderboard-back-btn" onClick={onBack}>← 返回</button>
        <h1 className="leaderboard-title">排行榜</h1>
        <button className="leaderboard-refresh-btn" onClick={handleRefresh}>
          <RefreshCw className={isLoading ? 'animate-spin' : ''} size={18} />
        </button>
      </div>

      <div className="leaderboard-stats">
        <div className="stat-card">
          <Users className="stat-icon" />
          <div className="stat-info">
            <span className="stat-value">{stats.totalPlayers}</span>
            <span className="stat-label">总玩家</span>
          </div>
        </div>
        <div className="stat-card">
          <Trophy className="stat-icon" />
          <div className="stat-info">
            <span className="stat-value">{service.formatScore(stats.topScore)}</span>
            <span className="stat-label">最高分</span>
          </div>
        </div>
        <div className="stat-card">
          <Star className="stat-icon" />
          <div className="stat-info">
            <span className="stat-value">{service.formatScore(stats.avgScore)}</span>
            <span className="stat-label">平均分</span>
          </div>
        </div>
      </div>

      {stats.yourRank > 0 && (
        <div className="leaderboard-your-rank">
          <div className="your-rank-header">
            <Medal className="your-rank-icon" />
            <span className="your-rank-label">你的排名</span>
            {yourEntry?.rankGrade && (
              <span className={`your-rank-grade rank-grade-${yourEntry.rankGrade.toLowerCase()}`}>{yourEntry.rankGrade}</span>
            )}
          </div>
          <div className="your-rank-content">
            <span className="your-rank-number">#{stats.yourRank}</span>
            <div className="your-rank-stats">
              <span className="your-rank-stat">
                <Target size={14} /> {service.formatScore(stats.yourScore)}
              </span>
              <span className="your-rank-stat">
                <Swords size={14} /> Wave {yourEntry?.wave || 0}
              </span>
              {yourEntry?.maxCombo !== undefined && yourEntry.maxCombo > 0 && (
                <span className="your-rank-stat">
                  <Zap size={14} /> {yourEntry.maxCombo}x
                </span>
              )}
              {yourEntry?.accuracy !== undefined && yourEntry.accuracy > 0 && (
                <span className="your-rank-stat">
                  <Crosshair size={14} /> {Math.round(yourEntry.accuracy * 100)}%
                </span>
              )}
              {yourEntry?.bossesKilled !== undefined && yourEntry.bossesKilled > 0 && (
                <span className="your-rank-stat">
                  <Skull size={14} /> {yourEntry.bossesKilled}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="leaderboard-filters">
        {(Object.keys(filterLabels) as LeaderboardFilter[]).map(f => (
          <button
            key={f}
            className={`leaderboard-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      <div className="leaderboard-content">
        {isLoading ? (
          <div className="leaderboard-loading">
            <RefreshCw className="animate-spin" size={32} />
            <span>加载中...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="leaderboard-empty">暂无排行数据</div>
        ) : (
          <div className="leaderboard-list">
            <div className="leaderboard-list-header">
              <span className="list-col-rank">排名</span>
              <span className="list-col-name">玩家</span>
              <span className="list-col-score">分数</span>
              <span className="list-col-wave">波次</span>
              <span className="list-col-date">时间</span>
            </div>
            {entries.slice(0, 50).map((entry, idx) => {
              const isYou = entry.playerId === yourEntry?.playerId;
              const rankColor = rankColors[entry.rank] || 'text-slate-400';
              const bgClass = rankBgColors[entry.rank] || '';
              const entryKey = `${entry.playerId}-${idx}`;
              const isExpanded = expandedEntry === entryKey;
              const hasDetails = entry.accuracy !== undefined || entry.maxCombo !== undefined || entry.bossesKilled !== undefined || entry.damageDealt !== undefined;

              return (
                <div
                  key={entryKey}
                  className={`leaderboard-item-wrapper ${isYou ? 'is-you' : ''} ${bgClass}`}
                >
                  <div
                    className={`leaderboard-item ${hasDetails ? 'clickable' : ''}`}
                    onClick={() => hasDetails && setExpandedEntry(isExpanded ? null : entryKey)}
                  >
                    <span className={`list-col-rank ${rankColor}`}>
                      {getRankIcon(entry.rank)}
                    </span>
                    <span className="list-col-name">
                      <Award
                        className={`name-icon ${isYou ? 'text-blue-400' : 'text-slate-500'}`}
                        size={14}
                      />
                      {entry.playerName}
                      {isYou && <span className="you-badge">你</span>}
                      {entry.rankGrade && (
                        <span className={`entry-rank-grade rank-grade-${entry.rankGrade.toLowerCase()}`}>{entry.rankGrade}</span>
                      )}
                    </span>
                    <span className="list-col-score">{service.formatScore(entry.score)}</span>
                    <span className="list-col-wave">{entry.wave}</span>
                    <span className="list-col-date">
                      <Clock size={12} />
                      {service.formatDate(entry.timestamp)}
                    </span>
                    {hasDetails && (
                      <span className="list-col-expand">
                        <ChevronDown size={14} className={isExpanded ? 'rotate-180' : ''} />
                      </span>
                    )}
                  </div>
                  {isExpanded && hasDetails && (
                    <div className="leaderboard-item-details">
                      {entry.maxCombo !== undefined && entry.maxCombo > 0 && (
                        <div className="detail-item">
                          <Zap size={12} className="text-yellow-400" />
                          <span>最高连击: {entry.maxCombo}x</span>
                        </div>
                      )}
                      {entry.accuracy !== undefined && entry.accuracy > 0 && (
                        <div className="detail-item">
                          <Crosshair size={12} className="text-purple-400" />
                          <span>命中率: {Math.round(entry.accuracy * 100)}%</span>
                        </div>
                      )}
                      {entry.bossesKilled !== undefined && entry.bossesKilled > 0 && (
                        <div className="detail-item">
                          <Skull size={12} className="text-red-400" />
                          <span>BOSS击杀: {entry.bossesKilled}</span>
                        </div>
                      )}
                      {entry.elitesKilled !== undefined && entry.elitesKilled > 0 && (
                        <div className="detail-item">
                          <Swords size={12} className="text-orange-400" />
                          <span>精英击杀: {entry.elitesKilled}</span>
                        </div>
                      )}
                      {entry.damageDealt !== undefined && entry.damageDealt > 0 && (
                        <div className="detail-item">
                          <Target size={12} className="text-cyan-400" />
                          <span>伤害输出: {entry.damageDealt.toLocaleString()}</span>
                        </div>
                      )}
                      {entry.damageTaken !== undefined && entry.damageTaken > 0 && (
                        <div className="detail-item">
                          <Heart size={12} className="text-red-400" />
                          <span>受到伤害: {entry.damageTaken.toLocaleString()}</span>
                        </div>
                      )}
                      {entry.powerupsCollected !== undefined && entry.powerupsCollected > 0 && (
                        <div className="detail-item">
                          <Star size={12} className="text-green-400" />
                          <span>道具拾取: {entry.powerupsCollected}</span>
                        </div>
                      )}
                      {entry.playTime !== undefined && entry.playTime > 0 && (
                        <div className="detail-item">
                          <Clock size={12} className="text-slate-400" />
                          <span>游戏时长: {Math.floor(entry.playTime / 60)}分{Math.floor(entry.playTime % 60)}秒</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
