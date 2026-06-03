#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true });

const dbUrl =
  process.env.TARGET_DATABASE_URL || process.env.PROD_MAIN_DATABASE_URL || process.env.DATABASE_URL;

async function main() {
  if (!dbUrl) {
    console.error('DATABASE_URL (or TARGET_DATABASE_URL) is required');
    process.exit(1);
  }
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'server/migrations/026-password-reset-tokens.sql'),
    'utf8',
  );
  const pool = new Pool({ connectionString: dbUrl });
  try {
    await pool.query(sql);
    console.log('✅ password_reset_tokens migration applied');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
