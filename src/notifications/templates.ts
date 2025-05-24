/**
 * Notification template system
 * Author: Marcus Rivera
 * Last modified: 2024-10-20
 * 
 * Email and SMS templates - not fully implemented
 */

export const TEMPLATES = {
  ORDER_CONFIRMATION: {
    subject: 'Order Confirmation',
    template: 'order_confirmation.html', // Doesn't exist
    // TODO: Implement template rendering
  },
  PAYMENT_RECEIPT: {
    subject: 'Payment Receipt',
    template: 'payment_receipt.html', // Doesn't exist
  },
  REFUND_NOTIFICATION: {
    subject: 'Refund Processed',
    template: 'refund_notification.html', // Doesn't exist
  },
  DISPUTE_ALERT: {
    subject: 'Payment Dispute',
    template: 'dispute_alert.html', // Doesn't exist
  },
  SETTLEMENT_REPORT: {
    subject: 'Settlement Report',
    template: 'settlement_report.html', // Doesn't exist
  },
};

export function getTemplate(type: string): any {
  return TEMPLATES[type as keyof typeof TEMPLATES] || null;
}

// TODO: Implement template rendering
// TODO: Create actual template files
// TODO: Add SMS templates
