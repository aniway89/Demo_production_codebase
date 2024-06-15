/**
 * Order state machine
 * Author: Aman Gupta
 * Last modified: 2024-10-25
 * 
 * Defines valid order state transitions
 * WARNING: State machine logic is not properly enforced throughout codebase
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('order-state-machine');

// Valid order states
export enum OrderStatus {
  PENDING = 'pending',
  PAYMENT_PROCESSING = 'payment_processing',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  FULFILLING = 'fulfilling',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
}

// Valid transitions
const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAYMENT_PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PAYMENT_PROCESSING]: [OrderStatus.PAYMENT_CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.PAYMENT_CONFIRMED]: [OrderStatus.FULFILLING, OrderStatus.REFUNDED],
  [OrderStatus.FULFILLING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.DISPUTED],
  [OrderStatus.DELIVERED]: [OrderStatus.DISPUTED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.DISPUTED]: [OrderStatus.REFUNDED],
};

/**
 * Validate state transition
 * FIXME: This is defined but not actually used in order-service.ts
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Get next valid states
 */
export function getNextStates(status: OrderStatus): OrderStatus[] {
  return VALID_TRANSITIONS[status] || [];
}

/**
 * Validate status
 */
export function isValidStatus(status: string): status is OrderStatus {
  return Object.values(OrderStatus).includes(status as OrderStatus);
}
