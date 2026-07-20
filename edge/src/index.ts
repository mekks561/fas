import { Router } from 'itty-router';
import type { Request, Response, RouteHandler } from 'itty-router';
import { GameRoom } from './game-room';

export { GameRoom };

interface Env {
  API_URL: string;
  GameRoom: DurableObjectNamespace;
}

const router = Router();

const apiProxy: RouteHandler = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url);
  const apiPath = url.pathname.replace('/api', '');
  const apiUrl = `${env.API_URL}${apiPath}${url.search}`;

  try {
    const response = await fetch(apiUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: { code: 'PROXY_ERROR', message: 'API代理失败' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

router.all('/api/*', apiProxy);

router.get('/health', () => new Response(JSON.stringify({ success: true, message: 'Edge worker healthy' }), {
  headers: { 'Content-Type': 'application/json' },
}));

router.get('/ping', () => new Response(JSON.stringify({ success: true, timestamp: Date.now() }), {
  headers: { 'Content-Type': 'application/json' },
}));

router.get('/regions', () => {
  const regions = [
    { id: 'asia-east', name: '亚太东部', latency: '<50ms' },
    { id: 'asia-south', name: '亚太南部', latency: '<80ms' },
    { id: 'europe-west', name: '欧洲西部', latency: '<100ms' },
    { id: 'us-east', name: '美国东部', latency: '<150ms' },
    { id: 'us-west', name: '美国西部', latency: '<180ms' },
  ];
  return new Response(JSON.stringify({ success: true, data: regions }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

router.post('/matchmaking/find', async (request: Request, env: Env) => {
  try {
    const body = await request.json();
    const { userId, skillLevel, gameMode } = body;

    if (!userId || !skillLevel || !gameMode) {
      return new Response(JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: '参数不完整' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const roomId = await findOrCreateRoom(env, userId, skillLevel, gameMode);

    return new Response(JSON.stringify({
      success: true,
      data: {
        roomId,
        region: 'asia-east',
        latency: 35,
        players: 1,
        maxPlayers: 4,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: { code: 'MATCHMAKING_ERROR', message: '匹配失败' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

router.get('/matchmaking/status/:roomId', async (request: Request, env: Env) => {
  const { roomId } = request.params;

  try {
    const room = env.GameRoom.get(env.GameRoom.idFromString(roomId));
    const status = await room.fetch(`https://api.fighter-game.dev/room/${roomId}/status`);
    return status;
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: { code: 'ROOM_NOT_FOUND', message: '房间不存在' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function findOrCreateRoom(env: Env, userId: string, skillLevel: number, gameMode: string): Promise<string> {
  const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return roomId;
}

router.all('*', () => new Response('Not found', { status: 404 }));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return router.handle(request, env);
  },
};
