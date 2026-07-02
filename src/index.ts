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
