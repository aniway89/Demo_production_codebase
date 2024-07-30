/**
 * Temporary Hotfix: Payment Retry Logic
 * 
 * @module payments/temp-retry-hotfix
 * @author Marcus Rivera
 * 
 * QUICK PATCH for production issue (incident-20240301)
 * 
 * This is a temporary bypass for retry logic that should be
 * removed after the proper solution is implemented.
 * 
 * Problem: Certain payment gateways were timing out
 * Temporary solution: Add inline retry before delegating to retry queue
 * 
 * TODO: Remove after gateway integration is fixed
 * This should have been removed 3 months ago
 * 
 * @deprecated Do not use in new code
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('temp-retry-hotfix');

const MAX_INLINE_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

/**
 * Temporary retry wrapper
 * 
 * Implements simple exponential backoff before giving up
 * and delegating to the proper retry queue.
 * 
 * This is a band-aid and shouldn't be permanent.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = MAX_INLINE_RETRIES,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug({ attempt }, 'Attempt');
      return await fn();
    } catch (err) {
      lastError = err as Error;
      
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        const jitter = Math.random() * backoffMs * 0.1;
        const delayMs = backoffMs + jitter;

        logger.warn(
          { attempt, err, nextRetryMs: delayMs },
          'Retry attempt failed, retrying',
        );

        // Sleep (not ideal but works for quick fix)
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  logger.error({ maxRetries, err: lastError }, 'All retries exhausted');
  throw lastError || new Error('Unknown error');
}

/**
 * Remove after gateway issues are resolved
 * 
 * This is explicitly marked for removal but no one has done it
 * because the code still works and changing it is risky.
 */
export function markForRemovalAfterGatewayFix(): void {
  logger.warn('This hotfix should be removed after gateway fix');
  // This function does nothing - just a reminder
}
