import {
    Scene, Vector2, Vector3, MeshBuilder, StandardMaterial, Color3,
    Mesh, TransformNode, ParticleSystem, Texture, Color4,
    PhysicsImpostor
} from '@babylonjs/core';
import { TextureManager } from './TextureManager';

export class PlayerShip {
    public mesh!: Mesh;
    public body!: TransformNode;
    public speed: number = 0;
    public maxSpeed: number = 50;
    public acceleration: number = 20;
    public deceleration: number = 15;
    public rotationSpeed: number = 3;
    public rollSpeed: number = 5;
    
    private engineParticles!: ParticleSystem;
    private boostParticles!: ParticleSystem;
    private textureManager: TextureManager;

    constructor(scene: Scene, textureManager: TextureManager) {
        this.textureManager = textureManager;
        this.createShip(scene);
        this.createParticleSystems(scene);
        this.setupPhysics(scene);
    }

    private createShip(scene: Scene): void {
        this.body = new TransformNode('playerShip', scene);
        this.body.rotation.x = Math.PI / 2; // 设置body的初始旋转与机身一致
        
        // 机身 - 使用胶囊体，调整为更细长的形状，降低细分度
        const fuselage = MeshBuilder.CreateCapsule('fuselage', {
            height: 12,
            radius: 1.0,
            subdivisions: 8,
            capSubdivisions: 4
        }, scene);
        fuselage.parent = this.body;
        
        // 添加引擎喷口 - 调整位置和尺寸，降低细分度
        const engine1 = MeshBuilder.CreateCylinder('engine1', {
            height: 3.0,
            diameterTop: 0.6,
            diameterBottom: 1.2,
            tessellation: 8
        }, scene);
        engine1.parent = this.body;
        engine1.position.x = -5.0;
        engine1.position.y = 1.2;
        engine1.position.z = 0;
        
        const engine2 = MeshBuilder.CreateCylinder('engine2', {
            height: 3.0,
            diameterTop: 0.6,
            diameterBottom: 1.2,
            tessellation: 12
        }, scene);
        engine2.parent = this.body;
        engine2.position.x = -5.0;
        engine2.position.y = -1.2;
        engine2.position.z = 0;
        
        // 添加机翼 - 减小深度，调整为更合理的比例
        const wing = MeshBuilder.CreateBox('wing', {
            width: 10,
            height: 0.3,
            depth: 8
        }, scene);
        wing.parent = this.body;
        wing.position.x = -1.5;
        wing.position.y = 0;
        wing.position.z = 0;
        
        // 添加机翼襟翼 - 调整位置和尺寸
        const leftFlap = MeshBuilder.CreateBox('leftFlap', {
            width: 2.0,
            height: 0.2,
            depth: 3
        }, scene);
        leftFlap.parent = this.body;
        leftFlap.position.x = -1.5;
        leftFlap.position.y = 0;
        leftFlap.position.z = 5;
        
        const rightFlap = MeshBuilder.CreateBox('rightFlap', {
            width: 2.0,
            height: 0.2,
            depth: 3
        }, scene);
        rightFlap.parent = this.body;
        rightFlap.position.x = -1.5;
        rightFlap.position.y = 0;
        rightFlap.position.z = -5;
        
        // 添加翼尖 - 改为武器挂架
        const leftTip = MeshBuilder.CreateCylinder('leftTip', {
            height: 1.5,
            diameterTop: 0.5,
            diameterBottom: 0.8,
            tessellation: 8
        }, scene);
        leftTip.parent = this.body;
        leftTip.position.x = -1.5;
        leftTip.position.y = 0;
        leftTip.position.z = 6;
        leftTip.rotation.x = Math.PI / 2;
        
        const rightTip = MeshBuilder.CreateCylinder('rightTip', {
            height: 1.5,
            diameterTop: 0.5,
            diameterBottom: 0.8,
            tessellation: 8
        }, scene);
        rightTip.parent = this.body;
        rightTip.position.x = -1.5;
        rightTip.position.y = 0;
        rightTip.position.z = -6;
        rightTip.rotation.x = Math.PI / 2;
        
        // 添加机炮
        const leftCannon = MeshBuilder.CreateCylinder('leftCannon', {
            height: 2.0,
            diameter: 0.3,
            tessellation: 8
        }, scene);
        leftCannon.parent = this.body;
        leftCannon.position.x = 1.5;
        leftCannon.position.y = 0.5;
        leftCannon.position.z = 2.0;
        leftCannon.rotation.x = Math.PI / 2;
        
        const rightCannon = MeshBuilder.CreateCylinder('rightCannon', {
            height: 2.0,
            diameter: 0.3,
            tessellation: 8
        }, scene);
        rightCannon.parent = this.body;
        rightCannon.position.x = 1.5;
        rightCannon.position.y = 0.5;
        rightCannon.position.z = -2.0;
        rightCannon.rotation.x = Math.PI / 2;
        
        // 添加导弹发射器
        const leftMissileRack = MeshBuilder.CreateBox('leftMissileRack', {
            width: 3.0,
            height: 0.5,
            depth: 1.0
        }, scene);
        leftMissileRack.parent = this.body;
        leftMissileRack.position.x = -3.0;
        leftMissileRack.position.y = 0.5;
        leftMissileRack.position.z = 3.0;
        
        const rightMissileRack = MeshBuilder.CreateBox('rightMissileRack', {
            width: 3.0,
            height: 0.5,
            depth: 1.0
        }, scene);
        rightMissileRack.parent = this.body;
        rightMissileRack.position.x = -3.0;
        rightMissileRack.position.y = 0.5;
        rightMissileRack.position.z = -3.0;
        
        // 添加尾翼 - 调整尺寸和位置，增加垂直尾翼
        const tailFin = MeshBuilder.CreateBox('tailFin', {
            width: 2.5,
            height: 3,
            depth: 1.0
        }, scene);
        tailFin.parent = this.body;
        tailFin.position.x = -4.5;
        tailFin.position.y = 0;
        tailFin.position.z = 0;
        
        // 添加垂直尾翼
        const verticalFin = MeshBuilder.CreateBox('verticalFin', {
            width: 1.0,
            height: 2.5,
            depth: 1.5
        }, scene);
        verticalFin.parent = this.body;
        verticalFin.position.x = -4.5;
        verticalFin.position.y = 1.8;
        verticalFin.position.z = 0;
        
        // 添加驾驶舱 - 更详细的结构，降低细分度
        const cockpit = MeshBuilder.CreateSphere('cockpit', {
            diameter: 1.8,
            segments: 8
        }, scene);
        cockpit.parent = this.body;
        cockpit.position.x = 3.0; // 位于机身前部
        cockpit.position.y = 0.8; // 位于机身顶部
        cockpit.scaling.z = 0.8; // 沿Z轴压缩，使其更扁平
        
        // 添加驾驶舱框架
        const cockpitFrame = MeshBuilder.CreateBox('cockpitFrame', {
            width: 2.0,
            height: 1.0,
            depth: 1.5
        }, scene);
        cockpitFrame.parent = this.body;
        cockpitFrame.position.x = 3.0;
        cockpitFrame.position.y = 0.8;
        cockpitFrame.scaling.z = 0.8;
        
        // 添加驾驶舱玻璃罩
        const cockpitGlass = MeshBuilder.CreateBox('cockpitGlass', {
            width: 1.9,
            height: 0.9,
            depth: 1.4
        }, scene);
        cockpitGlass.parent = this.body;
        cockpitGlass.position.x = 3.1;
        cockpitGlass.position.y = 0.8;
        cockpitGlass.scaling.z = 0.8;
        
        // 改进材质 - 增加金属质感和纹理
        const shipMaterial = new StandardMaterial('shipMaterial', scene);
        shipMaterial.diffuseColor = new Color3(0.4, 0.5, 0.6);
        shipMaterial.specularColor = new Color3(0.9, 0.9, 0.9);
        shipMaterial.specularPower = 80;
        shipMaterial.emissiveColor = new Color3(0.1, 0.1, 0.2);
        
        // 添加金属纹理贴图
        try {
            shipMaterial.diffuseTexture = this.textureManager.getTexture('./textures/metal.jpg');
            if (shipMaterial.diffuseTexture) {
                (shipMaterial.diffuseTexture as any).uScale = 2;
                (shipMaterial.diffuseTexture as any).vScale = 2;
            }
        } catch (error) {
            console.warn('Failed to load metal texture:', error);
        }
        
        // 添加碳纤维纹理到机翼
        const wingMaterial = new StandardMaterial('wingMaterial', scene);
        wingMaterial.diffuseColor = new Color3(0.3, 0.4, 0.5);
        wingMaterial.specularColor = new Color3(0.8, 0.8, 0.8);
        wingMaterial.specularPower = 100;
        wingMaterial.emissiveColor = new Color3(0.05, 0.05, 0.1);
        
        // 添加碳纤维纹理贴图
        try {
            wingMaterial.diffuseTexture = this.textureManager.getTexture('./textures/carbon.jpg');
            if (wingMaterial.diffuseTexture) {
                (wingMaterial.diffuseTexture as any).uScale = 3;
                (wingMaterial.diffuseTexture as any).vScale = 1;
            }
        } catch (error) {
            console.warn('Failed to load carbon texture:', error);
        }
        
        // 添加金属划痕纹理到引擎
        const engineMaterial = new StandardMaterial('engineMaterial', scene);
        engineMaterial.diffuseColor = new Color3(0.2, 0.2, 0.2);
        engineMaterial.specularColor = new Color3(0.6, 0.6, 0.6);
        engineMaterial.specularPower = 50;
        engineMaterial.emissiveColor = new Color3(0.0, 0.1, 0.2);
        
        // 添加金属划痕纹理贴图
        try {
            engineMaterial.diffuseTexture = this.textureManager.getTexture('./textures/metalScratched.jpg');
            if (engineMaterial.diffuseTexture) {
                (engineMaterial.diffuseTexture as any).uScale = 1;
                (engineMaterial.diffuseTexture as any).vScale = 1;
            }
        } catch (error) {
            console.warn('Failed to load metalScratched texture:', error);
        }
        
        // 驾驶舱透明材质 - 添加玻璃纹理
        const cockpitMaterial = new StandardMaterial('cockpitMaterial', scene);
        cockpitMaterial.diffuseColor = new Color3(0.3, 0.7, 1.0);
        cockpitMaterial.specularColor = new Color3(1.0, 1.0, 1.0);
        cockpitMaterial.specularPower = 100;
        cockpitMaterial.emissiveColor = new Color3(0.1, 0.3, 0.5);
        cockpitMaterial.alpha = 0.7; // 半透明
        cockpitMaterial.backFaceCulling = false;
        
        // 添加玻璃纹理贴图
        try {
            cockpitMaterial.diffuseTexture = this.textureManager.getTexture('./textures/glass.jpg');
            if (cockpitMaterial.diffuseTexture) {
                (cockpitMaterial.diffuseTexture as any).uScale = 1;
                (cockpitMaterial.diffuseTexture as any).vScale = 1;
            }
        } catch (error) {
            console.warn('Failed to load glass texture:', error);
        }
        
        // 驾驶舱框架材质
        const cockpitFrameMaterial = new StandardMaterial('cockpitFrameMaterial', scene);
        cockpitFrameMaterial.diffuseColor = new Color3(0.8, 0.8, 0.9);
        cockpitFrameMaterial.specularColor = new Color3(1, 1, 1);
        cockpitFrameMaterial.specularPower = 100;
        
        // 驾驶舱玻璃材质
        const cockpitGlassMaterial = new StandardMaterial('cockpitGlassMaterial', scene);
        cockpitGlassMaterial.diffuseColor = new Color3(0.3, 0.7, 1.0);
        cockpitGlassMaterial.specularColor = new Color3(1.0, 1.0, 1.0);
        cockpitGlassMaterial.specularPower = 100;
        cockpitGlassMaterial.emissiveColor = new Color3(0.1, 0.3, 0.5);
        cockpitGlassMaterial.alpha = 0.5;
        cockpitGlassMaterial.backFaceCulling = false;
        
        // 武器材质
        const weaponMaterial = new StandardMaterial('weaponMaterial', scene);
        weaponMaterial.diffuseColor = new Color3(0.2, 0.2, 0.2);
        weaponMaterial.specularColor = new Color3(0.6, 0.6, 0.6);
        weaponMaterial.specularPower = 50;
        weaponMaterial.emissiveColor = new Color3(0.0, 0.1, 0.2);
        
        // 应用材质
        fuselage.material = shipMaterial;
        engine1.material = engineMaterial;
        engine2.material = engineMaterial;
        wing.material = wingMaterial;
        leftFlap.material = wingMaterial;
        rightFlap.material = wingMaterial;
        tailFin.material = wingMaterial;
        verticalFin.material = wingMaterial;
        leftTip.material = weaponMaterial;
        rightTip.material = weaponMaterial;
        leftCannon.material = weaponMaterial;
        rightCannon.material = weaponMaterial;
        leftMissileRack.material = weaponMaterial;
        rightMissileRack.material = weaponMaterial;
        cockpit.material = shipMaterial;
        cockpitFrame.material = cockpitFrameMaterial;
        cockpitGlass.material = cockpitGlassMaterial;
        
        // 合并所有组件
        const mergedMesh = Mesh.MergeMeshes([
            fuselage, engine1, engine2, wing, leftFlap, rightFlap, 
            tailFin, verticalFin, leftTip, rightTip, leftCannon, 
            rightCannon, leftMissileRack, rightMissileRack, cockpit, 
            cockpitFrame, cockpitGlass
        ], true, false, undefined, false, true);
        
        if (mergedMesh) {
            this.mesh = mergedMesh;
            this.mesh.parent = this.body;
            this.mesh.name = 'playerShipMesh';
        } else {
            // 如果合并失败，使用机身作为主网格
            this.mesh = fuselage;
            console.warn('Failed to merge player ship meshes, using fuselage only');
        }
    }

    private createParticleSystems(scene: Scene): void {
        // 优化引擎粒子效果 - 减少粒子数量
        this.engineParticles = new ParticleSystem('engineParticles', 500, scene);
        try {
            this.engineParticles.particleTexture = this.textureManager.getTexture('./textures/flare.png');
        } catch (error) {
            console.warn('Failed to load flare texture for engine particles:', error);
        }
        // 初始位置设为零向量，在update中更新
        this.engineParticles.emitter = Vector3.Zero();
        
        // 改进颜色过渡 - 从蓝色到紫色再到透明
        this.engineParticles.color1 = new Color4(0.1, 0.3, 0.8, 1);
        this.engineParticles.color2 = new Color4(0.3, 0.1, 0.8, 1);
        this.engineParticles.colorDead = new Color4(0, 0, 0, 0);
        
        this.engineParticles.minSize = 0.3;
        this.engineParticles.maxSize = 0.8;
        this.engineParticles.minLifeTime = 0.3;
        this.engineParticles.maxLifeTime = 0.7;
        this.engineParticles.emitRate = 100;
        this.engineParticles.blendMode = ParticleSystem.BLENDMODE_ONEONE;
        
        // 增加方向变化
        this.engineParticles.direction1 = new Vector3(-0.5, -0.5, -1);
        this.engineParticles.direction2 = new Vector3(0.5, 0.5, -1.5);
        
        // 添加旋转和重力效果
        this.engineParticles.minAngularSpeed = -Math.PI;
        this.engineParticles.maxAngularSpeed = Math.PI;
        this.engineParticles.gravity = new Vector3(0, 0, 0);
        
        this.engineParticles.minEmitPower = 15;
        this.engineParticles.maxEmitPower = 25;
        this.engineParticles.start();

        // 优化boost粒子效果 - 减少粒子数量
        this.boostParticles = new ParticleSystem('boostParticles', 1000, scene);
        try {
            this.boostParticles.particleTexture = this.textureManager.getTexture('./textures/flare.png');
        } catch (error) {
            console.warn('Failed to load flare texture for boost particles:', error);
        }
        // 初始位置设为零向量，在update中更新
        this.boostParticles.emitter = Vector3.Zero();
        
        // 橙色到红色的火焰效果
        this.boostParticles.color1 = new Color4(1, 0.7, 0.2, 1);
        this.boostParticles.color2 = new Color4(1, 0.2, 0, 1);
        this.boostParticles.colorDead = new Color4(0.5, 0, 0, 0);
        
        this.boostParticles.minSize = 0.5;
        this.boostParticles.maxSize = 1.5;
        this.boostParticles.minLifeTime = 0.2;
        this.boostParticles.maxLifeTime = 0.4;
        this.boostParticles.emitRate = 0;
        this.boostParticles.blendMode = ParticleSystem.BLENDMODE_ONEONE;
        
        // 更集中的方向
        this.boostParticles.direction1 = new Vector3(-0.3, -0.3, -1.5);
        this.boostParticles.direction2 = new Vector3(0.3, 0.3, -2.5);
        
        this.boostParticles.minAngularSpeed = -Math.PI;
        this.boostParticles.maxAngularSpeed = Math.PI;
        this.boostParticles.gravity = new Vector3(0, 0, 0);
        
        this.boostParticles.minEmitPower = 25;
        this.boostParticles.maxEmitPower = 40;
    }

    private setupPhysics(scene: Scene): void {
        // 暂时禁用物理设置，因为没有安装物理引擎插件
        // this.mesh.physicsImpostor = new PhysicsImpostor(
        //     this.mesh,
        //     PhysicsImpostor.BoxImpostor,
        //     { mass: 10, friction: 0.2, restitution: 0.1 },
        //     scene
        // );
    }

    public update(deltaTime: number, controls: any, mouseDelta: any): void {
        if (controls.forward) {
            this.speed = Math.min(this.speed + this.acceleration * deltaTime, this.maxSpeed);
        } else if (controls.backward) {
            this.speed = Math.max(this.speed - this.acceleration * deltaTime, -this.maxSpeed * 0.3);
        } else {
            if (this.speed > 0) {
                this.speed = Math.max(this.speed - this.deceleration * deltaTime, 0);
            } else {
                this.speed = Math.min(this.speed + this.deceleration * deltaTime, 0);
            }
        }

        if (controls.boost && this.speed > 0) {
            const targetSpeed = this.maxSpeed * 2.5;
            this.speed = Math.min(this.speed + this.acceleration * 2 * deltaTime, targetSpeed);
            this.boostParticles.emitRate = 300;
            if (!this.boostParticles.isStarted()) {
                this.boostParticles.start();
            }
        } else {
            this.boostParticles.emitRate = 0;
            if (this.boostParticles.isStarted()) {
                this.boostParticles.stop();
            }
        }

        this.engineParticles.emitRate = 50 + Math.abs(this.speed) * 3;
        this.engineParticles.minEmitPower = 5 + Math.abs(this.speed) * 0.5;
        this.engineParticles.maxEmitPower = 10 + Math.abs(this.speed);

        if (controls.left) {
            const leftDirection = new Vector3(-Math.sin(this.body.rotation.y), 0, Math.cos(this.body.rotation.y));
            const left = leftDirection.scale(this.rotationSpeed * deltaTime * (1 + this.speed * 0.1));
            this.body.position = this.body.position.add(left);
        }
        if (controls.right) {
            const rightDirection = new Vector3(Math.sin(this.body.rotation.y), 0, -Math.cos(this.body.rotation.y));
            const right = rightDirection.scale(this.rotationSpeed * deltaTime * (1 + this.speed * 0.1));
            this.body.position = this.body.position.add(right);
        }

        if (controls.up) {
            const upDirection = new Vector3(0, 1, 0);
            const up = upDirection.scale(this.rotationSpeed * deltaTime * (1 + this.speed * 0.1));
            this.body.position = this.body.position.add(up);
        }
        if (controls.down) {
            const downDirection = new Vector3(0, -1, 0);
            const down = downDirection.scale(this.rotationSpeed * deltaTime * (1 + this.speed * 0.1));
            this.body.position = this.body.position.add(down);
        }

        if (mouseDelta.x !== 0 || mouseDelta.y !== 0) {
            this.body.rotation.y += mouseDelta.x * this.rotationSpeed * 2;
            this.body.rotation.x += mouseDelta.y * this.rotationSpeed;
        }

        if (controls.rollLeft) {
            this.body.rotation.z += this.rollSpeed * deltaTime;
        }
        if (controls.rollRight) {
            this.body.rotation.z -= this.rollSpeed * deltaTime;
        }

        if (!controls.rollLeft && !controls.rollRight) {
            if (Math.abs(this.body.rotation.z) > 0.01) {
                this.body.rotation.z *= 0.95;
            } else {
                this.body.rotation.z = 0;
            }
        }

        this.body.rotation.z = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.body.rotation.z));

        const forward = this.body.forward.scale(this.speed * deltaTime);
        this.body.position = this.body.position.add(forward);
        
        // 更新粒子系统位置
        const enginePosition = this.body.position.add(this.body.forward.scale(-4));
        this.engineParticles.emitter = enginePosition;
        this.boostParticles.emitter = enginePosition;
    }

    public getPosition(): Vector3 {
        return this.body.position;
    }

    public getForward(): Vector3 {
        return this.body.forward;
    }

    public dispose(): void {
        if (this.engineParticles) {
            this.engineParticles.dispose();
        }
        if (this.boostParticles) {
            this.boostParticles.dispose();
        }
        if (this.mesh) {
            this.mesh.dispose();
        }
        if (this.body) {
            this.body.dispose();
        }
        // 不销毁textureManager，因为它是Game类全局管理的资源
    }
}