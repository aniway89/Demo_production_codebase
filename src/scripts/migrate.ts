/**
 * Database migration runner
 * Author: Sarah Chen
 * Last modified: 2024-10-01
 * 
 * Run pending database migrations
 */

import { config } from 'dotenv';
import { initializeDatabase } from '../db/connection';
import { runMigrations } from '../db/migrations';
import { getLogger } from '../utils/logger';

config();

const logger = getLogger('migrate-script');

async function runMigrationScript() {
  try {
    logger.info('Starting migrations');

    await initializeDatabase();
    await runMigrations();

    logger.info('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
}

runMigrationScript();
