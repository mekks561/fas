import { describe, beforeEach, it, expect, vi } from 'vitest';
import { validate, registerSchema, loginSchema, submitScoreSchema } from '../middleware/validation';
import { Request, Response, NextFunction } from 'express';

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {}
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    nextFunction = vi.fn();
  });

  describe('registerSchema', () => {
    it('should pass validation with valid data', () => {
      mockRequest.body = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const middleware = validate(registerSchema);
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid email', () => {
      mockRequest.body = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123'
      };

      const middleware = validate(registerSchema);
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should fail validation with short password', () => {
      mockRequest.body = {
        username: 'testuser',
        email: 'test@example.com',
        password: '12345'
      };

      const middleware = validate(registerSchema);
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should fail validation with short username', () => {
      mockRequest.body = {
        username: 'ab',
        email: 'test@example.com',
        password: 'password123'
      };

      const middleware = validate(registerSchema);
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should fail validation with missing fields', () => {
      mockRequest.body = {
        username: 'testuser'
      };

      const middleware = validate(registerSchema);
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('loginSchema', () => {
    it('should pass validation with valid data', () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      const middleware = validate(loginSchema);
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should fail validation with invalid email', () => {
      mockRequest.body = {
        email: 'invalid',
        password: 'password123'
      };

      const middleware = validate(loginSchema);
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('submitScoreSchema', () => {
    it('should pass validation with valid score', () => {
      mockRequest.body = {
        score: 1000,
        level: 5,
        wave: 10
      };

      const middleware = validate(submitScoreSchema);
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should set default values for optional fields', () => {
      mockRequest.body = {
        score: 1000,
        level: 5,
        wave: 10
      };

      const middleware = validate(submitScoreSchema);
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.body.kills).toBe(0);
      expect(mockRequest.body.gameDuration).toBe(0);
      expect(mockRequest.body.difficulty).toBe('NORMAL');
    });

    it('should fail validation with negative score', () => {
      mockRequest.body = {
        score: -100,
        level: 5,
        wave: 10
      };

      const middleware = validate(submitScoreSchema);
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should fail validation with invalid difficulty', () => {
      mockRequest.body = {
        score: 1000,
        level: 5,
        wave: 10,
        difficulty: 'INVALID'
      };

      const middleware = validate(submitScoreSchema);
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should accept all valid difficulties', () => {
      const difficulties = ['EASY', 'NORMAL', 'HARD', 'EXPERT'];

      difficulties.forEach(difficulty => {
        mockRequest.body = {
          score: 1000,
          level: 5,
          wave: 10,
          difficulty
        };

        const middleware = validate(submitScoreSchema);
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction
        );

        expect(nextFunction).toHaveBeenCalled();
      });
    });
  });
});
