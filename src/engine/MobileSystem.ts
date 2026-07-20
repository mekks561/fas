import * as pc from 'playcanvas';

export interface MobileConfig {
  enableTouchControls: boolean;
  enablePerformanceMode: boolean;
  targetFPS: number;
  resolutionScale: number;
  disableShadows: boolean;
  disablePostEffects: boolean;
  reduceParticleCount: boolean;
  enablePowerSave: boolean;
}

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  maxTouchPoints: number;
  hasGyroscope: boolean;
  hasAccelerometer: boolean;
  performanceLevel: 'low' | 'medium' | 'high';
}

const DEFAULT_CONFIG: MobileConfig = {
  enableTouchControls: true,
  enablePerformanceMode: true,
  targetFPS: 30,
  resolutionScale: 0.75,
  disableShadows: true,
  disablePostEffects: true,
  reduceParticleCount: true,
  enablePowerSave: true,
};

export class MobileSystem {
  private app: pc.Application;
  private config: MobileConfig;
  private deviceInfo: DeviceInfo;
  private touchInput: TouchInputHandler | null = null;
  private isPowerSaveMode: boolean = false;
  private originalResolution: { width: number; height: number } | null = null;

  constructor(app: pc.Application, config: Partial<MobileConfig> = {}) {
    this.app = app;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.deviceInfo = this.detectDevice();

    if (this.deviceInfo.isMobile) {
      this.initMobileFeatures();
    }
  }

  private detectDevice(): DeviceInfo {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|android/.test(userAgent) && !/tablet/.test(userAgent);
    const isTablet = /tablet|ipad/.test(userAgent);
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const pixelRatio = window.devicePixelRatio || 1;
    const maxTouchPoints = navigator.maxTouchPoints || 0;

    const hasGyroscope = 'DeviceOrientationEvent' in window;
    const hasAccelerometer = 'DeviceMotionEvent' in window;

    let performanceLevel: 'low' | 'medium' | 'high' = 'medium';
    if (pixelRatio <= 1.5) {
      performanceLevel = 'low';
    } else if (pixelRatio >= 3) {
      performanceLevel = 'high';
    }

    return {
      isMobile,
      isTablet,
      isIOS,
      isAndroid,
      screenWidth,
      screenHeight,
      pixelRatio,
      maxTouchPoints,
      hasGyroscope,
      hasAccelerometer,
      performanceLevel,
    };
  }

  private initMobileFeatures(): void {
    if (this.config.enableTouchControls) {
      this.touchInput = new TouchInputHandler(this.app);
    }

    if (this.config.enablePerformanceMode) {
      this.applyPerformanceSettings();
    }

    if (this.config.enablePowerSave) {
      this.setupPowerSaveListener();
    }

    this.setupOrientationListener();
  }

  private applyPerformanceSettings(): void {
    if (this.config.disableShadows) {
      this.disableShadows();
    }

    if (this.config.disablePostEffects) {
      this.disablePostEffects();
    }

    if (this.config.resolutionScale < 1) {
      this.setResolutionScale(this.config.resolutionScale);
    }

    this.setTargetFPS(this.config.targetFPS);
  }

  private disableShadows(): void {
    this.app.root.findComponents('light').forEach((light) => {
      const typedLight = light as unknown as { shadowType?: number; castShadows?: boolean };
      if (typedLight.shadowType !== undefined) {
        typedLight.shadowType = 0;
      } else if ('castShadows' in typedLight) {
        typedLight.castShadows = false;
      }
    });
  }

  private disablePostEffects(): void {
    const cameras = this.app.root.findComponents('camera');
    cameras.forEach((camera) => {
      const typedCamera = camera as unknown as { shaderPasses?: unknown[] };
      if (typedCamera.shaderPasses !== undefined) {
        typedCamera.shaderPasses = [];
      }
    });
  }

  private setResolutionScale(scale: number): void {
    const app = this.app as unknown as { canvas?: HTMLCanvasElement; resizeCanvas?: () => void };
    const canvas = app.canvas;
    if (!canvas) return;
    
    this.originalResolution = {
      width: canvas.width,
      height: canvas.height,
    };

    canvas.width = Math.floor(canvas.width * scale);
    canvas.height = Math.floor(canvas.height * scale);
    app.resizeCanvas?.();
  }

  private setTargetFPS(fps: number): void {
    const app = this.app as unknown as { setTargetFrameRate?: (fps: number) => void };
    app.setTargetFrameRate?.(fps);
  }

  private setupPowerSaveListener(): void {
    if ('getBattery' in navigator) {
      interface BatteryInfo {
        level: number;
        charging: boolean;
        addEventListener: (event: string, callback: () => void) => void;
      }
      
      (navigator as unknown as { getBattery: () => Promise<BatteryInfo> }).getBattery().then(
        (battery) => {
          this.updatePowerSaveState(battery.level, battery.charging);

          battery.addEventListener('levelchange', () => {
            this.updatePowerSaveState(battery.level, battery.charging);
          });

          battery.addEventListener('chargingchange', () => {
            this.updatePowerSaveState(battery.level, battery.charging);
          });
        },
      );
    }
  }

  private updatePowerSaveState(level: number, charging: boolean): void {
    if (!charging && level < 0.2) {
      if (!this.isPowerSaveMode) {
        this.enablePowerSaveMode();
      }
    } else {
      if (this.isPowerSaveMode) {
        this.disablePowerSaveMode();
      }
    }
  }

  private enablePowerSaveMode(): void {
    this.isPowerSaveMode = true;
    this.setTargetFPS(20);
    this.setResolutionScale(0.5);
    this.disableShadows();
    this.disablePostEffects();
    console.log('[MobileSystem] Power save mode enabled');
  }

  private disablePowerSaveMode(): void {
    this.isPowerSaveMode = false;
    this.setTargetFPS(this.config.targetFPS);
    if (this.originalResolution) {
      const app = this.app as unknown as { canvas?: HTMLCanvasElement; resizeCanvas?: () => void };
      const canvas = app.canvas;
      if (canvas) {
        canvas.width = this.originalResolution.width;
        canvas.height = this.originalResolution.height;
        app.resizeCanvas?.();
      }
    }
    console.log('[MobileSystem] Power save mode disabled');
  }

  private setupOrientationListener(): void {
    window.addEventListener('orientationchange', () => {
      const app = this.app as unknown as { resizeCanvas?: () => void };
      app.resizeCanvas?.();
    });
  }

  public isMobileDevice(): boolean {
    return this.deviceInfo.isMobile;
  }

  public isTabletDevice(): boolean {
    return this.deviceInfo.isTablet;
  }

  public getDeviceInfo(): DeviceInfo {
    return { ...this.deviceInfo };
  }

  public getConfig(): MobileConfig {
    return { ...this.config };
  }

  public setConfig(config: Partial<MobileConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.deviceInfo.isMobile && this.config.enablePerformanceMode) {
      this.applyPerformanceSettings();
    }
  }

  public getTouchInput(): TouchInputHandler | null {
    return this.touchInput;
  }

  public isPowerSaveActive(): boolean {
    return this.isPowerSaveMode;
  }

  public setPowerSaveMode(enabled: boolean): void {
    if (enabled) {
      this.enablePowerSaveMode();
    } else {
      this.disablePowerSaveMode();
    }
  }

  public destroy(): void {
    this.touchInput?.destroy();
  }
}

interface TouchZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  action: (touch: Touch) => void;
}

interface TouchGesture {
  type: 'tap' | 'swipe' | 'pinch' | 'pan';
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  velocity?: number;
}

export class TouchInputHandler {
  private app: pc.Application;
  private touchZones: Map<string, TouchZone> = new Map();
  private activeTouches: Map<number, Touch> = new Map();
  private gestures: TouchGesture[] = [];
  private gestureStartPositions: Map<number, { x: number; y: number; time: number }> = new Map();

  constructor(app: pc.Application) {
    this.app = app;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const app = this.app as unknown as { canvas?: HTMLCanvasElement };
    const canvas = app.canvas;
    if (!canvas) return;

    canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
  }

  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.activeTouches.set(touch.identifier, touch);

      this.gestureStartPositions.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      });

      this.checkTouchZones(touch);
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.activeTouches.set(touch.identifier, touch);

      this.detectGestures(touch);
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.activeTouches.delete(touch.identifier);
      this.gestureStartPositions.delete(touch.identifier);
    }
  }

  private checkTouchZones(touch: Touch): void {
    const appTyped = this.app as unknown as { canvas?: HTMLCanvasElement };
    const canvas = appTyped.canvas || document.querySelector('canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;

    this.touchZones.forEach((zone) => {
      if (x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height) {
        zone.action(touch);
      }
    });
  }

  private detectGestures(touch: Touch): void {
    const start = this.gestureStartPositions.get(touch.identifier);
    if (!start) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const time = Date.now() - start.time;

    if (time > 0) {
      const velocity = distance / time;

      if (distance > 50) {
        let direction: 'up' | 'down' | 'left' | 'right' = 'up';
        if (Math.abs(dx) > Math.abs(dy)) {
          direction = dx > 0 ? 'right' : 'left';
        } else {
          direction = dy > 0 ? 'down' : 'up';
        }

        this.gestures.push({
          type: 'swipe',
          direction,
          distance,
          velocity,
        });

        this.gestureStartPositions.delete(touch.identifier);
      }
    }
  }

  public addTouchZone(id: string, zone: Omit<TouchZone, 'id'>): void {
    this.touchZones.set(id, { id, ...zone });
  }

  public removeTouchZone(id: string): void {
    this.touchZones.delete(id);
  }

  public getActiveTouches(): Touch[] {
    return Array.from(this.activeTouches.values());
  }

  public getGestures(): TouchGesture[] {
    const gestures = [...this.gestures];
    this.gestures = [];
    return gestures;
  }

  public hasActiveTouches(): boolean {
    return this.activeTouches.size > 0;
  }

  public clearGestures(): void {
    this.gestures = [];
  }

  public destroy(): void {
    const appTyped = this.app as unknown as { canvas?: HTMLCanvasElement };
    const canvas = appTyped.canvas || document.querySelector('canvas');
    if (canvas) {
      canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
      canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this));
      canvas.removeEventListener('touchend', this.handleTouchEnd.bind(this));
      canvas.removeEventListener('touchcancel', this.handleTouchEnd.bind(this));
    }

    this.touchZones.clear();
    this.activeTouches.clear();
    this.gestures = [];
    this.gestureStartPositions.clear();
  }
}