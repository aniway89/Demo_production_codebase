/**
 * Recurring settlement processor
 * Author: Aman Gupta
 * Last modified: 2024-10-22
 * 
 * Daily settlement aggregation and processing
 * WARNING: Complex coordination required
 */

import { getLogger } from '../utils/logger';
import { getDatabase } from '../db/connection';
import Decimal from 'decimal.js';

const logger = getLogger('settlement-aggregator');

/**
 * Run daily settlement aggregation
 * Groups transactions by merchant and processes settlements
 */
export async function runDailySettlement(): Promise<void> {
  logger.info('Starting daily settlement run');

  const db = getDatabase();

  try {
    // Get all merchants with unsettled transactions
    const merchantsResult = await db.query(
      `SELECT DISTINCT merchant_id FROM transactions 
       WHERE status = 'completed' AND settled = false 
       AND created_at < NOW() - INTERVAL '1 day'`,
    );

    let settlementCount = 0;

    for (const row of merchantsResult.rows) {
      try {
        // Aggregate transactions for this merchant
        const transactionsResult = await db.query(
          `SELECT * FROM transactions 
           WHERE merchant_id = $1 
           AND status = 'completed' 
           AND settled = false 
           AND created_at < NOW() - INTERVAL '1 day'`,
          [row.merchant_id],
        );

        if (transactionsResult.rows.length === 0) {
          continue;
        }

        // Calculate total settlement amount
        let totalAmount = new Decimal(0);
        for (const txn of transactionsResult.rows) {
          totalAmount = totalAmount.plus(new Decimal(txn.amount));
        }

        // Apply merchant fee
        // FIXME: Fee structure is hardcoded here too
        const fee = totalAmount.times(0.025); // 2.5%
        const settlementAmount = totalAmount.minus(fee);

        // TODO: Record settlement in database
        // TODO: Create settlement batch record
        // TODO: Trigger payout to merchant
        // TODO: Send settlement report

        logger.info(
          {
            merchantId: row.merchant_id,
            transactionCount: transactionsResult.rows.length,
            grossAmount: totalAmount.toString(),
            fee: fee.toString(),
            netAmount: settlementAmount.toString(),
          },
          'Settlement aggregated',
        );

        settlementCount++;
      } catch (err) {
        logger.error(
          { merchantId: row.merchant_id, error: String(err) },
          'Settlement aggregation failed for merchant',
        );
      }
    }

    logger.info({ settlementCount }, 'Daily settlement completed');
  } catch (err) {
    logger.error('Daily settlement run failed', err);
    // No alerting set up for this failure
    throw err;
  }
}
