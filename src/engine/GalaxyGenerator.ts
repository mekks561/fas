import { FactionId } from './FactionManager';
import { SectorConfig } from './SectorGenerator';

export interface StarNode {
  id: string;
  name: string;
  coords: { x: number; y: number };
  type: SectorConfig['type'];
  dominantFactionId: FactionId;
  influence: Record<FactionId, number>;
  connections: string[];
  difficulty: number;
  isDiscovered: boolean;
}

export class GalaxyGenerator {
  /**
   * 2026 Tech: 基于 LCG 的简单种子随机数生成器，确保 UI 与引擎生成的拓扑完全一致
   */
  private static seededRandom(seed: number): () => number {
    let m = 0x80000000; // 2**31
    let a = 1103515245;
    let c = 12345;
    let state = seed || Math.floor(Math.random() * (m - 1));

    return () => {
      state = (a * state + c) % m;
      return state / (m - 1);
    };
  }

  public static generate(nodeCount: number): StarNode[] {
    const random = this.seededRandom(20261025); // 固定种子
    const factions: FactionId[] = ['trade_union', 'scavengers', 'imperial_guard', 'void_cult'];
    const types: SectorConfig['type'][] = ['trade', 'hostile', 'resource', 'anomaly', 'neutral'];
    const nodes: StarNode[] = [];

    // 1. 生成节点
    for (let i = 0; i < nodeCount; i++) {
      const id = i === 0 ? 'solar-system-alpha' : `sector-${i}`;
      const angle = (i / nodeCount) * Math.PI * 2 * 3;
      const dist = 50 + i * 10;
      
      const node: StarNode = {
        id,
        name: i === 0 ? '始源星系 Alpha' : `星区 ${i.toString(16).toUpperCase()}`,
        coords: {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist
        },
        type: i === 0 ? 'neutral' : types[Math.floor(random() * types.length)],
        dominantFactionId: factions[Math.floor(random() * factions.length)],
        influence: {
          trade_union: 0,
          scavengers: 0,
          imperial_guard: 0,
          void_cult: 0,
          neutral: 0
        } as any,
        connections: [],
        difficulty: 1 + Math.floor(i / 10),
        isDiscovered: i === 0
      };

      node.influence[node.dominantFactionId] = 70 + random() * 30;
      nodes.push(node);
    }

    // 2. 建立连接
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const nearby = [...nodes]
        .filter(b => b.id !== a.id)
        .sort((b1, b2) => {
          const d1 = Math.pow(a.coords.x - b1.coords.x, 2) + Math.pow(a.coords.y - b1.coords.y, 2);
          const d2 = Math.pow(a.coords.x - b2.coords.x, 2) + Math.pow(a.coords.y - b2.coords.y, 2);
          return d1 - d2;
        })
        .slice(0, 3);

      nearby.forEach(b => {
        if (!a.connections.includes(b.id)) a.connections.push(b.id);
        if (!b.connections.includes(a.id)) b.connections.push(a.id);
      });
    }

    return nodes;
  }
}
