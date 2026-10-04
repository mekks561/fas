export type TalentId = string;

export type TalentType = 'offensive' | 'defensive' | 'utility' | 'support';

export type TalentEffectType =
  | 'damage_bonus'
  | 'fire_rate_bonus'
  | 'health_bonus'
  | 'shield_bonus'
  | 'speed_bonus'
  | 'cooldown_reduction'
  | 'heal_effectiveness'
  | 'shield_effectiveness'
  | 'critical_chance'
  | 'critical_damage'
  | 'energy_regen'
  | 'boost_effectiveness'
  | 'skill_damage'
  | 'skill_duration'
  | 'skill_cooldown';

export interface TalentEffect {
  type: TalentEffectType;
  value: number;
  perLevel?: number;
  description: string;
}

export interface TalentNode {
  id: TalentId;
  name: string;
  description: string;
  icon: string;
  type: TalentType;
  maxLevel: number;
  costPerLevel: number;
  position: { x: number; y: number };
  effects: TalentEffect[];
  prerequisites: TalentId[];
  unlockLevel: number;
  isHidden?: boolean;
}

export interface TalentState {
  nodeId: TalentId;
  level: number;
  isUnlocked: boolean;
}

export interface SkillTreeStats {
  damageBonus: number;
  fireRateBonus: number;
  healthBonus: number;
  shieldBonus: number;
  speedBonus: number;
  cooldownReduction: number;
  healEffectiveness: number;
  shieldEffectiveness: number;
  criticalChance: number;
  criticalDamage: number;
  energyRegen: number;
  boostEffectiveness: number;
  skillDamageBonus: Record<string, number>;
  skillDurationBonus: Record<string, number>;
  skillCooldownReduction: Record<string, number>;
}

export class SkillTreeManager {
  private static instance: SkillTreeManager | null = null;

  private talentNodes: Map<TalentId, TalentNode> = new Map();
  private talentStates: Map<TalentId, TalentState> = new Map();
  private playerLevel: number = 1;
  private talentPoints: number = 0;
  private stats: SkillTreeStats = this.createDefaultStats();

  private storageKey = 'skillTreeData';

  private constructor() {
    this.initializeTalentNodes();
    this.loadState();
  }

  public static getInstance(): SkillTreeManager {
    if (!SkillTreeManager.instance) {
      SkillTreeManager.instance = new SkillTreeManager();
    }
    return SkillTreeManager.instance;
  }

  private createDefaultStats(): SkillTreeStats {
    return {
      damageBonus: 0,
      fireRateBonus: 0,
      healthBonus: 0,
      shieldBonus: 0,
      speedBonus: 0,
      cooldownReduction: 0,
      healEffectiveness: 0,
      shieldEffectiveness: 0,
      criticalChance: 0,
      criticalDamage: 0,
      energyRegen: 0,
      boostEffectiveness: 0,
      skillDamageBonus: {},
      skillDurationBonus: {},
      skillCooldownReduction: {},
    };
  }

  private initializeTalentNodes(): void {
    const nodes: TalentNode[] = [
      {
        id: 'offensive_mastery',
        name: '攻击精通',
        description: '提升基础武器伤害',
        icon: 'sword',
        type: 'offensive',
        maxLevel: 5,
        costPerLevel: 1,
        position: { x: 0, y: 0 },
        effects: [
          {
            type: 'damage_bonus',
            value: 5,
            perLevel: 5,
            description: '伤害提升 {value}%',
          },
        ],
        prerequisites: [],
        unlockLevel: 1,
      },
      {
        id: 'rapid_fire',
        name: '速射',
        description: '提升武器射速',
        icon: 'crosshair',
        type: 'offensive',
        maxLevel: 5,
        costPerLevel: 1,
        position: { x: 1, y: 0 },
        effects: [
          {
            type: 'fire_rate_bonus',
            value: 5,
            perLevel: 5,
            description: '射速提升 {value}%',
          },
        ],
        prerequisites: ['offensive_mastery'],
        unlockLevel: 2,
      },
      {
        id: 'critical_eye',
        name: '暴击之眼',
        description: '提升暴击几率',
        icon: 'target',
        type: 'offensive',
        maxLevel: 3,
        costPerLevel: 2,
        position: { x: 2, y: 0 },
        effects: [
          {
            type: 'critical_chance',
            value: 3,
            perLevel: 3,
            description: '暴击率提升 {value}%',
          },
          {
            type: 'critical_damage',
            value: 10,
            perLevel: 10,
            description: '暴击伤害提升 {value}%',
          },
        ],
        prerequisites: ['rapid_fire'],
        unlockLevel: 5,
      },
      {
        id: 'precision_strike',
        name: '精准打击',
        description: '技能伤害提升',
        icon: 'zap',
        type: 'offensive',
        maxLevel: 3,
        costPerLevel: 2,
        position: { x: 3, y: 0 },
        effects: [
          {
            type: 'skill_damage',
            value: 10,
            perLevel: 10,
            description: '技能伤害提升 {value}%',
          },
        ],
        prerequisites: ['critical_eye'],
        unlockLevel: 8,
      },
      {
        id: 'defensive_mastery',
        name: '防御精通',
        description: '提升最大生命值',
        icon: 'heart',
        type: 'defensive',
        maxLevel: 5,
        costPerLevel: 1,
        position: { x: 0, y: 1 },
        effects: [
          {
            type: 'health_bonus',
            value: 10,
            perLevel: 10,
            description: '生命值提升 {value}%',
          },
        ],
        prerequisites: [],
        unlockLevel: 1,
      },
      {
        id: 'shield_expertise',
        name: '护盾专精',
        description: '提升护盾容量和恢复效果',
        icon: 'shield',
        type: 'defensive',
        maxLevel: 5,
        costPerLevel: 1,
        position: { x: 1, y: 1 },
        effects: [
          {
            type: 'shield_bonus',
            value: 10,
            perLevel: 10,
            description: '护盾容量提升 {value}%',
          },
          {
            type: 'shield_effectiveness',
            value: 5,
            perLevel: 5,
            description: '护盾效果提升 {value}%',
          },
        ],
        prerequisites: ['defensive_mastery'],
        unlockLevel: 2,
      },
      {
        id: 'vitality_aura',
        name: '生命光环',
        description: '提升治疗效果和能量回复',
        icon: 'sparkles',
        type: 'defensive',
        maxLevel: 3,
        costPerLevel: 2,
        position: { x: 2, y: 1 },
        effects: [
          {
            type: 'heal_effectiveness',
            value: 15,
            perLevel: 15,
            description: '治疗效果提升 {value}%',
          },
          {
            type: 'energy_regen',
            value: 10,
            perLevel: 10,
            description: '能量回复提升 {value}%',
          },
        ],
        prerequisites: ['shield_expertise'],
        unlockLevel: 5,
      },
      {
        id: 'iron_will',
        name: '钢铁意志',
        description: '减少技能冷却时间',
        icon: 'clock',
        type: 'defensive',
        maxLevel: 3,
        costPerLevel: 2,
        position: { x: 3, y: 1 },
        effects: [
          {
            type: 'cooldown_reduction',
            value: 5,
            perLevel: 5,
            description: '技能冷却减少 {value}%',
          },
        ],
        prerequisites: ['vitality_aura'],
        unlockLevel: 8,
      },
      {
        id: 'agility_mastery',
        name: '敏捷精通',
        description: '提升移动速度',
        icon: 'wind',
        type: 'utility',
        maxLevel: 5,
        costPerLevel: 1,
        position: { x: 0, y: 2 },
        effects: [
          {
            type: 'speed_bonus',
            value: 5,
            perLevel: 5,
            description: '移动速度提升 {value}%',
          },
        ],
        prerequisites: [],
        unlockLevel: 1,
      },
      {
        id: 'boost_amplifier',
        name: '推进增幅',
        description: '提升加速效果',
        icon: 'rocket',
        type: 'utility',
        maxLevel: 5,
        costPerLevel: 1,
        position: { x: 1, y: 2 },
        effects: [
          {
            type: 'boost_effectiveness',
            value: 10,
            perLevel: 10,
            description: '加速效果提升 {value}%',
          },
        ],
        prerequisites: ['agility_mastery'],
        unlockLevel: 2,
      },
      {
        id: 'temporal_control',
        name: '时间掌控',
        description: '延长技能持续时间',
        icon: 'time',
        type: 'utility',
        maxLevel: 3,
        costPerLevel: 2,
        position: { x: 2, y: 2 },
        effects: [
          {
            type: 'skill_duration',
            value: 10,
            perLevel: 10,
            description: '技能持续时间提升 {value}%',
          },
        ],
        prerequisites: ['boost_amplifier'],
        unlockLevel: 5,
      },
      {
        id: 'skill_specialization',
        name: '技能专精',
        description: '减少技能冷却时间',
        icon: 'skill',
        type: 'utility',
        maxLevel: 3,
        costPerLevel: 2,
        position: { x: 3, y: 2 },
        effects: [
          {
            type: 'skill_cooldown',
            value: 10,
            perLevel: 10,
            description: '技能冷却减少 {value}%',
          },
        ],
        prerequisites: ['temporal_control'],
        unlockLevel: 8,
      },
    ];

    nodes.forEach((node) => {
      this.talentNodes.set(node.id, node);
      this.talentStates.set(node.id, {
        nodeId: node.id,
        level: 0,
        isUnlocked: false,
      });
    });
  }

  public setPlayerLevel(level: number): void {
    const oldLevel = this.playerLevel;
    this.playerLevel = level;

    const pointsToAdd = Math.max(0, level - oldLevel);
    this.talentPoints += pointsToAdd;

    this.checkUnlocks();
    this.saveState();
  }

  public getPlayerLevel(): number {
    return this.playerLevel;
  }

  public getTalentPoints(): number {
    return this.talentPoints;
  }

  public getTalentNodes(): TalentNode[] {
    return Array.from(this.talentNodes.values());
  }

  public getTalentNode(id: TalentId): TalentNode | undefined {
    return this.talentNodes.get(id);
  }

  public getTalentState(id: TalentId): TalentState | undefined {
    return this.talentStates.get(id);
  }

  public getAllTalentStates(): TalentState[] {
    return Array.from(this.talentStates.values());
  }

  public canUpgradeTalent(id: TalentId): boolean {
    const node = this.talentNodes.get(id);
    const state = this.talentStates.get(id);

    if (!node || !state) return false;
    if (state.level >= node.maxLevel) return false;
    if (this.talentPoints < node.costPerLevel) return false;
    if (!this.isTalentUnlocked(id)) return false;

    return this.arePrerequisitesMet(id);
  }

  public isTalentUnlocked(id: TalentId): boolean {
    const node = this.talentNodes.get(id);
    if (!node) return false;
    if (this.playerLevel < node.unlockLevel) return false;
    return true;
  }

  public arePrerequisitesMet(id: TalentId): boolean {
    const node = this.talentNodes.get(id);
    if (!node) return false;

    for (const prereqId of node.prerequisites) {
      const prereqState = this.talentStates.get(prereqId);
      if (!prereqState || prereqState.level === 0) {
        return false;
      }
    }

    return true;
  }

  public upgradeTalent(id: TalentId): boolean {
    if (!this.canUpgradeTalent(id)) return false;

    const node = this.talentNodes.get(id)!;
    const state = this.talentStates.get(id)!;

    this.talentPoints -= node.costPerLevel;
    state.level++;
    state.isUnlocked = true;

    this.updateStats();
    this.saveState();

    return true;
  }

  public downgradeTalent(id: TalentId): boolean {
    const node = this.talentNodes.get(id);
    const state = this.talentStates.get(id);

    if (!node || !state) return false;
    if (state.level === 0) return false;

    const dependentNodes = this.getDependentNodes(id);
    for (const depId of dependentNodes) {
      const depState = this.talentStates.get(depId);
      if (depState && depState.level > 0) {
        return false;
      }
    }

    state.level--;
    if (state.level === 0) {
      state.isUnlocked = false;
    }
    this.talentPoints += node.costPerLevel;

    this.updateStats();
    this.saveState();

    return true;
  }

  private getDependentNodes(id: TalentId): TalentId[] {
    const dependents: TalentId[] = [];

    for (const [nodeId, node] of this.talentNodes) {
      if (node.prerequisites.includes(id)) {
        dependents.push(nodeId);
        dependents.push(...this.getDependentNodes(nodeId));
      }
    }

    return dependents;
  }

  private checkUnlocks(): void {
    for (const [id, node] of this.talentNodes) {
      const state = this.talentStates.get(id)!;
      if (this.playerLevel >= node.unlockLevel) {
        state.isUnlocked = true;
      }
    }
  }

  private updateStats(): void {
    this.stats = this.createDefaultStats();

    for (const [id, state] of this.talentStates) {
      if (state.level === 0) continue;

      const node = this.talentNodes.get(id);
      if (!node) continue;

      for (const effect of node.effects) {
        const totalValue = effect.value + (effect.perLevel || 0) * (state.level - 1);

        switch (effect.type) {
          case 'damage_bonus':
            this.stats.damageBonus += totalValue;
            break;
          case 'fire_rate_bonus':
            this.stats.fireRateBonus += totalValue;
            break;
          case 'health_bonus':
            this.stats.healthBonus += totalValue;
            break;
          case 'shield_bonus':
            this.stats.shieldBonus += totalValue;
            break;
          case 'speed_bonus':
            this.stats.speedBonus += totalValue;
            break;
          case 'cooldown_reduction':
            this.stats.cooldownReduction += totalValue;
            break;
          case 'heal_effectiveness':
            this.stats.healEffectiveness += totalValue;
            break;
          case 'shield_effectiveness':
            this.stats.shieldEffectiveness += totalValue;
            break;
          case 'critical_chance':
            this.stats.criticalChance += totalValue;
            break;
          case 'critical_damage':
            this.stats.criticalDamage += totalValue;
            break;
          case 'energy_regen':
            this.stats.energyRegen += totalValue;
            break;
          case 'boost_effectiveness':
            this.stats.boostEffectiveness += totalValue;
            break;
          case 'skill_damage':
            this.stats.skillDamageBonus[id] = (this.stats.skillDamageBonus[id] || 0) + totalValue;
            break;
          case 'skill_duration':
            this.stats.skillDurationBonus[id] =
              (this.stats.skillDurationBonus[id] || 0) + totalValue;
            break;
          case 'skill_cooldown':
            this.stats.skillCooldownReduction[id] =
              (this.stats.skillCooldownReduction[id] || 0) + totalValue;
            break;
        }
      }
    }
  }

  public getStats(): SkillTreeStats {
    return { ...this.stats };
  }

  public getTotalSpentPoints(): number {
    let total = 0;
    for (const [id, state] of this.talentStates) {
      const node = this.talentNodes.get(id);
      if (node) {
        total += state.level * node.costPerLevel;
      }
    }
    return total;
  }

  public resetAllTalents(): void {
    for (const state of this.talentStates.values()) {
      const node = this.talentNodes.get(state.nodeId);
      if (node) {
        this.talentPoints += state.level * node.costPerLevel;
      }
      state.level = 0;
      state.isUnlocked = false;
    }

    this.checkUnlocks();
    this.updateStats();
    this.saveState();
  }

  private saveState(): void {
    try {
      const data = {
        playerLevel: this.playerLevel,
        talentPoints: this.talentPoints,
        talentStates: Array.from(this.talentStates.values()),
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      console.warn('Failed to save skill tree state');
    }
  }

  private loadState(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);

        if (data.playerLevel != null) {
          this.playerLevel = data.playerLevel;
        }
        if (data.talentPoints != null) {
          this.talentPoints = data.talentPoints;
        }
        if (data.talentStates) {
          for (const state of data.talentStates) {
            const existing = this.talentStates.get(state.nodeId);
            if (existing) {
              existing.level = state.level || 0;
              existing.isUnlocked = state.isUnlocked || false;
            }
          }
        }

        this.checkUnlocks();
        this.updateStats();
      }
    } catch {
      console.warn('Failed to load skill tree state');
    }
  }

  public formatEffectDescription(effect: TalentEffect, level: number): string {
    const value = effect.value + (effect.perLevel || 0) * (level - 1);
    return effect.description.replace('{value}', value.toString());
  }

  public reset(): void {
    this.talentStates.clear();
    this.playerLevel = 1;
    this.talentPoints = 0;
    this.stats = this.createDefaultStats();

    this.initializeTalentNodes();
    localStorage.removeItem(this.storageKey);
  }
}

export const skillTreeManager = SkillTreeManager.getInstance();
