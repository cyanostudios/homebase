#!/usr/bin/env node
/**
 * One-shot: align local main DB + env hints with production for user@homebase.se (default).
 *
 * Requires in .env.local (gitignored):
 *   PROD_MAIN_DATABASE_URL=postgresql://...@....neon.tech/neondb?sslmode=require
 *   DATABASE_URL=postgresql://...@localhost:5432/homebase_dev
 *
 *   npm run sync:local-from-prod
 */
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: true });

const prodUrl = process.env.PROD_MAIN_DATABASE_URL || process.env.TARGET_DATABASE_URL;
const localUrl = process.env.DATABASE_URL;

function mask(url) {
  if (!url) return '(missing)';
  try {
    const u = new URL(url.replace(/^postgresql:/, 'http:'));
    return `${u.hostname}${u.pathname}`;
  } catch {
    return '(invalid)';
  }
}

const emailArg = process.argv.find((a) => a.startsWith('--email='));
const email = emailArg ? emailArg.split('=')[1] : 'user@homebase.se';

if (!prodUrl || /@(localhost|127\.0\.0\.1)/.test(prodUrl)) {
  console.error('Set PROD_MAIN_DATABASE_URL in .env.local to your Railway/Neon MAIN database URL.');
  console.error('(Not the tenant DB — the main neondb where users/tenants live.)');
  process.exit(1);
}
if (!localUrl) {
  console.error('DATABASE_URL in .env.local is required (local Postgres main).');
  process.exit(1);
}

console.log('=== Sync local with production ===\n');
console.log(`Prod main:  ${mask(prodUrl)}`);
console.log(`Local main: ${mask(localUrl)}`);
console.log(`Email:      ${email}\n`);

const copy = spawnSync(
  'node',
  [path.join(__dirname, 'copy-user-from-production-main.js'), `--email=${email}`],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      SOURCE_DATABASE_URL: prodUrl,
      PROD_MAIN_DATABASE_URL: prodUrl,
    },
  },
);

if (copy.status !== 0) {
  process.exit(copy.status || 1);
}

console.log('\n--- Code parity ---');
console.log('Git: keep homebase-v3.6 and main aligned (merge to main before Railway deploy).');
console.log('\n--- Until you disable parity ---');
console.log('Set LOCAL_PROD_PARITY=1 in .env.local');
console.log('Use: npm run set:tenant-plugins -- --both --enable=... --disable=...');
console.log('See docs/LOCAL_PROD_PARITY.md');
