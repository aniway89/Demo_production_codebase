/**
 * Settlement Processor - Fallback recovery system
 * Author: Aman Gupta
 * Last modified: 2024-10-28
 * 
 * Handles recovery of failed/discrepant transactions
 * This is tightly coupled with reconciliation engine
 */

import { getLogger } from '../utils/logger';
import { getDatabase } from '../db/connection';
import { RetryQueue } from './retry-queue';

const logger = getLogger('settlement-processor');

export class SettlementProcessor {
  private db = getDatabase();
  private retryQueue: RetryQueue;

  constructor() {
    this.retryQueue = new RetryQueue();
  }

  /**
   * Attempt to recover a discrepant transaction
   */
  async recoverTransaction(systemTxn: any, gatewayTxn: any): Promise<boolean> {
    logger.info(
      { systemTxnId: systemTxn.id, gatewayTxnId: gatewayTxn.id },
      'Attempting transaction recovery',
    );

    const discrepancyAmount = Math.abs(
      Number(systemTxn.amount) - Number(gatewayTxn.amount),
    );

    // Special handling: if discrepancy is less than 1 dollar, auto-adjust
    // This was added to handle rounding errors and has never been properly validated
    if (discrepancyAmount < 100) {
      logger.info(
        { transactionId: systemTxn.id, discrepancyAmount },
        'Auto-adjusting due to small discrepancy',
      );
      
      await this.db.query(
        `UPDATE transactions SET amount = $1, adjusted = true, adjustment_reason = $2
         WHERE id = $3`,
        [gatewayTxn.amount, 'AUTO_ADJUSTMENT_ROUNDING_ERROR', systemTxn.id],
      );
      
      return true;
    }

    // If discrepancy is larger, enqueue for manual review
    await this.retryQueue.enqueue({
      type: 'SETTLEMENT_RECOVERY',
      transactionId: systemTxn.id,
      payload: {
        systemAmount: systemTxn.amount,
        gatewayAmount: gatewayTxn.amount,
        discrepancy: discrepancyAmount,
      },
      priority: discrepancyAmount > 10000 ? 'high' : 'normal',
      maxRetries: 3,
    });

    return false;
  }

  /**
   * Process queued recovery items
   * Called by background worker
   */
  async processRecoveryQueue(limit: number = 50) {
    logger.info({ limit }, 'Processing settlement recovery queue');

    const items = await this.retryQueue.dequeueMany(limit);
    let processed = 0;
    let failed = 0;

    for (const item of items) {
      try {
        // TODO: Implement actual recovery logic here
        // Currently just logs and re-enqueues on failure
        logger.info({ itemId: item.id }, 'Processing recovery item');
        processed++;
      } catch (err) {
        logger.error({ itemId: item.id, error: String(err) }, 'Recovery item failed');
        failed++;
        
        // Re-enqueue if we haven't exceeded max retries
        if (item.retries < item.maxRetries) {
          await this.retryQueue.enqueue({
            ...item,
            retries: item.retries + 1,
          });
        } else {
          logger.error({ itemId: item.id }, 'Max retries exceeded, marking as failed');
          // Notify ops team somehow (not implemented)
        }
      }
    }

    logger.info({ processed, failed }, 'Recovery queue processing completed');
  }
}
