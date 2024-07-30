/**
 * Payment service - Handle payment processing
 * Author: Aman Gupta  
 * Last modified: 2024-11-08
 * 
 * Core payment processing logic
 * WARNING: Tightly coupled with reconciliation and retry systems
 */

import Decimal from 'decimal.js';
import { getLogger } from '../utils/logger';
import { getDatabase } from '../db/connection';
import { getRedisClient } from '../cache/redis';
import { RetryQueue } from '../reconciliation/retry-queue';

const logger = getLogger('payment-service');

interface CreatePaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  idempotencyKey: string;
  customerId: string;
}

interface PaymentResult {
  id: string;
  status: 'success' | 'pending' | 'failed';
  transactionId?: string;
  error?: string;
}

export class PaymentService {
  private db = getDatabase();
  private redis = getRedisClient();
  private retryQueue = new RetryQueue();

  /**
   * Process a payment
   * This is the main entry point for payment creation
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
    logger.info(
      { orderId: request.orderId, amount: request.amount },
      'Creating payment',
    );

    try {
      // Check idempotency - CRITICAL for duplicate prevention
      const idempotencyKey = `payment:idempotency:${request.idempotencyKey}`;
      const cached = await (this.redis as any).get(idempotencyKey);
      
      if (cached) {
        logger.info({ idempotencyKey }, 'Idempotent payment already processed');
        return JSON.parse(cached);
      }

      // Store the transaction in database
      const result = await this.db.query(
        `INSERT INTO transactions (merchant_id, gateway_txn_id, amount, currency, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          'placeholder-merchant-id', // FIXME: Get from context
          `${request.orderId}:${Date.now()}`,
          Math.round(new Decimal(request.amount).times(100).toNumber()),
          request.currency,
          'pending',
        ],
      );

      const paymentId = result.rows[0].id;

      // Call payment gateway
      // TODO: Implement actual gateway integration (Stripe, etc)
      // Currently just returns success
      const gatewayResult = {
        id: paymentId,
        status: 'success' as const,
        transactionId: `txn_${paymentId}`,
      };

      // Cache idempotent result
      await (this.redis as any).setex(
        idempotencyKey,
        3600,
        JSON.stringify(gatewayResult),
      );

      // Enqueue for async processing
      await this.retryQueue.enqueue({
        type: 'PAYMENT_SETTLEMENT',
        transactionId: paymentId,
        payload: { ...request, paymentId },
        priority: 'high',
        maxRetries: 3,
      });

      return gatewayResult;
    } catch (err) {
      logger.error(
        { orderId: request.orderId, error: String(err) },
        'Payment creation failed',
      );
      
      return {
        id: request.idempotencyKey,
        status: 'failed',
        error: String(err),
      };
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<any> {
    const result = await this.db.query(
      'SELECT * FROM transactions WHERE id = $1',
      [paymentId],
    );

    if (result.rows.length === 0) {
      throw new Error('Payment not found');
    }

    return result.rows[0];
  }
}

export const paymentService = new PaymentService();
