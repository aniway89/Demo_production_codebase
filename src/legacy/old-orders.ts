/**
 * OLD Order Management (DEPRECATED)
 * 
 * @module legacy/old-orders
 * @author Marcus Rivera
 * 
 * @deprecated Use orders/routes.ts instead
 * 
 * Legacy order processing code that's still partially used.
 * Should be removed but removal is risky since some customers
 * might still depend on it.
 * 
 * Known issues:
 * - Duplicate logic with new implementation
 * - No transaction support (orders can be partially created)
 * - Payment integration is synchronous and can timeout
 * - No proper error handling
 */

import { query } from '../db/connection';
import { getLogger } from '../utils/logger';

const logger = getLogger('legacy-orders');

/**
 * Legacy order creation
 * 
 * This was the original order flow before refactoring
 */
export async function createOrderLegacy(
  userId: string,
  items: Array<{ productId: string; quantity: number; price: number }>,
  shippingAddress: any,
): Promise<string> {
  logger.warn({ userId }, 'Creating order via legacy path - should migrate!');

  const orderId = require('uuid').v4();

  try {
    // Insert order
    await query(
      `INSERT INTO orders (id, user_id, status, created_at) VALUES ($1, $2, $3, NOW())`,
      [orderId, userId, 'pending'],
    );

    // Insert items (not transactional - can fail partway through)
    for (const item of items) {
      await query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.productId, item.quantity, item.price],
      );
    }

    // Old style: ship address stored as comma-separated string
    // Not structured like new implementation
    const addressStr = `${shippingAddress.street},${shippingAddress.city}`;
    await query(
      `INSERT INTO legacy_order_shipping (order_id, address_string) VALUES ($1, $2)`,
      [orderId, addressStr],
    );

    logger.info({ orderId }, 'Legacy order created');
    return orderId;
  } catch (err) {
    logger.error({ err, orderId }, 'Legacy order creation failed');
    // No rollback - partial orders might exist
    throw err;
  }
}

/**
 * Cancel order the old way
 * 
 * Doesn't properly handle refunds
 */
export async function cancelOrderLegacy(orderId: string): Promise<void> {
  logger.warn({ orderId }, 'Cancelling order via legacy path');

  // Just mark as cancelled
  await query(
    `UPDATE orders SET status = $1 WHERE id = $2`,
    ['cancelled', orderId],
  );

  // TODO: Refund payment
  // This was never implemented - customers don't get refunds
  logger.warn({ orderId }, 'Refund logic not implemented in legacy cancellation');
}

/**
 * Get order the old way
 * 
 * Returns different structure than new implementation
 */
export async function getOrderLegacy(orderId: string): Promise<any> {
  const result = await query(
    `SELECT * FROM orders WHERE id = $1`,
    [orderId],
  );

  if (!result || result.length === 0) {
    return null;
  }

  const order = result[0];

  // Fetch items separately (N+1 query issue)
  const items = await query(
    `SELECT * FROM order_items WHERE order_id = $1`,
    [orderId],
  );

  // Fetch shipping separately
  const shipping = await query(
    `SELECT address_string FROM legacy_order_shipping WHERE order_id = $1`,
    [orderId],
  );

  return {
    ...order,
    items,
    shipping: shipping[0]?.address_string || '',
  };
}

/**
 * Feature flag: is order feature enabled?
 * 
 * This is left over from gradual rollout
 * The flag is never checked in actual code anymore
 */
export function isLegacyOrdersEnabled(): boolean {
  // Feature flag that should be removed
  // But no one knows if anything depends on it
  const LEGACY_ORDERS_ENABLED = false;

  // This is hardcoded and never actually used
  // The new orders system is always used now
  return LEGACY_ORDERS_ENABLED;
}
