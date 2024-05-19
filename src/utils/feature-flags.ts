/**
 * Feature flags and configuration
 * Author: Marcus Rivera
 * Last modified: 2024-11-06
 * 
 * Runtime feature flags - some are temporary hacks
 */

import { getRedisClient } from '../cache/redis';
import { getLogger } from '../utils/logger';

const logger = getLogger('feature-flags');

interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  expiresAt?: number;
}

const DEFAULT_FLAGS: FeatureFlag[] = [
  {
    name: 'enable_legacy_settlement',
    enabled: process.env.ENABLE_LEGACY_SETTLEMENT === 'true',
    description: 'Enable old settlement processor for legacy merchants',
    expiresAt: new Date('2025-06-01').getTime(), // Was supposed to be removed
  },
  {
    name: 'enable_async_notifications',
    enabled: process.env.ENABLE_ASYNC_NOTIFICATIONS === 'true',
    description: 'Queue notifications instead of sending synchronously',
  },
  {
    name: 'enable_cache_invalidation_v2',
    enabled: process.env.ENABLE_CACHE_INVALIDATION_V2 === 'true',
    description: 'Use new cache invalidation system (still has bugs)',
    expiresAt: new Date('2024-12-31').getTime(),
  },
  {
    name: 'enable_distributed_tx',
    enabled: false,
    description: 'Enable distributed transaction coordinator (EXPERIMENTAL)',
  },
  {
    name: 'bypass_payment_verification',
    enabled: false,
    description: 'DANGEROUS: Skip payment verification (temporary during testing)',
  },
];

export class FeatureFlagManager {
  private redis = getRedisClient();
  private cache = new Map<string, FeatureFlag>();

  async init(): Promise<void> {
    // Load flags from environment/database
    // Store in cache
    for (const flag of DEFAULT_FLAGS) {
      this.cache.set(flag.name, flag);
    }
    logger.info(`Loaded ${this.cache.size} feature flags`);
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(flagName: string): boolean {
    const flag = this.cache.get(flagName);
    
    if (!flag) {
      logger.warn({ flagName }, 'Feature flag not found, defaulting to false');
      return false;
    }

    // Check if flag has expired
    if (flag.expiresAt && flag.expiresAt < Date.now()) {
      logger.warn({ flagName }, 'Feature flag has expired');
      return false;
    }

    return flag.enabled;
  }

  /**
   * Set a feature flag at runtime
   * HACK: No persistence - will be lost on restart
   */
  async setFlag(flagName: string, enabled: boolean): Promise<void> {
    const flag = this.cache.get(flagName);
    
    if (flag) {
      flag.enabled = enabled;
      logger.info({ flagName, enabled }, 'Feature flag updated');
      // TODO: Persist to database
      // Currently just in-memory
    } else {
      logger.error({ flagName }, 'Cannot set unknown feature flag');
    }
  }
}

export const featureFlags = new FeatureFlagManager();
