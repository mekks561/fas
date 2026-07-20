import * as pc from 'playcanvas';

export interface InstanceData {
  id: string;
  position: pc.Vec3;
  rotation: pc.Vec3;
  scale: pc.Vec3;
  color: pc.Color;
  visible: boolean;
  userData?: unknown;
}

export interface InstanceMesh {
  mesh: pc.Mesh | null;
  material: pc.Material | null;
  instances: Map<string, InstanceData>;
  maxInstances: number;
  entity: pc.Entity;
  instanceIdCounter: number;
}

export interface LODInstanceLevel {
  level: number;
  distance: number;
  meshAssetId: string;
  materialAssetId?: string;
}

export interface BatchGroup {
  id: string;
  meshAssetId: string;
  materialAssetId: string;
  maxInstances: number;
  instances: Map<string, InstanceData>;
  entity: pc.Entity;
  dirty: boolean;
  instanceBuffer: pc.VertexBuffer | null;
  instanceIdCounter: number;
  lodLevels: LODInstanceLevel[];
  currentLODLevel: number;
  lastLODUpdate: number;
  lodUpdateInterval: number;
}

export class InstancedRenderer {
  private app: pc.Application | null = null;
  private batchGroups: Map<string, BatchGroup> = new Map();
  private isEnabled: boolean = true;
  private maxTotalInstances: number = 50000;
  private totalInstances: number = 0;
  private cullingEnabled: boolean = true;
  private cullingDistance: number = 200;
  private cameraPosition: pc.Vec3 = new pc.Vec3();
  private updateInterval: number = 0;
  private hiddenCount: number = 0;
  private visibleCount: number = 0;
  private lodEnabled: boolean = true;

  constructor(app?: pc.Application) {
    this.app = app || null;
  }

  public setApp(app: pc.Application): void {
    this.app = app;
  }

  public get isWebGPUAvailable(): boolean {
    return this.app?.graphicsDevice?.deviceType === pc.DEVICETYPE_WEBGPU;
  }

  public createBatchGroup(config: {
    id: string;
    meshAssetId: string;
    materialAssetId: string;
    maxInstances?: number;
    lodLevels?: LODInstanceLevel[];
  }): BatchGroup | null {
    if (!this.app) {
      console.warn('App not set for InstancedRenderer');
      return null;
    }

    if (this.batchGroups.has(config.id)) {
      return this.batchGroups.get(config.id) ?? null;
    }

    const meshAsset = this.app.assets.find(config.meshAssetId);
    const materialAsset = this.app.assets.find(config.materialAssetId);

    if (!meshAsset || !materialAsset) {
      console.warn(`Assets not found: ${config.meshAssetId} or ${config.materialAssetId}`);
      return null;
    }

    const entity = new pc.Entity(config.id);
    entity.addComponent('model', {
      type: 'box',
      width: 0.1,
      height: 0.1,
      depth: 0.1,
    });
    
    if (entity.model && meshAsset.resource && materialAsset.resource) {
      const typedModel = entity.model as unknown as { meshInstances?: pc.MeshInstance[] };
      const mesh = meshAsset.resource as pc.Mesh;
      const material = materialAsset.resource as pc.Material;
      const meshInstance = new pc.MeshInstance(mesh, material);
      typedModel.meshInstances = [meshInstance];
    }

    this.app.root.addChild(entity);

    const batchGroup: BatchGroup = {
      id: config.id,
      meshAssetId: config.meshAssetId,
      materialAssetId: config.materialAssetId,
      maxInstances: config.maxInstances || 100,
      instances: new Map(),
      entity,
      dirty: true,
      instanceBuffer: null,
      instanceIdCounter: 0,
      lodLevels: config.lodLevels || [],
      currentLODLevel: 0,
      lastLODUpdate: 0,
      lodUpdateInterval: 0.5,
    };

    this.batchGroups.set(config.id, batchGroup);
    return batchGroup;
  }

  public addLODLevel(batchId: string, level: LODInstanceLevel): boolean {
    const batch = this.batchGroups.get(batchId);
    if (!batch) return false;

    const existingIndex = batch.lodLevels.findIndex((l) => l.level === level.level);
    if (existingIndex >= 0) {
      batch.lodLevels[existingIndex] = level;
    } else {
      batch.lodLevels.push(level);
    }

    batch.lodLevels.sort((a, b) => a.distance - b.distance);
    batch.dirty = true;
    return true;
  }

  public removeLODLevel(batchId: string, level: number): boolean {
    const batch = this.batchGroups.get(batchId);
    if (!batch) return false;

    const index = batch.lodLevels.findIndex((l) => l.level === level);
    if (index >= 0) {
      batch.lodLevels.splice(index, 1);
      batch.dirty = true;
      return true;
    }
    return false;
  }

  public addInstance(batchId: string, data: Omit<InstanceData, 'id'>): string | null {
    const batch = this.batchGroups.get(batchId);
    if (!batch) return null;

    if (batch.instances.size >= batch.maxInstances) {
      console.warn(`Batch ${batchId} is full`);
      return null;
    }

    if (this.totalInstances >= this.maxTotalInstances) {
      console.warn('Maximum total instances reached');
      return null;
    }

    const id = `${batchId}_${batch.instanceIdCounter++}`;
    const instance: InstanceData = {
      id,
      ...data,
      visible: data.visible !== undefined ? data.visible : true,
    };

    batch.instances.set(id, instance);
    batch.dirty = true;
    this.totalInstances++;

    return id;
  }

  public removeInstance(batchId: string, instanceId: string): boolean {
    const batch = this.batchGroups.get(batchId);
    if (!batch) return false;

    const removed = batch.instances.delete(instanceId);
    if (removed) {
      batch.dirty = true;
      this.totalInstances--;
    }
    return removed;
  }

  public updateInstance(batchId: string, instanceId: string, data: Partial<InstanceData>): boolean {
    const batch = this.batchGroups.get(batchId);
    if (!batch) return false;

    const instance = batch.instances.get(instanceId);
    if (!instance) return false;

    Object.assign(instance, data);
    batch.dirty = true;
    return true;
  }

  public getInstance(batchId: string, instanceId: string): InstanceData | null {
    const batch = this.batchGroups.get(batchId);
    if (!batch) return null;
    return batch.instances.get(instanceId) || null;
  }

  public getAllInstances(batchId: string): InstanceData[] {
    const batch = this.batchGroups.get(batchId);
    if (!batch) return [];
    return Array.from(batch.instances.values());
  }

  public setInstanceVisible(batchId: string, instanceId: string, visible: boolean): boolean {
    return this.updateInstance(batchId, instanceId, { visible });
  }

  public setInstancePosition(batchId: string, instanceId: string, position: pc.Vec3): boolean {
    return this.updateInstance(batchId, instanceId, { position });
  }

  public setInstanceRotation(batchId: string, instanceId: string, rotation: pc.Vec3): boolean {
    return this.updateInstance(batchId, instanceId, { rotation });
  }

  public setInstanceScale(batchId: string, instanceId: string, scale: pc.Vec3): boolean {
    return this.updateInstance(batchId, instanceId, { scale });
  }

  public setInstanceColor(batchId: string, instanceId: string, color: pc.Color): boolean {
    return this.updateInstance(batchId, instanceId, { color });
  }

  public clearBatch(batchId: string): void {
    const batch = this.batchGroups.get(batchId);
    if (!batch) return;

    this.totalInstances -= batch.instances.size;
    batch.instances.clear();
    batch.dirty = true;
  }

  public removeBatch(batchId: string): void {
    const batch = this.batchGroups.get(batchId);
    if (!batch) return;

    this.totalInstances -= batch.instances.size;

    if (batch.instanceBuffer) {
      batch.instanceBuffer.destroy();
      batch.instanceBuffer = null;
    }

    this.batchGroups.delete(batchId);

    if (batch.entity && batch.entity.parent) {
      batch.entity.parent.removeChild(batch.entity);
      batch.entity.destroy();
    }
  }

  public update(dt: number, cameraPosition?: pc.Vec3): void {
    if (!this.isEnabled) return;

    this.updateInterval += dt;
    if (this.updateInterval < 0.016) return;
    this.updateInterval = 0;

    if (cameraPosition) {
      this.cameraPosition.copy(cameraPosition);
    } else if (this.app) {
      const camera = this.app.root.findComponent('camera') as pc.CameraComponent;
      if (camera) {
        this.cameraPosition.copy(camera.entity.getPosition());
      }
    }

    this.hiddenCount = 0;
    this.visibleCount = 0;

    this.batchGroups.forEach((batch) => {
      if (batch.dirty) {
        this.rebuildBatch(batch);
        batch.dirty = false;
      }

      if (this.cullingEnabled) {
        this.performCulling(batch);
      }

      if (this.lodEnabled && batch.lodLevels.length > 0) {
        this.updateBatchLOD(batch, dt);
      }
    });
  }

  private updateBatchLOD(batch: BatchGroup, dt: number): void {
    batch.lastLODUpdate += dt;
    if (batch.lastLODUpdate < batch.lodUpdateInterval) return;
    batch.lastLODUpdate = 0;

    if (batch.instances.size === 0) return;

    let averageDistance = 0;
    let count = 0;

    batch.instances.forEach((instance) => {
      if (instance.visible) {
        averageDistance += this.cameraPosition.distance(instance.position);
        count++;
      }
    });

    if (count === 0) return;

    averageDistance /= count;

    const targetLevel = this.findAppropriateLODLevel(batch, averageDistance);
    if (targetLevel !== batch.currentLODLevel) {
      this.switchBatchLOD(batch, targetLevel);
    }
  }

  private findAppropriateLODLevel(batch: BatchGroup, distance: number): number {
    const levels = batch.lodLevels;
    if (levels.length === 0) return 0;

    for (let i = levels.length - 1; i >= 0; i--) {
      if (distance >= levels[i].distance) {
        return levels[i].level;
      }
    }

    return 0;
  }

  private switchBatchLOD(batch: BatchGroup, level: number): void {
    if (!this.app) return;

    const lodLevel = batch.lodLevels.find((l) => l.level === level);
    if (!lodLevel) return;

    const meshAsset = this.app.assets.find(lodLevel.meshAssetId);
    const materialAsset = lodLevel.materialAssetId
      ? this.app.assets.find(lodLevel.materialAssetId)
      : this.app.assets.find(batch.materialAssetId);

    if (!meshAsset) return;

    const render = batch.entity.render;
    if (!render) return;

    const meshInstances = (render as unknown as { meshInstances?: pc.MeshInstance[] })
      .meshInstances;
    if (!meshInstances || meshInstances.length === 0) return;

    const meshInstance = meshInstances[0];
    meshInstance.mesh = meshAsset.resource as pc.Mesh;

    if (materialAsset) {
      meshInstance.material = materialAsset.resource as pc.Material;
    }

    batch.currentLODLevel = level;
    batch.dirty = true;
  }

  private rebuildBatch(batch: BatchGroup): void {
    if (!this.app) return;

    const render = batch.entity.render;
    if (!render) return;

    const device = this.app.graphicsDevice;
    const instanceCount = batch.instances.size;

    if (instanceCount === 0) {
      render.enabled = false;
      return;
    }

    render.enabled = true;

    const meshInstances = (render as unknown as { meshInstances?: pc.MeshInstance[] })
      .meshInstances;
    if (!meshInstances || meshInstances.length === 0) return;

    const meshInstance = meshInstances[0];

    const matrixSize = 16;
    const visibleInstances: InstanceData[] = [];

    batch.instances.forEach((instance) => {
      if (instance.visible) {
        visibleInstances.push(instance);
      }
    });

    const visibleCount = visibleInstances.length;
    if (visibleCount === 0) {
      render.enabled = false;
      return;
    }

    const matrices = new Float32Array(visibleCount * matrixSize);
    const mat = new pc.Mat4();
    const quat = new pc.Quat();

    for (let i = 0; i < visibleCount; i++) {
      const inst = visibleInstances[i];
      quat.setFromEulerAngles(inst.rotation.x, inst.rotation.y, inst.rotation.z);
      mat.setTRS(inst.position, quat, inst.scale);

      for (let m = 0; m < matrixSize; m++) {
        matrices[i * matrixSize + m] = mat.data[m];
      }
    }

    if (!batch.instanceBuffer || batch.instanceBuffer.numVertices < visibleCount) {
      if (batch.instanceBuffer) {
        batch.instanceBuffer.destroy();
      }
      const format = pc.VertexFormat.getDefaultInstancingFormat(device);
      const bufferSize = Math.max(visibleCount, batch.maxInstances);
      batch.instanceBuffer = new pc.VertexBuffer(device, format, bufferSize, {
        usage: pc.BUFFER_DYNAMIC,
      });
    }

    batch.instanceBuffer.setData(matrices.buffer as ArrayBuffer);
    meshInstance.setInstancing(batch.instanceBuffer);

    (meshInstance as unknown as { visibleInstanceCount: number }).visibleInstanceCount =
      visibleCount;

    this.visibleCount = visibleCount;
  }

  private performCulling(batch: BatchGroup): void {
    if (!this.cullingEnabled) return;

    const render = batch.entity.render;
    if (!render) return;

    const cameraPos = this.cameraPosition;

    batch.instances.forEach((instance) => {
      const distance = cameraPos.distance(instance.position);

      if (distance > this.cullingDistance) {
        if (instance.visible) {
          instance.visible = false;
          this.hiddenCount++;
          batch.dirty = true;
        }
      } else {
        if (!instance.visible) {
          instance.visible = true;
          this.visibleCount++;
          batch.dirty = true;
        } else {
          this.visibleCount++;
        }
      }
    });
  }

  public setCullingEnabled(enabled: boolean): void {
    this.cullingEnabled = enabled;
  }

  public setCullingDistance(distance: number): void {
    this.cullingDistance = distance;
  }

  public setLODEnabled(enabled: boolean): void {
    this.lodEnabled = enabled;
  }

  public setMaxTotalInstances(max: number): void {
    this.maxTotalInstances = max;
  }

  public getStats(): {
    totalBatches: number;
    totalInstances: number;
    visibleInstances: number;
    hiddenInstances: number;
    maxInstances: number;
    lodBatches: number;
  } {
    let lodBatches = 0;
    this.batchGroups.forEach((batch) => {
      if (batch.lodLevels.length > 0) {
        lodBatches++;
      }
    });

    return {
      totalBatches: this.batchGroups.size,
      totalInstances: this.totalInstances,
      visibleInstances: this.visibleCount,
      hiddenInstances: this.hiddenCount,
      maxInstances: this.maxTotalInstances,
      lodBatches,
    };
  }

  public getBatchIds(): string[] {
    return Array.from(this.batchGroups.keys());
  }

  public getBatchStats(batchId: string): {
    instanceCount: number;
    maxInstances: number;
    lodLevels: number;
    currentLOD: number;
  } | null {
    const batch = this.batchGroups.get(batchId);
    if (!batch) return null;
    return {
      instanceCount: batch.instances.size,
      maxInstances: batch.maxInstances,
      lodLevels: batch.lodLevels.length,
      currentLOD: batch.currentLODLevel,
    };
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public destroy(): void {
    this.batchGroups.forEach((batch) => {
      if (batch.instanceBuffer) {
        batch.instanceBuffer.destroy();
      }
    });
    this.batchGroups.clear();
    this.totalInstances = 0;
  }

  public getRendererInfo(): { webgpu: boolean; maxInstances: number; batches: number; lodEnabled: boolean } {
    return {
      webgpu: this.isWebGPUAvailable,
      maxInstances: this.maxTotalInstances,
      batches: this.batchGroups.size,
      lodEnabled: this.lodEnabled,
    };
  }
}
