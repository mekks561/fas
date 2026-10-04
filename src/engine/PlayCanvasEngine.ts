import * as pc from 'playcanvas';
import { InstancedRenderer } from './InstancedRenderer';
import { GameEngineConfig, LightConfig, CameraConfig, GameEngine } from './GameEngine';
import { PluginSystem, Plugin, PluginConfig } from './PluginSystem';
import { ProceduralModelGenerator } from './ProceduralModelGenerator';
import { ModelAssetProvider } from './ModelAssetProvider';

export type GameConfig = GameEngineConfig;

export class PlayCanvasGameEngine implements GameEngine {
  private app: pc.Application;
  private camera: pc.Entity;
  private isStarted: boolean = false;
  private physicsEnabled: boolean = false;
  private onResize: () => void;
  private instancedRenderer: InstancedRenderer | null = null;
  private pluginSystem: PluginSystem | null = null;
  private modelAssets: ModelAssetProvider | null = null;

  constructor(config: GameConfig) {
    const { canvas, antialias = true, enablePhysics = true } = config;

    console.log('[PlayCanvasEngine] Creating application...');
    console.log('[PlayCanvasEngine] Canvas:', canvas);
    console.log('[PlayCanvasEngine] Canvas size:', canvas?.width, 'x', canvas?.height);
    console.log('[PlayCanvasEngine] Canvas style:', canvas?.style);

    this.app = new pc.Application(canvas, {
      elementInput: new pc.ElementInput(canvas),
      mouse: new pc.Mouse(canvas),
      touch: 'ontouchstart' in window ? new pc.TouchDevice(canvas) : undefined,
      keyboard: new pc.Keyboard(canvas),
      graphicsDeviceOptions: {
        deviceType: [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2],
        antialias,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      },
    });

    const deviceType = this.app.graphicsDevice.deviceType;
    console.log(`[PlayCanvasEngine] Application created (GPU: ${deviceType})`);

    // 不使用 PlayCanvas 的 fill mode，因为它会创建新的 canvas 元素导致 React ref 失效
    // 改为手动管理 canvas 大小
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    console.log('[PlayCanvasEngine] Canvas after setup:', canvas.width, 'x', canvas.height);

    this.app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.25);

    this.camera = new pc.Entity('mainCamera');
    this.camera.addComponent('camera', {
      clearColor: new pc.Color(0.02, 0.02, 0.05),
      nearClip: 0.1,
      farClip: 1000,
      fov: 60,
    });
    this.app.root.addChild(this.camera);

    console.log('[PlayCanvasEngine] Camera created at position (0, 0, 0)');

    if (enablePhysics) {
      this.enablePhysics();
    }

    this.onResize = () => this.app.resizeCanvas();
    window.addEventListener('resize', this.onResize);

    this.instancedRenderer = new InstancedRenderer(this.app);
    this.pluginSystem = new PluginSystem(this.app, this);

    console.log('[PlayCanvasEngine] Engine initialization complete');
  }

  private enablePhysics(): void {
    try {
      this.app.systems.physics?.gravity.set(0, 0, 0);
      this.physicsEnabled = true;
      console.log('[PlayCanvasEngine] Physics system enabled');
    } catch (error) {
      console.warn('[PlayCanvasEngine] Physics initialization failed:', error);
      this.physicsEnabled = false;
    }
  }

  public start(): void {
    if (!this.isStarted) {
      console.log('[PlayCanvasEngine] Starting application...');
      this.app.start();
      this.isStarted = true;
      console.log('[PlayCanvasEngine] Application started');
    }
  }

  public setCameraPosition(x: number, y: number, z: number): void {
    this.camera.setPosition(x, y, z);
  }

  public lookAt(target: pc.Vec3): void {
    this.camera.lookAt(target);
  }

  public addLight(name: string, config: LightConfig): pc.Entity;
  public addLight(name: string, position: pc.Vec3, color: pc.Color, intensity: number): pc.Entity;
  public addLight(
    name: string,
    configOrPosition: LightConfig | pc.Vec3,
    color?: pc.Color,
    intensity?: number,
  ): pc.Entity {
    const light = new pc.Entity(name);

    if ('type' in configOrPosition) {
      const config = configOrPosition as LightConfig;
      light.setPosition(config.position || new pc.Vec3(0, 10, 0));
      light.addComponent('light', {
        type: config.type,
        color: config.color || new pc.Color(1, 1, 1),
        intensity: config.intensity || 1,
        range: config.range || 100,
        castShadows: config.castShadows || false,
      });
    } else {
      const position = configOrPosition as pc.Vec3;
      light.setPosition(position);
      light.addComponent('light', {
        type: 'point',
        color: color || new pc.Color(1, 1, 1),
        intensity: intensity || 1,
      });
    }

    this.app.root.addChild(light);
    return light;
  }

  public addDirectionalLight(
    name: string,
    direction: pc.Vec3,
    color: pc.Color,
    intensity: number,
  ): pc.Entity {
    const light = new pc.Entity(name);
    light.setEulerAngles(
      (Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z)) *
        180) /
        Math.PI,
      (Math.atan2(direction.x, direction.z) * 180) / Math.PI,
      0,
    );
    light.addComponent('light', {
      type: 'directional',
      color,
      intensity,
      castShadows: true,
    });
    this.app.root.addChild(light);
    return light;
  }

  public createMaterial(
    name: string,
    options: {
      diffuse?: pc.Color;
      emissive?: pc.Color;
      specular?: pc.Color;
      shininess?: number;
      transparency?: number;
      blendType?: number;
    },
  ): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    material.name = name;

    if (options.diffuse) material.diffuse = options.diffuse;
    if (options.emissive) material.emissive = options.emissive;
    if (options.specular) material.specular = options.specular;
    if (options.shininess !== undefined) {
      (material as unknown as { shininess: number }).shininess = options.shininess;
    }
    if (options.transparency !== undefined) {
      (material as unknown as { opacity: number }).opacity = options.transparency;
    }
    if (options.blendType !== undefined) {
      material.blendType = options.blendType;
    }

    material.update();
    return material;
  }

  public createBox(
    name: string,
    width: number,
    height: number,
    depth: number,
    material: pc.Material,
  ): pc.Entity {
    const box = new pc.Entity(name);
    box.addComponent('model', { type: 'box' });
    // Engine 2：内建图元改为单位尺寸（box = 1×1×1），
    // width/height/depth 这类选项已被移除且会被静默忽略 —— 尺寸必须由 transform 承载。
    box.setLocalScale(width, height, depth);
    if (box.model) box.model.material = material;
    this.app.root.addChild(box);
    return box;
  }

  public createSphere(name: string, radius: number, material: pc.Material): pc.Entity {
    const sphere = new pc.Entity(name);
    sphere.addComponent('model', { type: 'sphere' });
    // Engine 2：sphere 直径 1（半径 0.5），故缩放系数 = 2 × 半径
    sphere.setLocalScale(radius * 2, radius * 2, radius * 2);
    if (sphere.model) sphere.model.material = material;
    this.app.root.addChild(sphere);
    return sphere;
  }

  public createCylinder(
    name: string,
    radius: number,
    height: number,
    material: pc.Material,
  ): pc.Entity {
    const cylinder = new pc.Entity(name);
    cylinder.addComponent('model', { type: 'cylinder' });
    // Engine 2：cylinder 直径 1 / 高 1，故 X/Z 缩放 = 2 × 半径，Y 缩放 = 高度
    cylinder.setLocalScale(radius * 2, height, radius * 2);
    if (cylinder.model) cylinder.model.material = material;
    this.app.root.addChild(cylinder);
    return cylinder;
  }

  public createStarField(
    count: number = 300,
    innerRadius: number = 30,
    outerRadius: number = 80,
  ): void {
    const starMaterial = this.createMaterial('starMaterial', {
      diffuse: new pc.Color(1, 1, 1),
      emissive: new pc.Color(1, 1, 1),
      specular: new pc.Color(0, 0, 0),
    });

    const container = new pc.Entity('starField');
    this.app.root.addChild(container);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
      const size = 0.05 + Math.random() * 0.15;

      const star = new pc.Entity(`star_${i}`);
      star.addComponent('model', { type: 'sphere' });
      // Engine 2：sphere 直径 1，故缩放系数 = 2 × 半径
      star.setLocalScale(size * 2, size * 2, size * 2);
      if (star.model) {
        star.model.material = starMaterial;
      }

      star.setPosition(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
      );

      container.addChild(star);
    }

    console.log('[PlayCanvasEngine] Star field created with', count, 'stars');
  }

  public createNebula(position: pc.Vec3, scale: number = 30): pc.Entity {
    const nebulaMaterial = this.createMaterial('nebulaMaterial', {
      diffuse: new pc.Color(0.3, 0.1, 0.5),
      emissive: new pc.Color(0.2, 0.05, 0.3),
      transparency: 0.15,
      blendType: pc.BLEND_ADDITIVEALPHA,
    });

    const nebula = new pc.Entity('nebula');
    nebula.addComponent('model', { type: 'sphere' });
    if (nebula.model) nebula.model.material = nebulaMaterial;
    nebula.setPosition(position);
    nebula.setLocalScale(scale, scale * 0.5, scale);

    this.app.root.addChild(nebula);
    return nebula;
  }

  public createPlanet(name: string, position: pc.Vec3, radius: number, color: pc.Color): pc.Entity {
    const planetMaterial = this.createMaterial(`planet_${name}`, {
      diffuse: color,
      specular: new pc.Color(0.3, 0.3, 0.3),
      shininess: 20,
      emissive: new pc.Color(0.05, 0.05, 0.05),
    });

    const planet = this.createSphere(name, radius, planetMaterial);
    planet.setPosition(position);

    return planet;
  }

  /**
   * 创建小行星场：在指定中心周围的球壳内均匀分布 count 个小行星
   * 用于增强 3D 空间感知和提供环境障碍
   */
  public createAsteroidField(
    count: number,
    center: pc.Vec3,
    innerRadius: number,
    outerRadius: number,
  ): pc.Entity {
    const container = new pc.Entity('asteroidField');
    const modelGen = new ProceduralModelGenerator(this.app);

    for (let i = 0; i < count; i++) {
      // 球面均匀分布
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
      const pos = new pc.Vec3(
        center.x + radius * Math.sin(phi) * Math.cos(theta),
        center.y + radius * Math.sin(phi) * Math.sin(theta),
        center.z + radius * Math.cos(phi),
      );

      const scale = 0.5 + Math.random() * 2.0;

      // 每个小行星包一层 holder：holder 持有位置与自转速度，
      // 内部放程序化模型作为占位，随后异步换成 Kenney 的真实岩石外壳。
      // 包一层是必需的 —— updateAsteroidField 靠 container 直接子节点上的
      // userData.rotSpeed 驱动自转，而 GLB 替换会销毁并替换 holder 的子节点。
      const holder = new pc.Entity(`asteroid_${i}`);
      holder.setPosition(pos);
      (holder as pc.Entity & { userData: { rotSpeed: pc.Vec3 } }).userData = {
        rotSpeed: new pc.Vec3(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
        ),
      };

      // createStructure 第二参数是 ModelOptions（含 scale），不是 position
      const placeholder = modelGen.createStructure('asteroid', { scale });
      holder.addChild(placeholder);
      container.addChild(holder);

      // 9 种岩石外壳随机分配；失败则静默保留上面的程序化模型
      this.getModelAssets().upgradeStructure(holder, placeholder, 'asteroid', {
        scaleMultiplier: scale * ModelAssetProvider.structureScale(),
        yaw: Math.random() * 360,
      });
    }

    this.app.root.addChild(container);
    console.log(`[PlayCanvasEngine] Asteroid field created: ${count} asteroids`);
    return container;
  }

  /**
   * 每帧更新小行星场：让小行星缓慢自转，增强空间动态感
   */
  public updateAsteroidField(dt: number): void {
    const field = this.app.root.findByName('asteroidField');
    if (!field) return;
    field.children.forEach((asteroid) => {
      const userData = (asteroid as pc.Entity & { userData?: { rotSpeed: pc.Vec3 } }).userData;
      if (userData?.rotSpeed) {
        asteroid.rotate(
          userData.rotSpeed.x * dt * 60,
          userData.rotSpeed.y * dt * 60,
          userData.rotSpeed.z * dt * 60,
        );
      }
    });
  }

  /**
   * 启用雾效：增强深度感和空间层次
   * 使用 EXP2 衰减，远处物体渐隐到 fogColor
   */
  public enableFog(color: pc.Color, density: number): void {
    // Engine 2：scene.fog 变为只读的 FogParams 对象，整体赋值被拒，改为逐字段写
    this.app.scene.fog.type = pc.FOG_EXP2;
    this.app.scene.fog.color = color;
    this.app.scene.fog.density = density;
    console.log(`[PlayCanvasEngine] Fog enabled (density: ${density})`);
  }

  public getApp(): pc.Application {
    return this.app;
  }

  /**
   * 真实模型（GLB）资产提供器。整局游戏共用一个实例，容器资产只加载一次。
   */
  public getModelAssets(): ModelAssetProvider {
    if (!this.modelAssets) {
      this.modelAssets = new ModelAssetProvider(this.app);
    }
    return this.modelAssets;
  }

  public getScene(): pc.Scene {
    return this.app.scene;
  }

  public getCamera(): pc.Entity {
    return this.camera;
  }

  public addToScene(entity: pc.Entity): void {
    this.app.root.addChild(entity);
  }

  public removeFromScene(entity: pc.Entity): void {
    this.app.root.removeChild(entity);
  }

  public setUpdateCallback(callback: (dt: number) => void): void {
    console.log('[PlayCanvasEngine] Setting update callback');
    this.app.on('update', (dt: number) => {
      callback(dt);
    });
  }

  public destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.instancedRenderer?.destroy();
    this.pluginSystem?.unloadAll();
    this.app.destroy();
  }

  public isPhysicsEnabled(): boolean {
    return this.physicsEnabled;
  }

  public getInstancedRenderer(): InstancedRenderer | null {
    return this.instancedRenderer;
  }

  public getPluginSystem(): PluginSystem | null {
    return this.pluginSystem;
  }

  public registerPlugin(plugin: Plugin, config?: PluginConfig): boolean {
    if (!this.pluginSystem) return false;
    return this.pluginSystem.register(plugin, config || {});
  }

  public async loadPlugin(name: string): Promise<boolean> {
    if (!this.pluginSystem) return false;
    return this.pluginSystem.load(name);
  }

  public async unloadPlugin(name: string): Promise<boolean> {
    if (!this.pluginSystem) return false;
    return this.pluginSystem.unload(name);
  }

  public async loadAllPlugins(): Promise<void> {
    if (!this.pluginSystem) return;
    await this.pluginSystem.loadAll();
  }

  public setCamera(config: CameraConfig): void {
    this.camera.setPosition(config.position);
    if (config.target) {
      this.camera.lookAt(config.target);
    }
    const cameraComp = this.camera.camera;
    if (cameraComp) {
      if (config.fov !== undefined) cameraComp.fov = config.fov;
      if (config.nearClip !== undefined) cameraComp.nearClip = config.nearClip;
      if (config.farClip !== undefined) cameraComp.farClip = config.farClip;
      if (config.clearColor !== undefined) cameraComp.clearColor = config.clearColor;
    }
  }

  /**
   * 创建圆环体。
   *
   * 为什么不再用内建 type: 'torus'：Engine 2 的内建图元是**固定尺寸**（ring 0.3 / tube 0.2），
   * 尺寸只能靠 setLocalScale 整体缩放 —— 那会把环半径和管半径一起改，无法独立控制，
   * 而 radius / tubeRadius 这两个选项会被引擎静默忽略。所以这里直接生成一张自定义 Mesh。
   * 注意 pc.createTorus 的环半径参数名是 ringRadius，不是 radius。
   */
  public createTorus(
    name: string,
    radius: number,
    tubeRadius: number,
    material: pc.Material,
  ): pc.Entity {
    const mesh = pc.createTorus(this.app.graphicsDevice, { ringRadius: radius, tubeRadius });

    const torus = new pc.Entity(name);
    torus.addComponent('model');
    if (torus.model) {
      torus.model.meshInstances = [new pc.MeshInstance(mesh, material)];
    }
    this.app.root.addChild(torus);
    return torus;
  }

  public createPlane(
    name: string,
    width: number,
    height: number,
    material: pc.Material,
  ): pc.Entity {
    const plane = new pc.Entity(name);
    plane.addComponent('model', { type: 'plane' });
    // Engine 2：内建 plane 是 XZ 平面上的 1×1（Y 无厚度），width→X、height→Z
    plane.setLocalScale(width, 1, height);
    if (plane.model) plane.model.material = material;
    this.app.root.addChild(plane);
    return plane;
  }

  public setFixedUpdateCallback(callback: (dt: number) => void): void {
    this.app.on('fixedUpdate', callback);
  }

  public addRigidBody(
    entity: pc.Entity,
    type: 'dynamic' | 'static' | 'kinematic',
    options?: {
      mass?: number;
      linearDamping?: number;
      angularDamping?: number;
      gravity?: pc.Vec3;
    },
  ): void {
    entity.addComponent('rigidbody', {
      type,
      mass: options?.mass,
      linearDamping: options?.linearDamping,
      angularDamping: options?.angularDamping,
    });
  }

  public addCollision(
    entity: pc.Entity,
    type: 'box' | 'sphere' | 'cylinder' | 'capsule',
    options?: {
      halfExtents?: pc.Vec3;
      radius?: number;
      height?: number;
    },
  ): void {
    entity.addComponent('collision', {
      type,
      halfExtents: options?.halfExtents,
      radius: options?.radius,
      height: options?.height,
    });
  }
}
