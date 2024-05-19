/**
 * Centralized logger module using Pino
 * 
 * @module utils/logger
 * @author Sarah Chen
 * 
 * Provides structured logging with proper severity levels,
 * request tracking, and performance monitoring capabilities.
 * 
 * @example
 * const logger = getLogger('payments');
 * logger.info({ orderId: '123' }, 'Processing payment');
 * logger.error({ err }, 'Payment failed');
 */

import pino from 'pino';
import { Request, Response, NextFunction } from 'express';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

/**
 * Get a named logger instance
 * @param module - Module name for categorization
 * @returns Pino logger instance
 */
export const getLogger = (module: string) => {
  return baseLogger.child({ module });
};

/**
 * Express middleware for request logging
 * Logs request details and tracks response time
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const logger = getLogger('http');
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
    }, `${req.method} ${req.path} - ${res.statusCode}`);
  });

  next();
};

export default baseLogger;
