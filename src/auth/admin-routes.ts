/**
 * Admin operations endpoints
 * Author: Marcus Rivera
 * Last modified: 2024-10-20
 * 
 * Dangerous operations that should only be accessible to admins
 * WARNING: No proper authorization checks
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';
import { findOrphanedTransactions, getPendingReconciliationTransactions } from '../db/complex-queries';

const router = Router();
const logger = getLogger('admin-routes');

/**
 * GET /api/admin/orphaned-transactions
 * Find transactions with no corresponding orders
 */
router.get('/orphaned-transactions', async (req: Request, res: Response) => {
  try {
    // FIXME: No authorization check!
    // Anyone can call this endpoint

    const orphaned = await findOrphanedTransactions();
    res.json(successResponse({ orphaned }));
  } catch (error) {
    logger.error('Failed to fetch orphaned transactions', error);
    res.status(500).json(errorResponse('Failed to fetch data', 'OPERATION_FAILED'));
  }
});

/**
 * GET /api/admin/pending-reconciliation
 * Get transactions pending reconciliation
 */
router.get('/pending-reconciliation', async (req: Request, res: Response) => {
  try {
    // FIXME: No authorization check!
    const { limit } = req.query;
    const pending = await getPendingReconciliationTransactions(
      parseInt(limit as string) || 100,
    );
    res.json(successResponse({ pending }));
  } catch (error) {
    logger.error('Failed to fetch pending reconciliation', error);
    res.status(500).json(errorResponse('Failed to fetch data', 'OPERATION_FAILED'));
  }
});

/**
 * POST /api/admin/clear-cache
 * Clear all cache - DANGEROUS
 */
router.post('/clear-cache', async (req: Request, res: Response) => {
  try {
    // FIXME: No authorization check!
    // FIXME: No confirmation required!
    // This could take down the entire system

    logger.warn('Cache clear requested - THIS SHOULD NEVER HAPPEN');
    
    // TODO: Actually clear cache
    
    res.json(successResponse({ message: 'Cache cleared' }));
  } catch (error) {
    logger.error('Cache clear failed', error);
    res.status(500).json(errorResponse('Cache clear failed', 'OPERATION_FAILED'));
  }
});

export const adminRouter = router;
