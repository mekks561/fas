import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, updateUserSchema } from '../middleware/validation';
import { logger } from '../middleware/logger';
import { cacheService } from '../services/cache';

const router = Router();

router.get(
  '/me',
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

      const cached = await cacheService.getUser(userId);
      if (cached) {
        logger.debug('从缓存获取用户信息', { userId });
        return res.json({
          success: true,
          data: cached
        });
      }

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

      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        level: user.level,
        experience: user.experience,
        avatar: user.avatar,
        createdAt: user.createdAt
      };

      await cacheService.setUser(userId, userData);

      logger.info('获取用户信息成功', { userId });

      res.json({
        success: true,
        data: userData
      });
    } catch (error) {
      logger.error('获取用户信息错误', { error });
      next(error);
    }
  }
);

router.put(
  '/me',
  authenticate,
  validate(updateUserSchema),
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

      logger.info('更新用户信息', { userId, updates });

      if (updates.username) {
        const existingUser = await prisma.user.findFirst({
          where: {
            username: updates.username,
            id: { not: userId }
          }
        });

        if (existingUser) {
          logger.warn('用户名已被占用', { userId, username: updates.username });
          return res.status(400).json({
            success: false,
            error: {
              code: 'USERNAME_EXISTS',
              message: '用户名已被占用'
            }
          });
        }
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: updates,
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

      await cacheService.invalidateUser(userId);

      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        level: user.level,
        experience: user.experience,
        avatar: user.avatar,
        createdAt: user.createdAt
      };

      logger.info('用户信息更新成功', { userId });

      res.json({
        success: true,
        data: userData
      });
    } catch (error) {
      logger.error('更新用户信息错误', { error });
      next(error);
    }
  }
);

router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

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

      const publicData = {
        id: user.id,
        username: user.username,
        level: user.level,
        avatar: user.avatar
      };

      res.json({
        success: true,
        data: publicData
      });
    } catch (error) {
      logger.error('获取用户信息错误', { error });
      next(error);
    }
  }
);

router.get(
  '/:id/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      const cacheKey = `user_stats:${userId}`;
      const cached = await cacheService.get(cacheKey);

      if (cached) {
        logger.debug('从缓存获取用户统计', { userId });
        return res.json({
          success: true,
          data: cached
        });
      }

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

      const stats = {
        userId: user.id,
        username: user.username,
        level: user.level,
        experience: user.experience,
      };

      await cacheService.set(cacheKey, stats, 300);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('获取用户统计错误', { error });
      next(error);
    }
  }
);

export default router;
