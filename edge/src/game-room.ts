import { DurableObject, DurableObjectState } from '@cloudflare/workers-types';

export class GameRoom implements DurableObject {
  private state: DurableObjectState;
  private players: Map<string, PlayerConnection> = new Map();
  private gameState: GameState = {
    status: 'waiting',
    startTime: null,
    players: [],
    scores: {},
  };

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/status') {
      return this.getStatus();
    }

    if (path === '/join') {
      return this.joinGame(request);
    }

    if (path === '/leave') {
      return this.leaveGame(request);
    }

    if (path === '/move') {
      return this.handleMove(request);
    }

    if (path === '/chat') {
      return this.handleChat(request);
    }

    return new Response('Not found', { status: 404 });
  }

  private getStatus(): Response {
    return new Response(JSON.stringify({
      success: true,
      data: {
        roomId: this.state.id.toString(),
        status: this.gameState.status,
        playerCount: this.players.size,
        players: Array.from(this.players.values()).map((p) => ({
          id: p.id,
          username: p.username,
          ready: p.ready,
        })),
        startTime: this.gameState.startTime,
      },
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  private async joinGame(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { userId, username } = body;

      if (this.players.has(userId)) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'ALREADY_IN_ROOM', message: '已在房间中' },
        }), { status: 400 });
      }

      this.players.set(userId, {
        id: userId,
        username,
        ready: false,
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        score: 0,
      });

      this.gameState.players.push(userId);

      if (this.players.size >= 4) {
        this.startGame();
      }

      this.broadcast('player_join', { userId, username });

      return new Response(JSON.stringify({
        success: true,
        data: { roomId: this.state.id.toString(), playerCount: this.players.size },
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'JOIN_ERROR', message: '加入房间失败' },
      }), { status: 500 });
    }
  }

  private async leaveGame(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { userId } = body;

      if (!this.players.has(userId)) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'NOT_IN_ROOM', message: '不在房间中' },
        }), { status: 400 });
      }

      this.players.delete(userId);
      this.gameState.players = this.gameState.players.filter((id) => id !== userId);

      if (this.players.size === 0) {
        this.gameState.status = 'waiting';
        this.gameState.startTime = null;
      }

      this.broadcast('player_leave', { userId });

      return new Response(JSON.stringify({
        success: true,
        data: { playerCount: this.players.size },
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'LEAVE_ERROR', message: '离开房间失败' },
      }), { status: 500 });
    }
  }

  private async handleMove(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { userId, position, rotation } = body;

      const player = this.players.get(userId);
      if (!player) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'PLAYER_NOT_FOUND', message: '玩家不存在' },
        }), { status: 404 });
      }

      player.position = position;
      player.rotation = rotation;

      this.broadcast('player_move', { userId, position, rotation });

      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'MOVE_ERROR', message: '移动处理失败' },
      }), { status: 500 });
    }
  }

  private async handleChat(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { userId, message } = body;

      const player = this.players.get(userId);
      if (!player) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'PLAYER_NOT_FOUND', message: '玩家不存在' },
        }), { status: 404 });
      }

      if (!message || message.length > 200) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'INVALID_MESSAGE', message: '消息无效' },
        }), { status: 400 });
      }

      this.broadcast('chat_message', { userId, username: player.username, message });

      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'CHAT_ERROR', message: '聊天失败' },
      }), { status: 500 });
    }
  }

  private startGame(): void {
    this.gameState.status = 'playing';
    this.gameState.startTime = Date.now();

    this.players.forEach((player) => {
      player.score = 0;
      player.ready = true;
    });

    this.broadcast('game_start', { startTime: this.gameState.startTime });
  }

  private endGame(): void {
    this.gameState.status = 'ended';
    this.broadcast('game_end', { scores: this.gameState.scores });
  }

  private broadcast(event: string, data: unknown): void {
    const message = JSON.stringify({ event, data });
    console.log(`[GameRoom] Broadcasting: ${event} to ${this.players.size} players`);
  }
}

interface PlayerConnection {
  id: string;
  username: string;
  ready: boolean;
  position: { x: number; y: number; z: number };
  rotation: number;
  score: number;
}

interface GameState {
  status: 'waiting' | 'playing' | 'ended';
  startTime: number | null;
  players: string[];
  scores: Record<string, number>;
}
