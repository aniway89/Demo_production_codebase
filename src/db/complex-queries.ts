/**
 * Complex query utilities
 * Author: Aman Gupta
 * Last modified: 2024-10-30
 * 
 * Direct database queries for reporting and analysis
 * WARNING: Many of these queries are not optimized
 * WARNING: No parameterization in some cases - SQL injection risk if used with user input
 */

import { getDatabase } from '../db/connection';
import { getLogger } from '../utils/logger';

const logger = getLogger('complex-queries');

/**
 * Get revenue for a merchant between dates
 * FIXME: This query is slow for merchants with large transaction volumes
 */
export async function getMerchantRevenue(
  merchantId: string,
  startDate: Date,
  endDate: Date,
): Promise<number> {
  const db = getDatabase();

  // NOTE: This query does a full table scan without proper indexing
  const result = await db.query(
    `SELECT SUM(amount) as total FROM transactions 
     WHERE merchant_id = $1 
     AND created_at >= $2 
     AND created_at <= $3`,
    [merchantId, startDate, endDate],
  );

  return result.rows[0]?.total || 0;
}

/**
 * Get disputed transactions
 * HACK: Hardcoded business logic for dispute detection
 */
export async function getDisputedTransactions(merchantId: string): Promise<any[]> {
  const db = getDatabase();

  // Magic query with undocumented logic
  // Why these specific conditions? Unknown.
  const result = await db.query(
    `SELECT * FROM transactions 
     WHERE merchant_id = $1 
     AND status = 'settled'
     AND adjusted = true
     AND adjustment_reason = 'AUTO_ADJUSTMENT_ROUNDING_ERROR'
     AND amount > 100000`,
    [merchantId],
  );

  return result.rows;
}

/**
 * Find orphaned transactions
 * These are transactions that have no corresponding order
 */
export async function findOrphanedTransactions(): Promise<any[]> {
  const db = getDatabase();

  const result = await db.query(
    `SELECT t.* FROM transactions t
     LEFT JOIN orders o ON t.id = o.id
     WHERE o.id IS NULL
     AND t.created_at > NOW() - INTERVAL '90 days'`,
  );

  logger.warn({ count: result.rows.length }, 'Found orphaned transactions');
  return result.rows;
}

/**
 * Get transactions pending reconciliation
 * Used for manual monitoring
 */
export async function getPendingReconciliationTransactions(limit: number = 100): Promise<any[]> {
  const db = getDatabase();

  const result = await db.query(
    `SELECT * FROM transactions 
     WHERE reconciled = false 
     AND created_at < NOW() - INTERVAL '24 hours'
     LIMIT $1`,
    [limit],
  );

  return result.rows;
}
