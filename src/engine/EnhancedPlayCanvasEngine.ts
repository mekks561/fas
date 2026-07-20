/**
 * 增强版 PlayCanvas 游戏引擎
 * 扩展功能：物理系统、后期效果、粒子系统、资源管理
 */

import * as pc from 'playcanvas';
import { GameEngineConfig, LightConfig, CameraConfig, GameEngine } from './GameEngine';

export type GameConfig = GameEngineConfig;

export class EnhancedPlayCanvasEngine implements GameEngine {
  private app: pc.Application;
  private scene: pc.Scene;
  private camera: pc.Entity;
  private lights: pc.Entity[] = [];
  private physicsEnabled: boolean = false;
  private onResize: () => void;

  constructor(config: GameConfig) {
    const {
      canvas,
      width: _width = window.innerWidth,
      height: _height = window.innerHeight,
      antialias = true,
      enablePhysics = true,
      enablePostEffects = true,
    } = config;

    this.app = new pc.Application(canvas, {
      elementInput: new pc.ElementInput(canvas),
      mouse: new pc.Mouse(canvas),
      touch: 'ontouchstart' in window ? new pc.TouchDevice(canvas) : undefined,
      keyboard: new pc.Keyboard(canvas),
      graphicsDeviceOptions: {
        deviceType: [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2],
        antialias,
        alpha: true,
        powerPreference: 'high-performance',
      },
    });

    const deviceType = this.app.graphicsDevice.deviceType;
    console.log(`[EnhancedPlayCanvasEngine] Application created (GPU: ${deviceType})`);

    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

    this.scene = new pc.Scene(this.app.graphicsDevice);
    this.scene.ambientLight = new pc.Color(0.2, 0.2, 0.25);

    this.camera = new pc.Entity('mainCamera');
    this.camera.addComponent('camera', {
      clearColor: new pc.Color(0.05, 0.05, 0.1),
      nearClip: 0.1,
      farClip: 1000,
      fov: 60,
    });
    this.scene.addChild(this.camera);

    if (enablePhysics) {
      this.enablePhysics();
    }

    if (enablePostEffects) {
      this.setupPostEffects();
    }

    this.onResize = () => this.app.resizeCanvas();
    window.addEventListener('resize', this.onResize);
  }

  private enablePhysics(): void {
    this.physicsEnabled = true;
    this.app.systems.physics?.gravity.set(0, -9.81, 0);
  }

  private setupPostEffects(): void {
    const cameraComponent = this.camera.camera;
    if (!cameraComponent) return;

    const bloom = new pc.BloomEffect(this.app.graphicsDevice);
    (bloom as unknown as { intensity: number }).intensity = 0.5;
    (bloom as unknown as { threshold: number }).threshold = 0.8;
    cameraComponent.postEffects.addEffect(bloom);

    const fxaa = new pc.FxaaEffect(this.app.graphicsDevice);
    cameraComponent.postEffects.addEffect(fxaa);

    const vignette = new pc.VignetteEffect(this.app.graphicsDevice);
    (vignette as unknown as { intensity: number }).intensity = 0.3;
    cameraComponent.postEffects.addEffect(vignette);
  }

  public start(): void {
    this.app.start();
  }

  public setCamera(config: CameraConfig): void {
    this.camera.setPosition(config.position);
    if (config.target) {
      this.camera.lookAt(config.target);
    }
    const cameraComp = this.camera.camera;
    if (config.fov && cameraComp) {
      cameraComp.fov = config.fov;
    }
    if (config.nearClip && cameraComp) {
      cameraComp.nearClip = config.nearClip;
    }
    if (config.farClip && cameraComp) {
      cameraComp.farClip = config.farClip;
    }
    if (config.clearColor && cameraComp) {
      cameraComp.clearColor = config.clearColor;
    }
  }

  public addLight(name: string, config: LightConfig): pc.Entity;
  public addLight(name: string, position: pc.Vec3, color: pc.Color, intensity: number): pc.Entity;
  public addLight(name: string, configOrPosition: LightConfig | pc.Vec3, color?: pc.Color, intensity?: number): pc.Entity {
    const light = new pc.Entity(name);
    
    if ('type' in configOrPosition) {
      const config = configOrPosition as LightConfig;
      light.setPosition(config.position || new pc.Vec3(0, 10, 0));

      const lightComponent = light.addComponent('light', {
        type: config.type,
        color: config.color || new pc.Color(1, 1, 1),
        intensity: config.intensity || 1,
        range: config.range || 100,
        castShadows: config.castShadows || false,
      });

      if (config.castShadows) {
        const lightComp = lightComponent as unknown as { shadowType?: number; shadowResolution?: number };
        lightComp.shadowType = pc.SHADOW_PCF1;
        lightComp.shadowResolution = 2048;
      }
    } else {
      const position = configOrPosition as pc.Vec3;
      light.setPosition(position);
      light.addComponent('light', {
        type: 'point',
        color: color || new pc.Color(1, 1, 1),
        intensity: intensity || 1,
      });
    }

    this.scene.addChild(light);
    this.lights.push(light);

    return light;
  }

  public createMaterial(
    name: string,
    options: {
      diffuse?: pc.Color;
      emissive?: pc.Color;
      specular?: pc.Color;
      shininess?: number;
      roughness?: number;
      metalness?: number;
      opacity?: number;
      transparent?: boolean;
      useMetalness?: boolean;
    },
  ): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    material.name = name;

    if (options.diffuse) material.diffuse = options.diffuse;
    if (options.emissive) material.emissive = options.emissive;
    if (options.specular) material.specular = options.specular;
    if (options.shininess !== undefined) (material as unknown as { shininess: number }).shininess = options.shininess;
    if (options.roughness !== undefined) material.roughness = options.roughness;
    if (options.metalness !== undefined) material.metalness = options.metalness;
    if (options.opacity !== undefined) material.opacity = options.opacity;
    if (options.transparent) material.blendType = pc.BLEND_NORMAL;
    if (options.useMetalness !== undefined) material.useMetalness = options.useMetalness;

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
    box.addComponent('model', {
      type: 'box',
      width,
      height,
      depth,
    });
    if (box.model) box.model.material = material;
    this.scene.addChild(box);
    return box;
  }

  public createSphere(name: string, radius: number, material: pc.Material): pc.Entity {
    const sphere = new pc.Entity(name);
    sphere.addComponent('model', {
      type: 'sphere',
      radius,
    });
    if (sphere.model) sphere.model.material = material;
    this.scene.addChild(sphere);
    return sphere;
  }

  public createCylinder(
    name: string,
    radius: number,
    height: number,
    material: pc.Material,
  ): pc.Entity {
    const cylinder = new pc.Entity(name);
    cylinder.addComponent('model', {
      type: 'cylinder',
      radius,
      height,
    });
    if (cylinder.model) cylinder.model.material = material;
    this.scene.addChild(cylinder);
    return cylinder;
  }

  public createTorus(
    name: string,
    radius: number,
    tubeRadius: number,
    material: pc.Material,
  ): pc.Entity {
    const torus = new pc.Entity(name);
    torus.addComponent('model', {
      type: 'torus',
      radius,
      tubeRadius,
    });
    if (torus.model) torus.model.material = material;
    this.scene.addChild(torus);
    return torus;
  }

  public createPlane(
    name: string,
    width: number,
    height: number,
    material: pc.Material,
  ): pc.Entity {
    const plane = new pc.Entity(name);
    plane.addComponent('model', {
      type: 'plane',
      width,
      height,
    });
    if (plane.model) plane.model.material = material;
    this.scene.addChild(plane);
    return plane;
  }

  public createCustomModel(
    name: string,
    positions: number[],
    uvs?: number[],
    normals?: number[],
    indices?: number[],
    material?: pc.Material,
  ): pc.Entity {
    const mesh = new pc.Mesh(this.app.graphicsDevice);
    mesh.setPositions(positions);
    if (uvs) mesh.setUvs(0, uvs);
    if (normals) mesh.setNormals(normals);
    if (indices) mesh.setIndices(indices);

    const entity = new pc.Entity(name);
    entity.addComponent('model');
    if (entity.model) {
      entity.model.meshInstances = [new pc.MeshInstance(mesh, material || new pc.StandardMaterial())];
    }
    this.scene.addChild(entity);

    return entity;
  }

  public createParticleSystem(
    name: string,
    config: {
      emitterShape?: 'box' | 'sphere' | 'cone';
      rate?: number;
      lifetime?: number;
      speed?: number;
      colorStart?: pc.Color;
      colorEnd?: pc.Color;
      sizeStart?: number;
      sizeEnd?: number;
      emissionRate?: number;
    },
  ): pc.Entity {
    const entity = new pc.Entity(name);
    entity.addComponent('particlesystem');
    const particleSystem = entity.particlesystem as unknown as {
      emitterShape?: string;
      rate?: number;
      lifetime?: number;
      speed?: number;
      colorStart?: pc.Color;
      colorEnd?: pc.Color;
      sizeStart?: number;
      sizeEnd?: number;
      emissionRate?: number;
      material?: pc.Material;
    };

    if (particleSystem) {
      particleSystem.emitterShape = config.emitterShape || 'box';
      particleSystem.rate = config.rate || 100;
      particleSystem.lifetime = config.lifetime || 2;
      particleSystem.speed = config.speed || 5;

      if (config.colorStart) particleSystem.colorStart = config.colorStart;
      if (config.colorEnd) particleSystem.colorEnd = config.colorEnd;
      if (config.sizeStart !== undefined) particleSystem.sizeStart = config.sizeStart;
      if (config.sizeEnd !== undefined) particleSystem.sizeEnd = config.sizeEnd;
      if (config.emissionRate !== undefined) particleSystem.emissionRate = config.emissionRate;

      const material = new pc.StandardMaterial();
      material.blendType = pc.BLEND_NORMAL;
      material.diffuse.set(1, 1, 1);
      material.update();
      particleSystem.material = material;
    }

    this.scene.addChild(entity);
    return entity;
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
    if (!this.physicsEnabled) {
      this.enablePhysics();
    }

    entity.addComponent('rigidbody', {
      type,
      mass: options?.mass || 1,
      linearDamping: options?.linearDamping || 0.1,
      angularDamping: options?.angularDamping || 0.1,
    });

    if (options?.gravity) {
      if (entity.rigidbody) (entity.rigidbody as unknown as { gravity?: pc.Vec3 }).gravity = options.gravity;
    }
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
    const config: Record<string, unknown> = { type };

    if (type === 'box' && options?.halfExtents) {
      config['halfExtents'] = options.halfExtents;
    } else if ((type === 'sphere' || type === 'capsule') && options?.radius) {
      config['radius'] = options.radius;
    } else if ((type === 'cylinder' || type === 'capsule') && options?.height) {
      config['height'] = options.height;
    }

    entity.addComponent('collision', config);
  }

  public addScript(
    entity: pc.Entity,
    scriptName: string,
    attributes?: Record<string, unknown>,
  ): void {
    entity.addComponent('script');
    entity.script?.create(scriptName, { attributes });
  }

  public addToScene(entity: pc.Entity): void {
    this.scene.addChild(entity);
  }

  public getApp(): pc.Application {
    return this.app;
  }

  public getScene(): pc.Scene {
    return this.scene;
  }

  public getCamera(): pc.Entity {
    return this.camera;
  }

  public getLights(): pc.Entity[] {
    return this.lights;
  }

  public setUpdateCallback(callback: (dt: number) => void): void {
    this.app.on('update', callback);
  }

  public setFixedUpdateCallback(callback: (dt: number) => void): void {
    this.app.on('fixedUpdate', callback);
  }

  public destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.lights.forEach((light) => light.destroy());
    this.lights = [];
    this.app.destroy();
  }

  public getInstancedRenderer(): unknown {
    return null;
  }

  public setCameraPosition(x: number, y: number, z: number): void {
    this.camera.setPosition(x, y, z);
  }

  public lookAt(target: pc.Vec3): void {
    this.camera.lookAt(target);
  }

  public addDirectionalLight(name: string, direction: pc.Vec3, color: pc.Color, intensity: number): pc.Entity {
    const light = new pc.Entity(name);
    light.setEulerAngles(
      (Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z)) * 180) / Math.PI,
      (Math.atan2(direction.x, direction.z) * 180) / Math.PI,
      0,
    );
    light.addComponent('light', {
      type: 'directional',
      color,
      intensity,
      castShadows: true,
    });
    this.scene.addChild(light);
    this.lights.push(light);
    return light;
  }

  public createStarField(_count?: number, _innerRadius?: number, _outerRadius?: number): void {
  }

  public createNebula(_position: pc.Vec3, _scale?: number): pc.Entity {
    const nebula = new pc.Entity('nebula');
    this.scene.addChild(nebula);
    return nebula;
  }

  public createPlanet(name: string, position: pc.Vec3, _radius: number, _color: pc.Color): pc.Entity {
    const planet = new pc.Entity(name);
    planet.setPosition(position);
    this.scene.addChild(planet);
    return planet;
  }

  public isPhysicsEnabled(): boolean {
    return this.physicsEnabled;
  }

  public removeFromScene(entity: pc.Entity): void {
    const typedScene = this.scene as unknown as { removeChild?: (entity: pc.Entity) => void };
    typedScene.removeChild?.(entity);
  }
}
