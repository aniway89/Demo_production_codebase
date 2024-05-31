/**
 * Redis connection and pool management
 * Author: Priya Nair
 * Last modified: 2024-11-05
 * 
 * Manages Redis connections for cache and job queues
 */

import Redis from 'redis';
import { getLogger } from '../utils/logger';

const logger = getLogger('redis');

let client: Redis.RedisClient | null = null;

export function getRedisClient(): Redis.RedisClient {
  if (!client) {
    client = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_DB || '0'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis connection refused');
          return new Error('End of retry.');
        }

        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Retry time exhausted');
        }

        if (options.attempt > 10) {
          return undefined;
        }

        return Math.min(options.attempt * 100, 3000);
      },
    });

    client.on('error', (err) => {
      logger.error('Redis error', err);
    });

    client.on('connect', () => {
      logger.info('Redis connected');
    });
  }

  return client;
}

export async function initializeRedis(): Promise<void> {
  const redis = getRedisClient();
  
  return new Promise((resolve, reject) => {
    if (redis.connected) {
      resolve();
    } else {
      redis.on('ready', resolve);
      redis.on('error', reject);
    }
  });
}

export async function closeRedis(): Promise<void> {
  if (client) {
    return new Promise((resolve, reject) => {
      client!.quit((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
