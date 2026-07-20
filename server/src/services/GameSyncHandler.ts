import { Server } from 'socket.io';
import { Room } from './RoomService';

export interface GameState {
  players: PlayerState[];
  projectiles: ProjectileState[];
  enemies: EnemyState[];
  pickups: PickupState[];
  gameTime: number;
  wave: number;
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

export class GameSyncHandler {
  private io: Server;
  private gameStates: Map<string, GameState> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private tickRate: number = 60;

  constructor(io: Server) {
    this.io = io;
    this.startSyncLoop();
  }

  public initializeGameState(roomId: string, room: Room): void {
    const playerStates: PlayerState[] = Array.from(room.players.values()).map((player) => ({
      socketId: player.socketId,
      userId: player.userId,
      username: player.username,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 50,
      score: 0,
      kills: 0,
      wave: 1,
      weapon: 'default',
      isAlive: true,
    }));

    const gameState: GameState = {
      players: playerStates,
      projectiles: [],
      enemies: [],
      pickups: [],
      gameTime: 0,
      wave: 1,
    };

    this.gameStates.set(roomId, gameState);
  }

  public handlePlayerState(socketId: string, roomId: string, state: Partial<PlayerState>): void {
    const gameState = this.gameStates.get(roomId);
    if (!gameState) return;

    const playerIndex = gameState.players.findIndex((p) => p.socketId === socketId);
    if (playerIndex === -1) return;

    Object.assign(gameState.players[playerIndex], state);
  }

  public handleProjectile(roomId: string, projectile: ProjectileState): void {
    const gameState = this.gameStates.get(roomId);
    if (!gameState) return;

    gameState.projectiles.push(projectile);
  }

  public handleProjectileHit(roomId: string, projectileId: string, hitTarget?: string): void {
    const gameState = this.gameStates.get(roomId);
    if (!gameState) return;

    const index = gameState.projectiles.findIndex((p) => p.id === projectileId);
    if (index !== -1) {
      gameState.projectiles.splice(index, 1);
    }

    if (hitTarget) {
      const playerIndex = gameState.players.findIndex((p) => p.socketId === hitTarget);
      if (playerIndex !== -1) {
        gameState.players[playerIndex].health -= 10;
        if (gameState.players[playerIndex].health <= 0) {
          gameState.players[playerIndex].isAlive = false;
        }
      }
    }
  }

  public handleEnemySpawn(roomId: string, enemies: EnemyState[]): void {
    const gameState = this.gameStates.get(roomId);
    if (!gameState) return;

    gameState.enemies.push(...enemies);
  }

  public handleEnemyDeath(roomId: string, enemyId: string, killerId?: string): void {
    const gameState = this.gameStates.get(roomId);
    if (!gameState) return;

    const index = gameState.enemies.findIndex((e) => e.id === enemyId);
    if (index !== -1) {
      const enemy = gameState.enemies[index];
      gameState.enemies.splice(index, 1);

      if (killerId) {
        const playerIndex = gameState.players.findIndex((p) => p.socketId === killerId);
        if (playerIndex !== -1) {
          gameState.players[playerIndex].score += enemy.score;
          gameState.players[playerIndex].kills++;
        }
      }
    }
  }

  public handlePickupSpawn(roomId: string, pickup: PickupState): void {
    const gameState = this.gameStates.get(roomId);
    if (!gameState) return;

    gameState.pickups.push(pickup);
  }

  public handlePickupCollect(roomId: string, pickupId: string, collectorId: string): void {
    const gameState = this.gameStates.get(roomId);
    if (!gameState) return;

    const index = gameState.pickups.findIndex((p) => p.id === pickupId);
    if (index !== -1) {
      const pickup = gameState.pickups[index];
      gameState.pickups.splice(index, 1);

      const playerIndex = gameState.players.findIndex((p) => p.socketId === collectorId);
      if (playerIndex !== -1) {
        const player = gameState.players[playerIndex];
        switch (pickup.type) {
          case 'health':
            player.health = Math.min(player.maxHealth, player.health + 30);
            break;
          case 'shield':
            player.shield = Math.min(player.maxShield, player.shield + 20);
            break;
          case 'weapon':
            player.weapon = 'powerful';
            break;
        }
      }
    }
  }

  public updateWave(roomId: string, wave: number): void {
    const gameState = this.gameStates.get(roomId);
    if (!gameState) return;

    gameState.wave = wave;
    gameState.players.forEach((player) => {
      player.wave = wave;
    });
  }

  private startSyncLoop(): void {
    const interval = 1000 / this.tickRate;
    this.syncInterval = setInterval(() => {
      this.syncGameStates();
    }, interval);
  }

  private syncGameStates(): void {
    this.gameStates.forEach((gameState, roomId) => {
      gameState.gameTime += 1 / this.tickRate;

      this.io.to(roomId).emit('game:sync', {
        players: gameState.players,
        projectiles: gameState.projectiles.slice(0, 50),
        enemies: gameState.enemies.slice(0, 100),
        pickups: gameState.pickups,
        gameTime: gameState.gameTime,
        wave: gameState.wave,
      });
    });
  }

  public cleanupGameState(roomId: string): void {
    this.gameStates.delete(roomId);
  }

  public getGameState(roomId: string): GameState | undefined {
    return this.gameStates.get(roomId);
  }

  public getPlayerState(roomId: string, socketId: string): PlayerState | undefined {
    const gameState = this.gameStates.get(roomId);
    if (!gameState) return undefined;
    return gameState.players.find((p) => p.socketId === socketId);
  }

  public destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.gameStates.clear();
  }
}
