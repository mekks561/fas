import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import leaderboardRoutes from './routes/leaderboard';
import achievementRoutes from './routes/achievements';
import settingsRoutes from './routes/settings';
import resourceRoutes from './routes/resources';
import shopRoutes from './routes/shop';
import inventoryRoutes from './routes/inventory';
import friendRoutes from './routes/friends';
import gameDataRoutes from './routes/gameData';

import { RoomService } from './services/RoomService';
import { GameSyncHandler, PlayerState, ProjectileState, EnemyState, PickupState } from './services/GameSyncHandler';
import { connectDB, disconnectDB } from './lib/prisma';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

const roomService = new RoomService(io);
const gameSyncHandler = new GameSyncHandler(io);

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: { code: 'RATE_LIMIT', message: '请求过于频繁' } }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMIT', message: '认证请求过于频繁' } }
});

const _actionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, error: { code: 'RATE_LIMIT', message: '操作过于频繁，请稍后再试' } }
});

app.use('/api', limiter);
app.use('/api/auth', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/game', gameDataRoutes);

app.get('/api/multiplayer/stats', (req, res) => {
  res.json({ success: true, data: roomService.getStats() });
});

app.get('/api/multiplayer/rooms', (req, res) => {
  const gameMode = req.query.mode as string;
  const rooms = roomService.getWaitingRooms(gameMode);
  res.json({ success: true, data: rooms });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务器运行正常' });
});

io.on('connection', (socket) => {
  console.log('[Socket.IO] 客户端连接:', socket.id);

  socket.on('leaderboard:subscribe', () => {
    socket.join('leaderboard');
    console.log('[Socket.IO] 客户端订阅排行榜');
  });

  socket.on('leaderboard:unsubscribe', () => {
    socket.leave('leaderboard');
    console.log('[Socket.IO] 客户端取消订阅排行榜');
  });

  socket.on('matchmaking:join', (data: { gameMode: string; userId: string; username: string; avatar: string }) => {
    roomService.joinMatchmaking(data.gameMode, {
      userId: data.userId,
      socketId: socket.id,
      username: data.username,
      avatar: data.avatar,
    });
    console.log(`[Matchmaking] ${data.username} 加入匹配队列: ${data.gameMode}`);
  });

  socket.on('matchmaking:leave', (data: { gameMode: string }) => {
    roomService.leaveMatchmaking(data.gameMode, socket.id);
    console.log(`[Matchmaking] 客户端离开匹配队列: ${data.gameMode}`);
  });

  socket.on('room:create', (data: { name?: string; maxPlayers?: number; gameMode?: string; map?: string }) => {
    const room = roomService.createRoom({
      name: data.name,
      maxPlayers: data.maxPlayers,
      gameMode: data.gameMode as 'deathmatch' | 'team_deathmatch' | 'coop',
      map: data.map,
    });
    socket.emit('room:created', { roomId: room.id, roomName: room.name });
    console.log(`[Room] 创建房间: ${room.id} ${room.name}`);
  });

  socket.on('room:join', (data: { roomId: string; userId: string; username: string; avatar: string }) => {
    const success = roomService.joinRoom(data.roomId, {
      socketId: socket.id,
      userId: data.userId,
      username: data.username,
      avatar: data.avatar,
    });
    if (success) {
      socket.join(data.roomId);
      const room = roomService.getRoom(data.roomId);
      socket.emit('room:joined', {
        roomId: data.roomId,
        players: Array.from(room?.players.values() || []),
      });
      console.log(`[Room] ${data.username} 加入房间: ${data.roomId}`);
    } else {
      socket.emit('room:join_failed', { error: '无法加入房间' });
    }
  });

  socket.on('room:leave', (data: { roomId: string }) => {
    roomService.leaveRoom(data.roomId, socket.id);
    socket.leave(data.roomId);
    console.log(`[Room] 客户端离开房间: ${data.roomId}`);
  });

  socket.on('room:ready', (data: { roomId: string; ready: boolean }) => {
    roomService.setPlayerReady(data.roomId, socket.id, data.ready);
    console.log(`[Room] 玩家准备状态更新: ${socket.id} -> ${data.ready}`);
  });

  socket.on('room:start', (data: { roomId: string }) => {
    const room = roomService.getRoom(data.roomId);
    if (room) {
      roomService.startGame(room);
      gameSyncHandler.initializeGameState(data.roomId, room);
      console.log(`[Game] 游戏开始: ${data.roomId}`);
    }
  });

  socket.on('room:end', (data: { roomId: string }) => {
    roomService.endGame(data.roomId);
    gameSyncHandler.cleanupGameState(data.roomId);
    console.log(`[Game] 游戏结束: ${data.roomId}`);
  });

  socket.on('game:player_state', (data: { roomId: string; state: unknown }) => {
    gameSyncHandler.handlePlayerState(socket.id, data.roomId, data.state as Partial<PlayerState>);
  });

  socket.on('game:projectile', (data: { roomId: string; projectile: unknown }) => {
    gameSyncHandler.handleProjectile(data.roomId, data.projectile as ProjectileState);
  });

  socket.on('game:projectile_hit', (data: { roomId: string; projectileId: string; hitTarget?: string }) => {
    gameSyncHandler.handleProjectileHit(data.roomId, data.projectileId, data.hitTarget);
  });

  socket.on('game:enemy_spawn', (data: { roomId: string; enemies: unknown[] }) => {
    gameSyncHandler.handleEnemySpawn(data.roomId, data.enemies as EnemyState[]);
  });

  socket.on('game:enemy_death', (data: { roomId: string; enemyId: string; killerId?: string }) => {
    gameSyncHandler.handleEnemyDeath(data.roomId, data.enemyId, data.killerId);
  });

  socket.on('game:pickup_spawn', (data: { roomId: string; pickup: unknown }) => {
    gameSyncHandler.handlePickupSpawn(data.roomId, data.pickup as PickupState);
  });

  socket.on('game:pickup_collect', (data: { roomId: string; pickupId: string; collectorId: string }) => {
    gameSyncHandler.handlePickupCollect(data.roomId, data.pickupId, data.collectorId);
  });

  socket.on('game:wave_update', (data: { roomId: string; wave: number }) => {
    gameSyncHandler.updateWave(data.roomId, data.wave);
  });

  socket.on('game:score_update', (data: { roomId: string; updates: { score?: number; kills?: number; wave?: number } }) => {
    roomService.updatePlayerScore(data.roomId, socket.id, data.updates);
  });

  socket.on('disconnect', () => {
    console.log('[Socket.IO] 客户端断开:', socket.id);
    roomService.getRooms().forEach((room) => {
      roomService.leaveRoom(room.id, socket.id);
    });
    if (roomService.getStats().queueSizes) {
      Object.keys(roomService.getStats().queueSizes).forEach((mode) => {
        roomService.leaveMatchmaking(mode, socket.id);
      });
    }
  });
});

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  const e = (err ?? {}) as { status?: number; code?: string; message?: string; details?: unknown };
  res.status(e.status || 500).json({
    success: false,
    error: {
      code: e.code || 'SERVER_ERROR',
      message: e.message || '服务器内部错误',
      details: e.details || {}
    }
  });
});

connectDB()
  .then(() => {
    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      console.log(`[Server] 服务器运行在端口 ${PORT}`);
      console.log(`[Server] 环境: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((error) => {
    console.error('[Database] 数据库连接失败:', error);
    process.exit(1);
  });

process.on('SIGTERM', async () => {
  console.log('[Server] 收到SIGTERM信号，正在关闭...');

  roomService.cleanup();
  gameSyncHandler.destroy();
  await disconnectDB();
  httpServer.close();

  console.log('[Server] 服务器已关闭');
  process.exit(0);
});

export { app, io };
