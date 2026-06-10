import { Router, Request, Response } from 'express';

const router = Router();

// 成就列表
const ACHIEVEMENTS = [
  { id: 'first_kill', name: '首杀', description: '击杀一个敌人' },
  { id: 'kill_100', name: '百人斩', description: '累计击杀100个敌人' },
  { id: 'wave_10', name: '波次达人', description: '到达第10波' },
  { id: 'score_10000', name: '万分大师', description: '单局得分超过10000' },
  { id: 'level_5', name: '升级专家', description: '角色等级达到5级' }
];

// 获取成就列表
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      achievements: ACHIEVEMENTS.map(a => ({
        ...a,
        unlocked: false,
        unlockedAt: null
      }))
    }
  });
});

// 解锁成就
router.post('/unlock', (req: Request, res: Response) => {
  const { achievementId } = req.body;
  
  res.json({
    success: true,
    data: {
      achievement: ACHIEVEMENTS.find(a => a.id === achievementId)
    }
  });
});

export default router;
