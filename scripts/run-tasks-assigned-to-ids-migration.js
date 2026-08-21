#!/usr/bin/env node
// scripts/run-tasks-assigned-to-ids-migration.js
// Run 039-tasks-add-assigned-to-ids.sql on all tenant databases.
// New migration files are only auto-applied when a tenant is first created, so
// existing tenants (local and prod) need this run explicitly once.

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MIGRATION_FILE = path.join(
  __dirname,
  '../server/migrations/039-tasks-add-assigned-to-ids.sql',
);

async function runMigrationOnTenant(connectionString, tenantInfo) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const tenantLabel = tenantInfo.schemaName
      ? `${tenantInfo.email || tenantInfo.userId} (${tenantInfo.schemaName})`
      : tenantInfo.email || tenantInfo.userId;
    console.log(`\nRunning migration on tenant: ${tenantLabel}...`);

    if (tenantInfo.schemaName) {
      await client.query(`SET search_path TO ${tenantInfo.schemaName}`);
    }

    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    await client.query(sql);

    console.log('   Migration completed successfully');
    return { success: true, tenantInfo };
  } catch (error) {
    if (
      error.message.includes('already exists') ||
      error.code === '42701' ||
      error.code === '42P07'
    ) {
      console.log('   Column/index already exists (migration already run)');
      return { success: true, tenantInfo, skipped: true };
    }

    console.error('   Migration failed:', error.message);
    return { success: false, tenantInfo, error: error.message };
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error(`Migration file not found: ${MIGRATION_FILE}`);
    process.exit(1);
  }

  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
  if (!targetUrl) {
    console.error('DATABASE_URL (or TARGET_DATABASE_URL) environment variable is not set');
    process.exit(1);
  }

  const mainPool = new Pool({ connectionString: targetUrl });

  try {
    const tenantProvider = process.env.TENANT_PROVIDER || 'neon';
    const isLocalProvider = tenantProvider === 'local';
    let tenants = [];

    if (isLocalProvider) {
      const usersResult = await mainPool.query(`
        SELECT id as user_id, email FROM users ORDER BY id
      `);
      tenants = usersResult.rows.map((user) => ({
        user_id: user.user_id,
        email: user.email,
        connection_string: `${targetUrl}?options=-csearch_path%3Dtenant_${user.user_id}`,
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

    if (tenants.length === 0) {
      console.log('No tenants found');
      return;
    }

    console.log(`Found ${tenants.length} tenant(s) to migrate`);
    const results = [];
    for (const tenant of tenants) {
      const connectionString = tenant.connection_string || tenant.neon_connection_string;
      if (!connectionString) continue;
      results.push(
        await runMigrationOnTenant(connectionString, {
          userId: tenant.user_id,
          email: tenant.email,
          schemaName: tenant.schema_name,
        }),
      );
    }

    const failed = results.filter((r) => !r.success).length;
    console.log(`\nDone. Failed: ${failed}/${results.length}`);
    if (failed > 0) process.exit(1);
  } finally {
    await mainPool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
