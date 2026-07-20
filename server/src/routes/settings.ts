import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, updateSettingsSchema } from '../middleware/validation';
import { logger } from '../middleware/logger';
import { cacheService } from '../services/cache';
import { prisma } from '../lib/prisma';

const router = Router();

const DEFAULT_SETTINGS = {
  difficulty: 'NORMAL',
  soundEnabled: true,
  musicEnabled: true,
  graphicsQuality: 'HIGH',
  fieldOfView: 75,
  sensitivity: 0.5
};

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

      logger.info('获取用户设置', { userId });

      const cached = await cacheService.get(`settings:${userId}`);
      if (cached) {
        logger.debug('从缓存获取设置', { userId });
        return res.json({
          success: true,
          data: cached
        });
      }

      const userSetting = await prisma.userSetting.findUnique({
        where: { userId }
      });

      const settings = userSetting
        ? {
            difficulty: userSetting.difficulty,
            soundEnabled: userSetting.soundEnabled,
            musicEnabled: userSetting.musicEnabled,
            graphicsQuality: userSetting.graphicsQuality,
            fieldOfView: userSetting.fieldOfView,
            sensitivity: userSetting.sensitivity
          }
        : { ...DEFAULT_SETTINGS };

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

router.put(
  '/',
  authenticate,
  validate(updateSettingsSchema),
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
      const updates = req.body;

      logger.info('更新用户设置', { userId, updates });

      await prisma.userSetting.upsert({
        where: { userId },
        update: updates,
        create: { userId, ...DEFAULT_SETTINGS, ...updates }
      });

      await cacheService.del(`settings:${userId}`);

      const settings = { ...DEFAULT_SETTINGS, ...updates };
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

router.post(
  '/reset',
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

      logger.info('重置用户设置', { userId });

      await prisma.userSetting.upsert({
        where: { userId },
        update: DEFAULT_SETTINGS,
        create: { userId, ...DEFAULT_SETTINGS }
      });

      await cacheService.del(`settings:${userId}`);
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
