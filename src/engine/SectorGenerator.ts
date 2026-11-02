import { ARENA_SCALE } from './arena';

/**
 * 星区配置接口。
 * v2.7 跃迁式星区架构的核心定义。
 */
export interface SectorConfig {
  id: string;
  name: string;
  seed: string;
  type: 'neutral' | 'hostile' | 'trade' | 'resource' | 'unknown' | 'anomaly';
  visuals: {
    skybox: string;
    envHdri: string;
    nebulaColor: number[];
    fogDensity: number;
    anomalyPulse?: number; // 2026 Tech: 异常点脉冲频率
  };
  difficulty: number;
  factions: string[];
}

/**
 * 星区物体定义（陨石、资源点、装饰物）。
 */
export interface SectorObject {
  type: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: number;
  data?: any;
}

/**
 * 星区生成结果。
 */
export interface SectorGenerationResult {
  config: SectorConfig;
  objects: SectorObject[];
  jumpGates: {
    targetSectorId: string;
    position: [number, number, number];
  }[];
}

/**
 * 种子驱动的伪随机生成器 (Lcg)。
 * 确保相同种子的星区在不同客户端/次运行中生成一致。
 */
class Random {
  private seed: number;
  constructor(seed: string) {
    this.seed = this.hashString(seed);
  }

  private hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return h;
  }

  next(): number {
    this.seed = (Math.imul(1103515245, this.seed) + 12345) | 0;
    return (this.seed >>> 0) / 0xffffffff;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/**
 * v2.7 星区生成器核心逻辑。
 */
export class SectorGenerator {
  /**
   * 生成一个完整的星区内容。
   */
  public generate(config: SectorConfig): SectorGenerationResult {
    const rng = new Random(config.seed);
    const objects: SectorObject[] = [];

    // 1. 生成环境装饰 (星云/星点) - 维持 BACKDROP 比例但位置随机化
    this.generateBackdrop(rng, objects);

    // 2. 生成物理环境 (小行星/陨石带)
    this.generateAsteroids(rng, objects, config.difficulty);

    // 2026 Tech: 生成恒星 (Stars) - 戴森云建设的基础
    this.generateStar(rng, objects, config);

    // 3. 生成派系相关内容 (空间站/遗迹/资源点)
    this.generatePointsOfInterest(rng, objects, config);

    // 4. 生成资源矿产 (2026 动态资源系统)
    this.generateResources(rng, objects, config);

    // 6. 生成异常点 (Anomaly) - 仅在特定星区出现
    if (config.type === 'anomaly' || rng.next() > 0.8) {
      this.generateAnomalies(rng, objects, config);
    }

    // 2026 Tech: 生成黑洞 (Black Holes) - 仅在异常或未知星区极低概率出现
    if (config.type === 'anomaly' && rng.next() > 0.7) {
      this.generateBlackHoles(rng, objects, config);
    }

    // 2026 Tech: 生成远古遗迹 (Ancient Ruins)
    if (config.type === 'anomaly' && rng.next() > 0.6) {
      this.generateAncientRuins(rng, objects, config);
    }

    // 7. 生成派系 NPC 巡逻队
    this.generateNPCs(rng, objects, config);

    // 8. 生成跃迁门 (Jump Gates) - 固定 1-3 个
    const jumpGates = this.generateJumpGates(rng, config);

    return {
      config,
      objects,
      jumpGates,
    };
  }

  private generateBackdrop(rng: Random, objects: SectorObject[]) {
    // 随机化星云位置
    const nebulaCount = Math.floor(rng.range(2, 5));
    for (let i = 0; i < nebulaCount; i++) {
      objects.push({
        type: 'nebula',
        position: [rng.range(-100, 100), rng.range(-40, 40), rng.range(-100, 100)],
        rotation: [0, 0, 0, 1],
        scale: rng.range(30, 80) * ARENA_SCALE,
      });
    }
  }

  private generateAsteroids(rng: Random, objects: SectorObject[], difficulty: number) {
    const count = Math.floor(20 + difficulty * 10) * ARENA_SCALE;
    for (let i = 0; i < count; i++) {
      // 围绕中心区域的环形分布，但带点垂直偏移
      const radius = rng.range(60, 120) * ARENA_SCALE;
      const angle = rng.next() * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = rng.range(-30, 30) * ARENA_SCALE;

      objects.push({
        type: 'asteroid',
        position: [x, y, z],
        rotation: [rng.next(), rng.next(), rng.next(), rng.next()],
        scale: rng.range(1, 5) * ARENA_SCALE,
      });
    }
  }

  private generateStar(rng: Random, objects: SectorObject[], config: SectorConfig) {
    // 恒星通常位于中心区域，但也带点随机偏移
    const x = rng.range(-50, 50) * ARENA_SCALE;
    const y = rng.range(-20, 20) * ARENA_SCALE;
    const z = rng.range(-50, 50) * ARENA_SCALE;
    
    // 恒星颜色随星区类型变化
    let starColor = [1.0, 0.9, 0.5]; // 默认黄白
    if (config.type === 'hostile') starColor = [1.0, 0.3, 0.1]; // 红巨星
    if (config.type === 'anomaly') starColor = [0.4, 0.6, 1.0]; // 蓝矮星
    if (config.type === 'resource') starColor = [1.0, 0.7, 0.2]; // 橙色恒星

    objects.push({
      type: 'star',
      position: [x, y, z],
      rotation: [0, 0, 0, 1],
      scale: rng.range(15, 25) * ARENA_SCALE,
      data: {
        color: starColor,
        intensity: rng.range(2.0, 4.0)
      }
    });
  }

  private generatePointsOfInterest(rng: Random, objects: SectorObject[], config: SectorConfig) {
    // 贸易星区必有空间站
    if (config.type === 'trade') {
      objects.push({
        type: 'space_station',
        position: [rng.range(-30, 30), rng.range(-10, 10), rng.range(-30, 30)],
        rotation: [0, Math.sin(rng.next() * Math.PI), 0, Math.cos(rng.next() * Math.PI)],
        scale: 2.5 * ARENA_SCALE,
      });
    }

    // 资源星区有矿点
    if (config.type === 'resource') {
      const oreCount = Math.floor(rng.range(3, 8));
      for (let i = 0; i < oreCount; i++) {
        objects.push({
          type: 'resource_crystal',
          position: [rng.range(-80, 80), rng.range(-20, 20), rng.range(-80, 80)],
          rotation: [rng.next(), rng.next(), rng.next(), rng.next()],
          scale: rng.range(0.5, 1.5) * ARENA_SCALE,
        });
      }
    }
  }

  private generateResources(rng: Random, objects: SectorObject[], config: SectorConfig) {
    const resourceCount = Math.floor(rng.range(5, 15));
    for (let i = 0; i < resourceCount; i++) {
      const radius = rng.range(50, 100) * ARENA_SCALE;
      const angle = rng.next() * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = rng.range(-20, 20) * ARENA_SCALE;

      objects.push({
        type: 'resource_crystal',
        position: [x, y, z],
        rotation: [rng.next(), rng.next(), rng.next(), rng.next()],
        scale: rng.range(0.8, 2.0) * ARENA_SCALE,
        data: {
          resourceType: rng.next() > 0.7 ? 'plasma' : 'iron',
          value: Math.floor(rng.range(100, 500))
        }
      });
    }
  }

  private generateAnomalies(rng: Random, objects: SectorObject[], config: SectorConfig) {
    const anomalyCount = config.type === 'anomaly' ? Math.floor(rng.range(2, 5)) : 1;
    for (let i = 0; i < anomalyCount; i++) {
      const radius = rng.range(40, 150) * ARENA_SCALE;
      const angle = rng.next() * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = rng.range(-40, 40) * ARENA_SCALE;

      objects.push({
        type: 'anomaly',
        position: [x, y, z],
        rotation: [rng.next(), rng.next(), rng.next(), rng.next()],
        scale: rng.range(5, 12) * ARENA_SCALE,
        data: {
          anomalyType: rng.next() > 0.5 ? 'wormhole_fragment' : 'energy_rift',
          dangerLevel: config.difficulty * 1.5,
          rewardFactor: rng.range(2, 5)
        }
      });
    }
  }

  private generateBlackHoles(rng: Random, objects: SectorObject[], config: SectorConfig) {
    // 黑洞通常位于星区中心附近，且一个星区最多一个
    objects.push({
      type: 'black_hole',
      position: [rng.range(-20, 20), rng.range(-10, 10), rng.range(-20, 20)],
      rotation: [0, 0, 0, 1],
      scale: 1.0, // 内部逻辑处理实际物理半径
      data: {
        mass: rng.range(500, 2000),
        rotationSpeed: rng.range(0.1, 0.5)
      }
    });
  }

  private generateAncientRuins(rng: Random, objects: SectorObject[], config: SectorConfig) {
    objects.push({
      type: 'ancient_ruins',
      position: [rng.range(-150, 150), rng.range(-30, 30), rng.range(-150, 150)],
      rotation: [0, rng.next() * Math.PI, 0, 1],
      scale: 1.0,
      data: {
        complexity: Math.floor(rng.range(1, 4))
      }
    });
  }

  private generateNPCs(rng: Random, objects: SectorObject[], config: SectorConfig) {
    // 根据星区派系生成巡逻小组
    for (const faction of config.factions) {
      const squadCount = Math.floor(rng.range(1, 3));
      for (let i = 0; i < squadCount; i++) {
        const radius = rng.range(60, 150) * ARENA_SCALE;
        const angle = rng.next() * Math.PI * 2;
        const leaderPos = [Math.cos(angle) * radius, rng.range(-10, 10), Math.sin(angle) * radius];
        
        objects.push({
          type: 'npc_squad',
          position: leaderPos as [number, number, number],
          rotation: [0, 0, 0, 1],
          scale: 1.0 * ARENA_SCALE,
          data: { 
            factionId: faction,
            memberCount: Math.floor(rng.range(2, 4))
          }
        });
      }
    }
  }

  private generateJumpGates(rng: Random, config: SectorConfig) {
    const gateCount = Math.floor(rng.range(1, 4));
    const gates = [];
    const radius = 140 * ARENA_SCALE;

    for (let i = 0; i < gateCount; i++) {
      const angle = (i / gateCount) * Math.PI * 2 + rng.range(-0.5, 0.5);
      gates.push({
        targetSectorId: `next-${config.id}-${i}`, // 占位符 ID，由 SectorManager 填充
        position: [
          Math.cos(angle) * radius,
          rng.range(-20, 20),
          Math.sin(angle) * radius,
        ] as [number, number, number],
      });
    }
    return gates;
  }
}
