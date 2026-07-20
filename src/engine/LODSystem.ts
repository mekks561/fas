import * as pc from 'playcanvas';

export interface LODLevel {
  level: number;
  distance: number;
  mesh: pc.Mesh | null;
  material: pc.Material | null;
  enabled: boolean;
}

export interface LODConfig {
  levels: LODLevel[];
  autoSwitch: boolean;
  updateInterval: number;
  minDistance: number;
  maxDistance: number;
}

export interface LODEntityData {
  entity: pc.Entity;
  config: LODConfig;
  currentLevel: number;
  lastUpdateTime: number;
  originalMesh: pc.Mesh | null;
  originalMaterial: pc.Material | null;
}

export class LODSystem {
  private app: pc.Application | null = null;
  private lodEntities: Map<string, LODEntityData> = new Map();
  private isEnabled: boolean = true;
  private cameraPosition: pc.Vec3 = new pc.Vec3();
  private defaultConfig: LODConfig = {
    levels: [],
    autoSwitch: true,
    updateInterval: 0.1,
    minDistance: 0,
    maxDistance: 500,
  };

  constructor(app?: pc.Application) {
    this.app = app || null;
  }

  public setApp(app: pc.Application): void {
    this.app = app;
  }

  public createLODEntity(
    entity: pc.Entity,
    config: Partial<LODConfig> = {},
  ): string | null {
    if (!this.app) {
      console.warn('LODSystem: App not set');
      return null;
    }

    const id = entity.name || `lod_${Date.now()}`;
    
    if (this.lodEntities.has(id)) {
      return id;
    }

    const finalConfig: LODConfig = { ...this.defaultConfig, ...config };

    const render = entity.render;
    let originalMesh: pc.Mesh | null = null;
    let originalMaterial: pc.Material | null = null;

    if (render) {
      const meshInstances = (render as unknown as { meshInstances?: pc.MeshInstance[] })
        .meshInstances;
      if (meshInstances && meshInstances.length > 0) {
        originalMesh = meshInstances[0].mesh;
        originalMaterial = meshInstances[0].material;
      }
    }

    const lodData: LODEntityData = {
      entity,
      config: finalConfig,
      currentLevel: 0,
      lastUpdateTime: 0,
      originalMesh,
      originalMaterial,
    };

    this.lodEntities.set(id, lodData);
    return id;
  }

  public addLODLevel(
    entityId: string,
    level: number,
    distance: number,
    mesh: pc.Mesh | null,
    material?: pc.Material | null,
  ): boolean {
    const lodData = this.lodEntities.get(entityId);
    if (!lodData) {
      console.warn(`LODSystem: Entity ${entityId} not found`);
      return false;
    }

    const lodLevel: LODLevel = {
      level,
      distance,
      mesh,
      material: material || lodData.originalMaterial,
      enabled: true,
    };

    const existingIndex = lodData.config.levels.findIndex((l) => l.level === level);
    if (existingIndex >= 0) {
      lodData.config.levels[existingIndex] = lodLevel;
    } else {
      lodData.config.levels.push(lodLevel);
    }

    lodData.config.levels.sort((a, b) => a.distance - b.distance);
    return true;
  }

  public removeLODLevel(entityId: string, level: number): boolean {
    const lodData = this.lodEntities.get(entityId);
    if (!lodData) return false;

    const index = lodData.config.levels.findIndex((l) => l.level === level);
    if (index >= 0) {
      lodData.config.levels.splice(index, 1);
      return true;
    }
    return false;
  }

  public getCurrentLODLevel(entityId: string): number {
    const lodData = this.lodEntities.get(entityId);
    return lodData?.currentLevel ?? 0;
  }

  public setLODLevel(entityId: string, level: number): boolean {
    const lodData = this.lodEntities.get(entityId);
    if (!lodData) return false;

    const lodLevel = lodData.config.levels.find((l) => l.level === level);
    if (!lodLevel || !lodLevel.enabled) return false;

    this.applyLODLevel(lodData, lodLevel);
    lodData.currentLevel = level;
    return true;
  }

  private applyLODLevel(lodData: LODEntityData, lodLevel: LODLevel): void {
    const render = lodData.entity.render;
    if (!render) return;

    const meshInstances = (render as unknown as { meshInstances?: pc.MeshInstance[] })
      .meshInstances;
    if (!meshInstances || meshInstances.length === 0) return;

    const meshInstance = meshInstances[0];
    
    if (lodLevel.mesh) {
      meshInstance.mesh = lodLevel.mesh;
    }
    if (lodLevel.material) {
      meshInstance.material = lodLevel.material;
    }
  }

  public update(dt: number, cameraPosition?: pc.Vec3): void {
    if (!this.isEnabled) return;

    if (cameraPosition) {
      this.cameraPosition.copy(cameraPosition);
    } else if (this.app) {
      const camera = this.app.root.findComponent('camera') as pc.CameraComponent;
      if (camera) {
        this.cameraPosition.copy(camera.entity.getPosition());
      }
    }

    this.lodEntities.forEach((lodData, id) => {
      if (!lodData.config.autoSwitch || lodData.config.levels.length === 0) return;

      lodData.lastUpdateTime += dt;
      if (lodData.lastUpdateTime < lodData.config.updateInterval) return;
      lodData.lastUpdateTime = 0;

      const entityPosition = lodData.entity.getPosition();
      const distance = this.cameraPosition.distance(entityPosition);

      const targetLevel = this.findAppropriateLevel(lodData, distance);
      if (targetLevel !== lodData.currentLevel) {
        this.setLODLevel(id, targetLevel);
      }
    });
  }

  private findAppropriateLevel(lodData: LODEntityData, distance: number): number {
    const levels = lodData.config.levels;
    if (levels.length === 0) return 0;

    for (let i = levels.length - 1; i >= 0; i--) {
      if (distance >= levels[i].distance && levels[i].enabled) {
        return levels[i].level;
      }
    }

    return levels[0].level;
  }

  public setEntityLODEnabled(entityId: string, enabled: boolean): void {
    const lodData = this.lodEntities.get(entityId);
    if (lodData) {
      lodData.config.autoSwitch = enabled;
    }
  }

  public removeEntity(entityId: string): void {
    this.lodEntities.delete(entityId);
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public getStats(): {
    totalEntities: number;
    totalLevels: number;
    activeEntities: number;
  } {
    let totalLevels = 0;
    let activeEntities = 0;

    this.lodEntities.forEach((lodData) => {
      totalLevels += lodData.config.levels.length;
      if (lodData.config.autoSwitch) {
        activeEntities++;
      }
    });

    return {
      totalEntities: this.lodEntities.size,
      totalLevels,
      activeEntities,
    };
  }

  public generateLODLevels(
    sourceMesh: pc.Mesh,
    levelCount: number,
    reductionFactor: number = 0.5,
  ): pc.Mesh[] {
    const lodMeshes: pc.Mesh[] = [];

    for (let i = 0; i < levelCount; i++) {
      const lodMesh = this.simplifyMesh(sourceMesh, Math.pow(reductionFactor, i + 1));
      lodMeshes.push(lodMesh);
    }

    return lodMeshes;
  }

  private simplifyMesh(sourceMesh: pc.Mesh, _reductionRatio: number): pc.Mesh {
    return sourceMesh;
  }

  public destroy(): void {
    this.lodEntities.clear();
  }
}
