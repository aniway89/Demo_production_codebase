/**
 * Manual Settlement & Reconciliation Script
 * 
 * @module scripts/manual-reconciliation
 * @author Aman Gupta, Operations Team
 * 
 * Emergency script for manual reconciliation and settlement
 * when automated systems fail.
 * 
 * WARNING: This bypasses all validation and safety checks.
 * Only run with proper approval from finance team.
 * 
 * Usage:
 * npm run reconcile -- --transactionId=<id> --status=<status>
 * npm run reconcile -- --settleMerchant=<merchantId>
 * npm run reconcile -- --repairOrder=<orderId>
 */

import { query, transaction } from '../db/connection';
import { PaymentReconciliationEngine } from '../payments/reconciliation-engine';
import { SettlementProcessor } from '../payments/settlement-processor';
import { CacheManager } from '../cache/manager';
import { getLogger } from '../utils/logger';

const logger = getLogger('manual-reconciliation');
const cache = new CacheManager();
const reconciliation = new PaymentReconciliationEngine();
const settlement = new SettlementProcessor();

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  logger.warn('WARNING: Manual reconciliation script started');
  logger.warn('This bypasses all validation checks');

  try {
    if (args.includes('--help')) {
      printHelp();
      return;
    }

    // Parse arguments
    const transactionId = extractArg(args, 'transactionId');
    const settleMerchant = extractArg(args, 'settleMerchant');
    const repairOrder = extractArg(args, 'repairOrder');
    const force = args.includes('--force');

    if (transactionId) {
      const status = extractArg(args, 'status') || 'captured';
      logger.warn({ transactionId, status }, 'Manually reconciling transaction');
      if (!force) {
        const confirmed = await confirmAction(
          `Reconcile transaction ${transactionId} as ${status}?`,
        );
        if (!confirmed) {
          logger.info('Cancelled by user');
          process.exit(0);
        }
      }
      await manualReconcile(transactionId, status);
    } else if (settleMerchant) {
      logger.warn({ settleMerchant }, 'Manually settling merchant');
      if (!force) {
        const confirmed = await confirmAction(`Settle all pending orders for merchant ${settleMerchant}?`);
        if (!confirmed) {
          logger.info('Cancelled by user');
          process.exit(0);
        }
      }
      await manualSettleMerchant(settleMerchant);
    } else if (repairOrder) {
      logger.warn({ repairOrder }, 'Repairing order');
      if (!force) {
        const confirmed = await confirmAction(`Repair order ${repairOrder}?`);
        if (!confirmed) {
          logger.info('Cancelled by user');
          process.exit(0);
        }
      }
      await repairOrderLogic(repairOrder);
    } else {
      printHelp();
    }

    logger.info('Manual reconciliation completed');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Manual reconciliation failed');
    process.exit(1);
  }
}

/**
 * Manual reconciliation of a transaction
 */
async function manualReconcile(transactionId: string, status: string): Promise<void> {
  try {
    await transaction(async (client) => {
      // Fetch transaction
      const result = await query(
        `SELECT * FROM transactions WHERE id = $1`,
        [transactionId],
      );

      if (!result || result.length === 0) {
        throw new Error('Transaction not found');
      }

      const tx = result[0];

      // Map status to state
      const stateMap: Record<string, number> = {
        authorized: 4,
        captured: 8,
        failed: 16,
        reconciled: 32,
      };

      const newState = stateMap[status.toLowerCase()];
      if (!newState) {
        throw new Error(`Invalid status: ${status}`);
      }

      // Force update state
      // This bypasses all validation
      await query(
        `UPDATE transactions SET state = $1, updated_at = NOW() WHERE id = $2`,
        [newState, transactionId],
      );

      // Log the manual change
      await query(
        `INSERT INTO manual_reconciliation_log (transaction_id, old_state, new_state, timestamp)
         VALUES ($1, $2, $3, NOW())`,
        [transactionId, tx.state, newState],
      );

      logger.info({ transactionId, oldState: tx.state, newState }, 'Transaction manually reconciled');
    });
  } catch (err) {
    logger.error({ err, transactionId }, 'Manual reconciliation failed');
    throw err;
  }
}

/**
 * Manually settle all orders for a merchant
 */
async function manualSettleMerchant(merchantId: string): Promise<void> {
  try {
    // Get all unsettled transactions for merchant
    const transactions = await query<any[]>(
      `SELECT t.* FROM transactions t
       JOIN orders o ON t.order_id = o.id
       WHERE o.merchant_id = $1 AND t.state NOT IN (32, 16)`,
      [merchantId],
    );

    logger.warn({ merchantId, count: transactions.length }, 'Settling transactions');

    for (const tx of transactions) {
      try {
        // Force settlement
        await settlement.manualSettlement(tx.id);
      } catch (err) {
        logger.error({ err, transactionId: tx.id }, 'Manual settlement failed for transaction');
      }
    }

    logger.info({ merchantId, count: transactions.length }, 'Manual merchant settlement completed');
  } catch (err) {
    logger.error({ err, merchantId }, 'Manual merchant settlement failed');
    throw err;
  }
}

/**
 * Repair an order when something is broken
 * 
 * This is for fixing orders that got into bad states
 */
async function repairOrderLogic(orderId: string): Promise<void> {
  try {
    const result = await query<any[]>(
      `SELECT * FROM orders WHERE id = $1`,
      [orderId],
    );

    if (!result || result.length === 0) {
      throw new Error('Order not found');
    }

    const order = result[0];

    // Log the repair
    logger.warn({ orderId, oldStatus: order.status }, 'Repairing order');

    // Invalidate cache for this order
    await cache.invalidate(`order:${orderId}`);

    // Mark as repaired
    await query(
      `UPDATE orders SET status = $1, repaired_at = NOW() WHERE id = $2`,
      ['repaired', orderId],
    );

    logger.info({ orderId }, 'Order repair completed');
  } catch (err) {
    logger.error({ err, orderId }, 'Order repair failed');
    throw err;
  }
}

/**
 * Helper: Extract argument from args array
 */
function extractArg(args: string[], name: string): string | undefined {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : undefined;
}

/**
 * Helper: Print help text
 */
function printHelp(): void {
  console.log(`
Manual Reconciliation Script

Usage:
  npm run reconcile -- --transactionId=<id> [--status=<status>] [--force]
  npm run reconcile -- --settleMerchant=<merchantId> [--force]
  npm run reconcile -- --repairOrder=<orderId> [--force]

Examples:
  npm run reconcile -- --transactionId=abc123 --status=captured
  npm run reconcile -- --settleMerchant=MERCHANT_001 --force
  npm run reconcile -- --repairOrder=order456

Options:
  --force     Skip confirmation prompt
  --help      Show this message
  `);
}

/**
 * Helper: Ask for confirmation
 * 
 * This is a safeguard but can be bypassed with --force
 */
async function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(`${message} (yes/no): `);
    process.stdin.once('data', (data) => {
      const answer = data.toString().trim().toLowerCase();
      resolve(answer === 'yes' || answer === 'y');
    });
  });
}

// Run if executed directly
if (require.main === module) {
  main();
}
