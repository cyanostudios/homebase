#!/usr/bin/env node
/**
 * Verify Neon main DB (DATABASE_URL) and Console API (NEON_API_KEY).
 *
 * Usage:
 *   npm run verify:neon
 *   DATABASE_URL='postgresql://...' NEON_API_KEY='...' node scripts/verify-neon.js
 *
 * Railway (uses service variables):
 *   railway run npm run verify:neon
 */
const path = require('path');
const { Pool } = require('pg');

const injected = {
  DATABASE_URL: process.env.DATABASE_URL,
  NEON_API_KEY: process.env.NEON_API_KEY,
};

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({
  path: path.join(__dirname, '..', '.env.local'),
  override: true,
});

if (injected.DATABASE_URL) process.env.DATABASE_URL = injected.DATABASE_URL;
if (injected.NEON_API_KEY) process.env.NEON_API_KEY = injected.NEON_API_KEY;

const { checkNeonApi, resolveTenantProvider } = require('../server/core/utils/neonApiHealth');

function maskUrl(url) {
  if (!url) return '(missing)';
  try {
    const u = new URL(url.replace(/^postgresql:/, 'http:'));
    return `postgresql://***@${u.hostname}${u.pathname}`;
  } catch {
    return '(invalid url)';
  }
}

function isLocalDb(url) {
  if (!url) return true;
  return /@(localhost|127\.0\.0\.1)[:\/]/.test(url) || url.includes('localhost:');
}

async function checkDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('❌ DATABASE_URL: not set');
    return false;
  }
  console.log(`○  DATABASE_URL: ${maskUrl(url)}`);
  if (isLocalDb(url)) {
    console.log('   ⚠️  points at localhost — use Neon main URL for production checks');
  }

  const pool = new Pool({ connectionString: url });
  try {
    await pool.query('SELECT 1');
    console.log('✅ Main DB SQL: connected');

    for (const table of ['users', 'sessions', 'tenants']) {
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
        console.log(`✅ Table ${table}: ok`);
      } catch (err) {
        const label = err?.code === '42P01' ? 'missing' : 'error';
        console.log(`❌ Table ${table}: ${label}${err?.message ? ` (${err.message})` : ''}`);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.log(`❌ Main DB SQL: ${err.message}`);
    return false;
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  console.log('=== Neon verification ===\n');
  const provider = resolveTenantProvider();
  console.log(`Tenant provider: ${provider}\n`);

  const dbOk = await checkDatabase();
  console.log('');

  let apiOk = true;
  if (provider === 'neon') {
    const neon = await checkNeonApi(process.env.NEON_API_KEY);
    if (neon.status === 'ok') {
      console.log(`✅ NEON_API_KEY: valid (${neon.projectCount} project(s) visible)`);
    } else if (neon.status === 'missing_key') {
      console.log('❌ NEON_API_KEY: not set');
      apiOk = false;
    } else {
      console.log(
        `❌ NEON_API_KEY: ${neon.status}${neon.httpStatus ? ` (HTTP ${neon.httpStatus})` : ''}`,
      );
      if (neon.message) console.log(`   ${neon.message}`);
      apiOk = false;
    }
  } else {
    console.log('○  NEON_API_KEY: skipped (tenant provider is not neon)');
  }

  console.log('');
  if (dbOk && apiOk) {
    console.log('✅ All checks passed');
    process.exit(0);
  }
  console.log('❌ Some checks failed');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
