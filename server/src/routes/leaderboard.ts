import { Router, Request, Response, NextFunction } from 'express';
import { Leaderboard } from '../models/Leaderboard';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, submitScoreSchema } from '../middleware/validation';
import { logger } from '../middleware/logger';
import { cacheService } from '../services/cache';
import { achievementService } from '../services/achievement';

const router = Router();

/**
 * @route GET /api/leaderboard
 * @desc 获取排行榜
 * @access Public
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const difficulty = req.query.difficulty as string;

      logger.info('获取排行榜', { page, limit, difficulty });

      // 尝试从缓存获取
      const cached = await cacheService.getLeaderboard(page, difficulty);
      if (cached) {
        logger.debug('从缓存获取排行榜', { page, difficulty });
        return res.json(cached);
      }

      // 构建查询条件
      const query: { difficulty?: string } = {};
      if (difficulty) {
        query.difficulty = difficulty;
      }

      // 使用聚合查询优化性能
      const skip = (page - 1) * limit;

      const [entries, total] = await Promise.all([
        Leaderboard.aggregate([
          { $match: query },
          { $sort: { score: -1, date: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              username: 1,
              score: 1,
              level: 1,
              wave: 1,
              kills: 1,
              difficulty: 1,
              date: 1
            }
          }
        ]),
        Leaderboard.countDocuments(query)
      ]);

      // 添加排名
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

      // 缓存结果（5分钟）
      await cacheService.setLeaderboard(page, result, difficulty);

      logger.info('排行榜获取成功', { page, total });

      res.json(result);
    } catch (error) {
      logger.error('获取排行榜错误', { error });
      next(error);
    }
  }
);

/**
 * @route GET /api/leaderboard/my-rank
 * @desc 获取当前用户排名
 * @access Private
 */
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

      // 获取用户最佳成绩
      const bestEntry = await Leaderboard.findOne({ userId })
        .sort({ score: -1 })
        .lean();

      if (!bestEntry) {
        return res.json({
          success: true,
          data: {
            rank: null,
            entry: null
          }
        });
      }

      // 计算排名（优化：使用聚合）
      const rankResult = await Leaderboard.aggregate([
        {
          $match: {
            score: { $gt: bestEntry.score }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ]);

      const rank = (rankResult[0]?.count || 0) + 1;

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

/**
 * @route POST /api/leaderboard
 * @desc 提交分数
 * @access Private
 */
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

      // 获取用户
      const user = await User.findById(userId);

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

      // 创建排行榜条目
      const entry = new Leaderboard({
        userId,
        username: user.username,
        score,
        level,
        wave,
        kills: kills || 0,
        gameDuration: gameDuration || 0,
        difficulty: difficulty || 'NORMAL'
      });

      await entry.save();

      // 计算排名
      const rankResult = await Leaderboard.aggregate([
        {
          $match: {
            score: { $gt: score }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ]);

      const rank = (rankResult[0]?.count || 0) + 1;
      const totalPlayers = await Leaderboard.countDocuments();

      // 清除排行榜缓存
      await cacheService.invalidateLeaderboard();

      // 检查并解锁成就
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
            ...entry.toObject(),
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

/**
 * @route GET /api/leaderboard/stats
 * @desc 获取排行榜统计信息
 * @access Public
 */
router.get(
  '/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 尝试从缓存获取
      const cacheKey = 'leaderboard:stats';
      const cached = await cacheService.get(cacheKey);

      if (cached) {
        logger.debug('从缓存获取排行榜统计');
        return res.json(cached);
      }

      // 聚合统计
      const stats = await Leaderboard.aggregate([
        {
          $group: {
            _id: null,
            totalGames: { $sum: 1 },
            totalScore: { $sum: '$score' },
            avgScore: { $avg: '$score' },
            maxScore: { $max: '$score' },
            totalKills: { $sum: '$kills' },
            avgKills: { $avg: '$kills' }
          }
        },
        {
          $project: {
            _id: 0,
            totalGames: 1,
            totalScore: 1,
            avgScore: { $round: ['$avgScore', 2] },
            maxScore: 1,
            totalKills: 1,
            avgKills: { $round: ['$avgKills', 2] }
          }
        }
      ]);

      // 获取今日游戏数
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayGames = await Leaderboard.countDocuments({
        date: { $gte: today }
      });

      const result = {
        success: true,
        data: {
          ...(stats[0] || {}),
          todayGames
        }
      };

      // 缓存10分钟
      await cacheService.set(cacheKey, result, 600);

      res.json(result);
    } catch (error) {
      logger.error('获取排行榜统计错误', { error });
      next(error);
    }
  }
);

export default router;
