import React, { useState } from 'react';
import {
  Trophy,
  Medal,
  Award,
  Clock,
  Users,
  Star,
  Target,
  Swords,
  RefreshCw,
  ChevronDown,
  Zap,
  Heart,
  Crosshair,
  Skull,
} from 'lucide-react';
import type { LeaderboardFilter } from '../engine/LeaderboardService';
import { useLeaderboardList, useMyRank, useLeaderboardStats } from '../services/leaderboard';
import './LeaderboardPanel.css';

interface LeaderboardPanelProps {
  onBack: () => void;
}

const filterLabels: Record<LeaderboardFilter, string> = {
  all: '全部',
  daily: '日榜',
  weekly: '周榜',
  monthly: '月榜',
  friends: '好友',
};

function formatDate(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

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

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = React.memo(({ onBack }) => {
  const [filter, setFilter] = useState<LeaderboardFilter>('all');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const listQuery = useLeaderboardList({ limit: 50, filter });
  const statsQuery = useLeaderboardStats();
  const myRankQuery = useMyRank('default_player');

  const entries = listQuery.data ?? [];
  const stats = statsQuery.data ?? {
    totalPlayers: 0,
    topScore: 0,
    avgScore: 0,
    difficultyDistribution: { easy: 0, normal: 0, hard: 0, expert: 0 },
  };
  const isLoading = listQuery.isLoading || statsQuery.isLoading || myRankQuery.isLoading;
  const error = listQuery.error || statsQuery.error || myRankQuery.error;
  const yourEntry = myRankQuery.data?.entry ?? null;

  const handleRefresh = () => {
    listQuery.refetch();
    statsQuery.refetch();
    myRankQuery.refetch();
  };

  const getRankIcon = (rank: number) => {
    if (rank <= 3) return rankIcons[rank];
    return `${rank}`;
  };

  return (
    <div className="leaderboard-panel">
      <div className="leaderboard-header">
        <button className="leaderboard-back-btn" onClick={onBack}>
          ← 返回
        </button>
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
            <span className="stat-value">{stats.topScore.toLocaleString()}</span>
            <span className="stat-label">最高分</span>
          </div>
        </div>
        <div className="stat-card">
          <Star className="stat-icon" />
          <div className="stat-info">
            <span className="stat-value">{stats.avgScore.toLocaleString()}</span>
            <span className="stat-label">平均分</span>
          </div>
        </div>
      </div>

      {myRankQuery.data?.rank !== null &&
        myRankQuery.data?.rank !== undefined &&
        myRankQuery.data.rank > 0 && (
          <div className="leaderboard-your-rank">
            <div className="your-rank-header">
              <Medal className="your-rank-icon" />
              <span className="your-rank-label">你的排名</span>
              {yourEntry?.rankGrade && (
                <span className={`your-rank-grade rank-grade-${yourEntry.rankGrade.toLowerCase()}`}>
                  {yourEntry.rankGrade}
                </span>
              )}
            </div>
            <div className="your-rank-content">
              <span className="your-rank-number">#{myRankQuery.data.rank}</span>
              <div className="your-rank-stats">
                <span className="your-rank-stat">
                  <Target size={14} /> {yourEntry?.score?.toLocaleString() ?? 0}
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
        {(Object.keys(filterLabels) as LeaderboardFilter[]).map((f) => (
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
        ) : error ? (
          <div className="leaderboard-loading text-red-400">
            <span>加载失败: {(error as any)?.message || '未知错误'}</span>
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
              const hasDetails =
                entry.accuracy !== undefined ||
                entry.maxCombo !== undefined ||
                entry.bossesKilled !== undefined ||
                entry.damageDealt !== undefined;

              return (
                <div
                  key={entryKey}
                  className={`leaderboard-item-wrapper ${isYou ? 'is-you' : ''} ${bgClass}`}
                >
                  <div
                    className={`leaderboard-item ${hasDetails ? 'clickable' : ''}`}
                    onClick={() => hasDetails && setExpandedEntry(isExpanded ? null : entryKey)}
                  >
                    <span className={`list-col-rank ${rankColor}`}>{getRankIcon(entry.rank)}</span>
                    <span className="list-col-name">
                      <Award
                        className={`name-icon ${isYou ? 'text-blue-400' : 'text-slate-500'}`}
                        size={14}
                      />
                      {entry.playerName}
                      {isYou && <span className="you-badge">你</span>}
                      {entry.rankGrade && (
                        <span
                          className={`entry-rank-grade rank-grade-${entry.rankGrade.toLowerCase()}`}
                        >
                          {entry.rankGrade}
                        </span>
                      )}
                    </span>
                    <span className="list-col-score">{entry.score.toLocaleString()}</span>
                    <span className="list-col-wave">{entry.wave}</span>
                    <span className="list-col-date">
                      <Clock size={12} />
                      {formatDate(
                        entry.timestamp instanceof Date
                          ? entry.timestamp.getTime()
                          : entry.timestamp,
                      )}
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
                          <span>
                            游戏时长: {Math.floor(entry.playTime / 60)}分
                            {Math.floor(entry.playTime % 60)}秒
                          </span>
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
