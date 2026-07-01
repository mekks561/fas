import {
  Achievement,
  achievementService,
  ACHIEVEMENTS
} from '../services/achievement';

vi.mock('mongoose', () => {
  const mockSchema = vi.fn().mockImplementation((def: any, options?: any) => ({
    Types: {
      ObjectId: 'ObjectId'
    }
  }));
  
  return {
    default: {
      model: vi.fn().mockReturnValue({
        findOne: vi.fn(),
        create: vi.fn()
      }),
      Types: {
        ObjectId: vi.fn((id: string) => id)
      }
    },
    Document: class {},
    Schema: mockSchema
  };
});

vi.mock('../services/cache', () => ({
  cacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(true)
  }
}));

describe('AchievementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserAchievements', () => {
    it('should return merged achievements list', async () => {
      const mockUserId = '123456';
      const mockUnlockedAchievements = [
        {
          id: 'first_kill',
          name: '首杀',
          description: '击杀一个敌人',
          unlockedAt: new Date('2024-01-01')
        }
      ];

      (Achievement.findOne as vi.Mock).mockResolvedValue({
        achievements: mockUnlockedAchievements
      });

      const result = await achievementService.getUserAchievements(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      const firstKill = result.find((a: { id: string }) => a.id === 'first_kill');
      expect(firstKill?.unlocked).toBe(true);
    });

    it('should create new achievement record if none exists', async () => {
      const mockUserId = '789012';

      (Achievement.findOne as vi.Mock).mockResolvedValue(null);
      (Achievement.create as vi.Mock).mockResolvedValue({
        userId: mockUserId,
        achievements: []
      });

      const result = await achievementService.getUserAchievements(mockUserId);

      expect(Achievement.create).toHaveBeenCalledWith({
        userId: mockUserId,
        achievements: []
      });
      expect(result).toBeInstanceOf(Array);
    });
  });

  describe('unlockAchievement', () => {
    it('should unlock achievement successfully', async () => {
      const mockUserId = '123456';
      const achievementId = 'first_kill';

      (Achievement.findOne as vi.Mock).mockResolvedValue({
        userId: mockUserId,
        achievements: [],
        save: vi.fn().mockResolvedValue(true)
      });

      const result = await achievementService.unlockAchievement(
        mockUserId,
        achievementId
      );

      expect(result.success).toBe(true);
      expect(result.achievement).toBeDefined();
    });

    it('should return already unlocked for duplicate unlock', async () => {
      const mockUserId = '123456';
      const achievementId = 'first_kill';

      (Achievement.findOne as vi.Mock).mockResolvedValue({
        userId: mockUserId,
        achievements: [
          {
            id: 'first_kill',
            name: '首杀',
            description: '击杀一个敌人',
            unlockedAt: new Date()
          }
        ]
      });

      const result = await achievementService.unlockAchievement(
        mockUserId,
        achievementId
      );

      expect(result.success).toBe(true);
      expect(result.alreadyUnlocked).toBe(true);
    });

    it('should return failure for invalid achievement id', async () => {
      const mockUserId = '123456';
      const achievementId = 'invalid_achievement';

      const result = await achievementService.unlockAchievement(
        mockUserId,
        achievementId
      );

      expect(result.success).toBe(false);
    });
  });

  describe('getAchievementStats', () => {
    it('should return correct statistics', async () => {
      const mockUserId = '123456';

      (Achievement.findOne as vi.Mock).mockResolvedValue({
        achievements: [
          { id: 'first_kill', name: '首杀', unlockedAt: new Date() },
          { id: 'kill_10', name: '初露锋芒', unlockedAt: new Date() }
        ]
      });

      const stats = await achievementService.getAchievementStats(mockUserId);

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('unlocked');
      expect(stats).toHaveProperty('locked');
      expect(stats).toHaveProperty('percentage');
      expect(stats.total).toBe(Object.keys(ACHIEVEMENTS).length);
      expect(stats.unlocked).toBe(2);
    });
  });

  describe('ACHIEVEMENTS constant', () => {
    it('should have all required achievement definitions', () => {
      const requiredAchievements = [
        'first_kill',
        'kill_100',
        'wave_10',
        'score_10000',
        'level_5'
      ];

      requiredAchievements.forEach(id => {
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