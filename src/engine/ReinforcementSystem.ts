import * as pc from 'playcanvas';
import { PluginContext } from './PluginSystem';
import { FactionId, FactionManager } from './FactionManager';
import { NPCManager } from './NPCManager';
import { GalaxyManager } from './GalaxyManager';
import { PlayerShip } from './PlayerShip';
import { EnemyType } from './Enemy';

/**
 * 2026 Tech: 援军系统。
 * 负责在战斗过程中根据战略态势和玩家表现，动态折跃进场支持力量。
 */
export class ReinforcementSystem {
  public name = 'ReinforcementSystem';
  public version = '2.7.0';

  private context: PluginContext | null = null;
  private npcManager: NPCManager | null = null;
  private factionManager: FactionManager | null = null;
  private galaxyManager: GalaxyManager | null = null;
  private player: PlayerShip | null = null;

  private checkTimer: number = 0;
  private readonly CHECK_INTERVAL: number = 10.0; // 每 10 秒检查一次

  public init(context: PluginContext): void {
    this.context = context;
    this.npcManager = (context.app as any)['npcManager'];
    this.factionManager = (context.app as any)['factionManager'];
    this.galaxyManager = (context.app as any)['galaxyManager'];
    this.player = (context.app as any)['player'];

    console.log('[ReinforcementSystem] Tactical Reinforcement System initialized.');
  }

  private ensureDependencies(): boolean {
    if (!this.context) return false;

    if (!this.npcManager) {
      this.npcManager = (this.context.app as any)['npcManager'];
    }

    if (!this.factionManager) {
      this.factionManager = (this.context.app as any)['factionManager'];
    }

    if (!this.galaxyManager) {
      this.galaxyManager = (this.context.app as any)['galaxyManager'];
    }

    if (!this.player) {
      this.player = (this.context.app as any)['player'];
    }

    return !!(this.player && this.npcManager && this.galaxyManager);
  }

  public update(dt: number): void {
    this.checkTimer += dt;
    if (this.checkTimer >= this.CHECK_INTERVAL) {
      this.checkTimer = 0;
      if (this.ensureDependencies()) {
        this.evaluateBattleSituation();
      }
    }
  }

  /**
   * 评估战场局势，决定是否触发援军。
   * @param forceInvasion 是否强制触发敌方入侵援军 (用于母舰阶段转换)
   */
  public evaluateBattleSituation(forceInvasion: boolean = false): void {
    // ensureDependencies 已经保证了这些存在
    const galaxyManager = this.galaxyManager!;

    const currentSectorId = galaxyManager.getCurrentSector()?.id;
    if (!currentSectorId) return;

    // 1. 强制触发逻辑 (2.8 核心特性：阶段联动)
    if (forceInvasion) {
      const hostileFactions: FactionId[] = ['void_cult', 'scavengers'];
      const faction = hostileFactions[Math.floor(Math.random() * hostileFactions.length)];
      this.triggerEnemyReinforcements(faction);
      return;
    }

    // 2026 Tech: 获取战略 AI 的深度状态
    const strategicAI = (this.galaxyManager as any)?.getStrategicAI();
    const activeEvents = strategicAI?.getActiveEvents() || [];
    const localEvent = activeEvents.find(
      (e: { targetSectorId: string }) => e.targetSectorId === currentSectorId,
    );

    // 1. 玩家陷入苦战 (生命值低于 40% 且周围敌人多)
    const playerHealthPct =
      (this.player as any)?.getHealth() / (this.player as any)?.getMaxHealth();
    const enemySystem = (this.context?.app as any)?.['enemySystem'];
    const nearbyEnemies = enemySystem?.getEnemies().length || 0;

    if (playerHealthPct < 0.4 && nearbyEnemies > 3) {
      this.triggerFriendlyReinforcements();
      return;
    }

    // 2. 战略入侵触发敌方援军
    if (localEvent && localEvent.type === 'invasion' && Math.random() < 0.2) {
      // 如果入侵进度过半，极大概率派驻大型舰船
      if (localEvent.progress > 0.5 && Math.random() < 0.1) {
        this.triggerCapitalShipArrival(localEvent.factionId);
      } else {
        this.triggerEnemyReinforcements(localEvent.factionId);
      }
    }

    // 3. 2026 Tech: 派系乱入 (三方混战)
    if (!localEvent && nearbyEnemies > 5 && Math.random() < 0.05) {
      const hostileFactions: FactionId[] = ['scavengers', 'void_cult'];
      const randomFaction = hostileFactions[Math.floor(Math.random() * hostileFactions.length)];
      this.triggerEnemyReinforcements(randomFaction);
    }
  }

  private triggerCapitalShipArrival(factionId: FactionId): void {
    if (!this.player) return;

    console.log(`[ReinforcementSystem] WARNING: Strategic Capital Ship detected: ${factionId}!`);

    // 在较远位置折跃进场
    const playerPos = this.player.getPosition();
    const forward = this.player.getEntity().forward.clone();
    const spawnPos = playerPos.clone().add(forward.scale(120));

    // 2026 Tech: 战术折跃视觉链
    this.playWarpInEffect(spawnPos, true);

    setTimeout(() => {
      const enemySystem = (this.context?.app as any)?.['enemySystem'];
      if (enemySystem) {
        const capitalShip = enemySystem.spawnStaticTarget(EnemyType.CRUISER, spawnPos);

        // 2026 Tech: 为巡洋舰设置派系
        if (capitalShip && (capitalShip as any).setFaction) {
          (capitalShip as any).setFaction(factionId);
        }

        // 全局通告与屏幕抖动
        const vfx = (this.context?.app as any)?.['vfxSystem'];
        vfx?.triggerJumpEffect(2500); // 空间扭曲

        (this.context?.app as any)?.['storyManager']?.addDialogue({
          id: `capital_arrival_${Date.now()}`,
          name: '战术雷达',
          participants: ['pilot', 'player'],
          text: `警报！检测到超大规模引力坍缩，${factionId}派系的巡洋舰已进入本星区！`,
          trigger: { type: 'auto' },
        });
      }
    }, 2000);
  }

  private triggerFriendlyReinforcements(): void {
    if (!this.npcManager || !this.player) return;

    // 寻找声望最高的非敌对派系
    const factions: FactionId[] = ['trade_union', 'imperial_guard'];
    let bestFaction: FactionId = 'trade_union';
    let maxRep = -100;

    factions.forEach((f) => {
      const rep = this.factionManager?.getFaction(f)?.reputation || 0;
      if (rep > maxRep) {
        maxRep = rep;
        bestFaction = f;
      }
    });

    if (maxRep < 0) return; // 没有友好的派系愿意帮忙

    console.log(`[ReinforcementSystem] Friendly reinforcements arriving from ${bestFaction}!`);

    // 在玩家后方折跃进场
    const playerPos = this.player.getPosition();
    const spawnPos = playerPos.clone().add(this.player.getEntity().forward.clone().scale(-50));

    this.playWarpInEffect(spawnPos);

    setTimeout(() => {
      this.npcManager?.spawnSquad(bestFaction, spawnPos, 3);
      // 通知玩家
      (this.context?.app as any)?.['storyManager']?.addDialogue({
        id: `reinforcement_${Date.now()}`,
        name: '外部通讯',
        participants: ['pilot', 'player'],
        text: `这里是${bestFaction}折跃小组，我们收到了你的求救信号，正在接入战场！`,
        trigger: { type: 'auto' },
      });
    }, 1000);
  }

  private triggerEnemyReinforcements(factionId: FactionId): void {
    if (!this.npcManager || !this.player) return;

    console.log(`[ReinforcementSystem] Enemy reinforcements detected: ${factionId}!`);

    // 在玩家前方折跃进场
    const playerPos = this.player.getPosition();
    const spawnPos = playerPos.clone().add(this.player.getEntity().forward.clone().scale(80));

    this.playWarpInEffect(spawnPos);

    setTimeout(() => {
      this.npcManager?.spawnSquad(factionId, spawnPos, 2);
    }, 1000);
  }

  private playWarpInEffect(position: pc.Vec3, isLarge: boolean = false): void {
    const engine = (this.context?.app as any)?.['engine'];
    if (!engine) return;

    // 2026 Tech: 空间坍缩球 (Gravitational Collapse Sphere)
    const warpSphere = new pc.Entity('warp_hole');
    warpSphere.setPosition(position);
    warpSphere.addComponent('model', { type: 'sphere' });

    const mat = new pc.StandardMaterial();
    mat.diffuse.set(0, 0, 0);
    mat.emissive.set(0.1, 0.4, 1.0); // 核心为深蓝色
    mat.emissiveIntensity = 8.0;
    mat.opacity = 0.9;
    mat.blendType = pc.BLEND_ADDITIVEALPHA;
    mat.useLighting = false;
    mat.update();

    if (warpSphere.model) warpSphere.model.material = mat;
    engine.addToScene(warpSphere);

    // 2026 Tech: 折跃连锁视觉 (Warp Visual Chain)
    const vfx = (this.context?.app as any)?.['vfxSystem'];
    if (isLarge) {
      vfx?.triggerFlash(0.5, new pc.Color(0.2, 0.5, 1, 0.5)); // 蓝色闪烁
      vfx?.triggerShake(2.0, 0.3); // 持续抖动
    }

    // 2026 Tech: 动态扩缩动画
    const duration = isLarge ? 2500 : 1200;
    const startTime = Date.now();
    const maxScale = isLarge ? 20 : 8;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = elapsed / duration;

      if (t >= 1) {
        warpSphere.destroy();
        return;
      }

      // 快速扩张 -> 极速收缩 (2026 风格坍缩)
      let s = 0;
      if (t < 0.15) {
        s = (t / 0.15) * maxScale;
      } else if (t < 0.85) {
        s = maxScale * (1 - ((t - 0.15) / 0.7) * 0.2); // 缓慢收缩
      } else {
        s = maxScale * 0.8 * (1 - (t - 0.85) / 0.15); // 极速坍缩
      }

      warpSphere.setLocalScale(s, s, s);
      mat.emissiveIntensity = 8.0 * (1 - t);
      mat.update();

      requestAnimationFrame(animate);
    };

    animate();

    // 2026 Tech: 空间扭曲光带 (Space Distortion Ribbons)
    const ribbonCount = isLarge ? 12 : 6;
    for (let i = 0; i < ribbonCount; i++) {
      const ribbon = new pc.Entity('warp_ribbon');
      ribbon.setPosition(position);
      engine.addParticleSystem(ribbon, {
        lifetime: isLarge ? 2.0 : 1.0,
        numParticles: 30,
        initialVelocity: 20,
        colorGraph: new pc.CurveSet([
          [0.1, 0.5, 1],
          [0.5, 0.8, 1],
          [0, 0, 0],
        ]),
        scaleGraph: new pc.Curve([0, 2, 0]),
      });
      engine.addToScene(ribbon);
      setTimeout(() => ribbon.destroy(), duration);
    }
  }
}
