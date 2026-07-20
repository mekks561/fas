import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
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
      const cacheKey = `inventory:${userId}`;

      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug('从缓存获取背包', { userId });
        return res.json({ success: true, data: cached });
      }

      const inventory = await prisma.userInventory.findMany({
        where: { userId },
        orderBy: { acquiredAt: 'desc' },
      });

      await cacheService.set(cacheKey, inventory, 300);

      res.json({ success: true, data: inventory });
    } catch (error) {
      logger.error('获取背包错误', { error });
      next(error);
    }
  }
);

router.get(
  '/equipped',
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

      const equippedItems = await prisma.userInventory.findMany({
        where: { userId, equipped: true },
      });

      res.json({ success: true, data: equippedItems });
    } catch (error) {
      logger.error('获取已装备物品错误', { error });
      next(error);
    }
  }
);

router.post(
  '/equip/:id',
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
      const inventoryId = parseInt(id);

      const inventoryItem = await prisma.userInventory.findUnique({
        where: { id: inventoryId },
      });

      if (!inventoryItem || inventoryItem.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: '物品不存在' },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.userInventory.updateMany({
          where: { userId, itemType: inventoryItem.itemType, equipped: true },
          data: { equipped: false },
        });

        await tx.userInventory.update({
          where: { id: inventoryId },
          data: { equipped: true },
        });
      });

      await cacheService.del(`inventory:${userId}`);

      logger.info('装备物品成功', { userId, itemId: inventoryItem.itemId });

      res.json({ success: true, data: inventoryItem });
    } catch (error) {
      logger.error('装备物品错误', { error });
      next(error);
    }
  }
);

router.post(
  '/unequip/:id',
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
      const inventoryId = parseInt(id);

      const inventoryItem = await prisma.userInventory.findUnique({
        where: { id: inventoryId },
      });

      if (!inventoryItem || inventoryItem.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: '物品不存在' },
        });
      }

      await prisma.userInventory.update({
        where: { id: inventoryId },
        data: { equipped: false },
      });

      await cacheService.del(`inventory:${userId}`);

      logger.info('卸下物品成功', { userId, itemId: inventoryItem.itemId });

      res.json({ success: true, data: inventoryItem });
    } catch (error) {
      logger.error('卸下物品错误', { error });
      next(error);
    }
  }
);

router.delete(
  '/:id',
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
      const inventoryId = parseInt(id);

      const inventoryItem = await prisma.userInventory.findUnique({
        where: { id: inventoryId },
      });

      if (!inventoryItem || inventoryItem.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: '物品不存在' },
        });
      }

      await prisma.userInventory.delete({
        where: { id: inventoryId },
      });

      await cacheService.del(`inventory:${userId}`);

      logger.info('删除背包物品成功', { userId, itemId: inventoryItem.itemId });

      res.json({ success: true, message: '物品已删除' });
    } catch (error) {
      logger.error('删除背包物品错误', { error });
      next(error);
    }
  }
);

export default router;
