// scripts/run-user-mfa-migration.js
// Run user_mfa migration on main database (public schema).
// MFA uses main pool; this table must exist in the main DB.

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const MIGRATION = path.join(__dirname, '../server/migrations/054-user-mfa.sql');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
    console.log('✅ user_mfa migration applied on main database');
  } catch (err) {
    if (err.message?.includes('already exists') || err.code === '42P07') {
      console.log('⚠️  user_mfa table already exists');
    } else {
      console.error('❌', err.message);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main();
