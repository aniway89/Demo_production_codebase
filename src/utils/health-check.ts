/**
 * Health check utilities
 * Author: Priya Nair
 * Last modified: 2024-11-05
 * 
 * Comprehensive health checks for all services
 */

import { getDatabase } from '../db/connection';
import { getRedisClient } from '../cache/redis';
import { getLogger } from './logger';

const logger = getLogger('health-check');

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: Record<string, ServiceHealth>;
}

interface ServiceHealth {
  status: 'up' | 'down';
  responseTime?: number;
  error?: string;
}

/**
 * Perform full health check
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const services: Record<string, ServiceHealth> = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Check database
  try {
    const startTime = Date.now();
    const db = getDatabase();
    await db.query('SELECT 1');
    services.database = {
      status: 'up',
      responseTime: Date.now() - startTime,
    };
  } catch (err) {
    services.database = {
      status: 'down',
      error: String(err),
    };
    overallStatus = 'unhealthy';
  }

  // Check Redis
  try {
    const startTime = Date.now();
    const redis = getRedisClient();
    await (redis as any).ping();
    services.redis = {
      status: 'up',
      responseTime: Date.now() - startTime,
    };
  } catch (err) {
    services.redis = {
      status: 'down',
      error: String(err),
    };
    overallStatus = 'degraded'; // Redis is less critical than DB
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services,
  };
}
