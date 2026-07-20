import rateLimit from 'express-rate-limit';

export const actionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, error: { code: 'RATE_LIMIT', message: '操作过于频繁，请稍后再试' } }
});
