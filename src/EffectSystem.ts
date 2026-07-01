import { PowerUpType, POWERUP_CONFIGS } from './PowerUpSystem';

export enum EffectType {
    WEAPON_UPGRADE = 2,
    SPEED_BOOST = 3,
    INVINCIBILITY = 4,
    DAMAGE_BOOST = 5,
    MAGNET = 6,
    SLOW_TIME = 7
}

export interface ActiveEffect {
    type: EffectType;
    duration: number;
    endTime: number;
    value: number;
    config: any;
}

export class EffectSystem {
    private activeEffects: ActiveEffect[] = [];
    private effectCallbacks: Map<EffectType, ((active: boolean, value: number) => void)[]> = new Map();

    public addEffect(type: EffectType, duration: number, value: number): void {
        const existingEffect = this.activeEffects.find(e => e.type === type);
        
        if (existingEffect) {
            existingEffect.endTime = performance.now() + duration;
            existingEffect.duration = duration;
            existingEffect.value = value;
        } else {
            this.activeEffects.push({
                type,
                duration,
                endTime: performance.now() + duration,
                value,
                config: POWERUP_CONFIGS[type] || {}
            });
        }
        
        this.notifyEffectChange(type, true, value);
    }

    public removeEffect(type: EffectType): void {
        const index = this.activeEffects.findIndex(e => e.type === type);
        if (index !== -1) {
            const effect = this.activeEffects[index];
            this.activeEffects.splice(index, 1);
            this.notifyEffectChange(type, false, effect.value);
        }
    }

    public hasEffect(type: EffectType): boolean {
        return this.activeEffects.some(e => e.type === type);
    }

    public getEffectValue(type: EffectType): number {
        const effect = this.activeEffects.find(e => e.type === type);
        return effect ? effect.value : 0;
    }

    public update(): void {
        const now = performance.now();
        
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            
            if (now >= effect.endTime) {
                this.removeEffect(effect.type);
            }
        }
    }

    public getRemainingTime(type: EffectType): number {
        const effect = this.activeEffects.find(e => e.type === type);
        if (!effect) return 0;
        
        const remaining = effect.endTime - performance.now();
        return Math.max(0, remaining);
    }

    public getActiveEffects(): ActiveEffect[] {
        return [...this.activeEffects];
    }

    public subscribeToEffect(type: EffectType, callback: (active: boolean, value: number) => void): void {
        if (!this.effectCallbacks.has(type)) {
            this.effectCallbacks.set(type, []);
        }
        this.effectCallbacks.get(type)!.push(callback);
    }

    public unsubscribeFromEffect(type: EffectType, callback: (active: boolean, value: number) => void): void {
        const callbacks = this.effectCallbacks.get(type);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    private notifyEffectChange(type: EffectType, active: boolean, value: number): void {
        const callbacks = this.effectCallbacks.get(type);
        if (callbacks) {
            for (const callback of callbacks) {
                callback(active, value);
            }
        }
    }

    public clearAll(): void {
        const types = [...this.activeEffects.map(e => e.type)];
        for (const type of types) {
            this.removeEffect(type);
        }
    }

    public getTotalSpeedBoost(): number {
        const speedBoost = this.activeEffects.find(e => e.type === EffectType.SPEED_BOOST);
        return speedBoost ? 1 + speedBoost.value : 1;
    }

    public getTotalDamageBoost(): number {
        const damageBoost = this.activeEffects.find(e => e.type === EffectType.DAMAGE_BOOST);
        return damageBoost ? 1 + damageBoost.value : 1;
    }

    public getFireRateMultiplier(): number {
        const weaponUpgrade = this.activeEffects.find(e => e.type === EffectType.WEAPON_UPGRADE);
        return weaponUpgrade ? weaponUpgrade.value : 1;
    }

    public isInvincible(): boolean {
        return this.hasEffect(EffectType.INVINCIBILITY);
    }

    public isSlowTimeActive(): boolean {
        return this.hasEffect(EffectType.SLOW_TIME);
    }

    public getSlowTimeFactor(): number {
        const slowTime = this.activeEffects.find(e => e.type === EffectType.SLOW_TIME);
        return slowTime ? slowTime.value : 1;
    }

    public isMagnetActive(): boolean {
        return this.hasEffect(EffectType.MAGNET);
    }

    public getMagnetRadius(): number {
        const magnet = this.activeEffects.find(e => e.type === EffectType.MAGNET);
        return magnet ? magnet.value : 0;
    }
}