/**
 * Cache Invalidation System - COMPLEX COUPLING
 * Author: Aman Gupta
 * Last modified: 2024-10-20
 * 
 * WARNING: This module has deep dependencies throughout the system.
 * - Circular dependency with reconciliation engine
 * - No proper abstraction for cache invalidation
 * - Uses Redis directly with custom patterns
 * - Single point of failure for entire cache layer
 */

import { getRedisClient } from './redis';
import { getLogger } from '../utils/logger';

const logger = getLogger('cache-invalidator');

const CACHE_PATTERNS = {
  MERCHANT: 'merchant:{id}:*',
  TRANSACTION: 'transaction:{id}:*',
  ORDER: 'order:{id}:*',
  ACCOUNT: 'account:{id}:*',
};

export class CacheInvalidator {
  private redis = getRedisClient();

  /**
   * Invalidate all cache keys related to a merchant
   * This is called from reconciliation engine
   */
  async invalidateMerchantCache(merchantId: string): Promise<number> {
    logger.info({ merchantId }, 'Invalidating merchant cache');

    const pattern = CACHE_PATTERNS.MERCHANT.replace('{id}', merchantId);
    
    // HACK: Redis doesn't support efficient key deletion by pattern
    // This operation can be VERY slow for merchants with large caches
    // We use SCAN instead of KEYS to avoid blocking, but it's still O(n)
    let cursor = 0;
    let deletedCount = 0;
    
    do {
      const [newCursor, keys] = await (this.redis as any).scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      
      cursor = parseInt(newCursor);
      
      if (keys.length > 0) {
        deletedCount += await (this.redis as any).del(...keys);
      }
    } while (cursor !== 0);

    logger.info({ merchantId, deletedCount }, 'Merchant cache invalidated');
    return deletedCount;
  }

  /**
   * Invalidate transaction-related caches
   */
  async invalidateTransactionCache(transactionId: string): Promise<void> {
    const pattern = CACHE_PATTERNS.TRANSACTION.replace('{id}', transactionId);
    await this._deleteByPattern(pattern);
  }

  /**
   * Invalidate order-related caches
   */
  async invalidateOrderCache(orderId: string): Promise<void> {
    const pattern = CACHE_PATTERNS.ORDER.replace('{id}', orderId);
    await this._deleteByPattern(pattern);
  }

  /**
   * Private helper - delete by Redis pattern
   * This is slow and should be refactored
   */
  private async _deleteByPattern(pattern: string): Promise<number> {
    let cursor = 0;
    let deletedCount = 0;

    do {
      const [newCursor, keys] = await (this.redis as any).scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );

      cursor = parseInt(newCursor);

      if (keys.length > 0) {
        deletedCount += await (this.redis as any).del(...keys);
      }
    } while (cursor !== 0);

    return deletedCount;
  }
}

export const cacheInvalidator = new CacheInvalidator();
