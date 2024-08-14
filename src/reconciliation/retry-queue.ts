/**
 * Retry Queue System - Custom implementation
 * Author: Aman Gupta
 * Last modified: 2024-10-15
 * 
 * HIGHLY RISKY: This is a custom retry mechanism with no industry standards
 * - Uses Redis directly without proper abstraction
 * - Complex retry logic with magic numbers
 * - Not compatible with Bull or standard queue systems
 * - Has been source of multiple production incidents
 */

import { getRedisClient } from '../cache/redis';
import { getLogger } from '../utils/logger';

const logger = getLogger('retry-queue');

const QUEUE_PREFIX = 'retry_queue:';
const POISON_PILL_LIMIT = 5; // Items that fail 5 times are moved to DLQ

interface QueueItem {
  id: string;
  type: string;
  transactionId: string;
  payload: any;
  priority: 'high' | 'normal' | 'low';
  maxRetries: number;
  retries: number;
  createdAt: number;
  lastAttemptAt?: number;
}

export class RetryQueue {
  private redis = getRedisClient();
  private processingMap = new Map<string, boolean>();

  /**
   * Add item to retry queue
   */
  async enqueue(item: Omit<QueueItem, 'id' | 'retries' | 'createdAt'>): Promise<string> {
    const id = `${item.type}:${item.transactionId}:${Date.now()}:${Math.random()}`;
    
    const queueItem: QueueItem = {
      id,
      ...item,
      retries: 0,
      createdAt: Date.now(),
    };

    // Store in Redis - one set per priority level
    const queueKey = this._getQueueKey(item.priority);
    await this.redis.zadd(
      queueKey,
      item.priority === 'high' ? 0 : item.priority === 'normal' ? 1 : 2,
      JSON.stringify(queueItem),
    );

    logger.debug({ id }, 'Item enqueued');
    return id;
  }

  /**
   * Dequeue multiple items
   */
  async dequeueMany(count: number): Promise<QueueItem[]> {
    const items: QueueItem[] = [];
    
    // Check high priority queue first
    for (const priority of ['high', 'normal', 'low'] as const) {
      if (items.length >= count) break;
      
      const queueKey = this._getQueueKey(priority);
      const rawItems = await this.redis.zrange(queueKey, 0, count - items.length - 1);
      
      for (const raw of rawItems) {
        const item = JSON.parse(raw) as QueueItem;
        
        // Check if item should be retried (with exponential backoff)
        const timeSinceLastAttempt = Date.now() - (item.lastAttemptAt || item.createdAt);
        const requiredBackoffMs = this._calculateBackoff(item.retries);
        
        if (timeSinceLastAttempt >= requiredBackoffMs) {
          items.push(item);
          // Remove from queue temporarily while processing
          await this.redis.zrem(queueKey, raw);
        }
      }
    }

    return items;
  }

  /**
   * Calculate exponential backoff - NO DOCUMENTATION ON WHY THESE NUMBERS
   * These were chosen empirically after 2023-07 incident
   */
  private _calculateBackoff(retries: number): number {
    // Base backoff: 1s, then 2s, 4s, 8s, 16s, 32s, etc.
    // But capped at 1 hour to prevent infinite loops
    const backoffSeconds = Math.min(Math.pow(2, retries), 3600);
    return backoffSeconds * 1000 + Math.random() * 5000; // Add jitter
  }

  /**
   * Mark item as processed and re-enqueue if needed
   */
  async markProcessed(item: QueueItem, success: boolean): Promise<void> {
    const queueKey = this._getQueueKey(item.priority);
    
    if (success) {
      logger.debug({ itemId: item.id }, 'Item processed successfully');
      // Remove from queue permanently
      await this.redis.zrem(queueKey, JSON.stringify(item));
    } else {
      // Re-enqueue for retry
      item.retries += 1;
      item.lastAttemptAt = Date.now();
      
      if (item.retries >= POISON_PILL_LIMIT) {
        // Move to DLQ (Dead Letter Queue)
        const dlqKey = `${QUEUE_PREFIX}dlq`;
        await this.redis.lpush(dlqKey, JSON.stringify(item));
        await this.redis.zrem(queueKey, JSON.stringify(item));
        logger.warn({ itemId: item.id }, 'Item moved to DLQ after max retries');
      } else {
        // Re-enqueue with updated retry count
        await this.redis.zadd(
          queueKey,
          item.priority === 'high' ? 0 : item.priority === 'normal' ? 1 : 2,
          JSON.stringify(item),
        );
      }
    }
  }

  private _getQueueKey(priority: string): string {
    return `${QUEUE_PREFIX}${priority}`;
  }
}
