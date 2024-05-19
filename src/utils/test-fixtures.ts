/**
 * Testing utilities and fixtures
 * Author: Daniel Lee
 * Last modified: 2024-11-01
 * 
 * Helpers for testing - ideally should be in tests/ folder
 */

export function createMockMerchant(overrides: any = {}) {
  return {
    id: `merchant_${Date.now()}`,
    name: 'Test Merchant',
    email: 'test@example.com',
    apiKey: 'sk_test_123',
    ...overrides,
  };
}

export function createMockCustomer(overrides: any = {}) {
  return {
    id: `cust_${Date.now()}`,
    email: 'customer@example.com',
    name: 'Test Customer',
    ...overrides,
  };
}

export function createMockPayment(overrides: any = {}) {
  return {
    id: `pay_${Date.now()}`,
    amount: 10000,
    currency: 'USD',
    status: 'pending',
    ...overrides,
  };
}

export function createMockJWT(merchantId: string = 'merchant_123'): string {
  // Base64 encoded JWT header.payload.signature
  const header = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const payload = Buffer.from(
    JSON.stringify({ merchantId, iat: Date.now() }),
  ).toString('base64');
  const signature = 'mock_signature';

  return `${header}.${payload}.${signature}`;
}
