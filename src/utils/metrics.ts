/**
 * Metrics and monitoring utilities
 * Author: Priya Nair
 * Last modified: 2024-11-03
 * 
 * Track application metrics
 * Currently basic - should integrate with monitoring service
 */

import { getLogger } from './logger';

const logger = getLogger('metrics');

interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

const metricsBuffer: Metric[] = [];

/**
 * Record a metric
 */
export function recordMetric(name: string, value: number, tags?: Record<string, string>): void {
  const metric: Metric = {
    name,
    value,
    timestamp: Date.now(),
    tags,
  };

  metricsBuffer.push(metric);

  // TODO: Send to monitoring service (Datadog, Prometheus, etc)
  // Currently just buffered in memory
}

/**
 * Common metrics
 */
export const metrics = {
  recordPaymentAttempt: (gateway: string) => {
    recordMetric('payment.attempt', 1, { gateway });
  },

  recordPaymentSuccess: (gateway: string, amount: number) => {
    recordMetric('payment.success', 1, { gateway });
    recordMetric('payment.amount', amount, { gateway });
  },

  recordPaymentFailure: (gateway: string, reason: string) => {
    recordMetric('payment.failure', 1, { gateway, reason });
  },

  recordReconciliationDuration: (durationMs: number) => {
    recordMetric('reconciliation.duration', durationMs);
  },

  recordCacheMiss: () => {
    recordMetric('cache.miss', 1);
  },

  recordCacheHit: () => {
    recordMetric('cache.hit', 1);
  },
};

/**
 * Flush metrics to monitoring service
 * Called periodically
 */
export async function flushMetrics(): Promise<void> {
  if (metricsBuffer.length === 0) {
    return;
  }

  logger.info({ metricCount: metricsBuffer.length }, 'Flushing metrics');

  // TODO: Send to monitoring service
  
  metricsBuffer.length = 0;
}
