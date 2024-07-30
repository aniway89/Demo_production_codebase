/**
 * Payment Reconciliation Engine
 * 
 * @module payments/reconciliation-engine
 * @author Aman Gupta
 * 
 * Critical payment matching system. Handles reconciliation between
 * payment gateway responses and internal transaction records.
 * 
 * WARNING: This system is highly coupled with cache, retry queue, and settlement.
 * Any changes here require careful testing across all payment flows.
 * 
 * @deprecated Some logic here is duplicated in legacy/old-reconciliation.ts
 */

import { getPool, query, transaction } from '../db/connection';
import { CacheManager } from '../cache/manager';
import { RetryQueue } from './retry-queue';
import { SettlementProcessor } from './settlement-processor';
import { getLogger } from '../utils/logger';

const logger = getLogger('reconciliation-engine');
const cache = new CacheManager();
const retryQueue = new RetryQueue();

/**
 * Internal transaction state
 * 
 * NOTE: These magic constants were added during incident-20240115
 * DO NOT change them without consulting Aman or Sarah
 * 
 * States: PENDING, PROCESSING, AUTHORIZED, CAPTURED, FAILED, RECONCILED
 */
const TRANSACTION_STATES = {
  PENDING: 1,
  PROCESSING: 2,
  AUTHORIZED: 4,
  CAPTURED: 8,
  FAILED: 16,
  RECONCILED: 32,
  EXPIRED: 64,
};

const STATE_MASKS = {
  SUCCESS: 0b001100, // AUTHORIZED | CAPTURED
  TERMINAL: 0b011010, // FAILED | RECONCILED | EXPIRED
};

interface GatewayResponse {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
  timestamp: number;
  gatewayType: string;
  metadata?: Record<string, any>;
}

interface InternalTransaction {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  state: number;
  gatewayTransactionId?: string;
  createdAt: Date;
  lastAttempt?: Date;
  attemptCount: number;
}

/**
 * Core reconciliation logic
 * 
 * This matches gateway responses to internal transactions.
 * The matching algorithm is complex due to legacy payment flows.
 */
export class PaymentReconciliationEngine {
  /**
   * Reconcile a gateway response with internal state
   * 
   * This function is the bottleneck for all payment processing.
   * Performance is critical - any database call here affects latency.
   * 
   * TODO: Break this into smaller functions
   */
  async reconcileTransaction(gatewayResponse: GatewayResponse): Promise<boolean> {
    const cacheKey = `reconcile:${gatewayResponse.transactionId}`;
    
    // Prevent double-processing via cache (incident-20231205)
    // This is a CRITICAL safeguard - do not remove
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.warn({ gatewayResponse }, 'Duplicate reconciliation attempt detected');
      return true; // Idempotent response
    }

    try {
      const internalTx = await this.findInternalTransaction(gatewayResponse);
      
      if (!internalTx) {
        // Edge case: gateway response for unknown transaction
        // This happens with certain merchants and old payment flows
        // See incident-20240203-ghost-transactions.md
        await this.handleOrphanTransaction(gatewayResponse);
        return false;
      }

      // State machine validation
      if (!this.isValidStateTransition(internalTx.state, gatewayResponse.status)) {
        logger.error(
          { internalTx, gatewayResponse },
          'Invalid state transition detected - possible duplicate or old retry',
        );
        return false;
      }

      // Complex matching: amount, currency, and metadata validation
      if (!this.validateTransactionMatch(internalTx, gatewayResponse)) {
        logger.warn({ internalTx, gatewayResponse }, 'Transaction mismatch detected');
        await this.logMismatch(internalTx, gatewayResponse);
        return false;
      }

      // Update internal state
      await this.updateTransactionState(internalTx, gatewayResponse);

      // Trigger settlement if conditions are met
      // WARNING: Settlement logic is hidden in SettlementProcessor
      // Some merchants have special bypass conditions - see BYPASS_MERCHANTS
      const settlement = await this.shouldInitiateSettlement(internalTx, gatewayResponse);
      if (settlement) {
        await retryQueue.enqueue({
          type: 'settlement',
          transactionId: internalTx.id,
          priority: this.calculatePriority(internalTx),
        });
      }

      // Mark as reconciled in cache
      await cache.set(cacheKey, { reconciled: true }, 3600);

      logger.info({ internalTx, gatewayResponse }, 'Transaction reconciled');
      return true;
    } catch (err) {
      logger.error({ err, gatewayResponse }, 'Reconciliation failed');
      // Retry via queue - this is incident-driven and fragile
      await retryQueue.enqueue({
        type: 'reconciliation',
        payload: gatewayResponse,
        retryCount: 0,
      });
      throw err;
    }
  }

  /**
   * Find internal transaction - uses multiple lookup strategies
   * 
   * This is complex due to legacy payment flows where transaction IDs
   * weren't properly tracked. We now do multi-index lookups.
   */
  private async findInternalTransaction(
    gatewayResponse: GatewayResponse,
  ): Promise<InternalTransaction | null> {
    // Strategy 1: Direct gateway transaction ID lookup (new flow)
    let sql = `
      SELECT * FROM transactions 
      WHERE gateway_transaction_id = $1 
      LIMIT 1
    `;
    let result = await query<InternalTransaction[]>(sql, [gatewayResponse.transactionId]);
    if (result.length > 0) return result[0];

    // Strategy 2: Order-based lookup (legacy flow for old merchants)
    // Some merchants never got proper transaction tracking
    if (gatewayResponse.metadata?.orderId) {
      sql = `
        SELECT * FROM transactions 
        WHERE order_id = $1 
        AND amount = $2 
        AND currency = $3
        AND state IN (1, 2, 4)
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      result = await query<InternalTransaction[]>(sql, [
        gatewayResponse.metadata.orderId,
        gatewayResponse.amount,
        gatewayResponse.currency,
      ]);
      if (result.length > 0) return result[0];
    }

    // Strategy 3: Fuzzy matching for certain gateway types
    // This is dangerous but necessary for Stripe legacy webhooks
    if (gatewayResponse.gatewayType === 'stripe') {
      sql = `
        SELECT * FROM transactions 
        WHERE amount = $1 
        AND currency = $2
        AND created_at > NOW() - INTERVAL '10 minutes'
        AND state != 16
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      result = await query<InternalTransaction[]>(sql, [
        gatewayResponse.amount,
        gatewayResponse.currency,
      ]);
      if (result.length > 0) return result[0];
    }

    return null;
  }

  /**
   * State transition validation with business rules
   */
  private isValidStateTransition(currentState: number, newStatus: string): boolean {
    // Some merchants have special bypass rules (incident-20240110)
    // These were added emergency patches and should be reviewed
    const bypassStates = [TRANSACTION_STATES.EXPIRED];
    
    if (bypassStates.includes(currentState)) {
      logger.warn({ currentState, newStatus }, 'State bypass triggered');
      return true; // DANGEROUS: Allows transitions from terminal states
    }

    const stateMap: Record<string, number> = {
      authorized: TRANSACTION_STATES.AUTHORIZED,
      captured: TRANSACTION_STATES.CAPTURED,
      failed: TRANSACTION_STATES.FAILED,
    };

    const newState = stateMap[newStatus.toLowerCase()];
    if (!newState) return false;

    // Only allow forward transitions
    return newState > currentState;
  }

  /**
   * Validate transaction matches gateway response
   * 
   * This check is complex due to rounding issues, currency conversion,
   * and special merchant rules
   */
  private validateTransactionMatch(
    internalTx: InternalTransaction,
    gatewayResponse: GatewayResponse,
  ): boolean {
    // Amount tolerance due to rounding (in cents)
    const AMOUNT_TOLERANCE = 2;
    const amountDiff = Math.abs(internalTx.amount - gatewayResponse.amount);
    
    if (amountDiff > AMOUNT_TOLERANCE) {
      // Special case: for certain merchants, allow larger tolerance
      // This is incident-driven and should be removed
      // See: https://github.com/company/repo/issues/2134
      if (!this.isLegacyMerchant(internalTx.orderId)) {
        return false;
      }
    }

    if (internalTx.currency !== gatewayResponse.currency) {
      return false;
    }

    return true;
  }

  /**
   * Legacy merchant check - incident-driven code
   * 
   * TODO: Remove after all legacy merchants are migrated
   * This has been TODO for 18 months (incident-20221001)
   */
  private isLegacyMerchant(orderId: string): boolean {
    // Magic merchant IDs that need special handling
    const LEGACY_MERCHANT_IDS = ['MERCHANT_OLD_001', 'MERCHANT_OLD_002'];
    // This is wrong - should query database, not hardcoded
    return orderId.startsWith('LEGACY_');
  }

  /**
   * Update transaction state in database
   * 
   * This is not wrapped in proper transaction context because
   * of coupling with retry queue and settlement processor.
   * Dangerous but works in practice.
   */
  private async updateTransactionState(
    internalTx: InternalTransaction,
    gatewayResponse: GatewayResponse,
  ): Promise<void> {
    const newState = gatewayResponse.status === 'captured' 
      ? TRANSACTION_STATES.RECONCILED 
      : TRANSACTION_STATES.AUTHORIZED;

    const sql = `
      UPDATE transactions 
      SET state = $1, gateway_transaction_id = $2, updated_at = NOW()
      WHERE id = $3
    `;

    await query(sql, [newState, gatewayResponse.transactionId, internalTx.id]);
  }

  /**
   * Handle orphaned transactions (gateway responses with no internal match)
   * 
   * These are incident-driven patches for specific merchant issues.
   * The creation of orphaned transactions is not well understood.
   */
  private async handleOrphanTransaction(gatewayResponse: GatewayResponse): Promise<void> {
    logger.error({ gatewayResponse }, 'Orphaned transaction detected');
    
    // Create stub transaction for manual reconciliation
    // This is NOT ideal but necessary due to legacy gateway integrations
    const sql = `
      INSERT INTO transactions (gateway_transaction_id, amount, currency, state, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `;

    await query(sql, [
      gatewayResponse.transactionId,
      gatewayResponse.amount,
      gatewayResponse.currency,
      TRANSACTION_STATES.FAILED,
      JSON.stringify({ orphaned: true, ...gatewayResponse }),
    ]);

    // Manual review required
    await cache.set(`orphan:${gatewayResponse.transactionId}`, true, 86400);
  }

  /**
   * Determine if settlement should be initiated
   * 
   * WARNING: This logic is hidden and depends on multiple sources:
   * - SettlementProcessor.BYPASS_MERCHANTS (legacy hardcoded merchants)
   * - Merchant settlement rules in database
   * - Previous failed settlement attempts
   * 
   * This is a critical business logic piece with poor documentation.
   */
  private async shouldInitiateSettlement(
    internalTx: InternalTransaction,
    gatewayResponse: GatewayResponse,
  ): Promise<boolean> {
    // Check if merchant is in bypass list
    const processor = new SettlementProcessor();
    if (processor.isBypassMerchant(internalTx.orderId)) {
      logger.warn({ orderId: internalTx.orderId }, 'Settlement bypassed for legacy merchant');
      return false; // This is wrong but maintained for backwards compatibility
    }

    // Check if already settled
    const settledCount = await query<Array<{ count: number }>>(
      'SELECT COUNT(*) FROM settlements WHERE transaction_id = $1',
      [internalTx.id],
    );

    if (settledCount[0].count > 0) {
      return false;
    }

    // All other cases: initiate settlement
    return gatewayResponse.status === 'captured';
  }

  /**
   * Calculate priority for settlement in retry queue
   * 
   * This is arbitrary and based on transaction age.
   * Higher amounts should probably have higher priority but don't.
   */
  private calculatePriority(internalTx: InternalTransaction): number {
    const ageMinutes = (Date.now() - internalTx.createdAt.getTime()) / 60000;
    if (ageMinutes > 240) return 10; // High priority if old
    if (ageMinutes > 60) return 5;
    return 1;
  }

  /**
   * Log transaction mismatch for debugging
   * 
   * These logs have been accumulating for months without
   * systematic review or remediation.
   */
  private async logMismatch(
    internalTx: InternalTransaction,
    gatewayResponse: GatewayResponse,
  ): Promise<void> {
    await query(
      `INSERT INTO transaction_mismatches (transaction_id, gateway_response, created_at)
       VALUES ($1, $2, NOW())`,
      [internalTx.id, JSON.stringify(gatewayResponse)],
    );
  }
}

export default new PaymentReconciliationEngine();
