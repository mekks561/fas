import {
    Scene, Vector3, MeshBuilder, StandardMaterial, Color3,
    Mesh, TransformNode, ParticleSystem, Color4, Texture
} from '@babylonjs/core';
import { PlayerShip } from './PlayerShip';
import { Enemy } from './EnemySystem';

export class Projectile {
    public mesh: Mesh;
    public position: Vector3;
    public direction: Vector3;
    public speed: number;
    public damage: number;
    private scene: Scene;
    private lifeTime: number;
    private maxLifeTime: number = 5;

    constructor(scene: Scene, position: Vector3, direction: Vector3, speed: number = 100, damage: number = 50) {
        this.scene = scene;
        this.position = position.clone();
        this.direction = direction.normalize();
        this.speed = speed;
        this.damage = damage;
        this.lifeTime = 0;

        this.mesh = this.createProjectileMesh(scene);
        this.mesh.position = this.position;
    }

    // 重置子弹状态，用于对象池
    public reset(position: Vector3, direction: Vector3, speed: number = 100, damage: number = 50): void {
        this.position = position.clone();
        this.direction = direction.normalize();
        this.speed = speed;
        this.damage = damage;
        this.lifeTime = 0;
        
        this.mesh.position = this.position;
        this.mesh.isVisible = true;
        
        // 重置粒子系统
        const trailParticles = (this.mesh as any).trailParticles;
        if (trailParticles) {
            trailParticles.emitter = this.position;
            
            // ParticleSystem没有restart()方法，需要先停止再启动
            if (trailParticles.isStarted()) {
                trailParticles.stop();
            }
            trailParticles.start();
        }
    }

    private createProjectileMesh(scene: Scene): Mesh {
        // 创建子弹模型
        const projectile = MeshBuilder.CreateCylinder('projectile', {
            height: 2,
            diameter: 0.3
        }, scene);
        projectile.rotation.x = Math.PI / 2;

        // 创建材质
        const material = new StandardMaterial('projectileMaterial', scene);
        material.emissiveColor = new Color3(1, 0.5, 0);
        material.diffuseColor = new Color3(1, 0.8, 0);
        material.specularColor = new Color3(1, 1, 1);

        projectile.material = material;

        // 创建子弹轨迹粒子效果
        const trailParticles = new ParticleSystem('projectileTrail', 200, scene);
        try {
            trailParticles.particleTexture = new Texture('./textures/flare.png', scene);
        } catch (error) {
            console.warn('Failed to load flare texture for projectile trail:', error);
        }
        trailParticles.emitter = projectile.position;
        trailParticles.color1 = new Color4(1, 0.8, 0, 1);
        trailParticles.color2 = new Color4(1, 0.5, 0, 0.8);
        trailParticles.colorDead = new Color4(1, 0, 0, 0);
        trailParticles.minSize = 0.1;
        trailParticles.maxSize = 0.3;
        trailParticles.minLifeTime = 0.1;
        trailParticles.maxLifeTime = 0.3;
        trailParticles.emitRate = 50;
        trailParticles.blendMode = ParticleSystem.BLENDMODE_ADD;
        trailParticles.direction1 = new Vector3(-0.1, -0.1, 0);
        trailParticles.direction2 = new Vector3(0.1, 0.1, 0);
        trailParticles.minEmitPower = 1;
        trailParticles.maxEmitPower = 3;
        trailParticles.gravity = new Vector3(0, 0, 0);
        trailParticles.start();

        // 将粒子系统与子弹关联
        (projectile as any).trailParticles = trailParticles;

        return projectile;
    }

    public update(deltaTime: number): boolean {
        // 更新子弹位置
        this.position = this.position.add(this.direction.scale(this.speed * deltaTime));
        this.mesh.position = this.position;

        // 更新粒子系统位置
        const trailParticles = (this.mesh as any).trailParticles;
        if (trailParticles) {
            trailParticles.emitter = this.position;
        }

        // 更新生命周期
        this.lifeTime += deltaTime;
        if (this.lifeTime >= this.maxLifeTime) {
            this.dispose();
            return true; // 子弹过期
        }

        return false;
    }

    public dispose(): void {
        // 隐藏子弹，不销毁，用于对象池
        this.mesh.isVisible = false;
        
        // 暂停粒子系统
        const trailParticles = (this.mesh as any).trailParticles;
        if (trailParticles && trailParticles.isStarted()) {
            trailParticles.stop();
        }
    }

    // 销毁子弹，用于清理对象池
    public destroy(): void {
        // 清理粒子系统
        const trailParticles = (this.mesh as any).trailParticles;
        if (trailParticles) {
            trailParticles.dispose();
        }

        // 清理子弹模型
        this.mesh.dispose();
    }

    public checkCollision(target: Mesh | TransformNode): boolean {
        const distance = Vector3.Distance(this.position, target.position);
        return distance < 2;
    }
}

export class WeaponSystem {
    private scene: Scene;
    private projectiles: Projectile[] = [];
    private projectilePool: Projectile[] = [];
    private fireRate: number;
    private fireTimer: number = 0;
    private player: PlayerShip | null = null;
    private maxPoolSize: number = 100;

    constructor(scene: Scene, fireRate: number = 0.2) {
        this.scene = scene;
        this.fireRate = fireRate;
        // 初始化对象池
        this.initProjectilePool();
    }

    // 初始化对象池
    private initProjectilePool(): void {
        for (let i = 0; i < 20; i++) {
            // 创建一个临时位置和方向
            const tempPos = Vector3.Zero();
            const tempDir = new Vector3(1, 0, 0);
            const projectile = new Projectile(this.scene, tempPos, tempDir);
            projectile.dispose(); // 隐藏子弹，放入对象池
            this.projectilePool.push(projectile);
        }
    }

    public setPlayer(player: PlayerShip): void {
        this.player = player;
    }

    public fire(): void {
        if (!this.player || this.fireTimer < this.fireRate) {
            return;
        }

        // 获取玩家位置和方向
        const playerPosition = this.player.getPosition();
        const playerForward = this.player.getForward();

        // 在玩家前方创建子弹
        const spawnPosition = playerPosition.add(playerForward.scale(5));
        
        // 从对象池获取子弹
        let projectile: Projectile;
        if (this.projectilePool.length > 0) {
            projectile = this.projectilePool.pop()!;
            projectile.reset(spawnPosition, playerForward);
        } else {
            // 对象池为空，创建新子弹
            projectile = new Projectile(this.scene, spawnPosition, playerForward);
        }
        
        this.projectiles.push(projectile);
        this.fireTimer = 0;
    }

    public update(deltaTime: number): void {
        // 更新发射计时器
        this.fireTimer += deltaTime;

        // 更新所有子弹
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            if (projectile.update(deltaTime)) {
                // 子弹过期，放回对象池
                this.projectiles.splice(i, 1);
                if (this.projectilePool.length < this.maxPoolSize) {
                    projectile.dispose(); // 隐藏子弹
                    this.projectilePool.push(projectile);
                } else {
                    // 对象池已满，销毁子弹
                    projectile.destroy();
                }
            }
        }
    }

    public checkCollisions(enemies: Enemy[]): number {
        let hits = 0;

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];

            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];

                if (projectile.checkCollision(enemy.body)) {
                    // 敌人受到伤害
                    if (enemy.takeDamage(projectile.damage)) {
                        hits++;
                    }

                    // 移除子弹并放回对象池
                    this.projectiles.splice(i, 1);
                    if (this.projectilePool.length < this.maxPoolSize) {
                        projectile.dispose(); // 隐藏子弹
                        this.projectilePool.push(projectile);
                    } else {
                        // 对象池已满，销毁子弹
                        projectile.destroy();
                    }
                    break;
                }
            }
        }

        return hits;
    }

    public dispose(): void {
        // 销毁所有活跃子弹
        for (const projectile of this.projectiles) {
            if (projectile && typeof projectile.destroy === 'function') {
                projectile.destroy();
            }
        }
        this.projectiles = [];
        
        // 销毁对象池中的所有子弹
        for (const projectile of this.projectilePool) {
            if (projectile && typeof projectile.destroy === 'function') {
                projectile.destroy();
            }
        }
        this.projectilePool = [];
    }

    public getProjectiles(): Projectile[] {
        return this.projectiles;
    }
    
    // 获取当前活跃子弹数量
    public getProjectileCount(): number {
        return this.projectiles.length;
    }
}