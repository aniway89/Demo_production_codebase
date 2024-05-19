/**
 * Date and time utilities
 * Author: Sarah Chen
 * Last modified: 2024-10-25
 * 
 * Common date/time operations
 */

import moment from 'moment';

/**
 * Get start of day
 */
export function getStartOfDay(date: Date = new Date()): Date {
  return moment(date).startOf('day').toDate();
}

/**
 * Get end of day
 */
export function getEndOfDay(date: Date = new Date()): Date {
  return moment(date).endOf('day').toDate();
}

/**
 * Get start of month
 */
export function getStartOfMonth(date: Date = new Date()): Date {
  return moment(date).startOf('month').toDate();
}

/**
 * Get end of month
 */
export function getEndOfMonth(date: Date = new Date()): Date {
  return moment(date).endOf('month').toDate();
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  return moment(date).format(format);
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
  return moment(date).add(days, 'days').toDate();
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  return moment(date).isSame(new Date(), 'day');
}
