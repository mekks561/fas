import { IKeyState, IShipControls, IKeyBindings } from './types';

export class InputManager {
  private keys: IKeyState = {};
  private mouseDelta = { x: 0, y: 0 };
  private mouseSensitivity = 0.003;
  private isLocked = false;
  private mouseButtons: Record<number, boolean> = {};
  private inputHistory: Array<{ type: string; key?: string; timestamp: number }> = [];
  private maxHistoryLength = 100;
  private keyBindings: IKeyBindings;
  private touchState: { left: boolean; right: boolean; up: boolean; down: boolean } = {
    left: false,
    right: false,
    up: false,
    down: false,
  };
  private comboTimeout: number | null = null;
  private isDebugMode = false;

  // 默认按键绑定
  private static defaultBindings: IKeyBindings = {
    forward: ['w', 'arrowup'],
    backward: ['s', 'arrowdown'],
    left: ['a', 'arrowleft'],
    right: ['d', 'arrowright'],
    up: ['e', 'space'],
    down: ['q'],
    rollLeft: ['z'],
    rollRight: ['c'],
    boost: ['shift'],
    fire: [' ', 'ctrl', 'mouse0'],
    pause: ['escape', 'p'],
    reset: ['r'],
  };

  constructor(
    private canvas: HTMLCanvasElement,
    keyBindings?: Partial<IKeyBindings>,
  ) {
    this.keyBindings = { ...InputManager.defaultBindings, ...keyBindings };
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 键盘事件
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // 鼠标事件
    this.canvas.addEventListener('click', this.handleCanvasClick);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('mousemove', this.handleMouseMove);

    // 触摸事件
    this.canvas.addEventListener('touchstart', this.handleTouchStart);
    this.canvas.addEventListener('touchend', this.handleTouchEnd);
    this.canvas.addEventListener('touchmove', this.handleTouchMove);

    // 防止右键菜单
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  public getControls(): IShipControls {
    const isPressed = (action: keyof IKeyBindings): boolean => {
      const bindings = this.keyBindings[action] || [];
      return bindings.some((binding) => {
        if (binding.startsWith('mouse')) {
          const btn = parseInt(binding.replace('mouse', ''), 10);
          return this.mouseButtons[btn] || false;
        }
        return this.keys[binding.toLowerCase()] || false;
      });
    };

    const touchControls = this.getTouchControls();

    return {
      forward: isPressed('forward') || touchControls.up,
      backward: isPressed('backward') || touchControls.down,
      left: isPressed('left') || touchControls.left,
      right: isPressed('right') || touchControls.right,
      up: isPressed('up'),
      down: isPressed('down'),
      rollLeft: isPressed('rollLeft'),
      rollRight: isPressed('rollRight'),
      boost: isPressed('boost'),
      fire: isPressed('fire'),
    };
  }

  private getTouchControls() {
    return this.touchState;
  }

  public getMouseDelta() {
    const delta = { ...this.mouseDelta };
    this.mouseDelta = { x: 0, y: 0 }; // 重置
    return delta;
  }

  public setMouseSensitivity(sensitivity: number): void {
    this.mouseSensitivity = Math.max(0.001, Math.min(0.01, sensitivity));
  }

  public getMouseSensitivity(): number {
    return this.mouseSensitivity;
  }

  public isKeyPressed(key: string): boolean {
    return this.keys[key.toLowerCase()] || false;
  }

  public isMouseButtonPressed(button: number): boolean {
    return this.mouseButtons[button] || false;
  }

  public isAnyKeyPressed(): boolean {
    return Object.values(this.keys).some(Boolean);
  }

  public getPressedKeys(): string[] {
    return Object.entries(this.keys)
      .filter(([_, pressed]) => pressed)
      .map(([key]) => key);
  }

  // 组合键检测
  public checkCombo(combo: string[]): boolean {
    return combo.every((key) => this.keys[key.toLowerCase()]);
  }

  public registerCombo(combo: string[], callback: () => void, timeout: number = 500): void {
    if (this.checkCombo(combo)) {
      if (this.comboTimeout) clearTimeout(this.comboTimeout);
      this.comboTimeout = window.setTimeout(() => {
        callback();
      }, timeout);
    }
  }

  // 输入历史
  public getInputHistory() {
    return [...this.inputHistory];
  }

  public clearInputHistory(): void {
    this.inputHistory = [];
  }

  // 按键绑定管理
  public setKeyBindings(bindings: Partial<IKeyBindings>): void {
    this.keyBindings = { ...this.keyBindings, ...bindings };
  }

  public getKeyBindings(): IKeyBindings {
    return { ...this.keyBindings };
  }

  public resetKeyBindings(): void {
    this.keyBindings = { ...InputManager.defaultBindings };
  }

  public addKeyBinding(action: keyof IKeyBindings, key: string): void {
    if (!this.keyBindings[action]) {
      this.keyBindings[action] = [];
    }
    const bindings = this.keyBindings[action];
    if (bindings && !bindings.includes(key)) {
      bindings.push(key);
    }
  }

  public removeKeyBinding(action: keyof IKeyBindings, key: string): void {
    const bindings = this.keyBindings[action];
    if (bindings) {
      this.keyBindings[action] = bindings.filter((k) => k !== key);
    }
  }

  // 调试工具
  public enableDebugMode(): void {
    this.isDebugMode = true;
    console.log('[InputManager] Debug mode enabled');
  }

  public disableDebugMode(): void {
    this.isDebugMode = false;
    console.log('[InputManager] Debug mode disabled');
  }

  public getDebugInfo() {
    return {
      pressedKeys: this.getPressedKeys(),
      mouseButtons: { ...this.mouseButtons },
      mouseDelta: { ...this.mouseDelta },
      isLocked: this.isLocked,
      mouseSensitivity: this.mouseSensitivity,
      touchState: { ...this.touchState },
      inputHistorySize: this.inputHistory.length,
    };
  }

  public clear(): void {
    Object.keys(this.keys).forEach((key) => {
      this.keys[key] = false;
    });
    Object.keys(this.mouseButtons).forEach((btnStr) => {
      const btn = parseInt(btnStr, 10);
      if (!isNaN(btn)) {
        this.mouseButtons[btn] = false;
      }
    });
    this.touchState = { left: false, right: false, up: false, down: false };
  }

  public dispose(): void {
    // 清理事件监听器
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('click', this.handleCanvasClick);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);

    if (this.comboTimeout) {
      clearTimeout(this.comboTimeout);
    }
  }

  // 为了能够移除事件监听器，需要将处理函数保存为实例方法
  private handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    this.keys[key] = true;

    if (this.isDebugMode) {
      this.addToHistory('keydown', key);
    }

    if (e.key === ' ') e.preventDefault();
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    this.keys[key] = false;

    if (this.isDebugMode) {
      this.addToHistory('keyup', key);
    }
  };

  private handleMouseDown = (e: MouseEvent) => {
    this.mouseButtons[e.button] = true;

    if (this.isDebugMode) {
      this.addToHistory('mousedown', `mouse${e.button}`);
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    this.mouseButtons[e.button] = false;

    if (this.isDebugMode) {
      this.addToHistory('mouseup', `mouse${e.button}`);
    }
  };

  private handleCanvasClick = () => {
    this.canvas.requestPointerLock();
  };

  private handlePointerLockChange = () => {
    this.isLocked = document.pointerLockElement === (this.canvas as unknown as Element);
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.isLocked) {
      this.mouseDelta.x += e.movementX * this.mouseSensitivity;
      this.mouseDelta.y += e.movementY * this.mouseSensitivity;
      this.mouseDelta.y = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.mouseDelta.y));
    }
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  // 触摸事件处理
  private handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const touches = Array.from(e.touches);

    touches.forEach((touch) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (touch.clientX - rect.left) / rect.width;
      const y = (touch.clientY - rect.top) / rect.height;

      // 简单的虚拟摇杆区域判断
      if (x < 0.4) {
        if (y < 0.3) this.touchState.up = true;
        else if (y > 0.7) this.touchState.down = true;
        else if (x < 0.2) this.touchState.left = true;
        else this.touchState.right = true;
      } else if (x > 0.6) {
        // 右侧区域为射击区
        this.mouseButtons[0] = true;
      }
    });

    if (this.isDebugMode) {
      this.addToHistory('touchstart');
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    this.touchState = { left: false, right: false, up: false, down: false };
    this.mouseButtons[0] = false;

    if (this.isDebugMode) {
      this.addToHistory('touchend');
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
  };

  private addToHistory(type: string, key?: string): void {
    this.inputHistory.push({
      type,
      key,
      timestamp: Date.now(),
    });

    if (this.inputHistory.length > this.maxHistoryLength) {
      this.inputHistory.shift();
    }
  }
}
