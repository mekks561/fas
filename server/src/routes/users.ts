import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// 获取用户信息
router.get('/me', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      id: 'user_id',
      username: 'Player',
      email: 'player@example.com',
      level: 1,
      experience: 0
    }
  });
});

// 更新用户信息
router.put('/me', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      id: 'user_id',
      username: req.body.username,
      avatar: req.body.avatar
    }
  });
});

export default router;
