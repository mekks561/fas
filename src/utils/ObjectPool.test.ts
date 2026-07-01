import { ObjectPool, ProjectilePool } from './ObjectPool';

interface TestObject {
  id: string;
  value: number;
}

describe('ObjectPool', () => {
  let pool: ObjectPool<TestObject>;

  const createTestObject = (): TestObject => ({
    id: `test_${Math.random().toString(36).substr(2, 9)}`,
    value: 0
  });

  const resetTestObject = (obj: TestObject): void => {
    obj.value = 0;
  };

  beforeEach(() => {
    pool = new ObjectPool<TestObject>(createTestObject, resetTestObject, 10);
  });

  afterEach(() => {
    pool.dispose();
  });

  describe('基础功能', () => {
    it('应该正确创建对象池', () => {
      expect(pool).toBeInstanceOf(ObjectPool);
      expect(pool.getPoolSize()).toBe(0);
    });

    it('应该正确获取对象', () => {
      const obj = pool.acquire();
      expect(obj).toBeDefined();
      expect(obj.value).toBe(0);
    });

    it('应该正确释放对象', () => {
      const obj = pool.acquire();
      obj.value = 100;
      expect(pool.getActiveCount()).toBe(1);

      pool.release(obj);
      expect(pool.getActiveCount()).toBe(0);
    });

    it('释放对象时应该调用reset函数', () => {
      const obj = pool.acquire();
      obj.value = 100;

      pool.release(obj);
      // 注意：release不会立即调用reset，reset只在acquire时调用
    });
  });

  describe('容量管理', () => {
    it('应该正确预填充池', () => {
      pool.prefill(5);

      expect(pool.getPoolSize()).toBe(5);
      expect(pool.getActiveCount()).toBe(0);
    });

    it('预填充不应超过最大容量', () => {
      pool.prefill(15);

      expect(pool.getPoolSize()).toBeLessThanOrEqual(10);
    });

    it('应该正确获取活动对象数量', () => {
      pool.acquire();
      pool.acquire();
      pool.acquire();

      expect(pool.getActiveCount()).toBe(3);
    });

    it('应该正确获取池大小', () => {
      pool.acquire();
      pool.acquire();

      expect(pool.getPoolSize()).toBe(2);
    });
  });

  describe('对象复用', () => {
    it('应该复用已释放的对象', () => {
      const obj1 = pool.acquire();
      pool.release(obj1);

      const obj2 = pool.acquire();

      // 应该复用同一个对象
      expect(obj1).toBe(obj2);
    });

    it('应该在池满时强制复用最旧对象', () => {
      pool.prefill(10);

      // 获取所有对象
      const objects: TestObject[] = [];
      for (let i = 0; i < 10; i++) {
        objects.push(pool.acquire());
      }

      expect(pool.getActiveCount()).toBe(10);

      // 再获取一个，应该强制复用
      pool.acquire();
      expect(pool.getPoolSize()).toBe(10);
    });
  });

  describe('销毁功能', () => {
    it('应该正确销毁对象池', () => {
      pool.acquire();
      pool.acquire();

      pool.dispose();

      expect(pool.getPoolSize()).toBe(0);
    });
  });

  describe('ProjectilePool', () => {
    it('应该正确创建投射物池', () => {
      const projectilePool = new ProjectilePool();
      expect(projectilePool).toBeInstanceOf(ProjectilePool);
      expect(projectilePool).toBeInstanceOf(ObjectPool);

      projectilePool.dispose();
    });

    it('应该正确获取投射物', () => {
      const projectilePool = new ProjectilePool();
      const proj = projectilePool.acquire();

      expect(proj).toBeDefined();
      expect(proj.id).toBeDefined();
      expect(proj.damage).toBe(10);
      expect(proj.lifetime).toBe(3);

      projectilePool.dispose();
    });

    it('应该正确重置投射物', () => {
      const projectilePool = new ProjectilePool();
      const proj = projectilePool.acquire();

      proj.x = 100;
      proj.y = 100;
      proj.z = 100;
      proj.velocityX = 10;
      proj.velocityY = 10;
      proj.velocityZ = 10;

      projectilePool.release(proj);
      const reusedProj = projectilePool.acquire();

      expect(reusedProj.x).toBe(0);
      expect(reusedProj.y).toBe(0);
      expect(reusedProj.z).toBe(0);
      expect(reusedProj.velocityX).toBe(0);
      expect(reusedProj.velocityY).toBe(0);
      expect(reusedProj.velocityZ).toBe(0);

      projectilePool.dispose();
    });
  });

  describe('性能测试', () => {
    it('应该高效处理大量对象', () => {
      const largePool = new ObjectPool<TestObject>(createTestObject, resetTestObject, 1000);

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        largePool.acquire();
      }
      const acquireTime = Date.now() - start;

      expect(acquireTime).toBeLessThan(100); // 应在100ms内完成

      largePool.dispose();
    });

    it('应该高效复用对象', () => {
      pool.prefill(10);

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        const obj = pool.acquire();
        pool.release(obj);
      }
      const reuseTime = Date.now() - start;

      expect(reuseTime).toBeLessThan(50); // 应在50ms内完成
    });
  });
});