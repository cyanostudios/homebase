#!/usr/bin/env node
// scripts/run-site-audits-migration.js
// Run server/migrations/185-site-audits.sql on all tenant databases.
// Enable plugin separately: npm run set:tenant-plugins -- --enable=site-audits

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MIGRATION_FILES = [
  path.join(__dirname, '../server/migrations/185-site-audits.sql'),
  path.join(__dirname, '../server/migrations/186-site-audit-runs-cancelled.sql'),
];

async function runMigrationOnTenant(connectionString, tenantInfo) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    if (tenantInfo.schemaName) {
      await client.query(`SET search_path TO ${tenantInfo.schemaName}`);
    }
    for (const migrationFile of MIGRATION_FILES) {
      const sql = fs.readFileSync(migrationFile, 'utf8');
      // eslint-disable-next-line no-await-in-loop
      await client.query(sql);
    }
    console.log(
      `   Applied on ${tenantInfo.email || tenantInfo.userId}${tenantInfo.schemaName ? ` (${tenantInfo.schemaName})` : ''}`,
    );
    return { success: true, tenantInfo };
  } catch (error) {
    if (
      error.message.includes('already exists') ||
      error.code === '42P07' ||
      error.code === '42710' ||
      error.code === '42701'
    ) {
      console.log(`   Skipped (already applied): ${tenantInfo.email || tenantInfo.userId}`);
      return { success: true, tenantInfo, skipped: true };
    }
    return { success: false, tenantInfo, error: error.message };
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  for (const migrationFile of MIGRATION_FILES) {
    if (!fs.existsSync(migrationFile)) {
      console.error(`Migration file not found: ${migrationFile}`);
      process.exit(1);
    }
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const mainPool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const tenantProvider = process.env.TENANT_PROVIDER || 'neon';
    const isLocalProvider = tenantProvider === 'local';
    let tenants = [];

    if (isLocalProvider) {
      const usersResult = await mainPool.query(`
        SELECT id as user_id, email
        FROM users
        ORDER BY id
      `);
      const mainConnectionString = process.env.DATABASE_URL;
      tenants = usersResult.rows.map((user) => ({
        user_id: user.user_id,
        email: user.email,
        connection_string: `${mainConnectionString}?options=-csearch_path%3Dtenant_${user.user_id}`,
        schema_name: `tenant_${user.user_id}`,
      }));
    } else {
      const result = await mainPool.query(`
        SELECT t.user_id, t.neon_connection_string as connection_string, u.email
        FROM tenants t
        INNER JOIN users u ON t.user_id = u.id
        WHERE t.neon_connection_string IS NOT NULL
        ORDER BY t.user_id
      `);
      tenants = result.rows;
    }

    console.log(`Running site-audits migration on ${tenants.length} tenant(s)...`);
    let ok = 0;
    let skipped = 0;
    let failed = 0;

    for (const tenant of tenants) {
      const connectionString = tenant.connection_string || tenant.neon_connection_string;
      if (!connectionString) {
        failed += 1;
        continue;
      }
      const result = await runMigrationOnTenant(connectionString, {
        userId: tenant.user_id,
        email: tenant.email,
        schemaName: tenant.schema_name,
      });
      if (!result.success) {
        failed += 1;
        console.error(`   Failed ${tenant.email}: ${result.error}`);
      } else if (result.skipped) {
        skipped += 1;
        ok += 1;
      } else {
        ok += 1;
      }
    }

    console.log(`\nDone. ok=${ok} skipped=${skipped} failed=${failed}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await mainPool.end();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(process.exitCode || 0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
