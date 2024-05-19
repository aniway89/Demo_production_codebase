/**
 * Batch processing utilities
 * Author: Priya Nair
 * Last modified: 2024-10-28
 * 
 * Process large batches of items efficiently
 */

import { getLogger } from './logger';

const logger = getLogger('batch-processor');

/**
 * Process items in batches
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 100,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    logger.info({ batchSize: batch.length, offset: i }, 'Processing batch');

    const batchResults = await Promise.all(
      batch.map(item =>
        processor(item)
          .catch(err => {
            logger.error('Item processing failed', err);
            return null as any;
          }),
      ),
    );

    results.push(...batchResults.filter(r => r !== null));
  }

  return results;
}

/**
 * Process items sequentially (slower but safer)
 */
export async function processSequential<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];

  for (const item of items) {
    try {
      const result = await processor(item);
      results.push(result);
    } catch (err) {
      logger.error('Item processing failed', err);
    }
  }

  return results;
}
