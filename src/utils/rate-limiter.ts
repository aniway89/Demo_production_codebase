/**
 * Rate limiting utilities
 * Author: Sarah Chen
 * Last modified: 2024-11-04
 * 
 * Token bucket rate limiter implementation
 */

import { getRedisClient } from '../cache/redis';
import { getLogger } from './logger';

const logger = getLogger('rate-limiter');

export class RateLimiter {
  private redis = getRedisClient();
  private readonly tokensPerWindow: number;
  private readonly windowSizeSeconds: number;

  constructor(tokensPerWindow: number = 100, windowSizeSeconds: number = 60) {
    this.tokensPerWindow = tokensPerWindow;
    this.windowSizeSeconds = windowSizeSeconds;
  }

  /**
   * Check if request is allowed
   */
  async isAllowed(key: string): Promise<boolean> {
    const now = Date.now();
    const windowKey = `rate_limit:${key}:${Math.floor(now / (this.windowSizeSeconds * 1000))}`;

    try {
      const count = await (this.redis as any).incr(windowKey);

      if (count === 1) {
        // First request in this window, set expiry
        await (this.redis as any).expire(
          windowKey,
          this.windowSizeSeconds + 1,
        );
      }

      return count <= this.tokensPerWindow;
    } catch (err) {
      logger.error('Rate limit check failed', err);
      // Fail open - allow request on error
      return true;
    }
  }

  /**
   * Get remaining tokens
   */
  async getRemaining(key: string): Promise<number> {
    const now = Date.now();
    const windowKey = `rate_limit:${key}:${Math.floor(now / (this.windowSizeSeconds * 1000))}`;

    try {
      const count = await (this.redis as any).get(windowKey);
      return Math.max(0, this.tokensPerWindow - (parseInt(count) || 0));
    } catch (err) {
      logger.error('Failed to get remaining tokens', err);
      return this.tokensPerWindow;
    }
  }
}

export const apiRateLimiter = new RateLimiter(1000, 60); // 1000 req/min
export const paymentRateLimiter = new RateLimiter(100, 60); // 100 payments/min
