import { PluginContext } from './PluginSystem';
import { useGameStore } from '../store/useGameStore';

export interface Commodity {
  id: string;
  name: string;
  basePrice: number;
  currentPrice: number;
  volatility: number;
  category: 'mineral' | 'technology' | 'luxury' | 'essential';
}

/**
 * 2026 Tech: 动态贸易系统。
 * 模拟星际市场波动，受星区事件与派系冲突影响。
 */
export class TradeManager {
  public name = 'TradeManager';
  public version = '2.7.0';

  private commodities: Map<string, Commodity> = new Map();
  private lastUpdate: number = 0;
  private updateInterval: number = 30; // 每30秒模拟一次价格波动
  private context: PluginContext | null = null;

  public init(context: PluginContext): void {
    this.context = context;
    this.initMarket();
    this.lastUpdate = Date.now();
    console.log('[TradeManager] Dynamic Trade System initialized.');
  }

  private initMarket(): void {
    this.commodities.set('iron', {
      id: 'iron',
      name: '铁矿石',
      basePrice: 50,
      currentPrice: 50,
      volatility: 0.05,
      category: 'mineral',
    });
    this.commodities.set('plasma', {
      id: 'plasma',
      name: '等离子体',
      basePrice: 200,
      currentPrice: 200,
      volatility: 0.15,
      category: 'technology',
    });
    this.commodities.set('neural_link', {
      id: 'neural_link',
      name: '神经链接器',
      basePrice: 1500,
      currentPrice: 1500,
      volatility: 0.25,
      category: 'technology',
    });
    this.commodities.set('space_wine', {
      id: 'space_wine',
      name: '深空佳酿',
      basePrice: 500,
      currentPrice: 500,
      volatility: 0.3,
      category: 'luxury',
    });
  }

  public onUpdate(_dt: number): void {
    const now = Date.now();
    if (now - this.lastUpdate > this.updateInterval * 1000) {
      this.simulateMarketFluctuation();
      this.lastUpdate = now;
    }
  }

  private simulateMarketFluctuation(): void {
    const app = this.context?.app as any;
    const galaxyManager = app?.['galaxyManager'];
    const currentSectorId = galaxyManager?.getCurrentSector()?.id;
    const activeEvents = galaxyManager?.getStrategicAI?.()?.getActiveEvents() || [];

    this.commodities.forEach((c) => {
      let eventMultiplier = 1.0;

      // 2026 Tech: 战略事件对价格的宏观影响
      activeEvents.forEach((e: any) => {
        if (e.targetSectorId === currentSectorId) {
          if (e.type === 'invasion' || e.type === 'raid') {
            // 战争期间：必需品与技术价格飙升，奢侈品价格暴跌
            if (c.category === 'essential' || c.category === 'technology') eventMultiplier *= 1.5;
            if (c.category === 'luxury') eventMultiplier *= 0.6;
          }
        }
      });

      const change = (Math.random() - 0.5) * 2 * c.volatility * c.basePrice;
      c.currentPrice = Math.max(c.basePrice * 0.5, (c.currentPrice + change) * eventMultiplier);
    });

    console.log('[TradeManager] Market prices updated with strategic awareness.');
  }

  public getPrice(id: string): number {
    const commodity = this.commodities.get(id);
    if (!commodity) return 0;

    let price = commodity.currentPrice;

    // 2026 Tech: 派系声望影响价格
    const app = this.context?.app;
    const sectorManager = (app as any)?.[
      'sectorManager'
    ] as import('./SectorManager').SectorManager;
    const factionManager = (app as any)?.[
      'factionManager'
    ] as import('./FactionManager').FactionManager;

    if (sectorManager && factionManager) {
      const currentSector = sectorManager.getCurrentSector();
      if (currentSector) {
        const dominant = factionManager.getDominantFaction(currentSector.config.id);
        const multiplier = factionManager.getReputationMultiplier(dominant.id);
        price *= multiplier;
      }
    }

    return price;
  }

  public getMarket(): Commodity[] {
    return Array.from(this.commodities.values());
  }

  /**
   * 2026 Tech: 自动化贸易结算。
   * 玩家靠近空间站时可触发资源出售。
   */
  public sellCommodity(id: string, count: number): boolean {
    const commodity = this.commodities.get(id);
    if (!commodity) return false;

    const store = useGameStore.getState();
    const inventoryCount = store.inventory[id] || 0;

    if (inventoryCount < count) return false;

    const totalEarning = Math.floor(commodity.currentPrice * count);
    store.removeItem(id, count);
    store.addCurrency(totalEarning);

    console.log(`[TradeManager] Sold ${count}x ${commodity.name} for ${totalEarning} credits.`);
    return true;
  }
}
