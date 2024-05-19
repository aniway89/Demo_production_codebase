/**
 * Unused/abandoned constants file
 * Author: Daniel Lee
 * Last modified: 2022-10-15
 * 
 * Many of these constants are no longer used
 */

// Old payment gateway constants - gateway was changed but these remain
export const OLD_GATEWAY_CONSTANTS = {
  TIMEOUT: 45000, // milliseconds - why 45 seconds?
  RETRY_COUNT: 5,
  MAX_AMOUNT: 999999, // cents - arbitrary limit
  MIN_AMOUNT: 50, // cents
};

// Legacy merchant tiers - system has since changed
export enum MERCHANT_TIER {
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

// Settlement fees by tier - these values are hardcoded elsewhere
export const SETTLEMENT_FEES_PERCENT: Record<MERCHANT_TIER, number> = {
  [MERCHANT_TIER.BASIC]: 2.9,
  [MERCHANT_TIER.STANDARD]: 2.5,
  [MERCHANT_TIER.PREMIUM]: 2.0,
  [MERCHANT_TIER.ENTERPRISE]: 1.5,
};

// TODO: Remove these constants after migrating to config service
// Currently half the codebase uses these, half hardcodes values
// Inconsistent across modules
