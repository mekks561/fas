import * as pc from 'playcanvas';
import { PluginContext } from './PluginSystem';

/**
 * 2026 Tech: 维度偏移系统 (Dimensional Shift System)。
 * 随机触发的现实扭曲效果，影响物理法则与视觉呈现。
 */
export class DimensionalShiftSystem {
  public name = 'DimensionalShiftSystem';
  public version = '2.9.0';

  private context: PluginContext | null = null;
  private isActive: boolean = false;
  private activeShiftType: 'gravity_invert' | 'light_slow' | 'reality_glitch' | null = null;
  private timer: number = 0;

  public init(context: PluginContext): void {
    this.context = context;
    console.log('[DimensionalShiftSystem] Reality Anchors initialized.');
  }

  public triggerShift(type: 'gravity_invert' | 'light_slow' | 'reality_glitch', duration: number): void {
    if (this.isActive) return;

    this.isActive = true;
    this.activeShiftType = type;
    this.timer = duration;
    
    console.log(`[DimensionalShiftSystem] DIMENSIONAL SHIFT DETECTED: ${type}`);
    
    // 全局通告
    const store = (window as any).useGameStore?.getState();
    store?.setActiveDialogue?.({
      id: `shift_${Date.now()}`,
      name: '系统警告',
      participants: ['ai'],
      trigger: { type: 'auto' },
      lines: [{ speaker: 'ai', text: `警告：局部维度参数偏移！当前类型：${this.getShiftName(type)}。`, emotion: 'glitch' }]
    });

    // 视觉反馈：全局偏色
    this.applyVisualEffect(true);
  }

  private getShiftName(type: string): string {
    switch(type) {
      case 'gravity_invert': return '重力反转';
      case 'light_slow': return '光速减缓';
      case 'reality_glitch': return '现实崩塌';
      default: return '未知异常';
    }
  }

  private applyVisualEffect(active: boolean): void {
    const app = this.context?.app;
    if (!app) return;
    
    // 2026 Tech: 动态调整场景环境色模拟维度偏移
    if (active) {
      app.scene.ambientLight.set(0.5, 0, 0.5); // 紫色调
    } else {
      app.scene.ambientLight.set(0.1, 0.1, 0.1);
    }
  }

  public onUpdate(dt: number): void {
    if (!this.isActive) return;

    this.timer -= dt;
    if (this.timer <= 0) {
      this.stopShift();
      return;
    }

    // 2026 Tech: 实时物理法则篡改
    const player = (this.context?.app as any)._player;
    if (!player) return;

    switch(this.activeShiftType) {
      case 'gravity_invert':
        // 全局向上推力
        player.applyExternalForce?.(new pc.Vec3(0, 15 * dt, 0));
        break;
      case 'light_slow':
        // 通过 timeScale 模拟光速减缓 (影响所有基于 dt 的运动)
        (this.context?.app as any).timeScale = 0.5;
        break;
      case 'reality_glitch':
        // 随机抖动
        if (Math.random() > 0.9) {
          const shake = new pc.Vec3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
          player.applyExternalForce?.(shake.scale(10));
        }
        break;
    }
  }

  private stopShift(): void {
    this.isActive = false;
    this.activeShiftType = null;
    this.applyVisualEffect(false);
    (this.context?.app as any).timeScale = 1.0;
    console.log('[DimensionalShiftSystem] Dimensional stability restored.');
  }

  public isShiftActive(): boolean {
    return this.isActive;
  }
}
