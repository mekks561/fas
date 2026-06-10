import { logger } from '../middleware/logger';

describe('Logger', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('Test message');
      expect(console.log).toHaveBeenCalled();
    });

    it('should log info messages with additional arguments', () => {
      logger.info('User action', { userId: '123', action: 'login' });
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('Error occurred');
      expect(console.error).toHaveBeenCalled();
    });

    it('should log error with stack trace', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('Warning message');
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return statistics object', () => {
      const stats = logger.getStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('lastHour');
      expect(stats).toHaveProperty('avgDuration');
      expect(stats).toHaveProperty('statusCounts');
    });
  });

  describe('getRecentLogs', () => {
    it('should return array of logs', () => {
      const logs = logger.getRecentLogs();
      expect(Array.isArray(logs)).toBe(true);
    });

    it('should respect count parameter', () => {
      const logs = logger.getRecentLogs(5);
      expect(logs.length).toBeLessThanOrEqual(5);
    });
  });
});
