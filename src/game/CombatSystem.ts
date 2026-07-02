/**
 * 战斗系统
 * 处理伤害计算、碰撞检测、状态效果等核心战斗逻辑
 */

export type DamageType = 'physical' | 'energy' | 'explosive' | 'piercing';

export type StatusEffectType = 'burn' | 'freeze' | 'poison' | 'stun' | 'shield' | 'speed';

export interface StatusEffect {
  type: StatusEffectType;
  duration: number;
  intensity: number;
  remainingTime: number;
}

export interface EntityStats {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  armor: number;
  resistance: Record<DamageType, number>;
}

export interface DamageResult {
  damage: number;
  crit: boolean;
  critMultiplier: number;
  hit: boolean;
  absorbedByShield: number;
  effects: StatusEffect[];
}

export interface CombatEntity {
  id: string;
  stats: EntityStats;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  effects: StatusEffect[];
}

export class CombatSystem {
  private static CRIT_CHANCE = 0.15;
  private static CRIT_MULTIPLIER = 2.0;

  public static calculateDamage(
    attacker: CombatEntity,
    target: CombatEntity,
    baseDamage: number,
    damageType: DamageType = 'physical',
  ): DamageResult {
    const result: DamageResult = {
      damage: 0,
      crit: false,
      critMultiplier: 1,
      hit: true,
      absorbedByShield: 0,
      effects: [],
    };

    const isCrit = Math.random() < CombatSystem.CRIT_CHANCE;
    result.crit = isCrit;
    result.critMultiplier = isCrit ? CombatSystem.CRIT_MULTIPLIER : 1;

    let damage = baseDamage * result.critMultiplier;

    const resistance = target.stats.resistance[damageType] || 0;
    damage *= 1 - resistance;

    const armorReduction = target.stats.armor * 0.01;
    damage *= 1 - armorReduction;

    damage = Math.max(1, Math.floor(damage));

    if (target.stats.shield > 0) {
      const shieldAbsorb = Math.min(target.stats.shield, damage);
      result.absorbedByShield = shieldAbsorb;
      damage -= shieldAbsorb;
    }

    result.damage = damage;

    return result;
  }

  public static applyDamage(entity: CombatEntity, damage: number): void {
    entity.stats.health = Math.max(0, entity.stats.health - damage);
  }

  public static applyHeal(entity: CombatEntity, amount: number): void {
    entity.stats.health = Math.min(entity.stats.maxHealth, entity.stats.health + amount);
  }

  public static applyShield(entity: CombatEntity, amount: number): void {
    entity.stats.shield = Math.min(entity.stats.maxShield, entity.stats.shield + amount);
  }

  public static addEffect(entity: CombatEntity, effect: StatusEffect): void {
    const existingEffect = entity.effects.find((e) => e.type === effect.type);

    if (existingEffect) {
      existingEffect.duration = Math.max(existingEffect.duration, effect.duration);
      existingEffect.intensity = Math.max(existingEffect.intensity, effect.intensity);
      existingEffect.remainingTime = existingEffect.duration;
    } else {
      entity.effects.push({ ...effect, remainingTime: effect.duration });
    }
  }

  public static removeEffect(entity: CombatEntity, type: StatusEffectType): void {
    entity.effects = entity.effects.filter((e) => e.type !== type);
  }

  public static updateEffects(entity: CombatEntity, dt: number): void {
    entity.effects = entity.effects.filter((effect) => {
      effect.remainingTime -= dt;

      if (effect.remainingTime <= 0) {
        return false;
      }

      switch (effect.type) {
        case 'burn':
          CombatSystem.applyDamage(entity, effect.intensity * dt);
          break;
        case 'poison':
          CombatSystem.applyDamage(entity, effect.intensity * dt);
          break;
        case 'freeze':
          entity.velocity = { x: 0, y: 0, z: 0 };
          break;
        case 'speed':
          // Speed boost handled separately
          break;
      }

      return true;
    });
  }

  public static checkCollision(
    pos1: { x: number; y: number; z: number },
    radius1: number,
    pos2: { x: number; y: number; z: number },
    radius2: number,
  ): boolean {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    return distance < radius1 + radius2;
  }

  public static predictPosition(
    currentPos: { x: number; y: number; z: number },
    velocity: { x: number; y: number; z: number },
    time: number,
  ): { x: number; y: number; z: number } {
    return {
      x: currentPos.x + velocity.x * time,
      y: currentPos.y + velocity.y * time,
      z: currentPos.z + velocity.z * time,
    };
  }

  public static getDistance(
    pos1: { x: number; y: number; z: number },
    pos2: { x: number; y: number; z: number },
  ): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  public static isEntityAlive(entity: CombatEntity): boolean {
    return entity.stats.health > 0;
  }
}
