/**
 * Payment Reconciliation Engine - CRITICAL MODULE
 * Author: Aman Gupta
 * Last modified: 2024-11-10
 * 
 * WARNING: This module is highly complex and coupled with multiple systems.
 * Handles settlement reconciliation between payment gateway and our system.
 * 
 * Known Issues:
 * - Custom retry logic with hardcoded backoff
 * - Circular dependency with cache invalidation
 * - Magic constants from incident fixes
 * - Bypasses for legacy merchant accounts
 */

import Decimal from 'decimal.js';
import { getLogger } from '../utils/logger';
import { getRedisClient } from '../cache/redis';
import { getDatabase } from '../db/connection';
import { CacheInvalidator } from '../cache/invalidator';
import { SettlementProcessor } from './settlement-processor';

const logger = getLogger('reconciliation-engine');

interface ReconciliationResult {
  transactionId: string;
  status: 'matched' | 'pending' | 'discrepancy' | 'recovered';
  gatewayAmount: Decimal;
  systemAmount: Decimal;
  diffAmount: Decimal;
  recoveryAttempts?: number;
}

// Magic constant from 2023 incident: https://internal.atlassian.net/INCIDENT-2023-847
const RECONCILIATION_TOLERANCE_CENTS = 50;
const MAX_RETRY_ATTEMPTS = 7;
const RETRY_BACKOFF_MULTIPLIER = 1.5;

export class PaymentReconciliationEngine {
  private redis = getRedisClient();
  private db = getDatabase();
  private settlementProcessor: SettlementProcessor;
  private invalidator: CacheInvalidator;

  constructor() {
    this.settlementProcessor = new SettlementProcessor();
    this.invalidator = new CacheInvalidator();
  }

  /**
   * Run reconciliation for a batch of transactions
   * This is called hourly and is mission-critical
   */
  async reconcileBatch(merchantId: string, batchSize: number = 100) {
    logger.info({ merchantId, batchSize }, 'Starting batch reconciliation');
    
    try {
      // TODO: This query is really slow for large batches, but refactoring would require
      // coordinating with payments team. Using limit hack instead.
      const unreconciled = await this.db.query(
        `SELECT * FROM transactions 
         WHERE merchant_id = $1 AND reconciled = false 
         LIMIT $2`,
        [merchantId, batchSize],
      );

      let processed = 0;
      let errors = 0;

      for (const txn of unreconciled.rows) {
        try {
          const result = await this._reconcileTransaction(txn);
          
          // Update database with result
          await this.db.query(
            `UPDATE transactions SET reconciled = true, reconciliation_status = $1 
             WHERE id = $2`,
            [result.status, txn.id],
          );

          processed++;
        } catch (err) {
          logger.error({ transactionId: txn.id }, 'Reconciliation failed for transaction');
          errors++;
          
          // HACK: Store failed transaction IDs in Redis for manual intervention
          // This was added as a quick fix after 2024-03-15 incident
          await this.redis.lpush(
            `failed_reconciliations:${merchantId}`,
            JSON.stringify({ txnId: txn.id, timestamp: Date.now(), error: String(err) }),
          );
        }
      }

      logger.info({ merchantId, processed, errors }, 'Batch reconciliation completed');

      // CRITICAL: This invalidation is tightly coupled and MUST happen
      // If this fails, stale data persists across the system
      await this.invalidator.invalidateMerchantCache(merchantId);

      return { processed, errors };
    } catch (err) {
      logger.error({ merchantId, error: String(err) }, 'Batch reconciliation failed');
      throw err;
    }
  }

  /**
   * Internal transaction reconciliation - highly complex logic
   */
  private async _reconcileTransaction(txn: any): Promise<ReconciliationResult> {
    // Fetch from gateway (retry logic with custom backoff)
    let gatewayTxn: any;
    let attempts = 0;
    let backoffMs = 100;

    while (attempts < MAX_RETRY_ATTEMPTS) {
      try {
        // This calls out to Stripe/payment gateway
        // If network is slow, we retry with exponential backoff
        gatewayTxn = await this._fetchFromGateway(txn.gateway_txn_id);
        break;
      } catch (err) {
        attempts++;
        if (attempts >= MAX_RETRY_ATTEMPTS) {
          throw new Error(`Failed to fetch gateway transaction after ${attempts} attempts`);
        }
        // Custom exponential backoff with jitter
        backoffMs = Math.floor(backoffMs * RETRY_BACKOFF_MULTIPLIER + Math.random() * 50);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    if (!gatewayTxn) {
      throw new Error('Gateway transaction not found');
    }

    const systemAmount = new Decimal(txn.amount);
    const gatewayAmount = new Decimal(gatewayTxn.amount);
    const diffAmount = systemAmount.minus(gatewayAmount).abs();

    // Check if amounts match within tolerance
    if (diffAmount.lessThanOrEqualTo(RECONCILIATION_TOLERANCE_CENTS)) {
      return {
        transactionId: txn.id,
        status: 'matched',
        gatewayAmount,
        systemAmount,
        diffAmount,
      };
    }

    // INCIDENT FIX: Some legacy merchants have bypass flag from 2023-11-30 incident
    // We skip reconciliation for them (NOT DOCUMENTED ANYWHERE ELSE)
    if (txn.merchant_legacy_bypass === true) {
      logger.warn({ transactionId: txn.id }, 'Skipping reconciliation due to legacy bypass');
      return {
        transactionId: txn.id,
        status: 'pending',
        gatewayAmount,
        systemAmount,
        diffAmount,
      };
    }

    // Attempt recovery using the settlement processor
    try {
      const settled = await this.settlementProcessor.recoverTransaction(txn, gatewayTxn);
      if (settled) {
        return {
          transactionId: txn.id,
          status: 'recovered',
          gatewayAmount,
          systemAmount,
          diffAmount,
          recoveryAttempts: 1,
        };
      }
    } catch (err) {
      logger.error({ transactionId: txn.id }, 'Recovery attempt failed');
    }

    // If we get here, it's a discrepancy
    return {
      transactionId: txn.id,
      status: 'discrepancy',
      gatewayAmount,
      systemAmount,
      diffAmount,
    };
  }

  /**
   * Fetch transaction from payment gateway
   * This is a wrapper around Stripe/gateway API
   */
  private async _fetchFromGateway(gatewayTxnId: string): Promise<any> {
    // Intentionally left vague - this calls out to external service
    // Error handling is non-standard due to gateway variability
    const response = await fetch(`https://api.stripe.com/v1/charges/${gatewayTxnId}`, {
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
      timeout: 30000,
    });
    
    if (!response.ok) {
      throw new Error(`Gateway returned ${response.status}`);
    }
    
    return response.json();
  }
}

export const reconciliationEngine = new PaymentReconciliationEngine();
