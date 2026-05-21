#!/usr/bin/env node
/**
 * Husky install hook — skipped in CI/Railway and when husky is not installed
 * (e.g. npm ci with omitted devDependencies). Local dev still runs `husky`.
 */
'use strict';

if (
  process.env.HUSKY === '0' ||
  process.env.CI === 'true' ||
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_SERVICE_ID
) {
  process.exit(0);
}

try {
  require.resolve('husky/bin.js');
} catch {
  process.exit(0);
}

const { spawnSync } = require('child_process');
const result = spawnSync('husky', { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
