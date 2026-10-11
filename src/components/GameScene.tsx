import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { PlayerControls } from '../engine/PlayerShip';
import type { Dialogue } from '../engine/StoryMissionManager';
import { useGameStore } from '../store/useGameStore';
import { GameHUD } from './GameHUD';
import { LoadingOverlay } from './LoadingOverlay';
import { PauseOverlay } from './PauseOverlay';
import { TouchControlOverlay } from './TouchControlOverlay';
import { DialogueSystem } from './DialogueSystem';
import { QuestTracker } from './QuestTracker';
import { UpgradeChoiceOverlay } from './UpgradeChoiceOverlay';
import { gameplayManager } from '../engine/GameplayManager';
import type { GameplayEvents } from '../engine/GameplayManager';
import { luaEngine } from '../lua/LuaEngine';
import { enemyAIManager } from '../lua/ai/EnemyAIManager';
import {
  getEnemyAIMode,
  setEnemyAIMode,
  getLuaAIBridgeStats,
  resetLuaAIBridgeStats,
} from '../engine/LuaEnemyAIBridge';
import { dailyChallengeManager } from '../engine/DailyChallengeManager';
import { ModelAssetProvider } from '../engine/ModelAssetProvider';
import { globalAudio } from '../engine/GlobalAudio';
import './GameScene.css';

type PlayCanvasGameEngine = import('../engine/PlayCanvasEngine').PlayCanvasGameEngine;
type PlayerShip = import('../engine/PlayerShip').PlayerShip;
type EnemySystem = import('../engine/EnemySystem').EnemySystem;
type WeaponSystem = import('../engine/WeaponSystem').WeaponSystem;
type SkillSystem = import('../engine/SkillSystem').SkillSystem;
import { SkillType } from '../engine/SkillSystem';
type StoryMissionManager = import('../engine/StoryMissionManager').StoryMissionManager;
type PowerupSpawner = import('../engine/PowerupSystem').PowerupSpawner;
type BuildSystem = import('../engine/BuildSystem').BuildSystem;
type CameraSystem = import('../engine/CameraSystem').CameraSystem;
type VisualEffectSystem = import('../engine/VisualEffectSystem').VisualEffectSystem;
type AsteroidSystem = import('../engine/AsteroidSystem').AsteroidSystem;
import { skillTreeManager } from '../engine/SkillTreeManager';
import { survivalModeManager } from '../engine/SurvivalModeManager';
import {
  getLevelByIndex,
  SKYBOX_TEXTURES,
  LEVEL_LIGHTING,
  ASTEROID_BELT,
  ENGINE_DIFFICULTY,
  buildWavePlans,
  ENV_HDRI,
  DEFAULT_ENV_HDRI,
  TONEMAP,
  EXPOSURE_BY_LIGHTING,
} from '../levels';
// 可活动空间（场地边界 / 生成环 / 小行星带 / 远景布景）的唯一真源。
// 相机参数是「玩家可视范围」，与场地大小无关，故不在此列。
import { BACKDROP } from '../engine/arena';
import { getCredits, addCredits } from '../engine/CreditsStore';
import { achievementSystem } from '../engine/AchievementSystem';
import {
  applySkillBonusesToPlayer,
  applySkillBonusesToWeapon,
  computeSkillMaxShield,
} from '../engine/SkillBonusAdapter';
import { EXP_PER_WAVE } from '../engine/Experience';
// 元进度（商店购买 → 下一局生效）的读取侧：已购物品是唯一真源，加成在这里折算。
import { getOwnedItems } from '../engine/OwnedItems';
import {
  applyMetaBonusesToMaxBoostEnergy,
  applyMetaBonusesToPlayer,
  applyMetaBonusesToShield,
  applyMetaBonusesToWeapon,
  computeMetaBonuses,
  describeMetaBonuses,
  getOwnedHullTint,
  IDENTITY_META_BONUSES,
  type MetaBonuses,
} from '../engine/MetaBonuses';

const enginePowerupTypeToLua = (engineType: string): string | null => {
  const mapping: Record<string, string> = {
    health: 'health',
    shield: 'shield',
    speedBoost: 'speed',
    weaponUpgrade: 'damage',
    invincibility: 'invincible',
    scoreBonus: 'damage',
    missile: 'triple_shot',
    laser: 'triple_shot',
  };
  return mapping[engineType] || null;
};

/** 一波清空后到下一波敌人开始出现的间隔（秒）。
 *  给玩家喘息时间，并让「波次完成」提示来得及被看到。 */
const WAVE_START_DELAY = 2.2;

/**
 * 生存模式的波次上限。
 *
 * 生存是**无尽**模式，这里给一个大到不可能到达的值：WaveManager 用它判定
 * 「是否末波」，只要不越界就永远不触发关卡完成结算（通关流程）。
 */
const SURVIVAL_MAX_WAVES = 999;

/**
 * 按「是否 Boss 波」切换波次音乐。
 *
 * 生存模式拿不到「末波」概念（波次无尽），所以不能像战役那样用波号比较来判 Boss，
 * 只能由 SurvivalModeManager 的波次配置直接给出 isBossWave。
 */
const playWaveAudioByBossFlag = (isBoss: boolean): void => {
  if (isBoss) {
    globalAudio.playMusic('boss');
    globalAudio.playCue('bossRoar');
  } else {
    globalAudio.playMusic('game');
    globalAudio.playCue('waveStart');
  }
};

/**
 * 波次开始时的音频切换（战役模式）。
 *
 * 音乐走 globalAudio（独立通道，跨界面不被销毁）；末波（Boss 波）换成 bossMusic
 * 并配一声低吼，其余波次回到战斗音乐。playMusic 是幂等的，同一首在播时不会重头开始。
 */
const playWaveAudio = (waveNumber: number, totalWaves: number): void => {
  playWaveAudioByBossFlag(waveNumber >= totalWaves);
};

export const GameScene: React.FC<{
  onGameOver: () => void;
  onLevelComplete?: () => void;
  /**
   * 运行模式：
   * - campaign（默认）：战役关卡，波次有限，清完末波触发通关结算。
   * - survival：无尽生存，波次由 SurvivalModeManager 的状态机驱动，阵亡即结束。
   *
   * 两种模式共用同一条战斗管线（WaveManager + EnemySystem + GameplayManager），
   * 差别只在「波次上限」与「结束条件」，因此不需要第二套战斗实现。
   */
  mode?: 'campaign' | 'survival';
  /**
   * 关卡序号（0 基），由选关界面经 App 传入。战役模式按 src/levels 的关卡配置
   * 初始化环境（天幕 / 光照 / 小行星带）、玩家初始属性与波次上限。
   * 生存模式忽略此参数。
   */
  levelIndex?: number;
}> = React.memo(({ onGameOver, onLevelComplete, mode = 'campaign', levelIndex = 0 }) => {
  const isSurvival = mode === 'survival';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PlayCanvasGameEngine | null>(null);
  const playerRef = useRef<PlayerShip | null>(null);
  const enemySystemRef = useRef<EnemySystem | null>(null);
  const weaponSystemRef = useRef<WeaponSystem | null>(null);
  const skillSystemRef = useRef<SkillSystem | null>(null);
  const buildSystemRef = useRef<BuildSystem | null>(null);
  const cameraSystemRef = useRef<CameraSystem | null>(null);
  const storyManagerRef = useRef<StoryMissionManager | null>(null);
  const gameplayManagerRef = useRef<typeof gameplayManager | null>(null);
  const powerupSpawnerRef = useRef<PowerupSpawner | null>(null);
  const vfxSystemRef = useRef<VisualEffectSystem | null>(null);
  const asteroidSystemRef = useRef<AsteroidSystem | null>(null);
  const prevBoostRef = useRef(false);
  /** 波间过渡调度：上一波清空后延迟启动下一波。
   *  nextWave 为 null 表示当前没有待启动的波次。 */
  const waveTransitionRef = useRef<{ nextWave: number | null; timer: number }>({
    nextWave: null,
    timer: 0,
  });
  /** 关卡完成只允许触发一次，避免最后一波反复结算 */
  const levelCompleteFiredRef = useRef(false);
  /** 本关开始时间戳（毫秒）。关卡结算时算用时，供成就「速度狂魔」判定。 */
  const levelStartTimeRef = useRef(0);
  /**
   * 末波是否「已真正打完」的权威标记（由 onWaveComplete(waveNumber >= totalWaves) 置位）。
   * 不能用 currentWave >= totalWaves 代替：末波刚 startWave 的那一帧波号就已经等于上限，
   * 而敌人要到下一帧才生成，会导致「末波刚开始就直接判定通关」，并把 GameScene 卸载、
   * 引擎销毁，整局游戏永久冻结。
   */
  const finalWaveClearedRef = useRef(false);

  /**
   * 本局的元进度加成（商店已购物品 → 属性）。
   *
   * **开局读一次**即可：购买只发生在菜单里（那时 GameScene 已卸载），
   * 每局重新挂载时重新读取，等价于「始终最新」，不必每帧碰 localStorage。
   */
  const metaBonusesRef = useRef<MetaBonuses>(IDENTITY_META_BONUSES);

  /**
   * 已发放过升级奖励的最大波号。
   *
   * `GameplayManager.onEnemyKilled` 判定波次完成的条件里有一条是
   * 「当前 wave state 已是 completed」，而 `killAll()`／大型爆炸这类一次性多杀
   * 会让**后续每一个击杀**都再次命中该条件 —— 即同一波会多次触发 onWaveComplete。
   * 既有的「排下一波」「弹强化选择」恰好幂等所以一直没人察觉，
   * 但发放天赋点不是幂等的：同一波多发点会让等级虚高（实测清 1 波涨 4 级）。
   * 这里用波号去重，保证一波只发一次。
   */
  const lastRewardedWaveRef = useRef(0);

  /**
   * 生存模式：已经启动过战斗波次的最高波号。
   *
   * 生存模式的波次推进真源是 SurvivalModeManager 的状态机（它在 preparing /
   * waveTransition 倒计时归零时自行把 currentWave 加一），GameScene 只做桥接：
   * 检出「currentWave 比这里记录的更大」就启动对应的真实波次。用单调递增的
   * 波号比较而不是 state 变化，可以顺带避免重复启动同一波。
   */
  const survivalWaveRef = useRef(0);

  const [storyManager, setStoryManager] = useState<StoryMissionManager | null>(null);
  const [currentDialogue, setCurrentDialogue] = useState<Dialogue | null>(null);

  const isLoading = useGameStore((state) => state.isLoading);
  const isGamePaused = useGameStore((state) => state.isGamePaused);
  const isSceneReady = useGameStore((state) => state.isSceneReady);

  const playerHealth = useGameStore((state) => state.player.health);
  const playerMaxHealth = useGameStore((state) => state.player.maxHealth);
  const playerShield = useGameStore((state) => state.player.shield);
  const playerMaxShield = useGameStore((state) => state.player.maxShield);
  const playerScore = useGameStore((state) => state.player.score);
  const playerLevel = useGameStore((state) => state.player.level);
  const playerSpeed = useGameStore((state) => state.player.speed);
  const isBoostActive = useGameStore((state) => state.player.isBoostActive);
  const playerBoostEnergy = useGameStore((state) => state.player.boostEnergy);
  const playerMaxBoostEnergy = useGameStore((state) => state.player.maxBoostEnergy);

  const currentWave = useGameStore((state) => state.currentWave);
  const totalWaves = useGameStore((state) => state.totalWaves);
  const enemyCount = useGameStore((state) => state.enemyCount);
  const fps = useGameStore((state) => state.fps);
  const combo = useGameStore((state) => state.combo);
  const maxCombo = useGameStore((state) => state.maxCombo);
  const rank = useGameStore((state) => state.rank);
  const activePowerups = useGameStore((state) => state.activePowerups);
  const isBossWave = useGameStore((state) => state.isBossWave);
  const isEliteWave = useGameStore((state) => state.isEliteWave);
  const killCount = useGameStore((state) => state.killCount);

  // Build 协同系统状态
  const pendingUpgradeChoices = useGameStore((state) => state.pendingUpgradeChoices);
  const isUpgradeChoiceVisible = useGameStore((state) => state.isUpgradeChoiceVisible);
  const upgradeChoiceTimer = useGameStore((state) => state.upgradeChoiceTimer);
  const activeResonances = useGameStore((state) => state.activeResonances);

  const skillCooldowns = useGameStore((state) => state.skills.cooldowns);
  const skillMaxCooldowns = useGameStore((state) => state.skills.maxCooldowns);

  const controlsRef = useRef<PlayerControls>({
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false,
    fire: false,
    pitchUp: false,
    pitchDown: false,
    rollLeft: false,
    rollRight: false,
  });

  const audioManagerRef = useRef<typeof import('../engine/AudioSystem').AudioManager | null>(null);

  const [isCanvasReady, setIsCanvasReady] = useState(false);
  // 使用 ref 防止初始化状态变化触发 useEffect cleanup（避免引擎被销毁）
  const initStartedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    console.log('[GameScene] Canvas ref:', canvas);
    if (!canvas) {
      console.error('[GameScene] Canvas ref is null in resize effect');
      return;
    }

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    resizeCanvas();
    const readyTimer = setTimeout(() => {
      console.log('[GameScene] Setting isCanvasReady to true');
      setIsCanvasReady(true);
    }, 0);
    window.addEventListener('resize', resizeCanvas);

    return () => {
      clearTimeout(readyTimer);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const handleTouchMove = useCallback((x: number, y: number) => {
    if (controlsRef.current) {
      controlsRef.current.left = x < -0.1;
      controlsRef.current.right = x > 0.1;
      controlsRef.current.up = y < -0.1;
      controlsRef.current.down = y > 0.1;
    }
  }, []);

  const handleTouchFire = useCallback((active: boolean) => {
    if (controlsRef.current) {
      controlsRef.current.fire = active;
    }
  }, []);

  const handleTouchBoost = useCallback((active: boolean) => {
    if (controlsRef.current) {
      controlsRef.current.boost = active;
    }
  }, []);

  const handleTouchSkill1 = useCallback(() => {
    if (skillSystemRef.current) {
      skillSystemRef.current.activateSkill('missile_strike' as SkillType);
      useGameStore.getState().setSkillCooldown('skill1', 8);
    }
  }, []);

  const handleTouchSkill2 = useCallback(() => {
    if (skillSystemRef.current) {
      skillSystemRef.current.activateSkill('shield_burst' as SkillType);
      useGameStore.getState().setSkillCooldown('skill2', 10);
    }
  }, []);

  const handleTouchSkill3 = useCallback(() => {
    if (skillSystemRef.current) {
      skillSystemRef.current.activateSkill('time_slow' as SkillType);
      useGameStore.getState().setSkillCooldown('skill3', 15);
    }
  }, []);

  const handleTouchSkill4 = useCallback(() => {
    if (skillSystemRef.current) {
      skillSystemRef.current.activateSkill('overdrive' as SkillType);
      useGameStore.getState().setSkillCooldown('skill4', 20);
    }
  }, []);

  // Build 强化选择处理
  const handleUpgradeSelect = useCallback((upgradeId: string) => {
    buildSystemRef.current?.selectUpgrade(upgradeId);
    // 强化已选定：给一声界面反馈（此前 ui-levelup 定义了却从未被播放）
    globalAudio.playCue('uiLevelUp');
    const build = buildSystemRef.current?.getActiveBuild();
    if (build) {
      const resonanceNames = buildSystemRef.current?.getActiveResonanceNames() || [];
      useGameStore.getState().setActiveBuild(
        build.upgrades.map((au) => ({
          id: au.upgrade.id,
          name: au.upgrade.name,
          tag: au.upgrade.tag,
          stacks: au.stacks,
          rarity: au.upgrade.rarity,
        })),
        resonanceNames,
      );
    }
    useGameStore.getState().setPendingUpgradeChoices(null);
    useGameStore.getState().setUpgradeChoiceVisible(false);
    useGameStore.getState().setGamePaused(false);

    // 强化选完后，若已排定下一波，重置波间倒计时让 update 循环接着推进
    const pending = waveTransitionRef.current;
    if (pending.nextWave !== null) {
      pending.timer = WAVE_START_DELAY;
    }
  }, []);

  // 强化选择倒计时
  useEffect(() => {
    if (!isUpgradeChoiceVisible) return;
    const interval = setInterval(() => {
      const current = useGameStore.getState().upgradeChoiceTimer;
      if (current <= 0.1) {
        clearInterval(interval);
        return;
      }
      useGameStore.getState().setUpgradeChoiceTimer(current - 0.1);
    }, 100);
    return () => clearInterval(interval);
  }, [isUpgradeChoiceVisible]);

  const initializeEngine = useCallback(async () => {
    if (!canvasRef.current) {
      console.error('[GameScene] Canvas ref is null');
      return;
    }

    // 关卡配置（src/levels 是唯一真源）。
    // 此前选关界面选中的 id 传到 App 就断了，GameScene 从不读关卡配置——
    // 结果 10 关的天幕、光照、小行星带、玩家初始生命与波次上限全部与策划无关。
    const levelConfig = getLevelByIndex(levelIndex);
    if (levelConfig && !isSurvival) {
      console.log(
        `[GameScene] 应用关卡配置 ${levelConfig.id}「${levelConfig.name}」：` +
          `难度=${levelConfig.difficulty}，波数=${levelConfig.waves.length}，` +
          `天幕=${levelConfig.environment.skybox}，小行星带=${levelConfig.environment.asteroidField}，` +
          `光照=${levelConfig.environment.lighting}，初始 ${levelConfig.player.health}HP/${levelConfig.player.shield}护盾`,
      );
    }

    console.log('[GameScene] Initializing game engine...');

    try {
      const [
        pcModule,
        { PlayCanvasGameEngine },
        { PlayerShip },
        { EnemySystem },
        { WeaponSystem },
        { SkillSystem },
        { StoryMissionManager },
        { AudioManager },
        { PowerupSpawner, PowerupType: EnginePowerupType },
      ] = await Promise.all([
        import('playcanvas'),
        import('../engine/PlayCanvasEngine'),
        import('../engine/PlayerShip'),
        import('../engine/EnemySystem'),
        import('../engine/WeaponSystem'),
        import('../engine/SkillSystem'),
        import('../engine/StoryMissionManager'),
        import('../engine/AudioSystem'),
        import('../engine/PowerupSystem'),
      ]);

      const pc = pcModule;

      const engine = new PlayCanvasGameEngine({
        canvas: canvasRef.current,
        antialias: true,
        enablePhysics: false,
      });
      engineRef.current = engine;
      console.log('[GameScene] PlayCanvas engine created');

      AudioManager.initialize(engine.getApp());
      // 音乐不在这里起：改由 globalAudio 按界面统一驱动（App 的 gameState 变化时切歌），
      // 否则结算/返回菜单时组件卸载会把声音一起销毁 —— 见 GlobalAudio 的模块注释。
      audioManagerRef.current = AudioManager;
      console.log('[GameScene] Audio system initialized');

      engine.setCameraPosition(0, 10, 15);
      engine.lookAt(new pc.Vec3(0, 0, 0));
      console.log('[GameScene] Camera position set to (0, 10, 15)');

      // 主光源强度随关卡光照档位（environment.lighting：dim/normal/bright）
      const sunIntensity =
        LEVEL_LIGHTING[levelConfig?.environment.lighting ?? 'normal']?.sunIntensity ?? 1.5;
      engine.addDirectionalLight(
        'sun',
        new pc.Vec3(-5, 10, 5),
        new pc.Color(1, 0.95, 0.9),
        sunIntensity,
      );
      engine.addLight('fill', new pc.Vec3(10, 5, -10), new pc.Color(0.4, 0.5, 0.8), 0.5);
      console.log('[GameScene] Lights added');

      // 天幕：按关卡 environment.skybox 取图（Kenney Skyboxes，CC0，
      // 映射见 src/levels/index.ts 的 SKYBOX_TEXTURES）；未登记则回落默认星空。
      // 挂在相机下 ⇒ 无限远背景；单 draw call；加载失败回落深色，不影响开局。
      const skyboxUrl =
        SKYBOX_TEXTURES[levelConfig?.environment.skybox ?? 'env-space-01'] ??
        '/assets/textures/skybox-space.png';
      engine.createSkyDome(skyboxUrl, 400);

      // 粒子贴图：开局预加载全部 7 张（尾焰/导弹/命中/爆炸/道具/技能，共 ~430KB），
      // 之后所有粒子系统创建时同步取用；未就绪期间回落引擎默认白点、就绪后自动回填。
      engine.preloadParticleTextures();

      // PBR 贴图：ambientCG 三套真材质（岩石/金属板/金属，共 ~3.7MB），
      // 供小行星带 / 空间站 / 卫星在 GLB 替换完成后叠加（见 applyPbrMaterialWhenReady）。
      engine.preloadPbrTextures();

      // ── 画质：色调映射 + 环境光照（IBL）──────────────────────────────────
      // 色调映射：线性 → ACES2。线性输出会把亮部直接切顶（死白一片），filmic 类
      // 曲线让高光有滚降；代价是整体略暗，所以按关卡光照档位补曝光（暗档多补）。
      const lightingKey = levelConfig?.environment.lighting ?? 'normal';
      engine.setToneMapping(
        TONEMAP.mode,
        TONEMAP.exposure * (EXPOSURE_BY_LIGHTING[lightingKey] ?? 1),
      );

      // 环境光照：HDR 夜空 → 预滤波 envAtlas 挂到 scene 上，金属材质（空间站/卫星）
      // 从此反射真实环境而不是「空气」。异步加载 + 生成，不阻塞开局；失败只降级
      // （保留 ambientLight），画质是加分项，不能挡住进游戏。
      const hdrUrl =
        ENV_HDRI[levelConfig?.environment.skybox ?? 'env-space-01'] ?? DEFAULT_ENV_HDRI;
      void engine.loadEnvironmentLighting(hdrUrl);

      // 近景星星只保留 120 颗提供运动视差；远处的星空交给天幕贴图。
      // 布景的位置与尺寸全部来自 arena.ts 的 BACKDROP（世界整体 2× 时同倍放大，
      // 从原点看过去的方位与视角尺寸保持不变，天空观感不被破坏）。
      engine.createStarField(
        BACKDROP.starField.count,
        BACKDROP.starField.innerRadius,
        BACKDROP.starField.outerRadius,
        BACKDROP.starField.sizeScale,
      );
      for (const nebula of BACKDROP.nebulae) {
        engine.createNebula(new pc.Vec3(...nebula.position), nebula.scale);
      }
      for (const planet of BACKDROP.planets) {
        engine.createPlanet(
          planet.name,
          new pc.Vec3(...planet.position),
          planet.radius,
          new pc.Color(planet.color[0], planet.color[1], planet.color[2]),
        );
      }

      // 小行星带：按关卡 environment.asteroidField 开关（尺寸见 ASTEROID_BELT）。
      // 关掉的关卡省下小行星模型 + 碰撞体，也让视野更干净（如「初次接触」）。
      // 内缘 70 是刻意大于飞船盒子对角线（≈76.8）的量级：带本身就是"看得见的墙"，
      // 若把它留在原地，放宽飞船边界后会直接穿进带里撞岩石。
      if (levelConfig?.environment.asteroidField ?? true) {
        engine.createAsteroidField(
          ASTEROID_BELT.count,
          new pc.Vec3(0, 0, 0),
          ASTEROID_BELT.innerRadius,
          ASTEROID_BELT.outerRadius,
          ASTEROID_BELT.sizeScale,
        );
      } else {
        console.log('[GameScene] 本关无小行星带（environment.asteroidField = false）');
      }
      // 空间站和卫星作为远处空间参照物（createStructure 返回的 entity 未 addToScene，需手动添加）
      const { ProceduralModelGenerator: ModelGen } =
        await import('../engine/ProceduralModelGenerator');
      const modelGen = new ModelGen(engine.getApp());
      // 空间站和卫星作为远处空间参照物。
      // 与飞船同款做法：包一层 holder 承载位置，内部程序化模型先顶上，
      // GLB 加载好后异步替换；任何失败都保留程序化模型，不影响开局。
      for (const structure of BACKDROP.structures) {
        const holder = new pc.Entity(`${structure.name}Holder`);
        holder.setPosition(structure.position[0], structure.position[1], structure.position[2]);
        const placeholder = modelGen.createStructure(structure.name, { scale: structure.scale });
        holder.addChild(placeholder);
        engine.addToScene(holder);
        engine.getModelAssets().upgradeStructure(holder, placeholder, structure.name, {
          scaleMultiplier: structure.scale * ModelAssetProvider.structureScale(),
          yaw: structure.yaw,
          onReplaced: (instance) => engine.applyPbrMaterialWhenReady(instance, structure.material),
        });
      }

      // 雾效：增强深度感，远处物体渐隐（临时禁用排查黑屏）
      // engine.enableFog(new pc.Color(0.02, 0.02, 0.05), 0.008);

      // 后处理系统：bloom + 暗角 + 色彩校正（VisualEffectSystem）。
      //
      // 这套东西此前整段被注释掉，理由是「可能破坏渲染管线」。真实原因是它按
      // PlayCanvas 1.x 的 API 写的，迁到 2.x 后构造函数第一句就抛异常——详见
      // VisualEffectSystem.ts 顶部注释。修好后在这里正式接回。
      //
      // 放在场景搭建之后：bloom 会让粒子尾焰/爆炸、激光、发光材质真正「发光」，
      // 与上一轮接入的粒子贴图是配套的。初始化失败只降级、不影响开局。
      try {
        const { VisualEffectSystem: VFXClass } = await import('../engine/VisualEffectSystem');
        const vfxSystem = new VFXClass(engine.getApp(), engine.getCamera());
        vfxSystem.applyPreset('cinematic');
        vfxSystemRef.current = vfxSystem;
        console.log('[GameScene] Visual effect system initialized (cinematic preset)');
      } catch (vfxError) {
        console.warn(
          '[GameScene] VisualEffectSystem init failed, running without post-effects:',
          vfxError,
        );
      }

      console.log('[GameScene] Environment created (with asteroid field, structures, fog, VFX)');

      const gameState = useGameStore.getState();

      // 元进度：商店已购物品 → 本局属性加成。
      // 读一次、存进 ref，之后每帧的合并直接用（合并点见 update 循环）。
      const ownedItems = getOwnedItems();
      metaBonusesRef.current = computeMetaBonuses(ownedItems);
      const hullTint = getOwnedHullTint(ownedItems);
      console.log(
        `[GameScene] 元进度：已购 ${ownedItems.length} 件，加成 [${
          describeMetaBonuses(metaBonusesRef.current).join(' / ') || '无'
        }]${hullTint ? `，涂装 rgb(${hullTint.join(',')})` : ''}`,
      );

      // 玩家初始生命/护盾以关卡配置为准（player.health / player.shield）；
      // store 里的值是上一局残留或默认值，仅在配置缺失时回落。
      const player = new PlayerShip({
        engine,
        initialPosition: new pc.Vec3(0, 0, 0),
        health: levelConfig?.player.health ?? gameState.player.health,
        shield: levelConfig?.player.shield ?? gameState.player.shield,
        tint: hullTint ?? undefined,
      });
      playerRef.current = player;
      console.log('[GameScene] Player created at position (0, 0, 0)');

      // 成就「不死之身」按**本关**是否受击判定：开局清零受伤累计。
      // 计时同理，用于「速度狂魔（5 分钟内通关）」。两者都在关卡结算时读取。
      player.resetDamageTaken();
      levelStartTimeRef.current = Date.now();

      // 技能树加成基线：天赋里的生命/护盾加成是**百分比**，而 PlayerShip
      // 的 maxHealth/maxShield 是绝对值，需要基线换算。基线 = 玩家刚创建时
      // 的实际上限（来自 store.player.health / shield），比写死常量更准。
      const skillBaseStats = {
        maxHealth: player.getMaxHealth(),
        maxShield: player.getMaxShield(),
        maxBoostEnergy: player.getMaxBoostEnergy(),
      };

      // 小行星碰撞检测系统（需在 player 和小行星场都就绪后实例化）
      const { AsteroidSystem: AsteroidSystemClass } = await import('../engine/AsteroidSystem');
      const asteroidSystem = new AsteroidSystemClass(player, engine);
      asteroidSystemRef.current = asteroidSystem;
      console.log('[GameScene] Asteroid collision system created');

      const enemySystem = new EnemySystem(engine, player);
      enemySystemRef.current = enemySystem;
      console.log('[GameScene] Enemy system created');

      const weaponSystem = new WeaponSystem(engine);
      weaponSystem.setPlayer(player);
      weaponSystemRef.current = weaponSystem;
      console.log('[GameScene] Weapon system created');

      const buildSystem = new (await import('../engine/BuildSystem')).BuildSystem();
      buildSystemRef.current = buildSystem;
      console.log('[GameScene] Build system created');

      // 摄像机跟随系统：平滑追踪玩家位置和姿态
      const { CameraSystem: CameraSystemClass } = await import('../engine/CameraSystem');
      const cameraSystem = new CameraSystemClass(engine.getCamera());
      cameraSystem.setTarget(player.getEntity());
      cameraSystem.setMode('thirdPerson');
      // 偏移 (0, 8, 15)：摄像机在玩家后方 15 单位、上方 8 单位
      // offset.z 为正 → updateFollow 中 -offset.z 为负 → 摄像机在玩家身后
      cameraSystem.setThirdPersonOffset(new pc.Vec3(0, 8, 15));
      cameraSystem.setConstraints({ followSpeed: 0.15, minDistance: 10, maxDistance: 25 });
      // 显式启用地平线稳定模式：摄像机不跟随玩家滚转，保持地平线水平
      cameraSystem.setRollStabilized(true);
      cameraSystemRef.current = cameraSystem;
      console.log(
        '[GameScene] Camera follow system created (offset: 0,8,15, followSpeed: 0.15, rollStabilized)',
      );

      const powerupSpawner = new PowerupSpawner(engine);
      powerupSpawner.setSpawnInterval(8);
      powerupSpawner.setMaxPowerups(6);
      powerupSpawnerRef.current = powerupSpawner;
      console.log('[GameScene] Powerup spawner created');

      const skillSystem = new SkillSystem(player, engine);
      skillSystemRef.current = skillSystem;
      // 技能使用统计 → 成就系统。`SkillSystem` 只回调、不依赖任何存储；
      // 成就是那个回调的消费方（`skillsUsed` 此前无供给方 → 三条技能成就点不亮）。
      skillSystem.setOnSkillActivated((type) => {
        achievementSystem.updateStats({ skillsUsed: { [type]: 1 } });
      });
      console.log('[GameScene] Skill system created');

      const storyMgr = new StoryMissionManager();
      storyManagerRef.current = storyMgr;

      // 任务奖励入账：任务完成 → 经验 + 信用点，与关卡奖励同一套真源。
      //
      // 差分识别「新完成的任务」（subscribe 每次变更都会回调，包括目标进度），
      // 而不是让 StoryMissionManager 去依赖 store —— 引擎模块保持无存储依赖。
      // 任务追踪面板显示的 `+N EXP / +N 信用` 从此是按实际发放的值渲染的。
      const rewardedMissionIds = new Set<string>();
      storyMgr.subscribe(() => {
        for (const mission of storyMgr.getAllMissions()) {
          if (rewardedMissionIds.has(mission.id)) continue;
          if (storyMgr.getMissionState(mission.id)?.status !== 'completed') continue;
          rewardedMissionIds.add(mission.id);
          const store = useGameStore.getState();
          store.addExperience(mission.rewards.experience);
          const credits = addCredits(mission.rewards.credits);
          console.log(
            `[GameScene] 任务奖励：${mission.id} → 经验 +${mission.rewards.experience}` +
              `（等级 ${useGameStore.getState().player.level}）、信用点 +${mission.rewards.credits}（${credits}）`,
          );
        }
      });
      storyMgr.loadAll().then(() => {
        setStoryManager(storyMgr);
        const startDialogue = storyMgr.getDialogueByTrigger('story', 'story-chapter-01', 'start');
        if (startDialogue) {
          setCurrentDialogue(startDialogue);
        }
        storyMgr.startMission('mission-01');
        console.log('[GameScene] Story mission manager initialized');
      });

      gameplayManagerRef.current = gameplayManager;
      const gameplayEvents: GameplayEvents = {
        onWaveStart: (waveNumber) => {
          useGameStore.getState().setWave(waveNumber);
          const waveState = gameplayManager.getWaveState();
          if (waveState) {
            useGameStore.getState().setWaveInfo({
              isBossWave: waveState.isBossWave,
              isEliteWave: waveState.isEliteWave,
              enemiesSpawned: waveState.enemiesSpawned,
              enemiesDefeated: waveState.enemiesDefeated,
              enemiesRemaining: waveState.enemiesRemaining,
            });
          }
        },
        onWaveComplete: (waveNumber, _score) => {
          // 元进度：每清空一波发放 `EXP_PER_WAVE` 点经验。
          //
          // 等级不再由波次计数直接 +1，而是**由累计经验推导**
          // （`useGameStore.addExperience` 内部用 `levelForExp` 同步写入等级）。
          // 原因：关卡奖励里一直配着 `rewards.experience`、结算/成就/任务界面也
          // 一直在显示 `+N EXP`，却没有任何系统消费它 —— 属于「界面发了、系统没收」。
          // 现在经验是等级的唯一输入，界面上的每一个经验数字都真的进了账。
          //
          // 曲线标定见 `Experience.ts`：1~4 级每级 100 点（= 1 波），
          // 与改之前的「每波 +1 级」在节奏上等价，不会顺带改动关卡解锁时机。
          //
          // 等级是技能树天赋点的**唯一来源**（SkillTreeManager.setPlayerLevel
          // 按差值发点），同时也是关卡选择里 recommendedLevel 的解锁依据。
          // resetGame() 保留 level + experience（见 useGameStore），所以它是跨局
          // 累积的元进度，而非单局内的临时数值。
          //
          // 去重：同一波 onWaveComplete 可能被触发多次（见 lastRewardedWaveRef 注释）。
          if (waveNumber > lastRewardedWaveRef.current) {
            lastRewardedWaveRef.current = waveNumber;
            useGameStore.getState().addExperience(EXP_PER_WAVE);
          }

          // 生存模式：本波清空交给 SurvivalModeManager —— 它加分波奖励并进入
          // waveTransition（波间倒计时），到时自行推进 currentWave；真实波次的
          // 启动由 tick 里的桥接完成（见 survivalWaveRef）。这里**不排 campaign
          // 的下一波**，否则两条推进线会同时排波、互相打架。
          if (isSurvival) {
            survivalModeManager.notifyWaveCleared();
          } else {
            // 最后一波清空：不再排下一波，标记「末波已清空」，
            // 交由 update 循环在同一帧触发关卡完成结算。
            const totalWaves = enemySystemRef.current?.getTotalWaves() ?? 10;
            if (waveNumber >= totalWaves) {
              waveTransitionRef.current.nextWave = null;
              finalWaveClearedRef.current = true;
              return;
            }

            // 排定下一波。无论后面是否弹出强化选择都必须排定，
            // 否则一波打完游戏就永久静止（原实现的缺口就在这）。
            waveTransitionRef.current = {
              nextWave: waveNumber + 1,
              timer: WAVE_START_DELAY,
            };
          }

          // 波次完成时触发三选一强化选择（弹窗期间游戏暂停，波间倒计时不推进）。
          // 两种模式都要 —— 生存模式同样吃这套 roguelike 强化。
          const choices = buildSystemRef.current?.getUpgradeChoices(waveNumber) || [];
          if (choices.length > 0) {
            useGameStore.getState().setPendingUpgradeChoices(choices);
            useGameStore.getState().setUpgradeChoiceVisible(true);
            useGameStore.getState().setGamePaused(true);
          }
        },
        onWaveReward: (reward) => {
          useGameStore.getState().addScore(reward.totalScoreBonus);
          useGameStore.getState().setWaveRewardNotification({
            waveNumber: reward.waveNumber,
            rewards: reward.rewards.map((r) => ({ label: r.label })),
          });
          for (const r of reward.rewards) {
            if (r.type === 'heal' && playerRef.current) {
              playerRef.current.heal(r.amount);
            } else if (r.type === 'shield' && playerRef.current) {
              playerRef.current.addShield(r.amount);
            }
          }
        },
        onEnemyKilled: (enemyType, score) => {
          useGameStore.getState().addScore(score);
          useGameStore.getState().addKill();
          // 击杀屏幕震动：体量越大震得越狠（受伤另有自己的震动）。
          // 幅度克制 —— 震动是反馈不是特效，过强会晕。
          if (enemyType.includes('boss')) {
            cameraSystemRef.current?.shake(0.3, 0.6, 20, 2);
          } else if (
            enemyType.includes('elite') ||
            enemyType.includes('tank') ||
            enemyType.includes('destroyer')
          ) {
            cameraSystemRef.current?.shake(0.12, 0.3, 25, 1.5);
          } else {
            cameraSystemRef.current?.shake(0.06, 0.2, 30, 1.5);
          }
          // 生存模式：把击杀同步进生存面板的统计（分数/击杀数/Boss 数）。
          // 用 addKill 而非 recordEnemyDefeat —— 后者会推进生存管理器自己的
          // 波次计数，而真实战斗的敌人数由 WaveManager 决定（见 externalControl）。
          if (isSurvival) {
            survivalModeManager.addKill(score, enemyType.includes('boss'));
          }
        },
        onComboUpdate: (comboCurrent, comboMax) => {
          const comboInfo = gameplayManager.getComboInfo();
          useGameStore.getState().setCombo(comboCurrent, comboMax, comboInfo?.comboTimer || 0);
          if (isSurvival) {
            survivalModeManager.recordCombo(comboMax);
          }
        },
        onRankChange: (newRank) => {
          useGameStore.getState().setRank(newRank);
        },
        onPowerupApplied: (powerupType) => {
          useGameStore.getState().addPowerup();
          const config = gameplayManager.getPowerupConfig(
            powerupType as Parameters<typeof gameplayManager.getPowerupConfig>[0],
          );
          const active = gameplayManager.getActivePowerups();
          const powerupData = active.find((p) => p.type === powerupType);
          if (powerupData) {
            useGameStore.getState().addActivePowerup({
              type: powerupData.type,
              name: powerupData.displayName || config?.name || powerupData.type,
              remainingTime: powerupData.remainingDuration,
              duration: powerupData.duration,
              value: powerupData.multiplier || powerupData.stacks || 0,
            });
          }
        },
        onPowerupExpired: (powerupType) => {
          useGameStore.getState().removeActivePowerup(powerupType);
        },
        onGameOver: (_finalScore, _rank) => {},
        onAchievementUnlocked: (achievement) => {
          useGameStore.getState().addAchievementNotification({
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            rarity: achievement.rarity,
            timestamp: Date.now(),
          });
        },
      };
      gameplayManager.setEventCallbacks(gameplayEvents);

      // 读取难度设置（基础难度 + 自适应配置）
      const savedSettings = localStorage.getItem('gameSettings');
      let baseDifficulty: 'easy' | 'normal' | 'hard' = 'normal';
      // 战役模式：难度取自关卡配置（此前关卡难度从未传给 gameplayManager，
      // 所有关卡都是引擎默认档）。每日挑战模式在下面覆盖。
      if (!isSurvival && levelConfig) {
        baseDifficulty = ENGINE_DIFFICULTY[levelConfig.difficulty] ?? 'normal';
      }
      let adaptiveEnabled = true;
      let adaptiveIntensity: 'low' | 'medium' | 'high' = 'medium';
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          if (parsed.difficulty) baseDifficulty = parsed.difficulty;
          if (parsed.adaptiveDifficulty !== undefined) adaptiveEnabled = parsed.adaptiveDifficulty;
          if (parsed.adaptiveIntensity) adaptiveIntensity = parsed.adaptiveIntensity;
        } catch {
          // 忽略解析错误，使用默认值
        }
      }

      // 每日挑战模式：覆盖基础难度为目标挑战难度，并关闭自适应（保证挑战条件一致）
      const isDailyChallenge = dailyChallengeManager.isDailyChallengeActive();
      if (isDailyChallenge) {
        const challengeConfig = dailyChallengeManager.getActiveChallenge();
        if (challengeConfig) {
          baseDifficulty = challengeConfig.baseDifficulty;
          adaptiveEnabled = false;
          console.log(
            `[GameScene] 每日挑战模式已启用：难度=${baseDifficulty}，目标波次=${challengeConfig.targetWaves}，倍率=${challengeConfig.totalScoreMultiplier.toFixed(2)}x，修饰器=${challengeConfig.modifiers.map((m) => m.type).join(',')}`,
          );
        }
      }

      // 将自适应配置同步到 DifficultyManager
      gameplayManager.setAdaptiveConfig({
        enabled: adaptiveEnabled,
        intensity: adaptiveIntensity,
      });

      await gameplayManager.initialize(baseDifficulty);
      await gameplayManager.startGame(baseDifficulty);

      // 战役模式：波次上限 = 关卡配置的波数（waveCountOf）。
      // 此前从不调用 setMaxWaves，用 Lua 默认的 10 波——与关卡策划的 3~N 波不符，
      // 且「末波 boss / 通关结算」的触发点整体后移。生存模式在下面另行覆盖为无限。
      // 同时注入关卡显式波次表（buildWavePlans）：敌人数量/类型/boss 判定由
      // 策划数据决定，不再走 Lua 公式（此前配置的敌人词表运行时根本不认识）。
      if (!isSurvival && levelConfig) {
        gameplayManager.setMaxWaves(levelConfig.waves.length);
        gameplayManager.getWaveManager()?.setLevelWaves(buildWavePlans(levelConfig));
        console.log(
          `[GameScene] 波次上限设为 ${levelConfig.waves.length}（关卡 ${levelConfig.id}），` +
            `显式波次表已注入（共 ${levelConfig.waves.reduce((s, w) => s + w.enemies.reduce((n, e) => n + e.count, 0), 0)} 敌人）`,
        );
      }

      // 生存模式：波次无尽 + 交出波次推进权。
      // - setMaxWaves(大数) → 永不进入「末波」判定，因此不会触发关卡完成结算；
      // - setExternalControl(true) → SurvivalModeManager 只做计时/统计/状态机，
      //   敌人仍由 WaveManager + EnemySystem 真实生成（敌人只有这一个真源）。
      // - startGame() → 进入 preparing 3 秒倒计时，由 tick 里的 update(dt) 推进。
      // 另：显式清掉可能残留的关卡波次计划（从战役退回生存等场景），
      // 保证生存模式一定走 Lua 公式路径。
      if (isSurvival) {
        gameplayManager.setMaxWaves(SURVIVAL_MAX_WAVES);
        gameplayManager.getWaveManager()?.setLevelWaves(null);
        survivalModeManager.setExternalControl(true);
        survivalModeManager.startGame();
      }

      // 在波次启动前设置 isSceneReady，确保update回调能执行游戏逻辑
      useGameStore.getState().setSceneReady(true);

      if (enemySystemRef.current) {
        const waveMgr = gameplayManager.getWaveManager();
        if (waveMgr) {
          enemySystemRef.current.setWaveManager(waveMgr);
        }
        // 战役模式开局直接放第 1 波；生存模式要等 SurvivalModeManager 的
        // preparing 倒计时走完，由 tick 里的桥接启动（见 survivalWaveRef）。
        if (!isSurvival) {
          enemySystemRef.current.startWave(1);
          playWaveAudio(1, enemySystemRef.current.getTotalWaves());
        }
        enemySystemRef.current.setPowerupDropCallback((position, _enemyType) => {
          if (powerupSpawnerRef.current) {
            const types = Object.values(EnginePowerupType);
            const randomType = types[Math.floor(Math.random() * types.length)];
            powerupSpawnerRef.current.addPowerup(
              randomType,
              new pc.Vec3(position.x, 0, position.z),
              1,
              8,
            );
          }
        });
        // 击杀统一结算：EnemySystem 每帧把阵亡敌人整体回调（无论死因），
        // 这里负责分数、战斗统计与剧情任务计数。
        enemySystemRef.current.setEnemiesDefeatedCallback((deadEnemies) => {
          if (deadEnemies.length === 0) return;
          for (const enemy of deadEnemies) {
            const type = enemy.getType();
            // EnemySystem 侧只负责该敌人自身的掉落判定，不计分、不推进波次。
            enemySystemRef.current?.onEnemyKilled(enemy);
            if (gameplayManagerRef.current && gameplayManagerRef.current.isRunning()) {
              const isBoss = type.includes('boss');
              const isElite = type === 'elite';
              // 分数、击杀数、连击与波次推进统一在 GameplayManager 内完成；
              // 其 onEnemyKilled 事件会回到上面注册的处理器 addScore/addKill。
              // 注意不要在这里再 addScore，否则每次击杀会被计两次分。
              gameplayManagerRef.current.onEnemyKilled(type, isBoss, isElite);
            }
          }
          if (storyManagerRef.current) {
            storyManagerRef.current.getActiveMissions().forEach((state) => {
              storyManagerRef.current?.incrementObjective(
                state.mission.id,
                'destroy',
                deadEnemies.length,
              );
            });
          }
        });
      }

      // 重置波次过渡状态（重开一局时避免残留上一局的待启动波次）
      waveTransitionRef.current = { nextWave: null, timer: 0 };
      levelCompleteFiredRef.current = false;
      finalWaveClearedRef.current = false;
      survivalWaveRef.current = 0;

      if (!isSurvival) {
        gameplayManager.startWave(1);
      }
      console.log('[GameScene] Gameplay manager initialized');

      // dev 调试钩子：供自动化验证与开发期排查波次/战斗逻辑（生产构建不可用）。
      // 背景：真实玩家打完一波需要枪法与生存，自动化验证用它直接驱动波次流转。
      if (import.meta.env.DEV) {
        // 更新循环存活诊断：区分「逻辑卡死」与「更新回调根本没跑」
        const diag = { ticks: 0, logicTicks: 0, enemyUpdates: 0 };
        (window as unknown as Record<string, unknown>)['__waveDiag'] = diag;

        // 引擎静默停摆排查：PlayCanvas 的 tick 链只在 graphicsDevice 变 null（destroy）
        // 或 WebGL 上下文丢失后不再重排时停止，且都不会抛异常 —— 所以必须显式埋点。
        {
          const rawApp = (engineRef.current as unknown as { app?: Record<string, unknown> } | null)
            ?.app;
          if (rawApp && typeof rawApp['on'] === 'function') {
            (rawApp['on'] as (e: string, cb: () => void) => void)('destroy', () => {
              console.warn('[diag] PlayCanvas Application destroy 触发 ← tick 链就此停止');
            });
          }
          const cvs = canvasRef.current;
          if (cvs) {
            cvs.addEventListener('webglcontextlost', () => console.warn('[diag] webglcontextlost'));
          }
          document.addEventListener('visibilitychange', () =>
            console.log(`[diag] visibilitychange hidden=${document.hidden}`),
          );
        }
        (window as unknown as Record<string, unknown>)['__waveDebug'] = {
          startWave: (n: number) => {
            enemySystemRef.current?.startWave(n);
            gameplayManagerRef.current?.startWave(n);
            playWaveAudio(n, enemySystemRef.current?.getTotalWaves() ?? 10);
          },
          getState: () => ({
            wave: enemySystemRef.current?.getCurrentWave() ?? -1,
            totalWaves: enemySystemRef.current?.getTotalWaves() ?? -1,
            waveActive: enemySystemRef.current?.isWaveActive() ?? false,
            aliveEnemies: enemySystemRef.current?.getAliveCount() ?? -1,
            remaining: enemySystemRef.current?.getRemainingCount() ?? -1,
            upgradeVisible: useGameStore.getState().isUpgradeChoiceVisible,
            gamePaused: useGameStore.getState().isGamePaused,
            waveState: gameplayManagerRef.current?.getWaveState() ?? null,
            sceneReady: useGameStore.getState().isSceneReady,
            hasPlayer: playerRef.current !== null,
            levelCompleteFired: levelCompleteFiredRef.current,
            finalWaveCleared: finalWaveClearedRef.current,
            raf:
              (window as unknown as { __rafProbeCount?: () => number }).__rafProbeCount?.() ?? -1,
            diag: { ...diag },
            enemyInternals: (() => {
              const es = enemySystemRef.current as unknown as Record<string, unknown> | null;
              if (!es) return null;
              return {
                waveActive: es['waveActive'],
                spawnInterval: es['spawnInterval'],
                lastSpawnTime: es['lastSpawnTime'],
                pool: (es['enemies'] as unknown[] | undefined)?.length ?? -1,
              };
            })(),
          }),
          /** 清空场上敌人（下一帧 GameScene 会按正常击杀流程结算：计数/分数/波次完成） */
          killAll: () => {
            enemySystemRef.current?.getEnemies().forEach((e) => e.takeDamage(99999));
          },
          /** 逐个敌人快照：排查敌人在无攻击情况下消失的问题 */
          inspectEnemies: () => {
            return (enemySystemRef.current?.getEnemies() ?? []).map((e, i) => {
              const box = e as unknown as { health: number; isDying: boolean };
              const p = e.getPosition();
              return {
                i,
                health: box.health,
                isDying: box.isDying,
                pos: [p.x, p.y, p.z].map((v) => Math.round(v)),
              };
            });
          },
          /** 无敌模式：自动化验证用，避免玩家生存问题掩盖波次逻辑验证。
           *  必须走 setInvincible（内部维护 invulnerabilityEndTime，
           *  直接改 isInvulnerable 会被 update 每帧重算覆盖）。
           *  默认 true —— 验证脚本都写成 godMode?.()，带默认值才真的生效。 */
          godMode: (on: boolean = true) => {
            const p = playerRef.current;
            if (p && on) p.setInvincible(3_600_000);
          },
          /** 玩家姿态观测（只读）：forward 与 GLB 几何机头的世界方向。
           *  几何机头在模型局部 -Z（scripts/analyze-glb-nose.mjs 实测），
           *  经实例世界矩阵变换后应与 forward 同向（点积 > 0）。 */
          getPlayerPose: () => {
            const p = playerRef.current;
            if (!p) return null;
            const fwd = p.getForward();
            let nose: number[] | null = null;
            p.getEntity().forEach((n: pc.GraphNode) => {
              if (nose || !n.name.endsWith('-instance')) return;
              const dir = new pc.Vec3(0, 0, -1);
              n.getWorldTransform().transformVector(dir, dir);
              nose = [dir.x, dir.y, dir.z];
            });
            const pos = p.getPosition();
            return {
              forward: [fwd.x, fwd.y, fwd.z],
              nose,
              pos: [pos.x, pos.y, pos.z],
              speed: p.getSpeed(),
            };
          },
          /** 直接杀死指定敌人（按索引），便于逐个验证击杀结算 */
          killOne: (index: number) => {
            const enemies = enemySystemRef.current?.getEnemies() ?? [];
            if (enemies[index]) enemies[index].takeDamage(99999);
          },
        };

        // 技能树接线调试钩子。与 __waveDebug 同理：只**观测**生产路径上的真实
        // 对象（store / skillTreeManager / PlayerShip / WeaponSystem），不旁路任何
        // 逻辑，避免验证脚本读到一套影子状态而给出假绿。
        (window as unknown as Record<string, unknown>)['__skillDebug'] = {
          /** 元进度：等级（唯一真源是 store）+ 天赋点 + 聚合加成 */
          getMeta: () => ({
            level: useGameStore.getState().player.level,
            /** 累计经验。暴露它是为了让验证脚本断言**不变式**（等级 = 经验查表），
             *  而不是写死「清 3 波后等级 = 4」这种会被其它经验来源（成就奖励）打破的绝对值。 */
            experience: useGameStore.getState().player.experience,
            points: skillTreeManager.getTalentPoints(),
            stats: skillTreeManager.getStats(),
          }),
          /** 天赋节点快照（含解锁门槛与当前是否可点），供 UI 断言 */
          nodes: () =>
            skillTreeManager.getTalentNodes().map((n) => ({
              id: n.id,
              unlockLevel: n.unlockLevel,
              maxLevel: n.maxLevel,
              level: skillTreeManager.getTalentState(n.id)?.level ?? -1,
              canUpgrade: skillTreeManager.canUpgradeTalent(n.id),
            })),
          /** 玩家**实际生效**的属性：读的是 PlayerShip / WeaponSystem 内部状态，
           *  而不是技能树自己的统计，能真正证实「加成走到了战斗系统」。 */
          getEffective: () => {
            const p = playerRef.current;
            const w = weaponSystemRef.current as unknown as {
              buildMods?: Record<string, number>;
            } | null;
            const pb = p as unknown as { buildMods?: Record<string, number> } | null;
            return {
              maxHealth: p?.getMaxHealth() ?? -1,
              maxShield: p?.getMaxShield() ?? -1,
              maxBoostEnergy: p?.getMaxBoostEnergy() ?? -1,
              maxSpeedMultiplier: pb?.buildMods?.['maxSpeedMultiplier'] ?? -1,
              hullTint: p?.getHullTint() ?? null,
              damageMultiplier: w?.buildMods?.['damageMultiplier'] ?? -1,
              fireRateMultiplier: w?.buildMods?.['fireRateMultiplier'] ?? -1,
              critChanceBonus: w?.buildMods?.['critChanceBonus'] ?? -1,
            };
          },
          /** 直接点天赋（绕过打波次升级），便于快速验证属性出口 */
          upgrade: (nodeId: string) => skillTreeManager.upgradeTalent(nodeId),
          /** 清空技能树与其 localStorage，保证验证可重复 */
          resetTree: () => skillTreeManager.reset(),
        };

        // 成就接线调试钩子。与 __waveDebug / __skillDebug 同理：只**观测**生产路径上的
        // 真实状态（成就系统的真源快照 + 本局实际计数），不替它算任何东西。
        (window as unknown as Record<string, unknown>)['__achieveDebug'] = {
          /** 完整快照：面板看到的就是它（entries 里每条带真实 current/requirement） */
          getSnapshot: () => achievementSystem.getSnapshot(),
          /** 原始统计（判定这些数字是不是真从战斗事件来的） */
          getStats: () => achievementSystem.getStats(),
          /** 按 id 查一条的进度 */
          getOne: (id: string) => {
            const entry = achievementSystem.getAllAchievements().find((a) => a.id === id);
            return entry ? { ...entry.progress, requirement: entry.requirement } : null;
          },
          /** 本局命中率真值（来自 WeaponSystem 的两个计数器） */
          getAccuracy: () => weaponSystemRef.current?.getAccuracyStats() ?? null,
          /** 本关受伤累计（无伤通关成就的判定输入） */
          getDamageTaken: () => playerRef.current?.getDamageTaken() ?? -1,
          /** 只清解锁状态、保留统计（验证可重复，不必重开浏览器） */
          resetUnlocks: () => achievementSystem.resetUnlocks(),
          /** 连统计一起清（完全重置） */
          resetAll: () => achievementSystem.resetProgress(),
        };

        // 元进度（商店 → 下一局生效）调试钩子：同样只**观测**生产对象。
        // `bonuses` 读的是本局真正使用的那个 ref（不是重新算一遍），
        // 所以它能证明「加成确实进了合并点」，而不是证明「函数算得对」。
        (window as unknown as Record<string, unknown>)['__metaDebug'] = {
          owned: () => getOwnedItems().map((i) => ({ id: i.id, type: i.type, name: i.name })),
          bonuses: () => ({ ...metaBonusesRef.current }),
          summary: () => describeMetaBonuses(metaBonusesRef.current),
        };

        // 粒子贴图观测钩子：报告 7 张贴图的就绪状态与引擎缓存数量（只读生产对象）
        const engine = engineRef.current;
        if (engine) {
          (window as unknown as Record<string, unknown>)['__particleDebug'] = {
            status: () =>
              PlayCanvasGameEngine.ALL_PARTICLE_TEXTURE_URLS.map((url) => ({
                url: url.replace('/assets/textures/particles/', ''),
                ready: !!engine.getParticleTexture(url),
              })),
            readyCount: () =>
              PlayCanvasGameEngine.ALL_PARTICLE_TEXTURE_URLS.filter((u) =>
                engine.getParticleTexture(u),
              ).length,
            /** 常驻尾焰的 colorMap 是否已回填（验证 pending 补设路径） */
            trailColorMapSet: () => {
              const player = playerRef.current as unknown as {
                engineTrail?: { particlesystem?: { colorMap?: unknown } } | null;
              } | null;
              return !!player?.engineTrail?.particlesystem?.colorMap;
            },
          };

          // PBR 材质观测钩子：统计场景里真正挂上 PBR diffuseMap 的网格数（只读生产对象）
          (window as unknown as Record<string, unknown>)['__pbrDebug'] = {
            summary: () => {
              let pbrMeshes = 0;
              let totalMeshes = 0;
              const sets = new Set<string>();
              engine.getApp().root.forEach((node: pc.GraphNode) => {
                const render = (node as pc.Entity).render;
                if (!render) return;
                for (const mi of render.meshInstances) {
                  totalMeshes++;
                  const mat = mi.material as pc.StandardMaterial;
                  if (mat?.diffuseMap?.name?.includes('pbrTex') || mat?.normalMap) {
                    pbrMeshes++;
                    if (mat.normalMap) sets.add('normal');
                  }
                }
              });
              return { pbrMeshes, totalMeshes, withNormalMap: sets.size };
            },
          };

          // 关卡配置观测钩子：只读本局实际生效的参数（生产对象），
          // 供验证脚本确认「选中的关卡」真的改变了环境/玩家/波次。
          (window as unknown as Record<string, unknown>)['__levelDebug'] = {
            summary: () => ({
              levelIndex,
              levelId: levelConfig?.id ?? null,
              skybox: levelConfig?.environment.skybox ?? null,
              skyboxUrl:
                SKYBOX_TEXTURES[levelConfig?.environment.skybox ?? 'env-space-01'] ??
                '/assets/textures/skybox-space.png',
              asteroidField: levelConfig?.environment.asteroidField ?? null,
              lighting: levelConfig?.environment.lighting ?? null,
              configuredHealth: levelConfig?.player.health ?? null,
              configuredShield: levelConfig?.player.shield ?? null,
              playerMaxHealth: playerRef.current?.getMaxHealth() ?? -1,
              playerMaxShield: playerRef.current?.getMaxShield() ?? -1,
              configuredWaves: levelConfig?.waves.length ?? null,
              maxWaves: enemySystemRef.current?.getTotalWaves() ?? -1,
              wavePlans: gameplayManager.getWaveManager()?.getWavePlanCount() ?? 0,
              enemies: enemySystemRef.current?.getEnemies().length ?? -1,
              asteroidCount: engine.getApp().root.findByName('asteroidField')?.children.length ?? 0,
              credits: getCredits(),
              // 画质：环境光照（IBL）与色调映射的实际生效值（现读 scene，非影子状态）
              environment: engine.getEnvironmentLightingState(),
            }),
            levelConfig,
          };

          // 敌机 AI 后端的观测/开关钩子（Lua AI A/B 对照用）。
          // 只读生产对象：luaEngine 的运行时模式、enemyAIManager 的桥接统计、
          // 以及每架敌机**实际挂着的大脑**（不是另建影子状态）。
          (window as unknown as Record<string, unknown>)['__aiDebug'] = {
            /** 运行时模式：mode === 'lua' 才是真的在跑 Lua 脚本（stub = 宿主 JS 实现） */
            runtime: () => luaEngine.getRuntimeInfo(),
            /** 当前敌机 AI 后端（ts 原生 / lua 模块） */
            getMode: () => getEnemyAIMode(),
            /** 切换后端：只影响之后生成的敌机（已生成的不换脑） */
            setMode: (mode: 'ts' | 'lua') => setEnemyAIMode(mode),
            /** 桥接统计（句柄数 / 步进 / 动作 / 错误 / 兜底） */
            stats: () => ({
              ...enemyAIManager.getStats(),
              ...getLuaAIBridgeStats(),
              aliveEnemies: enemySystemRef.current?.getAliveCount() ?? -1,
            }),
            /** 逐架敌机：原生状态 + 是否由 Lua 接管 + Lua 侧最后的决策 */
            inspect: () =>
              (enemySystemRef.current?.getEnemies() ?? []).map((e, i) => {
                const box = e as unknown as {
                  ai?: {
                    isExternalBrainActive?: () => boolean;
                    getExternalBrainFrames?: () => number;
                    getExternalBrainDiagnostics?: () => Record<string, unknown> | null;
                  };
                };
                const ai = box.ai;
                const p = e.getPosition();
                return {
                  i,
                  type: e.getType(),
                  state: e.getAIState(),
                  brainActive: ai?.isExternalBrainActive?.() ?? false,
                  brainFrames: ai?.getExternalBrainFrames?.() ?? 0,
                  lua: ai?.getExternalBrainDiagnostics?.() ?? null,
                  pos: [p.x, p.y, p.z].map((v) => Math.round(v * 100) / 100),
                };
              }),
            /** 强制 Lua 侧抛错，用于验证「Lua 挂了敌机还能动」（回落 TS 行为） */
            forceLuaError: (on: boolean = true) => {
              enemyAIManager.setForceError(on);
              return on;
            },
            /**
             * 把存活敌机推到玩家周围的环上 —— 验证「AI 是否真的把它们带回来」。
             *
             * 为什么要这个：敌机一旦贴到玩家身上，位移就只剩微幅抖动（Lua 的近战阈值 2.0
             * 附近来回切），用"位置变化量"判断 AI 是否在驱动会假阴性。推远之后，
             * 位移量直接反映 AI 的追击行为 —— 对 ts / lua 两种后端都成立，A/B 才可比。
             */
            pushEnemiesAway: (radius: number = 26) => {
              const system = enemySystemRef.current;
              const player = playerRef.current;
              if (!system || !player) return 0;
              const center = player.getPosition();
              const list = system.getEnemies().filter((e) => e.isAlive());
              list.forEach((enemy, i) => {
                const angle = (i / Math.max(1, list.length)) * Math.PI * 2;
                enemy
                  .getEntity()
                  .setPosition(
                    center.x + Math.cos(angle) * radius,
                    center.y,
                    center.z + Math.sin(angle) * radius,
                  );
              });
              return list.length;
            },
            /** 清空统计与桥接计数，便于 A/B 分段对比 */
            resetStats: () => {
              enemyAIManager.resetStats();
              resetLuaAIBridgeStats();
            },
          };

          // 后处理观测钩子。同样只读生产对象，绝不另建影子状态。
          (window as unknown as Record<string, unknown>)['__vfxDebug'] = {
            active: () => vfxSystemRef.current?.isActive() ?? false,
            effectCount: () => vfxSystemRef.current?.getEffectCount() ?? 0,
            config: () => vfxSystemRef.current?.getConfig() ?? null,
            /** 相机是否已把渲染目标切到后处理的离屏缓冲（= 后处理真的接管了渲染） */
            cameraPostProcessed: () => !!engine.getCamera().camera?.renderTarget,
            setBloom: (on: boolean) => {
              if (on) vfxSystemRef.current?.enableBloom();
              else vfxSystemRef.current?.disableBloom();
            },
            setBloomStrength: (value: number) => vfxSystemRef.current?.setBloomStrength(value),
            setBloomThreshold: (value: number) => vfxSystemRef.current?.setBloomThreshold(value),
            setVignette: (on: boolean) => {
              if (on) vfxSystemRef.current?.enableVignette();
              else vfxSystemRef.current?.disableVignette();
            },
            setExposure: (value: number) => vfxSystemRef.current?.setExposure(value),
          };
        }

        // 生存模式调试钩子。同样**只观测生产对象**（survivalModeManager 单例 /
        // PlayerShip / EnemySystem），并提供一个「吃掉倒计时」的加速入口，
        // 让验证脚本不必真等 3 秒。绝不另建影子状态，否则会假绿。
        (window as unknown as Record<string, unknown>)['__survivalDebug'] = {
          getState: () => ({
            state: survivalModeManager.getState(),
            wave: survivalModeManager.getStats().currentWave,
            score: survivalModeManager.getStats().score,
            kills: survivalModeManager.getStats().enemiesDefeated,
            time: survivalModeManager.getStats().survivalTime,
            bosses: survivalModeManager.getStats().bossesDefeated,
            maxCombo: survivalModeManager.getStats().maxCombo,
            highScore: survivalModeManager.getHighScore(),
            highScoreCount: survivalModeManager.getHighScores().length,
            isBossWave: survivalModeManager.getCurrentWaveConfig()?.isBossWave ?? false,
            isEliteWave: survivalModeManager.getCurrentWaveConfig()?.isEliteWave ?? false,
            // 桥接是否已为当前生存波号启动了真实敌人（读 EnemySystem 内部状态）
            combatWave: enemySystemRef.current?.getCurrentWave() ?? -1,
            aliveEnemies: enemySystemRef.current?.getAliveCount() ?? -1,
          }),
          /** 吃掉当前倒计时（preparing / waveTransition），让下一波立即开始 */
          skipCountdown: () => survivalModeManager.update(12),
          /** 直接打死玩家，用于验证「阵亡 → 结算 → 入榜」链路。 */
          killPlayer: () => {
            const p = playerRef.current as unknown as {
              isInvulnerable: boolean;
              invulnerabilityEndTime: number;
              takeDamage: (n: number) => boolean;
              getHealth: () => number;
            } | null;
            if (!p) return;
            // 不能走 setInvincible(0)：它会把 isInvulnerable **置为 true**，
            // 要等下一帧 update 才清除，同步调用 takeDamage 会被当场挡掉。
            // 调试钩子直接清标记（同 __skillDebug 穿透私有字段的做法）。
            p.isInvulnerable = false;
            p.invulnerabilityEndTime = 0;
            // 闪避是概率型的（Build 修饰符），一次可能被闪掉，连打几次确保致死
            for (let i = 0; i < 8 && p.getHealth() > 0; i++) {
              p.takeDamage(999999);
            }
          },
          clearHighScores: () => survivalModeManager.clearHighScores(),
        };
      }

      let frameCount = 0;
      let lastFpsUpdate = Date.now();

      engine.setUpdateCallback((dt: number) => {
        const gameState = useGameStore.getState();
        if (import.meta.env.DEV) {
          const d = (
            window as unknown as {
              __waveDiag?: { ticks: number; logicTicks: number; enemyUpdates: number };
            }
          ).__waveDiag;
          if (d) d.ticks++;
        }

        // 修饰符同步：**独立于「是否暂停」**。
        //
        // 它只依赖 BuildSystem 与 SkillTreeManager 的状态，属于状态派生而非游戏逻辑，
        // 暂停时也应保持一致。放在暂停判断内曾有一个真实后果：波次完成会弹出三选一
        // 强化**并暂停游戏**，而玩家正是在这个窗口里加点，加成要等关掉弹窗、游戏恢复
        // 才推得进去。
        //
        // 两条强化线在这一处合并：**局内**三选一（BuildSystem）+ **跨局**技能树
        // （SkillTreeManager → SkillBonusAdapter）。合并刻意放在调用侧而不是
        // BuildSystem 内部，让两条线各自单一职责、互不感知。
        //
        // 每帧重新构造对象（getStats / getPlayerModifiers 都返回新对象）与改动前
        // 的开销同量级：都是几十个小字段的浅对象，对 60fps 无实际影响。
        //
        // 三条线的合并顺序固定为 **局内三选一 → 技能树 → 元进度（最外层乘区）**。
        // 顺序只影响浮点末位，但固定下来才好推理：元进度是「永久全局加成」，
        // 语义上就该在所有其它加成之上再乘一次。
        if (playerRef.current && buildSystemRef.current) {
          const skillStats = skillTreeManager.getStats();
          const meta = metaBonusesRef.current;
          playerRef.current.setBuildModifiers(
            applyMetaBonusesToPlayer(
              applySkillBonusesToPlayer(
                buildSystemRef.current.getPlayerModifiers(),
                skillStats,
                skillBaseStats.maxHealth,
              ),
              meta,
            ),
          );
          // 护盾上限不在 PlayerModifiers 里（它只描述回复速率），单独推。
          // 先技能百分比（作用于**关卡基础护盾**），再元进度（舰体绝对值 + 模块倍率）。
          playerRef.current.setMaxShield(
            applyMetaBonusesToShield(
              computeSkillMaxShield(skillBaseStats.maxShield, skillStats),
              meta,
            ),
          );
          // 加速能量上限同样不在 PlayerModifiers 里
          playerRef.current.setMaxBoostEnergy(
            applyMetaBonusesToMaxBoostEnergy(skillBaseStats.maxBoostEnergy, meta),
          );
          if (weaponSystemRef.current) {
            weaponSystemRef.current.setBuildModifiers(
              applyMetaBonusesToWeapon(
                applySkillBonusesToWeapon(buildSystemRef.current.getWeaponModifiers(), skillStats),
                meta,
              ),
            );
          }
        }

        if (!gameState.isGamePaused && gameState.isSceneReady && playerRef.current) {
          if (import.meta.env.DEV) {
            const d = (
              window as unknown as {
                __waveDiag?: { ticks: number; logicTicks: number; enemyUpdates: number };
              }
            ).__waveDiag;
            if (d) d.logicTicks++;
          }

          playerRef.current.update(dt, controlsRef.current);

          // 小行星自转更新（增强空间动态感）
          engineRef.current?.updateAsteroidField(dt);

          // boost 状态边沿检测：触发 FOV 变化和摄像机抖动，增强速度感
          const isBoosting = playerRef.current.isBoostingNow();
          if (isBoosting && !prevBoostRef.current) {
            cameraSystemRef.current?.zoom(75, 0.3); // FOV 拉大，增强速度感
            cameraSystemRef.current?.shake(0.08, 0.4, 30, 1.5); // 轻微抖动
          } else if (!isBoosting && prevBoostRef.current) {
            cameraSystemRef.current?.zoom(60, 0.5); // FOV 回正
          }
          prevBoostRef.current = isBoosting;
          // 动态摄像机偏移：boost 时拉远距离
          cameraSystemRef.current?.setDynamicOffset(playerRef.current.getSpeed() / 15, isBoosting);

          // 小行星碰撞检测（触发伤害和无敌帧）
          asteroidSystemRef.current?.update(dt);

          // 摄像机跟随更新（在玩家位置更新之后，确保追踪最新位置）
          if (cameraSystemRef.current) {
            cameraSystemRef.current.update(dt);
          }

          if (controlsRef.current.fire && weaponSystemRef.current) {
            weaponSystemRef.current.shoot();
            AudioManager.playSound('playerShoot', playerRef.current.getPosition());
          }

          if (weaponSystemRef.current) {
            weaponSystemRef.current.update(dt);
          }

          if (enemySystemRef.current) {
            enemySystemRef.current.update(dt);
            if (import.meta.env.DEV) {
              const d = (
                window as unknown as {
                  __waveDiag?: { ticks: number; logicTicks: number; enemyUpdates: number };
                }
              ).__waveDiag;
              if (d) d.enemyUpdates++;
            }
          }

          if (skillSystemRef.current) {
            skillSystemRef.current.update(dt);
          }

          if (weaponSystemRef.current && enemySystemRef.current) {
            const enemies = enemySystemRef.current.getEnemies();
            const hits = weaponSystemRef.current.checkCollisions(enemies);
            if (hits > 0) {
              AudioManager.playSound('enemyHit');
            }
            // 击杀结算统一走 EnemySystem 的 enemiesDefeated 回调：
            // 敌人无论死于子弹、技能还是其他来源，都会在下一帧开头被
            // EnemySystem 整体回调结算，保证波次计数不漏。
          }

          if (powerupSpawnerRef.current && playerRef.current) {
            powerupSpawnerRef.current.update(dt);
            const collected = powerupSpawnerRef.current.checkCollisions(
              playerRef.current,
              weaponSystemRef.current || undefined,
            );
            if (collected) {
              AudioManager.playSound('powerup');

              if (collected.getType() === 'scoreBonus') {
                useGameStore.getState().addScore(500);
              }

              if (gameplayManagerRef.current && gameplayManagerRef.current.isRunning()) {
                const engineType = collected.getType();
                const luaType = enginePowerupTypeToLua(engineType);
                if (luaType) {
                  gameplayManagerRef.current.applyPowerup(
                    luaType as
                      | 'health'
                      | 'shield'
                      | 'speed'
                      | 'damage'
                      | 'triple_shot'
                      | 'invincible'
                      | 'magnet'
                      | 'slow_time',
                  );
                }
              }
            }
          }

          if (gameplayManagerRef.current && gameplayManagerRef.current.isRunning()) {
            gameplayManagerRef.current.update(dt);
            const activePowerups = gameplayManagerRef.current.getActivePowerups();
            if (activePowerups.length > 0) {
              const storePowerups = activePowerups.map((p) => ({
                type: p.type,
                name: p.displayName || p.type,
                remainingTime: p.remainingDuration,
                duration: p.duration,
                value: p.multiplier || p.stacks || 0,
              }));
              useGameStore.getState().setActivePowerups(storePowerups);
            }
          }

          // 顺序要紧：**先推上限、再推当前值**。
          // updatePlayerHealth/Shield 会按 store 里的上限夹取，上限落后会让
          // 技能树/元进度抬起来的生命护盾在 HUD 上被截成默认值（100/50）。
          const vitals = useGameStore.getState();
          vitals.setPlayerMaxHealth(playerRef.current.getMaxHealth());
          vitals.setPlayerMaxShield(playerRef.current.getMaxShield());
          vitals.updatePlayerHealth(playerRef.current.getHealth());
          vitals.updatePlayerShield(playerRef.current.getShield());
          useGameStore.getState().setSpeed(playerRef.current.getSpeed());
          useGameStore.getState().setBoostActive(playerRef.current.isBoostActive());
          useGameStore.getState().setBoostEnergy(playerRef.current.getBoostEnergy());

          // 难度自适应：上报玩家生命并将倍率同步到敌人系统
          if (gameplayManagerRef.current && gameplayManagerRef.current.isRunning()) {
            gameplayManagerRef.current.reportPlayerHealth(
              playerRef.current.getHealth(),
              playerRef.current.getMaxHealth(),
            );
            const diffMultiplier = gameplayManagerRef.current.getDifficultyMultiplier();
            if (enemySystemRef.current) {
              enemySystemRef.current.setDifficultyMultiplier(diffMultiplier);
            }
            useGameStore
              .getState()
              .setDifficultyInfo(gameplayManagerRef.current.getDifficultySnapshot());
          }

          if (enemySystemRef.current) {
            useGameStore.getState().setEnemyCount(enemySystemRef.current.getAliveCount());
            useGameStore.getState().setWave(enemySystemRef.current.getCurrentWave());
            useGameStore.getState().setTotalWaves(enemySystemRef.current.getTotalWaves());
            useGameStore.getState().setWaveInfo({
              isBossWave: enemySystemRef.current.isBossWave(),
              isEliteWave: enemySystemRef.current.isEliteWave(),
              enemiesRemaining: enemySystemRef.current.getRemainingCount(),
            });
          }

          // 波间过渡：上一波清空后启动下一波。此前这里完全缺失，
          // 导致打完第 1 波后游戏永久静止、也永远无法通关。
          // 若正处于强化选择界面（游戏已暂停），不计时，等玩家选完再走。
          const waveTransition = waveTransitionRef.current;
          if (waveTransition.nextWave !== null && !useGameStore.getState().isUpgradeChoiceVisible) {
            waveTransition.timer -= dt;
            if (waveTransition.timer <= 0) {
              const nextWave = waveTransition.nextWave;
              waveTransition.nextWave = null;
              enemySystemRef.current?.startWave(nextWave);
              gameplayManagerRef.current?.startWave(nextWave);
              playWaveAudio(nextWave, enemySystemRef.current?.getTotalWaves() ?? 10);
              console.log(`[GameScene] Wave ${nextWave} started`);
            }
          }

          // ── 生存模式：由 SurvivalModeManager 的状态机驱动波次 ──
          // 它的 preparing（开局倒计时）与 waveTransition（波间倒计时）都在
          // update(dt) 里计时，归零后自行把 currentWave 加一并切到 playing。
          // 这里只做桥接：检出「波号前进」就让真实战斗系统启动对应波次 ——
          // 波次执行始终只有 WaveManager 一条路径，生存管理器不越权生成敌人。
          if (isSurvival) {
            survivalModeManager.update(dt);
            const sState = survivalModeManager.getState();
            const sWave = survivalModeManager.getStats().currentWave;
            if (sState === 'playing' && sWave > survivalWaveRef.current) {
              survivalWaveRef.current = sWave;
              enemySystemRef.current?.startWave(sWave);
              gameplayManagerRef.current?.startWave(sWave);
              playWaveAudioByBossFlag(
                survivalModeManager.getCurrentWaveConfig()?.isBossWave ?? false,
              );
              console.log(`[GameScene] Survival wave ${sWave} started`);
            }
          }

          useGameStore.getState().updateSkillCooldowns(dt);

          frameCount++;
          const now = Date.now();
          if (now - lastFpsUpdate >= 1000) {
            const currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
            useGameStore.getState().setFps(currentFps);
            frameCount = 0;
            lastFpsUpdate = now;

            // 成就的低频统计同步（1 Hz，与 FPS 刷新同频，不额外增加逐帧开销）。
            // 这三类统计的共同点是「连续量」，没有离散事件可挂：命中数、任务完成数、
            // 生存模式存活时长。离散事件（击杀 / 道具 / 技能 / Boss）都在各自的
            // 事件点即时上报，不在这里。
            const accuracy = weaponSystemRef.current?.getAccuracyStats();
            if (accuracy) {
              achievementSystem.setStats({
                shotsFired: accuracy.shotsFired,
                shotsHit: accuracy.shotsHit,
              });
            }

            const story = storyManagerRef.current;
            if (story) {
              achievementSystem.setStats({
                missionsCompleted: story.getProgressStats().completed,
              });
            }

            if (isSurvival) {
              // 只升不降：`survivalTime` 每局从 0 起，直接 set 会把上一局的最佳拍回去
              const survivalTime = survivalModeManager.getStats().survivalTime;
              if (survivalTime > achievementSystem.getStats().survivalBestTime) {
                achievementSystem.setStats({ survivalBestTime: survivalTime });
              }
            }
          }

          if (playerRef.current.getHealth() <= 0) {
            // 阵亡音走 globalAudio：onGameOver() 会让 App 立刻切到结算界面并卸载
            // GameScene（引擎随之销毁），挂在 PlayCanvas 上的音效会被当场掐断。
            // 失败音乐由 App 依据 gameState + isVictory 统一切换。
            globalAudio.playCue('playerExplosion');
            // 生存模式：先让生存管理器进入 gameOver —— 它的面板据此渲染结算界面
            // 与最高分榜，再由 App 决定路由（生存模式回 SURVIVAL 面板而不是战役结算）。
            if (isSurvival) {
              survivalModeManager.setGameOver();
            }
            onGameOver();
          }

          if (enemySystemRef.current && onLevelComplete && !levelCompleteFiredRef.current) {
            const enemies = enemySystemRef.current.getEnemies();
            const finalWaveCleared = finalWaveClearedRef.current;
            const noMoreWaves = waveTransitionRef.current.nextWave === null;

            // 末波「被清空」且场上已无敌人 → 关卡完成结算。
            // 注意判定依据是 finalWaveCleared（末波真正打完），而不是波号达到上限 ——
            // 后者会在末波刚启动、敌人尚未生成时就成立，导致跳过末波并卸载 GameScene。
            if (finalWaveCleared && noMoreWaves && enemies.length === 0) {
              levelCompleteFiredRef.current = true;
              console.log('[GameScene] Level complete: final wave cleared');
              // 成就口径的关卡结算：以**本关真实记录**为准，而不是「结算这一帧看起来没掉血」。
              // - 无伤：`PlayerShip.getDamageTaken()`（唯一受伤入口的累计，开局清零）
              // - 用时：关卡起始时间戳 → 秒
              // 注意两者语义不同：无伤是**累加**（多关无伤就多条），用时是**取最快**。
              const damageTaken = playerRef.current?.getDamageTaken() ?? 0;
              const elapsedSeconds =
                levelStartTimeRef.current > 0 ? (Date.now() - levelStartTimeRef.current) / 1000 : 0;
              achievementSystem.updateStats({ noDamageClears: damageTaken === 0 ? 1 : 0 });
              achievementSystem.setStats({ fastestClearSeconds: elapsedSeconds });
              console.log(
                `[Achievement] 关卡结算：受伤 ${damageTaken.toFixed(1)}、用时 ${elapsedSeconds.toFixed(1)}s` +
                  `（无伤 ${damageTaken === 0 ? '是' : '否'}）`,
              );
              // 关卡奖励结算（src/levels 的 rewards）：信用点走 CreditsStore，
              // 经验走 useGameStore.addExperience（等级由经验推导）。
              // 两者现在都有下游消费方 —— 不再是「记个日志假装发了」。
              if (levelConfig) {
                const before = getCredits();
                const after = addCredits(levelConfig.rewards.credits);
                const store = useGameStore.getState();
                const expBefore = store.player.experience;
                store.addExperience(levelConfig.rewards.experience);
                const storeAfter = useGameStore.getState();
                console.log(
                  `[GameScene] 关卡奖励：信用点 +${levelConfig.rewards.credits}（${before} → ${after}）；` +
                    `经验 +${levelConfig.rewards.experience}（${expBefore} → ${storeAfter.player.experience}，等级 ${storeAfter.player.level}）；` +
                    `解锁 ${levelConfig.rewards.unlocks.join('/') || '无'}`,
                );
              }
              // 同上：关卡完成会立刻卸载 GameScene，音刺必须走 globalAudio 才听得见；
              // 胜利音乐由 App 依据 gameState + isVictory 切换。
              globalAudio.playCue('levelComplete');
              onLevelComplete();
            }
          }
        }
      });

      engine.start();
      console.log('[GameScene] Engine started');

      useGameStore.getState().setTouchHandlers({
        onMove: handleTouchMove,
        onFire: handleTouchFire,
        onBoost: handleTouchBoost,
        onSkill1: handleTouchSkill1,
        onSkill2: handleTouchSkill2,
        onSkill3: handleTouchSkill3,
        onSkill4: handleTouchSkill4,
      });

      const initTimer = setTimeout(() => {
        useGameStore.getState().setLoading(false);
        console.log('[GameScene] Engine initialization complete');

        // 自动聚焦canvas，确保键盘输入能正常工作
        if (canvasRef.current) {
          canvasRef.current.focus();
          console.log('[GameScene] Canvas focused');
        }
      }, 500);

      return () => {
        console.warn('[GameScene] Cleanup: React 卸载 → 即将销毁引擎（此后 rAF/tick 链会停止）');
        clearTimeout(initTimer);

        // 生存模式的波次接管权随本组件一起交还，否则下一局（战役）会被残留的
        // externalControl 影响波次判定。
        if (isSurvival) {
          survivalModeManager.setExternalControl(false);
        }

        AudioManager.stopMusic();
        AudioManager.destroy();

        if (powerupSpawnerRef.current) {
          powerupSpawnerRef.current.clearAll();
          powerupSpawnerRef.current = null;
        }

        // 清理后处理系统和小行星碰撞系统
        if (vfxSystemRef.current) {
          vfxSystemRef.current.dispose();
          vfxSystemRef.current = null;
        }
        if (asteroidSystemRef.current) {
          asteroidSystemRef.current.destroy();
          asteroidSystemRef.current = null;
        }

        if (engineRef.current) {
          engineRef.current.destroy();
          engineRef.current = null;
        }
      };
    } catch (error) {
      console.error('[GameScene] Initialization failed:', error);
      useGameStore.getState().setError('游戏初始化失败: ' + (error as Error).message);
      useGameStore.getState().setLoading(false);
      return () => {};
    }
  }, [
    onGameOver,
    onLevelComplete,
    isSurvival,
    levelIndex,
    handleTouchMove,
    handleTouchFire,
    handleTouchBoost,
    handleTouchSkill1,
    handleTouchSkill2,
    handleTouchSkill3,
    handleTouchSkill4,
  ]);

  useEffect(() => {
    // 使用 ref 守卫，避免 isEngineInitialized 状态变化触发 cleanup 导致引擎被销毁
    if (isCanvasReady && !initStartedRef.current) {
      initStartedRef.current = true;
      console.log('[GameScene] Canvas ready, initializing engine...');
      const cleanupPromise = initializeEngine();
      return () => {
        cleanupPromise?.then((cleanup) => cleanup?.());
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCanvasReady]);

  // 独立的键盘事件处理，确保在整个游戏期间都有效
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        // WASD = 节流(W/S) + 偏航(A/D)
        case 'KeyW':
          controlsRef.current.up = true;
          e.preventDefault();
          break;
        case 'KeyS':
          controlsRef.current.down = true;
          e.preventDefault();
          break;
        case 'KeyA':
          controlsRef.current.left = true;
          e.preventDefault();
          break;
        case 'KeyD':
          controlsRef.current.right = true;
          e.preventDefault();
          break;
        // 方向键 = 俯仰(↑↓) + 滚转(←→)，实现六自由度飞行控制
        case 'ArrowUp':
          controlsRef.current.pitchUp = true;
          e.preventDefault();
          break;
        case 'ArrowDown':
          controlsRef.current.pitchDown = true;
          e.preventDefault();
          break;
        case 'ArrowLeft':
          controlsRef.current.rollLeft = true;
          e.preventDefault();
          break;
        case 'ArrowRight':
          controlsRef.current.rollRight = true;
          e.preventDefault();
          break;
        case 'Space':
          controlsRef.current.boost = true;
          e.preventDefault();
          break;
        case 'KeyJ':
          controlsRef.current.fire = true;
          e.preventDefault();
          break;
        case 'KeyQ':
          if (skillSystemRef.current) {
            skillSystemRef.current.activateSkill(SkillType.MISSILE_STRIKE);
            useGameStore.getState().setSkillCooldown('skill1', 8);
            audioManagerRef.current?.playSound('weaponUpgrade');
          }
          break;
        case 'KeyE':
          if (skillSystemRef.current) {
            skillSystemRef.current.activateSkill(SkillType.SHIELD_BURST);
            useGameStore.getState().setSkillCooldown('skill2', 10);
            audioManagerRef.current?.playSound('shieldActivate');
          }
          break;
        case 'KeyT':
          if (skillSystemRef.current) {
            skillSystemRef.current.activateSkill(SkillType.TIME_SLOW);
            useGameStore.getState().setSkillCooldown('skill3', 15);
          }
          break;
        case 'KeyG':
          if (skillSystemRef.current) {
            skillSystemRef.current.activateSkill(SkillType.OVERDRIVE);
            useGameStore.getState().setSkillCooldown('skill4', 20);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
          controlsRef.current.up = false;
          break;
        case 'KeyS':
          controlsRef.current.down = false;
          break;
        case 'KeyA':
          controlsRef.current.left = false;
          break;
        case 'KeyD':
          controlsRef.current.right = false;
          break;
        case 'ArrowUp':
          controlsRef.current.pitchUp = false;
          break;
        case 'ArrowDown':
          controlsRef.current.pitchDown = false;
          break;
        case 'ArrowLeft':
          controlsRef.current.rollLeft = false;
          break;
        case 'ArrowRight':
          controlsRef.current.rollRight = false;
          break;
        case 'Space':
          controlsRef.current.boost = false;
          break;
        case 'KeyJ':
          controlsRef.current.fire = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const skills = useMemo(
    () => [
      {
        name: '导弹打击',
        icon: 'missile',
        cooldown: skillCooldowns.skill1,
        maxCooldown: skillMaxCooldowns.skill1,
        keyBinding: 'Q',
        isActive: false,
      },
      {
        name: '护盾爆发',
        icon: 'shield',
        cooldown: skillCooldowns.skill2,
        maxCooldown: skillMaxCooldowns.skill2,
        keyBinding: 'E',
        isActive: false,
      },
      {
        name: '时间减缓',
        icon: 'clock',
        cooldown: skillCooldowns.skill3,
        maxCooldown: skillMaxCooldowns.skill3,
        keyBinding: 'T',
        isActive: false,
      },
      {
        name: '过载驱动',
        icon: 'zap',
        cooldown: skillCooldowns.skill4,
        maxCooldown: skillMaxCooldowns.skill4,
        keyBinding: 'G',
        isActive: false,
      },
    ],
    [skillCooldowns, skillMaxCooldowns],
  );

  const handleSkillActivate = useCallback((index: number) => {
    if (!skillSystemRef.current) return;

    const skillTypes: SkillType[] = [
      'missile_strike',
      'shield_burst',
      'time_slow',
      'overdrive',
    ] as SkillType[];
    const skillKeys = ['skill1', 'skill2', 'skill3', 'skill4'];
    const cooldowns = [8, 10, 15, 20];

    skillSystemRef.current.activateSkill(skillTypes[index]);
    useGameStore.getState().setSkillCooldown(skillKeys[index], cooldowns[index]);
  }, []);

  const hudProps = useMemo(
    () => ({
      health: playerHealth,
      maxHealth: playerMaxHealth,
      shield: playerShield,
      maxShield: playerMaxShield,
      score: playerScore,
      level: playerLevel,
      wave: currentWave,
      totalWaves: totalWaves,
      endless: isSurvival,
      enemiesRemaining: enemyCount,
      fps: fps,
      skills,
      onSkillActivate: handleSkillActivate,
      speed: playerSpeed,
      isBoostActive: isBoostActive,
      boostEnergy: playerBoostEnergy,
      maxBoostEnergy: playerMaxBoostEnergy,
      combo,
      maxCombo,
      rank,
      killCount,
      isBossWave,
      isEliteWave,
      activeEffects: activePowerups.map((p) => ({
        type: p.type,
        icon: p.type,
        remainingTime: p.remainingTime,
        duration: p.duration,
        value: p.value,
      })),
    }),
    [
      playerHealth,
      playerMaxHealth,
      playerShield,
      playerMaxShield,
      playerScore,
      playerLevel,
      currentWave,
      totalWaves,
      isSurvival,
      enemyCount,
      fps,
      skills,
      handleSkillActivate,
      playerSpeed,
      isBoostActive,
      playerBoostEnergy,
      playerMaxBoostEnergy,
      combo,
      maxCombo,
      rank,
      killCount,
      isBossWave,
      isEliteWave,
      activePowerups,
    ],
  );

  return (
    <div className="game-scene">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        tabIndex={0}
        onClick={(e) => e.currentTarget.focus()}
      />

      {isSceneReady && <GameHUD {...hudProps} />}

      {isSceneReady && storyManager && <QuestTracker manager={storyManager} />}

      {isSceneReady && currentDialogue && (
        <DialogueSystem dialogue={currentDialogue} onComplete={() => setCurrentDialogue(null)} />
      )}

      {isLoading && <LoadingOverlay />}

      {isSceneReady && isGamePaused && <PauseOverlay />}

      {isSceneReady && isUpgradeChoiceVisible && pendingUpgradeChoices && (
        <UpgradeChoiceOverlay
          choices={pendingUpgradeChoices}
          timer={upgradeChoiceTimer}
          onSelect={handleUpgradeSelect}
          resonances={activeResonances}
        />
      )}

      {isSceneReady && (
        <TouchControlOverlay
          onMove={handleTouchMove}
          onFire={handleTouchFire}
          onBoost={handleTouchBoost}
          onSkill1={handleTouchSkill1}
          onSkill2={handleTouchSkill2}
          onSkill3={handleTouchSkill3}
          onSkill4={handleTouchSkill4}
          skillCooldowns={skillCooldowns}
          skillMaxCooldowns={skillMaxCooldowns}
        />
      )}
    </div>
  );
});

GameScene.displayName = 'GameScene';

export default GameScene;
