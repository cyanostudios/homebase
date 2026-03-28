#!/usr/bin/env node
// scripts/run-remove-cups-plugin-access-migration.js
// Run migration 053 on the main application database (plugin access tables).
// Run once after deploying cups removal.

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MIGRATION_FILE = path.join(
  __dirname,
  '../server/migrations/053-remove-cups-plugin-access.sql',
);

async function main() {
  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error(`Migration file not found: ${MIGRATION_FILE}`);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Removing cups from user_plugin_access / tenant_plugin_access...');
    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    await pool.query(sql);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
