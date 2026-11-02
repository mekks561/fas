import * as pc from 'playcanvas';
import { FactionId } from './FactionManager';
import { GalaxyManager, StarNode } from './GalaxyManager';

export interface StrategicEvent {
  id: string;
  type: 'invasion' | 'raid' | 'expansion';
  originSectorId: string;
  targetSectorId: string;
  factionId: FactionId;
  progress: number; // 0 to 1
  startTime: number;
  duration: number;
}

/**
 * 2026 Tech: 神经网络决策模拟。
 * 模拟一个简化的权重网络，用于决定派系战略。
 */
class NeuralDecisionNetwork {
  private weights: Map<string, number> = new Map();

  constructor() {
    // 初始化神经元权重
    this.weights.set('aggression', 0.5);
    this.weights.set('resource_need', 0.3);
    this.weights.set('player_threat', 0.2);
  }

  /**
   * 推理派系下一步行动。
   * @param inputs 包含环境状态的输入向量
   * @returns 行动建议及其置信度
   */
  public infer(inputs: { 
    sectorVolatility: number; 
    factionPower: number; 
    playerRep: number;
    resourceDensity: number;
  }): { action: 'attack' | 'expand' | 'trade' | 'idle'; score: number } {
    
    // 模拟神经元加权激活 (Simple Linear Combination + Bias)
    const attackScore = (inputs.sectorVolatility * 0.4) + (inputs.factionPower * 0.3) - (inputs.playerRep * 0.3);
    const expandScore = (inputs.resourceDensity * 0.5) + (inputs.factionPower * 0.4);
    const tradeScore = (inputs.playerRep * 0.5) + (inputs.resourceDensity * 0.3);

    const scores = [
      { action: 'attack' as const, score: attackScore },
      { action: 'expand' as const, score: expandScore },
      { action: 'trade' as const, score: tradeScore },
      { action: 'idle' as const, score: 0.2 }
    ];

    return scores.sort((a, b) => b.score - a.score)[0];
  }
}

/**
 * 2026 Tech: 银河战略 AI 核心。
 * 负责模拟各派系的宏观决策，驱动银河系的动态版图演变。
 */
export class StrategicAICore {
  private galaxyManager: GalaxyManager;
  private activeEvents: StrategicEvent[] = [];
  private lastUpdate: number = Date.now();
  private brain: NeuralDecisionNetwork;

  // 记录各星区的动态数据供神经网络分析
  private sectorData: Map<string, { activity: number; resourceFlow: number }> = new Map();

  constructor(galaxyManager: GalaxyManager) {
    this.galaxyManager = galaxyManager;
    this.brain = new NeuralDecisionNetwork();
  }

  /**
   * 更新银河系战略态势。
   * 通常在长时间跨度（如玩家跳转星区或每隔几分钟）调用。
   */
  public update(dtMs: number): void {
    this.processActiveEvents(dtMs);
    
    // 随机触发新的派系决策
    if (Math.random() < 0.05) {
      this.generateFactionDecision();
    }
  }

  private processActiveEvents(dtMs: number): void {
    const completedEvents: string[] = [];

    this.activeEvents.forEach(event => {
      event.progress += dtMs / event.duration;
      
      if (event.progress >= 1.0) {
        this.finalizeEvent(event);
        completedEvents.push(event.id);
      }
    });

    this.activeEvents = this.activeEvents.filter(e => !completedEvents.includes(e.id));
  }

  private generateFactionDecision(): void {
    const nodes = this.galaxyManager.getAllNodes();
    const factions: FactionId[] = ['trade_union', 'scavengers', 'imperial_guard', 'void_cult'];
    
    // 选出一个随机派系进行决策
    const factionId = factions[Math.floor(Math.random() * factions.length)];
    const factionNodes = nodes.filter(n => n.dominantFactionId === factionId);
    if (factionNodes.length === 0) return;

    const origin = factionNodes[Math.floor(Math.random() * factionNodes.length)];
    const data = this.sectorData.get(origin.id) || { activity: Math.random(), resourceFlow: Math.random() };

    // 2026 Tech: 神经网络推理
    const app = (this.galaxyManager as any).context?.app;
    const factionManager = app?._factionManager;
    const playerRep = factionManager?.getFaction(factionId)?.reputation || 0;

    const decision = this.brain.infer({
      sectorVolatility: data.activity,
      factionPower: factionNodes.length / nodes.length,
      playerRep: playerRep / 100,
      resourceDensity: origin.type === 'resource' ? 1.0 : 0.4
    });

    if (decision.score < 0.4) return; // 置信度不足，保持现状

    // 根据推理结果执行战略行动
    if (decision.action === 'attack' || decision.action === 'expand') {
      const targets = origin.connections
        .map(id => this.galaxyManager.getStarNode(id))
        .filter(n => n && n.dominantFactionId !== factionId) as StarNode[];

      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        if (this.activeEvents.some(e => e.targetSectorId === target.id)) return;

        const newEvent: StrategicEvent = {
          id: `event-${Date.now()}`,
          type: decision.action === 'attack' ? 'raid' : 'invasion',
          originSectorId: origin.id,
          targetSectorId: target.id,
          factionId,
          progress: 0,
          startTime: Date.now(),
          duration: 300000 + Math.random() * 600000
        };

        this.activeEvents.push(newEvent);
        console.log(`[NeuralAI] Faction ${factionId} decided to ${decision.action} towards ${target.name} (Score: ${decision.score.toFixed(2)})`);
      }
    } else if (decision.action === 'trade') {
      // 贸易决策：降低该星区资源价格，吸引玩家
      console.log(`[NeuralAI] Faction ${factionId} optimizing trade routes in ${origin.name}`);
      this.optimizeTrade(origin.id, factionId);
    }
  }

  private optimizeTrade(sectorId: string, factionId: FactionId): void {
    const galaxyManager = this.galaxyManager as any;
    if (galaxyManager.updateMarketState) {
      galaxyManager.updateMarketState(sectorId, { priceMultiplier: 0.8, supply: 1.5 });
    }
  }

  /**
   * 注入星区活动数据（由 FactionManager 在玩家行动时调用）
   */
  public reportActivity(sectorId: string, amount: number): void {
    const data = this.sectorData.get(sectorId) || { activity: 0, resourceFlow: 0 };
    data.activity = Math.min(1.0, data.activity + amount);
    this.sectorData.set(sectorId, data);
  }

  private finalizeEvent(event: StrategicEvent): void {
    const targetNode = this.galaxyManager.getStarNode(event.targetSectorId);
    if (!targetNode) return;

    if (event.type === 'invasion') {
      // 2026 Tech: 侵略成功，判定是否易主
      this.galaxyManager.updateInfluence(event.targetSectorId, event.factionId, 50);
      this.galaxyManager.updateInfluence(event.targetSectorId, targetNode.dominantFactionId, -40);
      
      // 检查新的统治力
      const influence = targetNode.influence;
      let newDominant = targetNode.dominantFactionId;
      let maxInf = influence[newDominant] || 0;

      Object.entries(influence).forEach(([fId, val]) => {
        if (val > maxInf) {
          maxInf = val;
          newDominant = fId as FactionId;
        }
      });

      if (newDominant !== targetNode.dominantFactionId) {
        console.log(`[GalacticWar] SECTOR CONQUERED: ${targetNode.name} is now under ${newDominant} control!`);
        targetNode.dominantFactionId = newDominant;
        
        // 触发全局通告
        const store = (window as any).useGameStore?.getState();
        store?.setActiveDialogue?.({
          id: `conquer_${Date.now()}`,
          name: '银河战报',
          participants: [newDominant],
          trigger: { type: 'auto' },
          lines: [{ speaker: newDominant, text: `我们已成功占领 ${targetNode.name} 星区。该区域现已纳入我们的版图。`, emotion: 'triumphant' }]
        });
      }
    } else if (event.type === 'raid') {
      // 突袭仅削弱防御，不一定易主
      this.galaxyManager.updateInfluence(event.targetSectorId, event.factionId, 15);
      this.galaxyManager.updateInfluence(event.targetSectorId, targetNode.dominantFactionId, -10);
    }
  }

  public getActiveEvents(): StrategicEvent[] {
    return this.activeEvents;
  }

  public getEventsForSector(sectorId: string): StrategicEvent[] {
    return this.activeEvents.filter(e => e.targetSectorId === sectorId);
  }
}
