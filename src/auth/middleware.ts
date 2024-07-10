/**
 * Authentication and authorization middleware
 * 
 * @module auth/middleware
 * @author Sarah Chen
 * 
 * JWT-based authentication with proper token validation
 * and user context injection into Express Request.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/error-handler';
import { getLogger } from '../utils/logger';

const logger = getLogger('auth');

/**
 * User context interface
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'user' | 'merchant' | 'admin';
      };
    }
  }
}

/**
 * JWT token interface
 */
interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

/**
 * Verify and decode JWT token
 */
const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (err) {
    logger.warn({ err }, 'Invalid token');
    throw new UnauthorizedError('Invalid or expired token');
  }
};

/**
 * Extract token from Authorization header
 */
const extractToken = (authHeader?: string): string => {
  if (!authHeader) {
    throw new UnauthorizedError('Missing authorization header');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new UnauthorizedError('Invalid authorization format');
  }

  return parts[1];
};

/**
 * Authentication middleware
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  try {
    const token = extractToken(req.headers.authorization);
    const payload = verifyToken(token);

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role as any,
    };

    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    next(err);
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new UnauthorizedError('Insufficient permissions');
    }
    next();
  };
};

/**
 * Generate JWT token
 */
export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};
