import * as pc from 'playcanvas';

declare module 'playcanvas' {
  interface Vec3 {
    scale(scalar: number): this;
    transform(quat: Quat): this;
    transformQuat(quat: Quat): this;
  }

  interface Quat {
    transformVector(vec: Vec3): Vec3;
  }

  interface ParticleSystemComponent {
    start(): void;
  }

  interface StandardMaterial {
    roughness: number;
  }

  interface ComponentSystemRegistry {
    physics?: pc.PhysicsComponentSystem;
  }

  interface Scene {
    addChild(entity: Entity): void;
  }

  interface Entity {
    aabb?: pc.BoundingBox;
  }

  interface SoundInstance {
    setPosition(position: Vec3): void;
  }

  interface Application {
    audio?: {
      context: AudioContext;
    };
  }

  interface ApplicationStats {
    fps?: number;
    frameTime?: number;
    drawCalls?: { count: number };
    triangles?: { count: number };
  }

  const SoundOptions: {
    new(options?: {
      volume?: number;
      loop?: boolean;
      spatialBlend?: number;
      maxDistance?: number;
    }): object;
  };

  const BloomEffect: typeof pc.PostEffect;
  const FxaaEffect: typeof pc.PostEffect;
  const VignetteEffect: typeof pc.PostEffect;
}
