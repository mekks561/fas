import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { validate, registerSchema, loginSchema } from '../middleware/validation';
import { logger } from '../middleware/logger';

const router = Router();

/**
 * @route POST /api/auth/register
 * @desc 注册新用户
 * @access Public
 */
router.post(
  '/register',
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, email, password } = req.body;

      logger.info('用户注册尝试', { username, email });

      // 检查用户是否已存在
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        const field = existingUser.email === email ? '邮箱' : '用户名';
        logger.warn('注册失败：用户已存在', { username, email });
        return res.status(400).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: `${field}已被注册`
          }
        });
      }

      // 加密密码
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 创建用户
      const user = new User({
        username,
        email,
        password: hashedPassword
      });

      await user.save();

      // 生成token
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      logger.info('用户注册成功', { userId: user._id, username });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            level: user.level,
            experience: user.experience
          },
          token
        }
      });
    } catch (error) {
      logger.error('注册错误', { error });
      next(error);
    }
  }
);

/**
 * @route POST /api/auth/login
 * @desc 用户登录
 * @access Public
 */
router.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      logger.info('用户登录尝试', { email });

      // 查找用户
      const user = await User.findOne({ email }).select('+password');

      if (!user) {
        logger.warn('登录失败：用户不存在', { email });
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '邮箱或密码错误'
          }
        });
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        logger.warn('登录失败：密码错误', { email });
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '邮箱或密码错误'
          }
        });
      }

      // 生成token
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      logger.info('用户登录成功', { userId: user._id, username: user.username });

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            level: user.level,
            experience: user.experience,
            avatar: user.avatar
          },
          token
        }
      });
    } catch (error) {
      logger.error('登录错误', { error });
      next(error);
    }
  }
);

/**
 * @route GET /api/auth/me
 * @desc 获取当前用户信息
 * @access Private
 */
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
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
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as { userId: string };

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

    res.json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        level: user.level,
        experience: user.experience,
        avatar: user.avatar
      }
    });
  } catch (error) {
    logger.error('获取用户信息错误', { error });
    next(error);
  }
});

/**
 * @route POST /api/auth/refresh
 * @desc 刷新token
 * @access Private
 */
router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key'
      ) as { userId: string; email: string };

      // 生成新token
      const newToken = jwt.sign(
        { userId: decoded.userId, email: decoded.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        success: true,
        data: {
          token: newToken
        }
      });
    } catch (error) {
      logger.error('刷新token错误', { error });
      next(error);
    }
  }
);

export default router;
