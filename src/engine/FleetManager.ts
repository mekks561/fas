import * as pc from 'playcanvas';
import { PluginContext } from './PluginSystem';
import { NPC, NPCBehavior } from './NPCManager';
import { PlayerShip } from './PlayerShip';

/**
 * 2026 Tech: 舰队指挥系统 (Fleet Command System)。
 * 允许玩家管理随从 NPC，并下达战术指令。
 */
export class FleetManager {
  public name = 'FleetManager';
  public version = '3.0.0';

  private context: PluginContext | null = null;
  private player: PlayerShip | null = null;
  private wingmen: NPC[] = [];
  private maxWingmen: number = 3;

  public init(context: PluginContext): void {
    this.context = context;
    console.log('[FleetManager] Command Link established.');
  }

  public recruitWingman(npc: NPC): boolean {
    if (this.wingmen.length >= this.maxWingmen) {
      console.warn('[FleetManager] Fleet full!');
      return false;
    }

    if (!this.wingmen.includes(npc)) {
      this.wingmen.push(npc);
      npc.setBehavior(NPCBehavior.FOLLOW);
      console.log(`[FleetManager] NPC recruited. Total wingmen: ${this.wingmen.length}`);
      
      // 同步到 UI Store
      this.updateStore();
      return true;
    }
    return false;
  }

  public issueCommand(command: 'follow' | 'attack' | 'guard' | 'wait'): void {
    console.log(`[FleetManager] Issuing fleet command: ${command}`);
    
    this.wingmen.forEach(npc => {
      switch(command) {
        case 'follow':
          npc.setBehavior(NPCBehavior.FOLLOW);
          break;
        case 'attack':
          // 攻击玩家当前锁定的目标 (假设锁定系统已存在)
          npc.setBehavior(NPCBehavior.ATTACK);
          break;
        case 'guard':
          npc.setBehavior(NPCBehavior.ESCORT);
          break;
        case 'wait':
          npc.setBehavior(NPCBehavior.IDLE);
          break;
      }
    });
  }

  private updateStore(): void {
    const store = (window as any).useGameStore?.getState();
    if (store) {
      store.setPlayerFleet?.(this.wingmen.map(w => ({
        id: (w as any).id || Math.random().toString(),
        faction: (w as any).factionId,
        health: 100 // 简化
      })));
    }
  }

  public onUpdate(dt: number): void {
    if (!this.player && this.context?.app) {
      this.player = (this.context.app as any)._player;
    }

    // 移除已阵亡的随从
    const aliveWingmen = this.wingmen.filter(w => (w as any).isAlive?.() !== false);
    if (aliveWingmen.length !== this.wingmen.length) {
      this.wingmen = aliveWingmen;
      this.updateStore();
    }
  }

  public getWingmen(): NPC[] {
    return this.wingmen;
  }

  public clear(): void {
    this.wingmen = [];
    this.updateStore();
  }
}
