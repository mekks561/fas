import * as pc from 'playcanvas';
import { PluginContext } from './PluginSystem';

/**
 * 2026 Tech: 戴森云建设系统 (Dyson Swarm Construction).
 * 允许玩家在恒星系星区阶段性建设巨构，提供全局加成。
 */
export class DysonSwarmSystem {
  public name = 'DysonSwarmSystem';
  public version = '3.0.0';

  private context: PluginContext | null = null;
  private constructionProgress: number = 0; // 0 to 100
  private isConstructing: boolean = false;
  private currentStar: pc.Entity | null = null;

  // 视觉组件
  private swarmEntities: pc.Entity[] = [];

  public init(context: PluginContext): void {
    this.context = context;
    console.log('[DysonSwarmSystem] Stellar Engineering initialized.');
  }

  public registerStar(star: pc.Entity): void {
    this.currentStar = star;
    this.swarmEntities = [];
    this.updateSwarmVisuals();
  }

  public addProgress(amount: number): void {
    this.constructionProgress = Math.min(100, this.constructionProgress + amount);
    this.updateSwarmVisuals();

    if (this.constructionProgress >= 100) {
      this.onConstructionComplete();
    }
  }

  private updateSwarmVisuals(): void {
    if (!this.currentStar || !this.context) return;

    // 根据进度生成“轨道收集器”碎片
    const targetCount = Math.floor(this.constructionProgress / 5); // 每 5% 增加一个

    while (this.swarmEntities.length < targetCount) {
      this.addSwarmCollector();
    }
  }

  private addSwarmCollector(): void {
    if (!this.currentStar) return;

    const collector = new pc.Entity('dyson_collector');
    const radius = 80 + Math.random() * 20;
    const angle = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI * 0.2; // 集中在赤道平面附近

    collector.setLocalPosition(
      radius * Math.cos(angle) * Math.cos(phi),
      radius * Math.sin(phi),
      radius * Math.sin(angle) * Math.cos(phi),
    );

    collector.addComponent('model', { type: 'box' });
    collector.setLocalScale(2, 0.2, 5);
    collector.lookAt(this.currentStar.getPosition());

    const mat = new pc.StandardMaterial();
    mat.diffuse.set(0.8, 0.6, 0);
    mat.emissive.set(1, 0.8, 0);
    mat.emissiveIntensity = 2.0;
    mat.update();
    if (collector.model) collector.model.material = mat;

    this.currentStar.addChild(collector);
    this.swarmEntities.push(collector);
  }

  private onConstructionComplete(): void {
    console.log('[DysonSwarmSystem] Dyson Swarm online! Global energy output maximized.');

    const store = (window as any).useGameStore?.getState();
    if (store) {
      store.addGlobalModifier?.({
        id: 'dyson_power',
        type: 'energy_regen',
        value: 1.5,
        description: '戴森云能源：全局能量恢复速度提升 50%',
      });

      store.setActiveDialogue?.({
        id: 'dyson_complete',
        name: '中央控制系统',
        participants: ['ai'],
        trigger: { type: 'auto' },
        lines: [
          {
            speaker: 'ai',
            text: '恒星能量捕获阵列已完全上线。能源供应已接入全局网络。',
            emotion: 'triumphant',
          },
        ],
      });
    }
  }

  public onUpdate(dt: number): void {
    if (this.currentStar) {
      // 轨道碎片缓慢公转
      this.swarmEntities.forEach((c, i) => {
        // Entity 无 rotateAround —— 手动绕 Y 轴旋转
        const center = this.currentStar!.getPosition();
        const pos = c.getPosition();
        const dx = pos.x - center.x;
        const dz = pos.z - center.z;
        const angle = (0.1 + i * 0.01) * dt;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        c.setPosition(center.x + dx * cosA - dz * sinA, pos.y, center.z + dx * sinA + dz * cosA);
      });
    }

    // 如果玩家靠近恒星且按下交互键，增加建设进度
    const player = (this.context?.app as any)?.['player'];
    if (player && this.currentStar) {
      const dist = player.getPosition().distance(this.currentStar.getPosition());
      const controls = player.getLatestControls?.();

      if (dist < 120 && controls?.interact) {
        this.addProgress(2 * dt); // 持续按住增加进度

        // 视觉反馈：从玩家飞船向恒星发射“建设光束”
        const vfx = (this.context?.app as any)?.['vfxSystem'];
        vfx?.triggerConstructionBeam(player.getPosition(), this.currentStar.getPosition());
      }

      // 2026 Tech: 调试快捷键 - 按 'K' 瞬间完成戴森云 (仅在开发模式)
      if (import.meta.env.DEV && this.context?.app.keyboard?.wasPressed(pc.KEY_K)) {
        console.log('[DEBUG] Cheat activated: Dyson Swarm instantly completed.');
        this.addProgress(100);
      }

      // 2026 Tech: 靠近时显示交互提示
      if (dist < 150 && this.constructionProgress < 100) {
        const store = (window as any).useGameStore?.getState();
        if (store && !store.activeDialogue) {
          // 仅在没有对话时显示简单的 HUD 提示 (这里可以通过 store 扩展一个 hint 字段，或者复用对话系统)
          // 暂且通过 console 或简单的逻辑模拟提示
        }
      }
    }
  }

  public clear(): void {
    this.currentStar = null;
    this.swarmEntities = [];
  }

  public getProgress(): number {
    return this.constructionProgress;
  }
}
