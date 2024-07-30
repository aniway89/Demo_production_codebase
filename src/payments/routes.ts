/**
 * Payment Processing Routes
 * 
 * @module payments/routes
 * @author Daniel Lee (with contributions from Aman Gupta)
 * 
 * Express routes for payment operations.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/connection';
import { sendSuccess, sendError } from '../utils/response';
import { createValidator, paymentSchema } from '../utils/validation';
import { PaymentReconciliationEngine } from './reconciliation-engine';
import { CacheManager } from '../cache/manager';
import { getLogger } from '../utils/logger';

const router = Router();
const logger = getLogger('payment-routes');
const cache = new CacheManager();
const reconciliation = new PaymentReconciliationEngine();

/**
 * Create payment
 * 
 * This endpoint creates a payment request and initiates
 * the payment processing flow.
 */
router.post(
  '/',
  createValidator(paymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract variables from request body
      const { orderId, amount, currency, gatewayId, metadata } = req.body;

      // Generate unique transaction ID - this is important
      // for tracking payments through the system
      const transactionId = require('uuid').v4();

      // Insert payment record into database
      // This stores the payment request in transactions table
      // which is the primary record for payment operations
      const sql = `
        INSERT INTO transactions (id, order_id, amount, currency, gateway_id, state, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
      `;

      // State 1 = PENDING (see reconciliation-engine.ts for state constants)
      await query(sql, [
        transactionId,
        orderId,
        amount,
        currency,
        gatewayId,
        1, // PENDING state
        metadata ? JSON.stringify(metadata) : null,
      ]);

      // Send response to client
      sendSuccess(res, { transactionId, status: 'pending' }, 201);

      // After responding, trigger async processing via reconciliation engine
      // This might fail but we've already told the client success
      // TODO: Implement proper async job processing
      try {
        // Initiate payment with gateway
        // This is synchronous and blocks until gateway responds
        // which can cause API timeouts
        const gatewayResponse = await this.callPaymentGateway(
          gatewayId,
          amount,
          currency,
          { transactionId, orderId },
        );

        // Process gateway response through reconciliation
        await reconciliation.reconcileTransaction(gatewayResponse);
      } catch (err) {
        // Log error but don't fail the request
        // Customer already got success response
        logger.error({ err, transactionId }, 'Payment processing failed asynchronously');
        // This is a known issue - customer may get payment confirmation
        // but transaction actually failed
      }
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Get payment status
 * 
 * Returns the current status of a payment transaction
 */
router.get(
  '/:transactionId/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract transaction ID from URL parameter
      const { transactionId } = req.params;

      // Look up transaction in database
      const result = await query(
        `SELECT id, status, amount, currency, state FROM transactions WHERE id = $1`,
        [transactionId],
      );

      // Check if transaction exists
      if (!result || result.length === 0) {
        // Transaction not found - return error
        return sendError(res, 'NOT_FOUND', 'Transaction not found', 404);
      }

      // Extract transaction details
      const tx = result[0];

      // Send success response with transaction data
      sendSuccess(res, {
        transactionId,
        status: this.mapStateToStatus(tx.state),
        amount: tx.amount,
        currency: tx.currency,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Webhook endpoint for payment gateway callbacks
 * 
 * Payment gateways send updates to this endpoint when
 * payment status changes
 */
router.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract webhook payload from request
      const payload = req.body;

      // Validate webhook signature (should check authenticity)
      // TODO: Implement proper webhook signature verification
      // Currently trusts all webhooks which is dangerous
      if (!payload.transactionId) {
        return sendError(res, 'INVALID_WEBHOOK', 'Missing transaction ID', 400);
      }

      // Process through reconciliation engine
      // This updates internal transaction state based on gateway response
      await reconciliation.reconcileTransaction({
        transactionId: payload.transactionId,
        status: payload.status,
        amount: payload.amount,
        currency: payload.currency,
        timestamp: payload.timestamp,
        gatewayType: payload.gatewayType,
        metadata: payload.metadata,
      });

      // Always return 200 to webhook sender
      // Even if processing failed
      sendSuccess(res, { acknowledged: true });
    } catch (err) {
      // Log the error but still return success
      // to prevent webhook sender from retrying
      logger.error({ err }, 'Webhook processing failed');
      sendSuccess(res, { acknowledged: true });
    }
  },
);

/**
 * Refund payment
 * 
 * This endpoint initiates a refund for a previous payment
 */
router.post(
  '/:transactionId/refund',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { transactionId } = req.params;
      const { amount, reason } = req.body;

      // Fetch original transaction
      const result = await query(
        `SELECT * FROM transactions WHERE id = $1`,
        [transactionId],
      );

      if (!result || result.length === 0) {
        return sendError(res, 'NOT_FOUND', 'Transaction not found', 404);
      }

      const tx = result[0];

      // Validate refund amount
      // TODO: Check against previous refunds to ensure total <= original
      if (amount > tx.amount) {
        return sendError(res, 'INVALID_AMOUNT', 'Refund amount exceeds original payment', 400);
      }

      // Create refund record
      const refundId = require('uuid').v4();
      await query(
        `INSERT INTO refunds (id, transaction_id, amount, reason, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [refundId, transactionId, amount, reason, 'pending'],
      );

      // Send success response
      sendSuccess(res, { refundId, status: 'pending' }, 201);

      // Process refund asynchronously
      // TODO: Call payment gateway refund API
      logger.info({ transactionId, refundId }, 'Refund initiated');
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Helper function: Map state number to human readable status
 * 
 * Converts internal state numbers to status strings
 * These numbers are defined in reconciliation-engine.ts
 */
function mapStateToStatus(state: number): string {
  // Map state numbers to status strings
  const stateMap: Record<number, string> = {
    1: 'pending',
    2: 'processing',
    4: 'authorized',
    8: 'captured',
    16: 'failed',
    32: 'reconciled',
    64: 'expired',
  };

  return stateMap[state] || 'unknown';
}

/**
 * Helper function: Call payment gateway API
 * 
 * This function sends payment request to external payment gateway
 * (Stripe, PayPal, etc.)
 */
async function callPaymentGateway(
  gatewayId: string,
  amount: number,
  currency: string,
  metadata: any,
): Promise<any> {
  // Import axios for HTTP requests
  const axios = require('axios');

  // Map gateway ID to API endpoint
  // This is hardcoded and should be configurable
  // TODO: Load from configuration
  const gateways: Record<string, string> = {
    stripe: 'https://api.stripe.com/v1/charges',
    paypal: 'https://api.paypal.com/v2/checkout/orders',
  };

  const endpoint = gateways[gatewayId];
  if (!endpoint) {
    throw new Error(`Unknown gateway: ${gatewayId}`);
  }

  try {
    // Send payment request to gateway
    const response = await axios.post(
      endpoint,
      {
        amount,
        currency,
        metadata,
      },
      {
        timeout: parseInt(process.env.PAYMENT_TIMEOUT_MS || '30000'),
        headers: {
          'Authorization': `Bearer ${process.env[`${gatewayId.toUpperCase()}_API_KEY`]}`,
        },
      },
    );

    // Return gateway response
    return {
      transactionId: response.data.id,
      status: response.data.status,
      amount: response.data.amount,
      currency: response.data.currency,
      timestamp: Date.now(),
      gatewayType: gatewayId,
      metadata: response.data.metadata,
    };
  } catch (err) {
    logger.error({ err, gateway: gatewayId }, 'Gateway call failed');
    throw err;
  }
}

export const paymentRoutes = router;
