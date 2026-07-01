/**
 * 高性能对象池管理器
 * 用于复用频繁创建/销毁的对象，如子弹、粒子等
 */

interface PoolItem<T> {
  instance: T;
  active: boolean;
  lastUsed: number;
}

export class ObjectPool<T> {
  private pool: PoolItem<T>[] = [];
  private createFn: () => T;
  private resetFn: (item: T) => void;
  private maxSize: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupThreshold: number; // 毫秒，超过此时间未使用则清理

  constructor(
    createFn: () => T,
    resetFn: (item: T) => void,
    maxSize: number = 100,
    cleanupThreshold: number = 5000
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.cleanupThreshold = cleanupThreshold;
    this.cleanupInterval = setInterval(() => this.cleanup(), 10000);
  }

  /**
   * 从池中获取对象
   */
  public acquire(): T {
    // 优先查找空闲对象
    const available = this.pool.find(item => !item.active);
    
    if (available) {
      available.active = true;
      available.lastUsed = Date.now();
      this.resetFn(available.instance);
      return available.instance;
    }
    
    // 池未满则创建新对象
    if (this.pool.length < this.maxSize) {
      const newItem = this.createFn();
      this.pool.push({
        instance: newItem,
        active: true,
        lastUsed: Date.now()
      });
      return newItem;
    }
    
    // 池已满，强制复用最旧的对象
    const oldest = this.pool.reduce((prev, curr) => 
      prev.lastUsed < curr.lastUsed ? prev : curr
    );
    
    if (!oldest.active) {
      oldest.active = true;
      oldest.lastUsed = Date.now();
      this.resetFn(oldest.instance);
      return oldest.instance;
    }
    
    // 所有对象都在使用，创建临时对象
    return this.createFn();
  }

  /**
   * 释放对象回池
   */
  public release(instance: T): void {
    const item = this.pool.find(item => item.instance === instance);
    
    if (item) {
      item.active = false;
      item.lastUsed = Date.now();
    }
  }

  /**
   * 获取活动对象数量
   */
  public getActiveCount(): number {
    return this.pool.filter(item => item.active).length;
  }

  /**
   * 获取池总大小
   */
  public getPoolSize(): number {
    return this.pool.length;
  }

  /**
   * 清理长时间未使用的对象
   */
  private cleanup(): void {
    const now = Date.now();
    const threshold = this.cleanupThreshold;
    
    this.pool = this.pool.filter(item => {
      if (!item.active && (now - item.lastUsed) > threshold) {
        // 清理逻辑可在此扩展
        return false;
      }
      return true;
    });
  }

  /**
   * 销毁池
   */
  public dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.pool = [];
  }

  /**
   * 预填充池
   */
  public prefill(count: number): void {
    const actualCount = Math.min(count, this.maxSize - this.pool.length);
    
    for (let i = 0; i < actualCount; i++) {
      const newItem = this.createFn();
      this.pool.push({
        instance: newItem,
        active: false,
        lastUsed: Date.now()
      });
    }
  }
}

/**
 * 投射物对象池
 */
import { Projectile } from '../types/game-types';

export class ProjectilePool extends ObjectPool<Projectile> {
  constructor() {
    super(
      () => ({
        id: `proj_${Math.random().toString(36).substr(2, 9)}`,
        x: 0,
        y: 0,
        z: 0,
        velocityX: 0,
        velocityY: 0,
        velocityZ: 0,
        damage: 10,
        lifetime: 3,
        type: 'PLAYER'
      }),
      (proj) => {
        proj.x = 0;
        proj.y = 0;
        proj.z = 0;
        proj.velocityX = 0;
        proj.velocityY = 0;
        proj.velocityZ = 0;
      },
      200,
      10000
    );
  }
}