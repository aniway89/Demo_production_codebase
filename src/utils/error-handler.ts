/**
 * Centralized error handling utilities
 * 
 * @module utils/error-handler
 * @author Sarah Chen
 * 
 * Provides custom error types and Express error handling middleware
 * with proper HTTP status mapping and logging.
 */

import { Request, Response, NextFunction } from 'express';
import { sendError } from './response';
import { getLogger } from './logger';

const logger = getLogger('error-handler');

/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Unauthorized error class
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Express error handling middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof AppError) {
    logger.warn(
      {
        code: err.code,
        statusCode: err.statusCode,
        details: err.details,
      },
      `Application error: ${err.message}`,
    );

    return sendError(res, err.code, err.message, err.statusCode, err.details);
  }

  // Unexpected error
  logger.error({ err }, 'Unexpected error');
  return sendError(
    res,
    'INTERNAL_ERROR',
    'An unexpected error occurred',
    500,
  );
};
