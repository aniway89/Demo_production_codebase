/**
 * Incident tracking and notes
 * Author: Aman Gupta
 * Last modified: 2024-11-08
 */

# Known Incidents and Patches

## 2023-07-15: Reconciliation Loop
**Severity:** High
**Root Cause:** Infinite retry loop in reconciliation engine
**Fix:** Added max retry count (RECONCILIATION_MAX_RETRIES = 7)
**File:** src/reconciliation/retry-queue.ts
**Notes:** Magic number chosen empirically - may need tuning

## 2023-11-30: Legacy Merchant Issues
**Severity:** Critical
**Root Cause:** Some merchants couldn't migrate to new system
**Fix:** Added `merchant_legacy_bypass` flag
**File:** src/reconciliation/engine.ts
**Problem:** Never properly documented, still active
**Status:** Should be removed by June 2025

## 2024-01-20: Cache Explosion
**Severity:** Medium
**Root Cause:** Cache keys not expiring properly
**Fix:** Added TTL enforcement
**File:** src/cache/cache-service.ts
**Notes:** Happened during peak traffic

## 2024-03-15: Orphaned Transaction Accumulation
**Severity:** Medium
**Root Cause:** Payment processing succeeded but order creation failed
**Fix:** Store failed transaction IDs in Redis for manual review
**File:** src/reconciliation/engine.ts
**Problem:** Hack - no proper compensation logic
**Status:** Manual intervention required

## 2024-05-10: Database Connection Pool Exhaustion
**Severity:** Critical
**Root Cause:** Connection leak in complex queries
**Fix:** Proper connection cleanup
**File:** src/db/connection.ts
**Notes:** Some queries still may leak connections

## 2024-07-03: Webhook Delivery Failures
**Severity:** Medium
**Root Cause:** No retry logic for failed webhooks
**Fix:** Manual re-send (not automated)
**File:** src/payments/webhook-dispatcher.ts
**Problem:** No guaranteed delivery
**Status:** Events lost on process crash

## 2024-08-15: Cache Invalidation Performance
**Severity:** High
**Root Cause:** SCAN operation too slow for large merchants
**Fix:** Feature flag for new invalidation system (not enabled)
**File:** src/cache/invalidator.ts
**Problem:** V2 still has bugs
**Status:** Blocked until V2 is stable

## 2024-10-20: Partial Refunds Broken
**Severity:** Medium
**Root Cause:** Refund processor doesn't handle partial refunds
**Fix:** Disable partial refund feature
**File:** src/payments/refund-processor.ts
**Problem:** Can only do full refunds now
**Status:** Waiting for refund system redesign

## Lessons Learned
1. Feature flags should be properly persisted (not in-memory)
2. Custom systems are risky - use well-tested libraries
3. Incident-driven patches accumulate - need scheduled cleanup
4. Tribal knowledge concentration is dangerous
5. Legacy features should have clear deprecation timelines
