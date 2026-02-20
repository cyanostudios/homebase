#!/usr/bin/env node
// scripts/run-rename-slots-plugin-migration.js
// Run migration 032 (rename plugin kiosk -> slots) on the main database.
// Updates user_plugin_access and tenant_plugin_access. Run once.

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MIGRATION_FILE = path.join(
  __dirname,
  '../server/migrations/032-rename-kiosk-plugin-to-slots.sql',
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
    console.log('Running rename kiosk -> slots on main database...');
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
