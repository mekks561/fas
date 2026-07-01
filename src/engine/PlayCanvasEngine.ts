import * as pc from 'playcanvas';

export interface GameConfig {
  canvas: HTMLCanvasElement;
  width?: number;
  height?: number;
  antialias?: boolean;
  enablePostEffects?: boolean;
  enablePhysics?: boolean;
}

export class PlayCanvasGameEngine {
  private app: pc.Application;
  private camera: pc.Entity;
  private assets: pc.AssetRegistry;
  private isStarted: boolean = false;
  private physicsEnabled: boolean = false;
  
  constructor(config: GameConfig) {
    const { canvas, antialias = true, enablePhysics = true } = config;
    
    console.log('[PlayCanvasEngine] Creating application...');
    
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
      }
    });

    const deviceType = this.app.graphicsDevice.deviceType;
    console.log(`[PlayCanvasEngine] Application created (GPU: ${deviceType})`);
    
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    
    this.app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.25);
    
    this.camera = new pc.Entity('mainCamera');
    this.camera.addComponent('camera', {
      clearColor: new pc.Color(0.02, 0.02, 0.05),
      nearClip: 0.1,
      farClip: 1000,
      fov: 60
    });
    this.app.root.addChild(this.camera);
    
    console.log('[PlayCanvasEngine] Camera created at position (0, 0, 0)');
    
    this.assets = this.app.assets;
    
    if (enablePhysics) {
      this.enablePhysics();
    }
    
    window.addEventListener('resize', () => this.onResize());
    
    console.log('[PlayCanvasEngine] Engine initialization complete');
  }
  
  private onResize(): void {
    this.app.resizeCanvas();
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
      
      let frameCount = 0;
      let lastFpsUpdate = Date.now();
      
      this.app.on('update', () => {
        frameCount++;
        const now = Date.now();
        if (now - lastFpsUpdate >= 1000) {
          const fps = Math.round(frameCount * 1000 / (now - lastFpsUpdate));
          console.log('[PlayCanvasEngine] Rendering - Frame:', frameCount, 'FPS:', fps);
          frameCount = 0;
          lastFpsUpdate = now;
        }
      });
    }
  }
  
  public setCameraPosition(x: number, y: number, z: number): void {
    this.camera.setPosition(x, y, z);
  }
  
  public lookAt(target: pc.Vec3): void {
    this.camera.lookAt(target);
  }
  
  public addLight(name: string, position: pc.Vec3, color: pc.Color, intensity: number): pc.Entity {
    const light = new pc.Entity(name);
    light.setPosition(position);
    light.addComponent('light', {
      type: 'point',
      color,
      intensity
    });
    this.app.root.addChild(light);
    return light;
  }
  
  public addDirectionalLight(name: string, direction: pc.Vec3, color: pc.Color, intensity: number): pc.Entity {
    const light = new pc.Entity(name);
    light.setEulerAngles(
      Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z)) * 180 / Math.PI,
      Math.atan2(direction.x, direction.z) * 180 / Math.PI,
      0
    );
    light.addComponent('light', {
      type: 'directional',
      color,
      intensity,
      castShadows: true
    });
    this.app.root.addChild(light);
    return light;
  }
  
  public createMaterial(name: string, options: {
    diffuse?: pc.Color;
    emissive?: pc.Color;
    specular?: pc.Color;
    shininess?: number;
    transparency?: number;
    blendType?: number;
  }): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    material.name = name;
    
    if (options.diffuse) material.diffuse = options.diffuse;
    if (options.emissive) material.emissive = options.emissive;
    if (options.specular) material.specular = options.specular;
    if (options.shininess !== undefined) {
      (material as unknown as { shininess: number }).shininess = options.shininess;
    }
    if (options.transparency !== undefined) {
      material.transparency = options.transparency;
    }
    if (options.blendType !== undefined) {
      material.blendType = options.blendType;
    }
    
    material.update();
    return material;
  }
  
  public createBox(name: string, width: number, height: number, depth: number, material: pc.Material): pc.Entity {
    const box = new pc.Entity(name);
    box.addComponent('model', {
      type: 'box',
      width,
      height,
      depth
    });
    if (box.model) box.model.material = material;
    this.app.root.addChild(box);
    return box;
  }
  
  public createSphere(name: string, radius: number, material: pc.Material): pc.Entity {
    const sphere = new pc.Entity(name);
    sphere.addComponent('model', {
      type: 'sphere',
      radius
    });
    if (sphere.model) sphere.model.material = material;
    this.app.root.addChild(sphere);
    return sphere;
  }
  
  public createCylinder(name: string, radius: number, height: number, material: pc.Material): pc.Entity {
    const cylinder = new pc.Entity(name);
    cylinder.addComponent('model', {
      type: 'cylinder',
      radius,
      height
    });
    if (cylinder.model) cylinder.model.material = material;
    this.app.root.addChild(cylinder);
    return cylinder;
  }
  
  public createStarField(count: number = 300, innerRadius: number = 30, outerRadius: number = 80): void {
    const starMaterial = this.createMaterial('starMaterial', {
      diffuse: new pc.Color(1, 1, 1),
      emissive: new pc.Color(1, 1, 1),
      specular: new pc.Color(0, 0, 0)
    });
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
      const size = 0.05 + Math.random() * 0.15;
      
      const star = this.createSphere(`star_${i}`, size, starMaterial);
      star.setPosition(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
    }
    
    console.log('[PlayCanvasEngine] Star field created with', count, 'stars');
  }
  
  public createNebula(position: pc.Vec3, scale: number = 30): pc.Entity {
    const nebulaMaterial = this.createMaterial('nebulaMaterial', {
      diffuse: new pc.Color(0.3, 0.1, 0.5),
      emissive: new pc.Color(0.2, 0.05, 0.3),
      transparency: 0.15,
      blendType: pc.BLEND_ADDITIVEALPHA
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
      emissive: new pc.Color(0.05, 0.05, 0.05)
    });
    
    const planet = this.createSphere(name, radius, planetMaterial);
    planet.setPosition(position);
    
    return planet;
  }
  
  public getApp(): pc.Application {
    return this.app;
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
    this.app.on('update', callback);
  }
  
  public destroy(): void {
    this.app.destroy();
  }
  
  public isPhysicsEnabled(): boolean {
    return this.physicsEnabled;
  }
}