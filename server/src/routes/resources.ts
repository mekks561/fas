import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../middleware/logger';
import { cacheService } from '../services/cache';

const router = Router();

// 示例资源数据
const RESOURCES = [
  {
    id: 'texture_player',
    name: '玩家纹理',
    type: 'texture',
    url: '/textures/player.png',
    size: 1024 * 50,
    hash: 'abc123def456',
    version: '1.0.0'
  },
  {
    id: 'texture_enemy',
    name: '敌人纹理',
    type: 'texture',
    url: '/textures/enemy.png',
    size: 1024 * 50,
    hash: 'def456ghi789',
    version: '1.0.0'
  },
  {
    id: 'model_ship',
    name: '飞船模型',
    type: 'model',
    url: '/models/ship.glb',
    size: 1024 * 200,
    hash: 'ghi789jkl012',
    version: '1.0.0'
  },
  {
    id: 'texture_explosion',
    name: '爆炸纹理',
    type: 'texture',
    url: '/textures/explosion.png',
    size: 1024 * 100,
    hash: 'jkl012mno345',
    version: '1.0.0'
  },
  {
    id: 'audio_explosion',
    name: '爆炸音效',
    type: 'audio',
    url: '/audio/explosion.mp3',
    size: 1024 * 20,
    hash: 'mno345pqr678',
    version: '1.0.0'
  }
];

/**
 * @route GET /api/resources
 * @desc 获取资源列表
 * @access Public
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = req.query.type as string;

      logger.info('获取资源列表', { type });

      // 尝试从缓存获取
      const cacheKey = type ? `resources:type:${type}` : 'resources:all';
      const cached = await cacheService.get(cacheKey);

      if (cached) {
        logger.debug('从缓存获取资源列表');
        return res.json(cached);
      }

      // 过滤资源
      let resources = RESOURCES;
      if (type) {
        resources = RESOURCES.filter(r => r.type === type);
      }

      const result = {
        success: true,
        data: {
          resources,
          total: resources.length
        }
      };

      // 缓存资源列表（10分钟）
      await cacheService.set(cacheKey, result, 600);

      logger.info('资源列表获取成功', { count: resources.length });

      res.json(result);
    } catch (error) {
      logger.error('获取资源列表错误', { error });
      next(error);
    }
  }
);

/**
 * @route GET /api/resources/:id
 * @desc 获取单个资源信息
 * @access Public
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      logger.info('获取资源信息', { resourceId: id });

      const resource = RESOURCES.find(r => r.id === id);

      if (!resource) {
        logger.warn('资源不存在', { resourceId: id });
        return res.status(404).json({
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: '资源不存在'
          }
        });
      }

      logger.info('资源信息获取成功', { resourceId: id });

      res.json({
        success: true,
        data: resource
      });
    } catch (error) {
      logger.error('获取资源信息错误', { error });
      next(error);
    }
  }
);

/**
 * @route POST /api/resources/verify
 * @desc 验证资源完整性
 * @access Public
 */
router.post(
  '/verify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resources } = req.body;

      logger.info('验证资源完整性', { count: resources?.length || 0 });

      if (!resources || !Array.isArray(resources)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '资源列表是必填项'
          }
        });
      }

      // 验证每个资源
      const valid: string[] = [];
      const invalid: string[] = [];

      for (const item of resources) {
        const resource = RESOURCES.find(r => r.id === item.id);

        if (resource && resource.hash === item.hash) {
          valid.push(item.id);
        } else {
          invalid.push(item.id);
        }
      }

      logger.info('资源验证完成', { valid: valid.length, invalid: invalid.length });

      res.json({
        success: true,
        data: {
          valid,
          invalid,
          totalValid: valid.length,
          totalInvalid: invalid.length
        }
      });
    } catch (error) {
      logger.error('验证资源完整性错误', { error });
      next(error);
    }
  }
);

/**
 * @route GET /api/resources/stats
 * @desc 获取资源统计信息
 * @access Public
 */
router.get(
  '/meta/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('获取资源统计');

      // 统计各类资源
      const stats = {
        total: RESOURCES.length,
        textures: RESOURCES.filter(r => r.type === 'texture').length,
        models: RESOURCES.filter(r => r.type === 'model').length,
        audio: RESOURCES.filter(r => r.type === 'audio').length,
        totalSize: RESOURCES.reduce((sum, r) => sum + r.size, 0)
      };

      logger.info('资源统计获取成功', { stats });

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('获取资源统计错误', { error });
      next(error);
    }
  }
);

export default router;
