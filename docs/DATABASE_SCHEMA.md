/**
 * Database schema documentation
 * Author: Sarah Chen
 * Last modified: 2024-10-15
 */

# Database Schema

## Tables

### merchants
```sql
CREATE TABLE merchants (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  webhook_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### transactions
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  merchant_id UUID REFERENCES merchants(id),
  gateway_txn_id VARCHAR(255) UNIQUE NOT NULL,
  amount BIGINT NOT NULL, -- cents
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(50) NOT NULL,
  reconciled BOOLEAN DEFAULT FALSE,
  reconciliation_status VARCHAR(50),
  adjusted BOOLEAN DEFAULT FALSE,
  adjustment_reason VARCHAR(255),
  merchant_legacy_bypass BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_merchant_id ON transactions(merchant_id);
CREATE INDEX idx_transactions_reconciled ON transactions(reconciled);
```

### orders
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  merchant_id UUID REFERENCES merchants(id),
  customer_id UUID NOT NULL,
  total_amount BIGINT NOT NULL, -- cents
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_merchant_id ON orders(merchant_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
```

### migrations
```sql
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW()
);
```

## Known Issues

1. **No foreign key constraints between orders and transactions**
   - Causes orphaned records
   - Reconciliation becomes complex

2. **Amount stored as BIGINT (cents)**
   - Loses precision for some currencies
   - Rounding errors possible

3. **Missing indexes**
   - Some common query patterns lack proper indexing
   - Performance degrades with large datasets

4. **Status values inconsistent**
   - Different status systems in different contexts
   - Legacy and new statuses coexist

5. **No soft deletes**
   - Deleted records are actually removed
   - No audit trail for deletions
