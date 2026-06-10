import {
    Scene, Vector3, MeshBuilder, StandardMaterial, Color3,
    Mesh, TransformNode, Texture, ParticleSystem, Color4
} from '@babylonjs/core';
import { PlayerShip } from './PlayerShip';
import { TextureManager } from './TextureManager';

export class Enemy {
    public mesh: Mesh;
    public body: TransformNode;
    public speed: number;
    public health: number;
    private target: Vector3;
    private scene: Scene;
    private textureManager: TextureManager;
    private explosionParticles: ParticleSystem | null = null;

    constructor(scene: Scene, position: Vector3, target: Vector3, textureManager: TextureManager) {
        this.scene = scene;
        this.textureManager = textureManager;
        this.body = new TransformNode('enemy', scene);
        this.body.position = position;
        this.target = target;
        this.speed = 20 + Math.random() * 10;
        this.health = 100;

        this.mesh = this.createEnemyShip(scene);
        this.createExplosionParticles(scene);
    }

    private createEnemyShip(scene: Scene): Mesh {
        // 创建敌人飞船主体
        const fuselage = MeshBuilder.CreateBox('enemyFuselage', {
            width: 4,
            height: 1.5,
            depth: 8
        }, scene);
        fuselage.parent = this.body;

        // 添加机翼
        const leftWing = MeshBuilder.CreateBox('enemyLeftWing', {
            width: 1,
            height: 5,
            depth: 2
        }, scene);
        leftWing.parent = this.body;
        leftWing.position.z = 3;
        leftWing.position.y = 3;

        const rightWing = MeshBuilder.CreateBox('enemyRightWing', {
            width: 1,
            height: 5,
            depth: 2
        }, scene);
        rightWing.parent = this.body;
        rightWing.position.z = 3;
        rightWing.position.y = -3;

        // 创建材质
        const material = new StandardMaterial('enemyMaterial', scene);
        material.diffuseColor = new Color3(0.8, 0.2, 0.2);
        material.specularColor = new Color3(0.6, 0.6, 0.6);

        // 使用TextureManager加载纹理
        try {
            material.diffuseTexture = this.textureManager.getTexture('./textures/metalScratched.jpg');
            // 使用类型断言来访问Texture特定属性
            if (material.diffuseTexture) {
                const texture = material.diffuseTexture as any;
                if (typeof texture.uScale !== 'undefined') {
                    texture.uScale = 1;
                }
                if (typeof texture.vScale !== 'undefined') {
                    texture.vScale = 1;
                }
            }
        } catch (error) {
            console.warn('Failed to load metalScratched texture for enemy:', error);
        }

        fuselage.material = material;
        leftWing.material = material;
        rightWing.material = material;

        // 合并所有组件
        const mergedMesh = Mesh.MergeMeshes([fuselage, leftWing, rightWing], true, false, undefined, false, true);
        
        if (mergedMesh) {
            mergedMesh.parent = this.body;
            mergedMesh.name = 'enemyShipMesh';
            return mergedMesh;
        } else {
            // 如果合并失败，使用机身作为主网格
            console.warn('Failed to merge enemy ship meshes, using fuselage only');
            return fuselage;
        }
    }

    private createExplosionParticles(scene: Scene): void {
        this.explosionParticles = new ParticleSystem('explosionParticles', 2000, scene);
        try {
            this.explosionParticles.particleTexture = this.textureManager.getTexture('./textures/flare.png');
        } catch (error) {
            console.warn('Failed to load flare texture for enemy explosion:', error);
        }
        // 初始化时emitter设为零向量，先不发射粒子
        this.explosionParticles.emitter = Vector3.Zero();
        this.explosionParticles.color1 = new Color4(1, 0.5, 0, 1);
        this.explosionParticles.color2 = new Color4(1, 0, 0, 1);
        this.explosionParticles.colorDead = new Color4(0, 0, 0, 0);
        this.explosionParticles.minSize = 0.5;
        this.explosionParticles.maxSize = 3.0;
        this.explosionParticles.minLifeTime = 0.5;
        this.explosionParticles.maxLifeTime = 1.5;
        this.explosionParticles.emitRate = 0;
        this.explosionParticles.blendMode = ParticleSystem.BLENDMODE_ADD;
        this.explosionParticles.direction1 = new Vector3(-1, -1, -1);
        this.explosionParticles.direction2 = new Vector3(1, 1, 1);
        this.explosionParticles.minAngularSpeed = -Math.PI;
        this.explosionParticles.maxAngularSpeed = Math.PI;
        this.explosionParticles.minEmitPower = 20;
        this.explosionParticles.maxEmitPower = 40;
        this.explosionParticles.gravity = new Vector3(0, 0, 0);
    }

    public update(deltaTime: number, playerPosition: Vector3): void {
        // 追踪玩家
        this.target = playerPosition;
        const direction = this.target.subtract(this.body.position).normalize();
        
        // 移动向玩家
        this.body.position = this.body.position.add(direction.scale(this.speed * deltaTime));
        
        // 朝向玩家
        this.body.lookAt(this.target);
    }

    public takeDamage(damage: number): boolean {
        this.health -= damage;
        if (this.health <= 0) {
            this.explode();
            return true;
        }
        return false;
    }

    private explode(): void {
        if (this.explosionParticles && this.body) {
            // 保存位置，因为body即将被销毁
            const explosionPosition = this.body.position.clone();
            
            // 将emitter改为固定位置，因为body即将被销毁
            this.explosionParticles.emitter = explosionPosition;
            this.explosionParticles.emitRate = 1000;
            this.explosionParticles.start();
            
            // 2秒后停止并销毁粒子系统
            setTimeout(() => {
                if (this.explosionParticles) {
                    try {
                        this.explosionParticles.stop();
                        this.explosionParticles.dispose();
                    } catch (error) {
                        console.warn('Error disposing explosion particles:', error);
                    }
                    this.explosionParticles = null;
                }
            }, 2000);
        }
        
        // 移除敌人模型
        this.cleanup();
    }
    
    private cleanup(): void {
        // 安全地移除网格和body
        if (this.mesh) {
            try {
                this.mesh.dispose();
            } catch (error) {
                console.warn('Error disposing enemy mesh:', error);
            }
            this.mesh = null as any;
        }
        if (this.body) {
            try {
                this.body.dispose();
            } catch (error) {
                console.warn('Error disposing enemy body:', error);
            }
            this.body = null as any;
        }
    }

    public dispose(): void {
        // 先清理爆炸粒子
        if (this.explosionParticles) {
            try {
                this.explosionParticles.dispose();
            } catch (error) {
                console.warn('Error disposing explosion particles:', error);
            }
            this.explosionParticles = null;
        }
        
        // 再清理网格和body
        this.cleanup();
    }
}

export class EnemySystem {
    private scene: Scene;
    private player: PlayerShip;
    private enemies: Enemy[] = [];
    private spawnTimer: number = 0;
    private spawnInterval: number = 2;
    private maxEnemies: number = 10;
    private textureManager: TextureManager;

    constructor(scene: Scene, player: PlayerShip, textureManager: TextureManager) {
        this.scene = scene;
        this.player = player;
        this.textureManager = textureManager;
    }

    public update(deltaTime: number): void {
        // 更新现有敌人
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            // 检查enemy是否还有效
            if (enemy.body && enemy.mesh) {
                enemy.update(deltaTime, this.player.getPosition());
            } else {
                // 如果敌人已经无效，从列表中移除
                this.enemies.splice(i, 1);
            }
        }

        // 生成新敌人
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnInterval && this.enemies.length < this.maxEnemies) {
            this.spawnEnemy();
            this.spawnTimer = 0;
        }
    }

    private spawnEnemy(): void {
        // 在玩家前方随机位置生成敌人
        const spawnDistance = 100;
        const angle = Math.random() * Math.PI * 2;
        const position = new Vector3(
            Math.cos(angle) * spawnDistance,
            (Math.random() - 0.5) * 50,
            Math.sin(angle) * spawnDistance - 50
        );

        const enemy = new Enemy(this.scene, position, Vector3.Zero(), this.textureManager);
        this.enemies.push(enemy);
    }

    public checkCollisions(projectiles: any[]): number {
        let kills = 0;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            for (let j = projectiles.length - 1; j >= 0; j--) {
                const projectile = projectiles[j];
                
                // 简单的碰撞检测
                const distance = Vector3.Distance(enemy.body.position, projectile.position);
                if (distance < 2) {
                    // 敌人受到伤害
                    if (enemy.takeDamage(50)) {
                        this.enemies.splice(i, 1);
                        kills++;
                    }
                    
                    // 移除子弹
                    projectile.dispose();
                    projectiles.splice(j, 1);
                    break;
                }
            }
        }

        return kills;
    }

    public dispose(): void {
        for (const enemy of this.enemies) {
            if (enemy && typeof enemy.dispose === 'function') {
                enemy.dispose();
            }
        }
        this.enemies = [];
    }

    public getEnemies(): Enemy[] {
        return this.enemies;
    }
}