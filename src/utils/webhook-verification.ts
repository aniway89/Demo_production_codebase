/**
 * Webhook verification utilities
 * Author: Sarah Chen
 * Last modified: 2024-10-20
 * 
 * Verify webhooks from external services
 */

import crypto from 'crypto';
import { getLogger } from './logger';

const logger = getLogger('webhook-verification');

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature),
    );
  } catch (err) {
    logger.error('Webhook signature verification failed', err);
    return false;
  }
}

/**
 * Generate webhook signature for outgoing webhooks
 */
export function generateWebhookSignature(payload: any, secret: string): string {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  
  return crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}
