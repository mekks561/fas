import { createClient, RedisClientType } from 'redis';

class CacheService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private localCache: Map<string, { value: string; expiry: number }> = new Map();

  async connect(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URI || 'redis://localhost:6379';

      this.client = createClient({ url: redisUrl });

      this.client.on('error', (err) => {
        console.error('[Redis] 连接错误:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[Redis] 已连接');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('[Redis] 连接失败，使用本地缓存:', error);
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  // 设置缓存
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.isConnected && this.client) {
      try {
        await this.client.setEx(key, ttlSeconds, serialized);
        return;
      } catch (error) {
        console.error('[Redis] 设置缓存失败:', error);
      }
    }

    // 回退到本地缓存
    this.localCache.set(key, {
      value: serialized,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }

  // 获取缓存
  async get<T = any>(key: string): Promise<T | null> {
    if (this.isConnected && this.client) {
      try {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.error('[Redis] 获取缓存失败:', error);
      }
    }

    // 回退到本地缓存
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

  // 删除缓存
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

  // 删除匹配的缓存（模式）
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

    // 清理本地缓存
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.localCache.keys()) {
      if (regex.test(key)) {
        this.localCache.delete(key);
      }
    }
  }

  // 排行榜缓存
  async getLeaderboard(page: number, difficulty?: string): Promise<any | null> {
    const key = difficulty
      ? `leaderboard:${difficulty}:page:${page}`
      : `leaderboard:all:page:${page}`;
    return this.get(key);
  }

  async setLeaderboard(
    page: number,
    data: any,
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

  // 用户缓存
  async getUser(userId: string): Promise<any | null> {
    return this.get(`user:${userId}`);
  }

  async setUser(userId: string, data: any, ttlSeconds: number = 600): Promise<void> {
    await this.set(`user:${userId}`, data, ttlSeconds);
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.del(`user:${userId}`);
  }

  // 设置带锁（防止缓存击穿）
  async setWithLock(
    key: string,
    value: any,
    ttlSeconds: number = 3600,
    lockTtlSeconds: number = 10
  ): Promise<void> {
    const lockKey = `${key}:lock`;

    if (this.isConnected && this.client) {
      try {
        // 尝试获取锁
        const locked = await this.client.setNX(lockKey, '1');
        if (locked) {
          // 设置锁过期
          await this.client.expire(lockKey, lockTtlSeconds);
        }
      } catch (error) {
        console.error('[Redis] 获取锁失败:', error);
      }
    }

    // 设置缓存
    await this.set(key, value, ttlSeconds);

    // 释放锁
    if (this.isConnected && this.client) {
      await this.del(lockKey);
    }
  }
}

export const cacheService = new CacheService();
