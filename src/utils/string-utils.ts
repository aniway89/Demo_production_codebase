/**
 * String utilities
 * Author: Sarah Chen
 * Last modified: 2024-10-20
 * 
 * Common string operations
 */

/**
 * Mask sensitive data for logging
 */
export function maskSensitive(value: string, showLast: number = 4): string {
  if (value.length <= showLast) {
    return '*'.repeat(value.length);
  }
  return '*'.repeat(value.length - showLast) + value.slice(-showLast);
}

/**
 * Mask credit card number
 */
export function maskCardNumber(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\s/g, '');
  if (cleaned.length < 4) {
    return '*'.repeat(cleaned.length);
  }
  return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
}

/**
 * Truncate string
 */
export function truncate(str: string, length: number = 50, suffix: string = '...'): string {
  if (str.length <= length) {
    return str;
  }
  return str.slice(0, length - suffix.length) + suffix;
}

/**
 * Slugify string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\\w\\s-]/g, '')
    .replace(/\\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Parse JSON safely
 */
export function safeJsonParse<T = any>(json: string, fallback: T | null = null): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
