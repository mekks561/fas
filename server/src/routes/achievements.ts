import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, unlockAchievementSchema } from '../middleware/validation';
import { logger } from '../middleware/logger';
import { achievementService } from '../services/achievement';

const router = Router();

/**
 * @route GET /api/achievements
 * @desc 获取用户成就列表
 * @access Private
 */
router.get(
  '/',
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

      logger.info('获取用户成就', { userId });

      const achievements = await achievementService.getUserAchievements(userId);

      logger.info('成就获取成功', { userId, count: achievements.length });

      res.json({
        success: true,
        data: {
          achievements
        }
      });
    } catch (error) {
      logger.error('获取成就错误', { error });
      next(error);
    }
  }
);

/**
 * @route POST /api/achievements/unlock
 * @desc 解锁成就
 * @access Private
 */
router.post(
  '/unlock',
  authenticate,
  validate(unlockAchievementSchema),
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
      const { achievementId } = req.body;

      logger.info('解锁成就', { userId, achievementId });

      const result = await achievementService.unlockAchievement(
        userId,
        achievementId
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ACHIEVEMENT',
            message: '无效的成就ID'
          }
        });
      }

      if (result.alreadyUnlocked) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ALREADY_UNLOCKED',
            message: '该成就已经解锁'
          }
        });
      }

      logger.info('成就解锁成功', { userId, achievementId });

      res.status(201).json({
        success: true,
        data: {
          achievement: result.achievement
        }
      });
    } catch (error) {
      logger.error('解锁成就错误', { error });
      next(error);
    }
  }
);

/**
 * @route GET /api/achievements/stats
 * @desc 获取用户成就统计
 * @access Private
 */
router.get(
  '/stats',
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

      logger.info('获取成就统计', { userId });

      const stats = await achievementService.getAchievementStats(userId);

      logger.info('成就统计获取成功', { userId, stats });

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('获取成就统计错误', { error });
      next(error);
    }
  }
);

export default router;
