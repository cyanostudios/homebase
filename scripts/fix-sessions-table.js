#!/usr/bin/env node
/**
 * Ensure sessions table matches connect-pg-simple (PRIMARY KEY on sid).
 * Run on Neon main: DATABASE_URL='...' node scripts/fix-sessions-table.js
 */
const path = require('path');
const { Pool } = require('pg');

const injected = { DATABASE_URL: process.env.DATABASE_URL };
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: true });
if (injected.DATABASE_URL) process.env.DATABASE_URL = injected.DATABASE_URL;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSONB NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);

    const pk = await client.query(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'sessions' AND constraint_type = 'PRIMARY KEY'
    `);
    if (pk.rows.length === 0) {
      await client.query('ALTER TABLE sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid)');
      console.log('✅ Added PRIMARY KEY (sid) on sessions');
    } else {
      console.log('○  sessions_pkey already exists');
    }

    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions (expire)');
    console.log('✅ sessions table ready for connect-pg-simple');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('fix-sessions-table failed:', err.message);
  process.exit(1);
});
