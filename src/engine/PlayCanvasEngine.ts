import * as pc from 'playcanvas';
import { InstancedRenderer } from './InstancedRenderer';
import { GameEngineConfig, LightConfig, CameraConfig, GameEngine } from './GameEngine';
import { PluginSystem, Plugin, PluginConfig } from './PluginSystem';
import { ProceduralModelGenerator } from './ProceduralModelGenerator';
import { ENV_HDRI, DEFAULT_ENV_HDRI } from '../levels/index';
import { ModelAssetProvider } from './ModelAssetProvider';
import { WebGPUDamageSystem } from './WebGPUDamageSystem';
import { FactionManager } from './FactionManager';
import { TradeManager } from './TradeManager';
import { GalaxyManager } from './GalaxyManager';
import { ReinforcementSystem } from './ReinforcementSystem';
import { ResourceSystem } from './ResourceSystem';
import { MiningSystem } from './MiningSystem';
import { BlackHoleSystem } from './BlackHoleSystem';
import { DimensionalShiftSystem } from './DimensionalShiftSystem';
import { FleetManager } from './FleetManager';
import { DysonSwarmSystem } from './DysonSwarmSystem';

import { AudioRaytracer } from './AudioRaytracer';

export type GameConfig = GameEngineConfig;

/** 一套 PBR 材质的贴图与标量参数。 */
export interface PbrSetDef {
  diffuseMap: string;
  normalMap?: string;
  /**
   * 粗糙度贴图（ambientCG 的 Roughness 通道，白 = 粗糙）。
   * 走 PlayCanvas 的 `glossMap` + `glossInvert = true` 组合：glossInvert 的语义
   * 就是「把 gloss 成员当 roughness 解释」，所以可以直贴，无需预生成反相图。
   * （早前注释判断「极性相反不能贴」是在不知道 glossInvert 时下的，已作废。）
   */
  roughnessMap?: string;
  /** 环境光遮蔽贴图（ambientCG 的 AmbientOcclusion 通道）。 */
  aoMap?: string;
  /** 金属度贴图（ambientCG 的 Metalness 通道）。就绪时逐像素调制 metalness。 */
  metalnessMap?: string;
  /** 粗糙度标量（0 光滑 → 1 全哑光）。roughnessMap 就绪时作为其乘数基准。 */
  roughness: number;
  /** 金属度标量（0 非金属 → 1 纯金属）。metalnessMap 就绪时作为其乘数基准。 */
  metalness: number;
  /** 法线强度（默认 0.8）。岩石类可调高以获得更硬的凹凸。 */
  bumpiness?: number;
}

/** 环境光照（IBL）运行状态。只读观测面——验证脚本读它，不另建影子状态。 */
export interface EnvironmentLightingState {
  /** 本局请求的环境贴图 URL（null = 未请求）。 */
  url: string | null;
  /** idle 未请求 / loading 加载中 / ready 已挂到 scene.envAtlas / failed 失败回落。 */
  status: 'idle' | 'loading' | 'ready' | 'failed';
  /** scene.envAtlas 当前是否非空（反射真的存在，而不是只看我们自己的标志位）。 */
  envAtlas: boolean;
  /** envAtlas 的边长（null = 未生成）。证明贴图真生成了，而不是一个空占位。 */
  atlasSize: number | null;
  toneMapping: number;
  exposure: number;
  error: string | null;
}

export class PlayCanvasGameEngine implements GameEngine {
  private app: pc.Application;
  private camera: pc.Entity;
  private isStarted: boolean = false;
  private physicsEnabled: boolean = false;
  private onResize: () => void;
  private instancedRenderer: InstancedRenderer | null = null;
  private pluginSystem: PluginSystem | null = null;
  private modelAssets: ModelAssetProvider | null = null;
  private audioRaytracer: AudioRaytracer | null = null;
  private lastAudioUpdate: number = 0;
  private graphicsQuality: 'low' | 'medium' | 'high' = 'high';

  /** 环境光照（IBL）状态：只读观测用，真实值每次从 scene 现读。 */
  private envLightingState: EnvironmentLightingState = {
    url: null,
    status: 'idle',
    envAtlas: false,
    atlasSize: null,
    toneMapping: pc.TONEMAP_LINEAR,
    exposure: 1,
    error: null,
  };

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
    this.audioRaytracer = new AudioRaytracer(this.app, this.camera);

    // 注册 v2.7 子系统
    const damageSystem = new WebGPUDamageSystem();
    const factionManager = new FactionManager();
    const tradeManager = new TradeManager();
    const galaxyManager = new GalaxyManager();
    const reinforcementSystem = new ReinforcementSystem();
    const resourceSystem = new ResourceSystem();
    const miningSystem = new MiningSystem();
    const blackHoleSystem = new BlackHoleSystem();
    const dimensionalShiftSystem = new DimensionalShiftSystem();
    const fleetManager = new FleetManager();
    const dysonSwarmSystem = new DysonSwarmSystem();

    this.pluginSystem.register(damageSystem);
    this.pluginSystem.register(factionManager);
    this.pluginSystem.register(tradeManager);
    this.pluginSystem.register(galaxyManager);
    this.pluginSystem.register(reinforcementSystem);
    this.pluginSystem.register(resourceSystem);
    this.pluginSystem.register(miningSystem);
    this.pluginSystem.register(blackHoleSystem);
    this.pluginSystem.register(dimensionalShiftSystem);
    this.pluginSystem.register(fleetManager);
    this.pluginSystem.register(dysonSwarmSystem);

    // 将核心管理器挂载到 app 供插件跨系统访问 (2026 插件解耦架构)
    (this.app as any)['factionManager'] = factionManager;
    (this.app as any)['tradeManager'] = tradeManager;
    (this.app as any)['damageSystem'] = damageSystem;
    (this.app as any)['galaxyManager'] = galaxyManager;
    (this.app as any)['reinforcementSystem'] = reinforcementSystem;
    (this.app as any)['resourceSystem'] = resourceSystem;
    (this.app as any)['miningSystem'] = miningSystem;
    (this.app as any)['blackHoleSystem'] = blackHoleSystem;
    (this.app as any)['dimensionalShiftSystem'] = dimensionalShiftSystem;
    (this.app as any)['fleetManager'] = fleetManager;
    (this.app as any)['dysonSwarmSystem'] = dysonSwarmSystem;
    (this.app as any)['engine'] = this;

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
    sizeScale: number = 1,
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
      const size = (0.05 + Math.random() * 0.15) * sizeScale;

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

  public setGraphicsQuality(quality: 'low' | 'medium' | 'high'): void {
    this.graphicsQuality = quality;
    console.log(`[PlayCanvasEngine] Graphics quality set to: ${quality}`);
  }

  public createNebula(position: pc.Vec3, scale: number = 30, color?: pc.Color): pc.Entity {
    const nebulaColor = color || new pc.Color(0.3, 0.1, 0.5);

    // 2026 Tech: 改进的星云材质，使用噪声调制模拟体积感
    const nebulaMaterial = this.createMaterial('nebulaMaterial', {
      diffuse: new pc.Color(0, 0, 0),
      emissive: nebulaColor,
      transparency: 0.1,
      blendType: pc.BLEND_ADDITIVEALPHA,
    });

    // 2026 Tech: 注入简单的噪声着色器块 (如果支持)
    // 这里我们通过在 StandardMaterial 上设置参数来模拟
    nebulaMaterial.emissiveIntensity = 1.5;
    nebulaMaterial.update();

    const nebula = new pc.Entity('nebula');
    nebula.addComponent('render', { type: 'sphere' });
    if (nebula.render) nebula.render.material = nebulaMaterial;
    nebula.setPosition(position);
    nebula.setLocalScale(scale, scale * 0.7, scale);

    // 2026 Tech: 根据画质动态调整体积层数 (LOD)
    let layers = 1;
    if (this.graphicsQuality === 'medium') layers = 2;
    if (this.graphicsQuality === 'high') layers = 4;

    for (let i = 1; i <= layers; i++) {
      const layerScale = 1.0 - i * 0.15;
      const layerOpacity = 0.08 / i;

      const innerNebula = new pc.Entity(`nebula_layer_${i}`);
      innerNebula.addComponent('render', { type: 'sphere' });
      const innerMat = nebulaMaterial.clone();
      innerMat.opacity = layerOpacity;
      innerMat.update();
      if (innerNebula.render) innerNebula.render.material = innerMat;
      innerNebula.setLocalScale(layerScale, layerScale, layerScale);
      nebula.addChild(innerNebula);
    }

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
   * 创建天幕：挂在相机下的大球内壁，铺一张等距柱状星空全景图。
   *
   * - 挂在相机（而非场景根）下 ⇒ 位置永远跟随相机，等效「无限远背景」，
   *   玩家飞多远都不会出现背景视差穿帮。
   * - 只用 emissiveMap 且 diffuse 为黑 ⇒ 不受任何光照影响，天就是天，不会被打亮。
   * - 整个背景只占 1 个 draw call；贴图异步加载，失败时回落为深色球体，不阻塞开局。
   *
   * @param url 等距柱状全景图（建议 2:1，如 4096×2048）
   * @param radius 天幕半径，须小于相机 farClip（默认 1000）
   */
  public createSkyDome(url: string, radius: number = 400): pc.Entity | null {
    try {
      const dome = new pc.Entity('skyDome');
      const material = new pc.StandardMaterial();
      material.name = 'skyDomeMaterial';
      material.diffuse = new pc.Color(0, 0, 0);
      material.emissive = new pc.Color(1, 1, 1);
      // 相机在球内：可见面全是背面（法线朝外）。剔除正面 = 只渲染内壁，
      // 比双面渲染少一半三角形。
      material.cull = pc.CULLFACE_FRONT;
      material.depthWrite = true;
      material.update();

      dome.addComponent('model', { type: 'sphere' });
      const model = dome.model;
      if (model) {
        model.material = material;
        // Engine 2 的 sphere 图元直径为 1，故缩放 = 2 × 半径
        dome.setLocalScale(radius * 2, radius * 2, radius * 2);
        // 天幕必须永远可见，不参与视锥剔除
        for (const meshInstance of model.meshInstances ?? []) meshInstance.cull = false;
      }

      this.camera.addChild(dome);

      // 贴图异步加载：加载完成前是深色球体，不阻塞场景搭建
      const asset = new pc.Asset('skyDomeTexture', 'texture', { url });
      this.app.assets.add(asset);
      this.app.assets.load(asset);
      asset.once('load', () => {
        material.emissiveMap = asset.resource as pc.Texture;
        material.update();
        console.log('[PlayCanvasEngine] Sky dome texture loaded:', url);
      });
      asset.once('error', (err: string) => {
        console.warn('[PlayCanvasEngine] 天幕贴图加载失败（保留深色背景）:', url, err);
      });

      return dome;
    } catch (error) {
      console.warn('[PlayCanvasEngine] 天幕创建失败:', error);
      return null;
    }
  }

  /**
   * 创建小行星场：在指定中心周围的球壳内均匀分布 count 个小行星
   * 用于增强 3D 空间感知和提供环境障碍
   */
  /**
   * @param sizeScale 岩石尺寸倍率。小行星带外移时按同倍放大，才能保持
   *   从原点望出去的视角尺寸不变（角度密度只由 count 决定，无需跟着改）。
   */
  public createAsteroidField(
    count: number,
    center: pc.Vec3,
    innerRadius: number,
    outerRadius: number,
    sizeScale: number = 1,
  ): pc.Entity {
    const container = new pc.Entity('asteroidField');
    const modelGen = new ProceduralModelGenerator();

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

      const scale = (0.5 + Math.random() * 2.0) * sizeScale;

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

      // 9 种岩石外壳随机分配；失败则静默保留上面的程序化模型。
      // GLB 替换完成后按**外壳**叠加对应岩石 PBR（晶体岩单列，见 rockSetForAsteroid）。
      this.getModelAssets().upgradeStructure(holder, placeholder, 'asteroid', {
        scaleMultiplier: scale * ModelAssetProvider.structureScale(),
        yaw: Math.random() * 360,
        onReplaced: (instance, assetPath) =>
          this.applyPbrMaterialWhenReady(
            instance,
            PlayCanvasGameEngine.rockSetForAsteroid(assetPath),
          ),
      });
    }

    this.app.root.addChild(container);
    console.log(
      `[PlayCanvasEngine] Asteroid field created: ${count} asteroids, ` +
        `r=${innerRadius}~${outerRadius}, sizeScale=${sizeScale}`,
    );
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

  // ─── 粒子贴图：预加载 + 共享缓存 ───────────────────────────────────────────
  //
  // 粒子的外观 = colorMap（贴图）× colorGraph（颜色曲线）。引擎默认 colorMap 是一个
  // 纯白小圆点，这就是此前所有粒子（尾焰/爆炸/光晕）看起来是"纯色光团"的原因。
  // 这里换成 Kenney Particle Pack 的白色发光形状（512×512 透明 PNG，CC0），
  // 颜色依旧由各粒子系统的 colorGraph 染出，所以只需换贴图、无需动颜色配置。

  /** 粒子贴图 url 常量（public/assets/textures/particles/，来源见该目录 CREDITS.md）。 */
  public static readonly PARTICLE_TEXTURES = {
    engineFlame: '/assets/textures/particles/particle-engine-flame.png',
    missileFlame: '/assets/textures/particles/particle-missile-flame.png',
    hitLight: '/assets/textures/particles/particle-hit-light.png',
    explosionRing: '/assets/textures/particles/particle-explosion-ring.png',
    bossBurst: '/assets/textures/particles/particle-boss-burst.png',
    powerupStar: '/assets/textures/particles/particle-powerup-star.png',
    skillFlare: '/assets/textures/particles/particle-skill-flare.png',
  } as const;

  /** 全部粒子贴图 url（开局一次性预加载）。 */
  public static get ALL_PARTICLE_TEXTURE_URLS(): string[] {
    return Object.values(PlayCanvasGameEngine.PARTICLE_TEXTURES);
  }

  /** 已就绪/加载中的粒子贴图缓存（key = url；值为 undefined 表示加载中）。 */
  private particleTextures = new Map<string, pc.Texture | undefined>();
  /** 在贴图就绪前创建的粒子系统，就绪后回填 colorMap（如常驻的引擎尾焰）。 */
  private pendingColorMaps: { component: pc.ParticleSystemComponent; url: string }[] = [];

  /**
   * 预加载粒子贴图（开局调用一次）。之后创建的粒子系统可同步取到贴图；
   * 未就绪时创建的会登记进 pendingColorMaps，就绪后自动回填。
   */
  public preloadParticleTextures(
    urls: string[] = PlayCanvasGameEngine.ALL_PARTICLE_TEXTURE_URLS,
  ): void {
    for (const url of urls) this.loadParticleTexture(url);
  }

  /** 同步取已就绪的粒子贴图；未就绪返回 undefined（粒子回落引擎默认白点）。 */
  public getParticleTexture(url: string): pc.Texture | undefined {
    return this.particleTextures.get(url) || undefined;
  }

  private loadParticleTexture(url: string): void {
    if (this.particleTextures.has(url)) return;
    this.particleTextures.set(url, undefined); // 占位防重复发起
    const asset = new pc.Asset(`particleTex:${url}`, 'texture', { url });
    this.app.assets.add(asset);
    this.app.assets.load(asset);
    asset.once('load', () => {
      const tex = asset.resource as pc.Texture;
      this.particleTextures.set(url, tex);
      // 回填给在就绪前创建的粒子系统（组件可能已随短命实体销毁，尽力而为）
      this.pendingColorMaps = this.pendingColorMaps.filter((p) => {
        if (p.url !== url) return true;
        try {
          p.component.colorMap = tex;
        } catch {
          /* 实体已销毁 */
        }
        return false;
      });
      console.log(`[PlayCanvasEngine] Particle texture loaded: ${url}`);
    });
    asset.once('error', (err: string) => {
      console.warn(`[PlayCanvasEngine] Particle texture load failed (回落默认白点): ${url}`, err);
    });
  }

  /**
   * 创建带贴图的粒子系统组件。等价于 entity.addComponent('particlesystem', options)，
   * 额外支持 colorMapUrl：贴图已就绪则立即应用，未就绪则登记等待回填。
   */
  public addParticleSystem(
    entity: pc.Entity,
    options: Record<string, unknown> & { colorMapUrl?: string },
  ): pc.ParticleSystemComponent | null {
    const { colorMapUrl, ...psOptions } = options;
    const tex = colorMapUrl ? this.particleTextures.get(colorMapUrl) : undefined;
    if (tex) psOptions['colorMap'] = tex;
    entity.addComponent('particlesystem', psOptions);
    const ps = (entity.particlesystem ?? null) as pc.ParticleSystemComponent | null;
    if (ps && colorMapUrl && !tex) {
      this.pendingColorMaps.push({ component: ps, url: colorMapUrl });
    }
    return ps;
  }

  // ─── PBR 材质：ambientCG 真材质应用到 GLB 结构物 ───────────────────────────
  //
  // Kenney 的 GLB 是纯色低多边形模型，材质只有 diffuse 一个平色。给它们叠上
  // ambientCG 的真实 PBR 通道（Color / NormalGL / Roughness / Metalness，CC0），
  // 低多边形轮廓 + 真实材质细节，观感差距非常大。
  //
  // 套件清单与许可见 public/assets/textures/CREDITS.md。

  /**
   * 色调映射曲线名 → PlayCanvas 常量。配置层写可读名字，数值换算只在这里。
   *
   * 刻意做成**惰性求值**（而不是 `static readonly = { linear: pc.TONEMAP_LINEAR, … }`）：
   * 后者会在模块求值期就去读 PlayCanvas 的常量，任何"在引擎之外引用本模块"的场景
   * （单测、工具脚本、循环依赖链）都会因为这个大依赖尚未就绪而直接崩在 import 上。
   * 惰性求值把这份耦合推迟到真正要设置色调映射的时候。
   */
  private static tonemapModes: Record<string, number> | null = null;
  public static get TONEMAP_MODES(): Record<string, number> {
    if (!PlayCanvasGameEngine.tonemapModes) {
      PlayCanvasGameEngine.tonemapModes = {
        linear: pc.TONEMAP_LINEAR,
        filmic: pc.TONEMAP_FILMIC,
        hejl: pc.TONEMAP_HEJL,
        aces: pc.TONEMAP_ACES,
        aces2: pc.TONEMAP_ACES2,
        neutral: pc.TONEMAP_NEUTRAL,
        none: pc.TONEMAP_NONE,
      };
    }
    return PlayCanvasGameEngine.tonemapModes;
  }

  /**
   * 一套 PBR 材质的贴图与标量参数。
   *
   * 贴图全部来自 ambientCG（CC0），通道文件是小写约定名
   * `color / normal / roughness / ao / metalness`（不带后缀的通道直接省略）。
   * 这些通道由 `public/assets/textures/pbr/ambientcg/` 的全套包挑出，
   * 原始全套仍完整保留在 `.workbuddy/asset-cache/ambientcg/` 备用库中。
   */
  public static readonly PBR_SETS: Record<string, PbrSetDef> = {
    // ── 岩石（小行星带）：三套轮换，避免整条带子是同一种石头 ─────────────
    rock: {
      diffuseMap: '/assets/textures/pbr/rock030/color.jpg',
      normalMap: '/assets/textures/pbr/rock030/normal.jpg',
      roughnessMap: '/assets/textures/pbr/rock030/roughness.jpg',
      aoMap: '/assets/textures/pbr/rock030/ao.jpg',
      roughness: 0.9,
      metalness: 0.0,
      bumpiness: 1.0,
    },
    rockB: {
      diffuseMap: '/assets/textures/pbr/rock058/color.jpg',
      normalMap: '/assets/textures/pbr/rock058/normal.jpg',
      roughnessMap: '/assets/textures/pbr/rock058/roughness.jpg',
      aoMap: '/assets/textures/pbr/rock058/ao.jpg',
      roughness: 0.88,
      metalness: 0.0,
      bumpiness: 1.0,
    },
    // 晶体岩（rock_crystalsLargeA/B 外壳专配）：更硬的凹凸 + 更低粗糙度，
    // 让结晶面有方向性的高光。
    rockC: {
      diffuseMap: '/assets/textures/pbr/rock064/color.jpg',
      normalMap: '/assets/textures/pbr/rock064/normal.jpg',
      roughnessMap: '/assets/textures/pbr/rock064/roughness.jpg',
      aoMap: '/assets/textures/pbr/rock064/ao.jpg',
      roughness: 0.72,
      metalness: 0.0,
      bumpiness: 1.25,
    },

    // ── 空间站舱段：金属板，全套通道（含金属度贴图）──────────────────────
    metalPlates: {
      diffuseMap: '/assets/textures/pbr/metalplates016a/color.jpg',
      normalMap: '/assets/textures/pbr/metalplates016a/normal.jpg',
      roughnessMap: '/assets/textures/pbr/metalplates016a/roughness.jpg',
      aoMap: '/assets/textures/pbr/metalplates016a/ao.jpg',
      metalnessMap: '/assets/textures/pbr/metalplates016a/metalness.jpg',
      roughness: 0.45,
      metalness: 0.85,
      bumpiness: 0.9,
    },

    // ── 卫星天线：抛光金属（无 AO 通道，靠法线 + 逐像素粗糙度）────────────
    metal: {
      diffuseMap: '/assets/textures/pbr/metal049a/color.jpg',
      normalMap: '/assets/textures/pbr/metal049a/normal.jpg',
      roughnessMap: '/assets/textures/pbr/metal049a/roughness.jpg',
      metalnessMap: '/assets/textures/pbr/metal049a/metalness.jpg',
      roughness: 0.35,
      metalness: 0.85,
      bumpiness: 0.7,
    },
  };

  /** 小行星带可用的岩石材质集合（三套轮换，按外壳路径分派见 rockSetForAsteroid）。 */
  public static readonly ASTEROID_MATERIAL_SETS: readonly string[] = ['rock', 'rockB', 'rockC'];

  /**
   * 小行星外壳 GLB 相对路径 → 岩石材质套件。
   *
   * 分派刻意做成**确定性**（按路径散列）而非每次随机：
   * 同一个外壳 GLB 在任何一局、任何一颗小行星上都拿同一套石头，
   * 否则「同一块岩石转个角度材质就变了」会在密集的小行星带里被看出来。
   *
   * 晶体岩（`rock_crystalsLarge*`）单列 —— 它的几何有结晶面，
   * 配 rockC（更硬的凹凸 1.25 + 更低粗糙度 0.72）才有方向性高光。
   */
  public static rockSetForAsteroid(assetPath: string): string {
    if (assetPath.includes('crystals')) return 'rockC';
    let h = 0;
    for (let i = 0; i < assetPath.length; i++) h = (h * 31 + assetPath.charCodeAt(i)) | 0;
    return (h & 1) === 0 ? 'rock' : 'rockB';
  }

  public static get ALL_PBR_TEXTURE_URLS(): string[] {
    return Object.values(PlayCanvasGameEngine.PBR_SETS).flatMap((s) =>
      Object.values(s).filter((v): v is string => typeof v === 'string'),
    );
  }

  /** 已加载的 PBR 贴图缓存（key = url）。 */
  private pbrTextures = new Map<string, pc.Texture | undefined>();
  /** 贴图未就绪时登记的待应用项（GLB 替换往往早于贴图加载完成）。 */
  private pendingPbr: { root: pc.Entity; set: string; tint?: [number, number, number] }[] = [];

  /** 预加载全部 PBR 贴图（开局调用一次，与粒子贴图同一套缓存机制）。 */
  public preloadPbrTextures(): void {
    for (const url of PlayCanvasGameEngine.ALL_PBR_TEXTURE_URLS) {
      if (this.pbrTextures.has(url)) continue;
      this.pbrTextures.set(url, undefined); // 占位防重复发起
      const asset = new pc.Asset(`pbrTex:${url}`, 'texture', { url });
      this.app.assets.add(asset);
      this.app.assets.load(asset);
      asset.once('load', () => {
        this.pbrTextures.set(url, asset.resource as pc.Texture);
        console.log(`[PlayCanvasEngine] PBR texture loaded: ${url}`);
        this.flushPendingPbr();
      });
      asset.once('error', (err: string) => {
        console.warn(`[PlayCanvasEngine] PBR texture load failed (回落原材质): ${url}`, err);
        this.pbrTextures.delete(url);
      });
    }
  }

  /** 贴图就绪后回填给在就绪前登记的实体（实体可能已随场景销毁，尽力而为）。 */
  private flushPendingPbr(): void {
    this.pendingPbr = this.pendingPbr.filter(({ root, set, tint }) => {
      try {
        return !this.applyPbrMaterial(root, set, tint); // 应用成功则移除
      } catch {
        return false; // 实体已销毁
      }
    });
  }

  /** applyPbrMaterial 的「等贴图就绪」版本：未就绪则登记，就绪后自动应用。 */
  public applyPbrMaterialWhenReady(
    root: pc.Entity,
    set: string,
    tint?: [number, number, number],
  ): void {
    if (this.applyPbrMaterial(root, set, tint)) return;
    this.pendingPbr.push({ root, set, tint });
  }

  private getPbrTexture(url: string): pc.Texture | undefined {
    return this.pbrTextures.get(url) || undefined;
  }

  /**
   * 把一套 PBR 材质应用到 root 子树的所有 meshInstance。
   *
   * 关键点：
   *  - 必须开 `useMetalness`，否则 metalness/roughness 根本不参与着色
   *    （PlayCanvas 默认走非金属的 diffuse+specular 路径）；
   *  - 贴图未就绪的通道直接不设，回落对应标量，不会黑屏也不会报错；
   *  - 核心的 diffuseMap 未就绪则整体跳过，返回 false 让调用方稍后重试。
   *
   * @param tint 派系着色。若提供，则将其作为漫反射乘数应用到材质上。
   * @returns 是否真正应用了（false = 贴图未就绪或无网格）
   */
  public applyPbrMaterial(root: pc.Entity, set: string, tint?: [number, number, number]): boolean {
    const def = PlayCanvasGameEngine.PBR_SETS[set];
    if (!def) return false;
    const diffuse = this.getPbrTexture(def.diffuseMap);
    if (!diffuse) return false;

    let applied = 0;
    root.forEach((node: pc.GraphNode) => {
      const render = (node as pc.Entity).render;
      if (!render) return;
      for (const meshInstance of render.meshInstances) {
        const material = new pc.StandardMaterial();
        material.diffuseMap = diffuse;

        if (tint) {
          // 派系着色：保持亮度平衡，避免压得太暗
          const maxChannel = Math.max(tint[0], tint[1], tint[2]) || 1;
          material.diffuse = new pc.Color(
            tint[0] / maxChannel,
            tint[1] / maxChannel,
            tint[2] / maxChannel,
          );
        } else {
          material.diffuse = new pc.Color(1, 1, 1); // 让贴图原色说话
        }

        material.useMetalness = true;
        material.metalness = def.metalness;

        // 粗糙度：有贴图就完全交给贴图，没有才用标量。
        // 组合方式照抄引擎官方 glTF 导入器的 createMaterial：
        //   gloss = 1（标量不衰减贴图）+ glossMap（贴 roughness 图）+ glossInvert = true
        // glossInvert 的语义是「把 gloss 成员当 roughness 解释」，所以可以直接贴
        // ambientCG 的 Roughness 图（白 = 粗糙），不必预生成反相图。
        const rough = def.roughnessMap ? this.getPbrTexture(def.roughnessMap) : undefined;
        if (rough) {
          material.gloss = 1;
          material.glossMap = rough;
          material.glossInvert = true;
        } else {
          material.roughness = def.roughness;
        }

        const normal = def.normalMap ? this.getPbrTexture(def.normalMap) : undefined;
        if (normal) {
          material.normalMap = normal;
          material.bumpiness = def.bumpiness ?? 0.8;
        }

        const metalMap = def.metalnessMap ? this.getPbrTexture(def.metalnessMap) : undefined;
        if (metalMap) material.metalnessMap = metalMap;

        const ao = def.aoMap ? this.getPbrTexture(def.aoMap) : undefined;
        if (ao) {
          material.aoMap = ao;
          // AO 同时遮挡环境光与镜面高光（官方 glTF 同款）。默认只压漫射，
          // 会让金属在缝隙处「亮得不合理」。
          material.occludeSpecular = pc.SPECOCC_AO;
        }

        material.update();
        meshInstance.material = material;
        applied++;
      }
    });
    if (applied > 0) console.log(`[PlayCanvasEngine] PBR "${set}" applied to ${applied} mesh(es)`);
    return applied > 0;
  }

  // ─── 环境光照（IBL）：HDR → envAtlas ───────────────────────────────────────
  //
  // 此前场景只有 ambientLight（一个常量色）+ 一盏平行光：金属材质没有可反射的
  // 环境，metalness=0.85 的空间站/卫星表面等于在反射「空气」，金属感全靠贴图假撑。
  //
  // 现在接上真环境光照：
  //   HDR（equirect 2:1）→ generateLightingSource（等距柱状 → cubemap）
  //                       → generateAtlas（GGX 预滤波镜面 + lambert 漫射）→ scene.envAtlas
  //
  // PlayCanvas 的 StandardMaterial 会自动采样 scene.envAtlas 做 IBL，无需逐材质接线。
  //
  // 工程约束：
  //  - HDR 是 32-bit RGBE（TEXTURETYPE_RGBE / RGBA8 容器），不可滤波、无 mipmap，
  //    由 reprojectTexture 内部的 decode/encode 处理；
  //  - 预滤波是同步 GPU 工作（多级 mip × 多次采样），所以先让出一帧再算，
  //    避免开局首帧被这段计算顶住；
  //  - 整段失败只降级（保留 ambientLight），不抛给调用方 —— 画质是加分项，不能挡住开局。

  /**
   * 加载 HDR 环境贴图并生成环境光照（IBL），挂到 scene.envAtlas。
   *
   * @param url 等距柱状（2:1）HDR 文件
   * @param options 预滤波尺寸。atlasSize 越大反射越清晰、耗时越长（默认 512）
   * @returns 是否成功挂上（false = 失败已降级，调用方无需处理）
   */
  public async loadEnvironmentLighting(
    url: string,
    options: { atlasSize?: number; lightingSourceSize?: number } = {},
  ): Promise<boolean> {
    // 调用方可能传的是关卡 skybox 键名（env-space-01）而非完整 URL
    const resolvedUrl =
      url.startsWith('/') || url.startsWith('http') ? url : (ENV_HDRI[url] ?? DEFAULT_ENV_HDRI);
    this.envLightingState = {
      ...this.envLightingState,
      url: resolvedUrl,
      status: 'loading',
      error: null,
    };
    try {
      const source = await this.loadHdrTexture(resolvedUrl);

      // 让出一帧：下面的预滤波是同步的，先让开局首帧画出来再算。
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
        else setTimeout(resolve, 0);
      });

      const lightingSource = pc.EnvLighting.generateLightingSource(source, {
        size: options.lightingSourceSize ?? 128,
      });
      const atlas = pc.EnvLighting.generateAtlas(lightingSource, {
        size: options.atlasSize ?? 512,
        numReflectionSamples: 512,
        numAmbientSamples: 1024,
      });
      this.app.scene.envAtlas = atlas;

      this.envLightingState = {
        ...this.envLightingState,
        status: 'ready',
        envAtlas: true,
        atlasSize: atlas.width,
      };
      console.log(
        `[PlayCanvasEngine] 环境光照就绪: ${url}（envAtlas ${atlas.width}×${atlas.height}）`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.envLightingState = { ...this.envLightingState, status: 'failed', error: message };
      console.warn(`[PlayCanvasEngine] 环境光照生成失败（回落 ambientLight）: ${url}`, error);
      return false;
    }
  }

  /**
   * 加载 .hdr（Radiance RGBE）为等距柱状 2D 贴图。
   *
   * PlayCanvas 2.23 不内置 HDR 扩展名的 AssetLoader，所以绕过 Asset 系统：
   * 用 fetch 直接拿到 ArrayBuffer，解析 Radiance RGBE（含 RLE 压缩），
   * 转成 RGBA8 上传 pc.Texture。金属材质的 environment 反射走 scene.envAtlas
   * 所以本纹理只需要让 PlayCanvas 的 EnvLighting.generateLightingSource 能读。
   */
  private async loadHdrTexture(url: string): Promise<pc.Texture> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`hdr_http_${response.status}: ${url}`);
    const buffer = new Uint8Array(await response.arrayBuffer());

    // 1) 解析 header —— 找到 FORMAT、分辨率，定位数据起点
    let idx = 0;
    if (buffer[0] !== 0x23 /* '#' */ || buffer[1] !== 0x3f /* '?' */) {
      throw new Error('hdr_magic_mismatch');
    }
    let rle = false;
    let width = 0;
    let height = 0;

    // header 不会很长（通常 < 512 字节），先用前 2KB 解码成字符串
    const headerStrFull = new TextDecoder().decode(buffer.slice(0, 2048));
    // 分辨率行格式："-Y height +X width" 或 "+Y ..."
    const resMatch = headerStrFull.match(/^[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)\s*$/m);
    if (!resMatch) throw new Error('hdr_missing_resolution');
    height = parseInt(resMatch[1], 10);
    width = parseInt(resMatch[2], 10);

    // 分辨率行后面的 \n 就是数据起始
    const resLineEnd = headerStrFull.indexOf('\n', headerStrFull.indexOf(resMatch[0]));
    if (resLineEnd === -1) throw new Error('hdr_header_end_not_found');
    idx = buffer.indexOf(0x0a, resLineEnd);
    if (idx === -1) throw new Error('hdr_header_end_not_found');
    idx += 1; // 跳过分隔 \n

    // 从 header 里也找一下 FORMAT
    const formatMatch = headerStrFull.match(/FORMAT=(\S+)/);
    if (formatMatch) rle = formatMatch[1].includes('rle');

    // 2) 解 RGBE → RGBA（RGBA8，shared exponent 合成逐像素指数）
    const pixels = this.decodeRgbe(buffer, idx, width, height, rle);

    // 3) 上传 pc.Texture
    const texture = new pc.Texture(this.app.graphicsDevice, {
      width,
      height,
      format: pc.PIXELFORMAT_RGBA8,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      magFilter: pc.FILTER_LINEAR,
      minFilter: pc.FILTER_LINEAR,
      mipmaps: false,
    });
    // PlayCanvas 2.x 的 Texture._levels 是内部属性，通过 lock/unlock + 直接赋值上传原始像素
    (texture as any).lock();
    // oxlint-disable-next-line no-underscore-dangle — PlayCanvas Texture 内部属性名
    (texture as any)._levels = [pixels];
    (texture as any).unlock();
    return texture;
  }

  /** 解析 Radiance RGBE 数据区（含 FORMAT=32-bit_rle_rgbe 的 RLE 压缩）。 */
  private decodeRgbe(
    buf: Uint8Array,
    offset: number,
    width: number,
    height: number,
    rle: boolean,
  ): Uint8Array {
    const out = new Uint8Array(width * height * 4);

    // 先把数据解压成 rgbeRaw（width*height*4 字节，R/G/B/E 交替）
    let p = offset;
    const rgbeRaw = new Uint8Array(width * height * 4);

    if (rle) {
      for (let row = 0; row < height; row++) {
        // 行头：4 字节 marker0 marker1 hh ll —— 标准单行 RLE 压缩 marker 都是 0x02
        if (p + 4 > buf.length) break;
        const m0 = buf[p++],
          m1 = buf[p++];
        p += 2; // 跳过 hh, ll
        // 非标准 marker：fallback 为直接复制原始 RGBE
        const isStandard = m0 === 0x02 && m1 === 0x02;
        const segLen = isStandard ? width : width * 4;
        const rowStart = row * width;

        for (let seg = 0; seg < 4; seg++) {
          let j = 0;
          while (j < segLen && p < buf.length) {
            const code = buf[p++];
            if (code >= 128) {
              // run: 后续 1 字节重复 (code - 127) 次
              const runLen = code - 127;
              const val = buf[p++];
              for (let k = 0; k < runLen && j + k < segLen; k++) {
                rgbeRaw[(rowStart + j + k) * 4 + seg] = val;
              }
              j += runLen;
            } else {
              // 直接复制 (code + 1) 个后续字节
              const count = code + 1;
              for (let k = 0; k < count && j + k < segLen && p < buf.length; k++) {
                rgbeRaw[(rowStart + j + k) * 4 + seg] = buf[p++];
              }
              j += count;
            }
          }
        }
      }
    } else {
      // 非 RLE：直接按原始 RGBE 字节顺序复制
      const n = Math.min(buf.length - offset, width * height * 4);
      rgbeRaw.set(buf.slice(offset, offset + n));
    }

    // 把 RGBE → RGBA8（shared exponent 合成 per-pixel 指数）
    for (let i = 0, o = 0; i < rgbeRaw.length; i += 4, o += 4) {
      const e = rgbeRaw[i + 3];
      if (e === 0) {
        out[o] = out[o + 1] = out[o + 2] = 0;
        out[o + 3] = 255;
        continue;
      }
      const exp = Math.pow(2, e - 128 - 8);
      out[o] = Math.max(0, Math.min(255, Math.round(rgbeRaw[i] * exp * 255)));
      out[o + 1] = Math.max(0, Math.min(255, Math.round(rgbeRaw[i + 1] * exp * 255)));
      out[o + 2] = Math.max(0, Math.min(255, Math.round(rgbeRaw[i + 2] * exp * 255)));
      out[o + 3] = 255;
    }
    return out;
  }

  /**
   * 设置色调映射曲线与曝光。
   *
   * 注意分工（PlayCanvas 2.x）：**曲线是相机级**（camera.toneMapping），
   * **曝光是场景级**（scene.exposure）——两者不在同一个对象上。
   *
   * PlayCanvas 默认是 TONEMAP_LINEAR（线性输出，亮部直接切顶死白）。换成 filmic
   * 类曲线后高光有滚降、亮部不再糊成一片。代价是整体略暗，所以要配 exposure 补偿
   * （由调用方按关卡光照档位给，见 levels/index.ts 的 EXPOSURE_BY_LIGHTING）。
   *
   * @param mode 曲线名（'aces2' 等，见 TONEMAP_MODES）或 PlayCanvas 的数值常量
   */
  public setToneMapping(mode: number | string, exposure?: number): void {
    const resolved =
      typeof mode === 'number'
        ? mode
        : (PlayCanvasGameEngine.TONEMAP_MODES[mode] ?? pc.TONEMAP_LINEAR);
    const cameraComp = this.camera.camera;
    if (cameraComp) cameraComp.toneMapping = resolved;
    if (typeof exposure === 'number' && Number.isFinite(exposure)) {
      this.app.scene.exposure = exposure;
    }
    this.envLightingState = {
      ...this.envLightingState,
      toneMapping: cameraComp?.toneMapping ?? pc.TONEMAP_LINEAR,
      exposure: this.app.scene.exposure,
    };
    console.log(
      `[PlayCanvasEngine] 色调映射=${this.envLightingState.toneMapping}` +
        `（linear=0/filmic=1/hejl=2/aces=3/aces2=4/neutral=5/无=6）` +
        ` 曝光=${this.app.scene.exposure.toFixed(2)}`,
    );
  }

  /** 环境光照与色调映射的当前状态（真实值现读，不返回缓存）。 */
  public getEnvironmentLightingState(): EnvironmentLightingState {
    const atlas = this.app.scene.envAtlas as pc.Texture | null;
    return {
      ...this.envLightingState,
      toneMapping: this.camera.camera?.toneMapping ?? pc.TONEMAP_LINEAR,
      exposure: this.app.scene.exposure,
      envAtlas: !!atlas,
      atlasSize: atlas ? atlas.width : null,
    };
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
    // 注意：PlayCanvas 的 tick 在 fire('update') 之后才调用 render()。
    // 一旦本回调抛错，事件派发会把异常冒泡出去，导致该帧的 render() 被整帧跳过（画面全黑）。
    // 因此每个子系统必须各自兜底，异常只记录不外抛。
    this.app.on('update', (dt: number) => {
      // 2026 Tech: 音频射线追踪更新 (Throttled to 10Hz)
      const now = Date.now();
      if (this.audioRaytracer && now - this.lastAudioUpdate > 100) {
        this.lastAudioUpdate = now;
        try {
          const sectorManager = (this.app as any)['sectorManager'];
          const obstacles =
            sectorManager && typeof sectorManager.getSectorEntities === 'function'
              ? sectorManager.getSectorEntities()
              : [];
          this.audioRaytracer.update(dt, obstacles);
        } catch (err) {
          console.error('[PlayCanvasEngine] Audio raytracer update failed:', err);
        }
      }

      try {
        callback(dt);

        // 2026 Tech: 插件系统每帧更新
        this.pluginSystem?.update(dt);
      } catch (err) {
        console.error('[PlayCanvasEngine] Frame update callback failed:', err);
      }
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

  /**
   * 2026 Tech: 获取或创建小行星实例化渲染组。
   */
  public async getAsteroidBatch(assetPath: string): Promise<string | null> {
    if (!this.instancedRenderer) return null;

    const batchId = `asteroid_batch_${assetPath.replace(/\//g, '_')}`;
    const existing = this.instancedRenderer.getBatchStats(batchId);
    if (existing) return batchId;

    // 加载 GLB 容器以获取 Mesh 和 Material
    const containerAsset = await this.getModelAssets().load(assetPath);
    if (!containerAsset || !containerAsset.resource) return null;

    // 从容器中提取第一个网格和材质 (简化逻辑)
    const resource = containerAsset.resource as any;
    const meshInstances = resource.renders?.[0]?.meshInstances || [];
    if (meshInstances.length === 0) return null;

    const mesh = meshInstances[0].mesh;
    const material = meshInstances[0].material;

    // 将 Mesh 和 Material 注册为 Asset (InstancedRenderer 需要 Asset)
    const meshAsset = new pc.Asset(`${batchId}_mesh`, 'mesh');
    meshAsset.resource = mesh;
    meshAsset.loaded = true;
    this.app.assets.add(meshAsset);

    const matAsset = new pc.Asset(`${batchId}_mat`, 'material');
    matAsset.resource = material;
    matAsset.loaded = true;
    this.app.assets.add(matAsset);

    this.instancedRenderer.createBatchGroup({
      id: batchId,
      meshAssetId: meshAsset.id.toString(),
      materialAssetId: matAsset.id.toString(),
      maxInstances: 20000,
    });

    return batchId;
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

  public getPlugin<T = unknown>(name: string): T | null {
    return (this.pluginSystem?.getPlugin(name) as T) || null;
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

  /**
   * v2.7 调用方占位：在指定位置触发一个爆炸视觉效果。
   * 当前为空实现——调用方全部使用可选链 `engine?.createExplosion?.()`，
   * 暂未接入实际粒子系统；后续 VisualEffectSystem 接线时再补。
   */
  public createExplosion(_position: pc.Vec3, _scale: number = 1.0): void {
    // TODO: delegate to VisualEffectSystem / addParticleSystem
  }
}
