/**
 * Stale cron job - should have been deleted
 * Author: Marcus Rivera
 * Last modified: 2022-11-10 (NOT UPDATED IN 2 YEARS)
 * 
 * This job runs every hour but is mostly ineffective
 * TODO: Remove this - it was for a feature that was cancelled
 * Ticket: CLEANUP-2023-04 (still open)
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('stale-job');

/**
 * Run daily cleanup
 * Currently does nothing useful
 */
export async function runDailyCleanup(): Promise<void> {
  logger.info('Running daily cleanup job');

  try {
    // TODO: Implement cleanup logic
    // Was supposed to clean up temporary files
    // But storage system was changed and this wasn't updated

    logger.info('Daily cleanup completed');
  } catch (err) {
    logger.error('Daily cleanup failed', err);
    // No alerting set up for this job
  }
}

/**
 * Run hourly reconciliation check
 * FIXME: This duplicates the reconciliation engine logic
 */
export async function runHourlyReconciliation(): Promise<void> {
  logger.info('Running hourly reconciliation');

  try {
    // HACK: Just logs, doesn't actually do anything
    // The real reconciliation happens in the engine
    // This job was added as a "quick fix" and never removed

    logger.info('Hourly reconciliation completed');
  } catch (err) {
    logger.error('Hourly reconciliation failed', err);
  }
}
