/**
 * 高级粒子特效系统
 * Advanced Particle System
 * 
 * 功能：
 * - 爆炸特效
 * - 尾迹特效
 * - 能量光环
 * - 动态粒子
 */

import * as BABYLON from '@babylonjs/core';

export interface ParticleConfig {
    particleTexture?: BABYLON.Texture;
    capacity: number;
    emitRate: number;
    lifetime: number;
    size: number;
    color1: BABYLON.Color4;
    color2: BABYLON.Color4;
    colorDead: BABYLON.Color4;
    minEmitPower: number;
    maxEmitPower: number;
    direction1: BABYLON.Vector3;
    direction2: BABYLON.Vector3;
    gravity: BABYLON.Vector3;
    blendMode: number;
}

export class AdvancedParticleSystem {
    private scene: BABYLON.Scene;
    private particleSystems: Map<string, BABYLON.ParticleSystem> = new Map();
    
    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }
    
    /**
     * 创建爆炸效果
     */
    public createExplosion(
        position: BABYLON.Vector3,
        color: BABYLON.Color3 = new BABYLON.Color3(1, 0.5, 0),
        scale: number = 1
    ): BABYLON.ParticleSystem {
        const particleSystem = new BABYLON.ParticleSystem('explosion', 500, this.scene);
        
        // 粒子纹理
        particleSystem.particleTexture = new BABYLON.Texture(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAsklEQVRYR+2WwQ6AIAwD9f8/2oMHjYpQeqjB7kJo8OGZ2WvtAQD4NyJJkuRvkGQ1yZak6T8kWZKkSXIlSZYkPUl2JGmSHEm6k+xI0pFkR5K9JHtJdpLsJdlLspdkL8lekr0ke0n2kuwl2Uuyl2QvyV6SvSR7SfaS7CXZS7KXZC/JXpK9JHtJ9pLsJdlLspdkL8lekr0ke0n2kuwl2Uuyl2QvyV6SvSR7SfaS7CXZS7KXZC/JXpK9JHtJdpLsJdlLspdkL8lekr0ke0n2kuwl2UtykGQvyV6SvcQAAHyl/wBjqg9vG1qP/wAAAABJRU5ErkJggg==',
            this.scene
        );
        
        // 发射位置
        particleSystem.emitter = position;
        particleSystem.minEmitBox = BABYLON.Vector3.Zero();
        particleSystem.maxEmitBox = BABYLON.Vector3.Zero();
        
        // 颜色
        particleSystem.color1 = new BABYLON.Color4(color.r, color.g, color.b, 1);
        particleSystem.color2 = new BABYLON.Color4(color.r, color.g, color.b, 0.5);
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
        
        // 大小
        particleSystem.minSize = 0.3 * scale;
        particleSystem.maxSize = 0.8 * scale;
        
        // 生命周期
        particleSystem.minLifeTime = 0.2;
        particleSystem.maxLifeTime = 0.6;
        
        // 发射率
        particleSystem.emitRate = 500;
        
        // 混合模式
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        
        // 方向
        particleSystem.direction1 = new BABYLON.Vector3(-5, 5, -5);
        particleSystem.direction2 = new BABYLON.Vector3(5, 5, 5);
        
        // 速度
        particleSystem.minEmitPower = 3 * scale;
        particleSystem.maxEmitPower = 5 * scale;
        
        // 重力
        particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);
        
        // 目标
        particleSystem.targetStopDuration = 0.2;
        particleSystem.disposeOnStop = true;
        
        // 启动
        particleSystem.start();
        
        // 添加到管理列表
        const id = `explosion_${Date.now()}`;
        this.particleSystems.set(id, particleSystem);
        
        return particleSystem;
    }
    
    /**
     * 创建引擎尾迹
     */
    public createEngineTrail(
        emitter: BABYLON.AbstractMesh,
        color: BABYLON.Color3 = new BABYLON.Color3(0, 0.8, 1)
    ): BABYLON.ParticleSystem {
        const particleSystem = new BABYLON.ParticleSystem('engineTrail', 1000, this.scene);
        
        // 粒子纹理
        particleSystem.particleTexture = new BABYLON.Texture(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAnklEQVQ4T2NkoBAwUqifgWoGjAYMDJSMTAxUjEyMDIxQNiYqGGBgZGRgYGRkZGBkYoCyMUPZGBmYGBkZmBgZGRhYGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWaB2MDIyMDKxQOsDAMCzCxcZc6jRAAAAAElFTkSuQmCC',
            this.scene
        );
        
        particleSystem.emitter = emitter;
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.1, 0, 0);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.1, 0, 0);
        
        // 颜色
        particleSystem.color1 = new BABYLON.Color4(color.r, color.g, color.b, 1);
        particleSystem.color2 = new BABYLON.Color4(color.r * 0.8, color.g * 0.8, color.b * 0.8, 0.8);
        particleSystem.colorDead = new BABYLON.Color4(color.r * 0.3, color.g * 0.3, color.b * 0.3, 0);
        
        // 大小
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.3;
        
        // 生命周期
        particleSystem.minLifeTime = 0.2;
        particleSystem.maxLifeTime = 0.5;
        
        // 发射率
        particleSystem.emitRate = 100;
        
        // 混合模式
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        
        // 方向
        particleSystem.direction1 = new BABYLON.Vector3(-1, 0, 0);
        particleSystem.direction2 = new BABYLON.Vector3(-1, 0, 0);
        
        // 速度
        particleSystem.minEmitPower = 2;
        particleSystem.maxEmitPower = 3;
        
        // 无重力（太空环境）
        particleSystem.gravity = BABYLON.Vector3.Zero();
        
        // 启动
        particleSystem.start();
        
        const id = `engine_${Date.now()}`;
        this.particleSystems.set(id, particleSystem);
        
        return particleSystem;
    }
    
    /**
     * 创建能量光环
     */
    public createEnergyAura(
        emitter: BABYLON.AbstractMesh,
        color: BABYLON.Color3 = new BABYLON.Color3(0, 0.5, 1),
        radius: number = 2
    ): BABYLON.ParticleSystem {
        const particleSystem = new BABYLON.ParticleSystem('energyAura', 500, this.scene);
        
        particleSystem.particleTexture = new BABYLON.Texture(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAnklEQVQ4T2NkoBAwUqifgWoGjAYMDJSMTAxUjEyMDIxQNiYqGGBgZGRgYGRkZGBkYoCyMUPZGBmYGBkZmBgZGRhYGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWaB2MDIyMDKxQOsDAMCzCxcZc6jRAAAAAElFTkSuQmCC',
            this.scene
        );
        
        particleSystem.emitter = emitter;
        particleSystem.createSphereEmitter(radius);
        
        // 颜色
        particleSystem.color1 = new BABYLON.Color4(color.r, color.g, color.b, 0.8);
        particleSystem.color2 = new BABYLON.Color4(color.r, color.g, color.b, 0.4);
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
        
        // 大小
        particleSystem.minSize = 0.2;
        particleSystem.maxSize = 0.5;
        
        // 生命周期
        particleSystem.minLifeTime = 0.5;
        particleSystem.maxLifeTime = 1.0;
        
        // 发射率
        particleSystem.emitRate = 50;
        
        // 混合模式
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        
        // 方向
        particleSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
        particleSystem.direction2 = new BABYLON.Vector3(1, 1, 1);
        
        // 速度
        particleSystem.minEmitPower = 0.5;
        particleSystem.maxEmitPower = 1;
        
        // 重力
        particleSystem.gravity = BABYLON.Vector3.Zero();
        
        // 启动
        particleSystem.start();
        
        const id = `aura_${Date.now()}`;
        this.particleSystems.set(id, particleSystem);
        
        return particleSystem;
    }
    
    /**
     * 创建子弹轨迹
     */
    public createBulletTrail(
        startPosition: BABYLON.Vector3,
        endPosition: BABYLON.Vector3,
        color: BABYLON.Color3 = new BABYLON.Color3(0, 0.8, 1),
        duration: number = 0.1
    ): BABYLON.ParticleSystem {
        const particleSystem = new BABYLON.ParticleSystem('bulletTrail', 100, this.scene);
        
        particleSystem.particleTexture = new BABYLON.Texture(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAnklEQVQ4T2NkoBAwUqifgWoGjAYMDJSMTAxUjEyMDIxQNiYqGGBgZGRgYGRkZGBkYoCyMUPZGBmYGBkZmBgZGRhYGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWaB2MDIyMDKxQOsDAMCzCxcZc6jRAAAAAElFTkSuQmCC',
            this.scene
        );
        
        particleSystem.emitter = startPosition.clone();
        particleSystem.createSphereEmitter(0.1);
        
        // 颜色
        particleSystem.color1 = new BABYLON.Color4(color.r, color.g, color.b, 1);
        particleSystem.color2 = new BABYLON.Color4(color.r, color.g, color.b, 1);
        particleSystem.colorDead = new BABYLON.Color4(color.r, color.g, color.b, 0);
        
        // 大小
        particleSystem.minSize = 0.05;
        particleSystem.maxSize = 0.1;
        
        // 生命周期
        particleSystem.minLifeTime = duration;
        particleSystem.maxLifeTime = duration * 2;
        
        // 发射率
        particleSystem.emitRate = 1000;
        
        // 混合模式
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        
        // 方向
        const direction = endPosition.subtract(startPosition).normalize();
        particleSystem.direction1 = direction.scale(10);
        particleSystem.direction2 = direction.scale(15);
        
        // 速度
        particleSystem.minEmitPower = 10;
        particleSystem.maxEmitPower = 15;
        
        // 无重力
        particleSystem.gravity = BABYLON.Vector3.Zero();
        
        // 自动停止
        particleSystem.targetStopDuration = duration;
        particleSystem.disposeOnStop = true;
        
        // 启动
        particleSystem.start();
        
        const id = `bullet_${Date.now()}`;
        this.particleSystems.set(id, particleSystem);
        
        return particleSystem;
    }
    
    /**
     * 创建激光效果
     */
    public createLaserBeam(
        startPosition: BABYLON.Vector3,
        endPosition: BABYLON.Vector3,
        color: BABYLON.Color3 = new BABYLON.Color3(1, 0, 0),
        width: number = 0.1
    ): BABYLON.Mesh {
        const direction = endPosition.subtract(startPosition);
        const length = direction.length();
        
        // 创建激光几何体
        const laser = BABYLON.MeshBuilder.CreateCylinder('laser', {
            height: length,
            diameter: width
        }, this.scene);
        
        // 定位和旋转
        laser.position = BABYLON.Vector3.Center(startPosition, endPosition);
        laser.lookAt(endPosition);
        laser.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.LOCAL);
        
        // 创建发光材质
        const laserMaterial = new BABYLON.StandardMaterial('laserMaterial', this.scene);
        laserMaterial.emissiveColor = color;
        laserMaterial.disableLighting = true;
        laserMaterial.alpha = 0.9;
        
        laser.material = laserMaterial;
        
        return laser;
    }
    
    /**
     * 创建防护罩效果
     */
    public createShieldEffect(
        emitter: BABYLON.AbstractMesh,
        color: BABYLON.Color3 = new BABYLON.Color3(0, 0.5, 1)
    ): BABYLON.ParticleSystem {
        const particleSystem = new BABYLON.ParticleSystem('shield', 1000, this.scene);
        
        particleSystem.particleTexture = new BABYLON.Texture(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAnklEQVQ4T2NkoBAwUqifgWoGjAYMDJSMTAxUjEyMDIxQNiYqGGBgZGRgYGRkZGBkYoCyMUPZGBmYGBkZmBgZGRhYGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWRgYGFkYGBhZGBgYWaB2MDIyMDKxQOsDAMCzCxcZc6jRAAAAAElFTkSuQmCC',
            this.scene
        );
        
        particleSystem.emitter = emitter;
        particleSystem.createSphereEmitter(2);
        
        // 颜色
        particleSystem.color1 = new BABYLON.Color4(color.r, color.g, color.b, 0.6);
        particleSystem.color2 = new BABYLON.Color4(color.r, color.g, color.b, 0.3);
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
        
        // 大小
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.3;
        
        // 生命周期
        particleSystem.minLifeTime = 0.5;
        particleSystem.maxLifeTime = 1.5;
        
        // 发射率
        particleSystem.emitRate = 100;
        
        // 混合模式
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        
        // 方向
        particleSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
        particleSystem.direction2 = new BABYLON.Vector3(1, 1, 1);
        
        // 速度
        particleSystem.minEmitPower = 0.5;
        particleSystem.maxEmitPower = 1;
        
        // 重力
        particleSystem.gravity = BABYLON.Vector3.Zero();
        
        // 启动
        particleSystem.start();
        
        const id = `shield_${Date.now()}`;
        this.particleSystems.set(id, particleSystem);
        
        return particleSystem;
    }
    
    /**
     * 获取所有粒子系统
     */
    public getParticleSystems(): Map<string, BABYLON.ParticleSystem> {
        return this.particleSystems;
    }
    
    /**
     * 停止所有粒子系统
     */
    public stopAll(): void {
        for (const [, particleSystem] of this.particleSystems) {
            particleSystem.stop();
        }
    }
    
    /**
     * 销毁所有粒子系统
     */
    public disposeAll(): void {
        for (const [id, particleSystem] of this.particleSystems) {
            particleSystem.dispose();
            this.particleSystems.delete(id);
        }
        
        this.particleSystems.clear();
        console.log('[ParticleSystem] 所有粒子系统已销毁');
    }
}

// 全局实例
let particleSystemInstance: AdvancedParticleSystem | null = null;

export const createParticleSystem = (scene: BABYLON.Scene): AdvancedParticleSystem => {
    if (particleSystemInstance) {
        particleSystemInstance.disposeAll();
    }
    
    particleSystemInstance = new AdvancedParticleSystem(scene);
    return particleSystemInstance;
};

export const getParticleSystem = (): AdvancedParticleSystem | null => {
    return particleSystemInstance;
};
