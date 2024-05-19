/**
 * Secrets management
 * Author: Priya Nair
 * Last modified: 2024-11-05
 * 
 * Load and manage secrets from environment
 */

import { getLogger } from './logger';

const logger = getLogger('secrets');

interface Secrets {
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  stripeSecretKey: string;
  stripePublishableKey: string;
  webhookSecret: string;
}

/**
 * Load secrets from environment
 */
export function loadSecrets(): Secrets {
  const secrets = {
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL || '',
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-prod',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.WEBHOOK_SECRET || '',
  };

  // Validate critical secrets are set
  if (!secrets.jwtSecret.includes('change-in-prod')) {
    logger.warn('Using default JWT secret - must change in production');
  }

  if (!secrets.stripeSecretKey) {
    logger.warn('Stripe secret key not configured - payment processing will fail');
  }

  return secrets;
}

export const secrets = loadSecrets();
