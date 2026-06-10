export interface IGameConfig {
  debug: boolean;
  showInspector: boolean;
  gravity: number;
  playerSpeed: number;
  rotationSpeed: number;
}

export interface IKeyState {
  [key: string]: boolean;
}

export interface IShipControls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  boost: boolean;
  fire: boolean;
}

export interface IKeyBindings {
  forward?: string[];
  backward?: string[];
  left?: string[];
  right?: string[];
  up?: string[];
  down?: string[];
  rollLeft?: string[];
  rollRight?: string[];
  boost?: string[];
  fire?: string[];
  pause?: string[];
  reset?: string[];
}