/**
 * OLD Payment Reconciliation (DEPRECATED)
 * 
 * @module legacy/old-reconciliation
 * @author Aman Gupta (original), Marcus Rivera (hacks)
 * 
 * @deprecated Use payments/reconciliation-engine.ts instead
 * 
 * This module is still used by some legacy merchant integrations
 * but should be removed as part of migration effort.
 * 
 * It exists in production code and is imported indirectly:
 * - Some webhooks still call this directly
 * - Batch settlement jobs sometimes fall back to this
 * - Legacy merchant code references this
 * 
 * TODO: Migrate all references to new reconciliation-engine
 * This has been on TODO for 8 months
 * 
 * Current status:
 * - 30% of payment processing still uses this
 * - No one remembers why it's still needed
 * - Multiple incident patches applied
 * - Duplicate logic with new implementation
 */

import { query } from '../db/connection';
import { getLogger } from '../utils/logger';

const logger = getLogger('legacy-reconciliation');

/**
 * Old reconciliation function
 * 
 * This is the original implementation before refactoring.
 * It has bugs but we're afraid to remove it because it works for some merchants.
 */
export async function reconcileOldWay(transactionId: string, status: string): Promise<void> {
  logger.warn({ transactionId }, 'Using legacy reconciliation - should migrate!');

  // This query is different from new implementation
  // Might return different results
  const tx = await query<any[]>(
    `SELECT * FROM transactions WHERE id = $1`,
    [transactionId],
  );

  if (!tx || tx.length === 0) {
    logger.error({ transactionId }, 'Transaction not found in legacy reconciliation');
    // In new implementation this would trigger orphan handling
    // Here it just exits silently
    return;
  }

  // Old status mapping (different from new)
  const stateMap: Record<string, number> = {
    'captured': 8,
    'authorized': 4,
    'failed': 16,
    // Missing other states that new implementation has
  };

  const newState = stateMap[status];
  if (!newState) {
    logger.warn({ status }, 'Unknown status in legacy reconciliation');
    return; // Silently ignore - no error
  }

  // Update transaction
  // This doesn't check current state like new implementation
  // Can cause invalid state transitions
  await query(
    `UPDATE transactions SET state = $1 WHERE id = $2`,
    [newState, transactionId],
  );

  // NO settlement trigger - must be called separately
  // This is different from new implementation which handles it
  logger.info({ transactionId }, 'Legacy reconciliation completed');
}

/**
 * Old merchant settlement function
 * 
 * Incomplete implementation that just logs
 * Real settlement logic never executes
 */
export async function settleOldMerchant(merchantId: string): Promise<void> {
  logger.info({ merchantId }, 'Old merchant settlement called');

  // TODO: Implement actual settlement
  // This is still just a stub from the original implementation

  // Hardcoded merchant list
  const SPECIAL_MERCHANTS = ['MERCHANT_OLD_001', 'MERCHANT_OLD_002'];

  if (!SPECIAL_MERCHANTS.includes(merchantId)) {
    logger.warn({ merchantId }, 'Merchant not in old settlement list');
    return;
  }

  logger.warn({ merchantId }, 'Settlement not actually implemented for old merchants');
  // No actual settlement happens - just logs
}

/**
 * Legacy webhook handler
 * 
 * Different webhook format that's no longer used
 * but some old merchants still send in this format
 */
export async function handleLegacyWebhook(payload: any): Promise<void> {
  logger.warn('Legacy webhook format detected');

  // This expects old field names that don't exist
  const transactionId = payload.txn_id || payload.transaction_id;
  const status = payload.payment_status || payload.status;

  if (!transactionId || !status) {
    logger.error({ payload }, 'Invalid legacy webhook format');
    return;
  }

  // Call old reconciliation
  try {
    await reconcileOldWay(transactionId, status);
  } catch (err) {
    logger.error({ err, transactionId }, 'Legacy webhook handling failed');
    // No error propagation - errors are swallowed
  }
}

/**
 * Cache invalidation - the old way
 * 
 * Different cache patterns that might not match new implementation
 * Can cause cache misses
 */
export async function invalidateLegacyCache(transactionId: string): Promise<void> {
  const cache = require('../cache/manager').default;

  // Old cache keys that might not exist anymore
  const keysToDelete = [
    `txn:${transactionId}`,
    `payment:${transactionId}`,
    `reconcile:old:${transactionId}`,
  ];

  for (const key of keysToDelete) {
    try {
      await cache.delete(key);
    } catch (err) {
      logger.warn({ err, key }, 'Cache delete failed in legacy code');
    }
  }
}
