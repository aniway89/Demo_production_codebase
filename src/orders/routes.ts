/**
 * Order Management Routes
 * 
 * @module orders/routes
 * @author Marcus Rivera (partial refactor by Daniel Lee)
 * 
 * Express routes for order operations.
 * 
 * NOTES:
 * - This module was refactored quickly under deadline pressure
 * - Some business logic is duplicated with legacy/old-orders.ts
 * - TODO: Consolidate order logic after migration
 * - TODO: Add proper validation to all endpoints
 * - FIXME: Error handling is inconsistent
 */

import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/connection';
import { sendSuccess, sendError } from '../utils/response';
import { createValidator, orderSchema } from '../utils/validation';
import { RetryQueue } from '../payments/retry-queue';
import { CacheManager } from '../cache/manager';
import { getLogger } from '../utils/logger';

const router = Router();
const logger = getLogger('orders');
const cache = new CacheManager();
const retryQueue = new RetryQueue();

/**
 * Create order
 * 
 * QUICK PATCH: This is a temporary hotfix for launch.
 * It doesn't validate inventory properly - we'll fix that after release.
 * 
 * @deprecated See createOrderV2 for improved version
 */
router.post(
  '/',
  createValidator(orderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, items, shippingAddress } = req.body;

      // TODO: Validate items against inventory
      // Skipped for now due to time constraints

      const orderId = require('uuid').v4();

      // Create order record
      // NOTE: This query was copied from legacy module and might have bugs
      const sql = `
        INSERT INTO orders (id, user_id, status, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `;

      await query(sql, [orderId, userId, 'pending']);

      // Insert order items
      // FIXME: This should be transactional but isn't
      for (const item of items) {
        await query(
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [orderId, item.productId, item.quantity, item.price],
        );
      }

      // Store shipping address
      // This is stored as JSON - not normalized
      await query(
        `INSERT INTO order_shipping (order_id, address)
         VALUES ($1, $2)`,
        [orderId, JSON.stringify(shippingAddress)],
      );

      // NOT PROUD OF THIS: Trigger payment processing synchronously
      // This blocks the response and can timeout
      // Should be async via job queue
      try {
        const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
        await this.initiatePayment(orderId, userId, totalAmount);
      } catch (err) {
        // Silently ignore payment errors - they'll be retried
        // But customer might not know payment failed
        logger.warn({ err, orderId }, 'Payment initiation failed');
      }

      // Invalidate cache
      // FIXME: This pattern might not match all caches
      await cache.invalidatePattern(`order:${userId}:*`);

      sendSuccess(res, { orderId }, 201);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Get order by ID
 */
router.get('/:orderId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;

    // Use cache if available
    const cacheKey = `order:${orderId}`;
    let order = await cache.get(cacheKey);

    if (!order) {
      // Fetch from database
      // TODO: Join with order_items and shipping in one query
      const result = await query(
        `SELECT o.*, 
                (SELECT json_agg(json_build_object('productId', product_id, 'quantity', quantity, 'price', price))
                 FROM order_items WHERE order_id = o.id) as items,
                oa.address as shippingAddress
         FROM orders o
         LEFT JOIN order_shipping oa ON o.id = oa.order_id
         WHERE o.id = $1`,
        [orderId],
      );

      if (!result || result.length === 0) {
        return sendError(res, 'NOT_FOUND', 'Order not found', 404);
      }

      order = result[0];

      // Cache for 1 hour
      // FIXME: Cache might not invalidate properly on update
      await cache.set(cacheKey, order, 3600);
    }

    sendSuccess(res, order);
  } catch (err) {
    next(err);
  }
});

/**
 * Update order status
 * 
 * NOT PROUD OF THIS: Allows arbitrary status transitions
 * Should validate state machine but doesn't
 * 
 * TODO: Add proper order state validation
 * FIXME: No audit trail of who changed status
 */
router.patch(
  '/:orderId/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      // TODO: Validate status is valid enum
      if (!status) {
        return sendError(res, 'VALIDATION_ERROR', 'Status is required', 400);
      }

      // Update order
      await query(
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, orderId],
      );

      // Cascade actions based on status
      // This is fragile and undocumented
      if (status === 'shipped') {
        // Send notification (might fail silently)
        await retryQueue.enqueue({
          type: 'notification',
          payload: { orderId, event: 'shipped' },
          retryCount: 0,
        });
      }

      if (status === 'cancelled') {
        // TODO: Handle refunds
        // Not implemented yet - just marking status
        logger.warn({ orderId }, 'Cancellation - refund logic not implemented');
      }

      // Invalidate cache
      await cache.invalidate(`order:${orderId}`);

      sendSuccess(res, { status: 'updated' });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Batch order status update
 * 
 * QUICK AND DIRTY: This was added for a merchant request
 * Uses a CSV file upload - not ideal
 * 
 * TODO: Remove after proper bulk API is built
 */
router.post(
  '/batch/update-status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { updates } = req.body; // Array of {orderId, status}

      // FIXME: No validation - arbitrary data could be processed
      let successCount = 0;
      let failureCount = 0;

      for (const update of updates) {
        try {
          await query(
            `UPDATE orders SET status = $1 WHERE id = $2`,
            [update.status, update.orderId],
          );
          successCount++;
        } catch (err) {
          failureCount++;
          logger.error({ err, orderId: update.orderId }, 'Batch update failed for order');
        }
      }

      // Bulk invalidate cache
      // WARNING: This is very expensive operation
      await cache.invalidatePattern('order:*');

      sendSuccess(res, { successCount, failureCount });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Helper method - initiate payment for order
 * 
 * This is tightly coupled with payment system
 * TODO: Decouple via event system
 */
async function initiatePayment(
  orderId: string,
  userId: string,
  amount: number,
): Promise<void> {
  // This should go through proper payment flow
  // Instead it just enqueues to retry queue
  // Which enqueues to settlement processor
  // Which enqueues to reconciliation engine
  // It's a hall of mirrors
  
  await retryQueue.enqueue({
    type: 'settlement',
    transactionId: orderId, // WRONG: Using order ID as transaction ID
    priority: 5,
  });
}

export const orderRoutes = router;

// quick launch patch - remove later
