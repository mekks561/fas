import * as pc from 'playcanvas';
import { PluginContext } from './PluginSystem';
import { FactionId } from './FactionManager';
import { SectorConfig } from './SectorGenerator';
import { StrategicAICore, StrategicEvent } from './StrategicAICore';
import { GalaxyGenerator } from './GalaxyGenerator';

export interface StarNode {
  id: string;
  name: string;
  coords: { x: number; y: number }; // 星图上的 2D 坐标
  type: SectorConfig['type'];
  dominantFactionId: FactionId;
  influence: Record<FactionId, number>; // 各派系在该星区的影响力 (0-100)
  connections: string[]; // 连接的星区 ID
  difficulty: number;
  isDiscovered: boolean;
}

/**
 * 2026 Tech: 动态银河管理器。
 * 负责维护星图拓扑结构、派系领土推演以及星区之间的动态平衡。
 */
export class GalaxyManager {
  public name = 'GalaxyManager';
  public version = '2.7.0';

  private starNodes: Map<string, StarNode> = new Map();
  private context: PluginContext | null = null;
  private currentSectorId: string = 'solar-system-alpha';
  private strategicAI: StrategicAICore | null = null;
  private changeListeners: Set<() => void> = new Set();

  public init(context: PluginContext): void {
    try {
      this.context = context;
      this.generateGalaxy(50); // 生成包含 50 个星区的银河系
      this.strategicAI = new StrategicAICore(this);
      
      // 2026 Tech: 立即同步一次初始拓扑，确保 UI 与引擎一致
      this.syncStore();

      // 启动战略时钟
      setInterval(() => {
        try {
          this.strategicAI?.update(5000); // 每 5 秒推演一次战略步长
          this.syncStore(); // 同步状态到 UI Store
        } catch (updateError) {
          console.warn('[GalaxyManager] Strategic update failed:', updateError);
        }
      }, 5000);

      console.log('[GalaxyManager] Dynamic Galaxy Map & Strategic AI initialized.');
    } catch (err) {
      console.error('[GalaxyManager] Initialization failed:', err);
      // 虽然失败了，但不直接抛出，避免阻塞整个引擎加载（但功能会缺失）
    }
  }

  /**
   * 2026 Tech: 将战略态势同步到 Zustand Store，供主菜单等 UI 使用。
   */
  private syncStore(): void {
    try {
      const store = (window as any).useGameStore?.getState();
      if (!store) return;

      const nodes = this.getAllNodes();
      const factionInfluence: Record<string, number> = {
        trade_union: 0,
        scavengers: 0,
        imperial_guard: 0,
        void_cult: 0
      };

      // 计算全局平均影响力
      nodes.forEach(node => {
        Object.entries(node.influence).forEach(([fId, val]) => {
          if (factionInfluence[fId] !== undefined) {
            factionInfluence[fId] += (val as number);
          }
        });
      });

      const nodeCount = nodes.length;
      Object.keys(factionInfluence).forEach(fId => {
        factionInfluence[fId] = Math.round(factionInfluence[fId] / nodeCount);
      });

      const activeEvents = this.getActiveStrategicEvents();
      const conflictIndex = Math.min(1.0, activeEvents.length / 10);
      
      // 生成情报流
      const intelligenceFeed = activeEvents.slice(0, 3).map(event => {
        const target = this.getStarNode(event.targetSectorId);
        const faction = event.factionId;
        const action = event.type === 'invasion' ? '全面入侵' : (event.type === 'raid' ? '突击劫掠' : '领土扩张');
        return `[WAR] ${faction.toUpperCase()} 正在${action} ${target?.name || '未知区域'}...`;
      });

      // 2026 Tech: 增加非战争类情报
      nodes.forEach(node => {
        if (intelligenceFeed.length >= 5) return;
        
        const marketState = (node as any).marketState;
        if (marketState && marketState.priceMultiplier < 1.0) {
          intelligenceFeed.push(`[TRADE] ${node.name} 正在进行贸易优惠，资源价格下降 20%。`);
        }
        
        if (node.type === 'resource' && Math.random() > 0.99) {
          intelligenceFeed.push(`[RESOURCE] 勘探队在 ${node.name} 发现了高纯度等离子矿脉。`);
        }
      });

      if (intelligenceFeed.length === 0) {
        intelligenceFeed.push("[SYSTEM] 银河各星区目前处于相对稳定状态。");
      }

      store.updateGalacticStatus({
        conflictIndex,
        tradeActivity: 0.4 + Math.random() * 0.2, // 模拟波动
        factionInfluence,
        intelligenceFeed,
        nodes,
        events: activeEvents,
        currentSectorId: this.currentSectorId
      });
    } catch (syncError) {
      console.warn('[GalaxyManager] syncStore failed:', syncError);
    }
  }

  /**
   * 生成程序化银河系拓扑结构。
   */
  private generateGalaxy(nodeCount: number): void {
    const nodes = GalaxyGenerator.generate(nodeCount);
    nodes.forEach(node => {
      this.starNodes.set(node.id, node as any);
    });
  }

  public getStarNode(id: string): StarNode | undefined {
    return this.starNodes.get(id);
  }

  public getAllNodes(): StarNode[] {
    return Array.from(this.starNodes.values());
  }

  /**
   * 当玩家在星区完成任务时，更新派系影响力。
   */
  public updateInfluence(sectorId: string, factionId: FactionId, delta: number): void {
    const node = this.starNodes.get(sectorId);
    if (!node) return;

    node.influence[factionId] = pc.math.clamp((node.influence[factionId] || 0) + delta, 0, 100);
    
    // 如果影响力超过 50% 且比当前统治者高，则易主
    let maxInf = 0;
    let newDominant = node.dominantFactionId;
    for (const [fId, inf] of Object.entries(node.influence)) {
      if (inf > maxInf) {
        maxInf = inf;
        newDominant = fId as FactionId;
      }
    }

    if (newDominant !== node.dominantFactionId) {
      console.log(`[GalaxyManager] Sector ${node.name} captured by ${newDominant}!`);
      node.dominantFactionId = newDominant;
      this.notifyChange();
    }
  }

  public subscribe(callback: () => void): () => void {
    this.changeListeners.add(callback);
    return () => this.changeListeners.delete(callback);
  }

  public notifyChange(): void {
    this.changeListeners.forEach(cb => cb());
  }

  public getCurrentSector(): StarNode | undefined {
    return this.starNodes.get(this.currentSectorId);
  }

  public setCurrentSector(id: string): void {
    this.currentSectorId = id;
    const node = this.starNodes.get(id);
    if (node) node.isDiscovered = true;
    
    // 2026 Tech: 立即同步到 Store，确保 UI (StarMap) 反应灵敏
    this.syncStore();
  }

  public getActiveStrategicEvents(): StrategicEvent[] {
    return this.strategicAI?.getActiveEvents() || [];
  }

  public getEventsForSector(sectorId: string): StrategicEvent[] {
    return this.strategicAI?.getEventsForSector(sectorId) || [];
  }

  public getStrategicAI(): StrategicAICore | null {
    return this.strategicAI;
  }

  /**
   * 2026 Tech: 更新市场状态。
   * 由战略 AI 调用，影响星区的贸易环境。
   */
  public updateMarketState(sectorId: string, state: { priceMultiplier: number; supply: number }): void {
    const node = this.starNodes.get(sectorId);
    if (node) {
      (node as any).marketState = state;
      this.notifyChange();
    }
  }
}
