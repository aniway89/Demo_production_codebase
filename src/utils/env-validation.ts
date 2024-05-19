/**
 * Environment configuration validation
 * Author: Priya Nair
 * Last modified: 2024-10-28
 * 
 * Validates that required environment variables are set
 */

import { getLogger } from './logger';

const logger = getLogger('env-validation');

const REQUIRED_ENV_VARS = [
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'REDIS_HOST',
  'JWT_SECRET',
];

const RECOMMENDED_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'WEBHOOK_SECRET',
];

/**
 * Validate environment configuration
 */
export function validateEnvironment(): void {
  logger.info('Validating environment configuration');

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check recommended variables
  for (const envVar of RECOMMENDED_ENV_VARS) {
    if (!process.env[envVar]) {
      warnings.push(envVar);
    }
  }

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (warnings.length > 0) {
    logger.warn(`Missing recommended environment variables: ${warnings.join(', ')}`);
  }

  // Check for obviously unsafe defaults
  if (process.env.JWT_SECRET === 'default-secret-change-in-prod') {
    logger.error('Using default JWT secret - NOT SAFE FOR PRODUCTION');
  }

  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'development') {
    logger.warn(`Unusual NODE_ENV value: ${process.env.NODE_ENV}`);
  }

  logger.info('Environment validation completed');
}
