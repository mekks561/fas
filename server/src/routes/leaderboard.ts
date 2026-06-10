import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Leaderboard } from '../models/Leaderboard';
import { User } from '../models/User';

const router = Router();

// 获取排行榜
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const difficulty = req.query.difficulty as string;

    // 构建查询条件
    const query: any = {};
    if (difficulty) {
      query.difficulty = difficulty;
    }

    // 查询数据
    const total = await Leaderboard.countDocuments(query);
    const entries = await Leaderboard.find(query)
      .sort({ score: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('username score level wave kills difficulty date');

    res.json({
      success: true,
      data: {
        entries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取用户排名
router.get('/my-rank', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 获取token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: '需要登录'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string };

    // 获取用户最佳成绩
    const bestEntry = await Leaderboard.findOne({ userId: decoded.userId })
      .sort({ score: -1 });

    if (!bestEntry) {
      return res.json({
        success: true,
        data: {
          rank: null,
          entry: null
        }
      });
    }

    // 计算排名
    const rank = await Leaderboard.countDocuments({
      score: { $gt: bestEntry.score }
    }) + 1;

    res.json({
      success: true,
      data: {
        rank,
        entry: bestEntry
      }
    });
  } catch (error) {
    next(error);
  }
});

// 提交分数
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 获取token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: '需要登录'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string };

    const { score, level, wave, kills, gameDuration, difficulty } = req.body;

    // 验证输入
    if (score === undefined || level === undefined || wave === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '分数、等级和波次都是必填项'
        }
      });
    }

    // 获取用户
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      });
    }

    // 创建排行榜条目
    const entry = new Leaderboard({
      userId: decoded.userId,
      username: user.username,
      score,
      level,
      wave,
      kills: kills || 0,
      gameDuration: gameDuration || 0,
      difficulty: difficulty || 'NORMAL'
    });

    await entry.save();

    // 计算排名
    const rank = await Leaderboard.countDocuments({
      score: { $gt: score }
    }) + 1;

    const totalPlayers = await Leaderboard.countDocuments();

    res.status(201).json({
      success: true,
      data: {
        rank,
        totalPlayers,
        entry
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
