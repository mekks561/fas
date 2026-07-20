import { cacheService } from './cache';
import { prisma } from '../lib/prisma';

interface GameStats {
  kills?: number;
  maxWave?: number;
  maxScore?: number;
  maxLevel?: number;
  gamesPlayed?: number;
  gamesWon?: number;
}

interface UnlockedAchievementRecord {
  id: string;
  name: string;
  description: string;
  unlockedAt: Date;
}

interface UserAchievement {
  id: string;
  name: string;
  description: string;
  condition: (stats: GameStats) => boolean;
  unlocked: boolean;
  unlockedAt: Date | null;
}

interface AchievementStats {
  total: number;
  unlocked: number;
  locked: number;
  percentage: number;
}

export const ACHIEVEMENTS = {
  first_kill: {
    id: 'first_kill',
    name: '首杀',
    description: '击杀一个敌人',
    condition: (stats: GameStats) => (stats.kills ?? 0) >= 1
  },
  kill_10: {
    id: 'kill_10',
    name: '初露锋芒',
    description: '累计击杀10个敌人',
    condition: (stats: GameStats) => (stats.kills ?? 0) >= 10
  },
  kill_100: {
    id: 'kill_100',
    name: '百人斩',
    description: '累计击杀100个敌人',
    condition: (stats: GameStats) => (stats.kills ?? 0) >= 100
  },
  kill_1000: {
    id: 'kill_1000',
    name: '千人斩',
    description: '累计击杀1000个敌人',
    condition: (stats: GameStats) => (stats.kills ?? 0) >= 1000
  },
  wave_10: {
    id: 'wave_10',
    name: '波次达人',
    description: '到达第10波',
    condition: (stats: GameStats) => (stats.maxWave ?? 0) >= 10
  },
  wave_50: {
    id: 'wave_50',
    name: '波次大师',
    description: '到达第50波',
    condition: (stats: GameStats) => (stats.maxWave ?? 0) >= 50
  },
  score_10000: {
    id: 'score_10000',
    name: '万分大师',
    description: '单局得分超过10000',
    condition: (stats: GameStats) => (stats.maxScore ?? 0) >= 10000
  },
  score_50000: {
    id: 'score_50000',
    name: '五万荣耀',
    description: '单局得分超过50000',
    condition: (stats: GameStats) => (stats.maxScore ?? 0) >= 50000
  },
  score_100000: {
    id: 'score_100000',
    name: '十万传奇',
    description: '单局得分超过100000',
    condition: (stats: GameStats) => (stats.maxScore ?? 0) >= 100000
  },
  level_5: {
    id: 'level_5',
    name: '升级专家',
    description: '角色等级达到5级',
    condition: (stats: GameStats) => (stats.maxLevel ?? 0) >= 5
  },
  level_10: {
    id: 'level_10',
    name: '升级大师',
    description: '角色等级达到10级',
    condition: (stats: GameStats) => (stats.maxLevel ?? 0) >= 10
  },
  games_10: {
    id: 'games_10',
    name: '常客',
    description: '累计游玩10次',
    condition: (stats: GameStats) => (stats.gamesPlayed ?? 0) >= 10
  },
  games_100: {
    id: 'games_100',
    name: '资深玩家',
    description: '累计游玩100次',
    condition: (stats: GameStats) => (stats.gamesPlayed ?? 0) >= 100
  },
  win_1: {
    id: 'win_1',
    name: '首胜',
    description: '赢得第一场游戏',
    condition: (stats: GameStats) => (stats.gamesWon ?? 0) >= 1
  },
  win_10: {
    id: 'win_10',
    name: '连胜达人',
    description: '累计赢得10场游戏',
    condition: (stats: GameStats) => (stats.gamesWon ?? 0) >= 10
  }
};

export class AchievementService {
  async getUserAchievements(userId: number): Promise<UserAchievement[]> {
    const cached = await cacheService.get<UserAchievement[]>(`achievements:${userId}`);
    if (cached) {
      return cached;
    }

    const userAchievements = await prisma.achievement.findMany({
      where: { userId }
    });

    const unlockedMap = new Map(
      userAchievements.map(a => [a.achievementId, a])
    );

    const result = Object.values(ACHIEVEMENTS).map(achievement => ({
      ...achievement,
      unlocked: unlockedMap.has(achievement.id),
      unlockedAt: unlockedMap.get(achievement.id)?.unlockedAt || null
    }));

    await cacheService.set(`achievements:${userId}`, result, 300);

    return result;
  }

  async unlockAchievement(
    userId: number,
    achievementId: string
  ): Promise<{ success: boolean; achievement?: UnlockedAchievementRecord; alreadyUnlocked?: boolean }> {
    const achievementDef = ACHIEVEMENTS[achievementId as keyof typeof ACHIEVEMENTS];
    if (!achievementDef) {
      return { success: false };
    }

    const existing = await prisma.achievement.findUnique({
      where: { userId_achievementId: { userId, achievementId } }
    });

    if (existing) {
      return { success: true, alreadyUnlocked: true };
    }

    const unlockedAt = new Date();

    const achievement = await prisma.achievement.create({
      data: {
        userId,
        achievementId,
        name: achievementDef.name,
        description: achievementDef.description,
        unlockedAt
      }
    });

    await cacheService.del(`achievements:${userId}`);

    return {
      success: true,
      achievement: {
        id: achievement.achievementId,
        name: achievement.name,
        description: achievement.description,
        unlockedAt: achievement.unlockedAt as Date
      }
    };
  }

  async checkAndUnlockAchievements(userId: number, _gameStats: GameStats): Promise<string[]> {
    const unlockedIds: string[] = [];

    for (const [id] of Object.entries(ACHIEVEMENTS)) {
      const result = await this.unlockAchievement(userId, id);
      if (result.success && result.achievement) {
        unlockedIds.push(id);
      }
    }

    return unlockedIds;
  }

  async getAchievementStats(userId: number): Promise<AchievementStats> {
    const achievements = await this.getUserAchievements(userId);

    const total = achievements.length;
    const unlocked = achievements.filter((a: { unlocked: boolean }) => a.unlocked).length;

    return {
      total,
      unlocked,
      locked: total - unlocked,
      percentage: Math.round((unlocked / total) * 100)
    };
  }
}

export const achievementService = new AchievementService();
