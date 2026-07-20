import Redis from 'ioredis';

interface CacheConfig {
  useSentinel: boolean;
  sentinels: { host: string; port: number }[];
  sentinelName: string;
  sentinelPassword?: string;
  redisUrl: string;
  redisPassword?: string;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
}

class CacheService {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private localCache: Map<string, { value: string; expiry: number }> = new Map();
  private config: CacheConfig;

  constructor() {
    this.config = this.parseConfig();
  }

  private parseConfig(): CacheConfig {
    return {
      useSentinel: process.env.REDIS_USE_SENTINEL === 'true',
      sentinels: process.env.REDIS_SENTINELS
        ? JSON.parse(process.env.REDIS_SENTINELS)
        : [{ host: 'localhost', port: 26379 }],
      sentinelName: process.env.REDIS_SENTINEL_NAME || 'mymaster',
      sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
      redisUrl: process.env.REDIS_URI || 'redis://localhost:6379',
      redisPassword: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    };
  }

  async connect(): Promise<void> {
    try {
      if (this.config.useSentinel) {
        this.client = new Redis({
          sentinels: this.config.sentinels,
          name: this.config.sentinelName,
          password: this.config.redisPassword,
          sentinelPassword: this.config.sentinelPassword,
          maxRetriesPerRequest: this.config.maxRetriesPerRequest,
          enableReadyCheck: true,
          lazyConnect: false,
        });
      } else {
        this.client = new Redis(this.config.redisUrl, {
          password: this.config.redisPassword,
          maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        });
      }

      this.client.on('error', (err) => {
        console.error('[Redis] 连接错误:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[Redis] 已连接');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('[Redis] 准备就绪');
      });

      this.client.on('reconnecting', () => {
        console.log('[Redis] 正在重新连接...');
      });

      this.client.on('end', () => {
        console.log('[Redis] 连接已关闭');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('[Redis] 连接失败，使用本地缓存:', error);
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number = 3600): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.isConnected && this.client) {
      try {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
        return;
      } catch (error) {
        console.error('[Redis] 设置缓存失败:', error);
      }
    }

    this.localCache.set(key, {
      value: serialized,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (this.isConnected && this.client) {
      try {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.error('[Redis] 获取缓存失败:', error);
      }
    }

    const cached = this.localCache.get(key);
    if (cached) {
      if (Date.now() > cached.expiry) {
        this.localCache.delete(key);
        return null;
      }
      return JSON.parse(cached.value);
    }

    return null;
  }

  async del(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch (error) {
        console.error('[Redis] 删除缓存失败:', error);
      }
    }

    this.localCache.delete(key);
  }

  async delPattern(pattern: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } catch (error) {
        console.error('[Redis] 批量删除缓存失败:', error);
      }
    }

    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.localCache.keys()) {
      if (regex.test(key)) {
        this.localCache.delete(key);
      }
    }
  }

  async getLeaderboard(page: number, difficulty?: string): Promise<unknown> {
    const key = difficulty
      ? `leaderboard:${difficulty}:page:${page}`
      : `leaderboard:all:page:${page}`;
    return this.get(key);
  }

  async setLeaderboard(
    page: number,
    data: unknown,
    difficulty?: string,
    ttlSeconds: number = 300
  ): Promise<void> {
    const key = difficulty
      ? `leaderboard:${difficulty}:page:${page}`
      : `leaderboard:all:page:${page}`;
    await this.set(key, data, ttlSeconds);
  }

  async invalidateLeaderboard(): Promise<void> {
    await this.delPattern('leaderboard:*');
  }

  async getUser(userId: number): Promise<unknown> {
    return this.get(`user:${userId}`);
  }

  async setUser(userId: number, data: unknown, ttlSeconds: number = 600): Promise<void> {
    await this.set(`user:${userId}`, data, ttlSeconds);
  }

  async invalidateUser(userId: number): Promise<void> {
    await this.del(`user:${userId}`);
  }

  async setWithLock(
    key: string,
    value: unknown,
    ttlSeconds: number = 3600,
    lockTtlSeconds: number = 10
  ): Promise<void> {
    const lockKey = `${key}:lock`;

    if (this.isConnected && this.client) {
      try {
        const _locked = await this.client.set(lockKey, '1', 'PX', lockTtlSeconds * 1000, 'NX');
      } catch (error) {
        console.error('[Redis] 获取锁失败:', error);
      }
    }

    await this.set(key, value, ttlSeconds);

    if (this.isConnected && this.client) {
      await this.del(lockKey);
    }
  }

  async getStats(): Promise<{
    connected: boolean;
    mode: string;
    clientType: string;
  }> {
    return {
      connected: this.isConnected,
      mode: this.config.useSentinel ? 'sentinel' : 'standalone',
      clientType: 'ioredis',
    };
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
  }> {
    if (!this.isConnected || !this.client) {
      return {
        status: 'unhealthy',
        message: 'Redis not connected',
      };
    }

    try {
      const result = await this.client.ping();
      if (result === 'PONG') {
        return {
          status: 'healthy',
          message: 'Redis connection healthy',
        };
      }
      return {
        status: 'unhealthy',
        message: 'Redis ping failed',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Redis health check failed: ${error}`,
      };
    }
  }
}

export const cacheService = new CacheService();
