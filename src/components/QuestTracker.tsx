import React, { useState, useEffect, useMemo } from 'react';
import type { StoryMissionManager, MissionState } from '../engine/StoryMissionManager';
import './QuestTracker.css';

interface QuestTrackerProps {
  manager: StoryMissionManager | null;
}

const objectiveTypeLabels: Record<string, string> = {
  destroy: '摧毁',
  survive: '生存',
  escort: '护送',
  collect: '收集',
  reach: '到达',
};

const missionTypeColors: Record<string, string> = {
  main: '#4a9eff',
  side: '#4aff8a',
  daily: '#ffaa4a',
};

const missionTypeLabels: Record<string, string> = {
  main: '主线',
  side: '支线',
  daily: '日常',
};

export const QuestTracker: React.FC<QuestTrackerProps> = ({ manager }) => {
  const [, forceUpdate] = useState({});
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllMissions, setShowAllMissions] = useState(false);

  useEffect(() => {
    if (!manager) return;
    const unsub = manager.subscribe(() => forceUpdate({}));
    return unsub;
  }, [manager]);

  const activeMissions = useMemo<MissionState[]>(() => {
    if (!manager) return [];
    return manager.getActiveMissions();
  }, [manager, manager?.getActiveMissions().length]);

  const availableMissions = useMemo<MissionState[]>(() => {
    if (!manager) return [];
    return manager.getAvailableMissions();
  }, [manager, manager?.getAvailableMissions().length]);

  const stats = useMemo(() => {
    return manager?.getProgressStats() || { total: 0, completed: 0, active: 0, available: 0 };
  }, [manager, activeMissions.length, availableMissions.length]);

  if (!manager) return null;

  const displayMissions = showAllMissions
    ? [...activeMissions, ...availableMissions]
    : activeMissions;

  if (displayMissions.length === 0 && !showAllMissions) {
    return (
      <div className="quest-tracker quest-tracker-collapsed">
        <div className="quest-tracker-header" onClick={() => setShowAllMissions(!showAllMissions)}>
          <span className="quest-tracker-icon">!</span>
          <span className="quest-tracker-title">任务</span>
          {stats.available > 0 && (
            <span className="quest-tracker-badge quest-tracker-badge-available">
              {stats.available}个可接
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`quest-tracker ${isExpanded ? '' : 'quest-tracker-collapsed'}`}>
      <div
        className="quest-tracker-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="quest-tracker-icon">!</span>
        <span className="quest-tracker-title">任务追踪</span>
        <div className="quest-tracker-stats">
          <span className="quest-tracker-stat quest-tracker-stat-active">
            {stats.active} 进行中
          </span>
          {stats.available > 0 && (
            <span className="quest-tracker-stat quest-tracker-stat-available">
              {stats.available} 可接
            </span>
          )}
          <span className="quest-tracker-stat quest-tracker-stat-completed">
            {stats.completed}/{stats.total}
          </span>
        </div>
        <span className="quest-tracker-toggle">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="quest-tracker-body">
          <div className="quest-tracker-missions">
            {displayMissions.map((missionState) => {
              const mission = missionState.mission;
              const color = missionTypeColors[mission.type] || '#ffffff';
              const typeLabel = missionTypeLabels[mission.type] || mission.type;
              const isActive = missionState.status === 'active';

              return (
                <div
                  key={mission.id}
                  className={`quest-mission ${isActive ? 'quest-mission-active' : 'quest-mission-available'}`}
                  style={{ borderLeftColor: color }}
                >
                  <div className="quest-mission-header">
                    <span
                      className="quest-mission-type-badge"
                      style={{ backgroundColor: color }}
                    >
                      {typeLabel}
                    </span>
                    <span className="quest-mission-name">{mission.name}</span>
                    {!isActive && (
                      <button
                        className="quest-mission-accept-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          manager.startMission(mission.id);
                        }}
                      >
                        接受
                      </button>
                    )}
                  </div>

                  {isActive && (
                    <>
                      <p className="quest-mission-desc">{mission.description}</p>
                      <div className="quest-objectives">
                        {missionState.objectives.map((obj, i) => {
                          const label = objectiveTypeLabels[obj.type] || obj.type;
                          const target = obj.count || obj.duration || 0;
                          const progress = Math.min(obj.current, target);
                          const pct = target > 0 ? (progress / target) * 100 : 0;

                          return (
                            <div
                              key={i}
                              className={`quest-objective ${obj.completed ? 'quest-objective-done' : ''}`}
                            >
                              <span className="quest-objective-checkbox">
                                {obj.completed ? '✓' : '○'}
                              </span>
                              <span className="quest-objective-text">
                                {label}
                                {obj.target ? ` ${obj.target}` : ''}
                                {target > 0 && ` (${progress}/${target})`}
                              </span>
                              {target > 0 && (
                                <div className="quest-objective-bar">
                                  <div
                                    className="quest-objective-bar-fill"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="quest-mission-rewards">
                        <span className="quest-reward">+{mission.rewards.experience} EXP</span>
                        <span className="quest-reward">+{mission.rewards.credits} 信用</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <button
            className="quest-tracker-toggle-view"
            onClick={() => setShowAllMissions(!showAllMissions)}
          >
            {showAllMissions ? '仅显示进行中' : `查看全部 (${stats.total})`}
          </button>
        </div>
      )}
    </div>
  );
};
