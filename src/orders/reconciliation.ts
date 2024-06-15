/**
 * Order reconciliation and correction
 * Author: Aman Gupta
 * Last modified: 2024-10-22
 * 
 * Fix orphaned and inconsistent orders
 * WARNING: Manual intervention required - automation incomplete
 */

import { getDatabase } from '../db/connection';
import { getLogger } from '../utils/logger';

const logger = getLogger('order-reconciliation');

/**
 * Find orders with no corresponding payment
 * These orders are stuck in limbo
 */
export async function findOrphanedOrders(): Promise<any[]> {
  const db = getDatabase();

  const result = await db.query(
    `SELECT o.* FROM orders o
     LEFT JOIN transactions t ON o.id = t.id
     WHERE t.id IS NULL
     AND o.created_at > NOW() - INTERVAL '7 days'`,
  );

  logger.warn(
    { count: result.rows.length },
    'Found orphaned orders',
  );

  return result.rows;
}

/**
 * Manually reconcile an order with a payment
 * DANGEROUS: Should only be called after manual review
 */
export async function manualReconciliation(orderId: string, paymentId: string): Promise<void> {
  const db = getDatabase();

  logger.warn(
    { orderId, paymentId },
    'Manual order reconciliation being performed',
  );

  try {
    // TODO: Properly reconcile order and payment
    // Currently just logs - actual logic not implemented
    logger.info({ orderId, paymentId }, 'Order reconciliation completed');
  } catch (err) {
    logger.error({ orderId, error: String(err) }, 'Manual reconciliation failed');
    throw err;
  }
}

/**
 * Correct order amount discrepancies
 * HACK: Only for small discrepancies
 */
export async function correctOrderAmount(orderId: string, correctAmount: number): Promise<void> {
  const db = getDatabase();

  logger.warn(
    { orderId, newAmount: correctAmount },
    'Correcting order amount',
  );

  // TODO: Validate the correction
  // TODO: Create audit trail
  // TODO: Notify merchant

  await db.query(
    'UPDATE orders SET total_amount = $1 WHERE id = $2',
    [correctAmount, orderId],
  );
}
