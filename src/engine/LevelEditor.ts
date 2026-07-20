import * as pc from 'playcanvas';

export type EditorMode = 'select' | 'move' | 'rotate' | 'scale' | 'place' | 'delete';

export type GridSize = 1 | 2 | 5 | 10;

export interface LevelObject {
  id: string;
  type: string;
  position: pc.Vec3;
  rotation: pc.Vec3;
  scale: pc.Vec3;
  properties: Record<string, unknown>;
  entity?: pc.Entity;
}

export interface LevelData {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  createdAt: number;
  modifiedAt: number;
  settings: LevelSettings;
  objects: LevelObject[];
  spawnPoints: SpawnPoint[];
  objectives: Objective[];
}

export interface LevelSettings {
  timeLimit: number;
  enemyCount: number;
  difficulty: 'easy' | 'normal' | 'hard' | 'expert';
  environment: string;
  backgroundColor: pc.Color;
  ambientColor: pc.Color;
  fogEnabled: boolean;
  fogColor: pc.Color;
  fogDensity: number;
}

export interface SpawnPoint {
  id: string;
  type: 'player' | 'enemy' | 'item';
  position: pc.Vec3;
  rotation: pc.Vec3;
  properties: Record<string, unknown>;
}

export interface Objective {
  id: string;
  type: 'kill' | 'collect' | 'survive' | 'escort' | 'defend';
  target: string;
  count: number;
  description: string;
  reward: number;
}

export interface ObjectTemplate {
  id: string;
  name: string;
  category: 'environment' | 'enemy' | 'item' | 'trigger' | 'decorator';
  icon: string;
  defaultProperties: Record<string, unknown>;
  meshAssetId?: string;
  materialAssetId?: string;
  color?: pc.Color;
  size?: pc.Vec3;
}

export interface EditorHistory {
  action: 'add' | 'remove' | 'modify' | 'transform';
  objects: LevelObject[];
  previousState?: LevelObject[];
}

export interface SelectionBox {
  min: pc.Vec3;
  max: pc.Vec3;
}

type EditorCallback = (mode: EditorMode, object?: LevelObject) => void;
type ObjectCallback = (object: LevelObject) => void;
type LevelCallback = (level: LevelData) => void;

export class LevelEditor {
  private app: pc.Application | null = null;
  private isEnabled: boolean = false;
  private mode: EditorMode = 'select';
  private gridSize: GridSize = 1;
  private gridVisible: boolean = true;
  private snapToGrid: boolean = true;
  private selectedObjects: LevelObject[] = [];
  private hoveredObject: LevelObject | null = null;
  private level: LevelData | null = null;
  private templates: Map<string, ObjectTemplate> = new Map();
  private editorCamera: pc.Entity | null = null;
  private editorGrid: pc.Entity | null = null;
  private selectionBox: pc.Entity | null = null;
  private previewEntity: pc.Entity | null = null;
  private currentTemplate: ObjectTemplate | null = null;

  private history: EditorHistory[] = [];
  private historyIndex: number = -1;
  private maxHistorySize: number = 50;

  private callbacks: {
    modeChange: EditorCallback[];
    objectSelect: ObjectCallback[];
    objectAdd: ObjectCallback[];
    objectRemove: ObjectCallback[];
    objectModify: ObjectCallback[];
    levelChange: LevelCallback[];
    historyChange: (() => void)[];
  } = {
    modeChange: [],
    objectSelect: [],
    objectAdd: [],
    objectRemove: [],
    objectModify: [],
    levelChange: [],
    historyChange: [],
  };

  private gridMaterial: pc.StandardMaterial | null = null;
  private selectionMaterial: pc.StandardMaterial | null = null;
  private hoverMaterial: pc.StandardMaterial | null = null;

  constructor(app?: pc.Application) {
    this.app = app || null;
    this.initializeDefaultTemplates();
    this.initializeMaterials();
  }

  public setApp(app: pc.Application): void {
    this.app = app;
  }

  public enable(): void {
    if (this.isEnabled) return;
    this.isEnabled = true;
    this.createEditorCamera();
    this.createGrid();
    this.setupInputHandlers();
  }

  public disable(): void {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    this.clearSelection();
    this.destroyEditorObjects();
  }

  public isActive(): boolean {
    return this.isEnabled;
  }

  private initializeDefaultTemplates(): void {
    const templates: ObjectTemplate[] = [
      {
        id: 'cube',
        name: 'Cube',
        category: 'environment',
        icon: '⬜',
        defaultProperties: { size: 1 },
      },
      {
        id: 'sphere',
        name: 'Sphere',
        category: 'environment',
        icon: '⚪',
        defaultProperties: { radius: 0.5 },
      },
      {
        id: 'cylinder',
        name: 'Cylinder',
        category: 'environment',
        icon: '🔘',
        defaultProperties: { radius: 0.5, height: 2 },
      },
      {
        id: 'wall',
        name: 'Wall',
        category: 'environment',
        icon: '🧱',
        defaultProperties: { width: 4, height: 2, thickness: 0.5 },
      },
      {
        id: 'platform',
        name: 'Platform',
        category: 'environment',
        icon: '📦',
        defaultProperties: { width: 10, height: 0.5, depth: 10 },
      },
      {
        id: 'enemy_spawn',
        name: 'Enemy Spawn',
        category: 'trigger',
        icon: '💀',
        defaultProperties: { enemyType: 'scout', count: 5 },
      },
      {
        id: 'item_spawn',
        name: 'Item Spawn',
        category: 'item',
        icon: '💎',
        defaultProperties: { itemType: 'health', respawn: true },
      },
      {
        id: 'checkpoint',
        name: 'Checkpoint',
        category: 'trigger',
        icon: '🚩',
        defaultProperties: {},
      },
      { id: 'goal', name: 'Goal', category: 'trigger', icon: '🎯', defaultProperties: {} },
      {
        id: 'light',
        name: 'Light',
        category: 'decorator',
        icon: '💡',
        defaultProperties: { type: 'point', intensity: 1, range: 10, color: '#ffffff' },
      },
      {
        id: 'particle',
        name: 'Particle',
        category: 'decorator',
        icon: '✨',
        defaultProperties: { type: 'sparkle', duration: 5 },
      },
    ];

    templates.forEach((t) => this.templates.set(t.id, t));
  }

  private initializeMaterials(): void {
    this.gridMaterial = new pc.StandardMaterial();
    this.gridMaterial.diffuse = new pc.Color(0.2, 0.2, 0.2);
    this.gridMaterial.emissive = new pc.Color(0.1, 0.1, 0.15);
    this.gridMaterial.update();

    this.selectionMaterial = new pc.StandardMaterial();
    this.selectionMaterial.diffuse = new pc.Color(0, 0.5, 1);
    this.selectionMaterial.emissive = new pc.Color(0, 0.2, 0.5);
    this.selectionMaterial.update();

    this.hoverMaterial = new pc.StandardMaterial();
    this.hoverMaterial.diffuse = new pc.Color(0, 1, 0.5);
    this.hoverMaterial.emissive = new pc.Color(0, 0.5, 0.2);
    this.hoverMaterial.update();
  }

  private createEditorCamera(): void {
    if (!this.app) return;

    this.editorCamera = new pc.Entity('EditorCamera');
    this.editorCamera.addComponent('camera', {
      clearColor: new pc.Color(0.1, 0.1, 0.15),
      farClip: 1000,
    });
    this.editorCamera.setPosition(0, 10, 20);
    this.editorCamera.lookAt(0, 0, 0);
    this.app.root.addChild(this.editorCamera);

    this.app.root.findByName('Camera')?.destroy();
  }

  private createGrid(): void {
    if (!this.app || !this.gridMaterial) return;

    this.editorGrid = new pc.Entity('EditorGrid');

    const size = 50;
    const divisions = 50;

    for (let i = -divisions; i <= divisions; i++) {
      const line = new pc.Entity();
      line.addComponent('render', {
        type: 'box',
      });
      if (line.render) line.render.material = this.gridMaterial;

      if (Math.abs(i) === divisions) {
        line.setLocalScale(0.05, 0.02, size);
        line.setPosition(i * (size / divisions / 2), 0, 0);
      } else {
        line.setLocalScale(0.02, 0.02, size);
        line.setPosition(i * (size / divisions / 2), 0, 0);
      }

      this.editorGrid.addChild(line);
    }

    for (let i = -divisions; i <= divisions; i++) {
      const line = new pc.Entity();
      line.addComponent('render', {
        type: 'box',
      });
      if (line.render) line.render.material = this.gridMaterial;
      line.setLocalScale(size, 0.02, 0.02);
      line.setPosition(0, 0, i * (size / divisions / 2));
      this.editorGrid.addChild(line);
    }

    this.app.root.addChild(this.editorGrid);
  }

  private setupInputHandlers(): void {
    if (!this.app) return;

    this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
    this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
    this.app.mouse.on(pc.EVENT_MOUSEUP, this.onMouseUp, this);

    window.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  private onMouseDown(event: pc.MouseEvent): void {
    if (!this.isEnabled || !this.app) return;

    switch (this.mode) {
      case 'select':
        this.handleSelect(event);
        break;
      case 'place':
        this.handlePlace(event);
        break;
      case 'delete':
        this.handleDelete(event);
        break;
    }
  }

  private onMouseMove(event: pc.MouseEvent): void {
    if (!this.isEnabled || !this.app) return;

    if (this.mode === 'place' && this.previewEntity) {
      this.updatePreviewPosition(event);
    }

    if (this.mode === 'select') {
      this.handleHover(event);
    }
  }

  private onMouseUp(_event: pc.MouseEvent): void {}

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled) return;

    switch (event.code) {
      case 'Delete':
      case 'Backspace':
        if (this.selectedObjects.length > 0) {
          this.deleteSelected();
        }
        break;
      case 'Escape':
        this.clearSelection();
        this.setMode('select');
        break;
      case 'KeyG':
        this.toggleGrid();
        break;
      case 'KeyS':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.saveLevel();
        } else {
          this.setMode('select');
        }
        break;
      case 'KeyZ':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          if (event.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
        }
        break;
    }
  }

  private handleSelect(event: pc.MouseEvent): void {
    const from = this.editorCamera?.camera?.screenToWorld(
      event.x,
      event.y,
      this.editorCamera?.camera?.nearClip,
    );
    const to = this.editorCamera?.camera?.screenToWorld(
      event.x,
      event.y,
      this.editorCamera?.camera?.farClip,
    );

    const rigidbodySystem = this.app?.systems.rigidbody;
    if (rigidbodySystem && from && to) {
      const result = rigidbodySystem.raycastFirst(from, to);
      if (result && result.entity) {
        const levelObject = this.findLevelObjectByEntity(result.entity);
        if (levelObject) {
          this.selectObject(levelObject);
        }
      }
    }
  }

  private handlePlace(event: pc.MouseEvent): void {
    if (!this.currentTemplate || !this.app) return;

    const from = this.editorCamera?.camera?.screenToWorld(
      event.x,
      event.y,
      this.editorCamera?.camera?.nearClip,
    );
    const to = this.editorCamera?.camera?.screenToWorld(
      event.x,
      event.y,
      this.editorCamera?.camera?.farClip,
    );

    const rigidbodySystem = this.app?.systems.rigidbody;
    if (rigidbodySystem && from && to) {
      const result = rigidbodySystem.raycastFirst(from, to);
      if (result) {
        const position = this.snapToGrid ? this.snapPosition(result.point) : result.point;
        this.addObject(this.currentTemplate.id, position);
      }
    }
  }

  private handleDelete(event: pc.MouseEvent): void {
    const from = this.editorCamera?.camera?.screenToWorld(
      event.x,
      event.y,
      this.editorCamera?.camera?.nearClip,
    );
    const to = this.editorCamera?.camera?.screenToWorld(
      event.x,
      event.y,
      this.editorCamera?.camera?.farClip,
    );

    const rigidbodySystem = this.app?.systems.rigidbody;
    if (rigidbodySystem && from && to) {
      const result = rigidbodySystem.raycastFirst(from, to);
      if (result && result.entity) {
        const levelObject = this.findLevelObjectByEntity(result.entity);
        if (levelObject) {
          this.removeObject(levelObject.id);
        }
      }
    }
  }

  private handleHover(event: pc.MouseEvent): void {
    const from = this.editorCamera?.camera?.screenToWorld(
      event.x,
      event.y,
      this.editorCamera?.camera?.nearClip,
    );
    const to = this.editorCamera?.camera?.screenToWorld(
      event.x,
      event.y,
      this.editorCamera?.camera?.farClip,
    );

    const rigidbodySystem = this.app?.systems.rigidbody;
    if (rigidbodySystem && from && to) {
      const result = rigidbodySystem.raycastFirst(from, to);
      if (result && result.entity) {
        const levelObject = this.findLevelObjectByEntity(result.entity);
        if (levelObject !== this.hoveredObject) {
          this.setHoveredObject(levelObject);
        }
      }
    } else {
      this.setHoveredObject(null);
    }
  }

  private updatePreviewPosition(event: pc.MouseEvent): void {
    if (!this.app || !this.previewEntity) return;

    const from = this.editorCamera?.camera?.screenToWorld(
      event.x,
      event.y,
      this.editorCamera?.camera?.nearClip,
    );
    const to = this.editorCamera?.camera?.screenToWorld(
      event.x,
      event.y,
      this.editorCamera?.camera?.farClip,
    );

    if (from && to) {
      const direction = new pc.Vec3().sub2(to, from).normalize();
      if (direction.y !== 0) {
        const t = -from.y / direction.y;
        if (t > 0) {
          const position = new pc.Vec3().add2(from, direction.scale(t));
          this.previewEntity.setPosition(this.snapToGrid ? this.snapPosition(position) : position);
        }
      }
    }
  }

  private snapPosition(position: pc.Vec3): pc.Vec3 {
    return new pc.Vec3(
      Math.round(position.x / this.gridSize) * this.gridSize,
      position.y,
      Math.round(position.z / this.gridSize) * this.gridSize,
    );
  }

  public setMode(mode: EditorMode): void {
    if (this.mode === mode) return;

    this.mode = mode;
    this.clearSelection();

    if (mode !== 'place' && this.previewEntity) {
      this.previewEntity.enabled = false;
    }

    this.callbacks.modeChange.forEach((cb) => cb(mode));
  }

  public getMode(): EditorMode {
    return this.mode;
  }

  public setGridSize(size: GridSize): void {
    this.gridSize = size;
  }

  public getGridSize(): GridSize {
    return this.gridSize;
  }

  public toggleGrid(): void {
    this.gridVisible = !this.gridVisible;
    if (this.editorGrid) {
      this.editorGrid.enabled = this.gridVisible;
    }
  }

  public setSnapToGrid(snap: boolean): void {
    this.snapToGrid = snap;
  }

  public isSnapToGrid(): boolean {
    return this.snapToGrid;
  }

  public setPlaceTemplate(templateId: string): void {
    const template = this.templates.get(templateId);
    if (!template) return;

    this.currentTemplate = template;
    this.setMode('place');
    this.createPreviewEntity(template);
  }

  private createPreviewEntity(template: ObjectTemplate): void {
    if (!this.app) return;

    if (this.previewEntity) {
      this.previewEntity.destroy();
    }

    this.previewEntity = new pc.Entity('Preview');
    this.previewEntity.addComponent('render', {
      type: this.getMeshType(template.id),
    });

    const material = new pc.StandardMaterial();
    material.diffuse = template.color || new pc.Color(0.5, 0.5, 0.5);
    material.opacity = 0.5;
    material.blendType = pc.BLEND_NORMAL;
    material.update();

    if (this.previewEntity.render) this.previewEntity.render.material = material;
    this.app.root.addChild(this.previewEntity);
  }

  private getMeshType(templateId: string): string {
    const typeMap: Record<string, string> = {
      cube: 'box',
      sphere: 'sphere',
      cylinder: 'cylinder',
      wall: 'box',
      platform: 'box',
      enemy_spawn: 'cone',
      item_spawn: 'cone',
      checkpoint: 'cone',
      goal: 'sphere',
      light: 'sphere',
      particle: 'sphere',
    };
    return typeMap[templateId] || 'box';
  }

  public createLevel(name: string, author: string = 'Unknown'): LevelData {
    this.level = {
      id: this.generateId(),
      name,
      description: '',
      version: '1.0.0',
      author,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      settings: this.getDefaultSettings(),
      objects: [],
      spawnPoints: [],
      objectives: [],
    };

    this.callbacks.levelChange.forEach((cb) => cb(this.level as LevelData));
    return this.level;
  }

  public loadLevel(data: LevelData): void {
    this.level = data;
    this.rebuildLevelObjects();
    this.callbacks.levelChange.forEach((cb) => cb(this.level as LevelData));
  }

  public saveLevel(): string | null {
    if (!this.level) return null;

    this.level.modifiedAt = Date.now();
    return JSON.stringify(this.level, null, 2);
  }

  public exportLevel(): string {
    if (!this.level) return '';
    return this.saveLevel() || '';
  }

  public importLevel(json: string): boolean {
    try {
      const data = JSON.parse(json) as LevelData;
      this.loadLevel(data);
      return true;
    } catch (e) {
      console.error('Failed to import level:', e);
      return false;
    }
  }

  private rebuildLevelObjects(): void {
    if (!this.level || !this.app) return;

    this.clearAllObjects();

    this.level.objects.forEach((obj) => {
      const entity = this.createObjectEntity(obj);
      obj.entity = entity;
      this.app?.root.addChild(entity);
    });
  }

  private createObjectEntity(obj: LevelObject): pc.Entity {
    const template = this.templates.get(obj.type);
    const entity = new pc.Entity(obj.id);

    entity.addComponent('render', {
      type: template ? this.getMeshType(template.id) : 'box',
    });

    if (template?.materialAssetId && this.app) {
      const material = this.app.assets.find(template.materialAssetId);
      if (material && material.resource instanceof pc.Material) {
        if (entity.render) entity.render.material = material.resource;
      }
    } else if (template?.color) {
      const material = new pc.StandardMaterial();
      material.diffuse = template.color;
      material.update();
      if (entity.render) entity.render.material = material;
    }

    entity.setPosition(obj.position);
    entity.setEulerAngles(obj.rotation);
    entity.setLocalScale(obj.scale);

    return entity;
  }

  public addObject(
    type: string,
    position: pc.Vec3,
    rotation?: pc.Vec3,
    scale?: pc.Vec3,
  ): LevelObject | null {
    if (!this.level) return null;

    const template = this.templates.get(type);
    if (!template) return null;

    const object: LevelObject = {
      id: this.generateId(),
      type,
      position: position.clone(),
      rotation: rotation?.clone() || new pc.Vec3(),
      scale: scale?.clone() || new pc.Vec3(1, 1, 1),
      properties: { ...template.defaultProperties },
    };

    if (this.app) {
      object.entity = this.createObjectEntity(object);
      this.app.root.addChild(object.entity);
    }

    this.level.objects.push(object);
    this.level.modifiedAt = Date.now();

    this.addToHistory({
      action: 'add',
      objects: [object],
    });

    this.callbacks.objectAdd.forEach((cb) => cb(object));
    return object;
  }

  public removeObject(id: string): boolean {
    if (!this.level) return false;

    const index = this.level.objects.findIndex((o) => o.id === id);
    if (index === -1) return false;

    const object = this.level.objects[index];
    this.level.objects.splice(index, 1);

    if (object.entity) {
      object.entity.destroy();
    }

    this.level.modifiedAt = Date.now();

    this.addToHistory({
      action: 'remove',
      objects: [object],
    });

    this.callbacks.objectRemove.forEach((cb) => cb(object));
    return true;
  }

  public modifyObject(id: string, updates: Partial<LevelObject>): boolean {
    if (!this.level) return false;

    const object = this.level.objects.find((o) => o.id === id);
    if (!object) return false;

    const previousState = { ...object };

    if (updates.position) object.position.copy(updates.position);
    if (updates.rotation) object.rotation.copy(updates.rotation);
    if (updates.scale) object.scale.copy(updates.scale);
    if (updates.properties) object.properties = { ...object.properties, ...updates.properties };

    if (object.entity) {
      if (updates.position) object.entity.setPosition(object.position);
      if (updates.rotation) object.entity.setEulerAngles(object.rotation);
      if (updates.scale) object.entity.setLocalScale(object.scale);
    }

    this.level.modifiedAt = Date.now();

    this.addToHistory({
      action: 'modify',
      objects: [object],
      previousState: [previousState],
    });

    this.callbacks.objectModify.forEach((cb) => cb(object));
    return true;
  }

  public selectObject(object: LevelObject): void {
    this.clearSelection();
    this.selectedObjects.push(object);

    if (object.entity && this.selectionMaterial) {
      if (object.entity.render) object.entity.render.material = this.selectionMaterial;
    }

    this.callbacks.objectSelect.forEach((cb) => cb(object));
  }

  public selectObjects(objects: LevelObject[]): void {
    this.clearSelection();
    this.selectedObjects.push(...objects);

    objects.forEach((obj) => {
      if (obj.entity && this.selectionMaterial) {
        if (obj.entity.render) obj.entity.render.material = this.selectionMaterial;
      }
    });
  }

  public clearSelection(): void {
    this.selectedObjects.forEach((obj) => {
      if (obj.entity) {
        const template = this.templates.get(obj.type);
        if (template?.color) {
          const material = new pc.StandardMaterial();
          material.diffuse = template.color;
          material.update();
          if (obj.entity?.render) obj.entity.render.material = material;
        }
      }
    });
    this.selectedObjects = [];
  }

  private setHoveredObject(object: LevelObject | null): void {
    if (this.hoveredObject === object) return;

    if (
      this.hoveredObject &&
      this.hoveredObject.entity &&
      !this.selectedObjects.includes(this.hoveredObject)
    ) {
      const template = this.templates.get(this.hoveredObject.type);
      if (template?.color) {
        const material = new pc.StandardMaterial();
        material.diffuse = template.color;
        material.update();
        if (this.hoveredObject.entity?.render) this.hoveredObject.entity.render.material = material;
      }
    }

    this.hoveredObject = object;

    if (object && object.entity && this.hoverMaterial && !this.selectedObjects.includes(object)) {
      if (object.entity.render) object.entity.render.material = this.hoverMaterial;
    }
  }

  private deleteSelected(): void {
    const ids = this.selectedObjects.map((o) => o.id);
    ids.forEach((id) => this.removeObject(id));
    this.clearSelection();
  }

  private clearAllObjects(): void {
    this.level?.objects.forEach((obj) => {
      if (obj.entity) {
        obj.entity.destroy();
      }
    });
    if (this.level) {
      this.level.objects = [];
    }
  }

  private findLevelObjectByEntity(entity: pc.Entity): LevelObject | null {
    if (!this.level) return null;

    return this.level.objects.find((obj) => obj.entity === entity) || null;
  }

  private getDefaultSettings(): LevelSettings {
    return {
      timeLimit: 300,
      enemyCount: 20,
      difficulty: 'normal',
      environment: 'space',
      backgroundColor: new pc.Color(0.02, 0.02, 0.05),
      ambientColor: new pc.Color(0.1, 0.1, 0.15),
      fogEnabled: false,
      fogColor: new pc.Color(0, 0, 0),
      fogDensity: 0.01,
    };
  }

  private addToHistory(history: EditorHistory): void {
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(history);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
    this.callbacks.historyChange.forEach((cb) => cb());
  }

  public undo(): boolean {
    if (this.historyIndex < 0) return false;

    const history = this.history[this.historyIndex];
    this.historyIndex--;

    switch (history.action) {
      case 'add':
        history.objects.forEach((obj) => this.removeObject(obj.id));
        break;
      case 'remove':
        if (this.level) {
          history.objects.forEach((obj) => {
            if (this.app) {
              obj.entity = this.createObjectEntity(obj);
              this.app.root.addChild(obj.entity);
            }
            this.level?.objects.push(obj);
          });
        }
        break;
      case 'modify':
        history.previousState?.forEach((prev) => {
          this.modifyObject(prev.id, prev);
        });
        break;
    }

    this.callbacks.historyChange.forEach((cb) => cb());
    return true;
  }

  public redo(): boolean {
    if (this.historyIndex >= this.history.length - 1) return false;

    this.historyIndex++;
    const history = this.history[this.historyIndex];

    switch (history.action) {
      case 'add':
        history.objects.forEach((obj) => {
          if (this.app && !obj.entity) {
            obj.entity = this.createObjectEntity(obj);
            this.app.root.addChild(obj.entity);
          }
          if (this.level && !this.level.objects.find((o) => o.id === obj.id)) {
            this.level.objects.push(obj);
          }
        });
        break;
      case 'remove':
        history.objects.forEach((obj) => this.removeObject(obj.id));
        break;
      case 'modify':
        history.objects.forEach((obj) => this.modifyObject(obj.id, obj));
        break;
    }

    this.callbacks.historyChange.forEach((cb) => cb());
    return true;
  }

  public canUndo(): boolean {
    return this.historyIndex >= 0;
  }

  public canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  private generateId(): string {
    return 'obj_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  private destroyEditorObjects(): void {
    if (this.editorCamera) {
      this.editorCamera.destroy();
      this.editorCamera = null;
    }
    if (this.editorGrid) {
      this.editorGrid.destroy();
      this.editorGrid = null;
    }
    if (this.selectionBox) {
      this.selectionBox.destroy();
      this.selectionBox = null;
    }
    if (this.previewEntity) {
      this.previewEntity.destroy();
      this.previewEntity = null;
    }
  }

  public getTemplates(): ObjectTemplate[] {
    return Array.from(this.templates.values());
  }

  public getTemplate(id: string): ObjectTemplate | undefined {
    return this.templates.get(id);
  }

  public registerTemplate(template: ObjectTemplate): void {
    this.templates.set(template.id, template);
  }

  public getLevel(): LevelData | null {
    return this.level ? { ...this.level } : null;
  }

  public getSelectedObjects(): LevelObject[] {
    return [...this.selectedObjects];
  }

  public getObjects(): LevelObject[] {
    return this.level ? [...this.level.objects] : [];
  }

  public onModeChange(callback: EditorCallback): () => void {
    this.callbacks.modeChange.push(callback);
    return () => {
      const index = this.callbacks.modeChange.indexOf(callback);
      if (index > -1) this.callbacks.modeChange.splice(index, 1);
    };
  }

  public onObjectSelect(callback: ObjectCallback): () => void {
    this.callbacks.objectSelect.push(callback);
    return () => {
      const index = this.callbacks.objectSelect.indexOf(callback);
      if (index > -1) this.callbacks.objectSelect.splice(index, 1);
    };
  }

  public onObjectAdd(callback: ObjectCallback): () => void {
    this.callbacks.objectAdd.push(callback);
    return () => {
      const index = this.callbacks.objectAdd.indexOf(callback);
      if (index > -1) this.callbacks.objectAdd.splice(index, 1);
    };
  }

  public onObjectRemove(callback: ObjectCallback): () => void {
    this.callbacks.objectRemove.push(callback);
    return () => {
      const index = this.callbacks.objectRemove.indexOf(callback);
      if (index > -1) this.callbacks.objectRemove.splice(index, 1);
    };
  }

  public onObjectModify(callback: ObjectCallback): () => void {
    this.callbacks.objectModify.push(callback);
    return () => {
      const index = this.callbacks.objectModify.indexOf(callback);
      if (index > -1) this.callbacks.objectModify.splice(index, 1);
    };
  }

  public onLevelChange(callback: LevelCallback): () => void {
    this.callbacks.levelChange.push(callback);
    return () => {
      const index = this.callbacks.levelChange.indexOf(callback);
      if (index > -1) this.callbacks.levelChange.splice(index, 1);
    };
  }

  public destroy(): void {
    this.disable();
    this.templates.clear();
    this.history = [];
    this.callbacks = {
      modeChange: [],
      objectSelect: [],
      objectAdd: [],
      objectRemove: [],
      objectModify: [],
      levelChange: [],
      historyChange: [],
    };
  }
}
