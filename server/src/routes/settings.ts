import { Router, Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, updateSettingsSchema } from '../middleware/validation';
import { logger } from '../middleware/logger';
import { cacheService } from '../services/cache';

const router = Router();

// 默认设置
const DEFAULT_SETTINGS = {
  difficulty: 'NORMAL',
  soundEnabled: true,
  musicEnabled: true,
  graphicsQuality: 'HIGH',
  fieldOfView: 75,
  sensitivity: 0.5
};

/**
 * @route GET /api/settings
 * @desc 获取用户设置
 * @access Private
 */
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      logger.info('获取用户设置', { userId });

      // 尝试从缓存获取
      const cached = await cacheService.get(`settings:${userId}`);
      if (cached) {
        logger.debug('从缓存获取设置', { userId });
        return res.json({
          success: true,
          data: cached
        });
      }

      // TODO: 从数据库获取用户设置
      // 这里简化处理，返回默认设置
      const settings = { ...DEFAULT_SETTINGS };

      // 缓存设置
      await cacheService.set(`settings:${userId}`, settings, 600);

      logger.info('设置获取成功', { userId });

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('获取设置错误', { error });
      next(error);
    }
  }
);

/**
 * @route PUT /api/settings
 * @desc 更新用户设置
 * @access Private
 */
router.put(
  '/',
  authenticate,
  validate(updateSettingsSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const updates = req.body;

      logger.info('更新用户设置', { userId, updates });

      // TODO: 保存到数据库
      // 这里简化处理，返回更新后的设置
      const settings = {
        ...DEFAULT_SETTINGS,
        ...updates
      };

      // 清除缓存
      await cacheService.del(`settings:${userId}`);

      // 缓存新设置
      await cacheService.set(`settings:${userId}`, settings, 600);

      logger.info('设置更新成功', { userId });

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('更新设置错误', { error });
      next(error);
    }
  }
);

/**
 * @route POST /api/settings/reset
 * @desc 重置设置
 * @access Private
 */
router.post(
  '/reset',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      logger.info('重置用户设置', { userId });

      // 清除缓存
      await cacheService.del(`settings:${userId}`);

      // 缓存默认设置
      await cacheService.set(`settings:${userId}`, DEFAULT_SETTINGS, 600);

      logger.info('设置重置成功', { userId });

      res.json({
        success: true,
        data: DEFAULT_SETTINGS
      });
    } catch (error) {
      logger.error('重置设置错误', { error });
      next(error);
    }
  }
);

export default router;
