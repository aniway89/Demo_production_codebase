/**
 * Notification service
 * Author: Marcus Rivera
 * Last modified: 2024-10-25
 * 
 * Sends various notifications - email, SMS, webhook, etc.
 * TEMPORARY IMPLEMENTATION - needs proper architecture
 */

import { getLogger } from '../utils/logger';
import { notificationQueue } from '../jobs/processor';

const logger = getLogger('notification-service');

export class NotificationService {
  /**
   * Send order confirmation email
   * FIXME: Email service not properly integrated
   */
  async sendOrderConfirmation(orderId: string, customerId: string): Promise<void> {
    logger.info({ orderId, customerId }, 'Queueing order confirmation');

    // TODO: Implement email template
    // Currently just logs
    
    await notificationQueue.add({
      type: 'ORDER_CONFIRMATION',
      orderId,
      customerId,
    });
  }

  /**
   * Send payment receipt
   * HACK: Currently not sending anything
   */
  async sendPaymentReceipt(paymentId: string, email: string): Promise<void> {
    logger.info({ paymentId, email }, 'Payment receipt requested');
    // TODO: Actually implement
  }

  /**
   * Send webhook notification
   * FIXME: No retry logic for failed webhooks
   */
  async sendWebhook(merchantId: string, event: string, data: any): Promise<void> {
    logger.info({ merchantId, event }, 'Sending webhook');
    
    // TODO: Get merchant webhook URL from database
    // TODO: Implement actual webhook delivery
    // TODO: Implement retry with exponential backoff
  }
}

export const notificationService = new NotificationService();
