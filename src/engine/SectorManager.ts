import { ComputePCG } from './ComputePCG';
import { SectorConfig, SectorGenerator, SectorGenerationResult } from './SectorGenerator';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { AsteroidSystem } from './AsteroidSystem';
import { ResourceSystem } from './ResourceSystem';
import { NPCManager, NPCBehavior } from './NPCManager';
import { StoryMissionManager } from './StoryMissionManager';
import { VisualEffectSystem } from './VisualEffectSystem';
import { JumpGate } from './JumpGate';
import { EnemyType } from './Enemy';
import * as pc from 'playcanvas';
import { useGameStore } from '../store/useGameStore';
import { ProceduralModelGenerator } from './ProceduralModelGenerator';
import { ProceduralMissionGenerator } from './ProceduralMissionGenerator';
import { ModelAssetProvider } from './ModelAssetProvider';
import { AncientRuins } from './AncientRuins';

/**
 * 星区管理器。
 * 负责星区状态维护、跃迁切换以及派系势力同步。
 */
export class SectorManager {
  private static instance: SectorManager;
  private currentSector: SectorGenerationResult | null = null;
  private generator: SectorGenerator;
  private sectorCache: Map<string, SectorGenerationResult> = new Map();

  private engine: PlayCanvasGameEngine | null = null;
  private player: PlayerShip | null = null;
  private asteroidSystem: AsteroidSystem | null = null;
  private resourceSystem: ResourceSystem | null = null;
  private npcManager: NPCManager | null = null;
  private storyManager: StoryMissionManager | null = null;
  private vfxSystem: VisualEffectSystem | null = null;
  private activeJumpGates: JumpGate[] = [];
  private ancientRuins: AncientRuins[] = [];
  private sectorEntities: pc.Entity[] = [];
  private playerInNebula: boolean = false;
  private computePCG: ComputePCG | null = null;
  private ready: boolean = false;

  private constructor() {
    this.generator = new SectorGenerator();
  }

  public static getInstance(): SectorManager {
    if (!SectorManager.instance) {
      SectorManager.instance = new SectorManager();
    }
    return SectorManager.instance;
  }

  public isInitialized(): boolean {
    const hasEngine = this.engine !== null;
    const isSectorReady = this.ready;
    const hasGalaxyMgr = !!this.engine?.getPlugin('GalaxyManager');

    if (!isSectorReady || !hasGalaxyMgr) {
      // 2026 Tech: 诊断日志，帮助排查初始化挂点
      if (Math.random() > 0.95) {
        // 降低日志频率
        console.log(
          `[SectorManager] Waiting for readiness: engine=${hasEngine}, sectorReady=${isSectorReady}, galaxyMgr=${hasGalaxyMgr}`,
        );
      }
    }

    // 只要引擎和星区就绪即可，GalaxyManager 插件失败不应阻塞整个星区进入流程
    return hasEngine && isSectorReady;
  }

  /**
   * 初始化管理器，绑定引擎与玩家。
   */
  public init(
    engine: PlayCanvasGameEngine,
    player: PlayerShip,
    asteroidSystem: AsteroidSystem,
    resourceSystem: ResourceSystem | null,
    npcManager: NPCManager,
    storyManager: StoryMissionManager,
    vfxSystem: VisualEffectSystem | null,
  ): void {
    this.engine = engine;
    this.player = player;
    this.asteroidSystem = asteroidSystem;
    this.resourceSystem = resourceSystem;
    this.npcManager = npcManager;
    this.storyManager = storyManager;
    this.vfxSystem = vfxSystem;
    this.computePCG = new ComputePCG(engine.getApp());
    this.ready = false; // 重置就绪状态，等待 enterInitialSector
  }

  /**
   * 2026 Tech: 重置管理器状态，通常在引擎销毁时调用。
   */
  public reset(): void {
    this.engine = null;
    this.player = null;
    this.asteroidSystem = null;
    this.resourceSystem = null;
    this.npcManager = null;
    this.storyManager = null;
    this.vfxSystem = null;
    this.computePCG = null;
    this.ready = false;
    this.currentSector = null;
    this.sectorCache.clear();
    this.sectorEntities = [];
    this.activeJumpGates = [];
    this.ancientRuins = [];
  }

  /**
   * 初始化并进入初始星区。
   */
  public async enterInitialSector(): Promise<SectorGenerationResult> {
    const initialConfig: SectorConfig = {
      id: 'solar-system-alpha',
      name: '始源星系 Alpha',
      seed: 'genesis-seed-2026',
      type: 'neutral',
      visuals: {
        skybox: 'env-space-01',
        envHdri: 'env-space-01',
        nebulaColor: [0.2, 0.4, 0.8],
        fogDensity: 0.002,
      },
      difficulty: 1,
      factions: ['trade_union'],
    };

    const result = await this.loadSector(initialConfig);
    this.ready = true;
    return result;
  }

  /**
   * 加载或从缓存获取星区。
   */
  public async loadSector(config: SectorConfig): Promise<SectorGenerationResult> {
    if (this.sectorCache.has(config.id)) {
      this.currentSector = this.sectorCache.get(config.id)!;
    } else {
      console.log(`[SectorManager] Generating new sector: ${config.name} (${config.id})`);
      const result = this.generator.generate(config);
      this.sectorCache.set(config.id, result);
      this.currentSector = result;
    }

    // 这里未来会触发 PlayCanvas 场景的重新构建
    try {
      await Promise.race([
        this.applySectorToEngine(this.currentSector),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('applySectorToEngine timeout')), 15000),
        ),
      ]);
    } catch (err) {
      console.error(`[SectorManager] Failed to apply sector ${config.id}:`, err);
      // 虽然失败了，但我们尝试标记为 ready，否则整个 UI 会卡死
      this.ready = true;
      throw err;
    }

    return this.currentSector;
  }

  /**
   * 执行跃迁。
   */
  public async jumpTo(_targetSectorId: string): Promise<void> {
    // 2026 Tech: 跃迁门现在触发星图选择，而非直接跳转
    useGameStore.getState().setStarMapVisible(true);
    useGameStore.getState().setGamePaused(true);
  }

  /**
   * 2026 Tech: 真正的跨星区跃迁实现，由 StarMap 触发。
   */
  public async jumpToSector(sectorId: string): Promise<void> {
    if (!this.engine) {
      console.warn('[SectorManager] Jump failed: Engine not initialized.');
      return;
    }

    console.log(`[SectorManager] Initiating Jump to ${sectorId}...`);
    useGameStore.getState().setLoading(true);
    useGameStore.getState().setLoadingProgress(0);

    try {
      // 1. 获取银河系数据
      const galaxyManager = this.engine.getPlugin<any>('GalaxyManager');
      const starNode = galaxyManager?.getStarNode(sectorId);

      if (!starNode) {
        throw new Error(`Invalid sector ID: ${sectorId}`);
      }

      // 2. 准备视觉特效 (扭曲)
      if (this.vfxSystem) {
        this.vfxSystem.enableJumpDistortion();
        this.vfxSystem.setJumpDistortionAmount(2.0);
      }

      // 3. 生成或加载目标星区配置
      const nextConfig: SectorConfig = {
        id: starNode.id,
        name: starNode.name,
        seed: starNode.id,
        type: starNode.type,
        visuals: {
          skybox: 'env-debris-01',
          envHdri: 'env-debris-01',
          nebulaColor: [0.5, 0.5, 0.5], // 默认颜色，具体由 loadSector 处理
          fogDensity: starNode.type === 'anomaly' ? 0.02 : 0.005,
        },
        difficulty: starNode.difficulty,
        factions: [starNode.dominantFactionId],
      };

      // 4. 执行加载流
      await this.loadSector(nextConfig);

      // 5. 2026 Tech: 重置玩家位置到星区原点，避免因坐标漂移导致看不到物体
      if (this.player) {
        this.player.getEntity().setPosition(0, 0, 0);

        // 强制重置相机位置，防止相机留在上个星区的远端导致黑屏
        // 2026 Tech: 改为从 app 显式读取挂载好的 _cameraSystem
        const cameraSystem = (this.engine.getApp() as any)['cameraSystem'];
        if (cameraSystem) {
          console.log('[SectorManager] Resetting camera target and position to player ship');
          cameraSystem.setTarget(this.player.getEntity());
          const camEntity = this.engine.getCamera();
          if (camEntity) {
            // 设置一个合理的初始位置，防止 lerp 追随太慢
            const offset = cameraSystem.getThirdPersonOffset
              ? cameraSystem.getThirdPersonOffset()
              : new pc.Vec3(0, 8, 15);
            const targetPos = this.player.getPosition();
            camEntity.setPosition(targetPos.x, targetPos.y + offset.y, targetPos.z + offset.z);
            camEntity.lookAt(targetPos);
          }
        } else {
          console.warn('[SectorManager] Camera system not found on app, camera might be lost!');
        }
      }

      // 6. 更新银河位置
      galaxyManager?.setCurrentSector(sectorId);

      // 6. 恢复动画
      if (this.vfxSystem) {
        const duration = 0.8;
        const start = Date.now();
        const tick = () => {
          const elapsed = (Date.now() - start) / 1000;
          const t = Math.min(elapsed / duration, 1.0);
          this.vfxSystem?.setJumpDistortionAmount((1.0 - t) * 2.0);
          if (t < 1.0) requestAnimationFrame(tick);
          else this.vfxSystem?.disableJumpDistortion();
        };
        tick();
      }

      console.log(`[SectorManager] Jump to ${sectorId} successful.`);
    } catch (error) {
      console.error(`[SectorManager] Jump to ${sectorId} failed:`, error);
      // 弹出错误通知 (如果 Store 支持)
      useGameStore
        .getState()
        .setError(`跃迁失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      // 2026 Tech: 确保清理视觉特效，防止卡在黑屏状态
      if (this.vfxSystem) {
        this.vfxSystem.setJumpDistortionAmount(0);
        this.vfxSystem.disableJumpDistortion();
      }
      useGameStore.getState().setLoading(false);
      useGameStore.getState().setGamePaused(false);
    }
  }

  private generateNextSectorConfig(id: string): SectorConfig {
    // 2026 Tech: 使用星区 ID 作为种子，确保生成的一致性 (LCG 算法)
    const seedInt = parseInt(id.replace(/\D/g, '')) || 0;
    const rng = (s: number) => {
      let state = s || 1;
      return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
      };
    };
    const random = rng(seedInt + 20261025);

    const types: SectorConfig['type'][] = ['neutral', 'hostile', 'trade', 'resource'];
    const type = types[Math.floor(random() * types.length)];

    return {
      id,
      name: `星区 ${id.split('-').pop()}`,
      seed: `seed-${id}`,
      type,
      visuals: {
        skybox: 'env-debris-01',
        envHdri: 'env-debris-01',
        nebulaColor: [random(), random(), random()],
        fogDensity: 0.005,
      },
      difficulty: (this.currentSector?.config.difficulty ?? 1) + 0.5,
      factions: ['scavengers'],
    };
  }

  private async applySectorToEngine(result: SectorGenerationResult) {
    if (!this.engine || !this.player) {
      console.warn(
        '[SectorManager] Engine or Player not initialized. Skipping visual application.',
      );
      return;
    }

    try {
      console.log(`[SectorManager] Applying sector: ${result.config.name} at ${Date.now()}`);
      console.log(`[SectorManager] Objects to create: ${result.objects.length}`);

      // 1. 设置视觉环境
      const { visuals } = result.config;
      console.log(
        `[SectorManager] Setting fog: color=${visuals.nebulaColor}, density=${visuals.fogDensity}`,
      );
      this.engine.enableFog(
        new pc.Color(visuals.nebulaColor[0], visuals.nebulaColor[1], visuals.nebulaColor[2]),
        visuals.fogDensity,
      );

      // 加载环境 HDR
      console.log(`[SectorManager] Loading environment lighting: ${visuals.envHdri}`);
      void this.engine.loadEnvironmentLighting(visuals.envHdri);

      // 2. 清理旧星区实体
      console.log('[SectorManager] Cleaning up old sector entities...');
      if (this.npcManager) this.npcManager.clear();
      const bhSystem = (this.engine.getApp() as any)['blackHoleSystem'];
      bhSystem?.clear();
      this.ancientRuins = [];

      this.activeJumpGates.forEach((gate) => gate.destroy());
      this.activeJumpGates = [];

      // 清理戴森云系统
      const dysonSystem = (this.engine.getApp() as any)[
        'dysonSwarmSystem'
      ] as import('./DysonSwarmSystem').DysonSwarmSystem;
      dysonSystem?.clear();

      this.sectorEntities.forEach((entity) => entity.destroy());
      this.sectorEntities = [];

      // 3. 生成跃迁门
      result.jumpGates.forEach((gateDef) => {
        const gate = new JumpGate({
          engine: this.engine!,
          player: this.player!,
          position: new pc.Vec3(gateDef.position[0], gateDef.position[1], gateDef.position[2]),
          targetSectorId: gateDef.targetSectorId,
        });
        this.activeJumpGates.push(gate);
      });

      // 4. 生成星区物体 (小行星、空间站等)
      const modelGen = new ProceduralModelGenerator();
      const newAsteroids: pc.Entity[] = [];
      const newResources: pc.Entity[] = [];

      // 2026 Tech: 如果支持 WebGPU，生成超大规模陨石群
      if (this.computePCG && result.config.difficulty > 2) {
        try {
          const massiveCount = 10000;
          const seed = Math.random() * 1000;
          const data = await this.computePCG.generateInstances(massiveCount, seed, 60, 250, 2.0);

          const batchId = await this.engine.getAsteroidBatch('structures/meteor');
          if (batchId && this.engine.getInstancedRenderer()) {
            const renderer = this.engine.getInstancedRenderer()!;
            renderer.clearBatch(batchId);

            for (let i = 0; i < massiveCount; i++) {
              const offset = i * 8;
              const pos = new pc.Vec3(data[offset + 0], data[offset + 1], data[offset + 2]);
              const scale = data[offset + 3];
              const quat = new pc.Quat(
                data[offset + 4],
                data[offset + 5],
                data[offset + 6],
                data[offset + 7],
              );
              renderer.addInstance(batchId, {
                position: pos,
                rotation: quat.getEulerAngles(),
                scale: new pc.Vec3(scale, scale, scale),
                color: new pc.Color(1, 1, 1),
                visible: true,
              });
            }
          }
        } catch (pcgError) {
          console.warn('[SectorManager] GPU PCG failed, falling back:', pcgError);
        }
      }

      for (const obj of result.objects) {
        const holder = new pc.Entity(obj.type);
        holder.setPosition(obj.position[0], obj.position[1], obj.position[2]);
        const quat = new pc.Quat(
          obj.rotation[0],
          obj.rotation[1],
          obj.rotation[2],
          obj.rotation[3],
        );
        holder.setLocalRotation(quat);
        holder.setLocalScale(obj.scale, obj.scale, obj.scale);

        if (obj.type === 'asteroid') {
          (holder as any).userData = {
            rotSpeed: new pc.Vec3(Math.random() * 0.2, Math.random() * 0.2, Math.random() * 0.2),
          };

          // 2026 Tech: 为小行星注入可采矿元数据
          (holder as any).miningMeta = {
            health: 100,
            type: Math.random() > 0.8 ? 'gold' : 'iron',
            yield: 20 + Math.random() * 80,
          };
          const placeholder = modelGen.createStructure('asteroid', { scale: 1.0 });
          holder.addChild(placeholder);
          newAsteroids.push(holder);

          // 异步升级材质
          this.engine.getModelAssets().upgradeStructure(holder, placeholder, 'asteroid', {
            scaleMultiplier: 1.0 * ModelAssetProvider.structureScale(),
            onReplaced: (instance, assetPath) => {
              if (this.engine) {
                const materialSet = PlayCanvasGameEngine.rockSetForAsteroid(assetPath);
                this.engine.applyPbrMaterialWhenReady(instance, materialSet);
              }
            },
          });
        } else if (obj.type === 'nebula') {
          const nebulaColor = result.config.visuals.nebulaColor;
          const color = new pc.Color(nebulaColor[0], nebulaColor[1], nebulaColor[2]);
          const nebulaEntity = this.engine.createNebula(
            new pc.Vec3(...obj.position),
            obj.scale,
            color,
          );
          this.sectorEntities.push(nebulaEntity);
          holder.destroy();
          continue;
        } else if (obj.type === 'space_station') {
          const placeholder = modelGen.createStructure('station', { scale: 1.0 });
          holder.addChild(placeholder);
          this.engine.getModelAssets().upgradeStructure(holder, placeholder, 'station', {
            scaleMultiplier: 1.0 * ModelAssetProvider.structureScale(),
            onReplaced: (instance) => {
              this.engine?.applyPbrMaterialWhenReady(instance, 'metalPlates');
            },
          });
        } else if (obj.type === 'resource_crystal') {
          const placeholder = modelGen.createStructure('crystal', { scale: 0.5 });
          holder.addChild(placeholder);

          // 注入数据供 ResourceSystem 使用
          (holder as any).userData = obj.data;
          newResources.push(holder);

          // 水晶使用自发光材质
          this.engine.getModelAssets().upgradeStructure(holder, placeholder, 'crystal', {
            scaleMultiplier: 0.5 * ModelAssetProvider.structureScale(),
            onReplaced: (instance) => {
              const color = obj.data?.resourceType === 'plasma' ? [0.2, 0.8, 1.0] : [0.8, 0.5, 0.2];
              this.engine?.applyPbrMaterialWhenReady(
                instance,
                'metal',
                color as [number, number, number],
              );
            },
          });
        } else if (obj.type === 'npc_squad') {
          if (this.npcManager) {
            this.npcManager.spawnSquad(
              obj.data.factionId,
              new pc.Vec3(...obj.position),
              obj.data.memberCount,
            );
          }
          holder.destroy();
          continue;
        } else if (obj.type === 'npc_ship') {
          // NPC 船只由 NPCManager 接管，不需要在这里创建实体
          if (this.npcManager) {
            this.npcManager.spawnNPC(obj.data.factionId, new pc.Vec3(...obj.position));
          }
          holder.destroy();
          continue;
        } else if (obj.type === 'anomaly') {
          const placeholder = modelGen.createStructure('anomaly', { scale: 1.0 });
          holder.addChild(placeholder);

          // 注入数据
          (holder as any).userData = obj.data;

          // 异常点视觉效果：特殊的自发光与扰动
          this.engine.getModelAssets().upgradeStructure(holder, placeholder, 'anomaly', {
            scaleMultiplier: 2.0 * ModelAssetProvider.structureScale(),
            onReplaced: (instance) => {
              const color =
                obj.data?.anomalyType === 'wormhole_fragment' ? [0.6, 0.2, 1.0] : [1.0, 0.2, 0.2];
              this.engine?.applyPbrMaterialWhenReady(
                instance,
                'metal',
                color as [number, number, number],
              );
            },
          });
        } else if (obj.type === 'black_hole') {
          const bh = (this.engine.getApp() as any)[
            'blackHoleSystem'
          ] as import('./BlackHoleSystem').BlackHoleSystem;
          if (bh) {
            bh.registerBlackHole(holder);
          }
        } else if (obj.type === 'ancient_ruins') {
          const ruins = new AncientRuins(
            this.engine.getApp(),
            this.player!,
            new pc.Vec3(...obj.position),
          );
          this.ancientRuins.push(ruins);
          // 这里 ruins.entity 已经包含了结构，所以不需要另外创建 placeholder
          this.engine.addToScene(ruins.entity);
          holder.destroy();
          continue;
        } else if (obj.type === 'star') {
          // 2026 Tech: 生成恒星并注册到戴森云系统
          const starColor = new pc.Color(obj.data.color[0], obj.data.color[1], obj.data.color[2]);
          const star = this.engine.createSphere(
            'star',
            obj.scale,
            this.engine.createMaterial('starMat', {
              diffuse: new pc.Color(0, 0, 0),
              emissive: starColor,
            }),
          );
          star.setPosition(obj.position[0], obj.position[1], obj.position[2]);

          // 添加日冕/光晕效果
          this.engine.addParticleSystem(star, {
            numParticles: 20,
            lifetime: 1.0,
            rate: 5,
            initialVelocity: 0,
            scaleGraph: new pc.Curve([obj.scale * 1.2, obj.scale * 1.5]),
            colorGraph: new pc.CurveSet([
              [starColor.r, starColor.g, starColor.b],
              [starColor.r, starColor.g, starColor.b, 0],
            ]),
            blendType: pc.BLEND_ADDITIVE,
          });

          const dyson = (this.engine.getApp() as any)[
            'dysonSwarmSystem'
          ] as import('./DysonSwarmSystem').DysonSwarmSystem;
          if (dyson) {
            dyson.registerStar(star);
          }

          this.sectorEntities.push(star);
          holder.destroy();
          continue;
        }

        this.engine.addToScene(holder);
        this.sectorEntities.push(holder);
      }

      // 5. 同步小行星到碰撞系统
      if (this.asteroidSystem) {
        this.asteroidSystem.setAsteroids(newAsteroids);
      }

      if (this.resourceSystem) {
        this.resourceSystem.setResources(newResources);
      }

      // 2026 Tech: 自动生成星区任务
      this.triggerSectorMission(result.config);

      console.log(
        `[SectorManager] Generated ${this.sectorEntities.length} entities and ${newAsteroids.length} asteroids.`,
      );
      console.log(`[SectorManager] applySectorToEngine COMPLETED at ${Date.now()}`);
    } catch (err) {
      console.error('[SectorManager] Error applying sector to engine:', err);
    }
  }

  private triggerSectorMission(config: SectorConfig): void {
    if (!this.engine) return;
    const factionManager = (this.engine.getApp() as any)[
      'factionManager'
    ] as import('./FactionManager').FactionManager;
    if (!factionManager) return;

    // 2026 Tech: 检查该星区是否存在战略事件（如正在进行的侵略）
    const galaxyManager = (this.engine?.getApp() as any)?.[
      'galaxyManager'
    ] as import('./GalaxyManager').GalaxyManager;
    const strategicEvents = galaxyManager?.getEventsForSector(config.id) || [];

    const mission = ProceduralMissionGenerator.generateMission(
      config,
      factionManager,
      strategicEvents,
    );

    if (strategicEvents.length > 0) {
      const event = strategicEvents[0];
      mission.name = `[战区] ${mission.name}`;
      // 如果任务生成器没处理描述，这里做兜底补充
      if (!mission.description.includes('警告')) {
        mission.description = `警告：该星区正遭受 ${event.factionId} 的${event.type === 'invasion' ? '全面入侵' : '劫掠'}！${mission.description}`;
      }
    }

    // 根据任务类型生成特定 NPC
    this.spawnMissionContext(mission);

    // 提示玩家
    useGameStore.getState().setActiveDialogue({
      id: `mission_offer_${mission.id}`,
      name: '任务简报',
      participants: ['operator', 'player'],
      trigger: { type: 'auto' },
      lines: [
        {
          speaker: 'operator',
          text: `侦测到新的星区动态：${mission.name}。${mission.description}，请知悉。`,
          emotion: 'serious',
        },
      ],
    });

    // 实际将任务加入追踪
    if (this.storyManager) {
      this.storyManager.addProceduralMission(mission);
    }

    console.log(`[SectorManager] Dynamic Mission Offered: ${mission.name}`);
  }

  /**
   * 2026 Tech: 为任务生成必要的环境 NPC
   */
  private spawnMissionContext(mission: import('./StoryMissionManager').Mission): void {
    if (!this.npcManager || !this.player) return;

    const playerPos = this.player.getPosition();
    const dominantFaction = mission.name.split('的')[0] || 'trade_union';

    switch (mission.category) {
      case 'escort':
        const merchantPos = playerPos.clone().add(new pc.Vec3(10, 0, 10));
        const merchant = this.npcManager.spawnNPC(dominantFaction as any, merchantPos);
        const destination = new pc.Vec3(0, 0, -200);
        merchant.setBehavior(NPCBehavior.ESCORT, destination);
        const ambushPos = destination.clone().add(new pc.Vec3((Math.random() - 0.5) * 50, 0, 50));
        this.npcManager.spawnSquad('scavengers', ambushPos, 3);
        break;

      case 'destroy':
        if (mission.objectives[0].target === 'outpost_core') {
          const outpostPos = new pc.Vec3(0, 0, -150);
          const enemySystem = ((this.engine as any).getApp() as any)?.['enemySystem'] as
            import('./EnemySystem').EnemySystem | null;
          if (enemySystem) {
            enemySystem.spawnStaticTarget(EnemyType.STATIC_OUTPOST, outpostPos);
          }
          this.npcManager.spawnSquad(
            dominantFaction as any,
            outpostPos.clone().add(new pc.Vec3(20, 0, 0)),
            2,
          );
        }
        break;

      case 'survive':
        if (mission.name.includes('赏金')) {
          const spawnPos = playerPos.clone().add(new pc.Vec3(0, 0, 100));
          this.npcManager.spawnSquad('scavengers', spawnPos, 4);
        }
        break;
    }
  }

  /**
   * 供 GameScene 每帧调用，更新跃迁门交互逻辑及星区动态事件。
   */
  public update(dt: number, controls?: import('./PlayerShip').PlayerControls): void {
    this.activeJumpGates.forEach((gate) => gate.update(dt));

    // 2. 2026 Tech: 靠近空间站自动贸易结算
    this.checkStationProximity(controls);

    // 3. 2026 Tech: 探测异常点
    this.checkAnomalyProximity();

    // 4. 2026 Tech: 星云环境影响
    this.checkNebulaEffects();

    // 5. 2026 Tech: 前线战争氛围 (Frontline Ambience)
    this.updateFrontlineAmbience(dt);

    // 2026 Tech: 远古遗迹更新
    this.ancientRuins.forEach((ruins) => ruins.update(dt));

    // 2026 Tech: 维度偏移事件触发
    this.checkDimensionalShiftTrigger(dt);
  }

  private checkDimensionalShiftTrigger(_dt: number): void {
    if (!this.currentSector || this.currentSector.config.type !== 'anomaly') return;

    const dsSystem = (this.engine?.getApp() as any)?.[
      'dimensionalShiftSystem'
    ] as import('./DimensionalShiftSystem').DimensionalShiftSystem;
    if (!dsSystem || dsSystem.isShiftActive()) return;

    // 极低概率触发
    if (Math.random() > 0.9995) {
      const types: ('gravity_invert' | 'light_slow' | 'reality_glitch')[] = [
        'gravity_invert',
        'light_slow',
        'reality_glitch',
      ];
      const randomType = types[Math.floor(Math.random() * types.length)];
      dsSystem.triggerShift(randomType, 15.0); // 持续 15 秒
    }
  }

  private updateFrontlineAmbience(_dt: number): void {
    if (!this.currentSector || !this.engine) return;

    // 检查当前星区是否有入侵事件
    const galaxyManager = (this.engine.getApp() as any)['galaxyManager'];
    if (!galaxyManager) return;

    const events = galaxyManager.getEventsForSector(this.currentSector.config.id);
    const isInvasion = events.some((e: any) => e.type === 'invasion');

    if (isInvasion) {
      // 在远景生成战场特效
      if (Math.random() > 0.98) {
        this.spawnDistantExplosion();
      }

      if (Math.random() > 0.95) {
        this.spawnDistantTracer();
      }
    }
  }

  private spawnDistantExplosion(): void {
    if (!this.engine) return;

    // 在天空盒附近随机位置生成
    const radius = 300 + Math.random() * 200;
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI;

    const pos = new pc.Vec3(
      radius * Math.cos(theta) * Math.cos(phi),
      radius * Math.sin(phi),
      radius * Math.sin(theta) * Math.cos(phi),
    );

    const explosion = new pc.Entity('distant_war_flash');
    explosion.setPosition(pos);

    // 2026 Tech: 远景次空间闪烁 (Sub-space Flash)
    this.engine.addParticleSystem(explosion, {
      numParticles: 1,
      lifetime: 0.5,
      rate: 0,
      initialVelocity: 0,
      colorGraph: new pc.CurveSet([[1, 0.4, 0.1]]),
      scaleGraph: new pc.Curve([20, 50, 0]),
      blendType: pc.BLEND_ADDITIVE,
    });

    this.engine.addToScene(explosion);
    setTimeout(() => explosion.destroy(), 600);
  }

  private spawnDistantTracer(): void {
    if (!this.engine) return;

    const radius = 400;
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI;

    const startPos = new pc.Vec3(
      radius * Math.cos(theta) * Math.cos(phi),
      radius * Math.sin(phi),
      radius * Math.sin(theta) * Math.cos(phi),
    );

    const direction = new pc.Vec3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    ).normalize();

    const tracer = new pc.Entity('distant_tracer');
    tracer.setPosition(startPos);
    tracer.addComponent('model', { type: 'cylinder' });
    tracer.setLocalScale(0.5, 20, 0.5);
    tracer.lookAt(startPos.clone().add(direction));

    const mat = new pc.StandardMaterial();
    mat.emissive.set(1, 0.2, 0.2);
    mat.useLighting = false;
    mat.opacity = 0.5;
    mat.blendType = pc.BLEND_ADDITIVE;
    mat.update();
    if (tracer.model) tracer.model.material = mat;

    this.engine.addToScene(tracer);

    // 快速移动并消失
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > 1000) {
        tracer.destroy();
        return;
      }

      tracer.setPosition(startPos.clone().add(direction.clone().scale(elapsed * 0.5)));
      requestAnimationFrame(animate);
    };
    animate();
  }

  private checkNebulaEffects(): void {
    if (!this.player || !this.engine) return;

    const playerPos = this.player.getPosition();
    let inNebula = false;

    for (const entity of this.sectorEntities) {
      if (entity.name === 'nebula') {
        const dist = entity.getPosition().distance(playerPos);
        // 如果距离小于半径（scale 是直径，所以 /2）
        if (dist < entity.getLocalScale().x * 0.5) {
          inNebula = true;
          break;
        }
      }
    }

    this.playerInNebula = inNebula;

    // 应用影响：增加雾效密度，减慢护盾回充
    // 2026 Tech: 修复 Fog API 兼容性 (PlayCanvas 2.x 使用 scene.fog.density)
    const targetFog = inNebula ? 0.01 : (this.currentSector?.config.visuals.fogDensity ?? 0.002);
    const scene = this.engine.getApp().scene;

    // 如果 scene.fog.density 是 NaN，重置为合理值
    const currentFog = isNaN(scene.fog.density) ? 0.002 : scene.fog.density;
    scene.fog.density = pc.math.lerp(currentFog, targetFog, 0.1);
  }

  public isInNebula(): boolean {
    return this.playerInNebula;
  }

  /**
   * 2026 Tech: 获取最近的星云实体。
   */
  public getNearestNebula(pos: pc.Vec3): pc.Entity | null {
    let nearest: pc.Entity | null = null;
    let minDist = Infinity;

    for (const entity of this.sectorEntities) {
      if (entity.name === 'nebula') {
        const dist = entity.getPosition().distance(pos);
        if (dist < minDist) {
          minDist = dist;
          nearest = entity;
        }
      }
    }
    return nearest;
  }

  private checkAnomalyProximity(): void {
    if (!this.player || !this.engine) return;

    const playerPos = this.player.getPosition();
    for (const entity of this.sectorEntities) {
      if (entity.name === 'anomaly') {
        const dist = entity.getPosition().distance(playerPos);
        const data = (entity as any).userData;

        // 2026 Tech: 引力井物理影响
        if (dist < 40.0) {
          const forceDir = entity.getPosition().clone().sub(playerPos).normalize();
          const forceMagnitude = (40.0 - dist) / 40.0;

          // 如果是黑洞碎片，吸引玩家；如果是能量裂隙，排斥玩家
          const isAttract = data?.anomalyType === 'wormhole_fragment';
          const multiplier = isAttract ? 5.0 : -3.0;

          const force = forceDir.scale(forceMagnitude * multiplier);
          this.player.applyExternalForce?.(force);

          // 电磁干扰 (EMP) 视觉反馈
          if (dist < 15.0 && Math.random() > 0.95) {
            this.vfxSystem?.enableJumpDistortion();
            setTimeout(() => this.vfxSystem?.disableJumpDistortion(), 100);
          }
        }

        if (dist < 20.0) {
          if (data && !data.scanned) {
            data.scanned = true;
            console.log(`[SectorManager] Anomaly Detected: ${data.anomalyType}`);
            // 触发奖励：增加大量经验或发现特殊图纸
            useGameStore.getState().addScore(2000);
            useGameStore.getState().addExperience?.(500);

            // 视觉反馈：触发剧烈抖动与闪光
            const vfx =
              this.engine.getPlugin<import('./VisualEffectSystem').VisualEffectSystem>(
                'VisualEffectSystem',
              );
            if (vfx) {
              vfx.enableJumpDistortion();
              setTimeout(() => vfx.disableJumpDistortion(), 500);
            }
          }
        }
      }
    }
  }

  private checkStationProximity(controls?: import('./PlayerShip').PlayerControls): void {
    if (!this.player || !this.engine) return;

    const playerPos = this.player.getPosition();
    const tradeManager =
      this.engine.getPlugin<import('./TradeManager').TradeManager>('TradeManager');
    if (!tradeManager) return;

    for (const entity of this.sectorEntities) {
      if (entity.name === 'space_station') {
        const dist = entity.getPosition().distance(playerPos);
        if (dist < 15.0) {
          // 贸易范围
          // 自动出售所有矿产资源
          const store = useGameStore.getState();
          for (const [id, count] of Object.entries(store.inventory)) {
            if (count > 0 && (id === 'iron' || id === 'plasma')) {
              tradeManager.sellCommodity(id, count);
            }
          }

          // 2026 Tech: 手动触发交易面板
          if (controls?.interact) {
            const currentChoices = store.pendingTradeChoices;
            if (!currentChoices) {
              const buildSystem = (this.engine.getApp() as any)[
                'buildSystem'
              ] as import('./BuildSystem').BuildSystem;
              if (buildSystem) {
                // 获取当前星区主要派系的声望
                const factionId = this.currentSector?.config.factions[0] || 'trade_union';
                const fm = (this.engine.getApp() as any)['factionManager'];
                const reputation = fm?.getFaction(factionId as any)?.reputation || 0;

                const choices = buildSystem.getStationTradeChoices(store.currentWave, reputation);
                store.setPendingTradeChoices(choices);
              }
            }
            store.setTradePanelVisible(true);
            store.setGamePaused(true);
          }
        }
      }
    }
  }

  public getCurrentSector(): SectorGenerationResult | null {
    return this.currentSector;
  }
}
