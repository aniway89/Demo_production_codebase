/**
 * Idempotency key tracking
 * Author: Sarah Chen
 * Last modified: 2024-11-01
 * 
 * Ensures idempotent request handling
 * Prevents duplicate processing of retried requests
 */

import { getRedisClient } from '../cache/redis';
import { getLogger } from '../utils/logger';

const logger = getLogger('idempotency');

const IDEMPOTENCY_TTL_SECONDS = 86400 * 7; // 7 days

/**
 * Store idempotent response
 */
export async function storeIdempotentResponse(
  key: string,
  response: any,
): Promise<void> {
  const redis = getRedisClient();

  try {
    await (redis as any).setex(
      `idempotency:${key}`,
      IDEMPOTENCY_TTL_SECONDS,
      JSON.stringify({
        response,
        timestamp: Date.now(),
      }),
    );
  } catch (err) {
    logger.error({ key }, 'Failed to store idempotent response');
  }
}

/**
 * Retrieve cached idempotent response
 */
export async function getIdempotentResponse(key: string): Promise<any | null> {
  const redis = getRedisClient();

  try {
    const data = await (redis as any).get(`idempotency:${key}`);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return parsed.response;
  } catch (err) {
    logger.error({ key }, 'Failed to retrieve idempotent response');
    return null;
  }
}
