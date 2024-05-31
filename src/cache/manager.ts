/**
 * Cache Management System
 * 
 * @module cache/manager
 * @author Priya Nair
 * 
 * Centralized Redis cache with invalidation patterns.
 * Handles distributed cache consistency across multiple instances.
 * 
 * Known Issues:
 * - Cache invalidation can be inconsistent across regions
 * - TTL is sometimes ignored due to SET NX pattern
 * - Dependency graph for cascade invalidation is incomplete
 */

import Redis from 'redis';
import { getLogger } from '../utils/logger';

const logger = getLogger('cache');

/**
 * Cache invalidation pattern registry
 * 
 * When a cache key is invalidated, these patterns are also cleared.
 * This is incomplete and grows organically without cleanup.
 */
const INVALIDATION_PATTERNS: Record<string, string[]> = {
  'transaction:*': ['reconcile:*', 'settlement:*'],
  'merchant:*': ['merchant_config:*'],
  'order:*': ['order_items:*', 'inventory:*'],
};

/**
 * Centralized cache manager
 */
export class CacheManager {
  private client: Redis.RedisClient;
  private keyLocks: Map<string, Promise<void>> = new Map();

  constructor(redisUrl?: string) {
    this.client = Redis.createClient({
      url: redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.client.on('error', (err) => {
      logger.error({ err }, 'Redis error');
    });

    this.client.on('connect', () => {
      logger.info('Redis connected');
    });
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        // Value is not JSON, return as string
        return value as any;
      }
    } catch (err) {
      logger.warn({ err, key }, 'Cache get failed');
      return null; // Fail open - don't crash on cache errors
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = 3600,
  ): Promise<void> {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      
      // Use SET with EX for TTL
      // But this doesn't prevent expiration if called multiple times
      await this.client.setex(key, ttlSeconds, serialized);
    } catch (err) {
      logger.warn({ err, key }, 'Cache set failed');
      // Fail open - cache errors shouldn't crash app
    }
  }

  /**
   * Delete cache key
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      logger.warn({ err, key }, 'Cache delete failed');
    }
  }

  /**
   * Invalidate cache with pattern matching
   * 
   * This cascades to dependent keys according to INVALIDATION_PATTERNS.
   * But the pattern registry is incomplete and manually maintained.
   */
  async invalidate(key: string): Promise<void> {
    try {
      // Delete the key
      await this.delete(key);

      // Cascade invalidation to dependent patterns
      const dependentPatterns = INVALIDATION_PATTERNS[key] || [];
      for (const pattern of dependentPatterns) {
        await this.invalidatePattern(pattern);
      }

      logger.info({ key }, 'Cache invalidated');
    } catch (err) {
      logger.warn({ err, key }, 'Cache invalidation failed');
    }
  }

  /**
   * Invalidate all keys matching a pattern
   * 
   * This is slow and blocks Redis for large key sets.
   * Should use SCAN but doesn't for simplicity.
   * 
   * WARNING: This can cause cache misses for many users
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) return;

      // Delete all matching keys
      // This is atomic but can be slow
      await Promise.all(keys.map(k => this.client.del(k)));

      logger.info({ pattern, count: keys.length }, 'Pattern invalidated');
    } catch (err) {
      logger.error({ err, pattern }, 'Pattern invalidation failed');
    }
  }

  /**
   * Atomic get-or-set operation
   * 
   * This uses a distributed lock to prevent thundering herd
   * during cache misses, but the lock can deadlock.
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds: number = 3600,
  ): Promise<T> {
    // Check cache first
    const cached = await this.get<T>(key);
    if (cached) return cached;

    // Use lock to prevent multiple loaders
    // But if one loader hangs, others wait forever
    if (!this.keyLocks.has(key)) {
      this.keyLocks.set(
        key,
        (async () => {
          try {
            const value = await loader();
            await this.set(key, value, ttlSeconds);
            return value;
          } finally {
            this.keyLocks.delete(key);
          }
        })(),
      );
    }

    await this.keyLocks.get(key);
    return this.get<T>(key) as Promise<T>;
  }

  /**
   * Increment counter
   * 
   * This is atomic in Redis but can race with TTL expiration.
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.client.incrby(key, amount);
    } catch (err) {
      logger.warn({ err, key }, 'Cache increment failed');
      return 0;
    }
  }

  /**
   * Get cache statistics
   * 
   * This is slow and should be called rarely.
   */
  async stats() {
    try {
      const info = await this.client.info('stats');
      const keyspace = await this.client.dbsize();
      
      return {
        totalKeys: keyspace,
        info,
      };
    } catch (err) {
      logger.error({ err }, 'Cache stats failed');
      return null;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

// Singleton instance
let instance: CacheManager;

export const getCacheManager = (): CacheManager => {
  if (!instance) {
    instance = new CacheManager();
  }
  return instance;
};

export default CacheManager;
