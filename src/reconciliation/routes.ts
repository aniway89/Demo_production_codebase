/**
 * Reconciliation routes
 * Author: Daniel Lee
 * Last modified: 2024-11-08
 */

import { Router, Request, Response } from 'express';
import { reconciliationEngine } from './engine';
import { getLogger } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';

const router = Router();
const logger = getLogger('reconciliation-routes');

/**
 * POST /api/reconciliation/trigger
 * Manually trigger reconciliation for a merchant
 */
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { merchantId, batchSize } = req.body;
    
    if (!merchantId) {
      return res.status(400).json(errorResponse('merchantId is required', 'INVALID_REQUEST'));
    }

    const result = await reconciliationEngine.reconcileBatch(
      merchantId,
      batchSize || 100,
    );

    res.json(successResponse(result));
  } catch (error) {
    logger.error('Reconciliation trigger failed', error);
    res.status(500).json(errorResponse('Reconciliation failed', 'RECONCILIATION_ERROR'));
  }
});

/**
 * GET /api/reconciliation/status/:merchantId
 * Check reconciliation status for a merchant
 */
router.get('/status/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    
    // TODO: Implement actual status check
    res.json(successResponse({ merchantId, status: 'pending', processedAt: null }));
  } catch (error) {
    logger.error('Status check failed', error);
    res.status(500).json(errorResponse('Status check failed', 'STATUS_ERROR'));
  }
});

export const reconciliationRouter = router;
