import * as pc from 'playcanvas';

export interface GameEngineConfig {
  canvas: HTMLCanvasElement;
  width?: number;
  height?: number;
  antialias?: boolean;
  enablePostEffects?: boolean;
  enablePhysics?: boolean;
}

export interface LightConfig {
  type: 'point' | 'directional' | 'spot' | 'hemisphere';
  position?: pc.Vec3;
  color?: pc.Color;
  intensity?: number;
  range?: number;
  castShadows?: boolean;
}

export interface CameraConfig {
  position: pc.Vec3;
  target?: pc.Vec3;
  fov?: number;
  nearClip?: number;
  farClip?: number;
  clearColor?: pc.Color;
}

export interface MaterialOptions {
  diffuse?: pc.Color;
  emissive?: pc.Color;
  specular?: pc.Color;
  shininess?: number;
  roughness?: number;
  metalness?: number;
  transparency?: number;
  opacity?: number;
  blendType?: number;
  transparent?: boolean;
  useMetalness?: boolean;
}

export interface InstanceData {
  position: pc.Vec3;
  rotation: pc.Vec3;
  scale: pc.Vec3;
  color: pc.Color;
  visible?: boolean;
}

export interface GameEngine {
  start(): void;
  destroy(): void;
  
  getApp(): pc.Application;
  getScene(): pc.Scene;
  getCamera(): pc.Entity;
  
  setCamera(config: CameraConfig): void;
  setCameraPosition(x: number, y: number, z: number): void;
  lookAt(target: pc.Vec3): void;
  
  addLight(name: string, config: LightConfig): pc.Entity;
  addLight(name: string, position: pc.Vec3, color: pc.Color, intensity: number): pc.Entity;
  addDirectionalLight(name: string, direction: pc.Vec3, color: pc.Color, intensity: number): pc.Entity;
  
  createMaterial(name: string, options: MaterialOptions): pc.StandardMaterial;
  
  createBox(name: string, width: number, height: number, depth: number, material: pc.Material): pc.Entity;
  createSphere(name: string, radius: number, material: pc.Material): pc.Entity;
  createCylinder(name: string, radius: number, height: number, material: pc.Material): pc.Entity;
  createTorus(name: string, radius: number, tubeRadius: number, material: pc.Material): pc.Entity;
  createPlane(name: string, width: number, height: number, material: pc.Material): pc.Entity;
  
  createStarField(count?: number, innerRadius?: number, outerRadius?: number): void;
  createNebula(position: pc.Vec3, scale?: number): pc.Entity;
  createPlanet(name: string, position: pc.Vec3, radius: number, color: pc.Color): pc.Entity;
  
  addToScene(entity: pc.Entity): void;
  removeFromScene(entity: pc.Entity): void;
  
  setUpdateCallback(callback: (dt: number) => void): void;
  setFixedUpdateCallback(callback: (dt: number) => void): void;
  
  isPhysicsEnabled(): boolean;
  
  getInstancedRenderer(): unknown;
  
  addRigidBody(entity: pc.Entity, type: 'dynamic' | 'static' | 'kinematic', options?: {
    mass?: number;
    linearDamping?: number;
    angularDamping?: number;
    gravity?: pc.Vec3;
  }): void;
  
  addCollision(entity: pc.Entity, type: 'box' | 'sphere' | 'cylinder' | 'capsule', options?: {
    halfExtents?: pc.Vec3;
    radius?: number;
    height?: number;
  }): void;
}