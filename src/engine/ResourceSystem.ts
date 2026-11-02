import * as pc from 'playcanvas';
import { PluginContext } from './PluginSystem';

export enum ResourceType {
  IRON = 'iron',
  GOLD = 'gold',
  CRYSTAL = 'crystal',
  PLASMA = 'plasma',
  ANCIENT_TECH = 'ancient_tech',
}

export interface ResourceItem {
  type: ResourceType;
  amount: number;
  value: number;
}

/**
 * 2026 Tech: 动态资源与经济系统。
 * 管理玩家的货舱、资源采集以及星际贸易价格。
 */
export class ResourceSystem {
  public name = 'ResourceSystem';
  public version = '2.7.0';

  private cargo: Map<ResourceType, number> = new Map();
  private maxCargoCapacity: number = 1000;
  private currentCargoVolume: number = 0;

  private marketPrices: Map<ResourceType, number> = new Map();
  private context: PluginContext | null = null;
  private resources: pc.Entity[] = [];

  public init(context: PluginContext): void {
    this.context = context;
    this.initMarket();
    console.log('[ResourceSystem] Dynamic Economy initialized.');
  }

  public setResources(resources: pc.Entity[]): void {
    this.resources = resources;
    console.log(`[ResourceSystem] Tracked ${resources.length} resource nodes.`);
  }

  public update(dt: number): void {
    // 自动吸取靠近玩家的资源水晶
    if (!this.context || this.resources.length === 0) return;

    const player = (this.context.app as any)['player'] as import('./PlayerShip').PlayerShip;
    if (!player) return;

    const playerPos = player.getPosition();

    this.resources = this.resources.filter((entity) => {
      if (!entity.parent) return false;

      const pos = entity.getPosition();
      const dist = pos.distance(playerPos);

      if (dist < 10.0) {
        // 吸取半径
        const dir = playerPos.clone().sub(pos).normalize();
        pos.add(dir.scale(20.0 * dt)); // 吸取速度
        entity.setPosition(pos);

        if (dist < 2.0) {
          // 采集半径
          const data = (entity as any).userData;
          if (data && data.resourceType) {
            this.addResource(data.resourceType, data.amount || 10);

            // 播放采集音效与特效
            const engine = (this.context?.app as any)?.['engine'];
            engine?.addParticleSystem(entity.clone(), {
              lifetime: 0.5,
              numParticles: 10,
              colorGraph: new pc.CurveSet([
                [1, 1, 0],
                [0.5, 0.5, 0],
                [0, 0, 0],
              ]),
            });
          }
          entity.destroy();
          return false;
        }
      }
      return true;
    });
  }

  private initMarket(): void {
    this.marketPrices.set(ResourceType.IRON, 10);
    this.marketPrices.set(ResourceType.GOLD, 50);
    this.marketPrices.set(ResourceType.CRYSTAL, 100);
    this.marketPrices.set(ResourceType.PLASMA, 250);
    this.marketPrices.set(ResourceType.ANCIENT_TECH, 1000);
  }

  public addResource(type: ResourceType, amount: number): boolean {
    if (this.currentCargoVolume + amount > this.maxCargoCapacity) {
      console.warn('[ResourceSystem] Cargo full!');
      return false;
    }

    const current = this.cargo.get(type) || 0;
    this.cargo.set(type, current + amount);
    this.currentCargoVolume += amount;

    this.notifyUI();
    return true;
  }

  public getResourceAmount(type: ResourceType): number {
    return this.cargo.get(type) || 0;
  }

  public getMarketPrice(type: ResourceType): number {
    // 2026 Tech: 物价随库存波动（简单模拟）
    const basePrice = this.marketPrices.get(type) || 0;
    const inventoryMult = 1.0 - (this.currentCargoVolume / this.maxCargoCapacity) * 0.2;
    return Math.floor(basePrice * inventoryMult);
  }

  public sellResource(type: ResourceType, amount: number): number {
    const current = this.cargo.get(type) || 0;
    const sellAmount = Math.min(current, amount);

    if (sellAmount <= 0) return 0;

    const price = this.getMarketPrice(type);
    const totalGold = sellAmount * price;

    this.cargo.set(type, current - sellAmount);
    this.currentCargoVolume -= sellAmount;

    // 2026 Tech: 给玩家增加信用点 (使用 useGameStore)
    const store = (window as any).useGameStore?.getState();
    if (store) {
      store.addCurrency(totalGold);
      console.log(`[ResourceSystem] Sold ${sellAmount} ${type} for ${totalGold} credits.`);
    } else {
      console.warn('[ResourceSystem] useGameStore not found, credits not added.');
    }

    this.notifyUI();
    return totalGold;
  }

  private notifyUI(): void {
    if (!this.context) return;
    this.context.app.fire('ui:cargoUpdated', {
      cargo: Array.from(this.cargo.entries()),
      volume: this.currentCargoVolume,
      capacity: this.maxCargoCapacity,
    });
  }

  public getStatus() {
    return {
      volume: this.currentCargoVolume,
      capacity: this.maxCargoCapacity,
      items: Array.from(this.cargo.entries()),
    };
  }
}
