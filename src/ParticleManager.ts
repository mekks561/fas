import { Scene, Vector3, ParticleSystem, Color4, Texture, Vector2, Mesh } from '@babylonjs/core';

export enum ParticleEffectType {
    EXPLOSION,
    ENGINE_FLAME,
    PROJECTILE_TRAIL,
    HIT_SPARK,
    SMOKE,
    STAR_FIELD,
    ENERGY_SHIELD,
    POWERUP_GLOW,
    DEBRIS,
    MISSILE_TRAIL,
    PLASMA_BALL
}

export class ParticleManager {
    private scene: Scene;
    private particleSystems: Map<string, ParticleSystem> = new Map();
    private effectCounter: number = 0;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public createParticleEffect(
        type: ParticleEffectType,
        position: Vector3,
        duration: number = 2,
        params?: any
    ): ParticleSystem {
        this.effectCounter++;
        const id = `particleEffect_${this.effectCounter}`;
        
        let particleSystem: ParticleSystem;

        switch (type) {
            case ParticleEffectType.EXPLOSION:
                particleSystem = this.createExplosionEffect(id, position, params);
                break;
            case ParticleEffectType.ENGINE_FLAME:
                particleSystem = this.createEngineFlameEffect(id, position, params);
                break;
            case ParticleEffectType.PROJECTILE_TRAIL:
                particleSystem = this.createProjectileTrailEffect(id, position, params);
                break;
            case ParticleEffectType.HIT_SPARK:
                particleSystem = this.createHitSparkEffect(id, position, params);
                break;
            case ParticleEffectType.SMOKE:
                particleSystem = this.createSmokeEffect(id, position, params);
                break;
            case ParticleEffectType.STAR_FIELD:
                particleSystem = this.createStarFieldEffect(id, position, params);
                break;
            case ParticleEffectType.ENERGY_SHIELD:
                particleSystem = this.createEnergyShieldEffect(id, position, params);
                break;
            case ParticleEffectType.POWERUP_GLOW:
                particleSystem = this.createPowerupGlowEffect(id, position, params);
                break;
            case ParticleEffectType.DEBRIS:
                particleSystem = this.createDebrisEffect(id, position, params);
                break;
            case ParticleEffectType.MISSILE_TRAIL:
                particleSystem = this.createMissileTrailEffect(id, position, params);
                break;
            case ParticleEffectType.PLASMA_BALL:
                particleSystem = this.createPlasmaBallEffect(id, position, params);
                break;
            default:
                throw new Error(`Unsupported particle effect type: ${type}`);
        }

        this.particleSystems.set(id, particleSystem);
        
        // 如果是一次性效果，设置自动销毁
        if (type !== ParticleEffectType.ENGINE_FLAME) {
            setTimeout(() => {
                this.destroyParticleEffect(id);
            }, duration * 1000);
        }

        return particleSystem;
    }

    private createExplosionEffect(id: string, position: Vector3, params?: any): ParticleSystem {
        const particleSystem = new ParticleSystem(id, 300, this.scene);
        
        // 设置纹理
        try {
            particleSystem.particleTexture = new Texture(
                './textures/flare.png',
                this.scene
            );
        } catch (error) {
            console.warn('Failed to load flare texture for particle effect:', error);
        }

        // 发射器位置
        particleSystem.emitter = position;

        // 颜色渐变
        particleSystem.color1 = new Color4(1, 1, 0.8, 1);
        particleSystem.color2 = new Color4(1, 0.5, 0, 1);
        particleSystem.colorDead = new Color4(0.5, 0, 0, 0);

        // 粒子大小
        particleSystem.minSize = 1;
        particleSystem.maxSize = 4;

        // 生命周期
        particleSystem.minLifeTime = 0.5;
        particleSystem.maxLifeTime = 1.2;

        // 发射率
        particleSystem.emitRate = 1500;

        // 发射方向
        const radius = params?.radius || 10;
        particleSystem.direction1 = new Vector3(-radius, -radius, -radius);
        particleSystem.direction2 = new Vector3(radius, radius, radius);

        // 发射功率
        particleSystem.minEmitPower = 5;
        particleSystem.maxEmitPower = 10;

        // 重力
        particleSystem.gravity = new Vector3(0, 0, 0);

        // 粒子速度
        particleSystem.minAngularSpeed = 0;
        particleSystem.maxAngularSpeed = Math.PI;

        // 缩放
        particleSystem.minScaleX = 1;
        particleSystem.maxScaleX = 2;
        particleSystem.minScaleY = 1;
        particleSystem.maxScaleY = 2;

        // 混合模式
        particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

        // 开始发射
        particleSystem.start();

        return particleSystem;
    }

    private createEngineFlameEffect(id: string, position: Vector3, params?: any): ParticleSystem {
        const particleSystem = new ParticleSystem(id, 300, this.scene);
        
        try {
            particleSystem.particleTexture = new Texture(
                './textures/flare.png',
                this.scene
            );
        } catch (error) {
            console.warn('Failed to load flare texture for engine flame:', error);
        }

        particleSystem.emitter = position;

        // 火焰颜色
        particleSystem.color1 = new Color4(1, 0.8, 0, 1);
        particleSystem.color2 = new Color4(1, 0.2, 0, 0.8);
        particleSystem.colorDead = new Color4(1, 0, 0, 0);

        // 粒子大小
        particleSystem.minSize = 0.5;
        particleSystem.maxSize = 2;

        // 生命周期
        particleSystem.minLifeTime = 0.1;
        particleSystem.maxLifeTime = 0.5;

        // 发射率
        particleSystem.emitRate = 200;

        // 发射方向（向后）
        const direction = params?.direction || new Vector3(0, 0, -1);
        const spread = params?.spread || 0.5;
        particleSystem.direction1 = direction.scale(-5).add(new Vector3(-spread, -spread, 0));
        particleSystem.direction2 = direction.scale(-5).add(new Vector3(spread, spread, 0));

        // 发射功率
        particleSystem.minEmitPower = 2;
        particleSystem.maxEmitPower = 5;

        // 重力
        particleSystem.gravity = new Vector3(0, 0, 0);

        // 混合模式
        particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

        // 开始发射
        particleSystem.start();

        return particleSystem;
    }

    private createProjectileTrailEffect(id: string, position: Vector3, params?: any): ParticleSystem {
        const particleSystem = new ParticleSystem(id, 200, this.scene);
        
        try {
            particleSystem.particleTexture = new Texture(
                './textures/flare.png',
                this.scene
            );
        } catch (error) {
            console.warn('Failed to load flare texture for projectile trail:', error);
        }

        particleSystem.emitter = position;

        // 轨迹颜色
        particleSystem.color1 = new Color4(1, 0.8, 0, 1);
        particleSystem.color2 = new Color4(1, 0.5, 0, 0.8);
        particleSystem.colorDead = new Color4(1, 0, 0, 0);

        // 粒子大小
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.3;

        // 生命周期
        particleSystem.minLifeTime = 0.1;
        particleSystem.maxLifeTime = 0.3;

        // 发射率
        particleSystem.emitRate = 50;

        // 发射方向
        particleSystem.direction1 = new Vector3(-0.1, -0.1, 0);
        particleSystem.direction2 = new Vector3(0.1, 0.1, 0);

        // 发射功率
        particleSystem.minEmitPower = 1;
        particleSystem.maxEmitPower = 3;

        // 重力
        particleSystem.gravity = new Vector3(0, 0, 0);

        // 混合模式
        particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

        // 开始发射
        particleSystem.start();

        return particleSystem;
    }

    private createHitSparkEffect(id: string, position: Vector3, params?: any): ParticleSystem {
        const particleSystem = new ParticleSystem(id, 200, this.scene);
        
        try {
            particleSystem.particleTexture = new Texture(
                './textures/flare.png',
                this.scene
            );
        } catch (error) {
            console.warn('Failed to load flare texture for hit spark:', error);
        }

        particleSystem.emitter = position;

        // 火花颜色
        particleSystem.color1 = new Color4(1, 1, 1, 1);
        particleSystem.color2 = new Color4(1, 0.8, 0, 1);
        particleSystem.colorDead = new Color4(1, 0, 0, 0);

        // 粒子大小
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.5;

        // 生命周期
        particleSystem.minLifeTime = 0.1;
        particleSystem.maxLifeTime = 0.5;

        // 发射率
        particleSystem.emitRate = 500;

        // 发射方向
        particleSystem.direction1 = new Vector3(-5, -5, -5);
        particleSystem.direction2 = new Vector3(5, 5, 5);

        // 发射功率
        particleSystem.minEmitPower = 3;
        particleSystem.maxEmitPower = 8;

        // 重力
        particleSystem.gravity = new Vector3(0, 0, 0);

        // 混合模式
        particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

        // 开始发射
        particleSystem.start();

        return particleSystem;
    }

    private createSmokeEffect(id: string, position: Vector3, params?: any): ParticleSystem {
        const particleSystem = new ParticleSystem(id, 100, this.scene);
        
        try {
            particleSystem.particleTexture = new Texture(
                './textures/flare.png',
                this.scene
            );
        } catch (error) {
            console.warn('Failed to load flare texture for smoke effect:', error);
        }

        particleSystem.emitter = position;

        // 烟雾颜色
        particleSystem.color1 = new Color4(0.5, 0.5, 0.5, 0.8);
        particleSystem.color2 = new Color4(0.3, 0.3, 0.3, 0.5);
        particleSystem.colorDead = new Color4(0, 0, 0, 0);

        // 粒子大小
        particleSystem.minSize = 1;
        particleSystem.maxSize = 3;

        // 生命周期
        particleSystem.minLifeTime = 1;
        particleSystem.maxLifeTime = 3;

        // 发射率
        particleSystem.emitRate = 50;

        // 发射方向
        particleSystem.direction1 = new Vector3(-2, -2, -2);
        particleSystem.direction2 = new Vector3(2, 2, 2);

        // 发射功率
        particleSystem.minEmitPower = 1;
        particleSystem.maxEmitPower = 3;

        // 重力
        particleSystem.gravity = new Vector3(0, 1, 0);

        // 混合模式
        particleSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;

        // 开始发射
        particleSystem.start();

        return particleSystem;
    }

    public updateParticleEffectPosition(id: string, position: Vector3): void {
        const particleSystem = this.particleSystems.get(id);
        if (particleSystem) {
            particleSystem.emitter = position;
        }
    }

    public attachParticleEffectToMesh(
        particleSystem: ParticleSystem,
        mesh: Mesh,
        offset?: Vector3
    ): void {
        const localOffset = offset || Vector3.Zero();
        
        // 在每帧更新粒子发射器的位置
        this.scene.onBeforeRenderObservable.add(() => {
            particleSystem.emitter = mesh.getAbsolutePosition().add(localOffset);
        });
    }

    public stopParticleEffect(id: string): void {
        const particleSystem = this.particleSystems.get(id);
        if (particleSystem) {
            particleSystem.stop();
        }
    }

    public destroyParticleEffect(id: string): void {
        const particleSystem = this.particleSystems.get(id);
        if (particleSystem && typeof particleSystem.dispose === 'function') {
            particleSystem.dispose();
            this.particleSystems.delete(id);
        }
    }

    public destroyAllParticleEffects(): void {
        for (const [id, particleSystem] of this.particleSystems) {
            if (particleSystem && typeof particleSystem.dispose === 'function') {
                particleSystem.dispose();
            }
        }
        this.particleSystems.clear();
    }

    public update(deltaTime: number): void {
        // 更新所有粒子系统（如果需要）
        // Babylon.js会自动更新粒子系统，所以这里可能不需要额外处理
    }

    private createStarFieldEffect(id: string, position: Vector3, params?: any): ParticleSystem {
        const particleSystem = new ParticleSystem(id, 5000, this.scene);
        
        try {
            particleSystem.particleTexture = new Texture(
                './textures/flare.png',
                this.scene
            );
        } catch (error) {
            console.warn('Failed to load flare texture for star field:', error);
        }

        particleSystem.emitter = position;

        particleSystem.color1 = new Color4(1, 1, 1, 1);
        particleSystem.color2 = new Color4(0.8, 0.8, 1, 1);
        particleSystem.colorDead = new Color4(1, 1, 1, 0);

        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.5;

        particleSystem.minLifeTime = 5;
        particleSystem.maxLifeTime = 15;

        particleSystem.emitRate = 100;

        const range = params?.range || 500;
        particleSystem.direction1 = new Vector3(-range, -range, -range);
        particleSystem.direction2 = new Vector3(range, range, range);

        particleSystem.minEmitPower = 0;
        particleSystem.maxEmitPower = 0;

        particleSystem.gravity = new Vector3(0, 0, 0);

        particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

        particleSystem.start();

        return particleSystem;
    }

    private createEnergyShieldEffect(id: string, position: Vector3, params?: any): ParticleSystem {
        const particleSystem = new ParticleSystem(id, 200, this.scene);
        
        try {
            particleSystem.particleTexture = new Texture(
                './textures/flare.png',
                this.scene
            );
        } catch (error) {
            console.warn('Failed to load flare texture for energy shield:', error);
        }

        particleSystem.emitter = position;

        particleSystem.color1 = new Color4(0, 0.8, 1, 1);
        particleSystem.color2 = new Color4(0, 0.4, 0.8, 0.8);
        particleSystem.colorDead = new Color4(0, 0.2, 0.5, 0);

        const radius = params?.radius || 5;
        particleSystem.minSize = radius * 0.5;
        particleSystem.maxSize = radius * 1.5;

        particleSystem.minLifeTime = 0.3;
        particleSystem.maxLifeTime = 0.8;

        particleSystem.emitRate = 100;

        particleSystem.direction1 = new Vector3(-1, -1, -1);
        particleSystem.direction2 = new Vector3(1, 1, 1);

        particleSystem.minEmitPower = 0.5;
        particleSystem.maxEmitPower = 2;

        particleSystem.gravity = new Vector3(0, 0, 0);

        particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

        particleSystem.start();

        return particleSystem;
    }

    private createPowerupGlowEffect(id: string, position: Vector3, params?: any): ParticleSystem {
        const particleSystem = new ParticleSystem(id, 100, this.scene);
        
        try {
            particleSystem.particleTexture = new Texture(
                './textures/flare.png',
                this.scene
            );
        } catch (error) {
            console.warn('Failed to load flare texture for powerup glow:', error);
        }

        const color = params?.color || new Color4(0, 1, 0, 1);
        particleSystem.emitter = position;

        particleSystem.color1 = color;
        particleSystem.color2 = new Color4(color.r * 0.5, color.g * 0.5, color.b * 0.5, 0.8);
        particleSystem.colorDead = new Color4(color.r * 0.2, color.g * 0.2, color.b * 0.2, 0);

        particleSystem.minSize = 1;
        particleSystem.maxSize = 3;

        particleSystem.minLifeTime = 0.5;
        particleSystem.maxLifeTime = 1.5;

        particleSystem.emitRate = 30;

        particleSystem.direction1 = new Vector3(-2, -2, -2);
        particleSystem.direction2 = new Vector3(2, 2, 2);

        particleSystem.minEmitPower = 1;
        particleSystem.maxEmitPower = 3;

        particleSystem.gravity = new Vector3(0, 0, 0);

        particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

        particleSystem.start();

        return particleSystem;
    }

    private createDebrisEffect(id: string, position: Vector3, params?: any): ParticleSystem {
        const particleSystem = new ParticleSystem(id, 150, this.scene);
        
        try {
            particleSystem.particleTexture = new Texture(
                './textures/flare.png',
                this.scene
            );
        } catch (error) {
            console.warn('Failed to load flare texture for debris:', error);
        }

        particleSystem.emitter = position;

        particleSystem.color1 = new Color4(0.6, 0.6, 0.6, 1);
        particleSystem.color2 = new Color4(0.4, 0.4, 0.4, 0.8);
        particleSystem.colorDead = new Color4(0.2, 0.2, 0.2, 0);

        particleSystem.minSize = 0.2;
        particleSystem.maxSize = 0.8;

        particleSystem.minLifeTime = 2;
        particleSystem.maxLifeTime = 5;

        particleSystem.emitRate = 50;

        particleSystem.direction1 = new Vector3(-5, -5, -5);
        particleSystem.direction2 = new Vector3(5, 5, 5);

        particleSystem.minEmitPower = 2;
        particleSystem.maxEmitPower = 6;

        particleSystem.gravity = new Vector3(0, -0.5, 0);

        particleSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;

        particleSystem.start();

        return particleSystem;
    }

    private createMissileTrailEffect(id: string, position: Vector3, params?: any): ParticleSystem {
        const particleSystem = new ParticleSystem(id, 300, this.scene);
        
        try {
            particleSystem.particleTexture = new Texture(
                './textures/flare.png',
                this.scene
            );
        } catch (error) {
            console.warn('Failed to load flare texture for missile trail:', error);
        }

        particleSystem.emitter = position;

        particleSystem.color1 = new Color4(0.2, 0.6, 1, 1);
        particleSystem.color2 = new Color4(0, 0.3, 0.8, 0.8);
        particleSystem.colorDead = new Color4(0, 0.1, 0.3, 0);

        particleSystem.minSize = 0.3;
        particleSystem.maxSize = 1;

        particleSystem.minLifeTime = 0.2;
        particleSystem.maxLifeTime = 0.5;

        particleSystem.emitRate = 100;

        const direction = params?.direction || new Vector3(0, 0, -1);
        particleSystem.direction1 = direction.scale(-3);
        particleSystem.direction2 = direction.scale(-1);

        particleSystem.minEmitPower = 1;
        particleSystem.maxEmitPower = 3;

        particleSystem.gravity = new Vector3(0, 0, 0);

        particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

        particleSystem.start();

        return particleSystem;
    }

    private createPlasmaBallEffect(id: string, position: Vector3, params?: any): ParticleSystem {
        const particleSystem = new ParticleSystem(id, 100, this.scene);
        
        try {
            particleSystem.particleTexture = new Texture(
                './textures/flare.png',
                this.scene
            );
        } catch (error) {
            console.warn('Failed to load flare texture for plasma ball:', error);
        }

        particleSystem.emitter = position;

        particleSystem.color1 = new Color4(1, 0.2, 0.8, 1);
        particleSystem.color2 = new Color4(0.5, 0.1, 1, 1);
        particleSystem.colorDead = new Color4(0.2, 0, 0.5, 0);

        particleSystem.minSize = 0.5;
        particleSystem.maxSize = 2;

        particleSystem.minLifeTime = 0.3;
        particleSystem.maxLifeTime = 0.8;

        particleSystem.emitRate = 50;

        particleSystem.direction1 = new Vector3(-1, -1, -1);
        particleSystem.direction2 = new Vector3(1, 1, 1);

        particleSystem.minEmitPower = 0.5;
        particleSystem.maxEmitPower = 2;

        particleSystem.gravity = new Vector3(0, 0, 0);

        particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

        particleSystem.start();

        return particleSystem;
    }

    public dispose(): void {
        this.destroyAllParticleEffects();
    }
    
    // 获取粒子系统数量
    public getParticleSystemCount(): number {
        return this.particleSystems.size;
    }
}