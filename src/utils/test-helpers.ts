/**
 * Temporary test utilities
 * Author: Marcus Rivera
 * Last modified: 2024-08-10
 * 
 * Test helpers - should be in test folder
 * NOTE: Accidentally left in source code
 */

export function generateMockTransaction(overrides: any = {}) {
  return {
    id: `txn_${Date.now()}`,
    amount: 10000,
    currency: 'USD',
    status: 'pending',
    ...overrides,
  };
}

export function generateMockOrder(overrides: any = {}) {
  return {
    id: `order_${Date.now()}`,
    customerId: 'cust_123',
    totalAmount: 10000,
    status: 'pending',
    ...overrides,
  };
}

// TODO: Move these to proper test utilities
// These are being used in production code which is wrong
