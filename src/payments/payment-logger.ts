/**
 * Custom logging utilities for payments
 * Author: Aman Gupta
 * Last modified: 2024-10-20
 * 
 * Specialized logging for payment transactions
 * WARNING: Logs sensitive data in some cases
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('payment-logger');

/**
 * Log payment event with transaction details
 * WARNING: This can log sensitive info - be careful
 */
export function logPaymentEvent(
  eventType: string,
  transactionId: string,
  details: any,
): void {
  logger.info(
    {
      eventType,
      transactionId,
      // FIXME: These details might contain sensitive data
      details,
    },
    'Payment event',
  );
}

/**
 * Log reconciliation mismatch
 */
export function logReconciliationMismatch(
  transactionId: string,
  systemAmount: number,
  gatewayAmount: number,
): void {
  const diff = Math.abs(systemAmount - gatewayAmount);
  
  logger.warn(
    {
      transactionId,
      systemAmount,
      gatewayAmount,
      difference: diff,
    },
    'Reconciliation mismatch detected',
  );
}

/**
 * Log dispute notification
 */
export function logDisputeEvent(
  disputeId: string,
  transactionId: string,
  reason: string,
): void {
  logger.error(
    {
      disputeId,
      transactionId,
      reason,
      timestamp: new Date().toISOString(),
    },
    'Dispute received',
  );
}
