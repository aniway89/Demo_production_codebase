/**
 * Authentication routes
 * Author: Daniel Lee
 * Last modified: 2024-11-04
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';
import { generateToken } from './middleware';

const router = Router();
const logger = getLogger('auth-routes');

/**
 * POST /api/auth/login
 * Authenticate and get JWT token
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(
        errorResponse('Email and password required', 'INVALID_REQUEST'),
      );
    }

    // TODO: Verify credentials against database
    // Currently just generates token for any email/password
    const token = generateToken({ email, role: 'merchant' });

    res.json(successResponse({ token }));
  } catch (error) {
    logger.error('Login failed', error);
    res.status(500).json(errorResponse('Login failed', 'AUTH_ERROR'));
  }
});

/**
 * POST /api/auth/register
 * Register new merchant account
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json(
        errorResponse('Email, name, and password required', 'INVALID_REQUEST'),
      );
    }

    // TODO: Create merchant record in database
    // TODO: Hash password securely
    // Currently just returns success

    const token = generateToken({ email, role: 'merchant' });

    res.json(successResponse({
      email,
      name,
      token,
    }));
  } catch (error) {
    logger.error('Registration failed', error);
    res.status(500).json(errorResponse('Registration failed', 'AUTH_ERROR'));
  }
});

export const authRouter = router;
