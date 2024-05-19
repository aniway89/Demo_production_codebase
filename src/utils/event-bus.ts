/**
 * Event bus for internal communication
 * Author: Marcus Rivera
 * Last modified: 2024-10-18
 * 
 * Simple event emitter for internal events
 * HACK: Not integrated properly - mostly unused
 */

import { EventEmitter } from 'events';
import { getLogger } from './logger';

const logger = getLogger('event-bus');

/**
 * Application event bus
 */
class EventBus extends EventEmitter {
  emit(eventName: string | symbol, ...args: any[]): boolean {
    logger.debug({ event: String(eventName) }, 'Event emitted');
    return super.emit(eventName, ...args);
  }

  on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    logger.debug({ event: String(eventName) }, 'Event listener registered');
    return super.on(eventName, listener);
  }
}

export const eventBus = new EventBus();

// Define event types
export const Events = {
  PAYMENT_CREATED: 'payment:created',
  PAYMENT_SUCCEEDED: 'payment:succeeded',
  PAYMENT_FAILED: 'payment:failed',
  ORDER_CREATED: 'order:created',
  ORDER_COMPLETED: 'order:completed',
  ORDER_CANCELLED: 'order:cancelled',
  RECONCILIATION_STARTED: 'reconciliation:started',
  RECONCILIATION_COMPLETED: 'reconciliation:completed',
  DISPUTE_RECEIVED: 'dispute:received',
  REFUND_PROCESSED: 'refund:processed',
};

// TODO: Properly integrate event bus throughout application
// Currently defined but not widely used
