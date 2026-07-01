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

export interface BatchGroup {
  id: string;
  meshAssetId: string;
  materialAssetId: string;
  maxInstances: number;
  instances: Map<string, InstanceData>;
  entity: pc.Entity;
  dirty: boolean;
}

export class InstancedRenderer {
  private app: pc.Application | null = null;
  private batchGroups: Map<string, BatchGroup> = new Map();
  private instanceMatrixData: Float32Array = new Float32Array(0);
  private instanceColorData: Float32Array = new Float32Array(0);
  private isEnabled: boolean = true;
  private maxTotalInstances: number = 1000;
  private totalInstances: number = 0;
  private cullingEnabled: boolean = true;
  private cullingDistance: number = 200;
  private cameraPosition: pc.Vec3 = new pc.Vec3();
  private updateInterval: number = 0;
  private lastUpdateTime: number = 0;
  private hiddenCount: number = 0;
  private visibleCount: number = 0;

  constructor(app?: pc.Application) {
    this.app = app || null;
  }

  public setApp(app: pc.Application): void {
    this.app = app;
  }

  public createBatchGroup(config: {
    id: string;
    meshAssetId: string;
    materialAssetId: string;
    maxInstances?: number;
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
    entity.addComponent('render', {
      meshInstances: [meshAsset.resource],
      material: materialAsset.resource
    });

    this.app.root.addChild(entity);

    const batchGroup: BatchGroup = {
      id: config.id,
      meshAssetId: config.meshAssetId,
      materialAssetId: config.materialAssetId,
      maxInstances: config.maxInstances || 100,
      instances: new Map(),
      entity,
      dirty: true
    };

    this.batchGroups.set(config.id, batchGroup);
    return batchGroup;
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
      visible: data.visible !== undefined ? data.visible : true
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
    });
  }

  private rebuildBatch(batch: BatchGroup): void {
    if (!this.app) return;

    const render = batch.entity.render;
    if (!render) return;

    const instanceCount = batch.instances.size;
    
    if (instanceCount === 0) {
      render.enabled = false;
      return;
    }

    render.enabled = true;

    const meshInstances = (render as unknown as { meshInstances?: { setMatrix?: (index: number, matrix: pc.Mat4) => void; setColor?: (index: number, color: pc.Color) => void; visibleInstanceCount?: number; }[] }).meshInstances;
    if (!meshInstances || meshInstances.length === 0) return;

    const meshInstance = meshInstances[0];

    let index = 0;
    batch.instances.forEach((instance) => {
      if (instance.visible) {
        const matrix = new pc.Mat4();
        const rotation = new pc.Mat4().setTRS(instance.position, new pc.Quat().setFromEulerAngles(instance.rotation.x, instance.rotation.y, instance.rotation.z), new pc.Vec3(1, 1, 1));
        const scaleMatrix = new pc.Mat4().setTRS(instance.position, new pc.Quat(), instance.scale);
        
        matrix.copy(rotation);
        matrix.mul(scaleMatrix);
        
        if (meshInstance.setMatrix) {
          meshInstance.setMatrix(index, matrix);
        }
        if (meshInstance.setColor && instance.color) {
          meshInstance.setColor(index, instance.color);
        }
        index++;
      }
    });

    meshInstance.visibleInstanceCount = this.visibleCount;
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

  public setMaxTotalInstances(max: number): void {
    this.maxTotalInstances = max;
  }

  public getStats(): {
    totalBatches: number;
    totalInstances: number;
    visibleInstances: number;
    hiddenInstances: number;
    maxInstances: number;
  } {
    return {
      totalBatches: this.batchGroups.size,
      totalInstances: this.totalInstances,
      visibleInstances: this.visibleCount,
      hiddenInstances: this.hiddenCount,
      maxInstances: this.maxTotalInstances
    };
  }

  public getBatchIds(): string[] {
    return Array.from(this.batchGroups.keys());
  }

  public getBatchStats(batchId: string): {
    instanceCount: number;
    maxInstances: number;
  } | null {
    const batch = this.batchGroups.get(batchId);
    if (!batch) return null;
    return {
      instanceCount: batch.instances.size,
      maxInstances: batch.maxInstances
    };
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public destroy(): void {
    this.batchGroups.forEach((_, id) => this.removeBatch(id));
    this.batchGroups.clear();
    this.instanceMatrixData = new Float32Array(0);
    this.instanceColorData = new Float32Array(0);
    this.totalInstances = 0;
  }
}