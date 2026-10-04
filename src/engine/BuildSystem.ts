import configData from '../config/build-upgrades.json';

// ============================================================
// 类型定义
// ============================================================

export type UpgradeTag = 'firepower' | 'mobility' | 'defense' | 'special';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface UpgradeEffect {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>;
}

export interface Upgrade {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  tag: UpgradeTag;
  rarity: Rarity;
  stackable: boolean;
  maxStacks: number;
  unlockWave: number;
  weight: number;
  synergyContribution: boolean;
  effect: UpgradeEffect;
}

export interface ResonanceTrigger {
  tag?: UpgradeTag;
  minCount?: number;
  type?: string;
  requirements?: { tag: UpgradeTag; minCount: number }[];
}

export interface Resonance {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  trigger: ResonanceTrigger;
  effect: UpgradeEffect;
}

export interface ActiveUpgrade {
  upgrade: Upgrade;
  stacks: number;
}

export interface UpgradeChoice {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  tag: UpgradeTag;
  rarity: Rarity;
  currentStacks: number;
  maxStacks: number;
  stackable: boolean;
}

// ============================================================
// 修饰符聚合对象
// ============================================================

export interface PlayerModifiers {
  maxSpeedMultiplier: number;
  rotationSpeedMultiplier: number;
  decelerationMultiplier: number;
  damageTakenMultiplier: number;
  maxHealthBonus: number;
  healOnPickup: number;
  shieldRechargeRateMultiplier: number;
  shieldRechargeDelayBonusMs: number;
  boostEnergyRechargeMultiplier: number;
  invulnerabilityDurationBonusMs: number;
  dodgeChance: number;
  lifestealRatio: number;
  cooldownMultiplier: number;
  skillDamageMultiplier: number;
  dashInvulnerableDurationMs: number;
  emergencyShield: { hpThreshold: number; shieldAmount: number; cooldownPerWave: number } | null;
  thorns: { reflectMultiplier: number; reflectRange: number } | null;
}

export interface WeaponModifiers {
  damageMultiplier: number;
  fireRateMultiplier: number;
  pierceBonus: number;
  splitCount: number;
  splitDamageMultiplier: number;
  splitSeekingRange: number;
  critChanceBonus: number;
  critDamageMultiplier: number;
  ricochet: { range: number; maxBounces: number; damageMultiplier: number } | null;
  chainLightning: {
    chance: number;
    range: number;
    maxChains: number;
    damageMultiplier: number;
  } | null;
  elemental: { types: string[]; applyChance: number; durationMs: number; intensity: number } | null;
  stardustPickupRangeMultiplier: number;
  stardustDropAmountMultiplier: number;
}

function defaultPlayerModifiers(): PlayerModifiers {
  return {
    maxSpeedMultiplier: 1,
    rotationSpeedMultiplier: 1,
    decelerationMultiplier: 1,
    damageTakenMultiplier: 1,
    maxHealthBonus: 0,
    healOnPickup: 0,
    shieldRechargeRateMultiplier: 1,
    shieldRechargeDelayBonusMs: 0,
    boostEnergyRechargeMultiplier: 1,
    invulnerabilityDurationBonusMs: 0,
    dodgeChance: 0,
    lifestealRatio: 0,
    cooldownMultiplier: 1,
    skillDamageMultiplier: 1,
    dashInvulnerableDurationMs: 0,
    emergencyShield: null,
    thorns: null,
  };
}

function defaultWeaponModifiers(): WeaponModifiers {
  return {
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    pierceBonus: 0,
    splitCount: 0,
    splitDamageMultiplier: 0.5,
    splitSeekingRange: 8,
    critChanceBonus: 0,
    critDamageMultiplier: 2,
    ricochet: null,
    chainLightning: null,
    elemental: null,
    stardustPickupRangeMultiplier: 1,
    stardustDropAmountMultiplier: 1,
  };
}

// ============================================================
// BuildSystem 核心类
// ============================================================

export class BuildSystem {
  private upgrades: Upgrade[] = [];
  private resonances: Resonance[] = [];
  private activeUpgrades: Map<string, ActiveUpgrade> = new Map();
  private activeResonanceIds: Set<string> = new Set();
  private playerModifiers: PlayerModifiers = defaultPlayerModifiers();
  private weaponModifiers: WeaponModifiers = defaultWeaponModifiers();
  private rarityWeights: Record<string, number> = { common: 100, rare: 45, epic: 15, legendary: 3 };
  private choiceCount: number = 3;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    const meta = configData.meta as typeof configData.meta;
    this.upgrades = configData.upgrades as unknown as Upgrade[];
    this.resonances = configData.resonances as unknown as Resonance[];
    if (meta.rarityWeights) {
      this.rarityWeights = meta.rarityWeights as Record<string, number>;
    }
    if (meta.choiceCount) {
      this.choiceCount = meta.choiceCount;
    }
  }

  // ----------------------------------------------------------
  // 生成三选一候选
  // ----------------------------------------------------------

  public getUpgradeChoices(waveNumber: number): UpgradeChoice[] {
    const eligible = this.upgrades.filter((u) => {
      if (u.unlockWave > waveNumber) return false;
      const active = this.activeUpgrades.get(u.id);
      if (active && (!u.stackable || active.stacks >= u.maxStacks)) return false;
      return true;
    });

    if (eligible.length === 0) return [];

    const choices: UpgradeChoice[] = [];
    const pool = [...eligible];

    while (choices.length < this.choiceCount && pool.length > 0) {
      const totalWeight = pool.reduce((sum, u) => sum + (this.rarityWeights[u.rarity] || 100), 0);
      let roll = Math.random() * totalWeight;

      let selectedIdx = 0;
      for (let i = 0; i < pool.length; i++) {
        roll -= this.rarityWeights[pool[i].rarity] || 100;
        if (roll <= 0) {
          selectedIdx = i;
          break;
        }
      }

      const selected = pool[selectedIdx];
      const active = this.activeUpgrades.get(selected.id);
      choices.push({
        id: selected.id,
        name: selected.name,
        nameEn: selected.nameEn,
        description: selected.description,
        tag: selected.tag,
        rarity: selected.rarity,
        currentStacks: active?.stacks || 0,
        maxStacks: selected.maxStacks,
        stackable: selected.stackable,
      });

      pool.splice(selectedIdx, 1);
    }

    return choices;
  }

  // ----------------------------------------------------------
  // 选择强化
  // ----------------------------------------------------------

  public selectUpgrade(upgradeId: string): void {
    const upgrade = this.upgrades.find((u) => u.id === upgradeId);
    if (!upgrade) {
      console.warn(`[BuildSystem] Unknown upgrade: ${upgradeId}`);
      return;
    }

    const existing = this.activeUpgrades.get(upgradeId);
    if (existing) {
      if (!upgrade.stackable || existing.stacks >= upgrade.maxStacks) {
        console.warn(`[BuildSystem] Cannot stack upgrade: ${upgradeId}`);
        return;
      }
      existing.stacks++;
    } else {
      this.activeUpgrades.set(upgradeId, { upgrade, stacks: 1 });
    }

    this.checkResonances();
    this.recomputeModifiers();
    console.log(
      `[BuildSystem] Selected: ${upgrade.name} (stacks: ${this.activeUpgrades.get(upgradeId)?.stacks})`,
    );
  }

  // ----------------------------------------------------------
  // 检测协同共振
  // ----------------------------------------------------------

  private checkResonances(): void {
    const tagCounts: Record<string, number> = {
      firepower: 0,
      mobility: 0,
      defense: 0,
      special: 0,
    };

    this.activeUpgrades.forEach((active) => {
      if (active.upgrade.synergyContribution) {
        tagCounts[active.upgrade.tag] = (tagCounts[active.upgrade.tag] || 0) + active.stacks;
      }
    });

    this.activeResonanceIds.clear();

    for (const resonance of this.resonances) {
      const trigger = resonance.trigger;
      if (trigger.type === 'balanced' && trigger.requirements) {
        const allMet = trigger.requirements.every(
          (req) => (tagCounts[req.tag] || 0) >= req.minCount,
        );
        if (allMet) {
          this.activeResonanceIds.add(resonance.id);
        }
      } else if (trigger.tag && trigger.minCount !== undefined) {
        if ((tagCounts[trigger.tag] || 0) >= trigger.minCount) {
          this.activeResonanceIds.add(resonance.id);
        }
      }
    }
  }

  // ----------------------------------------------------------
  // 重新计算修饰符
  // ----------------------------------------------------------

  private recomputeModifiers(): void {
    this.playerModifiers = defaultPlayerModifiers();
    this.weaponModifiers = defaultWeaponModifiers();

    this.activeUpgrades.forEach((active) => {
      const stacks = active.stacks;
      for (let i = 0; i < stacks; i++) {
        this.applyEffect(active.upgrade.effect);
      }
    });

    this.activeResonanceIds.forEach((resId) => {
      const resonance = this.resonances.find((r) => r.id === resId);
      if (resonance) {
        this.applyEffect(resonance.effect);
      }
    });
  }

  private applyEffect(effect: UpgradeEffect): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = effect.params;
    switch (effect.type) {
      case 'stat_modifier':
        if (p.damageMultiplier)
          this.weaponModifiers.damageMultiplier *= p.damageMultiplier as number;
        if (p.fireRateMultiplier)
          this.weaponModifiers.fireRateMultiplier *= p.fireRateMultiplier as number;
        if (p.maxSpeedMultiplier)
          this.playerModifiers.maxSpeedMultiplier *= p.maxSpeedMultiplier as number;
        if (p.rotationSpeedMultiplier)
          this.playerModifiers.rotationSpeedMultiplier *= p.rotationSpeedMultiplier as number;
        if (p.decelerationMultiplier)
          this.playerModifiers.decelerationMultiplier *= p.decelerationMultiplier as number;
        if (p.damageTakenMultiplier)
          this.playerModifiers.damageTakenMultiplier *= p.damageTakenMultiplier as number;
        if (p.maxHealthBonus) this.playerModifiers.maxHealthBonus += p.maxHealthBonus as number;
        if (p.healOnPickup) this.playerModifiers.healOnPickup += p.healOnPickup as number;
        if (p.shieldRechargeRateMultiplier)
          this.playerModifiers.shieldRechargeRateMultiplier *=
            p.shieldRechargeRateMultiplier as number;
        if (p.shieldRechargeDelayBonusMs)
          this.playerModifiers.shieldRechargeDelayBonusMs += p.shieldRechargeDelayBonusMs as number;
        if (p.boostEnergyRechargeMultiplier)
          this.playerModifiers.boostEnergyRechargeMultiplier *=
            p.boostEnergyRechargeMultiplier as number;
        if (p.invulnerabilityDurationBonusMs)
          this.playerModifiers.invulnerabilityDurationBonusMs +=
            p.invulnerabilityDurationBonusMs as number;
        break;

      case 'piercing':
        this.weaponModifiers.pierceBonus += (p.pierceBonus as number) || 1;
        break;

      case 'projectile_split':
        this.weaponModifiers.splitCount += (p.splitCount as number) || 1;
        if (p.splitDamageMultiplier)
          this.weaponModifiers.splitDamageMultiplier = p.splitDamageMultiplier as number;
        if (p.splitSeekingRange)
          this.weaponModifiers.splitSeekingRange = p.splitSeekingRange as number;
        break;

      case 'critical_enhance':
        this.weaponModifiers.critChanceBonus += (p.critChanceBonus as number) || 0;
        if (p.critDamageMultiplier)
          this.weaponModifiers.critDamageMultiplier = p.critDamageMultiplier as number;
        break;

      case 'dash_invulnerable':
        this.playerModifiers.dashInvulnerableDurationMs = Math.max(
          this.playerModifiers.dashInvulnerableDurationMs,
          (p.invulnerableDurationMs as number) || 400,
        );
        break;

      case 'emergency_shield':
        this.playerModifiers.emergencyShield = {
          hpThreshold: (p.hpThreshold as number) || 0.3,
          shieldAmount: (p.shieldAmount as number) || 30,
          cooldownPerWave: (p.cooldownPerWave as number) || 1,
        };
        break;

      case 'thorns':
        this.playerModifiers.thorns = {
          reflectMultiplier: (p.reflectMultiplier as number) || 0.2,
          reflectRange: (p.reflectRange as number) || 4,
        };
        break;

      case 'lifesteal':
        this.playerModifiers.lifestealRatio += (p.lifestealRatio as number) || 0;
        break;

      case 'stardust_magnet':
        if (p.pickupRangeMultiplier)
          this.weaponModifiers.stardustPickupRangeMultiplier *= p.pickupRangeMultiplier as number;
        if (p.dropAmountMultiplier)
          this.weaponModifiers.stardustDropAmountMultiplier *= p.dropAmountMultiplier as number;
        break;

      case 'skill_enhance':
        if (p.durationMultiplier)
          this.playerModifiers.cooldownMultiplier *= 1 / (p.durationMultiplier as number);
        if (p.effectIntensityBonus)
          this.playerModifiers.skillDamageMultiplier *= 1 + (p.effectIntensityBonus as number);
        break;

      // Phase 1.5: 以下效果先存入修饰符，实际触发逻辑后续补全
      case 'ricochet':
        this.weaponModifiers.ricochet = {
          range: (p.bounceRange as number) || 6,
          maxBounces: (p.maxBounces as number) || 2,
          damageMultiplier: (p.bounceDamageMultiplier as number) || 0.6,
        };
        break;

      case 'chain_lightning':
        this.weaponModifiers.chainLightning = {
          chance: (p.triggerChance as number) || 0.2,
          range: (p.chainRange as number) || 5,
          maxChains: (p.maxChains as number) || 3,
          damageMultiplier: (p.chainDamageMultiplier as number) || 0.4,
        };
        break;

      case 'elemental_rounds':
        this.weaponModifiers.elemental = {
          types: (p.statusTypes as string[]) || ['burn', 'freeze', 'poison'],
          applyChance: (p.applyChance as number) || 0.35,
          durationMs: (p.durationMs as number) || 2000,
          intensity: (p.intensity as number) || 1,
        };
        break;

      // 共振效果
      case 'resonance_bullet_storm':
        this.weaponModifiers.pierceBonus += (p.pierceBonus as number) || 1;
        this.weaponModifiers.damageMultiplier *= (p.damageMultiplier as number) || 1.2;
        break;

      case 'resonance_phantom_dance':
        if (
          p.dashEnergyCostMultiplier !== undefined &&
          (p.dashEnergyCostMultiplier as number) === 0
        ) {
          this.playerModifiers.boostEnergyRechargeMultiplier *= 2;
        }
        this.playerModifiers.dodgeChance += (p.dodgeChance as number) || 0;
        break;

      case 'resonance_immortal_bastion':
        this.playerModifiers.emergencyShield = {
          hpThreshold: (p.hpThreshold as number) || 0.2,
          shieldAmount: 999,
          cooldownPerWave: 0,
        };
        this.playerModifiers.damageTakenMultiplier *=
          (p.damageReductionMultiplier as number) || 0.5;
        break;

      case 'resonance_temporal_anomaly':
        this.playerModifiers.cooldownMultiplier *= (p.cooldownMultiplier as number) || 0.75;
        this.playerModifiers.skillDamageMultiplier *= (p.skillDamageMultiplier as number) || 1.3;
        break;

      case 'resonance_astral_echo':
        this.weaponModifiers.damageMultiplier *= (p.allStatsMultiplier as number) || 1.15;
        this.playerModifiers.maxSpeedMultiplier *= (p.allStatsMultiplier as number) || 1.15;
        this.playerModifiers.shieldRechargeRateMultiplier *=
          (p.allStatsMultiplier as number) || 1.15;
        this.weaponModifiers.stardustDropAmountMultiplier *= 1.5;
        break;

      default:
        console.warn(`[BuildSystem] Unknown effect type: ${effect.type}`);
    }
  }

  // ----------------------------------------------------------
  // 公开访问器
  // ----------------------------------------------------------

  public getPlayerModifiers(): PlayerModifiers {
    return this.playerModifiers;
  }

  public getWeaponModifiers(): WeaponModifiers {
    return this.weaponModifiers;
  }

  public getActiveBuild(): { upgrades: ActiveUpgrade[]; resonances: string[] } {
    return {
      upgrades: Array.from(this.activeUpgrades.values()),
      resonances: Array.from(this.activeResonanceIds),
    };
  }

  public getActiveResonanceNames(): string[] {
    return Array.from(this.activeResonanceIds)
      .map((id) => this.resonances.find((r) => r.id === id)?.name)
      .filter((n): n is string => !!n);
  }

  // ----------------------------------------------------------
  // 重置（死亡/新局）
  // ----------------------------------------------------------

  public reset(): void {
    this.activeUpgrades.clear();
    this.activeResonanceIds.clear();
    this.playerModifiers = defaultPlayerModifiers();
    this.weaponModifiers = defaultWeaponModifiers();
  }
}
