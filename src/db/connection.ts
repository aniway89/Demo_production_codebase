/**
 * Database connection and query utilities
 * 
 * @module db/connection
 * @author Sarah Chen
 * 
 * Manages PostgreSQL connections and provides type-safe query builders.
 * All database access should go through these abstractions.
 */

import { Pool, PoolClient } from 'pg';
import { getLogger } from '../utils/logger';

const logger = getLogger('database');

let pool: Pool;

/**
 * Initialize database connection pool
 */
export const initDatabase = async () => {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected error on idle client');
  });

  try {
    const client = await pool.connect();
    client.release();
    logger.info('Database connection established');
  } catch (err) {
    logger.error({ err }, 'Failed to connect to database');
    throw err;
  }
};

/**
 * Get database connection pool
 */
export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool;
};

/**
 * Execute a query with proper error handling
 */
export const query = async <T extends any[]>(
  sql: string,
  params?: any[],
): Promise<T> => {
  const pool = getPool();
  try {
    const result = await pool.query(sql, params);
    return result.rows as T;
  } catch (err) {
    logger.error({ err, sql }, 'Database query failed');
    throw err;
  }
};

/**
 * Execute a single row query
 */
export const queryOne = async <T>(
  sql: string,
  params?: any[],
): Promise<T | null> => {
  const rows = await query<T[]>(sql, params);
  return rows[0] || null;
};

/**
 * Execute a transaction
 */
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Transaction failed');
    throw err;
  } finally {
    client.release();
  }
};

export const Database = {
  initDatabase,
  getPool,
  query,
  queryOne,
  transaction,
};
