import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardContent, Badge, Progress, Button } from './ui/shadcn';
import type { StoryMissionManager, MissionState } from '../engine/StoryMissionManager';

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
  const [_updateTrigger, setUpdateTrigger] = useState({});
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllMissions, setShowAllMissions] = useState(false);

  useEffect(() => {
    if (!manager) return;
    const unsub = manager.subscribe(() => setUpdateTrigger({}));
    return unsub;
  }, [manager]);

  const activeMissions = useMemo<MissionState[]>(() => {
    if (!manager) return [];
    return manager.getActiveMissions();
  }, [manager]);

  const availableMissions = useMemo<MissionState[]>(() => {
    if (!manager) return [];
    return manager.getAvailableMissions();
  }, [manager]);

  const stats = useMemo(() => {
    return manager?.getProgressStats() || { total: 0, completed: 0, active: 0, available: 0 };
  }, [manager]);

  if (!manager) return null;

  const displayMissions = showAllMissions
    ? [...activeMissions, ...availableMissions]
    : activeMissions;

  if (displayMissions.length === 0 && !showAllMissions) {
    return (
      <Card className="bg-black/70 border-gray-700">
        <CardHeader
          onClick={() => setShowAllMissions(!showAllMissions)}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                !
              </span>
              <span className="text-white font-semibold">任务</span>
            </div>
            {stats.available > 0 && (
              <Badge variant="secondary" className="bg-green-600/30 text-green-400 border-green-600">
                {stats.available}个可接
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-black/70 border-gray-700">
      <CardHeader onClick={() => setIsExpanded(!isExpanded)} className="cursor-pointer">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              !
            </span>
            <span className="text-white font-semibold">任务追踪</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-400">{stats.active} 进行中</span>
              {stats.available > 0 && (
                <span className="text-green-400">{stats.available} 可接</span>
              )}
              <span className="text-gray-400">{stats.completed}/{stats.total}</span>
            </div>
            <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-3 mt-4">
            {displayMissions.map((missionState) => {
              const mission = missionState.mission;
              const color = missionTypeColors[mission.type] || '#ffffff';
              const typeLabel = missionTypeLabels[mission.type] || mission.type;
              const isActive = missionState.status === 'active';

              return (
                <div
                  key={mission.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    isActive ? 'bg-gray-800/50' : 'bg-gray-800/30'
                  }`}
                  style={{ borderLeftColor: color }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={{ backgroundColor: `${color}30`, color }}
                      >
                        {typeLabel}
                      </Badge>
                      <span className="text-white font-medium">{mission.name}</span>
                    </div>
                    {!isActive && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          manager.startMission(mission.id);
                        }}
                      >
                        接受
                      </Button>
                    )}
                  </div>

                  {isActive && (
                    <>
                      <p className="text-gray-400 text-sm mb-3">{mission.description}</p>
                      <div className="space-y-2 mb-3">
                        {missionState.objectives.map((obj) => {
                          const label = objectiveTypeLabels[obj.type] || obj.type;
                          const target = obj.count || obj.duration || 0;
                          const progress = Math.min(obj.current, target);
                          const pct = target > 0 ? (progress / target) * 100 : 0;

                          return (
                            <div
                              key={obj.type}
                              className={`flex items-start gap-2 ${
                                obj.completed ? 'opacity-70' : ''
                              }`}
                            >
                              <span className="text-sm mt-0.5">
                                {obj.completed ? '✓' : '○'}
                              </span>
                              <div className="flex-1">
                                <div className="text-gray-300 text-sm">
                                  {label}
                                  {obj.target ? ` ${obj.target}` : ''}
                                  {target > 0 && ` (${progress}/${target})`}
                                </div>
                                {target > 0 && (
                                  <Progress
                                    value={pct}
                                    className="h-1.5 mt-1"
                                    style={{
                                      '--progress-color': color,
                                    } as React.CSSProperties}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-yellow-400">+{mission.rewards.experience} EXP</span>
                        <span className="text-blue-400">+{mission.rewards.credits} 信用</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4"
            onClick={() => setShowAllMissions(!showAllMissions)}
          >
            {showAllMissions ? '仅显示进行中' : `查看全部 (${stats.total})`}
          </Button>
        </CardContent>
      )}
    </Card>
  );
};
