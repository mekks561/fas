import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { EnemySystem } from './EnemySystem';
import { WeaponSystem } from './WeaponSystem';
import { SkillSystem } from './SkillSystem';
import { PowerupSpawner } from './PowerupSystem';
import achievementSystem from './AchievementSystem';
import { AudioManager } from './AudioSystem';
import { InputSystem } from './InputSystem';
import { EventSystem } from './EventSystem';
import { CameraSystem } from './CameraSystem';
import { AnimationSystem } from './AnimationSystem';
import { ResourceManager } from './ResourceManager';
import { InstancedRenderer } from './InstancedRenderer';
import { CloudSaveSystem } from './CloudSaveSystem';
import { DebugSystem } from './DebugSystem';
import { LevelEditor } from './LevelEditor';
import { MultiplayerSystem } from './MultiplayerSystem';
import { LuaSkillBridge } from './LuaSkillBridge';
import { ComputePhysics } from './ComputePhysics';
import { AINPCController } from './AINPCController';
import { PerformanceMonitor } from './PerformanceMonitor';
import { gameplayManager } from './GameplayManager';
import type { GameplayEvents } from './GameplayManager';

export type GameState =
  'menu' | 'loading' | 'playing' | 'paused' | 'game_over' | 'level_complete' | 'settings';

export interface GameConfig {
  canvas: HTMLCanvasElement;
  antialias?: boolean;
  enablePostEffects?: boolean;
  debugMode?: boolean;
  multiplayerEnabled?: boolean;
}

export interface GameStats {
  fps: number;
  frameTime: number;
  entities: number;
  drawCalls: number;
  triangles: number;
  memoryUsage: number;
  players: number;
  enemies: number;
  projectiles: number;
}

export interface SystemInfo {
  name: string;
  enabled: boolean;
  initialized: boolean;
}

export class Game {
  private static instance: Game | null = null;

  private config: GameConfig;
  private state: GameState = 'menu';
  private engine: PlayCanvasGameEngine | null = null;
  private player: PlayerShip | null = null;
  private enemySystem: EnemySystem | null = null;
  private weaponSystem: WeaponSystem | null = null;
  private skillSystem: SkillSystem | null = null;
  private powerupSpawner: PowerupSpawner | null = null;

  private inputSystem: InputSystem | null = null;
  private eventSystem: EventSystem | null = null;
  private cameraSystem: CameraSystem | null = null;
  private animationSystem: AnimationSystem | null = null;
  private resourceManager: ResourceManager | null = null;
  private instancedRenderer: InstancedRenderer | null = null;
  private cloudSaveSystem: CloudSaveSystem | null = null;
  private debugSystem: DebugSystem | null = null;
  private levelEditor: LevelEditor | null = null;
  private multiplayerSystem: MultiplayerSystem | null = null;
  private luaSkillBridge: LuaSkillBridge | null = null;
  private computePhysics: ComputePhysics | null = null;
  private aiNPCController: AINPCController | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;
  private gameplayManagerInstance: typeof gameplayManager | null = null;

  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private updateCallback: ((dt: number) => void) | null = null;

  private fps: number = 0;
  private frameTime: number = 0;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;

  private systems: Map<
    string,
    {
      instance: unknown;
      enabled: boolean;
      initialized: boolean;
      update?: (dt: number) => void;
      destroy?: () => void;
    }
  > = new Map();

  private constructor(config: GameConfig) {
    this.config = config;
  }

  public static getInstance(config?: GameConfig): Game {
    if (!Game.instance) {
      if (!config) {
        throw new Error('Game instance not initialized. Call getInstance with config first.');
      }
      Game.instance = new Game(config);
    }
    return Game.instance;
  }

  public static destroy(): void {
    if (Game.instance) {
      Game.instance.shutdown();
      Game.instance = null;
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.setupSystems();
    await this.initializeSystems();
    this.setupEventListeners();

    this.isInitialized = true;
    this.state = 'loading';
  }

  private setupSystems(): void {
    if (this.config.debugMode) {
      this.systems.set('debug', {
        instance: new DebugSystem(),
        enabled: true,
        initialized: false,
        update: (dt) => this.debugSystem?.update(dt),
        destroy: () => this.debugSystem?.destroy(),
      });
    }

    this.systems.set('input', {
      instance: new InputSystem(this.config.canvas),
      enabled: true,
      initialized: false,
      update: () => this.inputSystem?.update(),
      destroy: () => this.inputSystem?.destroy(),
    });

    this.systems.set('event', {
      instance: new EventSystem(),
      enabled: true,
      initialized: false,
      destroy: () => this.eventSystem?.destroy(),
    });

    this.systems.set('engine', {
      instance: new PlayCanvasGameEngine({
        canvas: this.config.canvas,
        antialias: this.config.antialias,
        enablePostEffects: this.config.enablePostEffects,
      }),
      enabled: true,
      initialized: false,
      destroy: () => this.engine?.destroy(),
    });

    this.systems.set('camera', {
      instance: new CameraSystem(),
      enabled: true,
      initialized: false,
      update: (dt) => this.cameraSystem?.update(dt),
      destroy: () => this.cameraSystem?.destroy(),
    });

    this.systems.set('animation', {
      instance: new AnimationSystem(),
      enabled: true,
      initialized: false,
      update: (dt) => this.animationSystem?.update(dt),
      destroy: () => this.animationSystem?.destroy(),
    });

    this.systems.set('resource', {
      instance: new ResourceManager(),
      enabled: true,
      initialized: false,
      destroy: () => this.resourceManager?.destroy(),
    });

    this.systems.set('instanced', {
      instance: new InstancedRenderer(),
      enabled: true,
      initialized: false,
      update: (dt) => this.instancedRenderer?.update(dt, this.engine?.getCamera()?.getPosition()),
      destroy: () => this.instancedRenderer?.destroy(),
    });

    this.systems.set('cloudSave', {
      instance: new CloudSaveSystem(),
      enabled: true,
      initialized: false,
      destroy: () => this.cloudSaveSystem?.destroy(),
    });

    if (this.config.multiplayerEnabled) {
      this.systems.set('multiplayer', {
        instance: new MultiplayerSystem(),
        enabled: true,
        initialized: false,
        destroy: () => this.multiplayerSystem?.destroy(),
      });
    }

    this.systems.set('player', {
      instance: null,
      enabled: true,
      initialized: false,
    });

    this.systems.set('enemy', {
      instance: null,
      enabled: true,
      initialized: false,
      update: (dt) => this.enemySystem?.update(dt),
    });

    this.systems.set('weapon', {
      instance: null,
      enabled: true,
      initialized: false,
      update: (dt) => this.weaponSystem?.update(dt),
    });

    this.systems.set('skill', {
      instance: null,
      enabled: true,
      initialized: false,
      update: (dt) => this.skillSystem?.update(dt),
    });

    this.systems.set('powerup', {
      instance: null,
      enabled: true,
      initialized: false,
      update: (dt) => this.powerupSpawner?.update(dt),
    });

    this.systems.set('levelEditor', {
      instance: new LevelEditor(),
      enabled: false,
      initialized: false,
      destroy: () => this.levelEditor?.destroy(),
    });

    // Lua 技能系统
    this.systems.set('luaSkill', {
      instance: new LuaSkillBridge(),
      enabled: true,
      initialized: false,
      update: (dt) => this.luaSkillBridge?.update(dt),
      destroy: () => this.luaSkillBridge?.destroy(),
    });

    // WebGPU 物理系统
    this.systems.set('physics', {
      instance: new ComputePhysics({
        maxParticles: 5000,
        gravity: new pc.Vec3(0, -9.81, 0),
        damping: 0.99,
        collisionRadius: 0.5,
        solverIterations: 5,
      }),
      enabled: true,
      initialized: false,
      update: (dt) => this.computePhysics?.update(dt),
      destroy: () => this.computePhysics?.destroy(),
    });

    // AI NPC 控制器
    this.systems.set('aiNPC', {
      instance: new AINPCController({
        modelPath: '/models/npc_ai.onnx',
        inputSize: 12,
        outputSize: 5,
        decisionInterval: 100,
        maxInferenceTime: 50,
      }),
      enabled: true,
      initialized: false,
      update: (dt) => this.updateAI(dt),
      destroy: () => this.aiNPCController?.destroy(),
    });

    // 性能监控
    this.systems.set('performance', {
      instance: new PerformanceMonitor(),
      enabled: true,
      initialized: true,
      update: (_dt) => {},
      destroy: () => {},
    });

    // 游戏玩法管理器
    this.systems.set('gameplay', {
      instance: gameplayManager,
      enabled: true,
      initialized: false,
      update: (dt) => gameplayManager.update(dt),
      destroy: () => gameplayManager.destroy(),
    });
  }

  private async initializeSystems(): Promise<void> {
    const engineSys = this.systems.get('engine');
    if (engineSys) {
      this.engine = engineSys.instance as PlayCanvasGameEngine;
      engineSys.initialized = true;

      this.engine.setCameraPosition(0, 15, 20);
      this.engine.lookAt(new pc.Vec3(0, 0, 0));

      this.engine.addDirectionalLight(
        'sun',
        new pc.Vec3(-5, 10, 5),
        new pc.Color(1, 0.95, 0.9),
        1.5,
      );
      this.engine.addLight('fill', new pc.Vec3(10, 5, -10), new pc.Color(0.4, 0.5, 0.8), 0.5);
      this.engine.addLight('ambient', new pc.Vec3(0, 0, 0), new pc.Color(0.3, 0.3, 0.4), 0.3);

      this.createEnvironment();
    }

    const inputSys = this.systems.get('input');
    if (inputSys) {
      this.inputSystem = inputSys.instance as InputSystem;
      this.inputSystem.enableTouchControls();
      inputSys.initialized = true;
    }

    const eventSys = this.systems.get('event');
    if (eventSys) {
      this.eventSystem = eventSys.instance as EventSystem;
      eventSys.initialized = true;
    }

    const cameraSys = this.systems.get('camera');
    if (cameraSys && this.engine) {
      this.cameraSystem = cameraSys.instance as CameraSystem;
      this.cameraSystem.setCamera(this.engine.getCamera());
      this.cameraSystem.enable();
      cameraSys.initialized = true;
    }

    const animationSys = this.systems.get('animation');
    if (animationSys) {
      this.animationSystem = animationSys.instance as AnimationSystem;
      this.animationSystem.enable();
      animationSys.initialized = true;
    }

    const resourceSys = this.systems.get('resource');
    if (resourceSys && this.engine) {
      this.resourceManager = resourceSys.instance as ResourceManager;
      this.resourceManager.setApp(this.engine.getApp());
      this.resourceManager.enable();
      resourceSys.initialized = true;
    }

    const instancedSys = this.systems.get('instanced');
    if (instancedSys && this.engine) {
      this.instancedRenderer = instancedSys.instance as InstancedRenderer;
      this.instancedRenderer.setApp(this.engine.getApp());
      this.instancedRenderer.enable();
      instancedSys.initialized = true;
    }

    const cloudSaveSys = this.systems.get('cloudSave');
    if (cloudSaveSys) {
      this.cloudSaveSystem = cloudSaveSys.instance as CloudSaveSystem;
      this.cloudSaveSystem.enable();
      cloudSaveSys.initialized = true;
    }

    const debugSys = this.systems.get('debug');
    if (debugSys && this.engine) {
      this.debugSystem = debugSys.instance as DebugSystem;
      this.debugSystem.setApp(this.engine.getApp());
      this.debugSystem.enable();
      debugSys.initialized = true;
    }

    const multiplayerSys = this.systems.get('multiplayer');
    if (multiplayerSys) {
      this.multiplayerSystem = multiplayerSys.instance as MultiplayerSystem;
      multiplayerSys.initialized = true;
    }

    // 初始化 Lua 技能系统
    const luaSkillSys = this.systems.get('luaSkill');
    if (luaSkillSys) {
      this.luaSkillBridge = luaSkillSys.instance as LuaSkillBridge;
      await this.luaSkillBridge.initialize();
      luaSkillSys.initialized = true;
      console.log('[Game] Lua Skill System initialized');
    }

    // 初始化 WebGPU 物理系统
    const physicsSys = this.systems.get('physics');
    if (physicsSys) {
      this.computePhysics = physicsSys.instance as ComputePhysics;
      await new Promise((resolve) => setTimeout(resolve, 100));
      physicsSys.initialized = true;
      console.log(`[Game] Compute Physics initialized - GPU: ${this.computePhysics.isUsingGPU()}`);
    }

    // 初始化 AI NPC 控制器
    const aiNPCSys = this.systems.get('aiNPC');
    if (aiNPCSys) {
      this.aiNPCController = aiNPCSys.instance as AINPCController;
      await new Promise((resolve) => setTimeout(resolve, 100));
      aiNPCSys.initialized = true;
      console.log(`[Game] AI NPC Controller initialized - AI Enabled: ${this.aiNPCController.isUsingAI()}`);
    }

    // 初始化性能监控
    const performanceSys = this.systems.get('performance');
    if (performanceSys) {
      this.performanceMonitor = performanceSys.instance as PerformanceMonitor;
      if (this.computePhysics) {
        this.performanceMonitor.setGpuPhysics(this.computePhysics.isUsingGPU());
      }
      if (this.aiNPCController) {
        this.performanceMonitor.setAiEnabled(this.aiNPCController.isUsingAI());
      }
      console.log('[Game] Performance Monitor initialized');
    }

    // 初始化游戏玩法管理器
    const gameplaySys = this.systems.get('gameplay');
    if (gameplaySys) {
      this.gameplayManagerInstance = gameplaySys.instance as typeof gameplayManager;
      await this.gameplayManagerInstance.initialize('normal');
      gameplaySys.initialized = true;
      console.log('[Game] Gameplay Manager initialized');
    }

    if (this.engine) {
      AudioManager.initialize(this.engine.getApp());
    }
  }

  private createEnvironment(): void {
    if (!this.engine) return;

    this.engine.createStarField(500, 100, 200);
    this.engine.createNebula(new pc.Vec3(50, 20, -50), 40);
    this.engine.createNebula(new pc.Vec3(-60, -10, 40), 35);
    this.engine.createPlanet('planet1', new pc.Vec3(80, 30, 60), 10, new pc.Color(0.4, 0.6, 0.8));
    this.engine.createPlanet('planet2', new pc.Vec3(-70, -20, -50), 8, new pc.Color(0.8, 0.5, 0.3));
  }

  public createPlayer(health: number = 100, shield: number = 50): PlayerShip | null {
    if (!this.engine) return null;

    const player = new PlayerShip({
      engine: this.engine,
      initialPosition: new pc.Vec3(0, 0, 0),
      health,
      shield,
    });

    this.player = player;
    const playerSys = this.systems.get('player');
    if (playerSys) {
      playerSys.instance = player;
      playerSys.initialized = true;
    }

    if (this.cameraSystem) {
      this.cameraSystem.setTarget(player.getEntity());
      this.cameraSystem.setMode('thirdPerson');
    }

    if (this.animationSystem) {
      this.animationSystem.registerEntity(player.getEntity(), 'idle');
    }

    return player;
  }

  public createEnemySystem(player: PlayerShip): EnemySystem | null {
    if (!this.engine) return null;

    const enemySystem = new EnemySystem(this.engine, player);
    this.enemySystem = enemySystem;

    const enemySys = this.systems.get('enemy');
    if (enemySys) {
      enemySys.instance = enemySystem;
      enemySys.initialized = true;
    }

    return enemySystem;
  }

  public createWeaponSystem(player: PlayerShip): WeaponSystem | null {
    if (!this.engine) return null;

    const weaponSystem = new WeaponSystem(this.engine);
    weaponSystem.setPlayer(player);

    // 集成 Lua 技能系统
    if (this.luaSkillBridge) {
      weaponSystem.setLuaSkillBridge(this.luaSkillBridge);
    }

    this.weaponSystem = weaponSystem;

    const weaponSys = this.systems.get('weapon');
    if (weaponSys) {
      weaponSys.instance = weaponSystem;
      weaponSys.initialized = true;
    }

    return weaponSystem;
  }

  public createSkillSystem(player: PlayerShip): SkillSystem | null {
    if (!this.engine) return null;

    const skillSystem = new SkillSystem(player, this.engine);
    this.skillSystem = skillSystem;

    const skillSys = this.systems.get('skill');
    if (skillSys) {
      skillSys.instance = skillSystem;
      skillSys.initialized = true;
    }

    return skillSystem;
  }

  public createPowerupSpawner(): PowerupSpawner | null {
    if (!this.engine) return null;

    const powerupSpawner = new PowerupSpawner(this.engine);
    this.powerupSpawner = powerupSpawner;

    const powerupSys = this.systems.get('powerup');
    if (powerupSys) {
      powerupSys.instance = powerupSpawner;
      powerupSys.initialized = true;
    }

    return powerupSpawner;
  }

  private setupEventListeners(): void {
    if (!this.inputSystem || !this.eventSystem) return;

    this.inputSystem.on('pause', () => {
      this.togglePause();
    });

    this.inputSystem.on('showStats', () => {
      this.debugSystem?.toggleOverlay();
    });

    this.eventSystem.on('player_damage', () => {
      this.cameraSystem?.shake(0.5, 0.3);
      AudioManager.playSound('playerHit');
    });

    this.eventSystem.on('enemy_death', (event) => {
      AudioManager.playSound('enemyExplosion');
      const data = event.data as { type: string; score: number; isBoss?: boolean; isElite?: boolean };
      if (this.gameplayManagerInstance && this.gameplayManagerInstance.isRunning()) {
        this.gameplayManagerInstance.onEnemyKilled(
          data.type,
          data.isBoss || false,
          data.isElite || false,
        );
      }
    });

    this.eventSystem.on('powerup_collect', (event) => {
      AudioManager.playSound('powerup');
      const data = event.data as { type: string };
      if (this.gameplayManagerInstance && this.gameplayManagerInstance.isRunning()) {
        this.gameplayManagerInstance.applyPowerup(data.type as Parameters<typeof gameplayManager.applyPowerup>[0]);
      }
    });

    this.eventSystem.on('wave_complete', (_e) => {
      AudioManager.playSound('waveComplete');
    });

    this.eventSystem.on('game_pause', () => {
      AudioManager.pauseMusic();
      this.gameplayManagerInstance?.pause();
    });

    this.eventSystem.on('game_resume', () => {
      AudioManager.resumeMusic();
      this.gameplayManagerInstance?.resume();
    });

    this.eventSystem.on('game_over', () => {
      AudioManager.playSound('playerExplosion');
      AudioManager.playMusic('defeatMusic');
      this.gameplayManagerInstance?.gameOver();
    });

    this.eventSystem.on('game_win', () => {
      AudioManager.playMusic('victoryMusic');
    });

    if (this.gameplayManagerInstance) {
      const gameplayEvents: GameplayEvents = {
        onWaveStart: (waveNumber) => {
          this.eventSystem?.emitWaveStart(waveNumber, 0);
        },
        onWaveComplete: (waveNumber, score) => {
          this.eventSystem?.emitWaveComplete(waveNumber, 0);
          this.eventSystem?.emitScoreUpdate(score, 0);
        },
        onEnemyKilled: (_enemyType, score) => {
          this.eventSystem?.emitScoreUpdate(this.gameplayManagerInstance?.getScore() || 0, score);
        },
        onComboUpdate: (_combo, _maxCombo) => {
        },
        onRankChange: (_newRank, _oldRank) => {
        },
        onPowerupApplied: (_powerupType) => {
        },
        onPowerupExpired: (_powerupType) => {
        },
        onGameOver: (_finalScore, _rank) => {
        },
      };
      this.gameplayManagerInstance.setEventCallbacks(gameplayEvents);
    }
  }

  public start(): void {
    if (!this.isInitialized || !this.engine) return;

    this.isRunning = true;
    this.state = 'playing';
    AudioManager.playMusic('gameMusic');

    if (this.gameplayManagerInstance) {
      this.gameplayManagerInstance.startGame('normal');
      this.gameplayManagerInstance.startWave(1);
    }

    this.engine.setUpdateCallback((dt: number) => {
      this.update(dt);
    });

    this.engine.start();
  }

  public stop(): void {
    this.isRunning = false;
  }

  private update(dt: number): void {
    if (!this.isRunning) return;

    const frameStart = performance.now();

    this.systems.forEach((sys) => {
      if (sys.enabled && sys.initialized && sys.update) {
        const name = sys.instance?.constructor?.name || 'unknown';
        const start = performance.now();
        sys.update(dt);
        const elapsed = performance.now() - start;

        if (name === 'ComputePhysics') {
          this.performanceMonitor?.recordPhysicsTime(elapsed);
        } else if (name === 'AINPCController') {
          this.performanceMonitor?.recordAiTime(elapsed);
        }
      }
    });

    const frameEnd = performance.now();
    this.performanceMonitor?.recordFrameTime(frameEnd - frameStart);

    if (this.computePhysics) {
      this.performanceMonitor?.setActiveParticles(this.computePhysics.getActiveParticles().length);
    }
    if (this.aiNPCController) {
      this.performanceMonitor?.setActiveNPCs(this.aiNPCController.getAllNPCStates().length);
    }

    this.frameCount++;
    const now = Date.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    if (this.updateCallback) {
      this.updateCallback(dt);
    }
  }

  private updateAI(dt: number): void {
    if (!this.aiNPCController || !this.player) return;

    const playerPositions = new Map<string, pc.Vec3>();
    playerPositions.set('player', this.player.getPosition());

    const actions = this.aiNPCController.update(dt, playerPositions);

    actions.forEach((action, npcId) => {
      this.executeNPCAction(npcId, action);
    });
  }

  private executeNPCAction(npcId: string, action: { type: string; direction?: pc.Vec3; target?: pc.Vec3; speed?: number }): void {
    const enemySystem = this.getEnemySystem();
    if (!enemySystem) return;

    const enemies = enemySystem.getEnemies();
    const npcEnemy = enemies.find((e) => {
      const entity = e.getEntity();
      const entityTyped = entity as unknown as { id?: string };
      return entity.name === npcId || entityTyped.id === npcId;
    });

    if (!npcEnemy) return;

    const entity = npcEnemy.getEntity();
    const position = entity.getPosition();

    switch (action.type) {
      case 'move':
        if (action.direction) {
          const newPos = new pc.Vec3().copy(position).add(action.direction.scale(action.speed || 1.5));
          entity.setPosition(newPos);
        }
        break;
      case 'chase':
        if (action.target) {
          const direction = new pc.Vec3().sub2(action.target, position).normalize();
          const newPos = new pc.Vec3().copy(position).add(direction.scale(3));
          entity.setPosition(newPos);
        }
        break;
      case 'attack':
        break;
      case 'strafe':
        if (action.direction) {
          const newPos = new pc.Vec3().copy(position).add(action.direction.scale(action.speed || 2));
          entity.setPosition(newPos);
        }
        break;
      case 'flee':
        if (action.direction) {
          const newPos = new pc.Vec3().copy(position).add(action.direction.scale(action.speed || 4));
          entity.setPosition(newPos);
        }
        break;
    }
  }

  public setUpdateCallback(callback: (dt: number) => void): void {
    this.updateCallback = callback;
  }

  public setGameState(state: GameState): void {
    this.state = state;

    switch (state) {
      case 'playing':
        this.isRunning = true;
        this.eventSystem?.emitGameResume();
        break;
      case 'paused':
        this.isRunning = false;
        this.eventSystem?.emitGamePause();
        break;
      case 'game_over':
        this.isRunning = false;
        this.eventSystem?.emitGameOver();
        break;
      case 'level_complete':
        this.isRunning = false;
        this.eventSystem?.emitLevelComplete(0);
        break;
    }
  }

  public getGameState(): GameState {
    return this.state;
  }

  public togglePause(): void {
    if (this.state === 'playing') {
      this.setGameState('paused');
    } else if (this.state === 'paused') {
      this.setGameState('playing');
    }
  }

  public getStats(): GameStats {
    const app = this.engine?.getApp();
    const stats = app?.stats;
    return {
      fps: this.fps,
      frameTime: this.frameTime,
      entities: this.engine ? this.countEntities(this.engine.getScene().root as unknown as pc.Entity) : 0,
      drawCalls: stats ? (stats.drawCalls.forward + stats.drawCalls.depth + stats.drawCalls.shadow + stats.drawCalls.immediate + stats.drawCalls.misc) : 0,
      triangles: 0,
      memoryUsage: (() => {
        if (!window.performance) return 0;
        const perf = window.performance as unknown as { memory?: { usedJSHeapSize: number } };
        if (!perf.memory) return 0;
        return perf.memory.usedJSHeapSize / 1024 / 1024;
      })(),
      players: this.multiplayerSystem ? this.multiplayerSystem.getPlayers().length : 1,
      enemies: this.enemySystem ? this.enemySystem.getEnemies().length : 0,
      projectiles: this.weaponSystem ? this.weaponSystem.getProjectileCount() : 0,
    };
  }

  private countEntities(entity: pc.Entity): number {
    let count = 1;
    const children = entity.children as unknown as pc.Entity[];
    children.forEach((child) => {
      count += this.countEntities(child);
    });
    return count;
  }

  public getSystemInfo(): SystemInfo[] {
    return Array.from(this.systems.entries()).map(([name, sys]) => ({
      name,
      enabled: sys.enabled,
      initialized: sys.initialized,
    }));
  }

  public enableSystem(name: string): boolean {
    const sys = this.systems.get(name);
    if (!sys) return false;
    sys.enabled = true;
    return true;
  }

  public disableSystem(name: string): boolean {
    const sys = this.systems.get(name);
    if (!sys) return false;
    sys.enabled = false;
    return true;
  }

  public isSystemEnabled(name: string): boolean {
    const sys = this.systems.get(name);
    return sys?.enabled || false;
  }

  public isSystemInitialized(name: string): boolean {
    const sys = this.systems.get(name);
    return sys?.initialized || false;
  }

  public getPlayer(): PlayerShip | null {
    return this.player;
  }

  public getEngine(): PlayCanvasGameEngine | null {
    return this.engine;
  }

  public getInputSystem(): InputSystem | null {
    return this.inputSystem;
  }

  public getEventSystem(): EventSystem | null {
    return this.eventSystem;
  }

  public getCameraSystem(): CameraSystem | null {
    return this.cameraSystem;
  }

  public getAnimationSystem(): AnimationSystem | null {
    return this.animationSystem;
  }

  public getDebugSystem(): DebugSystem | null {
    return this.debugSystem;
  }

  public getEnemySystem(): EnemySystem | null {
    return this.enemySystem;
  }

  public getWeaponSystem(): WeaponSystem | null {
    return this.weaponSystem;
  }

  public getSkillSystem(): SkillSystem | null {
    return this.skillSystem;
  }

  public getAchievementSystem(): typeof achievementSystem {
    return achievementSystem;
  }

  public getMultiplayerSystem(): MultiplayerSystem | null {
    return this.multiplayerSystem;
  }

  public getLevelEditor(): LevelEditor | null {
    return this.levelEditor;
  }

  public getLuaSkillBridge(): LuaSkillBridge | null {
    return this.luaSkillBridge;
  }

  public getComputePhysics(): ComputePhysics | null {
    return this.computePhysics;
  }

  public getAINPCController(): AINPCController | null {
    return this.aiNPCController;
  }

  public getPerformanceMonitor(): PerformanceMonitor | null {
    return this.performanceMonitor;
  }

  public getGameplayManager(): typeof gameplayManager | null {
    return this.gameplayManagerInstance;
  }

  public enableLevelEditor(): void {
    const editorSys = this.systems.get('levelEditor');
    if (editorSys && this.engine) {
      this.levelEditor = editorSys.instance as LevelEditor;
      this.levelEditor.setApp(this.engine.getApp());
      this.levelEditor.enable();
      editorSys.enabled = true;
      editorSys.initialized = true;
      this.state = 'menu';
    }
  }

  public disableLevelEditor(): void {
    const editorSys = this.systems.get('levelEditor');
    if (editorSys) {
      this.levelEditor?.disable();
      editorSys.enabled = false;
    }
  }

  public shutdown(): void {
    this.isRunning = false;
    this.isInitialized = false;

    this.systems.forEach((sys) => {
      if (sys.destroy) {
        sys.destroy();
      }
    });

    this.systems.clear();

    AudioManager.stopMusic();

    this.player = null;
    this.enemySystem = null;
    this.weaponSystem = null;
    this.skillSystem = null;
    this.powerupSpawner = null;
    this.inputSystem = null;
    this.eventSystem = null;
    this.cameraSystem = null;
    this.animationSystem = null;
    this.resourceManager = null;
    this.instancedRenderer = null;
    this.cloudSaveSystem = null;
    this.debugSystem = null;
    this.levelEditor = null;
    this.multiplayerSystem = null;
    this.luaSkillBridge = null;
    this.computePhysics = null;
    this.aiNPCController = null;
    this.engine = null;
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}
