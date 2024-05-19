/**
 * Retry utilities with exponential backoff
 * Author: Sarah Chen
 * Last modified: 2024-10-25
 * 
 * Clean implementation of retry logic
 */

import { getLogger } from './logger';

const logger = getLogger('retry');

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | null = null;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      logger.debug(
        { attempt, maxAttempts, error: String(err) },
        'Retry attempt failed',
      );

      if (attempt < maxAttempts) {
        await delay(delayMs);
        delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Simple delay function
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
