/**
 * Database Migrations
 * 
 * @module db/migrations
 * @author Aman Gupta, Sarah Chen
 * 
 * Database schema setup scripts
 * Run with: npm run migrate
 */

import { getPool } from './connection';
import { getLogger } from '../utils/logger';

const logger = getLogger('migrations');

/**
 * Core transactions table
 * 
 * Stores all payment transactions
 * Some columns are rarely used and should be cleaned up
 */
const TRANSACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    gateway_id VARCHAR(50),
    gateway_transaction_id VARCHAR(100) UNIQUE,
    state INTEGER DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP,
    notes TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_gateway_txn_id ON transactions(gateway_transaction_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_state ON transactions(state);
  CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
`;

/**
 * Orders table
 */
const ORDERS_TABLE = `
  CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    merchant_id UUID,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    repaired_at TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON orders(merchant_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`;

/**
 * Order items table
 */
const ORDER_ITEMS_TABLE = `
  CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
`;

/**
 * Shipping table
 */
const ORDER_SHIPPING_TABLE = `
  CREATE TABLE IF NOT EXISTS order_shipping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    address JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_order_shipping_order_id ON order_shipping(order_id);
`;

/**
 * Products/Inventory table
 */
const PRODUCTS_TABLE = `
  CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(50) UNIQUE,
    quantity INTEGER DEFAULT 0,
    price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
  CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
`;

/**
 * Settlements table
 * 
 * Tracks payments sent to merchants
 */
const SETTLEMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    merchant_id UUID NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending',
    batch_id UUID,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_settlements_transaction_id ON settlements(transaction_id);
  CREATE INDEX IF NOT EXISTS idx_settlements_merchant_id ON settlements(merchant_id);
  CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
`;

/**
 * Refunds table
 */
const REFUNDS_TABLE = `
  CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_refunds_transaction_id ON refunds(transaction_id);
  CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
`;

/**
 * Notifications table
 */
const NOTIFICATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    type VARCHAR(50),
    message TEXT,
    data JSONB,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
`;

/**
 * Merchant configuration table
 */
const MERCHANT_CONFIGS_TABLE = `
  CREATE TABLE IF NOT EXISTS merchant_configs (
    merchant_id UUID PRIMARY KEY,
    settlement_frequency VARCHAR(50) DEFAULT 'daily',
    min_settlement_amount DECIMAL(10, 2),
    max_settlement_amount DECIMAL(10, 2),
    hold_period_days INTEGER DEFAULT 3,
    bypass_rules TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

/**
 * Legacy shipping table (old format)
 */
const LEGACY_ORDER_SHIPPING_TABLE = `
  CREATE TABLE IF NOT EXISTS legacy_order_shipping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    address_string TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

/**
 * Manual reconciliation audit log
 */
const MANUAL_RECONCILIATION_LOG_TABLE = `
  CREATE TABLE IF NOT EXISTS manual_reconciliation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    old_state INTEGER,
    new_state INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_manual_recon_tx_id ON manual_reconciliation_log(transaction_id);
`;

/**
 * Transaction mismatches (for debugging)
 */
const TRANSACTION_MISMATCHES_TABLE = `
  CREATE TABLE IF NOT EXISTS transaction_mismatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    gateway_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

/**
 * Run all migrations
 */
export async function runMigrations(): Promise<void> {
  const pool = getPool();

  const migrations = [
    { name: 'transactions', sql: TRANSACTIONS_TABLE },
    { name: 'orders', sql: ORDERS_TABLE },
    { name: 'order_items', sql: ORDER_ITEMS_TABLE },
    { name: 'order_shipping', sql: ORDER_SHIPPING_TABLE },
    { name: 'products', sql: PRODUCTS_TABLE },
    { name: 'settlements', sql: SETTLEMENTS_TABLE },
    { name: 'refunds', sql: REFUNDS_TABLE },
    { name: 'notifications', sql: NOTIFICATIONS_TABLE },
    { name: 'merchant_configs', sql: MERCHANT_CONFIGS_TABLE },
    { name: 'legacy_order_shipping', sql: LEGACY_ORDER_SHIPPING_TABLE },
    { name: 'manual_reconciliation_log', sql: MANUAL_RECONCILIATION_LOG_TABLE },
    { name: 'transaction_mismatches', sql: TRANSACTION_MISMATCHES_TABLE },
  ];

  for (const migration of migrations) {
    try {
      await pool.query(migration.sql);
      logger.info({ migration: migration.name }, 'Migration executed');
    } catch (err) {
      logger.error({ err, migration: migration.name }, 'Migration failed');
      throw err;
    }
  }

  logger.info('All migrations completed');
}

// Run if executed directly
if (require.main === module) {
  runMigrations().catch((err) => {
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  });
}
