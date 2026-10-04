import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/shadcn/Button';
import { Badge } from './ui/shadcn/Badge';
import { skillTreeManager, TalentNode, TalentState, TalentType } from '../engine/SkillTreeManager';

interface SkillTreeUIProps {
  onBack: () => void;
}

const typeColors: Record<TalentType, { bg: string; border: string; text: string; glow: string }> = {
  offensive: {
    bg: 'bg-red-500/20',
    border: 'border-red-500',
    text: 'text-red-400',
    glow: 'shadow-red-500/30',
  },
  defensive: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/30',
  },
  utility: {
    bg: 'bg-green-500/20',
    border: 'border-green-500',
    text: 'text-green-400',
    glow: 'shadow-green-500/30',
  },
  support: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/30',
  },
};

const typeNames: Record<TalentType, string> = {
  offensive: '攻击',
  defensive: '防御',
  utility: '通用',
  support: '支援',
};

const iconMap: Record<string, string> = {
  sword: '⚔️',
  crosshair: '🎯',
  target: '🎖️',
  zap: '⚡',
  heart: '❤️',
  shield: '🛡️',
  sparkles: '✨',
  clock: '⏱️',
  wind: '💨',
  rocket: '🚀',
  time: '🕐',
  skill: '📚',
};

const TalentNodeComponent: React.FC<{
  node: TalentNode;
  state: TalentState;
  canUpgrade: boolean;
  isLocked: boolean;
}> = ({ node, state, canUpgrade, isLocked }) => {
  const colors = typeColors[node.type];
  const icon = iconMap[node.icon] || '⭐';

  const handleClick = () => {
    if (canUpgrade) {
      skillTreeManager.upgradeTalent(node.id);
    }
  };

  const progressPercent = state.level > 0 ? (state.level / node.maxLevel) * 100 : 0;

  return (
    <div
      onClick={handleClick}
      className={`relative p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer
        ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
        ${canUpgrade ? 'hover:scale-105 hover:shadow-lg' : ''}
        ${state.level > 0 ? `${colors.bg} ${colors.border} shadow-lg ${colors.glow}` : 'bg-gray-800/50 border-gray-700'}
      `}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${colors.bg}`}
        >
          {icon}
        </div>
        <div>
          <h4 className={`font-bold ${state.level > 0 ? colors.text : 'text-gray-300'}`}>
            {node.name}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {state.level}/{node.maxLevel}
            </span>
            {canUpgrade && (
              <Badge variant="outline" className="text-xs">
                -{node.costPerLevel}点
              </Badge>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-2">{node.description}</p>

      <div className="space-y-1">
        {node.effects.map((effect, idx) => (
          <div
            key={idx}
            className={`text-xs px-2 py-1 rounded ${state.level > 0 ? colors.bg : 'bg-gray-800'}
              ${state.level > 0 ? colors.text : 'text-gray-500'}
            `}
          >
            {skillTreeManager.formatEffectDescription(effect, state.level)}
          </div>
        ))}
      </div>

      {state.level > 0 && node.maxLevel > 1 && (
        <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bg.replace('/20', '')} transition-all duration-300`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
          <span className="text-xs text-gray-500">等级 {node.unlockLevel} 解锁</span>
        </div>
      )}
    </div>
  );
};

export const SkillTreeUI: React.FC<SkillTreeUIProps> = React.memo(({ onBack }) => {
  const { t } = useTranslation();
  const [talentNodes, setTalentNodes] = useState<TalentNode[]>([]);
  const [talentStates, setTalentStates] = useState<TalentState[]>([]);
  const [talentPoints, setTalentPoints] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);

  const updateState = useCallback(() => {
    setTalentNodes(skillTreeManager.getTalentNodes());
    setTalentStates(skillTreeManager.getAllTalentStates());
    setTalentPoints(skillTreeManager.getTalentPoints());
    setPlayerLevel(skillTreeManager.getPlayerLevel());
  }, []);

  useEffect(() => {
    updateState();
    const interval = setInterval(updateState, 100);
    return () => clearInterval(interval);
  }, [updateState]);

  const handleReset = () => {
    if (confirm('确定要重置所有天赋吗？这将返还所有天赋点。')) {
      skillTreeManager.resetAllTalents();
    }
  };

  const groupedNodes = talentNodes.reduce(
    (acc, node) => {
      if (!acc[node.type]) {
        acc[node.type] = [];
      }
      acc[node.type].push(node);
      return acc;
    },
    {} as Record<TalentType, TalentNode[]>,
  );

  const getState = (nodeId: string) => {
    return talentStates.find((s) => s.nodeId === nodeId);
  };

  const isLocked = (node: TalentNode) => {
    return !skillTreeManager.isTalentUnlocked(node.id);
  };

  const canUpgrade = (node: TalentNode) => {
    return skillTreeManager.canUpgradeTalent(node.id);
  };

  const stats = skillTreeManager.getStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
            ← {t('common.back')}
          </Button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            {t('skillTree.title')}
          </h1>
          <div className="flex items-center gap-4">
            <div className="bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
              <span className="text-gray-400 text-sm">{t('skillTree.playerLevel')}</span>
              <span className="ml-2 text-xl font-bold text-blue-400">{playerLevel}</span>
            </div>
            <div className="bg-gray-800/50 px-4 py-2 rounded-lg border border-yellow-500/50">
              <span className="text-gray-400 text-sm">{t('skillTree.talentPoints')}</span>
              <span className="ml-2 text-xl font-bold text-yellow-400">{talentPoints}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {(Object.keys(groupedNodes) as TalentType[]).map((type) => (
              <div key={type}>
                <div className={`flex items-center gap-2 mb-4 ${typeColors[type].text}`}>
                  <div
                    className={`w-3 h-3 rounded-full ${typeColors[type].bg.replace('/20', '')}`}
                  />
                  <h2 className="text-xl font-bold">{typeNames[type]}天赋</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {groupedNodes[type].map((node) => {
                    const state = getState(node.id)!;
                    return (
                      <TalentNodeComponent
                        key={node.id}
                        node={node}
                        state={state}
                        canUpgrade={canUpgrade(node)}
                        isLocked={isLocked(node)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-bold text-gray-200 mb-4">{t('skillTree.stats')}</h3>
              <div className="space-y-3">
                {stats.damageBonus > 0 && (
                  <div className="flex justify-between items-center text-red-400">
                    <span className="text-sm">伤害加成</span>
                    <span className="font-bold">+{stats.damageBonus}%</span>
                  </div>
                )}
                {stats.fireRateBonus > 0 && (
                  <div className="flex justify-between items-center text-orange-400">
                    <span className="text-sm">射速加成</span>
                    <span className="font-bold">+{stats.fireRateBonus}%</span>
                  </div>
                )}
                {stats.healthBonus > 0 && (
                  <div className="flex justify-between items-center text-green-400">
                    <span className="text-sm">生命加成</span>
                    <span className="font-bold">+{stats.healthBonus}%</span>
                  </div>
                )}
                {stats.shieldBonus > 0 && (
                  <div className="flex justify-between items-center text-blue-400">
                    <span className="text-sm">护盾加成</span>
                    <span className="font-bold">+{stats.shieldBonus}%</span>
                  </div>
                )}
                {stats.speedBonus > 0 && (
                  <div className="flex justify-between items-center text-cyan-400">
                    <span className="text-sm">速度加成</span>
                    <span className="font-bold">+{stats.speedBonus}%</span>
                  </div>
                )}
                {stats.criticalChance > 0 && (
                  <div className="flex justify-between items-center text-yellow-400">
                    <span className="text-sm">暴击率</span>
                    <span className="font-bold">+{stats.criticalChance}%</span>
                  </div>
                )}
                {stats.criticalDamage > 0 && (
                  <div className="flex justify-between items-center text-yellow-400">
                    <span className="text-sm">暴击伤害</span>
                    <span className="font-bold">+{stats.criticalDamage}%</span>
                  </div>
                )}
                {stats.cooldownReduction > 0 && (
                  <div className="flex justify-between items-center text-purple-400">
                    <span className="text-sm">冷却减少</span>
                    <span className="font-bold">-{stats.cooldownReduction}%</span>
                  </div>
                )}
                {stats.healEffectiveness > 0 && (
                  <div className="flex justify-between items-center text-green-400">
                    <span className="text-sm">治疗效果</span>
                    <span className="font-bold">+{stats.healEffectiveness}%</span>
                  </div>
                )}
                {stats.boostEffectiveness > 0 && (
                  <div className="flex justify-between items-center text-orange-400">
                    <span className="text-sm">加速效果</span>
                    <span className="font-bold">+{stats.boostEffectiveness}%</span>
                  </div>
                )}
                {Object.keys(stats.skillDamageBonus).length === 0 &&
                  Object.keys(stats.skillDurationBonus).length === 0 &&
                  Object.keys(stats.skillCooldownReduction).length === 0 &&
                  stats.damageBonus === 0 &&
                  stats.fireRateBonus === 0 &&
                  stats.healthBonus === 0 &&
                  stats.shieldBonus === 0 &&
                  stats.speedBonus === 0 &&
                  stats.criticalChance === 0 &&
                  stats.criticalDamage === 0 &&
                  stats.cooldownReduction === 0 &&
                  stats.healEffectiveness === 0 &&
                  stats.boostEffectiveness === 0 && (
                    <div className="text-gray-500 text-center py-4">{t('skillTree.noStats')}</div>
                  )}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-bold text-gray-200 mb-4">{t('skillTree.info')}</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• {t('skillTree.info1')}</li>
                <li>• {t('skillTree.info2')}</li>
                <li>• {t('skillTree.info3')}</li>
                <li>• {t('skillTree.info4')}</li>
              </ul>
            </div>

            <Button variant="destructive" className="w-full" onClick={handleReset}>
              {t('skillTree.reset')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
