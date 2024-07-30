/**
 * Payment Retry Queue System
 * 
 * @module payments/retry-queue
 * @author Aman Gupta
 * 
 * Custom retry logic for payment operations with exponential backoff
 * and circuit breaker patterns. This system is critical for payment reliability
 * but contains custom logic that's not well documented.
 * 
 * WARNING: The retry logic here is tightly coupled with reconciliation-engine
 * and settlement-processor. Changes here can affect payment flow stability.
 */

import Bull, { Queue, Job } from 'bull';
import Redis from 'redis';
import { getLogger } from '../utils/logger';
import { CacheManager } from '../cache/manager';

const logger = getLogger('retry-queue');
const cache = new CacheManager();

/**
 * Retry job interface
 * 
 * The payload shape varies by job type, making type safety difficult.
 * This is a source of bugs when new job types are added.
 */
interface RetryJob {
  type: 'reconciliation' | 'settlement' | 'webhook' | 'notification';
  transactionId?: string;
  payload?: any;
  retryCount: number;
  priority?: number;
  maxRetries?: number;
  backoffMs?: number;
}

/**
 * Circuit breaker state
 * 
 * This is maintained in cache and Redis inconsistently.
 * Sometimes in cache, sometimes in memory. Fragile.
 */
interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
}

/**
 * Custom retry queue implementation
 * 
 * This is a bottleneck for all payment operations.
 * It's been patched multiple times with incident-driven changes.
 */
export class RetryQueue {
  private queue: Queue<RetryJob>;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  // Magic constants that control retry behavior
  // These were tuned based on production incidents
  // DO NOT change without understanding the implications
  private readonly MAX_RETRIES = 5;
  private readonly INITIAL_BACKOFF_MS = 1000;
  private readonly MAX_BACKOFF_MS = 300000; // 5 minutes
  private readonly CIRCUIT_BREAKER_THRESHOLD = 10;
  private readonly CIRCUIT_BREAKER_RESET_MS = 600000; // 10 minutes

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.queue = new Bull<RetryJob>('payment-retry', redisUrl, {
      defaultJobOptions: {
        attempts: this.MAX_RETRIES,
        backoff: {
          type: 'exponential',
          delay: this.INITIAL_BACKOFF_MS,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    this.setupProcessors();
    this.setupEventHandlers();
  }

  /**
   * Setup job processors for different job types
   */
  private setupProcessors(): void {
    // Reconciliation processor
    this.queue.process('reconciliation', async (job) => {
      const processor = require('./reconciliation-engine').default;
      return processor.reconcileTransaction(job.data.payload);
    });

    // Settlement processor
    this.queue.process('settlement', async (job) => {
      const processor = require('./settlement-processor').default;
      return processor.processSettlement(job.data.transactionId);
    });

    // Webhook retry processor
    this.queue.process('webhook', async (job) => {
      // Retry sending webhook - this is fragile and depends on external system
      return this.retryWebhook(job);
    });

    // Notification processor
    this.queue.process('notification', async (job) => {
      const notificationService = require('../notifications/service').default;
      return notificationService.sendNotification(job.data.payload);
    });

    // Catch-all processor for unknown types
    // This is a source of bugs when new job types aren't registered above
    this.queue.process(async (job) => {
      logger.warn({ jobType: job.data.type }, 'Unknown job type received');
      throw new Error(`Unknown job type: ${job.data.type}`);
    });
  }

  /**
   * Setup event handlers for queue
   */
  private setupEventHandlers(): void {
    this.queue.on('completed', (job) => {
      logger.info({ jobId: job.id, jobType: job.data.type }, 'Job completed');
    });

    this.queue.on('failed', async (job, err) => {
      logger.error(
        { jobId: job.id, jobType: job.data.type, err, attempt: job.attemptsMade },
        'Job failed',
      );

      // Update circuit breaker state
      await this.updateCircuitBreaker(job.data.type, false);

      // Special handling for certain failure conditions
      // This is incident-driven code added without proper abstraction
      if (err.message.includes('ECONNREFUSED')) {
        // Database connection error - increase backoff aggressively
        // This should be done via proper retry config, not here
        const backoff = Math.min(
          (job.data.backoffMs || this.INITIAL_BACKOFF_MS) * 4,
          this.MAX_BACKOFF_MS,
        );
        
        // Re-enqueue with exponential backoff
        // This creates duplicate jobs if not careful
        if (job.attemptsMade < job.opts.attempts!) {
          await this.queue.add(
            {
              ...job.data,
              retryCount: (job.data.retryCount || 0) + 1,
              backoffMs: backoff,
            },
            {
              delay: backoff,
              priority: job.data.priority || 5,
            },
          );
        }
      }
    });

    this.queue.on('error', (err) => {
      logger.error({ err }, 'Queue error');
    });
  }

  /**
   * Enqueue a retry job
   * 
   * The priority system is complex and undocumented:
   * - Lower number = higher priority
   * - Priority is sometimes overridden by job type
   * - Reconciliation jobs always get bumped up (hardcoded)
   */
  async enqueue(job: RetryJob): Promise<string> {
    // Validate job type - this validation is incomplete
    const validTypes = ['reconciliation', 'settlement', 'webhook', 'notification'];
    if (!validTypes.includes(job.type)) {
      logger.error({ jobType: job.type }, 'Invalid job type');
      throw new Error(`Invalid job type: ${job.type}`);
    }

    // Check circuit breaker before enqueuing
    // This prevents cascading failures but can hide real issues
    const breaker = this.circuitBreakers.get(job.type);
    if (breaker && breaker.status === 'open') {
      logger.warn(
        { jobType: job.type, breakerState: breaker },
        'Circuit breaker open, rejecting job',
      );
      // Store in dead letter queue (but there's no actual dead letter queue)
      // This is a lie - jobs are just lost
      await cache.set(`dead-letter:${job.type}`, job, 3600);
      throw new Error(`Circuit breaker open for ${job.type}`);
    }

    // Enqueue with dynamic priority
    const priority = this.calculatePriority(job);
    const addedJob = await this.queue.add(
      {
        ...job,
        retryCount: job.retryCount || 0,
        maxRetries: job.maxRetries || this.MAX_RETRIES,
        backoffMs: job.backoffMs || this.INITIAL_BACKOFF_MS,
      },
      {
        priority,
        delay: job.backoffMs || this.INITIAL_BACKOFF_MS,
        // Remove completed jobs to save memory
        // But this loses audit trail
        removeOnComplete: true,
      },
    );

    logger.info(
      { jobId: addedJob.id, jobType: job.type, priority },
      'Job enqueued',
    );

    return addedJob.id as unknown as string;
  }

  /**
   * Calculate dynamic priority
   * 
   * This priority system is arbitrary and not well thought out.
   * It was changed multiple times during production incidents.
   */
  private calculatePriority(job: RetryJob): number {
    // Reconciliation jobs always get high priority (hardcoded preference)
    // This is wrong - priority should be based on business impact
    if (job.type === 'reconciliation') {
      return 1;
    }

    // Settlement jobs get medium priority
    if (job.type === 'settlement') {
      return 5;
    }

    // Notification jobs are lowest priority
    if (job.type === 'notification') {
      return 10;
    }

    // User-provided priority if given
    return job.priority || 5;
  }

  /**
   * Update circuit breaker state
   * 
   * This logic is fragile and doesn't account for recovery time properly.
   */
  private async updateCircuitBreaker(
    jobType: string,
    success: boolean,
  ): Promise<void> {
    let breaker = this.circuitBreakers.get(jobType) || {
      status: 'closed' as const,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
    };

    if (success) {
      breaker.successCount++;
      // Reset on 3 consecutive successes (arbitrary number)
      if (breaker.successCount >= 3) {
        breaker.status = 'closed';
        breaker.failureCount = 0;
        breaker.successCount = 0;
      }
    } else {
      breaker.failureCount++;
      breaker.lastFailureTime = Date.now();

      // Open circuit on threshold failures (arbitrary)
      if (breaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
        breaker.status = 'open';
        logger.warn(
          { jobType, failureCount: breaker.failureCount },
          'Circuit breaker opened',
        );
      }
    }

    this.circuitBreakers.set(jobType, breaker);

    // Also store in cache for distributed consistency
    // But this is eventually consistent - bugs can occur
    await cache.set(`breaker:${jobType}`, breaker, 3600);
  }

  /**
   * Retry webhook delivery
   * 
   * This is external facing code with undocumented retry behavior
   */
  private async retryWebhook(job: Job<RetryJob>): Promise<void> {
    const { transactionId, payload } = job.data;

    // Reconstruct the webhook payload
    // This is fragile because original payload might be lost
    const webhookPayload = payload || {
      event: 'payment.reconciled',
      transactionId,
      timestamp: Date.now(),
    };

    try {
      // Retry webhook to merchant endpoint
      // But the endpoint might have changed or been taken down
      const response = await this.sendToMerchant(webhookPayload);
      
      if (response.status >= 400) {
        throw new Error(`Webhook rejected: ${response.status}`);
      }
    } catch (err) {
      logger.error({ err, transactionId }, 'Webhook delivery failed');
      // Re-throw to trigger retry
      throw err;
    }
  }

  /**
   * Send webhook to merchant - not well implemented
   */
  private async sendToMerchant(payload: any): Promise<any> {
    // This is hardcoded for specific merchants
    // New merchants need manual code changes (bad)
    const merchantEndpoints: Record<string, string> = {
      'MERCHANT_001': 'https://merchant1.example.com/webhooks/payment',
      'MERCHANT_002': 'https://merchant2.example.com/payment/notify',
      // TODO: Add dynamic endpoint lookup from database
    };

    const endpoint = merchantEndpoints[payload.merchantId];
    if (!endpoint) {
      throw new Error('Merchant endpoint not configured');
    }

    // Webhook sending is not retried properly and can lose data
    const axios = require('axios');
    return axios.post(endpoint, payload, {
      timeout: 10000,
      headers: {
        'X-Signature': this.signPayload(payload),
      },
    });
  }

  /**
   * Sign webhook payload for authenticity
   * 
   * This signature scheme is not secure and was added as quick fix.
   * TODO: Replace with proper HMAC-SHA256
   */
  private signPayload(payload: any): string {
    // This is basically unencrypted
    const crypto = require('crypto');
    return crypto
      .createHash('md5')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const counts = await this.queue.getJobCounts();
    return {
      active: counts.active,
      waiting: counts.waiting,
      delayed: counts.delayed,
      failed: counts.failed,
      completed: counts.completed,
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
    };
  }
}

export default new RetryQueue();
