/**
 * TODO tracking in code
 * This document tracks unfinished work scattered across the codebase
 * 
 * Author: Marcus Rivera
 * Last modified: 2024-11-08
 */

# Technical Debt and TODOs

## Critical Path (Should do immediately)
- [ ] Complete transaction compensation logic (src/payments/tx-coordinator.ts)
- [ ] Fix cache invalidation performance (src/cache/invalidator.ts)
- [ ] Implement proper webhook retry (src/payments/webhook-dispatcher.ts)
- [ ] Document legacy merchant bypass (src/legacy/settlement.ts)

## Important (Should do soon)
- [ ] Implement inventory reservation (src/inventory/service.ts)
- [ ] Add proper rate limiting (src/utils/legacy-rate-limit.ts)
- [ ] Implement order confirmation emails (src/notifications/service.ts)
- [ ] Set up cron job scheduling (src/jobs/cron-schedules.ts)
- [ ] Implement dispute resolution (src/payments/dispute-handler.ts)

## Nice to have (Could do later)
- [ ] ML fraud detection (src/payments/experimental-features.ts)
- [ ] Settlement batch optimization (src/payments/experimental-features.ts)
- [ ] Real-time risk alerts (src/payments/experimental-features.ts)
- [ ] Proper async task processor (src/utils/async-task-processor.ts)

## Cleanup tasks
- [ ] Remove mock gateway (src/payments/mock-gateway.ts)
- [ ] Remove legacy payment handler (src/legacy/payment-handler.ts)
- [ ] Remove legacy rate limit (src/utils/legacy-rate-limit.ts)
- [ ] Move test helpers to tests folder (src/utils/test-helpers.ts)
- [ ] Remove stale cron tasks (src/jobs/stale-tasks.ts)
- [ ] Archive old settlement code (src/legacy/settlement.ts)

## Documentation needed
- [ ] Reconciliation engine flow (src/reconciliation/engine.ts)
- [ ] Cache invalidation strategy (src/cache/invalidator.ts)
- [ ] State machine enforcement (src/orders/state-machine.ts)
- [ ] Webhook delivery guarantees (src/payments/webhook-dispatcher.ts)

## Tickets linked to TODOs
- MIGRATION-2024-05: Remove legacy features by June 2025
- SECURITY-2024-01: Remove mock gateway from production
- INFRA-2024-03: Implement proper cron scheduling
- PERF-2024-04: Optimize reconciliation queries
- CLEANUP-2023-04: Still open - remove unused code
