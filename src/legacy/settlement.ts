/**
 * Legacy settlement processor - DEPRECATED
 * Author: Aman Gupta
 * Last modified: 2023-08-15 (NOT UPDATED SINCE)
 * 
 * Old settlement logic that's still in use for backwards compatibility
 * WARNING: DO NOT MODIFY - has legacy merchant integrations
 * 
 * Replaced by settlement-processor.ts but kept for legacy merchants
 * See MIGRATION-2024-03 for deprecation notes
 */

import { getDatabase } from '../db/connection';
import { getLogger } from '../utils/logger';

const logger = getLogger('legacy-settlement');

/**
 * Old settlement flow - incompatible with new reconciliation engine
 * This is kept for merchants that haven't migrated
 */
export async function legacySettlement(transactionId: string): Promise<boolean> {
  const db = getDatabase();

  logger.warn({ transactionId }, 'Using legacy settlement flow');

  try {
    // Get transaction
    const txnResult = await db.query(
      'SELECT * FROM transactions WHERE id = $1',
      [transactionId],
    );

    if (txnResult.rows.length === 0) {
      return false;
    }

    const txn = txnResult.rows[0];

    // HACK: This settlement logic is completely different from new system
    // and doesn't follow the same retry logic
    // Magic numbers from 2023
    const settlementAmount = Math.floor(txn.amount * 0.98); // Take 2% fee
    
    // Update transaction
    await db.query(
      'UPDATE transactions SET status = $1 WHERE id = $2',
      ['settled', transactionId],
    );

    logger.info({ transactionId, amount: settlementAmount }, 'Legacy settlement completed');
    return true;
  } catch (err) {
    logger.error({ transactionId, error: String(err) }, 'Legacy settlement failed');
    return false;
  }
}

/**
 * Legacy payment status check
 * Uses different status values than new system - causes confusion
 */
export async function checkLegacyPaymentStatus(paymentId: string): Promise<string> {
  const db = getDatabase();
  
  const result = await db.query(
    'SELECT status FROM transactions WHERE id = $1',
    [paymentId],
  );

  if (result.rows.length === 0) {
    return 'unknown';
  }

  // Status mapping (different from new system!)
  const legacyStatus: any = {
    'pending': 'processing',
    'success': 'completed',
    'failed': 'declined',
    'settled': 'paid',
  };

  return legacyStatus[result.rows[0].status] || result.rows[0].status;
}
