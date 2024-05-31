/**
 * Cache Invalidation Helper
 * 
 * @module cache/invalidation-helper
 * @author Priya Nair
 * 
 * Provides structured cache invalidation patterns
 * Manages dependencies between cached entities
 * 
 * Known Issues:
 * - Pattern registry is manually maintained
 * - No automatic dependency tracking
 * - Invalidation can be slow for large key sets
 * - Distributed consistency is eventual, not strong
 */

import { CacheManager } from './manager';
import { getLogger } from '../utils/logger';

const logger = getLogger('cache-invalidation');

/**
 * Cache invalidation policies
 * 
 * Maps entity types to their dependent cache keys
 * This is maintained manually and can get out of sync
 */
const DEPENDENCY_GRAPH: Record<string, string[]> = {
  // When transaction changes, invalidate related caches
  'transaction': [
    'order:*',
    'settlement:*',
    'payment:*',
    'reconcile:*',
  ],

  // When order changes, invalidate related caches
  'order': [
    'user_orders:*',
    'merchant_orders:*',
    'inventory:*',
  ],

  // When merchant config changes, invalidate merchant caches
  'merchant': [
    'merchant_config:*',
    'merchant_settlements:*',
    'merchant_orders:*',
  ],

  // When product changes, invalidate inventory caches
  'product': [
    'inventory:*',
    'product:*',
  ],
};

/**
 * Structured cache invalidation
 * 
 * Provides type-safe cache invalidation with dependency tracking
 */
export class CacheInvalidationHelper {
  private cache: CacheManager;

  constructor(cache: CacheManager) {
    this.cache = cache;
  }

  /**
   * Invalidate by entity type
   * 
   * Cascades to all dependent caches
   * Safe to call multiple times
   */
  async invalidateByType(entityType: string, entityId: string): Promise<void> {
    logger.debug({ entityType, entityId }, 'Invalidating by type');

    // Get dependent patterns
    const patterns = DEPENDENCY_GRAPH[entityType] || [];

    // Add specific entity pattern
    patterns.push(`${entityType}:${entityId}`);

    // Invalidate all patterns
    for (const pattern of patterns) {
      try {
        await this.cache.invalidatePattern(pattern);
      } catch (err) {
        logger.warn({ err, pattern }, 'Failed to invalidate pattern');
        // Don't fail entire operation if one pattern fails
      }
    }

    logger.debug(
      { entityType, entityId, patternCount: patterns.length },
      'Entity invalidation completed',
    );
  }

  /**
   * Invalidate transaction and cascading caches
   */
  async invalidateTransaction(transactionId: string): Promise<void> {
    logger.debug({ transactionId }, 'Invalidating transaction');

    const patterns = [
      `transaction:${transactionId}`,
      `order:${transactionId}`,
      `settlement:${transactionId}`,
      `payment:${transactionId}`,
      `reconcile:${transactionId}`,
      'reconcile:*', // Clear all reconciliation caches
    ];

    for (const pattern of patterns) {
      await this.cache.invalidatePattern(pattern);
    }
  }

  /**
   * Invalidate order and cascading caches
   */
  async invalidateOrder(orderId: string): Promise<void> {
    logger.debug({ orderId }, 'Invalidating order');

    const patterns = [
      `order:${orderId}`,
      `order_items:${orderId}`,
      `user_orders:*`, // All user order lists
      `merchant_orders:*`, // All merchant order lists
    ];

    for (const pattern of patterns) {
      await this.cache.invalidatePattern(pattern);
    }
  }

  /**
   * Bulk invalidation for multiple entities
   * 
   * More efficient than individual invalidations
   */
  async invalidateBatch(invalidations: Array<{ type: string; id: string }>): Promise<void> {
    logger.debug({ count: invalidations.length }, 'Bulk invalidation started');

    const patternSet = new Set<string>();

    // Collect all patterns to invalidate
    for (const { type, id } of invalidations) {
      const patterns = DEPENDENCY_GRAPH[type] || [];
      patterns.forEach(p => patternSet.add(p));
      patternSet.add(`${type}:${id}`);
    }

    // Invalidate all unique patterns once
    for (const pattern of patternSet) {
      try {
        await this.cache.invalidatePattern(pattern);
      } catch (err) {
        logger.warn({ err, pattern }, 'Pattern invalidation failed');
      }
    }

    logger.debug({ patternCount: patternSet.size }, 'Bulk invalidation completed');
  }

  /**
   * Selective cache warming
   * 
   * Pre-loads frequently accessed patterns after invalidation
   */
  async warmAfterInvalidation(patterns: string[]): Promise<void> {
    logger.debug({ patternCount: patterns.length }, 'Warming cache after invalidation');

    // TODO: Implement cache warming logic
    // For now this is just a placeholder
    logger.warn('Cache warming not yet implemented');
  }
}

/**
 * Singleton instance
 */
let instance: CacheInvalidationHelper;

export const getCacheInvalidationHelper = (cache: CacheManager): CacheInvalidationHelper => {
  if (!instance) {
    instance = new CacheInvalidationHelper(cache);
  }
  return instance;
};

export default CacheInvalidationHelper;
