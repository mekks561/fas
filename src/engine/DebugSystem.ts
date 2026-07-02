import * as pc from 'playcanvas';

export type DebugCategory =
  'render' | 'physics' | 'entities' | 'performance' | 'input' | 'audio' | 'system';

export interface DebugLine {
  start: pc.Vec3;
  end: pc.Vec3;
  color: pc.Color;
  duration: number;
  timestamp: number;
  category: DebugCategory;
}

export interface DebugBox {
  center: pc.Vec3;
  size: pc.Vec3;
  rotation: pc.Quat;
  color: pc.Color;
  duration: number;
  timestamp: number;
  category: DebugCategory;
}

export interface DebugSphere {
  center: pc.Vec3;
  radius: number;
  color: pc.Color;
  duration: number;
  timestamp: number;
  category: DebugCategory;
}

export interface DebugText {
  position: pc.Vec3;
  text: string;
  color: pc.Color;
  duration: number;
  timestamp: number;
  category: DebugCategory;
}

export interface DebugStats {
  fps: number;
  frameTime: number;
  updateTime: number;
  renderTime: number;
  drawCalls: number;
  triangles: number;
  entities: number;
  physicsBodies: number;
  memoryUsage: number;
}

export interface EntityInfo {
  name: string;
  position: pc.Vec3;
  rotation: pc.Vec3;
  scale: pc.Vec3;
  components: string[];
  enabled: boolean;
  parent?: string;
  children: string[];
}

export interface DebugLogEntry {
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  category: DebugCategory;
  data?: unknown;
}

type StatsCallback = (stats: DebugStats) => void;
type LogCallback = (entry: DebugLogEntry) => void;

export class DebugSystem {
  private app: pc.Application | null = null;
  private isEnabled: boolean = false;
  private isOverlayVisible: boolean = false;
  private isProfilerEnabled: boolean = false;

  private enabledCategories: Set<DebugCategory> = new Set([
    'render',
    'physics',
    'entities',
    'performance',
    'input',
    'audio',
    'system',
  ]);

  private lines: DebugLine[] = [];
  private boxes: DebugBox[] = [];
  private spheres: DebugSphere[] = [];
  private texts: DebugText[] = [];

  private stats: DebugStats = {
    fps: 0,
    frameTime: 0,
    updateTime: 0,
    renderTime: 0,
    drawCalls: 0,
    triangles: 0,
    entities: 0,
    physicsBodies: 0,
    memoryUsage: 0,
  };

  private logs: DebugLogEntry[] = [];
  private maxLogs: number = 500;
  private selectedEntity: pc.Entity | null = null;

  private statsCallbacks: StatsCallback[] = [];
  private logCallbacks: LogCallback[] = [];

  private frameStartTime: number = 0;
  private updateStartTime: number = 0;
  private renderStartTime: number = 0;

  private lineMaterial: pc.Material | null = null;
  private debugEntity: pc.Entity | null = null;

  private showEntityBounds: boolean = false;
  private showEntityNames: boolean = false;
  private showPhysicsDebug: boolean = false;
  private showGrid: boolean = false;
  private freezeTime: boolean = false;
  private timeScale: number = 1.0;

  private consoleOriginalLog: typeof console.log | null = null;
  private consoleOriginalWarn: typeof console.warn | null = null;
  private consoleOriginalError: typeof console.error | null = null;

  constructor(app?: pc.Application) {
    this.app = app || null;
    this.interceptConsole();
  }

  public setApp(app: pc.Application): void {
    this.app = app;
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
    this.hideOverlay();
  }

  public toggle(): void {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  public isActive(): boolean {
    return this.isEnabled;
  }

  public setCategoryEnabled(category: DebugCategory, enabled: boolean): void {
    if (enabled) {
      this.enabledCategories.add(category);
    } else {
      this.enabledCategories.delete(category);
    }
  }

  public isCategoryEnabled(category: DebugCategory): boolean {
    return this.enabledCategories.has(category);
  }

  public drawLine(
    start: pc.Vec3,
    end: pc.Vec3,
    color: pc.Color = new pc.Color(1, 0, 0, 1),
    duration: number = 0,
    category: DebugCategory = 'render',
  ): void {
    if (!this.isEnabled) return;
    if (!this.isCategoryEnabled(category)) return;

    this.lines.push({
      start: start.clone(),
      end: end.clone(),
      color: color.clone(),
      duration,
      timestamp: performance.now(),
      category,
    });
  }

  public drawBox(
    center: pc.Vec3,
    size: pc.Vec3,
    color: pc.Color = new pc.Color(0, 1, 0, 1),
    duration: number = 0,
    category: DebugCategory = 'physics',
  ): void {
    if (!this.isEnabled) return;
    if (!this.isCategoryEnabled(category)) return;

    this.boxes.push({
      center: center.clone(),
      size: size.clone(),
      rotation: new pc.Quat(),
      color: color.clone(),
      duration,
      timestamp: performance.now(),
      category,
    });
  }

  public drawSphere(
    center: pc.Vec3,
    radius: number,
    color: pc.Color = new pc.Color(0, 0, 1, 1),
    duration: number = 0,
    category: DebugCategory = 'physics',
  ): void {
    if (!this.isEnabled) return;
    if (!this.isCategoryEnabled(category)) return;

    this.spheres.push({
      center: center.clone(),
      radius,
      color: color.clone(),
      duration,
      timestamp: performance.now(),
      category,
    });
  }

  public drawText(
    position: pc.Vec3,
    text: string,
    color: pc.Color = new pc.Color(1, 1, 1, 1),
    duration: number = 0,
    category: DebugCategory = 'system',
  ): void {
    if (!this.isEnabled) return;
    if (!this.isCategoryEnabled(category)) return;

    this.texts.push({
      position: position.clone(),
      text,
      color: color.clone(),
      duration,
      timestamp: performance.now(),
      category,
    });
  }

  public clearDrawings(): void {
    this.lines = [];
    this.boxes = [];
    this.spheres = [];
    this.texts = [];
  }

  public beginUpdate(): void {
    this.updateStartTime = performance.now();
  }

  public endUpdate(): void {
    if (this.updateStartTime > 0) {
      this.stats.updateTime = performance.now() - this.updateStartTime;
      this.updateStartTime = 0;
    }
  }

  public beginRender(): void {
    this.renderStartTime = performance.now();
  }

  public endRender(): void {
    if (this.renderStartTime > 0) {
      this.stats.renderTime = performance.now() - this.renderStartTime;
      this.renderStartTime = 0;
    }
  }

  public updateStats(): void {
    if (!this.app) return;

    this.stats.fps = this.app.stats?.fps || 0;
    this.stats.frameTime = this.app.stats?.frameTime || 0;
    this.stats.drawCalls = this.app.stats?.drawCalls?.count || 0;
    this.stats.triangles = this.app.stats?.triangles?.count || 0;

    if (this.app.scene) {
      this.stats.entities = this.countEntities(this.app.root);
    }

    const performance = window.performance as unknown as { memory?: { usedJSHeapSize: number } };
    if (performance && performance.memory) {
      this.stats.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024;
    }

    this.statsCallbacks.forEach((cb) => cb(this.stats));
  }

  private countEntities(entity: pc.Entity): number {
    let count = 1;
    entity.children.forEach((child) => {
      count += this.countEntities(child);
    });
    return count;
  }

  public getStats(): DebugStats {
    return { ...this.stats };
  }

  public onStatsUpdate(callback: StatsCallback): () => void {
    this.statsCallbacks.push(callback);
    return () => {
      const index = this.statsCallbacks.indexOf(callback);
      if (index > -1) this.statsCallbacks.splice(index, 1);
    };
  }

  public getEntityInfo(entity: pc.Entity): EntityInfo | null {
    if (!entity) return null;

    const components: string[] = [];
    Object.keys(entity.c).forEach((key) => {
      components.push(key);
    });

    return {
      name: entity.name,
      position: entity.getPosition(),
      rotation: entity.getEulerAngles(),
      scale: entity.getLocalScale(),
      components,
      enabled: entity.enabled,
      parent: entity.parent?.name,
      children: entity.children.map((c) => c.name),
    };
  }

  public selectEntity(entity: pc.Entity | null): void {
    this.selectedEntity = entity;
  }

  public getSelectedEntity(): pc.Entity | null {
    return this.selectedEntity;
  }

  public findEntityByName(name: string): pc.Entity | null {
    if (!this.app) return null;
    return this.app.root.findByName(name) as pc.Entity;
  }

  public findEntitiesByTag(tag: string): pc.Entity[] {
    if (!this.app) return [];
    const results: pc.Entity[] = [];
    this.searchByTag(this.app.root, tag, results);
    return results;
  }

  private searchByTag(entity: pc.Entity, tag: string, results: pc.Entity[]): void {
    if (entity.tags && entity.tags.has(tag)) {
      results.push(entity);
    }
    entity.children.forEach((child) => this.searchByTag(child, tag, results));
  }

  public log(message: string, category: DebugCategory = 'system', data?: unknown): void {
    this.addLog('log', message, category, data);
  }

  public info(message: string, category: DebugCategory = 'system', data?: unknown): void {
    this.addLog('info', message, category, data);
  }

  public warn(message: string, category: DebugCategory = 'system', data?: unknown): void {
    this.addLog('warn', message, category, data);
  }

  public error(message: string, category: DebugCategory = 'system', data?: unknown): void {
    this.addLog('error', message, category, data);
  }

  public debug(message: string, category: DebugCategory = 'system', data?: unknown): void {
    this.addLog('debug', message, category, data);
  }

  private addLog(
    level: DebugLogEntry['level'],
    message: string,
    category: DebugCategory,
    data?: unknown,
  ): void {
    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      level,
      message,
      category,
      data,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.logCallbacks.forEach((cb) => cb(entry));
  }

  public getLogs(filter?: {
    level?: DebugLogEntry['level'];
    category?: DebugCategory;
  }): DebugLogEntry[] {
    let filtered = this.logs;

    if (filter?.level) {
      filtered = filtered.filter((l) => l.level === filter.level);
    }
    if (filter?.category) {
      filtered = filtered.filter((l) => l.category === filter.category);
    }

    return [...filtered];
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public onLog(callback: LogCallback): () => void {
    this.logCallbacks.push(callback);
    return () => {
      const index = this.logCallbacks.indexOf(callback);
      if (index > -1) this.logCallbacks.splice(index, 1);
    };
  }

  private interceptConsole(): void {
    this.consoleOriginalLog = console.log;
    this.consoleOriginalWarn = console.warn;
    this.consoleOriginalError = console.error;

    console.log = (...args: unknown[]) => {
      this.addLog(
        'log',
        args.map((a) => String(a)).join(' '),
        'system',
        args.length > 1 ? args : undefined,
      );
      this.consoleOriginalLog?.apply(console, args);
    };

    console.warn = (...args: unknown[]) => {
      this.addLog(
        'warn',
        args.map((a) => String(a)).join(' '),
        'system',
        args.length > 1 ? args : undefined,
      );
      this.consoleOriginalWarn?.apply(console, args);
    };

    console.error = (...args: unknown[]) => {
      this.addLog(
        'error',
        args.map((a) => String(a)).join(' '),
        'system',
        args.length > 1 ? args : undefined,
      );
      this.consoleOriginalError?.apply(console, args);
    };
  }

  private restoreConsole(): void {
    if (this.consoleOriginalLog) console.log = this.consoleOriginalLog;
    if (this.consoleOriginalWarn) console.warn = this.consoleOriginalWarn;
    if (this.consoleOriginalError) console.error = this.consoleOriginalError;
  }

  public showOverlay(): void {
    this.isOverlayVisible = true;
  }

  public hideOverlay(): void {
    this.isOverlayVisible = false;
  }

  public isOverlayShown(): boolean {
    return this.isOverlayVisible;
  }

  public toggleOverlay(): void {
    this.isOverlayVisible = !this.isOverlayVisible;
  }

  public enableProfiler(): void {
    this.isProfilerEnabled = true;
  }

  public disableProfiler(): void {
    this.isProfilerEnabled = false;
  }

  public isProfilerActive(): boolean {
    return this.isProfilerEnabled;
  }

  public toggleEntityBounds(): void {
    this.showEntityBounds = !this.showEntityBounds;
  }

  public isEntityBoundsVisible(): boolean {
    return this.showEntityBounds;
  }

  public toggleEntityNames(): void {
    this.showEntityNames = !this.showEntityNames;
  }

  public isEntityNamesVisible(): boolean {
    return this.showEntityNames;
  }

  public togglePhysicsDebug(): void {
    this.showPhysicsDebug = !this.showPhysicsDebug;
  }

  public isPhysicsDebugVisible(): boolean {
    return this.showPhysicsDebug;
  }

  public toggleGrid(): void {
    this.showGrid = !this.showGrid;
  }

  public isGridVisible(): boolean {
    return this.showGrid;
  }

  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, Math.min(10, scale));
  }

  public getTimeScale(): number {
    return this.timeScale;
  }

  public toggleFreezeTime(): void {
    this.freezeTime = !this.freezeTime;
  }

  public isTimeFrozen(): boolean {
    return this.freezeTime;
  }

  public getDeltaTime(dt: number): number {
    if (this.freezeTime) return 0;
    return dt * this.timeScale;
  }

  public update(_dt: number): void {
    if (!this.isEnabled) return;

    const now = performance.now();
    this.frameStartTime = now;

    this.cleanupExpiredDrawings(now);
    this.updateStats();
    this.renderDebugDrawings();
    this.updateEntityDebug();
  }

  private cleanupExpiredDrawings(now: number): void {
    this.lines = this.lines.filter(
      (l) => l.duration === 0 || now - l.timestamp < l.duration * 1000,
    );
    this.boxes = this.boxes.filter(
      (b) => b.duration === 0 || now - b.timestamp < b.duration * 1000,
    );
    this.spheres = this.spheres.filter(
      (s) => s.duration === 0 || now - s.timestamp < s.duration * 1000,
    );
    this.texts = this.texts.filter(
      (t) => t.duration === 0 || now - t.timestamp < t.duration * 1000,
    );
  }

  private renderDebugDrawings(): void {
    if (!this.app) return;
    if (!this.isEnabled) return;

    this.boxes.forEach((box) => {
      this.drawBoxWireframe(box);
    });
  }

  private drawBoxWireframe(box: DebugBox): void {
    const halfX = box.size.x / 2;
    const halfY = box.size.y / 2;
    const halfZ = box.size.z / 2;

    const corners = [
      new pc.Vec3(-halfX, -halfY, -halfZ),
      new pc.Vec3(halfX, -halfY, -halfZ),
      new pc.Vec3(halfX, halfY, -halfZ),
      new pc.Vec3(-halfX, halfY, -halfZ),
      new pc.Vec3(-halfX, -halfY, halfZ),
      new pc.Vec3(halfX, -halfY, halfZ),
      new pc.Vec3(halfX, halfY, halfZ),
      new pc.Vec3(-halfX, halfY, halfZ),
    ];

    corners.forEach((corner) => corner.transformQuat(box.rotation).add(box.center));

    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];

    edges.forEach(([start, end]) => {
      this.drawLine(corners[start], corners[end], box.color, 0, 'physics');
    });
  }

  private updateEntityDebug(): void {
    if (!this.app) return;
    if (!this.showEntityBounds && !this.showEntityNames) return;

    this.traverseEntities(this.app.root);
  }

  private traverseEntities(entity: pc.Entity): void {
    if (this.showEntityBounds) {
      const aabb = entity.aabb;
      if (aabb && aabb.halfExtents.length() > 0) {
        this.drawBox(
          aabb.center,
          aabb.halfExtents.scale(2),
          new pc.Color(1, 1, 0, 0.5),
          0,
          'entities',
        );
      }
    }

    if (this.showEntityNames) {
      this.drawText(entity.getPosition(), entity.name, new pc.Color(0, 1, 1, 1), 0, 'entities');
    }

    entity.children.forEach((child) => this.traverseEntities(child));
  }

  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  public exportStats(): string {
    return JSON.stringify(this.stats, null, 2);
  }

  public reset(): void {
    this.clearDrawings();
    this.clearLogs();
    this.stats = {
      fps: 0,
      frameTime: 0,
      updateTime: 0,
      renderTime: 0,
      drawCalls: 0,
      triangles: 0,
      entities: 0,
      physicsBodies: 0,
      memoryUsage: 0,
    };
  }

  public destroy(): void {
    this.restoreConsole();
    this.lines = [];
    this.boxes = [];
    this.spheres = [];
    this.texts = [];
    this.logs = [];
    this.statsCallbacks = [];
    this.logCallbacks = [];
    this.selectedEntity = null;
  }
}
