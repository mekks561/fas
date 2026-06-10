import { Request, Response, NextFunction } from 'express';

interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  userId?: string;
  ip: string;
  userAgent: string;
}

// 日志队列
const logs: LogEntry[] = [];
const MAX_LOGS = 1000;

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  },

  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  },

  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  },

  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },

  // 获取最近日志
  getRecentLogs: (count: number = 100): LogEntry[] => {
    return logs.slice(-count);
  },

  // 获取日志统计
  getStats: () => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentLogs = logs.filter(
      log => new Date(log.timestamp).getTime() > oneHourAgo
    );

    const avgDuration =
      recentLogs.reduce((sum, log) => sum + log.duration, 0) /
      (recentLogs.length || 1);

    const statusCounts = recentLogs.reduce(
      (acc, log) => {
        const statusGroup =
          log.statusCode >= 200 && log.statusCode < 300
            ? '2xx'
            : log.statusCode >= 400 && log.statusCode < 500
            ? '4xx'
            : log.statusCode >= 500
            ? '5xx'
            : 'other';
        acc[statusGroup] = (acc[statusGroup] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total: logs.length,
      lastHour: recentLogs.length,
      avgDuration: Math.round(avgDuration),
      statusCounts
    };
  }
};

// 日志中间件
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // 获取用户ID（如果有）
  const userId = (req as any).user?.userId;

  // 响应拦截
  const originalSend = res.send;
  res.send = function (body): Response {
    const duration = Date.now() - startTime;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId,
      ip: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown'
    };

    // 添加到日志队列
    logs.push(logEntry);
    if (logs.length > MAX_LOGS) {
      logs.shift();
    }

    // 控制台输出
    const statusColor =
      res.statusCode >= 500
        ? '\x1b[31m'
        : res.statusCode >= 400
        ? '\x1b[33m'
        : res.statusCode >= 300
        ? '\x1b[36m'
        : '\x1b[32m';

    console.log(
      `${statusColor}${res.statusCode}\x1b[0m ${req.method} ${req.path} - ${duration}ms`
    );

    return originalSend.call(this, body);
  };

  next();
};

// 错误日志
export const errorLogger = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Request error:', {
    method: req.method,
    path: req.path,
    error: error.message,
    stack: error.stack,
    body: req.body
  });

  next(error);
};
