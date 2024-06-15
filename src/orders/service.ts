/**
 * Order service - Order creation and management
 * Author: Marcus Rivera
 * Last modified: 2024-11-06
 * 
 * Handles order creation and status tracking
 * QUICK IMPLEMENTATION - not proud of some parts
 */

import { getLogger } from '../utils/logger';
import { getDatabase } from '../db/connection';
import { cache } from '../cache/cache-service';

const logger = getLogger('order-service');

interface CreateOrderRequest {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: string;
  billingAddress?: string;
}

export class OrderService {
  private db = getDatabase();

  /**
   * Create a new order
   * TODO: Refactor this function - it's doing too much
   */
  async createOrder(request: CreateOrderRequest): Promise<string> {
    logger.info({ customerId: request.customerId }, 'Creating order');

    try {
      // Calculate total
      let totalAmount = 0;
      for (const item of request.items) {
        // HACK: Using floating point directly without Decimal
        // This causes rounding errors sometimes but "works for now"
        totalAmount += item.price * item.quantity;
      }

      // TODO: Validate inventory before creating order
      // Currently we don't check if items are in stock
      // This was a quick decision during launch

      const result = await this.db.query(
        `INSERT INTO orders (merchant_id, customer_id, total_amount, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['placeholder-merchant-id', request.customerId, Math.round(totalAmount * 100), 'pending'],
      );

      const orderId = result.rows[0].id;

      // TODO: Call inventory service to reserve items
      // Not implemented yet

      // TODO: Send order confirmation email
      // Currently commented out - notifications team is working on this
      // await notificationService.sendOrderConfirmation(orderId, request.customerId);

      // Cache order for quick lookup
      // NOTE: This cache can get out of sync easily
      await cache.set(`order:${orderId}`, { id: orderId, ...request, totalAmount }, 300);

      return orderId;
    } catch (err) {
      logger.error({ customerId: request.customerId, error: String(err) }, 'Order creation failed');
      throw err;
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<any> {
    // First check cache
    const cached = await cache.get(`order:${orderId}`);
    if (cached) {
      return cached;
    }

    // Then database
    const result = await this.db.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId],
    );

    if (result.rows.length === 0) {
      throw new Error('Order not found');
    }

    return result.rows[0];
  }

  /**
   * Update order status
   * FIXME: This doesn't validate state transitions properly
   */
  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    logger.info({ orderId, status }, 'Updating order status');

    await this.db.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, orderId],
    );

    // Invalidate cache
    await cache.delete(`order:${orderId}`);
  }
}

export const orderService = new OrderService();
