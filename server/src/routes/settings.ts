import { Router, Request, Response } from 'express';

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

// 获取设置
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: DEFAULT_SETTINGS
  });
});

// 更新设置
router.put('/', (req: Request, res: Response) => {
  const updates = req.body;
  
  res.json({
    success: true,
    data: {
      ...DEFAULT_SETTINGS,
      ...updates
    }
  });
});

export default router;
