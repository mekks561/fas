import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, upgradeSkillSchema, upgradeWeaponSchema } from '../middleware/validation';
import { actionLimiter } from '../middleware/rateLimiter';
import { logger } from '../middleware/logger';
import { cacheService } from '../services/cache';

const router = Router();

router.get(
  '/ships',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cached = await cacheService.get('ships');
      if (cached) {
        logger.debug('从缓存获取飞船列表');
        return res.json({ success: true, data: cached });
      }

      const ships = await prisma.ship.findMany({
        orderBy: { price: 'asc' },
      });

      await cacheService.set('ships', ships, 600);

      res.json({ success: true, data: ships });
    } catch (error) {
      logger.error('获取飞船列表错误', { error });
      next(error);
    }
  }
);

router.get(
  '/ships/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const ship = await prisma.ship.findUnique({
        where: { id },
      });

      if (!ship) {
        return res.status(404).json({
          success: false,
          error: { code: 'SHIP_NOT_FOUND', message: '飞船不存在' },
        });
      }

      res.json({ success: true, data: ship });
    } catch (error) {
      logger.error('获取飞船详情错误', { error });
      next(error);
    }
  }
);

router.get(
  '/weapons',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cached = await cacheService.get('weapons');
      if (cached) {
        logger.debug('从缓存获取武器列表');
        return res.json({ success: true, data: cached });
      }

      const weapons = await prisma.weapon.findMany({
        orderBy: { price: 'asc' },
      });

      await cacheService.set('weapons', weapons, 600);

      res.json({ success: true, data: weapons });
    } catch (error) {
      logger.error('获取武器列表错误', { error });
      next(error);
    }
  }
);

router.get(
  '/weapons/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const weapon = await prisma.weapon.findUnique({
        where: { id },
      });

      if (!weapon) {
        return res.status(404).json({
          success: false,
          error: { code: 'WEAPON_NOT_FOUND', message: '武器不存在' },
        });
      }

      res.json({ success: true, data: weapon });
    } catch (error) {
      logger.error('获取武器详情错误', { error });
      next(error);
    }
  }
);

router.get(
  '/skills',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cached = await cacheService.get('skills');
      if (cached) {
        logger.debug('从缓存获取技能列表');
        return res.json({ success: true, data: cached });
      }

      const skills = await prisma.skill.findMany({
        orderBy: { price: 'asc' },
      });

      await cacheService.set('skills', skills, 600);

      res.json({ success: true, data: skills });
    } catch (error) {
      logger.error('获取技能列表错误', { error });
      next(error);
    }
  }
);

router.get(
  '/skills/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const skill = await prisma.skill.findUnique({
        where: { id },
      });

      if (!skill) {
        return res.status(404).json({
          success: false,
          error: { code: 'SKILL_NOT_FOUND', message: '技能不存在' },
        });
      }

      res.json({ success: true, data: skill });
    } catch (error) {
      logger.error('获取技能详情错误', { error });
      next(error);
    }
  }
);

router.get(
  '/progress/skills',
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

      const skillProgress = await prisma.skillProgress.findMany({
        where: { userId },
        orderBy: { skillId: 'asc' },
      });

      res.json({ success: true, data: skillProgress });
    } catch (error) {
      logger.error('获取技能进度错误', { error });
      next(error);
    }
  }
);

router.get(
  '/progress/weapons',
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

      const weaponProgress = await prisma.weaponProgress.findMany({
        where: { userId },
        orderBy: { weaponId: 'asc' },
      });

      res.json({ success: true, data: weaponProgress });
    } catch (error) {
      logger.error('获取武器进度错误', { error });
      next(error);
    }
  }
);

router.post(
  '/progress/skills/upgrade',
  authenticate,
  actionLimiter,
  validate(upgradeSkillSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: '未认证' },
        });
      }

      const userId = req.user.userId;
      const { skillId } = req.body;

      const skill = await prisma.skill.findUnique({
        where: { id: skillId },
      });

      if (!skill) {
        return res.status(404).json({
          success: false,
          error: { code: 'SKILL_NOT_FOUND', message: '技能不存在' },
        });
      }

      let progress = await prisma.skillProgress.findUnique({
        where: { userId_skillId: { userId, skillId } },
      });

      const currentLevel = progress?.level || 0;
      if (currentLevel >= skill.maxLevel) {
        return res.status(400).json({
          success: false,
          error: { code: 'MAX_LEVEL', message: '已达到最高等级' },
        });
      }

      const upgradeCost = skill.price * (currentLevel + 1);

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.credits < upgradeCost) {
        return res.status(400).json({
          success: false,
          error: { code: 'INSUFFICIENT_CREDITS', message: '金币不足' },
        });
      }

      const upgradeResult = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { credits: user.credits - upgradeCost },
        });

        const existingProgress = await tx.skillProgress.findUnique({
          where: { userId_skillId: { userId, skillId } },
        });

        if (existingProgress) {
          return tx.skillProgress.update({
            where: { userId_skillId: { userId, skillId } },
            data: { level: currentLevel + 1 },
          });
        } else {
          return tx.skillProgress.create({
            data: { userId, skillId, level: 1, unlocked: true },
          });
        }
      });

      logger.info('升级技能', { userId, skillId, level: upgradeResult.level });

      res.json({ success: true, data: upgradeResult });
    } catch (error) {
      logger.error('升级技能错误', { error });
      next(error);
    }
  }
);

router.post(
  '/progress/weapons/upgrade',
  authenticate,
  actionLimiter,
  validate(upgradeWeaponSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: '未认证' },
        });
      }

      const userId = req.user.userId;
      const { weaponId } = req.body;

      const weapon = await prisma.weapon.findUnique({
        where: { id: weaponId },
      });

      if (!weapon) {
        return res.status(404).json({
          success: false,
          error: { code: 'WEAPON_NOT_FOUND', message: '武器不存在' },
        });
      }

      let progress = await prisma.weaponProgress.findUnique({
        where: { userId_weaponId: { userId, weaponId } },
      });

      const currentLevel = progress?.level || 0;
      const maxLevel = 10;

      if (currentLevel >= maxLevel) {
        return res.status(400).json({
          success: false,
          error: { code: 'MAX_LEVEL', message: '已达到最高等级' },
        });
      }

      const upgradeCost = weapon.price * (currentLevel + 1);

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.credits < upgradeCost) {
        return res.status(400).json({
          success: false,
          error: { code: 'INSUFFICIENT_CREDITS', message: '金币不足' },
        });
      }

      const upgradeResult = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { credits: user.credits - upgradeCost },
        });

        const existingProgress = await tx.weaponProgress.findUnique({
          where: { userId_weaponId: { userId, weaponId } },
        });

        if (existingProgress) {
          return tx.weaponProgress.update({
            where: { userId_weaponId: { userId, weaponId } },
            data: { level: currentLevel + 1 },
          });
        } else {
          return tx.weaponProgress.create({
            data: { userId, weaponId, level: 1, unlocked: true },
          });
        }
      });

      logger.info('升级武器', { userId, weaponId, level: upgradeResult.level });

      res.json({ success: true, data: upgradeResult });
    } catch (error) {
      logger.error('升级武器错误', { error });
      next(error);
    }
  }
);

export default router;
