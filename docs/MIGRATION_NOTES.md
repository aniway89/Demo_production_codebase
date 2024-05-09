/**
 * Migration notes and context
 * Author: Aman Gupta
 * Last modified: 2024-10-20
 * 
 * Notes on system migrations and evolution
 */

# System Evolution and Migration Notes

## 2023-05: Initial Launch
- Built payment reconciliation engine
- Custom retry queue implementation
- Single reconciliation engine bottleneck established

## 2023-08: Scaling Issues
- Added caching layer
- Cache invalidation becomes bottleneck
- Circular dependency with reconciliation engine created

## 2023-11: Legacy Merchant Issues (The Bypass)
- Some merchants couldn't migrate to new reconciliation
- Created "legacy_bypass" flag to skip reconciliation
- **PROBLEM**: This was never documented
- **ISSUE**: Creates data inconsistency
- **NOTE**: Still active today (Nov 2024)

## 2024-01: Fast Growth
- System scales to 100K transactions/day
- Query performance becomes critical issue
- Several manual patches for specific merchants

## 2024-02: Webhook System
- Added webhook delivery for merchant notifications
- No guaranteed delivery - synchronous
- No dead letter queue - events lost on failure

## 2024-03: Distributed Transactions (Aman's Big Project)
- Attempt to coordinate multi-step transactions
- Compensation logic is incomplete
- Still marked EXPERIMENTAL

## 2024-06: Cache Issues
- Pattern-based cache invalidation proves too slow
- New cache invalidation system started (V2)
- Feature flag created to rollout gradually
- Still has bugs - Flag still disabled

## 2024-08: Feature Flags
- Runtime feature flags added for gradual rollouts
- Implementation: In-memory only
- **PROBLEM**: Not persisted - lost on restart
- **STATUS**: No proper management UI

## 2024-09: Async Processing
- Need for async job processing
- Evaluated Bull, RabbitMQ
- Chose custom solution (quick implementation)
- **PROBLEM**: Fragile, prone to message loss

## Current State (Nov 2024)
- Multiple overlapping systems with similar purposes
- Technical debt accumulated from quick fixes
- Some modules updated, some abandoned
- Knowledge concentrated in few engineers
