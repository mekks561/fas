import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { VisualEffectSystem } from './VisualEffectSystem';

export interface JumpGateConfig {
  engine: PlayCanvasGameEngine;
  position: pc.Vec3;
  targetSectorId: string;
  player: PlayerShip;
  radius?: number;
}

/**
 * 跃迁门 (Jump Gate) 实体。
 * v2.7 跃迁式星区架构的核心交互实体。
 * v2.8 增强：接入视觉反馈系统与更精准的触发逻辑。
 */
export class JumpGate {
  private engine: PlayCanvasGameEngine;
  private entity: pc.Entity;
  private targetSectorId: string;
  private player: PlayerShip;
  private radius: number;
  
  private isJumping: boolean = false;
  private triggerDistance: number = 10.0;
  private facingThreshold: number = 0.7; // 玩家必须大致面向门中心 (点积)
  private unsubscribeStore: (() => void) | null = null;

  constructor(config: JumpGateConfig) {
    this.engine = config.engine;
    this.targetSectorId = config.targetSectorId;
    this.player = config.player;
    this.radius = config.radius || 15.0;

    this.entity = this.createJumpGate(config.position);
    this.engine.addToScene(this.entity);

    this.setupStoreListener();
  }

  private async setupStoreListener() {
    const { useGameStore } = import.meta.env.SSR ? { useGameStore: { subscribe: () => () => {} } } as any : await import('../store/useGameStore');
    this.unsubscribeStore = useGameStore.subscribe(
      (state: any) => state.isStarMapVisible,
      (visible: boolean) => {
        if (!visible && this.isJumping) {
          // 当星图关闭时，如果未执行跳转，则重置锁定状态
          console.log('[JumpGate] StarMap closed. Resetting jump lock.');
          this.isJumping = false;
        }
      }
    );
  }

  private createJumpGate(position: pc.Vec3): pc.Entity {
    const gate = new pc.Entity('jumpGate');
    gate.setPosition(position);

    // 1. 跃迁环 (Torus)
    const ringMaterial = this.engine.createMaterial('jumpGateRing', {
      diffuse: new pc.Color(0.2, 0.5, 1.0),
      emissive: new pc.Color(0.1, 0.3, 0.8),
      specular: new pc.Color(1, 1, 1),
      shininess: 80,
    });
    
    // 使用自定义生成的 Torus 以便独立控制环半径和管半径
    const torus = this.engine.createTorus('gateRing', this.radius, 1.5, ringMaterial);
    // 让环面向玩家（默认 Torus 在 XY 平面）
    torus.setEulerAngles(90, 0, 0);
    gate.addChild(torus);

    // 2. 事件视界 (Event Horizon) 粒子特效
    const portal = new pc.Entity('portalEffect');
    this.engine.addParticleSystem(portal, {
      numParticles: 100,
      lifetime: 2.0,
      rate: 50,
      loop: true,
      autoPlay: true,
      // 粒子在环内随机分布
      emitterShape: pc.EMITTERSHAPE_SPHERE,
      emitterRadius: this.radius * 0.8,
      initialVelocity: 0.5,
      colorGraph: new pc.CurveSet([
        [0.2, 0.6, 1.0], // 蓝色
        [0.5, 0.2, 0.8], // 紫色
        [0, 0, 0],       // 消失
      ]),
      scaleGraph: new pc.Curve([0.1, 0.5, 0.1]),
      colorMapUrl: PlayCanvasGameEngine.PARTICLE_TEXTURES.skillFlare,
    });
    gate.addChild(portal);

    // 3. 核心强光 (Emissive Core)
    const core = this.engine.createSphere('gateCore', this.radius * 0.1, this.engine.createMaterial('gateCoreMat', {
      emissive: new pc.Color(1, 1, 1),
      diffuse: new pc.Color(0, 0, 0),
    }));
    gate.addChild(core);

    return gate;
  }

  public update(dt: number): void {
    if (this.isJumping) return;

    // 旋转环增加动态感
    const ring = this.entity.findByName('gateRing');
    if (ring) {
      ring.rotateLocal(0, 0, dt * 30);
    }

    // 距离与朝向检测
    const dist = this.getDistanceToPlayer();
    if (dist < this.triggerDistance) {
      if (this.isPlayerFacingGate()) {
        this.initiateJump();
      }
    }
  }

  private isPlayerFacingGate(): boolean {
    const playerPos = this.player.getPosition();
    const gatePos = this.entity.getPosition();
    
    // 玩家到门的向量
    const toGate = gatePos.clone().sub(playerPos).normalize();
    // 玩家的前向向量
    const playerForward = this.player.getForward();
    
    // 点积判断朝向一致性
    return toGate.dot(playerForward) > this.facingThreshold;
  }

  private getDistanceToPlayer(): number {
    const playerPos = this.player.getPosition();
    const gatePos = this.entity.getPosition();
    return playerPos.clone().sub(gatePos).length();
  }

  private async initiateJump(): Promise<void> {
    if (this.isJumping) return;
    this.isJumping = true;
    
    console.log(`[JumpGate] Player entering jump sequence. Triggering VFX.`);
    
    // 1. 触发视觉特效 (v2.8 增强)
    const vfxSystem = this.engine.getPlugin<VisualEffectSystem>('VisualEffectSystem');
    if (vfxSystem) {
      vfxSystem.triggerJumpEffect(1500); // 1.5秒的扭曲效果
    }

    // 2. 稍微延迟打开星图，让特效有个展示窗口
    setTimeout(async () => {
      const { useGameStore } = import.meta.env.SSR ? { useGameStore: () => ({}) } as any : await import('../store/useGameStore');
      console.log(`[JumpGate] Opening Galaxy StarMap.`);
      useGameStore.getState().setStarMapVisible(true);
      useGameStore.getState().setGamePaused(true);
    }, 500);
  }

  public destroy(): void {
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    this.entity.destroy();
  }
}
