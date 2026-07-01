import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

// 路由
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import leaderboardRoutes from './routes/leaderboard';
import achievementRoutes from './routes/achievements';
import settingsRoutes from './routes/settings';
import resourceRoutes from './routes/resources';

// 加载环境变量
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// 中间件
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 100个请求
  message: { success: false, error: { code: 'RATE_LIMIT', message: '请求过于频繁' } }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMIT', message: '认证请求过于频繁' } }
});

app.use('/api', limiter);
app.use('/api/auth', authLimiter);

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/resources', resourceRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务器运行正常' });
});

// Socket.IO连接
io.on('connection', (socket) => {
  console.log('[Socket.IO] 客户端连接:', socket.id);

  // 加入排行榜房间
  socket.on('leaderboard:subscribe', () => {
    socket.join('leaderboard');
    console.log('[Socket.IO] 客户端订阅排行榜');
  });

  // 离开排行榜房间
  socket.on('leaderboard:unsubscribe', () => {
    socket.leave('leaderboard');
    console.log('[Socket.IO] 客户端取消订阅排行榜');
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('[Socket.IO] 客户端断开:', socket.id);
  });
});

// 错误处理中间件
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

// 数据库连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fighter-game';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('[MongoDB] 数据库连接成功');
    
    // 启动服务器
    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      console.log(`[Server] 服务器运行在端口 ${PORT}`);
      console.log(`[Server] 环境: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((error) => {
    console.error('[MongoDB] 数据库连接失败:', error);
    process.exit(1);
  });

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[Server] 收到SIGTERM信号，正在关闭...');
  
  await mongoose.connection.close();
  httpServer.close();
  
  console.log('[Server] 服务器已关闭');
  process.exit(0);
});

export { app, io };
