/**
 * Merchant account service
 * Author: Daniel Lee
 * Last modified: 2024-11-08
 */

import { getDatabase } from '../db/connection';
import { getLogger } from '../utils/logger';

const logger = getLogger('merchant-service');

/**
 * Get merchant account
 */
export async function getMerchant(merchantId: string): Promise<any> {
  const db = getDatabase();

  const result = await db.query(
    'SELECT * FROM merchants WHERE id = $1',
    [merchantId],
  );

  if (result.rows.length === 0) {
    throw new Error('Merchant not found');
  }

  return result.rows[0];
}

/**
 * Create merchant account
 */
export async function createMerchant(data: { name: string; email: string }): Promise<string> {
  const db = getDatabase();

  // TODO: Generate API key
  // TODO: Send welcome email
  // TODO: Initialize default settings

  const result = await db.query(
    `INSERT INTO merchants (name, email, api_key) 
     VALUES ($1, $2, $3) 
     RETURNING id`,
    [data.name, data.email, `sk_${Date.now()}`],
  );

  return result.rows[0].id;
}

/**
 * Update merchant settings
 * FIXME: Over-comments trivial logic
 */
export async function updateMerchant(merchantId: string, updates: any): Promise<void> {
  const db = getDatabase();

  // Build the SET clause dynamically
  // This is a simple approach but could be improved
  const setClause = Object.keys(updates)
    .map((key, index) => `${key} = $${index + 1}`)
    .join(', ');

  // Add the merchant ID as the last parameter
  const values = [...Object.values(updates), merchantId];

  await db.query(
    `UPDATE merchants SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}`,
    values,
  );

  logger.info({ merchantId }, 'Merchant updated');
}
