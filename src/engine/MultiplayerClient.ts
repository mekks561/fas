interface Socket {
  id?: string;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback?: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  connect(): void;
  disconnect(): void;
}

declare function io(url: string, options?: Record<string, unknown>): Socket;

export interface RoomPlayer {
  socketId: string;
  userId: string;
  username: string;
  avatar: string;
  ready: boolean;
  score: number;
  kills: number;
  wave: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  maxPlayers: number;
  players: RoomPlayer[];
  status: 'waiting' | 'starting' | 'playing' | 'finished';
  gameMode: 'deathmatch' | 'team_deathmatch' | 'coop';
  map: string;
}

export interface PlayerState {
  socketId: string;
  userId: string;
  username: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  kills: number;
  wave: number;
  weapon: string;
  isAlive: boolean;
}

export interface GameState {
  players: PlayerState[];
  projectiles: ProjectileState[];
  enemies: EnemyState[];
  pickups: PickupState[];
  gameTime: number;
  wave: number;
}

export interface ProjectileState {
  id: string;
  ownerId: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  type: string;
  damage: number;
  lifetime: number;
}

export interface EnemyState {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  speed: number;
  score: number;
}

export interface PickupState {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  duration: number;
}

export interface MatchmakingResult {
  roomId: string;
  roomName: string;
  players: Array<{ userId: string; username: string; avatar: string }>;
}

export interface MultiplayerStats {
  totalRooms: number;
  waitingRooms: number;
  playingRooms: number;
  totalPlayers: number;
  queueSizes: Record<string, number>;
}

export type GameMode = 'deathmatch' | 'team_deathmatch' | 'coop';

export interface MultiplayerEvents {
  'matchmaking:queued': (data: { gameMode: string; position: number }) => void;
  'matchmaking:matched': (data: MatchmakingResult) => void;
  'room:created': (data: { roomId: string; roomName: string }) => void;
  'room:joined': (data: { roomId: string; players: RoomPlayer[] }) => void;
  'room:join_failed': (data: { error: string }) => void;
  'room:player_joined': (player: RoomPlayer) => void;
  'room:player_left': (data: { socketId: string; userId: string }) => void;
  'room:player_ready': (data: { socketId: string; ready: boolean }) => void;
  'room:starting': (data: { countdown: number }) => void;
  'room:countdown': (countdown: number) => void;
  'room:started': (data: { startTime: number; gameMode: string; map: string }) => void;
  'room:finished': (data: {
    endTime: number;
    duration: number;
    results: Array<{ userId: string; username: string; score: number; kills: number; wave: number }>;
  }) => void;
  'room:destroyed': () => void;
  'game:sync': (gameState: GameState) => void;
  'room:player_score_update': (data: { socketId: string; updates: { score?: number; kills?: number; wave?: number } }) => void;
}

export class MultiplayerClient {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private currentRoomId: string | null = null;
  private gameMode: GameMode | null = null;
  private authToken: string | null = null;

  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  constructor(private serverUrl: string = '', token?: string) {
    this.authToken = token || null;
  }

  public connect(token?: string): Promise<void> {
    if (token) {
      this.authToken = token;
    }

    return new Promise((resolve, reject) => {
      if (this.socket) {
        this.disconnect();
      }

      const url = this.serverUrl || window.location.origin.replace('http', 'ws').replace(':5175', ':3001');
      const authQuery = this.authToken ? `?token=${encodeURIComponent(this.authToken)}` : '';
      
      this.socket = io(url + authQuery, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        resolve();
      });

      this.socket.on('connect_error', (error: unknown) => {
        reject(error);
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        this.currentRoomId = null;
      });

      this.socket.on('auth:invalid', (data: unknown) => {
        const errorData = data as { error: string };
        console.error('[MultiplayerClient] Authentication failed:', errorData.error);
        this.disconnect();
        reject(new Error(`Authentication failed: ${errorData.error}`));
      });

      this.setupEventListeners();
    });
  }

  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  public clearAuthToken(): void {
    this.authToken = null;
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    const events: (keyof MultiplayerEvents)[] = [
      'matchmaking:queued',
      'matchmaking:matched',
      'room:created',
      'room:joined',
      'room:join_failed',
      'room:player_joined',
      'room:player_left',
      'room:player_ready',
      'room:starting',
      'room:countdown',
      'room:started',
      'room:finished',
      'room:destroyed',
      'game:sync',
      'room:player_score_update',
    ];

    events.forEach((event) => {
      this.socket?.on(event, (...args: unknown[]) => {
        this.notifyListeners(event, args);
      });
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.currentRoomId = null;
  }

  public async joinMatchmaking(gameMode: GameMode, playerInfo: { userId: string; username: string; avatar: string }): Promise<void> {
    if (!this.socket) throw new Error('Not connected');
    
    this.gameMode = gameMode;
    this.socket.emit('matchmaking:join', {
      gameMode,
      ...playerInfo,
    });
  }

  public async leaveMatchmaking(gameMode: GameMode): Promise<void> {
    if (!this.socket) throw new Error('Not connected');
    
    this.socket.emit('matchmaking:leave', { gameMode });
    this.gameMode = null;
  }

  public async createRoom(options: {
    name?: string;
    maxPlayers?: number;
    gameMode?: GameMode;
    map?: string;
  }): Promise<{ roomId: string; roomName: string }> {
    if (!this.socket) throw new Error('Not connected');
    
    const socket = this.socket;
    return new Promise((resolve) => {
      const handler = (data: { roomId: string; roomName: string }) => {
        this.currentRoomId = data.roomId;
        socket.off('room:created', handler as unknown as (...args: unknown[]) => void);
        resolve(data);
      };
      socket.on('room:created', handler as unknown as (...args: unknown[]) => void);
      socket.emit('room:create', options);
    });
  }

  public async joinRoom(roomId: string, playerInfo: { userId: string; username: string; avatar: string }): Promise<{ roomId: string; players: RoomPlayer[] }> {
    if (!this.socket) throw new Error('Not connected');
    
    const socket = this.socket;
    return new Promise((resolve, reject) => {
      const joinedHandler = (data: { roomId: string; players: RoomPlayer[] }) => {
        this.currentRoomId = data.roomId;
        socket.off('room:joined', joinedHandler as unknown as (...args: unknown[]) => void);
        socket.off('room:join_failed', failedHandler as unknown as (...args: unknown[]) => void);
        resolve(data);
      };

      const failedHandler = (data: { error: string }) => {
        socket.off('room:joined', joinedHandler as unknown as (...args: unknown[]) => void);
        socket.off('room:join_failed', failedHandler as unknown as (...args: unknown[]) => void);
        reject(new Error(data.error));
      };

      socket.on('room:joined', joinedHandler as unknown as (...args: unknown[]) => void);
      socket.on('room:join_failed', failedHandler as unknown as (...args: unknown[]) => void);
      socket.emit('room:join', { roomId, ...playerInfo });
    });
  }

  public async leaveRoom(): Promise<void> {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('room:leave', { roomId: this.currentRoomId });
    this.currentRoomId = null;
  }

  public async setReady(ready: boolean): Promise<void> {
    if (!this.socket || !this.currentRoomId) throw new Error('Not in a room');
    
    this.socket.emit('room:ready', { roomId: this.currentRoomId, ready });
  }

  public async startGame(): Promise<void> {
    if (!this.socket || !this.currentRoomId) throw new Error('Not in a room');
    
    this.socket.emit('room:start', { roomId: this.currentRoomId });
  }

  public async endGame(): Promise<void> {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('room:end', { roomId: this.currentRoomId });
    this.currentRoomId = null;
  }

  public sendPlayerState(state: Partial<PlayerState>): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:player_state', { roomId: this.currentRoomId, state });
  }

  public sendProjectile(projectile: ProjectileState): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:projectile', { roomId: this.currentRoomId, projectile });
  }

  public sendProjectileHit(projectileId: string, hitTarget?: string): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:projectile_hit', { roomId: this.currentRoomId, projectileId, hitTarget });
  }

  public sendEnemySpawn(enemies: EnemyState[]): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:enemy_spawn', { roomId: this.currentRoomId, enemies });
  }

  public sendEnemyDeath(enemyId: string, killerId?: string): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:enemy_death', { roomId: this.currentRoomId, enemyId, killerId });
  }

  public sendPickupSpawn(pickup: PickupState): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:pickup_spawn', { roomId: this.currentRoomId, pickup });
  }

  public sendPickupCollect(pickupId: string, collectorId: string): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:pickup_collect', { roomId: this.currentRoomId, pickupId, collectorId });
  }

  public sendWaveUpdate(wave: number): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:wave_update', { roomId: this.currentRoomId, wave });
  }

  public sendScoreUpdate(updates: { score?: number; kills?: number; wave?: number }): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:score_update', { roomId: this.currentRoomId, updates });
  }

  public async getStats(): Promise<MultiplayerStats> {
    const response = await fetch(`${this.serverUrl}/api/multiplayer/stats`);
    const data = await response.json();
    return data.data;
  }

  public async getRooms(gameMode?: string): Promise<RoomInfo[]> {
    const url = new URL(`${this.serverUrl}/api/multiplayer/rooms`);
    if (gameMode) {
      url.searchParams.set('mode', gameMode);
    }
    const response = await fetch(url.toString());
    const data = await response.json();
    return data.data;
  }

  public on<T extends keyof MultiplayerEvents>(event: T, callback: MultiplayerEvents[T]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback as unknown as (...args: unknown[]) => void);
    
    return () => {
      this.listeners.get(event)?.delete(callback as unknown as (...args: unknown[]) => void);
    };
  }

  private notifyListeners(event: string, args: unknown[]): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    
    callbacks.forEach((callback) => {
      try {
        (callback as (...args: unknown[]) => void)(...args);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  public get isConnectedValue(): boolean {
    return this.isConnected;
  }

  public get roomId(): string | null {
    return this.currentRoomId;
  }

  public get currentGameMode(): GameMode | null {
    return this.gameMode;
  }

  public get socketId(): string | undefined {
    return this.socket?.id;
  }
}
