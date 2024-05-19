/**
 * Request context tracking
 * Author: Sarah Chen
 * Last modified: 2024-10-30
 * 
 * Attaches request context to logs and operations
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      userId?: string;
      merchantId?: string;
      startTime?: number;
    }
  }
}

/**
 * Middleware to add request context
 */
export const requestContext = (req: Request, res: Response, next: NextFunction) => {
  // Generate unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Extract merchant/user from token if present
  // TODO: Actually parse JWT and extract claims

  next();
};

/**
 * Get request context for logging
 */
export function getRequestContext(req: Request): Record<string, any> {
  return {
    requestId: req.requestId,
    userId: req.userId,
    merchantId: req.merchantId,
    method: req.method,
    path: req.path,
  };
}
