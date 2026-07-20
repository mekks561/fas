import * as pc from 'playcanvas';

export type CameraMode = 'thirdPerson' | 'firstPerson' | 'cinematic' | 'fixed';

export interface CameraShakeParams {
  intensity: number;
  duration: number;
  frequency?: number;
  decay?: number;
}

export interface CameraZoomParams {
  targetFOV: number;
  duration: number;
}

export interface CameraPositionParams {
  targetPosition: pc.Vec3;
  targetLookAt: pc.Vec3;
  duration: number;
  ease?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

export interface CameraConstraints {
  minDistance?: number;
  maxDistance?: number;
  minHeight?: number;
  maxHeight?: number;
  maxHorizontalAngle?: number;
  followSpeed?: number;
}

export class CameraSystem {
  private camera: pc.Entity | null = null;
  private target: pc.Entity | null = null;
  private mode: CameraMode = 'thirdPerson';
  private originalPosition: pc.Vec3 = new pc.Vec3();
  private originalEuler: pc.Vec3 = new pc.Vec3();
  private shakeOffset: pc.Vec3 = new pc.Vec3();
  private shakeTime: number = 0;
  private currentShake: CameraShakeParams | null = null;
  private zoomTargetFOV: number = 60;
  private zoomCurrentFOV: number = 60;
  private zoomDuration: number = 0;
  private zoomTimer: number = 0;
  private cinematicPosition: pc.Vec3 = new pc.Vec3();
  private cinematicLookAt: pc.Vec3 = new pc.Vec3();
  private cinematicTimer: number = 0;
  private cinematicDuration: number = 0;
  private isCinematic: boolean = false;
  private constraints: CameraConstraints = {
    minDistance: 5,
    maxDistance: 20,
    minHeight: 2,
    maxHeight: 10,
    followSpeed: 0.1,
  };
  private thirdPersonOffset: pc.Vec3 = new pc.Vec3(0, 5, -10);
  private firstPersonOffset: pc.Vec3 = new pc.Vec3(0, 1, 2);
  private isEnabled: boolean = true;

  constructor(camera?: pc.Entity) {
    this.camera = camera || null;
    if (camera) {
      this.originalPosition.copy(camera.getPosition());
      this.originalEuler.copy(camera.getEulerAngles());
    }
  }

  public setCamera(camera: pc.Entity): void {
    this.camera = camera;
    this.originalPosition.copy(camera.getPosition());
    this.originalEuler.copy(camera.getEulerAngles());
    if (camera.camera) {
      this.zoomCurrentFOV = camera.camera.fov;
      this.zoomTargetFOV = camera.camera.fov;
    }
  }

  public setTarget(target: pc.Entity): void {
    this.target = target;
  }

  public setMode(mode: CameraMode): void {
    this.mode = mode;
    if (mode === 'thirdPerson') {
      this.isCinematic = false;
    } else if (mode === 'firstPerson') {
      this.isCinematic = false;
    } else if (mode === 'fixed') {
      this.isCinematic = false;
    }
  }

  public getMode(): CameraMode {
    return this.mode;
  }

  public shake(
    intensity: number,
    duration: number,
    frequency: number = 20,
    decay: number = 1,
  ): void {
    this.currentShake = {
      intensity,
      duration,
      frequency,
      decay,
    };
    this.shakeTime = 0;
  }

  public zoom(targetFOV: number, duration: number = 0.5): void {
    if (!this.camera?.camera) return;

    this.zoomTargetFOV = targetFOV;
    this.zoomCurrentFOV = this.camera.camera.fov;
    this.zoomDuration = duration;
    this.zoomTimer = 0;
  }

  public resetZoom(): void {
    this.zoom(60, 0.5);
  }

  public setCinematic(position: pc.Vec3, lookAt: pc.Vec3, duration: number): void {
    if (!this.camera) return;

    this.cinematicPosition.copy(position);
    this.cinematicLookAt.copy(lookAt);
    this.cinematicDuration = duration;
    this.cinematicTimer = 0;
    this.isCinematic = true;
    this.mode = 'cinematic';
  }

  public exitCinematic(duration: number = 1): void {
    if (!this.camera || !this.target) return;

    const targetPos = this.target.getPosition();
    const cameraPos = new pc.Vec3();
    cameraPos.copy(targetPos);
    cameraPos.add(this.thirdPersonOffset);

    this.setCinematic(cameraPos, targetPos, duration);

    setTimeout(() => {
      this.isCinematic = false;
      this.mode = 'thirdPerson';
    }, duration * 1000);
  }

  public setConstraints(constraints: Partial<CameraConstraints>): void {
    this.constraints = { ...this.constraints, ...constraints };
  }

  public getConstraints(): CameraConstraints {
    return { ...this.constraints };
  }

  public setThirdPersonOffset(offset: pc.Vec3): void {
    this.thirdPersonOffset.copy(offset);
  }

  public getThirdPersonOffset(): pc.Vec3 {
    return this.thirdPersonOffset.clone();
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public update(dt: number): void {
    if (!this.isEnabled || !this.camera) return;

    this.updateShake(dt);
    this.updateZoom(dt);
    this.updateCinematic(dt);
    this.updateFollow(dt);
  }

  private updateShake(dt: number): void {
    if (!this.currentShake) {
      this.shakeOffset.set(0, 0, 0);
      return;
    }

    this.shakeTime += dt;

    if (this.shakeTime >= this.currentShake.duration) {
      this.currentShake = null;
      this.shakeOffset.set(0, 0, 0);
      return;
    }

    const progress = this.shakeTime / this.currentShake.duration;
    const decayFactor = 1 - Math.pow(progress, this.currentShake.decay || 1);
    const intensity = this.currentShake.intensity * decayFactor;

    this.shakeOffset.x = (Math.random() * 2 - 1) * intensity;
    this.shakeOffset.y = (Math.random() * 2 - 1) * intensity;
    this.shakeOffset.z = (Math.random() * 2 - 1) * intensity;
  }

  private updateZoom(dt: number): void {
    if (!this.camera?.camera) return;

    if (this.zoomTimer < this.zoomDuration) {
      this.zoomTimer += dt;
      const progress = Math.min(this.zoomTimer / this.zoomDuration, 1);
      const easedProgress = this.easeOutCubic(progress);

      this.zoomCurrentFOV =
        this.zoomCurrentFOV + (this.zoomTargetFOV - this.zoomCurrentFOV) * easedProgress;
      this.camera.camera.fov = this.zoomCurrentFOV;
    }
  }

  private updateCinematic(dt: number): void {
    if (!this.isCinematic || !this.camera) return;

    this.cinematicTimer += dt;
    const progress = Math.min(this.cinematicTimer / this.cinematicDuration, 1);
    const easedProgress = this.easeInOutCubic(progress);

    const currentPos = this.camera.getPosition();
    const newPos = new pc.Vec3();
    newPos.lerp(currentPos, this.cinematicPosition, easedProgress);
    this.camera.setPosition(newPos);

    this.camera.lookAt(this.cinematicLookAt);

    if (progress >= 1 && this.mode === 'cinematic') {
      this.isCinematic = false;
    }
  }

  private updateFollow(dt: number): void {
    if (!this.target || !this.camera || this.isCinematic) return;

    const targetPos = this.target.getPosition();

    let desiredPos = new pc.Vec3();

    switch (this.mode) {
      case 'thirdPerson': {
        const offset = this.thirdPersonOffset.clone();
        offset.y = Math.max(
          this.constraints.minHeight || 2,
          Math.min(this.constraints.maxHeight || 10, offset.y),
        );

        const forward = new pc.Vec3(0, 0, -1);
        this.target.getRotation().transformVector(forward);

        const right = new pc.Vec3(1, 0, 0);
        this.target.getRotation().transformVector(right);

        desiredPos.copy(targetPos);
        desiredPos.add(forward.mulScalar(-offset.z));
        desiredPos.add(right.mulScalar(offset.x));
        desiredPos.y += offset.y;

        const distance = desiredPos.distance(targetPos);
        const clampedDistance = Math.max(
          this.constraints.minDistance || 5,
          Math.min(this.constraints.maxDistance || 20, distance),
        );
        desiredPos.sub(targetPos).normalize().mulScalar(clampedDistance).add(targetPos);

        break;
      }
      case 'firstPerson': {
        const offset = this.firstPersonOffset.clone();

        const forward = new pc.Vec3(0, 0, 1);
        this.target.getRotation().transformVector(forward);

        desiredPos.copy(targetPos);
        desiredPos.add(forward.mulScalar(offset.z));
        desiredPos.y += offset.y;

        break;
      }
      case 'fixed': {
        desiredPos.copy(this.originalPosition);
        break;
      }
      default:
        return;
    }

    const currentPos = this.camera.getPosition();
    const smoothPos = new pc.Vec3();
    const followSpeed = this.constraints.followSpeed || 0.1;

    smoothPos.lerp(currentPos, desiredPos, dt * 60 * followSpeed);
    smoothPos.add(this.shakeOffset);

    this.camera.setPosition(smoothPos);

    if (this.mode === 'thirdPerson' || this.mode === 'firstPerson') {
      this.camera.lookAt(targetPos);
    }
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  public getPosition(): pc.Vec3 | null {
    if (!this.camera) return null;
    return this.camera.getPosition();
  }

  public getShakeIntensity(): number {
    if (!this.currentShake) return 0;
    const progress = this.shakeTime / this.currentShake.duration;
    const decayFactor = 1 - Math.pow(progress, this.currentShake.decay || 1);
    return this.currentShake.intensity * decayFactor;
  }

  public isShaking(): boolean {
    return this.currentShake !== null;
  }

  public isInCinematic(): boolean {
    return this.isCinematic;
  }

  public destroy(): void {
    this.camera = null;
    this.target = null;
    this.currentShake = null;
  }
}
