import * as pc from 'playcanvas';
import { PluginContext } from './PluginSystem';

export type FactionId = 'trade_union' | 'scavengers' | 'imperial_guard' | 'void_cult' | 'neutral';

export interface FactionState {
  id: FactionId;
  name: string;
  reputation: number; // -100 to 100
  color: [number, number, number];
  isAggressive: boolean;
}

/**
 * 2026 Tech: Neural AI 派系声望系统。
 * 追踪玩家与各势力的关系，并影响星区生成与 NPC 行为。
 */
export class FactionManager {
  public name = 'FactionManager';
  public version = '2.7.0';

  private factions: Map<FactionId, FactionState> = new Map();
  private sectorInfluence: Map<string, Map<FactionId, number>> = new Map();
  private context: PluginContext | null = null;

  public init(context: PluginContext): void {
    this.context = context;
    this.initFactions();
    console.log('[FactionManager] Neural AI Faction System initialized.');
  }

  /**
   * 2026 Neural AI: 模拟派系决策。
   * 根据玩家声望和星区资源流向动态调整派系行为。
   */
  public simulateFactionDecisions(playerActions: { type: string; targetFaction?: FactionId; sectorId: string }): void {
    // 简单的神经网络启发式模拟
    const { type, targetFaction, sectorId } = playerActions;

    if (type === 'kill' && targetFaction) {
      this.addReputation(targetFaction, -5);
      // 敌对派系会感到鼓舞
      if (targetFaction === 'trade_union') {
        this.addReputation('scavengers', 2);
      }
    }

    // 更新星区影响力
    let sectorMap = this.sectorInfluence.get(sectorId);
    if (!sectorMap) {
      sectorMap = new Map();
      this.sectorInfluence.set(sectorId, sectorMap);
    }

    if (targetFaction) {
      const currentInf = sectorMap.get(targetFaction) || 0;
      sectorMap.set(targetFaction, currentInf - 1); // 派系力量减弱
      
      // 2026 Tech: 同步更新到银河管理器与战略 AI
      const galaxyManager = (this.context?.app as any)?._galaxyManager;
      if (galaxyManager) {
        galaxyManager.updateInfluence(sectorId, targetFaction, -1);
        // 激励敌对派系
        if (targetFaction === 'trade_union') galaxyManager.updateInfluence(sectorId, 'scavengers', 0.5);

        // 报告星区波动，触发神经网络重规划
        const aiCore = galaxyManager.getStrategicAI?.();
        if (aiCore) {
          aiCore.reportActivity(sectorId, 0.1);
        }
      }
    }
  }

  public getSectorSafety(sectorId: string): number {
    const dominant = this.getDominantFaction(sectorId);
    if (dominant.id === 'trade_union' || dominant.id === 'imperial_guard') {
      return 0.8; // 安全
    }
    return 0.3; // 危险
  }

  private initFactions(): void {
    this.factions.set('trade_union', {
      id: 'trade_union',
      name: '贸易联盟',
      reputation: 10,
      color: [0.2, 0.6, 1.0],
      isAggressive: false
    });
    this.factions.set('scavengers', {
      id: 'scavengers',
      name: '拾荒者',
      reputation: -20,
      color: [1.0, 0.6, 0.2],
      isAggressive: true
    });
    this.factions.set('imperial_guard', {
      id: 'imperial_guard',
      name: '帝国卫队',
      reputation: 0,
      color: [1.0, 0.2, 0.2],
      isAggressive: false
    });
    this.factions.set('void_cult', {
      id: 'void_cult',
      name: '虚空教派',
      reputation: -50,
      color: [0.6, 0.2, 0.8],
      isAggressive: true
    });
  }

  public getFaction(id: FactionId): FactionState | undefined {
    return this.factions.get(id);
  }

  public getReputationMultiplier(id: FactionId): number {
    const faction = this.factions.get(id);
    if (!faction) return 1.0;
    
    // 声望越高，买卖价格越优惠 (100 声望 = 20% 优惠)
    if (faction.reputation > 0) {
      return 1.0 + (faction.reputation / 100) * 0.2;
    } else {
      // 负声望会导致价格惩罚
      return 1.0 + (faction.reputation / 100) * 0.5;
    }
  }

  public addReputation(id: FactionId, amount: number): void {
    const faction = this.factions.get(id);
    if (faction) {
      faction.reputation = pc.math.clamp(faction.reputation + amount, -100, 100);
      console.log(`[FactionManager] Reputation with ${faction.name} changed to ${faction.reputation}`);
      
      // 触发 UI 更新或游戏逻辑变化
      this.checkReputationMilestones(faction);
    }
  }

  private checkReputationMilestones(faction: FactionState): void {
    if (faction.reputation <= -50) {
      faction.isAggressive = true;
    } else if (faction.reputation >= 0) {
      faction.isAggressive = false;
    }
  }

  public getDominantFaction(sectorId: string): FactionState {
    // 简单的基于 Seed 的派系分配，实际应更复杂
    const factionIds: FactionId[] = ['trade_union', 'scavengers', 'imperial_guard', 'void_cult'];
    const index = Math.abs(this.hashCode(sectorId)) % factionIds.length;
    return this.factions.get(factionIds[index])!;
  }

  private hashCode(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
  }
}
