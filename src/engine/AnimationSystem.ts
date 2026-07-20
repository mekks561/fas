import * as pc from 'playcanvas';

export type AnimationState = 'idle' | 'move' | 'attack' | 'hit' | 'death' | 'spawn';

export interface AnimationFrame {
  position: pc.Vec3;
  rotation: pc.Vec3;
  scale: pc.Vec3;
  duration: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce';
}

export interface AnimationClip {
  name: string;
  state: AnimationState;
  frames: AnimationFrame[];
  loop: boolean;
  speed: number;
}

export interface AnimationStateTransition {
  from: AnimationState;
  to: AnimationState;
  duration: number;
  condition?: () => boolean;
}

export interface BlendInput {
  clipName: string;
  weight: number;
}

export interface AnimatedEntity {
  entity: pc.Entity;
  currentState: AnimationState;
  currentClip: AnimationClip | null;
  currentFrameIndex: number;
  currentTime: number;
  isPlaying: boolean;
  speed: number;
  blendStates: Map<
    string,
    { clip: AnimationClip; weight: number; time: number; frameIndex: number }
  >;
}

export class AnimationSystem {
  private clips: Map<string, AnimationClip> = new Map();
  private entities: Map<pc.Entity, AnimatedEntity> = new Map();
  private transitions: AnimationStateTransition[] = [];
  private isEnabled: boolean = true;
  private defaultEasing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' = 'easeInOut';

  constructor() {
    this.initializeDefaultClips();
  }

  private initializeDefaultClips(): void {
    // 玩家空闲动画
    this.registerClip({
      name: 'player_idle',
      state: 'idle',
      loop: true,
      speed: 1.0,
      frames: [
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 1.0,
          easing: 'easeInOut',
        },
        {
          position: new pc.Vec3(0, 0.1, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 1.0,
          easing: 'easeInOut',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 1.0,
          easing: 'easeInOut',
        },
      ],
    });

    // 玩家移动动画
    this.registerClip({
      name: 'player_move',
      state: 'move',
      loop: true,
      speed: 1.5,
      frames: [
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, -5),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.3,
          easing: 'easeInOut',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 5),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.3,
          easing: 'easeInOut',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, -5),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.3,
          easing: 'easeInOut',
        },
      ],
    });

    // 玩家攻击动画
    this.registerClip({
      name: 'player_attack',
      state: 'attack',
      loop: false,
      speed: 2.0,
      frames: [
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.05,
          easing: 'linear',
        },
        {
          position: new pc.Vec3(0, 0, 0.5),
          rotation: new pc.Vec3(-10, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.1,
          easing: 'easeOut',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.15,
          easing: 'easeIn',
        },
      ],
    });

    // 玩家受伤动画
    this.registerClip({
      name: 'player_hit',
      state: 'hit',
      loop: false,
      speed: 1.0,
      frames: [
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.05,
          easing: 'linear',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1.1, 1.1, 1.1),
          duration: 0.1,
          easing: 'easeOut',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.15,
          easing: 'easeIn',
        },
      ],
    });

    // 玩家死亡动画
    this.registerClip({
      name: 'player_death',
      state: 'death',
      loop: false,
      speed: 1.0,
      frames: [
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.2,
          easing: 'easeOut',
        },
        {
          position: new pc.Vec3(0, 2, 0),
          rotation: new pc.Vec3(0, 0, 180),
          scale: new pc.Vec3(1.2, 1.2, 1.2),
          duration: 0.5,
          easing: 'easeIn',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 360),
          scale: new pc.Vec3(0.5, 0.5, 0.5),
          duration: 0.5,
          easing: 'easeIn',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 360),
          scale: new pc.Vec3(0, 0, 0),
          duration: 0.3,
          easing: 'linear',
        },
      ],
    });

    // 敌人生成动画
    this.registerClip({
      name: 'enemy_spawn',
      state: 'spawn',
      loop: false,
      speed: 1.0,
      frames: [
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(0, 0, 0),
          duration: 0.3,
          easing: 'easeOut',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 360, 0),
          scale: new pc.Vec3(1.2, 1.2, 1.2),
          duration: 0.2,
          easing: 'bounce',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 360, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.2,
          easing: 'easeIn',
        },
      ],
    });

    // 敌人空闲动画
    this.registerClip({
      name: 'enemy_idle',
      state: 'idle',
      loop: true,
      speed: 1.0,
      frames: [
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 1.5,
          easing: 'easeInOut',
        },
        {
          position: new pc.Vec3(0, 0.2, 0),
          rotation: new pc.Vec3(0, 5, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 1.5,
          easing: 'easeInOut',
        },
      ],
    });

    // 敌人攻击动画
    this.registerClip({
      name: 'enemy_attack',
      state: 'attack',
      loop: false,
      speed: 1.5,
      frames: [
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.1,
          easing: 'easeIn',
        },
        {
          position: new pc.Vec3(0, 0, -1),
          rotation: new pc.Vec3(15, 0, 0),
          scale: new pc.Vec3(1.1, 1.1, 0.9),
          duration: 0.15,
          easing: 'easeOut',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.2,
          easing: 'easeIn',
        },
      ],
    });

    // 敌人死亡动画
    this.registerClip({
      name: 'enemy_death',
      state: 'death',
      loop: false,
      speed: 1.0,
      frames: [
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 0),
          scale: new pc.Vec3(1, 1, 1),
          duration: 0.1,
          easing: 'linear',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 720),
          scale: new pc.Vec3(1.5, 1.5, 1.5),
          duration: 0.3,
          easing: 'easeOut',
        },
        {
          position: new pc.Vec3(0, 0, 0),
          rotation: new pc.Vec3(0, 0, 720),
          scale: new pc.Vec3(0, 0, 0),
          duration: 0.2,
          easing: 'easeIn',
        },
      ],
    });

    // 默认状态转换
    this.registerTransition({ from: 'idle', to: 'move', duration: 0.2 });
    this.registerTransition({ from: 'move', to: 'idle', duration: 0.2 });
    this.registerTransition({ from: 'idle', to: 'attack', duration: 0.05 });
    this.registerTransition({ from: 'move', to: 'attack', duration: 0.05 });
    this.registerTransition({ from: 'attack', to: 'idle', duration: 0.1 });
    this.registerTransition({ from: 'attack', to: 'move', duration: 0.1 });
    this.registerTransition({ from: 'idle', to: 'hit', duration: 0.05 });
    this.registerTransition({ from: 'move', to: 'hit', duration: 0.05 });
    this.registerTransition({ from: 'hit', to: 'idle', duration: 0.15 });
    this.registerTransition({ from: 'hit', to: 'move', duration: 0.15 });
    this.registerTransition({ from: 'idle', to: 'death', duration: 0.1 });
    this.registerTransition({ from: 'move', to: 'death', duration: 0.1 });
    this.registerTransition({ from: 'hit', to: 'death', duration: 0.1 });
    this.registerTransition({ from: 'spawn', to: 'idle', duration: 0.3 });
  }

  public registerClip(clip: AnimationClip): void {
    this.clips.set(clip.name, clip);
  }

  public registerTransition(transition: AnimationStateTransition): void {
    this.transitions.push(transition);
  }

  public registerEntity(entity: pc.Entity, initialState: AnimationState = 'idle'): void {
    if (this.entities.has(entity)) return;

    const initialClip = this.findClipForState(initialState);
    const animated: AnimatedEntity = {
      entity,
      currentState: initialState,
      currentClip: initialClip,
      currentFrameIndex: 0,
      currentTime: 0,
      isPlaying: true,
      speed: 1.0,
      blendStates: new Map(),
    };

    this.entities.set(entity, animated);

    if (initialClip) {
      this.applyFrame(entity, initialClip.frames[0]);
    }
  }

  public unregisterEntity(entity: pc.Entity): void {
    this.entities.delete(entity);
  }

  public playAnimation(entity: pc.Entity, clipName: string): boolean {
    const animated = this.entities.get(entity);
    const clip = this.clips.get(clipName);

    if (!animated || !clip) return false;

    animated.currentClip = clip;
    animated.currentState = clip.state;
    animated.currentFrameIndex = 0;
    animated.currentTime = 0;
    animated.isPlaying = true;

    return true;
  }

  public setState(entity: pc.Entity, state: AnimationState): boolean {
    const animated = this.entities.get(entity);
    if (!animated) return false;

    if (animated.currentState === state) return true;

    this.findTransition(animated.currentState, state);
    const targetClip = this.findClipForState(state);

    if (!targetClip) return false;

    animated.currentState = state;
    animated.currentClip = targetClip;
    animated.currentFrameIndex = 0;
    animated.currentTime = 0;
    animated.isPlaying = true;

    return true;
  }

  public pause(entity: pc.Entity): void {
    const animated = this.entities.get(entity);
    if (animated) {
      animated.isPlaying = false;
    }
  }

  public resume(entity: pc.Entity): void {
    const animated = this.entities.get(entity);
    if (animated) {
      animated.isPlaying = true;
    }
  }

  public stop(entity: pc.Entity): void {
    const animated = this.entities.get(entity);
    if (animated) {
      animated.isPlaying = false;
      animated.currentTime = 0;
      animated.currentFrameIndex = 0;
      if (animated.currentClip) {
        this.applyFrame(entity, animated.currentClip.frames[0]);
      }
    }
  }

  public setSpeed(entity: pc.Entity, speed: number): void {
    const animated = this.entities.get(entity);
    if (animated) {
      animated.speed = speed;
    }
  }

  public blend(entity: pc.Entity, blends: BlendInput[]): void {
    const animated = this.entities.get(entity);
    if (!animated) return;

    animated.blendStates.clear();

    blends.forEach((blend) => {
      const clip = this.clips.get(blend.clipName);
      if (clip) {
        animated.blendStates.set(blend.clipName, {
          clip,
          weight: blend.weight,
          time: 0,
          frameIndex: 0,
        });
      }
    });
  }

  public update(dt: number): void {
    if (!this.isEnabled) return;

    this.entities.forEach((animated) => {
      if (!animated.isPlaying) return;

      const effectiveDt = dt * animated.speed;

      if (animated.blendStates.size > 0) {
        this.updateBlendedAnimation(animated, effectiveDt);
      } else if (animated.currentClip) {
        this.updateSingleAnimation(animated, effectiveDt);
      }
    });
  }

  private updateSingleAnimation(animated: AnimatedEntity, dt: number): void {
    const clip = animated.currentClip;
    if (!clip) return;

    animated.currentTime += dt;
    const currentFrame = clip.frames[animated.currentFrameIndex];

    if (!currentFrame) return;

    if (animated.currentTime >= currentFrame.duration) {
      animated.currentTime -= currentFrame.duration;
      animated.currentFrameIndex++;

      if (animated.currentFrameIndex >= clip.frames.length) {
        if (clip.loop) {
          animated.currentFrameIndex = 0;
        } else {
          animated.currentFrameIndex = clip.frames.length - 1;
          animated.isPlaying = false;
        }
      }

      const newFrame = clip.frames[animated.currentFrameIndex];
      if (newFrame) {
        this.applyFrame(animated.entity, newFrame);
      }
    } else {
      const nextFrameIndex =
        animated.currentFrameIndex + 1 < clip.frames.length
          ? animated.currentFrameIndex + 1
          : clip.loop
            ? 0
            : animated.currentFrameIndex;
      const nextFrame = clip.frames[nextFrameIndex];

      if (nextFrame && nextFrameIndex !== animated.currentFrameIndex) {
        const progress = animated.currentTime / currentFrame.duration;
        const easedProgress = this.applyEasing(progress, currentFrame.easing || this.defaultEasing);
        this.applyInterpolatedFrame(animated.entity, currentFrame, nextFrame, easedProgress);
      }
    }
  }

  private updateBlendedAnimation(animated: AnimatedEntity, dt: number): void {
    const basePos = new pc.Vec3(0, 0, 0);
    const baseRot = new pc.Vec3(0, 0, 0);
    const baseScale = new pc.Vec3(1, 1, 1);

    let totalWeight = 0;

    animated.blendStates.forEach((blendState) => {
      blendState.time += dt;
      const clip = blendState.clip;
      const frame = clip.frames[blendState.frameIndex];

      if (!frame) return;

      if (blendState.time >= frame.duration) {
        blendState.time -= frame.duration;
        blendState.frameIndex++;
        if (blendState.frameIndex >= clip.frames.length) {
          blendState.frameIndex = clip.loop ? 0 : clip.frames.length - 1;
        }
      }

      const currentBlendFrame = clip.frames[blendState.frameIndex];
      if (currentBlendFrame) {
        const weight = blendState.weight;
        basePos.x += currentBlendFrame.position.x * weight;
        basePos.y += currentBlendFrame.position.y * weight;
        basePos.z += currentBlendFrame.position.z * weight;
        baseRot.x += currentBlendFrame.rotation.x * weight;
        baseRot.y += currentBlendFrame.rotation.y * weight;
        baseRot.z += currentBlendFrame.rotation.z * weight;
        baseScale.x += currentBlendFrame.scale.x * weight;
        baseScale.y += currentBlendFrame.scale.y * weight;
        baseScale.z += currentBlendFrame.scale.z * weight;
        totalWeight += weight;
      }
    });

    if (totalWeight > 0) {
      basePos.mulScalar(1 / totalWeight);
      baseRot.mulScalar(1 / totalWeight);
      baseScale.mulScalar(1 / totalWeight);
      this.applyFrame(animated.entity, {
        position: basePos,
        rotation: baseRot,
        scale: baseScale,
        duration: 0,
        easing: 'linear',
      });
    }
  }

  private applyFrame(entity: pc.Entity, frame: AnimationFrame): void {
    entity.setPosition(frame.position);
    entity.setEulerAngles(frame.rotation);
    entity.setLocalScale(frame.scale);
  }

  private applyInterpolatedFrame(
    entity: pc.Entity,
    from: AnimationFrame,
    to: AnimationFrame,
    t: number,
  ): void {
    const pos = new pc.Vec3().lerp(from.position, to.position, t);
    const rot = new pc.Vec3().lerp(from.rotation, to.rotation, t);
    const scale = new pc.Vec3().lerp(from.scale, to.scale, t);

    entity.setPosition(pos);
    entity.setEulerAngles(rot);
    entity.setLocalScale(scale);
  }

  private applyEasing(
    t: number,
    easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce',
  ): number {
    switch (easing) {
      case 'linear':
        return t;
      case 'easeIn':
        return t * t;
      case 'easeOut':
        return 1 - (1 - t) * (1 - t);
      case 'easeInOut':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case 'bounce':
        if (t < 1 / 2.75) {
          return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
          t -= 1.5 / 2.75;
          return 7.5625 * t * t + 0.75;
        } else if (t < 2.5 / 2.75) {
          t -= 2.25 / 2.75;
          return 7.5625 * t * t + 0.9375;
        } else {
          t -= 2.625 / 2.75;
          return 7.5625 * t * t + 0.984375;
        }
      default:
        return t;
    }
  }

  private findClipForState(state: AnimationState): AnimationClip | null {
    for (const clip of this.clips.values()) {
      if (clip.state === state) return clip;
    }
    return null;
  }

  private findTransition(
    from: AnimationState,
    to: AnimationState,
  ): AnimationStateTransition | null {
    return this.transitions.find((t) => t.from === from && t.to === to) || null;
  }

  public getCurrentState(entity: pc.Entity): AnimationState | null {
    const animated = this.entities.get(entity);
    return animated?.currentState || null;
  }

  public isPlaying(entity: pc.Entity): boolean {
    const animated = this.entities.get(entity);
    return animated?.isPlaying || false;
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public getClip(name: string): AnimationClip | undefined {
    return this.clips.get(name);
  }

  public getAllClips(): AnimationClip[] {
    return Array.from(this.clips.values());
  }

  public destroy(): void {
    this.clips.clear();
    this.entities.clear();
    this.transitions = [];
  }
}
