import { describe, beforeEach, it, expect, vi, type Mock } from 'vitest';
import { achievementService, ACHIEVEMENTS } from '../services/achievement';

vi.mock('../lib/prisma', () => ({
  prisma: {
    achievement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../services/cache', () => ({
  cacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  },
}));

import { prisma } from '../lib/prisma';

describe('AchievementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserAchievements', () => {
    it('should return merged achievements list', async () => {
      const mockUserId = 1;

      (prisma.achievement.findMany as Mock).mockResolvedValue([
        {
          id: 1,
          userId: mockUserId,
          achievementId: 'first_kill',
          name: '首杀',
          description: '击杀一个敌人',
          unlockedAt: new Date('2024-01-01'),
        },
      ]);

      const result = await achievementService.getUserAchievements(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      const firstKill = result.find((a) => a.id === 'first_kill');
      expect(firstKill?.unlocked).toBe(true);
    });

    it('should return all achievements with unlocked flag false when none unlocked', async () => {
      const mockUserId = 2;

      (prisma.achievement.findMany as Mock).mockResolvedValue([]);

      const result = await achievementService.getUserAchievements(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(Object.keys(ACHIEVEMENTS).length);
      expect(result.every((a) => a.unlocked === false)).toBe(true);
    });
  });

  describe('unlockAchievement', () => {
    it('should unlock achievement successfully', async () => {
      const mockUserId = 1;
      const achievementId = 'first_kill';
      const now = new Date();

      (prisma.achievement.findUnique as Mock).mockResolvedValue(null);
      (prisma.achievement.create as Mock).mockResolvedValue({
        id: 1,
        userId: mockUserId,
        achievementId,
        name: '首杀',
        description: '击杀一个敌人',
        unlockedAt: now,
      });

      const result = await achievementService.unlockAchievement(mockUserId, achievementId);

      expect(result.success).toBe(true);
      expect(result.achievement).toBeDefined();
      expect(result.alreadyUnlocked).toBeUndefined();
    });

    it('should return already unlocked for duplicate unlock', async () => {
      const mockUserId = 1;
      const achievementId = 'first_kill';

      (prisma.achievement.findUnique as Mock).mockResolvedValue({
        id: 1,
        userId: mockUserId,
        achievementId,
        name: '首杀',
        description: '击杀一个敌人',
        unlockedAt: new Date(),
      });

      const result = await achievementService.unlockAchievement(mockUserId, achievementId);

      expect(result.success).toBe(true);
      expect(result.alreadyUnlocked).toBe(true);
    });

    it('should return failure for invalid achievement id', async () => {
      const mockUserId = 1;
      const achievementId = 'invalid_achievement';

      const result = await achievementService.unlockAchievement(mockUserId, achievementId);

      expect(result.success).toBe(false);
    });
  });

  describe('getAchievementStats', () => {
    it('should return correct statistics', async () => {
      const mockUserId = 1;

      (prisma.achievement.findMany as Mock).mockResolvedValue([
        { id: 1, userId: mockUserId, achievementId: 'first_kill', name: '首杀', description: '', unlockedAt: new Date() },
        { id: 2, userId: mockUserId, achievementId: 'kill_10', name: '初露锋芒', description: '', unlockedAt: new Date() },
      ]);

      const stats = await achievementService.getAchievementStats(mockUserId);

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('unlocked');
      expect(stats).toHaveProperty('locked');
      expect(stats).toHaveProperty('percentage');
      expect(stats.total).toBe(Object.keys(ACHIEVEMENTS).length);
      expect(stats.unlocked).toBe(2);
      expect(stats.locked).toBe(stats.total - 2);
    });
  });

  describe('ACHIEVEMENTS constant', () => {
    it('should have all required achievement definitions', () => {
      const requiredAchievements = ['first_kill', 'kill_100', 'wave_10', 'score_10000', 'level_5'];

      requiredAchievements.forEach((id) => {
        expect(ACHIEVEMENTS).toHaveProperty(id);
        const achievement = ACHIEVEMENTS[id as keyof typeof ACHIEVEMENTS];
        expect(achievement).toHaveProperty('id');
        expect(achievement).toHaveProperty('name');
        expect(achievement).toHaveProperty('description');
        expect(achievement).toHaveProperty('condition');
      });
    });
  });
});
