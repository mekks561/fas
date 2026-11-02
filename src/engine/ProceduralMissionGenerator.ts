import { Mission, MissionObjective } from './StoryMissionManager';
import { SectorConfig } from './SectorGenerator';
import { FactionManager } from './FactionManager';
import { StrategicEvent } from './StrategicAICore';

/**
 * 2026 Tech: 程序化任务生成器。
 * 根据星区类型、难度、派系声望及战略局势动态生成任务。
 */
export class ProceduralMissionGenerator {
  public static generateMission(
    sector: SectorConfig,
    factionManager: FactionManager,
    strategicEvents: StrategicEvent[] = [],
  ): Mission {
    const dominant = factionManager.getDominantFaction(sector.id);
    const reputation = factionManager.getFaction(dominant.id)?.reputation || 0;

    const missionType = this.determineMissionType(sector, reputation, strategicEvents);
    const objectives = this.generateObjectives(missionType, sector);

    return {
      id: `proc-mission-${Date.now()}`,
      name: this.generateMissionName(missionType, dominant.name),
      description: this.generateDescription(missionType, dominant.name, sector.name),
      type: 'side',
      category: this.mapTypeToCategory(missionType),
      objectives,
      rewards: {
        experience: 500 * sector.difficulty,
        credits: 1000 * sector.difficulty,
        items: [],
      },
      prerequisites: [],
    };
  }

  private static determineMissionType(
    sector: SectorConfig,
    reputation: number,
    strategicEvents: StrategicEvent[],
  ): string {
    // 2026 Tech: 战略前线任务优先
    const invasion = strategicEvents.find((e) => e.type === 'invasion');
    if (invasion) {
      return Math.random() > 0.5 ? 'frontline_defense' : 'frontline_intercept';
    }

    const raid = strategicEvents.find((e) => e.type === 'raid');
    if (raid) return 'clear_sector';

    if (reputation < -30) return 'bounty_survive';
    if (sector.type === 'resource') return 'collect_minerals';
    if (sector.type === 'hostile') {
      const rand = Math.random();
      if (rand > 0.7) return 'base_raid';
      return 'clear_sector';
    }
    if (sector.type === 'trade') {
      const rand = Math.random();
      if (rand > 0.6) return 'escort_merchant';
      return 'patrol';
    }

    if (sector.type === 'anomaly') {
      const rand = Math.random();
      if (rand > 0.8 && sector.difficulty >= 5) return 'void_lord_boss';
      return 'nebula_infiltration';
    }

    return 'patrol';
  }

  private static generateObjectives(type: string, sector: SectorConfig): MissionObjective[] {
    const difficulty = sector.difficulty;
    switch (type) {
      case 'frontline_defense':
        return [
          {
            type: 'survive',
            duration: 120 * difficulty, // 前线防守需要坚持更久
            current: 0,
            completed: false,
          },
        ];
      case 'frontline_intercept':
        return [
          {
            type: 'destroy',
            target: 'enemy_cruiser', // 拦截任务通常包含巨型舰船
            count: 1,
            current: 0,
            completed: false,
          },
        ];
      case 'collect_minerals':
        return [
          {
            type: 'collect',
            count: Math.floor(5 * difficulty),
            current: 0,
            completed: false,
          },
        ];
      case 'clear_sector':
        return [
          {
            type: 'destroy',
            count: Math.floor(10 * difficulty),
            current: 0,
            completed: false,
          },
        ];
      case 'bounty_survive':
        return [
          {
            type: 'survive',
            duration: 60 * difficulty,
            current: 0,
            completed: false,
          },
        ];
      case 'escort_merchant':
        return [
          {
            type: 'escort',
            target: 'merchant_convoy',
            current: 0,
            completed: false,
          },
        ];
      case 'base_raid':
        return [
          {
            type: 'destroy',
            target: 'outpost_core',
            count: 1,
            current: 0,
            completed: false,
          },
        ];
      case 'nebula_infiltration':
        return [
          {
            type: 'survive',
            duration: 45 * difficulty,
            current: 0,
            completed: false,
          },
        ];
      case 'void_lord_boss':
        return [
          {
            type: 'destroy',
            target: 'void_lord',
            count: 1,
            current: 0,
            completed: false,
          },
        ];
      default:
        return [
          {
            type: 'reach',
            current: 0,
            completed: false,
          },
        ];
    }
  }

  private static generateMissionName(type: string, factionName: string): string {
    const names: Record<string, string> = {
      frontline_defense: `前线要塞保卫战`,
      frontline_intercept: `拦截${factionName}折跃编队`,
      collect_minerals: `${factionName}的资源请求`,
      clear_sector: `${factionName}的扫荡令`,
      escort_merchant: `护送${factionName}商队`,
      patrol: `星区巡逻`,
      bounty_survive: `赏金猎人的追捕`,
      base_raid: `摧毁${factionName}的前哨站`,
      nebula_infiltration: `星云潜入行动`,
      void_lord_boss: `【终极威胁】虚空之主降临`,
    };
    return names[type] || '未知任务';
  }

  private static generateDescription(
    type: string,
    factionName: string,
    sectorName: string,
  ): string {
    const descriptions: Record<string, string> = {
      frontline_defense: `在 ${sectorName} 的前线坚持住，直到援军抵达。`,
      frontline_intercept: `${factionName} 的增援正在前往 ${sectorName}，在他们汇合前将其拦截！`,
      collect_minerals: `在 ${sectorName} 采集矿石以支援 ${factionName}。`,
      clear_sector: `清理 ${sectorName} 中的敌对势力。`,
      escort_merchant: `保护 ${factionName} 的商队安全穿过 ${sectorName}。`,
      patrol: `在 ${sectorName} 执行常规巡逻。`,
      bounty_survive: `你在 ${sectorName} 被盯上了，活下去！`,
      base_raid: `突袭 ${sectorName} 中的敌方据点。`,
      nebula_infiltration: `利用 ${sectorName} 的星云掩护执行秘密行动。`,
      void_lord_boss: `监测到 ${sectorName} 出现极高能级坍缩，虚空之主正在降临。摧毁它，否则整个星系都将被吞噬！`,
    };
    return descriptions[type] || `在 ${sectorName} 执行由 ${factionName} 发起的任务。`;
  }

  private static mapTypeToCategory(type: string): any {
    if (
      type === 'clear_sector' ||
      type === 'base_raid' ||
      type === 'frontline_intercept' ||
      type === 'void_lord_boss'
    )
      return 'destroy';
    if (type === 'collect_minerals') return 'collect';
    if (type === 'bounty_survive' || type === 'nebula_infiltration' || type === 'frontline_defense')
      return 'survive';
    if (type === 'escort_merchant') return 'escort';
    return 'destroy';
  }
}
