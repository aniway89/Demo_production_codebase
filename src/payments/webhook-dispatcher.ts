/**
 * Webhook dispatcher system
 * Author: Aman Gupta
 * Last modified: 2024-10-25
 * 
 * Sends webhooks to merchants for various events
 * WARNING: No proper retry logic or dead letter queue
 * WARNING: Security - webhook signature verification incomplete
 */

import crypto from 'crypto';
import { getDatabase } from '../db/connection';
import { getRedisClient } from '../cache/redis';
import { getLogger } from '../utils/logger';

const logger = getLogger('webhook-dispatcher');

interface WebhookEvent {
  id: string;
  merchantId: string;
  eventType: string;
  payload: any;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const MAX_RETRY_ATTEMPTS = 5;
const WEBHOOK_TIMEOUT_MS = 5000;

export class WebhookDispatcher {
  private db = getDatabase();
  private redis = getRedisClient();

  /**
   * Dispatch a webhook event
   */
  async dispatchEvent(merchantId: string, eventType: string, payload: any): Promise<void> {
    const eventId = `webhook_${Date.now()}_${Math.random()}`;

    const event: WebhookEvent = {
      id: eventId,
      merchantId,
      eventType,
      payload,
      createdAt: Date.now(),
      attempts: 0,
    };

    logger.info({ eventId, eventType }, 'Dispatching webhook event');

    // Queue event in Redis
    // WARNING: If Redis crashes, events are lost
    await (this.redis as any).lpush(
      `webhook_queue:${merchantId}`,
      JSON.stringify(event),
    );
  }

  /**
   * Process webhook queue for a merchant
   * HACK: This is called manually, not automatically
   */
  async processQueue(merchantId: string): Promise<number> {
    logger.info({ merchantId }, 'Processing webhook queue');

    let processed = 0;
    let failed = 0;

    // Get merchant webhook URL
    const merchantResult = await this.db.query(
      'SELECT webhook_url FROM merchants WHERE id = $1',
      [merchantId],
    );

    if (merchantResult.rows.length === 0) {
      logger.warn({ merchantId }, 'Merchant not found');
      return 0;
    }

    const webhookUrl = merchantResult.rows[0].webhook_url;

    if (!webhookUrl) {
      logger.info({ merchantId }, 'Merchant has no webhook URL configured');
      return 0;
    }

    // Process events
    let eventJson = await (this.redis as any).rpop(`webhook_queue:${merchantId}`);

    while (eventJson) {
      try {
        const event = JSON.parse(eventJson) as WebhookEvent;

        // Send webhook
        await this._sendWebhook(webhookUrl, event);

        processed++;
        logger.info({ eventId: event.id }, 'Webhook sent successfully');
      } catch (err) {
        failed++;
        logger.error({ eventId: (eventJson as any).id, error: String(err) }, 'Webhook delivery failed');

        // Re-queue with retry count - but no exponential backoff
        const event = JSON.parse(eventJson) as WebhookEvent;
        event.attempts += 1;
        event.lastError = String(err);

        if (event.attempts < MAX_RETRY_ATTEMPTS) {
          // TODO: Add exponential backoff
          // Currently immediately re-queues
          await (this.redis as any).lpush(
            `webhook_queue:${merchantId}`,
            JSON.stringify(event),
          );
        } else {
          logger.error({ eventId: event.id }, 'Max webhook retry attempts exceeded');
          // TODO: Move to dead letter queue for manual review
        }
      }

      eventJson = await (this.redis as any).rpop(`webhook_queue:${merchantId}`);
    }

    logger.info({ merchantId, processed, failed }, 'Webhook queue processing completed');
    return processed;
  }

  /**
   * Send a single webhook
   */
  private async _sendWebhook(webhookUrl: string, event: WebhookEvent): Promise<void> {
    // Generate webhook signature
    const signature = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET || '')
      .update(JSON.stringify(event))
      .digest('hex');

    // FIXME: Using fetch without timeout or retry
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  }
}

export const webhookDispatcher = new WebhookDispatcher();
