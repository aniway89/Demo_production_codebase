/**
 * Number utilities
 * Author: Sarah Chen
 * Last modified: 2024-10-22
 * 
 * Decimal and currency operations
 */

import Decimal from 'decimal.js';

/**
 * Convert cents to decimal amount
 */
export function centsToDecimal(cents: number): Decimal {
  return new Decimal(cents).dividedBy(100);
}

/**
 * Convert decimal amount to cents
 */
export function decimalToCents(amount: Decimal | number): number {
  const decimal = amount instanceof Decimal ? amount : new Decimal(amount);
  return decimal.times(100).toNumber();
}

/**
 * Format amount for display
 */
export function formatCurrency(cents: number, currencyCode: string = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  });

  return formatter.format(centsToDecimal(cents).toNumber());
}

/**
 * Calculate percentage
 */
export function calculatePercentage(amount: number, percentage: number): number {
  return new Decimal(amount).times(new Decimal(percentage).dividedBy(100)).toNumber();
}

/**
 * Add percentage to amount (for fees)
 */
export function addPercentage(amount: number, percentage: number): number {
  return new Decimal(amount)
    .plus(calculatePercentage(amount, percentage))
    .toNumber();
}

/**
 * Check if number is valid amount
 */
export function isValidAmount(amount: any): boolean {
  if (typeof amount !== 'number') return false;
  return amount > 0 && isFinite(amount);
}
