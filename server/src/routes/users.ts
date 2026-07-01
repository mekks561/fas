import { Router, Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, updateUserSchema } from '../middleware/validation';
import { logger } from '../middleware/logger';
import { cacheService } from '../services/cache';

const router = Router();

/**
 * @route GET /api/users/me
 * @desc 获取当前用户信息
 * @access Private
 */
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

      // 尝试从缓存获取
      const cached = await cacheService.getUser(userId);
      if (cached) {
        logger.debug('从缓存获取用户信息', { userId });
        return res.json({
          success: true,
          data: cached
        });
      }

      // 从数据库获取
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

      const userData = {
        id: user._id,
        username: user.username,
        email: user.email,
        level: user.level,
        experience: user.experience,
        avatar: user.avatar,
        createdAt: user.createdAt
      };

      // 缓存用户信息
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

/**
 * @route PUT /api/users/me
 * @desc 更新当前用户信息
 * @access Private
 */
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

      // 检查用户名是否被占用
      if (updates.username) {
        const existingUser = await User.findOne({
          username: updates.username,
          _id: { $ne: userId }
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

      // 更新用户
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      );

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

      // 清除缓存
      await cacheService.invalidateUser(userId);

      const userData = {
        id: user._id,
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

/**
 * @route GET /api/users/:id
 * @desc 获取指定用户信息（公开信息）
 * @access Public
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const user = await User.findById(id);

      if (!user) {
        logger.warn('用户不存在', { userId: id });
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在'
          }
        });
      }

      // 只返回公开信息
      const publicData = {
        id: user._id,
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

/**
 * @route GET /api/users/:id/stats
 * @desc 获取用户游戏统计
 * @access Public
 */
router.get(
  '/:id/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // 尝试从缓存获取
      const cacheKey = `user_stats:${id}`;
      const cached = await cacheService.get(cacheKey);

      if (cached) {
        logger.debug('从缓存获取用户统计', { userId: id });
        return res.json({
          success: true,
          data: cached
        });
      }

      const user = await User.findById(id);

      if (!user) {
        logger.warn('用户不存在', { userId: id });
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在'
          }
        });
      }

      // 返回用户等级和经验
      const stats = {
        userId: user._id,
        username: user.username,
        level: user.level,
        experience: user.experience,
        // 可以从Leaderboard聚合获取更多统计
        // 这里简化处理
      };

      // 缓存5分钟
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
