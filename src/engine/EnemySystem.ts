import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { Enemy, EnemyType, CapitalShip, EnemyProjectile } from './Enemy';
import { VoidLordBoss } from './VoidLordBoss';
import { WaveManager } from '../lua/wave/WaveManager';
import { StoryMissionManager } from './StoryMissionManager';
import type { EnemyConfig as WaveEnemyConfig } from '../lua/wave/WaveManager';
import { ENEMY_SPAWN, PROJECTILE_CULL_RADIUS } from './arena';
import { SquadManager } from './SquadManager';

export type PowerupDropCallback = (position: pc.Vec3, enemyType: EnemyType) => void;

/** 阵亡敌人整体回调：每帧把本帧所有阵亡敌人一次性交给上层统一结算 */
export type EnemiesDefeatedCallback = (enemies: Enemy[]) => void;

export class EnemySystem {
  private engine: PlayCanvasGameEngine;
  private player: PlayerShip;
  private enemies: Enemy[] = [];
  private enemyProjectiles: EnemyProjectile[] = [];
  private waveManager: WaveManager;
  private storyManager: StoryMissionManager | null = null;
  private spawnTimer: number = 0;
  private spawnInterval: number = 1500;
  private waveActive: boolean = false;
  private powerupDropCallback: PowerupDropCallback | null = null;
  private enemiesDefeatedCallback: EnemiesDefeatedCallback | null = null;
  private dropRate: number = 0.15;
  /** 难度自适应倍率（缩放敌人生命/速度/伤害/生成间隔） */
  private difficultyMultiplier: number = 1.0;
  private globalTimeScale: number = 1.0;
  /** v2.8 集群战术网：小队编队 / 威胁 / 队形 */
  private squadManager: SquadManager = new SquadManager();
  /** 编入小队的敌人 id（未编队的敌人不在此表中） */
  private enemyIds: Map<Enemy, string> = new Map();
  private enemyIdCounter: number = 0;
  /** 本次波次的编组游标：上一队满员后新建队 */
  private currentSquadId: string | null = null;
  private currentSquadSize: number = 0;
  /** 每队规模（同一次波次刷出的 4 架） */
  private readonly squadSize: number = 4;
  /** 本波次敌机损失数，用于战斗结束时的编队权重进化 */
  private waveLosses: number = 0;

  constructor(
    engine: PlayCanvasGameEngine,
    player: PlayerShip,
    waveManager?: WaveManager,
    storyManager?: StoryMissionManager,
  ) {
    this.engine = engine;
    this.player = player;
    this.waveManager = waveManager || (null as unknown as WaveManager);
    if (storyManager) this.storyManager = storyManager;
  }

  public setWaveManager(manager: WaveManager): void {
    this.waveManager = manager;
  }

  public startWave(waveNumber: number): void {
    if (!this.waveManager) {
      console.warn('[EnemySystem] WaveManager not set');
      return;
    }

    const result = this.waveManager.startWave(waveNumber);
    if (result.success) {
      this.waveActive = true;
      this.spawnTimer = this.spawnInterval;
      // 新波次从头编组，避免跨波次把残余敌机和新刷敌机混进同一队
      this.currentSquadId = null;
      this.currentSquadSize = 0;
      const r = result as { enemyCount: number; isBossWave: boolean };
      // 基础生成间隔随波次递减；难度倍率越高，生成越快（除以倍率），但不低于 350ms
      const baseInterval = r.isBossWave ? 2500 : Math.max(500, 1500 - waveNumber * 80);
      this.spawnInterval = Math.max(350, Math.round(baseInterval / this.difficultyMultiplier));
      console.log(
        `[EnemySystem] Wave ${waveNumber} started: ${r.enemyCount} enemies (difficulty x${this.difficultyMultiplier.toFixed(2)})`,
      );
    }
  }

  public update(dt: number): void {
    const scaledDt = dt * this.globalTimeScale;

    // 先把本帧阵亡的敌人整体回调给上层结算，再从数组移除。
    // 此前 filter 直接丢弃死敌，非武器击杀（技能/撞击/调试钩子）永远漏结算，
    // 导致波次计数不推进、游戏打完一波就静止。
    if (this.enemies.some((enemy) => !enemy.isAlive())) {
      const deadEnemies = this.enemies.filter((enemy) => !enemy.isAlive());
      this.enemies = this.enemies.filter((enemy) => enemy.isAlive());
      // 阵亡成员同步退出小队，并摘掉编队目标
      deadEnemies.forEach((enemy) => this.unregisterSquadMember(enemy));
      if (deadEnemies.length > 0) {
        this.enemiesDefeatedCallback?.(deadEnemies);
      }
    }

    if (this.waveActive && this.waveManager) {
      this.spawnTimer += scaledDt * 1000;

      if (this.spawnTimer >= this.spawnInterval) {
        const spawnResult = this.waveManager.spawnNextEnemy();

        if (spawnResult.success) {
          const r = spawnResult as { enemy: WaveEnemyConfig };
          this.spawnEnemy(r.enemy);
          this.spawnTimer -= this.spawnInterval;
        }
      }

      this.waveManager.update(dt);
    }

    // 编队槽位先于敌机行为更新：本帧 AI 读到的就是最新槽位
    this.updateSquadFormations(scaledDt);

    this.enemies.forEach((enemy) => {
      enemy.update(scaledDt);
      if (enemy instanceof CapitalShip || enemy instanceof VoidLordBoss) {
        const newProjectiles = (enemy as any).consumeNewProjectiles();
        this.enemyProjectiles.push(...newProjectiles);
      }
    });

    // 更新敌方子弹
    this.enemyProjectiles = this.enemyProjectiles.filter((proj) => {
      if (!proj.active) {
        proj.entity.destroy();
        return false;
      }

      proj.update(scaledDt);

      // 碰撞检测：与玩家碰撞
      const projPos = proj.entity.getPosition();
      const playerPos = this.player.getPosition();
      const dist = projPos.clone().sub(playerPos).length();

      if (dist < 1.5) {
        this.player.takeDamage(proj.damage);
        proj.active = false;
        return false;
      }

      // 2026 Tech: 敌方子弹也能误伤 NPC (Faction Conflict)
      const npcManager = (this.engine.getApp() as any)['npcManager'];
      if (npcManager) {
        const npcs = npcManager.getNPCs();
        for (const npc of npcs) {
          const npcPos = npc.getPosition();
          const npcDist = projPos.clone().sub(npcPos).length();
          if (npcDist < 2.0) {
            npc.takeDamage?.(proj.damage); // NPC 需要实现 takeDamage
            proj.active = false;
            return false;
          }
        }
      }

      if (projPos.length() > PROJECTILE_CULL_RADIUS) {
        proj.entity.destroy();
        return false;
      }

      return true;
    });

    if (this.waveActive && this.waveManager) {
      const state = this.waveManager.getWaveState();
      if (
        state.currentState === 'completed' ||
        (state.enemiesRemaining === 0 && this.enemies.length === 0)
      ) {
        this.waveActive = false;
        // 波次结算：把损失折算进敌对派系权重并持久化（v2.8 进化式行为学习）
        if (this.waveLosses > 0) {
          this.squadManager.recordBattleResult({
            factionId: 'hostile',
            kills: 0,
            losses: this.waveLosses,
          });
        }
        this.waveLosses = 0;
        console.log(`[EnemySystem] Wave completed`);
      }
    }
  }

  private enemyTypeFromString(type: string): EnemyType {
    const typeMap: Record<string, EnemyType> = {
      scout: EnemyType.SCOUT,
      fighter: EnemyType.FIGHTER,
      bomber: EnemyType.BOMBER,
      tank: EnemyType.TANK,
      assassin: EnemyType.ASSASSIN,
      drone: EnemyType.DRONE,
      elite: EnemyType.ELITE,
      corvette: EnemyType.CORVETTE,
      destroyer: EnemyType.DESTROYER,
      boss_sentinel: EnemyType.BOSS_SENTINEL,
      boss_overlord: EnemyType.BOSS_OVERLORD,
      boss: EnemyType.BOSS,
      basic: EnemyType.FIGHTER,
      assault: EnemyType.ASSAULT,
      sniper: EnemyType.SNIPER,
      swarm: EnemyType.SWARM,
      static_outpost: EnemyType.STATIC_OUTPOST,
      cruiser: EnemyType.CRUISER,
      void_lord: EnemyType.VOID_LORD,
    };
    return typeMap[type] || EnemyType.FIGHTER;
  }

  private spawnEnemy(waveConfig: WaveEnemyConfig): void {
    const type = this.enemyTypeFromString(waveConfig.type);

    // 3D 球面均匀分布：使用 theta + phi 球坐标，让敌人在 Y 轴也随机分布。
    // 生成环半径与 Y 限幅的唯一真源是 arena.ts 的 ENEMY_SPAWN —— 它们必须与
    // PLAYER_BOUNDS 同比例，否则场地放大后敌机会全部挤在中心，玩家跑到边缘就
    // 「敌人在背后冒出来」。
    const spawnRadius =
      ENEMY_SPAWN.ringInner + Math.random() * (ENEMY_SPAWN.ringOuter - ENEMY_SPAWN.ringInner);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1); // 球面均匀分布
    const x = Math.cos(theta) * Math.sin(phi) * spawnRadius;
    // Y 范围稍小（×0.6），避免极端垂直位置，并限制在玩家可达范围
    const y = Math.sin(theta) * Math.sin(phi) * spawnRadius * 0.6;
    const z = Math.cos(phi) * spawnRadius;
    const clampedY = Math.max(-ENEMY_SPAWN.yLimit, Math.min(ENEMY_SPAWN.yLimit, y));

    const config = {
      engine: this.engine,
      type,
      position: new pc.Vec3(x, clampedY, z),
      player: this.player,
      difficultyMultiplier: this.difficultyMultiplier,
    };

    let enemy: Enemy;
    if (this.isCapitalType(type) && this.hasLiveCapitalShip()) {
      // 同屏母舰上限 1（v2.8 Phase 2）：超编时降级为同类型的常规敌机，
      // 保留 enemyType 以维持关卡目标判定，但不占用母舰性能预算。
      console.log('[EnemySystem] Capital ship cap reached (1), downgrading to escort');
      enemy = new Enemy(config);
    } else if (type === EnemyType.VOID_LORD) {
      enemy = new VoidLordBoss(config);
    } else if (type === EnemyType.CRUISER) {
      enemy = new CapitalShip(config);
    } else {
      enemy = new Enemy(config);
    }

    this.enemies.push(enemy);
    this.registerSquadMember(enemy, type);
  }

  private isCapitalType(type: EnemyType): boolean {
    return type === EnemyType.VOID_LORD || type === EnemyType.CRUISER;
  }

  /** 场上是否已有存活的母舰级单位（同屏上限 1 的唯一判据） */
  private hasLiveCapitalShip(): boolean {
    return this.enemies.some(
      (enemy) => enemy.isAlive() && (enemy instanceof CapitalShip || enemy instanceof VoidLordBoss),
    );
  }

  /**
   * 编入小队：同一次波次刷出的普通敌机每 4 架一队；Boss / 巡洋舰不编队。
   * 上一队满员、不存在或已全员阵亡时新建队。
   */
  private registerSquadMember(enemy: Enemy, type: EnemyType): void {
    if (type === EnemyType.VOID_LORD || type === EnemyType.CRUISER) return;

    this.enemyIdCounter += 1;
    const id = `enemy_${this.enemyIdCounter}`;
    this.enemyIds.set(enemy, id);

    const needNewSquad =
      this.currentSquadId === null ||
      this.currentSquadSize >= this.squadSize ||
      this.squadManager.getMemberCount(this.currentSquadId) === 0;

    if (needNewSquad) {
      this.currentSquadId = this.squadManager.createSquad('hostile', [id]);
      this.currentSquadSize = 1;
      return;
    }

    this.squadManager.addMember(this.currentSquadId as string, id);
    this.currentSquadSize += 1;
  }

  /** 阵亡敌人退出编队：摘掉编队目标、移出小队、清理 id 映射 */
  private unregisterSquadMember(enemy: Enemy): void {
    const id = this.enemyIds.get(enemy);
    if (!id) return;

    enemy.getAI().setFormationTarget(null);
    this.squadManager.removeMember(id);
    this.enemyIds.delete(enemy);
    this.waveLosses += 1;
  }

  /** 每帧同步编队槽位到各敌机 AI（无编队成员时为零开销） */
  private updateSquadFormations(dt: number): void {
    if (this.enemyIds.size === 0) return;

    const anchor = this.player.getPosition();
    const playerForward = this.player.getForward();
    // 玩家前向退化时用世界 -Z 兜底，保证队形基准始终有效
    const hasForward =
      playerForward &&
      playerForward.x * playerForward.x +
        playerForward.y * playerForward.y +
        playerForward.z * playerForward.z >
        1e-6;
    const forward = hasForward ? playerForward : new pc.Vec3(0, 0, -1);

    this.squadManager.update(dt, anchor, forward);

    // 每帧把敌对派系的进化权重灌给每个敌机 AI，让"越打越聪明"即时生效
    const hostileWeights = this.squadManager.getWeights('hostile');
    this.enemies.forEach((enemy) => {
      if (!enemy.isAlive()) return;
      enemy.getAI().setWeights(hostileWeights);

      const id = this.enemyIds.get(enemy);
      if (!id) return;

      const slot = this.squadManager.getSlot(id);
      enemy.getAI().setFormationTarget(slot ?? null);
    });
  }

  /**
   * 2026 Tech: 允许其他系统（如巨型母舰）在运行时生成敌机实例。
   */
  public spawnEnemyInstance(type: EnemyType, position: pc.Vec3): Enemy {
    const config = {
      engine: this.engine,
      type,
      position,
      player: this.player,
      difficultyMultiplier: this.difficultyMultiplier,
    };

    let enemy: Enemy;
    if (this.isCapitalType(type) && this.hasLiveCapitalShip()) {
      enemy = new Enemy(config);
    } else if (type === EnemyType.VOID_LORD) {
      enemy = new VoidLordBoss(config);
    } else if (type === EnemyType.CRUISER) {
      enemy = new CapitalShip(config);
    } else {
      enemy = new Enemy(config);
    }

    this.enemies.push(enemy);
    return enemy;
  }

  /**
   * 2026 Tech: 生成特定的静态目标（如前哨站、基地核心）
   */
  public spawnStaticTarget(type: EnemyType, position: pc.Vec3): Enemy {
    const config = {
      engine: this.engine,
      type,
      position,
      player: this.player,
      difficultyMultiplier: this.difficultyMultiplier,
    };
    const enemy =
      type === EnemyType.CRUISER && !this.hasLiveCapitalShip()
        ? new CapitalShip(config)
        : new Enemy(config);
    this.enemies.push(enemy);
    return enemy;
  }

  /** 设置难度自适应倍率（由 GameScene 每帧同步） */
  public setDifficultyMultiplier(multiplier: number): void {
    this.difficultyMultiplier = multiplier > 0 ? multiplier : 1.0;
  }

  /** 设置全局时间缩放系数 */
  public setGlobalTimeScale(scale: number): void {
    this.globalTimeScale = Math.max(0, scale);
  }

  /**
   * 单个敌人阵亡时的本地处理：返回该敌人的基础分（供上层统计），并按概率掉落道具。
   *
   * 注意：这里**不推进波次**。波次推进由 GameplayManager.onEnemyKilled 统一负责
   * （GameplayManager 持有 WaveManager）。此前这里也调用过 waveManager.onEnemyDefeated，
   * 与 GameplayManager 侧重复，一次击杀把 enemiesRemaining 扣两次，波次会提前完成。
   */
  public onEnemyKilled(enemy: Enemy): number {
    const score = 100;

    // 2026 Tech: 更新任务进度
    if (this.storyManager) {
      const activeMissions = this.storyManager.getActiveMissions();
      activeMissions.forEach((m) => {
        const targetType = enemy.getType();
        // 如果任务有特定目标且匹配，或者没有特定目标（普通击杀任务）
        const objective = m.objectives.find(
          (o) =>
            o.type === 'destroy' &&
            (!o.target ||
              o.target === targetType ||
              (o.target === 'outpost_core' && targetType === EnemyType.STATIC_OUTPOST)),
        );

        if (objective) {
          this.storyManager?.incrementObjective(m.mission.id, 'destroy', 1);
        }
      });
    }

    if (this.powerupDropCallback) {
      const isBoss = enemy.getType().includes('boss') || enemy.getType() === EnemyType.BOSS;
      const isElite = enemy.getType() === EnemyType.ELITE;
      const dropChance = isBoss ? 1.0 : isElite ? 0.5 : this.dropRate;
      if (Math.random() < dropChance) {
        this.powerupDropCallback(enemy.getPosition(), enemy.getType());
      }
    }

    // v2.8 Phase 2：击毁母舰级单位 → 满额掉落 + 派系声望大幅变动
    if (enemy instanceof CapitalShip || enemy instanceof VoidLordBoss) {
      for (let i = 0; i < 3; i++) {
        this.powerupDropCallback?.(enemy.getPosition(), enemy.getType());
      }
      const factionId = enemy instanceof VoidLordBoss ? 'void_cult' : 'scavengers';
      const factionManager = (this.engine.getApp() as any)?.['factionManager'] as
        { addReputation: (id: string, amount: number) => void } | undefined;
      factionManager?.addReputation(factionId, -15);
      console.log(
        `[EnemySystem] Capital ship destroyed: ${enemy.getType()} (rep -15 ${factionId})`,
      );
    }

    return score;
  }

  public setPowerupDropCallback(callback: PowerupDropCallback): void {
    this.powerupDropCallback = callback;
  }

  public setEnemiesDefeatedCallback(callback: EnemiesDefeatedCallback): void {
    this.enemiesDefeatedCallback = callback;
  }

  public setDropRate(rate: number): void {
    this.dropRate = Math.max(0, Math.min(1, rate));
  }

  public getEnemies(): Enemy[] {
    return this.enemies;
  }

  /** v2.8 集群战术网：供上层查询 / 结算小队状态 */
  public getSquadManager(): SquadManager {
    return this.squadManager;
  }

  public getAliveCount(): number {
    return this.enemies.filter((e) => e.isAlive()).length;
  }

  public getCurrentWave(): number {
    if (!this.waveManager) return 1;
    return this.waveManager.getWaveState().waveNumber;
  }

  public getTotalWaves(): number {
    if (!this.waveManager) return 10;
    return this.waveManager.getWaveState().maxWaves;
  }

  public getRemainingCount(): number {
    if (!this.waveManager) return this.enemies.length;
    const state = this.waveManager.getWaveState();
    return state.enemiesRemaining;
  }

  public isBossWave(): boolean {
    if (!this.waveManager) return false;
    return this.waveManager.getWaveState().isBossWave;
  }

  public isEliteWave(): boolean {
    if (!this.waveManager) return false;
    return this.waveManager.getWaveState().isEliteWave;
  }

  public isWaveActive(): boolean {
    return this.waveActive;
  }

  public destroyAll(): void {
    this.enemies.forEach((enemy) => enemy.destroy());
    this.enemies = [];
    this.enemyIds.clear();
    this.currentSquadId = null;
    this.currentSquadSize = 0;
    this.squadManager.destroy();
  }

  public reset(): void {
    this.destroyAll();
    this.waveActive = false;
    this.spawnTimer = 0;
    if (this.waveManager) {
      this.waveManager.reset();
    }
  }

  public pause(): void {
    if (this.waveManager) {
      this.waveManager.pauseWave();
    }
  }

  public resume(): void {
    if (this.waveManager) {
      this.waveManager.resumeWave();
    }
  }
}
