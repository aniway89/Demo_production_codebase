/**
 * Cache service - Wrapper around Redis
 * Author: Priya Nair
 * Last modified: 2024-10-30
 * 
 * Provides typed cache interface with TTL support
 */

import { getRedisClient } from './redis';
import { getLogger } from '../utils/logger';

const logger = getLogger('cache');

const DEFAULT_TTL_SECONDS = 3600; // 1 hour

export class CacheService {
  private redis = getRedisClient();

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await (this.redis as any).get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      logger.error({ key }, 'Cache get failed');
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string,
    value: T,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    try {
      await (this.redis as any).setex(
        key,
        ttlSeconds,
        JSON.stringify(value),
      );
    } catch (err) {
      logger.error({ key }, 'Cache set failed');
    }
  }

  /**
   * Delete cache key
   */
  async delete(key: string): Promise<void> {
    try {
      await (this.redis as any).del(key);
    } catch (err) {
      logger.error({ key }, 'Cache delete failed');
    }
  }

  /**
   * Clear all cache (DANGEROUS - use carefully)
   */
  async clear(): Promise<void> {
    logger.warn('Clearing all cache');
    await (this.redis as any).flushdb();
  }
}

export const cache = new CacheService();
