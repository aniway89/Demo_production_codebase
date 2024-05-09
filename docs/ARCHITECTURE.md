# Payment & Order Management Backend

Distributed payment and order management system with real-time reconciliation.

## Architecture Overview

### Core Systems

1. **Payment Processing** (`/src/payments`)
   - Payment creation and gateway integration
   - Transaction reconciliation engine
   - Settlement processor for merchant payouts
   - Custom retry queue system with circuit breakers

2. **Order Management** (`/src/orders`)
   - Order creation and lifecycle management
   - Order item tracking
   - Shipping address management

3. **Cache Layer** (`/src/cache`)
   - Redis-backed distributed cache
   - Pattern-based invalidation
   - Prevents cache thundering with distributed locks

4. **Job Processing** (`/src/jobs`)
   - Background job worker
   - Daily settlement batches
   - Cache warming and maintenance

### Key Modules

#### Reconciliation Engine
- Matches gateway responses to internal transactions
- Handles multiple lookup strategies for legacy flows
- Manages payment state transitions
- Triggers settlement when appropriate

**Owner**: Aman Gupta

#### Retry Queue
- Bull-based job queue with Redis persistence
- Exponential backoff for retries
- Circuit breaker pattern to prevent cascading failures
- Handles multiple job types: reconciliation, settlement, webhooks, notifications

**Owner**: Aman Gupta

#### Settlement Processor
- Validates settlement rules per merchant
- Manages hold periods and fraud protection
- Processes batch settlements
- Supports manual override for ops team

**Owner**: Aman Gupta

### Authentication

JWT-based authentication middleware included in `auth/middleware.ts`
- Token validation and user context injection
- Role-based access control support

### Utilities

Clean, well-documented utilities in `/src/utils`:
- `logger.ts` - Structured logging with Pino
- `response.ts` - Standard API response formatting
- `error-handler.ts` - Centralized error handling
- `validation.ts` - Request validation with Joi

**Owner**: Sarah Chen

## Known Issues & Technical Debt

### High Priority

1. **Reconciliation Logic Complexity**
   - Multiple lookup strategies for legacy merchants
   - Hard to follow state machine logic
   - Incident-driven patches accumulating
   - Duplicate logic with deprecated old-reconciliation.ts

2. **Hardcoded Configuration**
   - Merchant bypass rules hardcoded in SettlementProcessor
   - Gateway endpoints hardcoded in payment routes
   - Magic constants throughout reconciliation logic

3. **Settlement Logic Gaps**
   - Manual settlement pathway bypasses validation
   - No circuit breaker on actual payout execution
   - Stub implementation for settlement transfer

### Medium Priority

4. **Legacy Code**
   - Old reconciliation and order systems still partially in use
   - 30% of payment flow still uses legacy reconciliation
   - Feature flags that are never checked

5. **Testing**
   - No comprehensive tests for reconciliation edge cases
   - No tests for failed settlement scenarios
   - Cache invalidation patterns not fully tested

6. **Documentation**
   - Business logic for settlement bypass not documented
   - State machine transitions not clearly specified
   - Incident-driven changes not tracked properly

### Known Bugs & Edge Cases

1. **Cache Consistency**
   - Cache can be cleared while jobs are processing
   - Distributed cache invalidation can be inconsistent across regions
   - TTL pattern doesn't prevent expiration on repeated sets

2. **Orphaned Transactions**
   - Some merchants with old gateway integrations produce orphaned transactions
   - Manual review required but process is not well defined

3. **Duplicate Settlements**
   - Cache double-check prevents most duplicates but isn't foolproof
   - Manual settlement can bypass cache check entirely

## Getting Started

### Installation

```bash
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
```

### Database Setup

```bash
npm run migrate
```

### Running

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

Background Jobs:
```bash
npm run worker
```

## API Endpoints

### Payments
- `POST /api/payments` - Create payment
- `GET /api/payments/:transactionId/status` - Check payment status
- `POST /api/payments/:transactionId/refund` - Refund payment
- `POST /api/payments/webhook` - Gateway webhook handler

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders/:orderId` - Get order details
- `PATCH /api/orders/:orderId/status` - Update order status

### Inventory
- `GET /api/inventory` - List products
- `GET /api/inventory/:itemId` - Get product details
- `PATCH /api/inventory/:itemId/quantity` - Update quantity

## Emergency Operations

### Manual Reconciliation

For stuck payments:
```bash
npm run reconcile -- --transactionId=<id> --status=captured
```

### Manual Settlement

For stuck settlements:
```bash
npm run reconcile -- --settleMerchant=<merchantId>
```

**WARNING**: These bypass validation and should only be used with proper approval.

## Architecture Decisions

### Why Custom Retry Queue?

Standard job queues didn't meet timing requirements for payment critical path. Custom implementation allows:
- Tighter control over retry logic
- Circuit breaker integration
- Payment-specific backoff strategies

### Cache Pattern Invalidation

Dependency-based cascading invalidation prevents orphaned cache entries but can be inconsistent. Consider switching to event-based invalidation.

### Multiple Reconciliation Lookups

Legacy merchants don't have clean transaction ID mappings. Multi-strategy lookup necessary for compatibility but creates complexity.

## Future Improvements

1. Migrate all code to new reconciliation engine
2. Move hardcoded configuration to database
3. Implement proper settlement microservice integration
4. Add comprehensive test coverage for payment flows
5. Implement event-based architecture for better decoupling
6. Document all incident-driven changes
7. Consolidate duplicate logic between old and new systems

## Contributing

- All payment logic changes require review from Aman
- Utility changes should be reviewed by Sarah
- Infrastructure changes should be reviewed by Priya
- See individual module headers for ownership information
