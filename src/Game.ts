import {
  Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight,
  DirectionalLight, ShadowGenerator, Color3, MeshBuilder, StandardMaterial,
  CubeTexture, Texture, SceneLoader, Mesh, Tools, PhysicsImpostor, Matrix
} from '@babylonjs/core';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { InputManager } from './InputManager';
import { PlayerShip } from './PlayerShip';
// import { PhysicsManager } from './PhysicsManager';
import { IGameConfig } from './types';
import { EnemySystem } from './EnemySystem';
import { WeaponSystem } from './WeaponSystem';
import { ParticleManager } from './ParticleManager';
import { AudioSystem } from './AudioSystem';
import { ScoreSystem } from './ScoreSystem';
import { GameStateManager, GameState } from './GameStateManager';
import { SoundType } from './AudioSystem';
import { ParticleEffectType } from './ParticleManager';
import { TextureManager } from './TextureManager';


export class Game {
  private engine: Engine;
  private scene: Scene;
  private camera!: ArcRotateCamera;
  private playerShip!: PlayerShip;
  private inputManager: InputManager;
  // 暂时移除物理管理器
  // private physicsManager: PhysicsManager;
  private lastTime: number = 0;
  private hud!: AdvancedDynamicTexture;
  
  // 新增模块
  private enemySystem!: EnemySystem;
  private weaponSystem!: WeaponSystem;
  private particleManager!: ParticleManager;
  private audioSystem!: AudioSystem;
  private scoreSystem!: ScoreSystem;
  private gameStateManager!: GameStateManager;
  private textureManager!: TextureManager;
  
  private config: IGameConfig = {
    debug: false,
    showInspector: false,
    gravity: 0, // 太空环境，无重力
    playerSpeed: 30,
    rotationSpeed: 2
  };

  constructor(private canvas: HTMLCanvasElement) {
    // 初始化引擎
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });
    
    // 创建场景
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color3(0, 0, 0.05).toColor4(); // 深蓝色背景
    
    // 初始化管理器
    this.inputManager = new InputManager(canvas);
    // 暂时禁用物理管理器，因为没有安装物理引擎插件
    // this.physicsManager = new PhysicsManager(this.scene, new Vector3(0, 0, 0));
    
    // 初始化TextureManager
    this.textureManager = new TextureManager(this.scene);
    
    // 预加载所有纹理
    this.textureManager.preloadAllTextures().then(() => {
        console.log('All textures preloaded successfully');
    }).catch(error => {
        console.warn('Some textures failed to preload:', error);
    });
    
    // 设置场景
    this.setupScene();
    this.setupCamera();
    this.setupLighting();
    this.setupEnvironment();
    this.setupPlayer();
    this.setupHUD();
    
    // 初始化新增模块
    this.particleManager = new ParticleManager(this.scene);
    this.audioSystem = new AudioSystem(this.scene);
    this.scoreSystem = new ScoreSystem();
    this.gameStateManager = new GameStateManager(this.scene);
    this.enemySystem = new EnemySystem(this.scene, this.playerShip, this.textureManager);
    this.weaponSystem = new WeaponSystem(this.scene);
    this.weaponSystem.setPlayer(this.playerShip);
    
    // 调试工具
    if (this.config.showInspector) {
      this.scene.debugLayer.show({
        embedMode: true
      });
    }
    
    // 启动游戏循环
    this.lastTime = Date.now();
    this.engine.runRenderLoop(() => this.gameLoop());
    
    // 窗口大小调整
    window.addEventListener('resize', () => this.engine.resize());
  }

  private setupScene(): void {
    // 添加雾效
    this.scene.fogMode = Scene.FOGMODE_EXP;
    this.scene.fogDensity = 0.01;
    this.scene.fogColor = new Color3(0, 0, 0.1);
  }

  private setupCamera(): void {
    // 第三人称相机
    this.camera = new ArcRotateCamera(
      'gameCamera',
      Tools.ToRadians(-90), // 水平角度
      Tools.ToRadians(45),  // 垂直角度，更平视
      20,                   // 距离，更靠近
      Vector3.Zero(),       // 目标点
      this.scene
    );
    
    this.camera.lowerRadiusLimit = 8;
    this.camera.upperRadiusLimit = 40;
    this.camera.lowerBetaLimit = Tools.ToRadians(10);
    this.camera.upperBetaLimit = Tools.ToRadians(70);
    this.camera.wheelPrecision = 50;
    this.camera.attachControl(this.canvas, false);
    
    // 禁用碰撞检测，因为物理引擎已禁用
    this.camera.checkCollisions = false;
  }

  private setupLighting(): void {
    // 环境光
    const ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), this.scene);
    ambientLight.intensity = 0.8; // 增加强度
    ambientLight.groundColor = new Color3(0.2, 0.2, 0.4);
    ambientLight.diffuse = new Color3(0.8, 0.8, 1.0);
    
    // 主方向光（模拟太阳）
    const sunLight = new DirectionalLight('sunLight', new Vector3(-1, -2, -1), this.scene);
    sunLight.intensity = 2.0; // 大幅增加强度
    sunLight.position = new Vector3(20, 40, 20);
    sunLight.diffuse = new Color3(1, 1, 0.9); // 更亮的暖白色
    sunLight.specular = new Color3(1, 1, 1);
    
    // 阴影
    const shadowGenerator = new ShadowGenerator(1024, sunLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurScale = 2;
    shadowGenerator.useKernelBlur = true;
    shadowGenerator.blurKernel = 32;
  }

  private setupEnvironment(): void {
    // 创建星空背景
    const skybox = MeshBuilder.CreateBox('skyBox', { size: 1000 }, this.scene);
    const skyboxMaterial = new StandardMaterial('skyBoxMaterial', this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = CubeTexture.CreateFromPrefilteredData(
      'https://assets.babylonjs.com/environments/environmentSpecular.env',
      this.scene
    );
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    
    // 创建场景元素
    this.createAsteroidField();
    this.createSpaceStation();
    this.createPlanet();
    this.createDebrisField();
    
    // 创建边界可视化（调试用）
    if (this.config.debug) {
      this.createDebugBoundaries();
    }
  }

  private createAsteroidField(): void {
    const asteroidCount = 50;
    
    for (let i = 0; i < asteroidCount; i++) {
      const size = 1 + Math.random() * 3;
      const asteroid = MeshBuilder.CreateSphere(
        `asteroid_${i}`,
        { diameter: size, segments: 8 },
        this.scene
      );
      
      // 随机位置
      asteroid.position = new Vector3(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 200 - 100 // 主要分布在玩家前方
      );
      
      // 随机旋转
      asteroid.rotation = new Vector3(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      
      // 创建小行星材质
      const asteroidMat = new StandardMaterial(`asteroidMat_${i}`, this.scene);
      asteroidMat.diffuseColor = new Color3(0.3 + Math.random() * 0.2, 0.2 + Math.random() * 0.1, 0.1 + Math.random() * 0.1);
      asteroidMat.specularColor = new Color3(0.1, 0.1, 0.1);
      asteroidMat.emissiveColor = new Color3(0.05, 0.03, 0.02);
      
      // 添加一些噪点纹理
      try {
        asteroidMat.diffuseTexture = this.textureManager.getTexture('./textures/rock.jpg');
        // 使用类型断言访问纹理缩放属性
        if (asteroidMat.diffuseTexture) {
          (asteroidMat.diffuseTexture as any).uScale = 2;
          (asteroidMat.diffuseTexture as any).vScale = 2;
        }
      } catch (error) {
        console.warn('Failed to load rock texture for asteroid:', error);
      }
      
      asteroid.material = asteroidMat;
      
      // 物理已禁用，暂时不添加物理属性
    }
  }
  
  private createSpaceStation(): void {
    // 创建太空站主体
    const stationCore = MeshBuilder.CreateCylinder('stationCore', {
      height: 30,
      diameterTop: 15,
      diameterBottom: 15,
      tessellation: 24
    }, this.scene);
    stationCore.position = new Vector3(0, 0, -200);
    stationCore.rotation.x = Math.PI / 2;
    
    // 创建太空站材质
    const stationMaterial = new StandardMaterial('stationMaterial', this.scene);
    stationMaterial.diffuseColor = new Color3(0.7, 0.7, 0.8);
    stationMaterial.specularColor = new Color3(0.9, 0.9, 0.9);
    stationMaterial.specularPower = 100;
    
    // 添加金属纹理
    try {
      stationMaterial.diffuseTexture = this.textureManager.getTexture('./textures/metal.jpg');
      if (stationMaterial.diffuseTexture) {
        (stationMaterial.diffuseTexture as any).uScale = 5;
        (stationMaterial.diffuseTexture as any).vScale = 5;
      }
    } catch (error) {
      console.warn('Failed to load metal texture for space station:', error);
    }
    
    stationCore.material = stationMaterial;
    
    // 添加太阳能板
    for (let i = 0; i < 4; i++) {
      const solarPanel = MeshBuilder.CreateBox(`solarPanel_${i}`, {
        width: 2, height: 40, depth: 8
      }, this.scene);
      solarPanel.parent = stationCore;
      
      const angle = (Math.PI * 2 * i) / 4;
      solarPanel.position.x = Math.cos(angle) * 20;
      solarPanel.position.z = Math.sin(angle) * 20;
      
      // 太阳能板材质
      const panelMaterial = new StandardMaterial(`panelMaterial_${i}`, this.scene);
      panelMaterial.diffuseColor = new Color3(0.3, 0.8, 0.3);
      panelMaterial.emissiveColor = new Color3(0.1, 0.3, 0.1);
      panelMaterial.specularColor = new Color3(0.5, 0.5, 0.5);
      
      // 添加网格纹理
      try {
        panelMaterial.diffuseTexture = this.textureManager.getTexture('./textures/grid.png');
        if (panelMaterial.diffuseTexture) {
          (panelMaterial.diffuseTexture as any).uScale = 2;
          (panelMaterial.diffuseTexture as any).vScale = 5;
        }
      } catch (error) {
        console.warn('Failed to load grid texture for solar panel:', error);
      }
      
      solarPanel.material = panelMaterial;
    }
  }
  
  private createPlanet(): void {
    // 创建行星
    const planet = MeshBuilder.CreateSphere('planet', {
      diameter: 50,
      segments: 32
    }, this.scene);
    planet.position = new Vector3(100, 0, -300);
    
    // 创建行星材质
    const planetMaterial = new StandardMaterial('planetMaterial', this.scene);
    planetMaterial.diffuseColor = new Color3(0.2, 0.4, 0.8);
    planetMaterial.specularColor = new Color3(0.8, 0.8, 0.9);
    planetMaterial.specularPower = 50;
    
    // 添加行星纹理
    try {
      planetMaterial.diffuseTexture = this.textureManager.getTexture('./textures/earth.jpg');
      if (planetMaterial.diffuseTexture) {
        planetMaterial.specularTexture = planetMaterial.diffuseTexture;
      }
    } catch (error) {
      console.warn('Failed to load earth texture for planet:', error);
    }
    
    planet.material = planetMaterial;
    
    // 创建行星环
    const ring = MeshBuilder.CreateTorus('planetRing', {
      diameter: 70,
      thickness: 10,
      tessellation: 64
    }, this.scene);
    ring.parent = planet;
    ring.rotation.x = Math.PI / 2;
    
    // 行星环材质
    const ringMaterial = new StandardMaterial('ringMaterial', this.scene);
    ringMaterial.diffuseColor = new Color3(0.9, 0.8, 0.6);
    ringMaterial.emissiveColor = new Color3(0.2, 0.2, 0.1);
    ringMaterial.alpha = 0.7;
    
    ring.material = ringMaterial;
  }
  
  private createDebrisField(): void {
    const debrisCount = 30;
    
    for (let i = 0; i < debrisCount; i++) {
      const debris = MeshBuilder.CreateBox(`debris_${i}`, {
        width: 1 + Math.random() * 2,
        height: 0.5 + Math.random() * 1,
        depth: 1 + Math.random() * 2
      }, this.scene);
      
      debris.position = new Vector3(
        (Math.random() - 0.5) * 150,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 200 - 150
      );
      
      debris.rotation = new Vector3(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      
      // 碎片材质
      const debrisMaterial = new StandardMaterial(`debrisMaterial_${i}`, this.scene);
      debrisMaterial.diffuseColor = new Color3(0.6 + Math.random() * 0.2, 0.6 + Math.random() * 0.2, 0.6 + Math.random() * 0.2);
      debrisMaterial.specularColor = new Color3(0.8, 0.8, 0.8);
      debrisMaterial.specularPower = 100;
      
      // 添加金属纹理
      try {
        debrisMaterial.diffuseTexture = this.textureManager.getTexture('./textures/metalScratched.jpg');
        if (debrisMaterial.diffuseTexture) {
          (debrisMaterial.diffuseTexture as any).uScale = 1;
          (debrisMaterial.diffuseTexture as any).vScale = 1;
        }
      } catch (error) {
        console.warn('Failed to load metalScratched texture for debris:', error);
      }
      
      debris.material = debrisMaterial;
    }
  }

  private createDebugBoundaries(): void {
    const boundarySize = 100;
    const boundary = MeshBuilder.CreateBox('debugBoundary', {
      width: boundarySize * 2,
      height: boundarySize * 2,
      depth: boundarySize * 2
    }, this.scene);
    
    const boundaryMat = new StandardMaterial('boundaryMat', this.scene);
    boundaryMat.wireframe = true;
    boundaryMat.emissiveColor = new Color3(1, 0, 0);
    boundaryMat.alpha = 0.1;
    boundary.material = boundaryMat;
    boundary.isVisible = true;
  }

  private setupPlayer(): void {
    this.playerShip = new PlayerShip(this.scene, this.textureManager);
    this.playerShip.body.position = new Vector3(0, 0, 10); // 增加z坐标，使战斗机更靠近相机
    
    // 将相机目标设置为战机
    this.camera.target = this.playerShip.body.position;
    
    // 相机跟随战机
    this.scene.onBeforeRenderObservable.add(() => {
      const shipPos = this.playerShip.getPosition();
      const shipForward = this.playerShip.getForward();
      
      // 计算相机理想位置（战机后方上方） - 使用简化的方法，避免rotationQuaternion为null的问题
      const cameraOffset = new Vector3(0, 5, -15);
      
      // 使用欧拉角创建旋转矩阵
      const rotationMatrix = Matrix.RotationYawPitchRoll(
        this.playerShip.body.rotation.y,
        this.playerShip.body.rotation.x,
        this.playerShip.body.rotation.z
      );
      
      // 应用旋转到相机偏移量
      const transformedOffset = Vector3.TransformCoordinates(cameraOffset, rotationMatrix);
      
      const desiredPosition = shipPos.add(transformedOffset);
      
      // 平滑移动相机
      this.camera.target = Vector3.Lerp(this.camera.target, shipPos, 0.05);
      this.camera.position = Vector3.Lerp(this.camera.position, desiredPosition, 0.05);
      
      // 相机看向战机前方一点的位置，更符合飞行视角
      const lookAtPoint = shipPos.add(shipForward.scale(10));
      this.camera.setTarget(lookAtPoint);
    });
  }

  private setupHUD(): void {
    // 创建高级动态纹理用于HUD
    this.hud = AdvancedDynamicTexture.CreateFullscreenUI('UI');
    
    // 速度显示
    const speedPanel = new Rectangle('speedPanel');
    speedPanel.width = '200px';
    speedPanel.height = '80px';
    speedPanel.cornerRadius = 10;
    speedPanel.color = 'transparent';
    speedPanel.thickness = 2;
    speedPanel.background = 'rgba(0, 20, 40, 0.7)';
    speedPanel.horizontalAlignment = Rectangle.HORIZONTAL_ALIGNMENT_LEFT;
    speedPanel.verticalAlignment = Rectangle.VERTICAL_ALIGNMENT_BOTTOM;
    speedPanel.left = '20px';
    speedPanel.top = '-20px';
    this.hud.addControl(speedPanel);
    
    const speedText = new TextBlock('speedText');
    speedText.text = 'SPEED: 0';
    speedText.color = 'cyan';
    speedText.fontSize = 24;
    speedText.fontFamily = 'Arial, sans-serif';
    speedPanel.addControl(speedText);
    
    // 助推器状态
    const boostPanel = new Rectangle('boostPanel');
    boostPanel.width = '200px';
    boostPanel.height = '40px';
    boostPanel.cornerRadius = 5;
    boostPanel.color = 'orange';
    boostPanel.thickness = 1;
    boostPanel.background = 'rgba(255, 100, 0, 0.3)';
    boostPanel.horizontalAlignment = Rectangle.HORIZONTAL_ALIGNMENT_LEFT;
    boostPanel.verticalAlignment = Rectangle.VERTICAL_ALIGNMENT_BOTTOM;
    boostPanel.left = '20px';
    boostPanel.top = '-110px';
    this.hud.addControl(boostPanel);
    
    const boostText = new TextBlock('boostText');
    boostText.text = 'BOOST: READY';
    boostText.color = 'white';
    boostText.fontSize = 16;
    boostPanel.addControl(boostText);
    
    // 准星
    const crosshair = new Rectangle('crosshair');
    crosshair.width = '20px';
    crosshair.height = '20px';
    crosshair.thickness = 2;
    crosshair.color = 'lime';
    crosshair.horizontalAlignment = Rectangle.HORIZONTAL_ALIGNMENT_CENTER;
    crosshair.verticalAlignment = Rectangle.VERTICAL_ALIGNMENT_CENTER;
    this.hud.addControl(crosshair);
    
    // 更新HUD的函数
    this.scene.onBeforeRenderObservable.add(() => {
      speedText.text = `SPEED: ${Math.round(this.playerShip.speed)}`;
      boostText.text = `BOOST: ${this.inputManager.isKeyPressed('shift') ? 'ACTIVE' : 'READY'}`;
      boostPanel.background = this.inputManager.isKeyPressed('shift') ? 
        'rgba(255, 50, 0, 0.5)' : 'rgba(255, 100, 0, 0.3)';
    });
  }

  private gameLoop(): void {
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastTime) / 1000; // 转换为秒
    this.lastTime = currentTime;
    
    // 获取输入
    const controls = this.inputManager.getControls();
    const mouseDelta = this.inputManager.getMouseDelta();
    
    // 更新游戏状态
    this.gameStateManager.update(deltaTime);
    
    // 确保游戏状态是PLAYING
    if (!this.gameStateManager.isState(GameState.PLAYING)) {
      this.gameStateManager.setPlayingState();
    }
    
    if (this.gameStateManager.isState(GameState.PLAYING)) {
      // 武器发射输入
      if (controls.fire) {
        this.weaponSystem.fire();
        this.audioSystem.playSound(SoundType.FIRE_WEAPON);
      }
      
      // 更新玩家战机
      this.playerShip.update(deltaTime, controls, mouseDelta);
      
      // 更新敌人系统
      this.enemySystem.update(deltaTime);
      
      // 更新武器系统
      this.weaponSystem.update(deltaTime);
      
      // 检查碰撞
      const hits = this.weaponSystem.checkCollisions(this.enemySystem.getEnemies());
      if (hits > 0) {
        // 增加得分
        this.scoreSystem.addKillScore();
        // 播放音效
        this.audioSystem.playSound(SoundType.EXPLOSION);
      }
      
      // 更新粒子效果
      this.particleManager.update(deltaTime);
      
      // 更新得分系统
      this.scoreSystem.update(deltaTime);
      
      // 简单边界检查，替代物理管理器的边界检查
      const bounds = { x: 100, y: 50, z: 200 };
      const position = this.playerShip.getPosition();
      
      // 只有在位置超出边界时才进行限制
      if (Math.abs(position.x) > bounds.x) {
        this.playerShip.body.position.x = bounds.x * Math.sign(position.x);
      }
      
      if (Math.abs(position.y) > bounds.y) {
        this.playerShip.body.position.y = bounds.y * Math.sign(position.y);
      }
      
      if (Math.abs(position.z) > bounds.z) {
        this.playerShip.body.position.z = bounds.z * Math.sign(position.z);
      }
    }
    
    // 渲染场景
    this.scene.render();
  }

  public dispose(): void {
    // 清理所有新增模块
    this.enemySystem.dispose();
    this.weaponSystem.dispose();
    this.particleManager.dispose();
    this.audioSystem.dispose();
    this.gameStateManager.dispose();
    this.textureManager.dispose();
    
    // 清理玩家和场景
    this.playerShip.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }

  public getScene(): Scene {
    return this.scene;
  }
}