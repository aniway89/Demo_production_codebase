/**
 * Incomplete cron schedule definitions
 * Author: Marcus Rivera
 * Last modified: 2023-12-01
 * 
 * Defines cron jobs that should run
 * NOTE: Nothing actually uses these - jobs are started manually
 */

export const CRON_SCHEDULES = {
  // Run reconciliation hourly
  // Status: BROKEN - schedule not implemented
  HOURLY_RECONCILIATION: '0 * * * *',

  // Daily cleanup
  // Status: NOT IMPLEMENTED - no cleanup logic
  DAILY_CLEANUP: '0 2 * * *', // 2 AM

  // Weekly analytics aggregation
  // Status: TODO - analytics pipeline not built
  WEEKLY_ANALYTICS: '0 3 * * 0', // Sunday 3 AM

  // Monthly report generation
  // Status: NEVER IMPLEMENTED - ticket still open
  MONTHLY_REPORT: '0 4 1 * *', // 1st of month, 4 AM
};

// TODO: Actually wire up cron jobs
// Ticket: INFRA-2024-03
// Status: Blocked - waiting for scheduling service decision
