import * as pc from 'playcanvas';

export type InputDevice = 'keyboard' | 'touch' | 'gamepad';

export type InputState = 'released' | 'pressed' | 'held';

export interface InputBinding {
  action: string;
  keys: string[];
  gamepadButton?: number;
  touchZone?: 'left' | 'right' | 'top' | 'bottom';
}

export interface TouchControl {
  id: string;
  type: 'button' | 'joystick' | 'dpad';
  x: number;
  y: number;
  width: number;
  height: number;
  action?: string;
}

export interface InputAxis {
  x: number;
  y: number;
}

export interface InputAction {
  state: InputState;
  value: number;
  axis?: InputAxis;
}

export class InputSystem {
  private bindings: Map<string, InputBinding> = new Map();
  private actions: Map<string, InputAction> = new Map();
  private keyboardState: Set<string> = new Set();
  private touchControls: TouchControl[] = [];
  private activeTouchId: number | null = null;
  private gamepads: Gamepad[] = [];
  private lastTouchPosition: pc.Vec2 | null = null;
  private touchStartPosition: pc.Vec2 | null = null;
  private listeners: Map<string, ((action: string, state: InputAction) => void)[]> = new Map();
  private isEnabled: boolean = true;
  private canvas: HTMLCanvasElement | null = null;

  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas || null;
    this.initializeDefaultBindings();
    this.setupEventListeners();
  }

  private initializeDefaultBindings(): void {
    this.bindings.set('moveForward', { action: 'moveForward', keys: ['KeyW', 'ArrowUp'] });
    this.bindings.set('moveBackward', { action: 'moveBackward', keys: ['KeyS', 'ArrowDown'] });
    this.bindings.set('moveLeft', { action: 'moveLeft', keys: ['KeyA', 'ArrowLeft'] });
    this.bindings.set('moveRight', { action: 'moveRight', keys: ['KeyD', 'ArrowRight'] });
    this.bindings.set('boost', { action: 'boost', keys: ['Space'] });
    this.bindings.set('fire', { action: 'fire', keys: ['KeyF', 'KeyJ'] });
    this.bindings.set('pause', { action: 'pause', keys: ['Escape'] });
    this.bindings.set('skill1', { action: 'skill1', keys: ['KeyQ'] });
    this.bindings.set('skill2', { action: 'skill2', keys: ['KeyE'] });
    this.bindings.set('skill3', { action: 'skill3', keys: ['KeyT'] });
    this.bindings.set('skill4', { action: 'skill4', keys: ['KeyG'] });
    this.bindings.set('upgrade', { action: 'upgrade', keys: ['KeyR'] });
    this.bindings.set('showStats', { action: 'showStats', keys: ['KeyF3'] });
    this.bindings.set('toggleAchievements', { action: 'toggleAchievements', keys: ['KeyF4'] });

    this.bindings.forEach((binding, action) => {
      this.actions.set(action, { state: 'released', value: 0 });
    });
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));

    if (this.canvas) {
      this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
      this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    window.addEventListener('gamepadconnected', this.handleGamepadConnected.bind(this));
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected.bind(this));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isEnabled) return;

    this.keyboardState.add(e.code);

    this.bindings.forEach((binding, action) => {
      if (binding.keys.includes(e.code)) {
        const current = this.actions.get(action);
        if (current && current.state === 'released') {
          this.updateAction(action, 'pressed', 1);
        } else if (current) {
          this.updateAction(action, 'held', 1);
        }
      }
    });
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (!this.isEnabled) return;

    this.keyboardState.delete(e.code);

    this.bindings.forEach((binding, action) => {
      if (binding.keys.includes(e.code)) {
        const hasOtherKey = binding.keys.some(key => this.keyboardState.has(key));
        if (!hasOtherKey) {
          this.updateAction(action, 'released', 0);
        }
      }
    });
  }

  private handleTouchStart(e: TouchEvent): void {
    if (!this.isEnabled) return;
    e.preventDefault();

    const touch = e.touches[0];
    this.activeTouchId = touch.identifier;
    this.touchStartPosition = new pc.Vec2(touch.clientX, touch.clientY);
    this.lastTouchPosition = new pc.Vec2(touch.clientX, touch.clientY);

    const rect = this.canvas?.getBoundingClientRect();
    if (!rect) return;

    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;

    this.handleTouchZone(x, y, true);
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.isEnabled) return;
    e.preventDefault();

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      if (touch.identifier === this.activeTouchId) {
        this.lastTouchPosition = new pc.Vec2(touch.clientX, touch.clientY);
        this.updateJoystickAxis(touch);
        break;
      }
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (!this.isEnabled) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.activeTouchId) {
        this.activeTouchId = null;
        this.touchStartPosition = null;
        this.lastTouchPosition = null;
        this.resetJoystickAxis();
        break;
      }
    }
  }

  private handleTouchZone(x: number, y: number, pressed: boolean): void {
    if (x < 0.5) {
      if (y < 0.5) {
        this.updateAction('moveForward', pressed ? 'pressed' : 'released', pressed ? 1 : 0);
      } else {
        this.updateAction('moveBackward', pressed ? 'pressed' : 'released', pressed ? 1 : 0);
      }
    } else {
      if (y < 0.6) {
        this.updateAction('fire', pressed ? 'pressed' : 'released', pressed ? 1 : 0);
      } else {
        this.updateAction('boost', pressed ? 'pressed' : 'released', pressed ? 1 : 0);
      }
    }
  }

  private updateJoystickAxis(touch: Touch): void {
    if (!this.touchStartPosition) return;

    const rect = this.canvas?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.width * 0.25;
    const centerY = rect.height * 0.75;
    const maxRadius = Math.min(rect.width, rect.height) * 0.15;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const normalizedDistance = Math.min(distance / maxRadius, 1);
    const angle = Math.atan2(dy, dx);

    const x = Math.cos(angle) * normalizedDistance;
    const y = Math.sin(angle) * normalizedDistance;

    this.actions.set('moveJoystick', {
      state: 'held',
      value: 1,
      axis: { x, y }
    });
  }

  private resetJoystickAxis(): void {
    this.actions.set('moveJoystick', { state: 'released', value: 0, axis: { x: 0, y: 0 } });
  }

  private handleGamepadConnected(e: GamepadEvent): void {
    this.gamepads[e.gamepad.index] = e.gamepad;
  }

  private handleGamepadDisconnected(e: GamepadEvent): void {
    this.gamepads[e.gamepad.index] = null as any;
  }

  private updateGamepads(): void {
    for (let i = 0; i < this.gamepads.length; i++) {
      const gamepad = this.gamepads[i];
      if (!gamepad) continue;

      const updated = navigator.getGamepads()[i];
      if (!updated) continue;

      this.gamepads[i] = updated;

      const leftStickX = updated.axes[0];
      const leftStickY = updated.axes[1];

      if (Math.abs(leftStickX) > 0.1 || Math.abs(leftStickY) > 0.1) {
        this.actions.set('moveJoystick', {
          state: 'held',
          value: 1,
          axis: { x: leftStickX, y: leftStickY }
        });
      }

      this.updateGamepadButton(0, 'fire');
      this.updateGamepadButton(1, 'boost');
      this.updateGamepadButton(4, 'skill1');
      this.updateGamepadButton(5, 'skill2');
      this.updateGamepadButton(6, 'skill3');
      this.updateGamepadButton(7, 'skill4');
      this.updateGamepadButton(8, 'pause');
    }
  }

  private updateGamepadButton(buttonIndex: number, action: string): void {
    for (const gamepad of this.gamepads) {
      if (!gamepad) continue;

      const button = gamepad.buttons[buttonIndex];
      if (!button) continue;

      const wasPressed = this.actions.get(action)?.state !== 'released';

      if (button.pressed && !wasPressed) {
        this.updateAction(action, 'pressed', 1);
      } else if (!button.pressed && wasPressed) {
        this.updateAction(action, 'released', 0);
      } else if (button.pressed) {
        this.updateAction(action, 'held', 1);
      }
    }
  }

  private updateAction(action: string, state: InputState, value: number): void {
    const current = this.actions.get(action);
    const updated: InputAction = {
      state,
      value,
      axis: current?.axis || undefined
    };

    this.actions.set(action, updated);

    const callbacks = this.listeners.get(action);
    if (callbacks) {
      callbacks.forEach(callback => callback(action, updated));
    }
  }

  public getAction(action: string): InputAction | undefined {
    return this.actions.get(action);
  }

  public isPressed(action: string): boolean {
    const current = this.actions.get(action);
    return current?.state === 'pressed';
  }

  public isHeld(action: string): boolean {
    const current = this.actions.get(action);
    return current?.state === 'held' || current?.state === 'pressed';
  }

  public isReleased(action: string): boolean {
    const current = this.actions.get(action);
    return current?.state === 'released';
  }

  public getAxis(action: string): InputAxis {
    const current = this.actions.get(action);
    return current?.axis || { x: 0, y: 0 };
  }

  public getValue(action: string): number {
    const current = this.actions.get(action);
    return current?.value || 0;
  }

  public registerBinding(binding: InputBinding): void {
    this.bindings.set(binding.action, binding);
    if (!this.actions.has(binding.action)) {
      this.actions.set(binding.action, { state: 'released', value: 0 });
    }
  }

  public unregisterBinding(action: string): void {
    this.bindings.delete(action);
    this.actions.delete(action);
  }

  public on(action: string, callback: (action: string, state: InputAction) => void): () => void {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, []);
    }
    this.listeners.get(action)!.push(callback);

    return () => {
      const callbacks = this.listeners.get(action);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
    this.keyboardState.clear();
    this.actions.forEach((_, action) => {
      this.actions.set(action, { state: 'released', value: 0 });
    });
  }

  public enableTouchControls(): void {
    if (!this.canvas) {
      console.warn('Canvas not set for touch controls');
      return;
    }

    this.touchControls = [
      { id: 'joystick', type: 'joystick', x: 0.25, y: 0.75, width: 0.3, height: 0.3 },
      { id: 'fire', type: 'button', x: 0.75, y: 0.4, width: 0.25, height: 0.25 },
      { id: 'boost', type: 'button', x: 0.75, y: 0.8, width: 0.25, height: 0.2 },
      { id: 'skill1', type: 'button', x: 0.1, y: 0.2, width: 0.15, height: 0.15 },
      { id: 'skill2', type: 'button', x: 0.85, y: 0.2, width: 0.15, height: 0.15 }
    ];
  }

  public getTouchControls(): TouchControl[] {
    return [...this.touchControls];
  }

  public update(): void {
    this.updateGamepads();

    const joystick = this.actions.get('moveJoystick');
    if (joystick?.axis) {
      const { x, y } = joystick.axis;

      if (y < -0.2) {
        this.updateAction('moveForward', 'held', Math.abs(y));
      } else {
        this.updateAction('moveForward', 'released', 0);
      }

      if (y > 0.2) {
        this.updateAction('moveBackward', 'held', y);
      } else {
        this.updateAction('moveBackward', 'released', 0);
      }

      if (x < -0.2) {
        this.updateAction('moveLeft', 'held', Math.abs(x));
      } else {
        this.updateAction('moveLeft', 'released', 0);
      }

      if (x > 0.2) {
        this.updateAction('moveRight', 'held', x);
      } else {
        this.updateAction('moveRight', 'released', 0);
      }
    }
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));

    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
      this.canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this));
      this.canvas.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    window.removeEventListener('gamepadconnected', this.handleGamepadConnected.bind(this));
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected.bind(this));

    this.listeners.clear();
    this.bindings.clear();
    this.actions.clear();
  }
}