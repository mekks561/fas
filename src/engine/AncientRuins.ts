import * as pc from 'playcanvas';
import { PlayerShip } from './PlayerShip';

/**
 * 2026 Tech: 远古巨构遗迹 (Ancient Megastructures)。
 * 位于异常星区的巨型交互式建筑，包含解谜与防御逻辑。
 */
export class AncientRuins {
  public entity: pc.Entity;
  private app: pc.Application;
  private player: PlayerShip;

  private pillars: pc.Entity[] = [];
  private activatedCount: number = 0;
  private isPuzzleComplete: boolean = false;

  constructor(app: pc.Application, player: PlayerShip, position: pc.Vec3) {
    this.app = app;
    this.player = player;
    this.entity = new pc.Entity('ancient_ruins');
    this.entity.setPosition(position);

    this.setupRuinsStructure();
  }

  private setupRuinsStructure(): void {
    // 1. 中央方尖碑 (Central Obelisk)
    const obelisk = new pc.Entity('obelisk');
    obelisk.addComponent('model', { type: 'box' });
    obelisk.setLocalScale(10, 40, 10);

    const mat = new pc.StandardMaterial();
    mat.diffuse.set(0.1, 0.1, 0.1);
    mat.emissive.set(0.2, 0, 0.4);
    mat.emissiveIntensity = 2.0;
    mat.update();
    if (obelisk.model) obelisk.model.material = mat;
    this.entity.addChild(obelisk);

    // 2. 环绕激活柱 (Activation Pillars)
    const pillarCount = 3;
    const radius = 25;
    for (let i = 0; i < pillarCount; i++) {
      const angle = (i / pillarCount) * Math.PI * 2;
      const pillar = new pc.Entity(`pillar_${i}`);
      pillar.setLocalPosition(Math.cos(angle) * radius, -10, Math.sin(angle) * radius);
      pillar.addComponent('model', { type: 'cylinder' });
      pillar.setLocalScale(2, 8, 2);

      // 初始未激活状态 (暗红色)
      const pMat = new pc.StandardMaterial();
      pMat.diffuse.set(0.2, 0.2, 0.2);
      pMat.emissive.set(0.5, 0, 0);
      pMat.update();
      if (pillar.model) pillar.model.material = pMat;

      this.entity.addChild(pillar);
      this.pillars.push(pillar);

      // 注入交互逻辑元数据
      (pillar as any).interactable = true;
      (pillar as any).activated = false;
    }
  }

  public update(dt: number): void {
    if (this.isPuzzleComplete) return;

    const playerPos = this.player.getPosition();

    this.pillars.forEach((pillar, _index) => {
      if ((pillar as any).activated) return;

      const dist = pillar.getPosition().distance(playerPos);
      // 玩家靠近并按下交互键 (假设是 'E' 或 interact)
      const controls = (this.player as any).getLatestControls?.();

      if (dist < 10.0 && controls?.interact) {
        this.activatePillar(pillar);
      }
    });

    // 遗迹核心缓慢自旋
    this.entity.rotate(0, 2 * dt, 0);
  }

  private activatePillar(pillar: pc.Entity): void {
    (pillar as any).activated = true;
    this.activatedCount++;

    // 改变视觉效果 (变为亮紫色)
    const mat = pillar.model?.material as pc.StandardMaterial;
    if (mat) {
      mat.emissive.set(0.6, 0.2, 1.0);
      mat.emissiveIntensity = 5.0;
      mat.update();
    }

    // 触发局部闪烁特效
    const engine = (this.app as any)['engine'];
    engine?.createExplosion?.(pillar.getPosition(), 1.0);

    console.log(`[AncientRuins] Pillar activated: ${this.activatedCount}/3`);

    if (this.activatedCount === this.pillars.length) {
      this.completePuzzle();
    }
  }

  private completePuzzle(): void {
    this.isPuzzleComplete = true;
    console.log('[AncientRuins] Megastructure Awakened! Relic secured.');

    // 视觉反馈：整体脉冲
    const vfx = (this.app as any)['vfxSystem'];
    vfx?.triggerJumpEffect(1500);

    // 奖励玩家：虚空遗物与解锁模块
    const store = (window as any).useGameStore?.getState();
    if (store) {
      store.addExperience?.(2000);

      // 2026 Tech: 联动 BuildSystem 解锁古代科技
      const engine = (this.app as any)['engine'];
      const buildSystem = (this.app as any)['buildSystem'] || engine?.getPlugin?.('BuildSystem');
      const unlockedName = buildSystem?.unlockVoidUpgrade?.(1);

      store.setActiveDialogue?.({
        id: 'ruins_awakened',
        name: '未知系统',
        participants: ['ai', 'player'],
        trigger: { type: 'auto' },
        lines: [
          {
            speaker: 'ai',
            text: `探测到远古数据签名... ${unlockedName ? `已解锁古代模块：${unlockedName}。` : '虚空遗物已同步至货舱。'}`,
            emotion: 'mysterious',
          },
        ],
      });
    }
  }
}
