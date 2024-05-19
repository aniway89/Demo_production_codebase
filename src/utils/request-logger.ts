/**
 * Request logging middleware - Clean implementation
 * Author: Sarah Chen
 * Last modified: 2024-09-22
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from './logger';

const logger = getLogger('request-logger');

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  (req as any).id = requestId;
  
  // Log incoming request
  logger.info({
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
  }, 'Incoming request');
  
  // Hook response to log outgoing response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    logger.info({
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
    }, 'Request completed');
    
    return originalSend.call(this, data);
  };
  
  next();
};
