import { Router, Request, Response } from 'express';

const router = Router();

// 示例资源数据
const RESOURCES = [
  {
    id: 'texture_player',
    name: '玩家纹理',
    type: 'texture',
    url: '/textures/player.png',
    size: 1024 * 50,
    hash: 'abc123'
  },
  {
    id: 'texture_enemy',
    name: '敌人纹理',
    type: 'texture',
    url: '/textures/enemy.png',
    size: 1024 * 50,
    hash: 'def456'
  },
  {
    id: 'model_ship',
    name: '飞船模型',
    type: 'model',
    url: '/models/ship.glb',
    size: 1024 * 200,
    hash: 'ghi789'
  }
];

// 获取资源列表
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      resources: RESOURCES
    }
  });
});

// 获取单个资源
router.get('/:id', (req: Request, res: Response) => {
  const resource = RESOURCES.find(r => r.id === req.params.id);
  
  if (!resource) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: '资源不存在'
      }
    });
  }

  res.json({
    success: true,
    data: resource
  });
});

// 验证资源完整性
router.post('/verify', (req: Request, res: Response) => {
  const { resources } = req.body;
  
  const valid = resources
    .filter((r: any) => RESOURCES.some(res => res.id === r.id && res.hash === r.hash))
    .map((r: any) => r.id);
    
  const invalid = resources
    .filter((r: any) => !valid.includes(r.id))
    .map((r: any) => r.id);

  res.json({
    success: true,
    data: {
      valid,
      invalid
    }
  });
});

export default router;
