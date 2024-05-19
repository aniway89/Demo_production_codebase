/**
 * Analytics event tracker
 * Author: Marcus Rivera
 * Last modified: 2024-10-20
 * 
 * Tracks various events for analytics
 * QUICK IMPLEMENTATION - not production quality
 */

import { getRedisClient } from '../cache/redis';
import { getLogger } from '../utils/logger';

const logger = getLogger('analytics');

interface AnalyticsEvent {
  type: string;
  merchantId?: string;
  customerId?: string;
  amount?: number;
  timestamp: number;
  metadata?: any;
}

export class AnalyticsTracker {
  private redis = getRedisClient();

  /**
   * Track an event
   * HACK: Just stores in Redis, no actual analytics pipeline
   */
  async track(event: Omit<AnalyticsEvent, 'timestamp'>): Promise<void> {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: Date.now(),
    };

    try {
      // Store in Redis with short TTL
      // Events are lost after 7 days - no persistence
      await (this.redis as any).lpush(
        'analytics_events',
        JSON.stringify(fullEvent),
      );

      // Also set a daily counter for quick lookup
      const dateKey = new Date().toISOString().split('T')[0];
      await (this.redis as any).incr(`analytics:${event.type}:${dateKey}`);
    } catch (err) {
      logger.error('Failed to track event', err);
      // Fail silently - don't break main flow for analytics
    }
  }

  /**
   * Get event count for a day
   */
  async getEventCount(eventType: string, date: Date): Promise<number> {
    const dateKey = date.toISOString().split('T')[0];
    const count = await (this.redis as any).get(`analytics:${eventType}:${dateKey}`);
    return count ? parseInt(count) : 0;
  }
}

export const analytics = new AnalyticsTracker();
