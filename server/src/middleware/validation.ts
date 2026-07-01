import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// 验证错误格式化
export const formatValidationError = (error: Joi.ValidationError): Array<{ field: string; message: string; type: string }> => {
  return error.details.map((detail: Joi.ValidationErrorItem) => ({
    field: detail.path.join('.'),
    message: detail.message,
    type: detail.type
  }));
};

// 注册验证
export const registerSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(20)
    .required()
    .messages({
      'string.min': '用户名至少3个字符',
      'string.max': '用户名最多20个字符',
      'any.required': '用户名是必填项'
    }),

  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': '邮箱格式不正确',
      'any.required': '邮箱是必填项'
    }),

  password: Joi.string()
    .min(6)
    .max(100)
    .required()
    .messages({
      'string.min': '密码至少6个字符',
      'any.required': '密码是必填项'
    })
});

// 登录验证
export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': '邮箱格式不正确',
      'any.required': '邮箱是必填项'
    }),

  password: Joi.string()
    .required()
    .messages({
      'any.required': '密码是必填项'
    })
});

// 更新用户验证
export const updateUserSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(20),

  avatar: Joi.string()
    .uri()
    .allow('')
}).min(1);

// 提交分数验证
export const submitScoreSchema = Joi.object({
  score: Joi.number()
    .min(0)
    .required()
    .messages({
      'number.min': '分数不能为负数',
      'any.required': '分数是必填项'
    }),

  level: Joi.number()
    .min(1)
    .max(100)
    .required()
    .messages({
      'number.min': '等级至少为1',
      'number.max': '等级不能超过100',
      'any.required': '等级是必填项'
    }),

  wave: Joi.number()
    .min(1)
    .required()
    .messages({
      'number.min': '波次至少为1',
      'any.required': '波次是必填项'
    }),

  kills: Joi.number()
    .min(0)
    .default(0),

  gameDuration: Joi.number()
    .min(0)
    .default(0),

  difficulty: Joi.string()
    .valid('EASY', 'NORMAL', 'HARD', 'EXPERT')
    .default('NORMAL')
});

// 解锁成就验证
export const unlockAchievementSchema = Joi.object({
  achievementId: Joi.string()
    .required()
    .messages({
      'any.required': '成就ID是必填项'
    })
});

// 更新设置验证
export const updateSettingsSchema = Joi.object({
  difficulty: Joi.string()
    .valid('EASY', 'NORMAL', 'HARD', 'EXPERT'),

  soundEnabled: Joi.boolean(),

  musicEnabled: Joi.boolean(),

  graphicsQuality: Joi.string()
    .valid('LOW', 'MEDIUM', 'HIGH', 'ULTRA'),

  fieldOfView: Joi.number()
    .min(45)
    .max(120),

  sensitivity: Joi.number()
    .min(0.1)
    .max(2.0)
}).min(1);

// 验证中间件工厂
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求参数验证失败',
          details: formatValidationError(error)
        }
      });
      return;
    }

    req.body = value;
    next();
  };
};
