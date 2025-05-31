/**
 * Database query builder utilities
 * Author: Sarah Chen
 * Last modified: 2024-10-28
 * 
 * Safe SQL construction helpers to prevent injection
 */

import { Pool, QueryResult } from 'pg';

/**
 * Build a WHERE clause safely
 */
export function buildWhereClause(
  conditions: Record<string, any>,
): { where: string; values: any[] } {
  const clauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(conditions)) {
    if (value !== null && value !== undefined) {
      clauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  return {
    where: clauses.join(' AND '),
    values,
  };
}

/**
 * Build an INSERT statement safely
 */
export function buildInsertStatement(
  table: string,
  data: Record<string, any>,
): { sql: string; values: any[] } {
  const columns = Object.keys(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const columnList = columns.join(', ');
  const values = Object.values(data);

  return {
    sql: `INSERT INTO ${table} (${columnList}) VALUES (${placeholders}) RETURNING *`,
    values,
  };
}

/**
 * Build an UPDATE statement safely
 */
export function buildUpdateStatement(
  table: string,
  data: Record<string, any>,
  where: Record<string, any>,
): { sql: string; values: any[] } {
  const dataColumns = Object.keys(data);
  const whereColumns = Object.keys(where);

  let paramIndex = 1;

  // SET clause
  const setClauses = dataColumns.map((col) => {
    const param = `$${paramIndex}`;
    paramIndex++;
    return `${col} = ${param}`;
  });

  // WHERE clause
  const whereClauses = whereColumns.map((col) => {
    const param = `$${paramIndex}`;
    paramIndex++;
    return `${col} = ${param}`;
  });

  const values = [...Object.values(data), ...Object.values(where)];

  return {
    sql: `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')} RETURNING *`,
    values,
  };
}
