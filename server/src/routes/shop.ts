import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, purchaseSchema } from '../middleware/validation';
import { actionLimiter } from '../middleware/rateLimiter';
import { logger } from '../middleware/logger';
import { cacheService } from '../services/cache';

const router = Router();

router.get(
  '/items',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cached = await cacheService.get('shop_items');
      if (cached) {
        logger.debug('从缓存获取商店物品');
        return res.json({ success: true, data: cached });
      }

      const category = req.query.category as string;
      const items = await prisma.shopItem.findMany({
        where: {
          available: true,
          ...(category && { category }),
        },
        orderBy: { price: 'asc' },
      });

      await cacheService.set('shop_items', items, 600);

      res.json({ success: true, data: items });
    } catch (error) {
      logger.error('获取商店物品错误', { error });
      next(error);
    }
  }
);

router.get(
  '/items/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const item = await prisma.shopItem.findUnique({
        where: { id },
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: '物品不存在' },
        });
      }

      res.json({ success: true, data: item });
    } catch (error) {
      logger.error('获取商店物品详情错误', { error });
      next(error);
    }
  }
);

router.post(
  '/purchase',
  authenticate,
  actionLimiter,
  validate(purchaseSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: '未认证' },
        });
      }

      const userId = req.user.userId;
      const { itemId } = req.body;

      const shopItem = await prisma.shopItem.findUnique({
        where: { id: itemId },
      });

      if (!shopItem || !shopItem.available) {
        return res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: '物品不存在或已下架' },
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: '用户不存在' },
        });
      }

      if (user.credits < shopItem.price) {
        return res.status(400).json({
          success: false,
          error: { code: 'INSUFFICIENT_CREDITS', message: '金币不足' },
        });
      }

      const existingItem = await prisma.userInventory.findUnique({
        where: {
          userId_itemType_itemId: {
            userId,
            itemType: shopItem.category,
            itemId: shopItem.itemId,
          },
        },
      });

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { credits: user.credits - shopItem.price },
        });

        if (existingItem) {
          await tx.userInventory.update({
            where: { id: existingItem.id },
            data: { quantity: existingItem.quantity + 1 },
          });
        } else {
          await tx.userInventory.create({
            data: {
              userId,
              itemType: shopItem.category,
              itemId: shopItem.itemId,
              quantity: 1,
              equipped: shopItem.category === 'SHIP',
            },
          });
        }
      });

      await cacheService.del(`inventory:${userId}`);
      await cacheService.del(`user_stats:${userId}`);

      logger.info('购买物品成功', { userId, itemId, price: shopItem.price });

      res.json({
        success: true,
        data: {
          item: shopItem,
          remainingCredits: user.credits - shopItem.price,
        },
      });
    } catch (error) {
      logger.error('购买物品错误', { error });
      next(error);
    }
  }
);

export default router;
