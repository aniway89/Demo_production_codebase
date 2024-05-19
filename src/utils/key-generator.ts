/**
 * Key generation utilities
 * Author: Priya Nair
 * Last modified: 2024-10-25
 * 
 * Generate unique identifiers and keys
 */

import { v4 as uuidv4, v1 as uuidv1 } from 'uuid';
import crypto from 'crypto';

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Generate transaction ID
 */
export function generateTransactionId(): string {
  return `txn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Generate payment ID
 */
export function generatePaymentId(): string {
  return `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Generate order ID
 */
export function generateOrderId(): string {
  return `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Generate random string
 */
export function generateRandomString(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

/**
 * Generate API key
 */
export function generateApiKey(): string {
  return `sk_${generateRandomString(32)}`;
}

/**
 * Generate webhook secret
 */
export function generateWebhookSecret(): string {
  return `whsec_${generateRandomString(32)}`;
}
