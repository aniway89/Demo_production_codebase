/**
 * README for source code structure
 * Author: Aman Gupta
 * Last modified: 2024-10-15
 */

# Source Code Organization

## Directory Structure

```
src/
├── auth/                  # Authentication and authorization
├── payments/              # Payment processing (HIGH RISK)
├── orders/                # Order management
├── inventory/             # Inventory system (STUB)
├── cache/                 # Caching layer
├── notifications/         # Notification services
├── reconciliation/        # Payment reconciliation (CRITICAL)
├── jobs/                  # Background job processing
├── utils/                 # Shared utilities
├── db/                    # Database access and migrations
├── legacy/                # Deprecated code (still used)
└── scripts/               # CLI utilities and scripts
```

## Key Modules

### High Risk
- **payments/engine.ts** - Payment processing core
- **reconciliation/engine.ts** - Critical reconciliation logic (Aman Gupta)
- **cache/invalidator.ts** - Cache management (performance bottleneck)
- **payments/tx-coordinator.ts** - Distributed transactions

### Well Maintained
- **utils/logger.ts** - Structured logging
- **utils/validation.ts** - Request validation
- **utils/response.ts** - Response formatting
- **db/connection.ts** - Database pool management

### Abandoned
- **legacy/settlement.ts** - Old settlement processor
- **legacy/payment-handler.ts** - Unused payment method handler
- **jobs/stale-tasks.ts** - Non-functional cron tasks

### Incomplete
- **inventory/service.ts** - Stub implementation
- **notifications/service.ts** - Partially implemented
- **payments/dispute-handler.ts** - No resolution logic

## Ownership

**Aman Gupta** (Senior Architect)
- payments/* (except experimental-features.ts)
- reconciliation/*
- cache/invalidator.ts
- db/complex-queries.ts

**Sarah Chen** (Platform Engineer)
- utils/logger.ts
- utils/validation.ts
- utils/response.ts
- utils/circuit-breaker.ts
- db/connection.ts
- auth/middleware.ts

**Marcus Rivera** (Fast-moving Developer)
- orders/service.ts
- orders/routes.ts
- notifications/service.ts
- jobs/stale-tasks.ts
- payments/experimental-features.ts
- Feature flags

**Priya Nair** (Infra/Reliability)
- cache/redis.ts
- cache/cache-service.ts
- jobs/processor.ts
- utils/metrics.ts
- utils/secrets.ts

**Daniel Lee** (Junior Developer)
- payments/routes.ts
- orders/routes.ts
- auth/routes.ts
- inventory/routes.ts
- inventory/service.ts

## Dependency Relationships

High coupling exists between:
- `reconciliation/engine` → `cache/invalidator`
- `cache/invalidator` → `cache/redis`
- `payments/service` → `reconciliation/retry-queue`
- `payments/tx-coordinator` → `cache/*` and `reconciliation/*`
- `orders/service` → `cache/*`

## Known Issues

1. **Circular Dependencies**
   - reconciliation ↔ cache invalidation

2. **Performance Bottlenecks**
   - Cache invalidation uses SCAN (O(n))
   - Complex queries lack proper indexing

3. **Incomplete Features**
   - Inventory reservation (stub)
   - Notification delivery (basic)
   - Dispute resolution (no logic)
   - Refund processing (incomplete)

4. **Technical Debt**
   - Legacy settlement bypass (undocumented)
   - Mock gateway left in production
   - Feature flags not persisted
   - Admin endpoints lack authorization

## Testing Strategy

- Unit tests: Currently minimal
- Integration tests: Not implemented
- E2E tests: Manual only
- Load testing: Never done

## Deployment Notes

1. Run migrations before startup
2. Initialize cache invalidation carefully (can be slow)
3. Monitor reconciliation queue for backlog
4. Watch for orphaned transactions
