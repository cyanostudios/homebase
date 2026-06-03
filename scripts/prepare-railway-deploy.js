#!/usr/bin/env node
/**
 * Pre-flight for Homebase on Railway: validate env, optional main-DB migrations.
 *
 * Usage (Neon main URL in env — do not commit secrets):
 *   DATABASE_URL='postgresql://...' TENANT_PROVIDER=neon NEON_API_KEY=... node scripts/prepare-railway-deploy.js
 *   DATABASE_URL='...' node scripts/prepare-railway-deploy.js --migrate
 *
 * Reads .env.local when vars are unset (same as server).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const cliEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  NEON_API_KEY: process.env.NEON_API_KEY,
};

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({
  path: path.join(__dirname, '..', '.env.local'),
  override: true,
});

if (cliEnv.DATABASE_URL) process.env.DATABASE_URL = cliEnv.DATABASE_URL;
if (cliEnv.NEON_API_KEY) process.env.NEON_API_KEY = cliEnv.NEON_API_KEY;

const migrate = process.argv.includes('--migrate');

const required = ['DATABASE_URL', 'SESSION_SECRET', 'NEON_API_KEY'];
const recommended = [
  'NODE_ENV',
  'TENANT_PROVIDER',
  'APP_URL',
  'FRONTEND_URL',
  'ENABLE_CSRF',
  'R2_ACCOUNT_ID',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
];

function isLocalDb(url) {
  if (!url) return true;
  return /@(localhost|127\.0\.0\.1)[:\/]/.test(url) || url.includes('localhost:');
}

function maskUrl(url) {
  if (!url) return '(missing)';
  try {
    const u = new URL(url.replace(/^postgresql:/, 'http:'));
    return `postgresql://***@${u.hostname}${u.pathname}`;
  } catch {
    return '(invalid url)';
  }
}

console.log('=== Homebase Railway pre-flight ===\n');

let failed = false;
for (const key of required) {
  const val = process.env[key];
  if (!val || (key === 'SESSION_SECRET' && val === 'homebase-dev-secret-change-in-production')) {
    console.log(`❌ ${key}: missing or insecure default`);
    failed = true;
  } else {
    console.log(`✅ ${key}: set`);
  }
}

if (process.env.TENANT_PROVIDER && process.env.TENANT_PROVIDER !== 'neon') {
  console.log(`⚠️  TENANT_PROVIDER=${process.env.TENANT_PROVIDER} (production should be neon)`);
}

const dbUrl = process.env.DATABASE_URL;
console.log(`\nDATABASE_URL host: ${maskUrl(dbUrl)}`);
if (isLocalDb(dbUrl)) {
  console.log(
    '⚠️  DATABASE_URL points at localhost — Railway must use your Neon **main** connection string.',
  );
}

console.log('\n--- Recommended (Railway Variables) ---');
for (const key of recommended) {
  console.log(process.env[key] ? `✅ ${key}` : `○  ${key}: not set`);
}

if (migrate) {
  if (isLocalDb(dbUrl)) {
    console.log('\n--migrate skipped: use Neon main DATABASE_URL for production migrations.');
    process.exit(failed ? 1 : 0);
  }
  console.log('\n--- Running migrations on main DB ---');
  for (const script of ['setup-database.js', null]) {
    if (script) {
      const r = spawnSync('node', [path.join(__dirname, script)], {
        stdio: 'inherit',
        env: process.env,
      });
      if (r.status !== 0) process.exit(r.status);
    }
  }
  const fixSessions = spawnSync('node', [path.join(__dirname, 'fix-sessions-table.js')], {
    stdio: 'inherit',
    env: process.env,
  });
  if (fixSessions.status !== 0) process.exit(fixSessions.status);

  const extraMigrations = [
    'migrate:tenant-memberships',
    'migrate:public-share-routing',
    'migrate:password-reset',
  ];
  for (const script of extraMigrations) {
    const r = spawnSync('npm', ['run', script], {
      stdio: 'inherit',
      env: process.env,
      cwd: path.join(__dirname, '..'),
    });
    if (r.status !== 0) process.exit(r.status);
  }
  console.log('✅ Migrations finished');
}

console.log('\n--- Railway dashboard checklist ---');
console.log('1. Root directory: / (not public-cups/)');
console.log('2. Do NOT add Railway Postgres plugin');
console.log('3. Healthcheck: /api/health');
console.log('4. See docs/RAILWAY_HOMEBASE_SETUP.md');

process.exit(failed ? 1 : 0);
