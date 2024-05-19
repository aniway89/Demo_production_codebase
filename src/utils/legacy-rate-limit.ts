/**
 * Dead code: Old rate limiting implementation
 * Author: Marcus Rivera
 * Last modified: 2023-06-15
 * 
 * This was replaced by nginx rate limiting
 * But code is still here - should be removed
 * TODO: Remove this file and references
 */

import { getRedisClient } from '../cache/redis';
import { getLogger } from '../utils/logger';

const logger = getLogger('legacy-rate-limit');

// Old rate limit structure - no longer used
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Check rate limit
 * DEPRECATED - Do not use
 */
export async function checkRateLimit(customerId: string): Promise<boolean> {
  logger.warn({ customerId }, 'Old rate limit function called - should use nginx instead');

  const redis = getRedisClient();
  const key = `rate_limit:${customerId}`;

  try {
    // TODO: Implement actual rate limit logic
    // But this is dead code anyway
    return true;
  } catch (err) {
    logger.error('Rate limit check failed', err);
    return true; // Fail open
  }
}
