import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, submitScoreSchema } from '../middleware/validation';
import { logger } from '../middleware/logger';
import { cacheService } from '../services/cache';
import { achievementService } from '../services/achievement';

const router = Router();

router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const difficulty = req.query.difficulty as string;

      logger.info('获取排行榜', { page, limit, difficulty });

      const cached = await cacheService.getLeaderboard(page, difficulty);
      if (cached) {
        logger.debug('从缓存获取排行榜', { page, difficulty });
        return res.json(cached);
      }

      const query: { difficulty?: string } = {};
      if (difficulty) {
        query.difficulty = difficulty;
      }

      const skip = (page - 1) * limit;

      const [entries, total] = await Promise.all([
        prisma.leaderboard.findMany({
          where: query,
          orderBy: [{ score: 'desc' }, { date: 'desc' }],
          skip,
          take: limit,
          select: {
            id: true,
            username: true,
            score: true,
            level: true,
            wave: true,
            kills: true,
            difficulty: true,
            date: true,
            createdAt: true,
          }
        }),
        prisma.leaderboard.count({ where: query })
      ]);

      const rankedEntries = entries.map((entry, index) => ({
        rank: skip + index + 1,
        ...entry
      }));

      const result = {
        success: true,
        data: {
          entries: rankedEntries,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };

      await cacheService.setLeaderboard(page, result, difficulty);

      logger.info('排行榜获取成功', { page, total });

      res.json(result);
    } catch (error) {
      logger.error('获取排行榜错误', { error });
      next(error);
    }
  }
);

router.get(
  '/my-rank',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: '未认证'
          }
        });
      }
      const userId = req.user.userId;

      logger.info('获取用户排名', { userId });

      const bestEntry = await prisma.leaderboard.findFirst({
        where: { userId },
        orderBy: { score: 'desc' }
      });

      if (!bestEntry) {
        return res.json({
          success: true,
          data: {
            rank: null,
            entry: null
          }
        });
      }

      const higherCount = await prisma.leaderboard.count({
        where: { score: { gt: bestEntry.score } }
      });

      const rank = higherCount + 1;

      logger.info('用户排名获取成功', { userId, rank });

      res.json({
        success: true,
        data: {
          rank,
          entry: {
            ...bestEntry,
            rank
          }
        }
      });
    } catch (error) {
      logger.error('获取用户排名错误', { error });
      next(error);
    }
  }
);

router.post(
  '/',
  authenticate,
  validate(submitScoreSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: '未认证'
          }
        });
      }
      const userId = req.user.userId;
      const { score, level, wave, kills, gameDuration, difficulty } = req.body;

      logger.info('提交分数', { userId, score, level, wave });

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        logger.warn('用户不存在', { userId });
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在'
          }
        });
      }

      const entry = await prisma.leaderboard.create({
        data: {
          userId,
          username: user.username,
          score,
          level,
          wave,
          kills: kills || 0,
          gameDuration: gameDuration || 0,
          difficulty: difficulty || 'NORMAL'
        }
      });

      const higherCount = await prisma.leaderboard.count({
        where: { score: { gt: score } }
      });

      const rank = higherCount + 1;
      const totalPlayers = await prisma.leaderboard.count();

      await cacheService.invalidateLeaderboard();

      const unlockedAchievements = await achievementService.checkAndUnlockAchievements(
        userId,
        { maxScore: score, maxWave: wave, kills, maxLevel: level }
      );

      logger.info('分数提交成功', { userId, score, rank, unlockedAchievements });

      res.status(201).json({
        success: true,
        data: {
          rank,
          totalPlayers,
          entry: {
            ...entry,
            rank
          },
          achievements: unlockedAchievements
        }
      });
    } catch (error) {
      logger.error('提交分数错误', { error });
      next(error);
    }
  }
);

router.get(
  '/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cacheKey = 'leaderboard:stats';
      const cached = await cacheService.get(cacheKey);

      if (cached) {
        logger.debug('从缓存获取排行榜统计');
        return res.json(cached);
      }

      const stats = await prisma.leaderboard.aggregate({
        _sum: { score: true, kills: true },
        _avg: { score: true, kills: true },
        _max: { score: true },
        _count: true
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayGames = await prisma.leaderboard.count({
        where: { date: { gte: today } }
      });

      const result = {
        success: true,
        data: {
          totalGames: stats._count,
          totalScore: stats._sum.score || 0,
          avgScore: Math.round((stats._avg.score || 0) * 100) / 100,
          maxScore: stats._max.score || 0,
          totalKills: stats._sum.kills || 0,
          avgKills: Math.round((stats._avg.kills || 0) * 100) / 100,
          todayGames
        }
      };

      await cacheService.set(cacheKey, result, 600);

      res.json(result);
    } catch (error) {
      logger.error('获取排行榜统计错误', { error });
      next(error);
    }
  }
);

export default router;
