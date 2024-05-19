/**
 * Configuration loader
 * Author: Sarah Chen
 * Last modified: 2024-10-25
 * 
 * Load and validate application configuration
 */

import { getLogger } from './logger';

const logger = getLogger('config');

export interface AppConfig {
  env: string;
  port: number;
  db: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
    db: number;
  };
  jwt: {
    secret: string;
    expiry: string;
  };
  payment: {
    timeout: number;
    retries: number;
  };
  logging: {
    level: string;
    format: string;
  };
}

/**
 * Load configuration from environment
 */
export function loadConfig(): AppConfig {
  return {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000'),
    db: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      name: process.env.DB_NAME || 'payment_backend',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_DB || '0'),
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'default-secret',
      expiry: process.env.JWT_EXPIRY || '7d',
    },
    payment: {
      timeout: parseInt(process.env.PAYMENT_GATEWAY_TIMEOUT_MS || '30000'),
      retries: parseInt(process.env.PAYMENT_RETRY_MAX_ATTEMPTS || '3'),
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'json',
    },
  };
}

export const config = loadConfig();
