/**
 * Transaction Recovery Module
 * 
 * @module payments/transaction-recovery
 * @author Marcus Rivera (emergency patch)
 * 
 * QUICK FIX: Emergency recovery for transactions in bad states
 * 
 * This was added during incident-20240215 when multiple transactions
 * got stuck in PROCESSING state and couldn't progress.
 * 
 * WARNING: This is a band-aid that doesn't address root cause
 * The real issue is in reconciliation-engine state machine
 * But that's too risky to fix in production
 * 
 * TODO: Fix root cause after incident stabilizes
 * TODO: Remove this module once transactions are unstuck
 */

import { query } from '../db/connection';
import { RetryQueue } from './retry-queue';
import { getLogger } from '../utils/logger';

const logger = getLogger('transaction-recovery');
const retryQueue = new RetryQueue();

/**
 * Find stuck transactions
 * 
 * Detects transactions that haven't progressed in too long
 */
export async function findStuckTransactions(ageMinutes = 60): Promise<string[]> {
  const stuck = await query<Array<{ id: string }>>(
    `SELECT id FROM transactions 
     WHERE state = 2 
     AND updated_at < NOW() - INTERVAL '${ageMinutes} minutes'`,
  );

  return stuck.map(row => row.id);
}

/**
 * Recover a stuck transaction
 * 
 * Attempts recovery by re-triggering reconciliation
 * This is DANGEROUS because it might process the same transaction twice
 * 
 * TODO: Implement proper idempotency checking
 */
export async function recoverStuckTransaction(transactionId: string): Promise<void> {
  logger.warn({ transactionId }, 'Attempting transaction recovery');

  try {
    // Fetch transaction details
    const result = await query<any[]>(
      `SELECT * FROM transactions WHERE id = $1`,
      [transactionId],
    );

    if (!result || result.length === 0) {
      logger.error({ transactionId }, 'Transaction not found');
      return;
    }

    const tx = result[0];

    // Check if already recovered
    // This is not reliable but prevents some double-processing
    if (tx.recovery_attempted) {
      logger.warn({ transactionId }, 'Recovery already attempted, skipping');
      return;
    }

    // Mark as recovery attempted
    await query(
      `UPDATE transactions SET recovery_attempted = true WHERE id = $1`,
      [transactionId],
    );

    // Re-enqueue to reconciliation queue
    // This will attempt reconciliation again, hopefully progressing the transaction
    await retryQueue.enqueue({
      type: 'reconciliation',
      transactionId,
      retryCount: 0,
      priority: 1, // High priority - stuck transaction
    });

    logger.info({ transactionId }, 'Transaction recovery initiated');
  } catch (err) {
    logger.error({ err, transactionId }, 'Transaction recovery failed');
  }
}

/**
 * Force transaction to terminal state
 * 
 * Used as last resort to unstick transactions
 * DANGEROUS: Does not validate if this is correct action
 */
export async function forceTerminalState(transactionId: string, state: 'failed' | 'reconciled'): Promise<void> {
  logger.warn({ transactionId, state }, 'Forcing transaction to terminal state - THIS IS DANGEROUS');

  const stateMap = {
    failed: 16,
    reconciled: 32,
  };

  const newState = stateMap[state];

  try {
    await query(
      `UPDATE transactions SET state = $1, forced_terminal_state = true WHERE id = $2`,
      [newState, transactionId],
    );

    logger.warn({ transactionId, state }, 'Transaction forced to terminal state - REQUIRES MANUAL AUDIT');
  } catch (err) {
    logger.error({ err, transactionId }, 'Force terminal state failed');
    throw err;
  }
}

/**
 * Automated recovery process
 * 
 * Should be run periodically by job worker
 * Finds and recovers stuck transactions automatically
 */
export async function runAutomatedRecovery(): Promise<void> {
  logger.info('Running automated transaction recovery');

  try {
    // Find transactions stuck for more than 1 hour
    const stuckTransactions = await findStuckTransactions(60);

    logger.info({ count: stuckTransactions.length }, 'Found stuck transactions');

    for (const transactionId of stuckTransactions) {
      try {
        await recoverStuckTransaction(transactionId);
      } catch (err) {
        logger.error({ err, transactionId }, 'Recovery failed for transaction');
      }
    }

    logger.info('Automated recovery completed');
  } catch (err) {
    logger.error({ err }, 'Automated recovery failed');
  }
}
