#!/usr/bin/env node
/**
 * Link users without tenants rows to Neon projects homebase-tenant-{userId}.
 *
 *   DATABASE_URL='...' NEON_API_KEY='...' node scripts/repair-neon-tenants.js
 *   railway run node scripts/repair-neon-tenants.js
 */
const path = require('path');
const { Pool } = require('pg');

const injected = {
  DATABASE_URL: process.env.DATABASE_URL,
  NEON_API_KEY: process.env.NEON_API_KEY,
};

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: true });
if (injected.DATABASE_URL) process.env.DATABASE_URL = injected.DATABASE_URL;
if (injected.NEON_API_KEY) process.env.NEON_API_KEY = injected.NEON_API_KEY;

async function main() {
  if (!process.env.DATABASE_URL || !process.env.NEON_API_KEY) {
    console.error('DATABASE_URL and NEON_API_KEY are required');
    process.exit(1);
  }

  const Bootstrap = require('../server/core/Bootstrap');
  Bootstrap.initializeServices();
  const tenantService = require('../server/core/ServiceManager').get('tenant');

  if (typeof tenantService.linkNeonTenantForUser !== 'function') {
    console.error(
      'Tenant provider does not support linkNeonTenantForUser (use TENANT_PROVIDER=neon)',
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const users = await pool.query(`
    SELECT u.id, u.email FROM users u
    LEFT JOIN tenants t ON t.user_id = u.id
    WHERE t.id IS NULL OR t.neon_connection_string IS NULL OR t.neon_connection_string = ''
    ORDER BY u.id
  `);
  await pool.end();

  if (!users.rows.length) {
    console.log('No users need tenant repair.');
    return;
  }

  console.log(`Repairing ${users.rows.length} user(s)...`);
  for (const row of users.rows) {
    console.log(`\n— user ${row.id} ${row.email}`);
    try {
      const linked = await tenantService.linkNeonTenantForUser(row.id);
      if (linked) {
        console.log(`  ✅ linked tenant_id=${linked.tenantId}`);
      } else {
        console.log('  ⚠️  no matching Neon project (homebase-tenant-{id})');
      }
    } catch (err) {
      console.error(`  ❌ ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
