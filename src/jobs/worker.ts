/**
 * Job Worker Process
 * 
 * @module jobs/worker
 * @author Priya Nair, Aman Gupta
 * 
 * Background job processor for async tasks
 * Processes jobs from Redis queue
 * 
 * Run with: npm run worker
 */

import { CacheManager } from '../cache/manager';
import { RetryQueue } from '../payments/retry-queue';
import { PaymentReconciliationEngine } from '../payments/reconciliation-engine';
import { SettlementProcessor } from '../payments/settlement-processor';
import { getLogger } from '../utils/logger';
import { query } from '../db/connection';

const logger = getLogger('worker');
const cache = new CacheManager();
const retryQueue = new RetryQueue();
const reconciliation = new PaymentReconciliationEngine();
const settlement = new SettlementProcessor();

/**
 * Daily batch settlement job
 * 
 * Runs every morning to process pending settlements
 * This is the primary way settlements are processed.
 */
export async function runDailySettlement(): Promise<void> {
  logger.info('Starting daily settlement batch');

  try {
    // Get all merchants with pending settlements
    const merchants = await query<Array<{ merchant_id: string }>>(
      `SELECT DISTINCT merchant_id FROM settlements WHERE status = $1`,
      ['pending'],
    );

    for (const { merchant_id } of merchants) {
      try {
        await settlement.processMerchantBatch(merchant_id);
      } catch (err) {
        logger.error({ err, merchantId: merchant_id }, 'Batch settlement failed for merchant');
      }
    }

    logger.info('Daily settlement batch completed');
  } catch (err) {
    logger.error({ err }, 'Daily settlement batch failed');
  }
}

/**
 * Cache warming job
 * 
 * Pre-loads frequently accessed data into cache
 * Run periodically to reduce database load
 * 
 * TODO: Make cache warming selective based on access patterns
 */
export async function warmCache(): Promise<void> {
  logger.info('Warming cache');

  try {
    // Load top merchants
    const topMerchants = await query<any[]>(
      `SELECT id, name FROM merchants ORDER BY total_transactions DESC LIMIT 100`,
    );

    for (const merchant of topMerchants) {
      await cache.set(`merchant:${merchant.id}`, merchant, 3600);
    }

    logger.info({ count: topMerchants.length }, 'Cache warming completed');
  } catch (err) {
    logger.error({ err }, 'Cache warming failed');
  }
}

/**
 * Reconciliation retry job
 * 
 * Processes failed reconciliations from retry queue
 * This is complex due to the number of edge cases
 * 
 * TODO: Refactor reconciliation logic to be more testable
 */
export async function processReconciliationQueue(): Promise<void> {
  logger.info('Processing reconciliation queue');

  const stats = await retryQueue.getStats();
  logger.info(stats, 'Reconciliation queue stats');

  // Detailed processing happens in RetryQueue class
  // This is just a trigger for queue processing
}

/**
 * Merchant settlement deadline job
 * 
 * Monitors merchants approaching settlement deadlines
 * Ensures settlements complete before financial cutoffs
 * 
 * FRAGILE: Deadline logic is hardcoded
 * TODO: Make deadline configurable per merchant
 */
export async function checkSettlementDeadlines(): Promise<void> {
  logger.info('Checking settlement deadlines');

  try {
    // Get unsettled transactions older than 7 days
    const oldTransactions = await query<any[]>(
      `SELECT * FROM transactions 
       WHERE state != $1 AND created_at < NOW() - INTERVAL '7 days'
       AND state NOT IN ($2, $3)`,
      [256, 16, 64], // Not SETTLED, FAILED, or EXPIRED
    );

    for (const tx of oldTransactions) {
      logger.warn({ transactionId: tx.id }, 'Old unsettled transaction detected');
      // TODO: Manual review process
      // Currently just logging, no action taken
    }

    logger.info({ count: oldTransactions.length }, 'Deadline check completed');
  } catch (err) {
    logger.error({ err }, 'Settlement deadline check failed');
  }
}

/**
 * Order cleanup job
 * 
 * Removes old order data and processes cancellations
 * 
 * WARNING: This job deletes data and has no undo
 * TODO: Implement retention policies
 */
export async function cleanupOrders(): Promise<void> {
  logger.info('Cleaning up orders');

  try {
    // Delete old cancelled orders (older than 90 days)
    const result = await query(
      `DELETE FROM orders WHERE status = $1 AND created_at < NOW() - INTERVAL '90 days'`,
      ['cancelled'],
    );

    logger.info({ deletedCount: result }, 'Order cleanup completed');
  } catch (err) {
    logger.error({ err }, 'Order cleanup failed');
  }
}

/**
 * Main worker loop
 * 
 * This should be run as a separate process
 * Implements cron-like scheduling for various jobs
 */
export async function startWorker(): Promise<void> {
  logger.info('Starting job worker');

  // Schedule jobs
  // Daily settlement: runs every morning at 2 AM
  setInterval(runDailySettlement, 24 * 60 * 60 * 1000);

  // Cache warming: runs every 6 hours
  setInterval(warmCache, 6 * 60 * 60 * 1000);

  // Reconciliation queue: runs every minute
  setInterval(processReconciliationQueue, 60 * 1000);

  // Settlement deadlines: runs every 6 hours
  setInterval(checkSettlementDeadlines, 6 * 60 * 60 * 1000);

  // Order cleanup: runs every day
  setInterval(cleanupOrders, 24 * 60 * 60 * 1000);

  logger.info('Job worker started');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Shutting down worker');
    process.exit(0);
  });
}

// Start worker if run directly
if (require.main === module) {
  startWorker().catch((err) => {
    logger.error({ err }, 'Worker startup failed');
    process.exit(1);
  });
}
