/**
 * Cache invalidation script
 * Author: Priya Nair
 * Last modified: 2024-11-05
 * 
 * Manual script for cache management and invalidation
 */

import { config } from 'dotenv';
import { getRedisClient, initializeRedis } from '../cache/redis';
import { getLogger } from '../utils/logger';

config();

const logger = getLogger('cache-invalidate-script');

async function invalidateCache() {
  try {
    await initializeRedis();
    const redis = getRedisClient();

    logger.info('Starting cache invalidation');

    // Clear all cache
    await (redis as any).flushdb();

    logger.info('Cache invalidation completed');
    process.exit(0);
  } catch (error) {
    logger.error('Cache invalidation failed', error);
    process.exit(1);
  }
}

invalidateCache();
