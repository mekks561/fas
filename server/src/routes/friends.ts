import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, friendRequestSchema } from '../middleware/validation';
import { logger } from '../middleware/logger';
import { cacheService } from '../services/cache';

const router = Router();

router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: '未认证' },
        });
      }

      const userId = req.user.userId;
      const cacheKey = `friends:${userId}`;

      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug('从缓存获取好友列表', { userId });
        return res.json({ success: true, data: cached });
      }

      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [{ userId }, { friendId: userId }],
          status: 'ACCEPTED',
        },
        include: {
          user: { select: { id: true, username: true, avatar: true, level: true } },
          friend: { select: { id: true, username: true, avatar: true, level: true } },
        },
      });

      const friends = friendships.map((fs) =>
        fs.userId === userId ? fs.friend : fs.user
      );

      await cacheService.set(cacheKey, friends, 300);

      res.json({ success: true, data: friends });
    } catch (error) {
      logger.error('获取好友列表错误', { error });
      next(error);
    }
  }
);

router.get(
  '/pending',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: '未认证' },
        });
      }

      const userId = req.user.userId;

      const pendingRequests = await prisma.friendship.findMany({
        where: { friendId: userId, status: 'PENDING' },
        include: {
          user: { select: { id: true, username: true, avatar: true, level: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const requests = pendingRequests.map((fs) => ({
        id: fs.id,
        user: fs.user,
        createdAt: fs.createdAt,
      }));

      res.json({ success: true, data: requests });
    } catch (error) {
      logger.error('获取待处理请求错误', { error });
      next(error);
    }
  }
);

router.post(
  '/request',
  authenticate,
  validate(friendRequestSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: '未认证' },
        });
      }

      const userId = req.user.userId;
      const { friendUsername } = req.body;

      if (!friendUsername) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PARAMS', message: '请提供好友用户名' },
        });
      }

      const friend = await prisma.user.findUnique({
        where: { username: friendUsername },
      });

      if (!friend) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: '用户不存在' },
        });
      }

      if (friend.id === userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'SELF_REQUEST', message: '不能添加自己为好友' },
        });
      }

      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userId, friendId: friend.id },
            { userId: friend.id, friendId: userId },
          ],
        },
      });

      if (existing) {
        let message = '';
        switch (existing.status) {
          case 'PENDING':
            message = existing.userId === userId ? '请求已发送' : '等待对方确认';
            break;
          case 'ACCEPTED':
            message = '已是好友';
            break;
          case 'BLOCKED':
            message = '对方已被拉黑';
            break;
        }
        return res.status(400).json({
          success: false,
          error: { code: 'ALREADY_FRIENDS', message },
        });
      }

      await prisma.friendship.create({
        data: { userId, friendId: friend.id, status: 'PENDING' },
      });

      await cacheService.del(`friends:${userId}`);
      await cacheService.del(`friends:${friend.id}`);

      logger.info('发送好友请求', { userId, friendId: friend.id });

      res.json({ success: true, message: '好友请求已发送' });
    } catch (error) {
      logger.error('发送好友请求错误', { error });
      next(error);
    }
  }
);

router.post(
  '/accept/:id',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: '未认证' },
        });
      }

      const userId = req.user.userId;
      const { id } = req.params;
      const friendshipId = parseInt(id);

      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
        include: { user: { select: { id: true, username: true } } },
      });

      if (!friendship || friendship.friendId !== userId || friendship.status !== 'PENDING') {
        return res.status(404).json({
          success: false,
          error: { code: 'REQUEST_NOT_FOUND', message: '请求不存在' },
        });
      }

      await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: 'ACCEPTED' },
      });

      await cacheService.del(`friends:${userId}`);
      await cacheService.del(`friends:${friendship.userId}`);

      logger.info('接受好友请求', { userId, friendId: friendship.userId });

      res.json({
        success: true,
        data: {
          user: friendship.user,
          message: '好友添加成功',
        },
      });
    } catch (error) {
      logger.error('接受好友请求错误', { error });
      next(error);
    }
  }
);

router.post(
  '/reject/:id',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: '未认证' },
        });
      }

      const userId = req.user.userId;
      const { id } = req.params;
      const friendshipId = parseInt(id);

      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });

      if (!friendship || friendship.friendId !== userId || friendship.status !== 'PENDING') {
        return res.status(404).json({
          success: false,
          error: { code: 'REQUEST_NOT_FOUND', message: '请求不存在' },
        });
      }

      await prisma.friendship.delete({
        where: { id: friendshipId },
      });

      logger.info('拒绝好友请求', { userId, friendId: friendship.userId });

      res.json({ success: true, message: '请求已拒绝' });
    } catch (error) {
      logger.error('拒绝好友请求错误', { error });
      next(error);
    }
  }
);

router.delete(
  '/:friendId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: '未认证' },
        });
      }

      const userId = req.user.userId;
      const { friendId } = req.params;
      const targetFriendId = parseInt(friendId);

      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userId, friendId: targetFriendId },
            { userId: targetFriendId, friendId: userId },
          ],
        },
      });

      if (!friendship) {
        return res.status(404).json({
          success: false,
          error: { code: 'FRIEND_NOT_FOUND', message: '好友不存在' },
        });
      }

      await prisma.friendship.delete({
        where: { id: friendship.id },
      });

      await cacheService.del(`friends:${userId}`);
      await cacheService.del(`friends:${targetFriendId}`);

      logger.info('删除好友', { userId, friendId: targetFriendId });

      res.json({ success: true, message: '好友已删除' });
    } catch (error) {
      logger.error('删除好友错误', { error });
      next(error);
    }
  }
);

export default router;
