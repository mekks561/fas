import { describe, beforeEach, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => ({
  prisma: {
    shopItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userInventory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    friendship: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ship: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    weapon: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    skill: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    skillProgress: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    weaponProgress: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation((callback) => callback({
      user: { update: vi.fn() },
      userInventory: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      skillProgress: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      weaponProgress: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    })),
  },
}));

vi.mock('../services/cache', () => ({
  cacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    getUser: vi.fn().mockResolvedValue(null),
    setUser: vi.fn().mockResolvedValue(undefined),
    invalidateUser: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { userId: 1 };
    next();
  },
  AuthRequest: {},
}));

vi.mock('../middleware/rateLimiter', () => ({
  actionLimiter: (req: any, res: any, next: any) => next(),
}));

import shopRoutes from '../routes/shop';
import inventoryRoutes from '../routes/inventory';
import friendRoutes from '../routes/friends';
import gameDataRoutes from '../routes/gameData';

const app = express();
app.use(express.json());
app.use('/api/shop', shopRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/game', gameDataRoutes);

describe('Shop Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/shop/items', () => {
    it('should return shop items', async () => {
      const mockItems = [
        { id: 'SHIP_001', name: '星际战斗机', price: 1000, category: 'SHIP', available: true },
        { id: 'WEAPON_001', name: '激光炮', price: 500, category: 'WEAPON', available: true },
      ];
      (prisma.shopItem.findMany as vi.Mock).mockResolvedValue(mockItems);

      const response = await request(app).get('/api/shop/items');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/shop/purchase', () => {
    it('should purchase item successfully', async () => {
      const mockItem = { id: 'SHIP_001', name: '星际战斗机', price: 1000, category: 'SHIP', available: true, itemId: 'SHIP_001' };
      const mockUser = { id: 1, username: 'test', credits: 5000 };

      (prisma.shopItem.findUnique as vi.Mock).mockResolvedValue(mockItem);
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUser);
      (prisma.userInventory.findUnique as vi.Mock).mockResolvedValue(null);

      const response = await request(app).post('/api/shop/purchase').send({ itemId: 'SHIP_001' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.remainingCredits).toBe(4000);
    });

    it('should return error when credits are insufficient', async () => {
      const mockItem = { id: 'SHIP_001', name: '星际战斗机', price: 1000, category: 'SHIP', available: true, itemId: 'SHIP_001' };
      const mockUser = { id: 1, username: 'test', credits: 500 };

      (prisma.shopItem.findUnique as vi.Mock).mockResolvedValue(mockItem);
      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockUser);

      const response = await request(app).post('/api/shop/purchase').send({ itemId: 'SHIP_001' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INSUFFICIENT_CREDITS');
    });

    it('should return validation error when itemId is missing', async () => {
      const response = await request(app).post('/api/shop/purchase').send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('Inventory Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/inventory', () => {
    it('should return user inventory', async () => {
      const mockInventory = [
        { id: 1, userId: 1, itemType: 'SHIP', itemId: 'SHIP_001', quantity: 1, equipped: true, acquiredAt: new Date() },
        { id: 2, userId: 1, itemType: 'WEAPON', itemId: 'WEAPON_001', quantity: 1, equipped: false, acquiredAt: new Date() },
      ];
      (prisma.userInventory.findMany as vi.Mock).mockResolvedValue(mockInventory);

      const response = await request(app).get('/api/inventory');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/inventory/equipped', () => {
    it('should return equipped items', async () => {
      const mockEquipped = [
        { id: 1, userId: 1, itemType: 'SHIP', itemId: 'SHIP_001', quantity: 1, equipped: true, acquiredAt: new Date() },
      ];
      (prisma.userInventory.findMany as vi.Mock).mockResolvedValue(mockEquipped);

      const response = await request(app).get('/api/inventory/equipped');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].equipped).toBe(true);
    });
  });
});

describe('Friends Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/friends', () => {
    it('should return friends list', async () => {
      const mockFriendships = [
        { userId: 1, friendId: 2, status: 'ACCEPTED', user: { id: 1, username: 'me', avatar: '', level: 5 }, friend: { id: 2, username: 'friend1', avatar: '', level: 10 } },
        { userId: 3, friendId: 1, status: 'ACCEPTED', user: { id: 3, username: 'friend2', avatar: '', level: 8 }, friend: { id: 1, username: 'me', avatar: '', level: 5 } },
      ];
      (prisma.friendship.findMany as vi.Mock).mockResolvedValue(mockFriendships);

      const response = await request(app).get('/api/friends');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/friends/request', () => {
    it('should send friend request', async () => {
      const mockFriend = { id: 2, username: 'friend1', avatar: '', level: 10 };

      (prisma.user.findUnique as vi.Mock).mockResolvedValue(mockFriend);
      (prisma.friendship.findFirst as vi.Mock).mockResolvedValue(null);

      const response = await request(app).post('/api/friends/request').send({ friendUsername: 'friend1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return error when username is invalid', async () => {
      const response = await request(app).post('/api/friends/request').send({ friendUsername: 'ab' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('Game Data Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/game/ships', () => {
    it('should return ships list', async () => {
      const mockShips = [
        { id: 'SHIP_001', name: '星际战斗机', speed: 100, armor: 50, weaponSlots: 2, price: 1000 },
      ];
      (prisma.ship.findMany as vi.Mock).mockResolvedValue(mockShips);

      const response = await request(app).get('/api/game/ships');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/game/weapons', () => {
    it('should return weapons list', async () => {
      const mockWeapons = [
        { id: 'WEAPON_001', name: '激光炮', damage: 20, fireRate: 100, range: 500, price: 500 },
      ];
      (prisma.weapon.findMany as vi.Mock).mockResolvedValue(mockWeapons);

      const response = await request(app).get('/api/game/weapons');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/game/skills', () => {
    it('should return skills list', async () => {
      const mockSkills = [
        { id: 'SKILL_001', name: '能量护盾', description: '激活能量护盾', cooldown: 10000, maxLevel: 5, price: 800 },
      ];
      (prisma.skill.findMany as vi.Mock).mockResolvedValue(mockSkills);

      const response = await request(app).get('/api/game/skills');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });
});
