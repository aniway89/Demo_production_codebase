/**
 * Abandoned feature: Old payment method handler
 * Author: Marcus Rivera
 * Last modified: 2023-11-20
 * 
 * This was used for handling old payment methods that are no longer supported
 * Kept in codebase but not actively used - should be removed
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('legacy-payment-handler');

// This is dead code - kept for historical reasons
// No new features should use this

export async function handleOldPaymentMethod(method: string, data: any): Promise<void> {
  logger.warn({ method }, 'Old payment method handler called - should not happen');
  
  // FIXME: This code was never finished
  // and references services that have been removed
  // Don't use this
}

// TODO: Remove this file after all legacy merchants migrate
// Ticket: MIGRATION-2024-05
