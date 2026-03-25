#!/usr/bin/env node
// scripts/run-matches-format-nullable-migration.js
// Run matches format nullable migration (044-matches-format-nullable.sql) on all tenant databases

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MIGRATION_FILE = path.join(__dirname, '../server/migrations/044-matches-format-nullable.sql');

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
    // ALTER COLUMN DROP NOT NULL is idempotent enough; no-op if already nullable.
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
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const mainPool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Fetching all tenants from main database...');
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
        SELECT
          t.user_id,
          t.neon_connection_string as connection_string,
          u.email
        FROM tenants t
        INNER JOIN users u ON t.user_id = u.id
        WHERE t.neon_connection_string IS NOT NULL
        ORDER BY t.user_id
      `);
      tenants = result.rows;
    }

    if (tenants.length === 0) {
      console.log('No tenants found in database');
      return;
    }

    console.log(`Found ${tenants.length} tenant(s) to migrate`);
    const results = [];
    for (const tenant of tenants) {
      const connectionString = tenant.connection_string || tenant.neon_connection_string;
      if (!connectionString) {
        console.log(`Skipping tenant ${tenant.user_id} (${tenant.email}): No connection string`);
        results.push({
          success: false,
          tenantInfo: { userId: tenant.user_id, email: tenant.email },
          error: 'No connection string',
        });
        continue;
      }
      const result = await runMigrationOnTenant(connectionString, {
        userId: tenant.user_id,
        email: tenant.email,
        schemaName: tenant.schema_name,
      });
      results.push(result);
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.log('\nMigration Summary');
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${results.length}`);
  } finally {
    await mainPool.end();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
