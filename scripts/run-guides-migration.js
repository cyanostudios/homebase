#!/usr/bin/env node
// scripts/run-guides-migration.js
// Run guides migrations (090, 092, 093, 094 tenant; 091 main)

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const TENANT_MIGRATIONS = [
  path.join(__dirname, '../server/migrations/090-guides.sql'),
  path.join(__dirname, '../server/migrations/092-guide-places-user-id.sql'),
  path.join(__dirname, '../server/migrations/093-guide-stops.sql'),
  path.join(__dirname, '../server/migrations/094-guide-variant-presentations.sql'),
];
const MAIN_MIGRATION = path.join(
  __dirname,
  '../server/migrations/091-grant-guides-plugin-access.sql',
);

async function runMigrationOnTenant(connectionString, tenantInfo, migrationFile) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const tenantLabel = tenantInfo.schemaName
      ? `${tenantInfo.email || tenantInfo.userId} (${tenantInfo.schemaName})`
      : tenantInfo.email || tenantInfo.userId;
    console.log(`\nRunning tenant migration on: ${tenantLabel}...`);

    if (tenantInfo.schemaName) {
      await client.query(`SET search_path TO ${tenantInfo.schemaName}`);
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');
    await client.query(sql);
    console.log(`   Applied ${path.basename(migrationFile)}`);
    return { success: true, tenantInfo };
  } catch (error) {
    if (
      error.message.includes('already exists') ||
      error.code === '42P07' ||
      error.code === '42710' ||
      error.code === '42701'
    ) {
      console.log(`   Skipped ${path.basename(migrationFile)} (already applied)`);
      return { success: true, tenantInfo, skipped: true };
    }
    console.error(`   Migration failed (${path.basename(migrationFile)}):`, error.message);
    return { success: false, tenantInfo, error: error.message };
  } finally {
    client.release();
    await pool.end();
  }
}

async function runTenantMigrations(connectionString, tenantInfo) {
  const results = [];
  for (const migrationFile of TENANT_MIGRATIONS) {
    const result = await runMigrationOnTenant(connectionString, tenantInfo, migrationFile);
    results.push(result);
    if (!result.success) {
      break;
    }
  }
  return results;
}

async function runMainMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const mainPool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('\nRunning main DB migration for guides plugin access...');
    const sql = fs.readFileSync(MAIN_MIGRATION, 'utf8');
    await mainPool.query(sql);
    console.log(`   Applied ${path.basename(MAIN_MIGRATION)}`);
  } finally {
    await mainPool.end();
  }
}

async function main() {
  for (const migrationFile of [...TENANT_MIGRATIONS, MAIN_MIGRATION]) {
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

    const results = [];
    for (const tenant of tenants) {
      const connectionString = tenant.connection_string || tenant.neon_connection_string;
      if (!connectionString) {
        results.push({
          success: false,
          tenantInfo: { userId: tenant.user_id, email: tenant.email },
          error: 'No connection string',
        });
        continue;
      }

      const tenantResults = await runTenantMigrations(connectionString, {
        userId: tenant.user_id,
        email: tenant.email,
        schemaName: tenant.schema_name,
      });
      results.push(...tenantResults);
    }

    await runMainMigration();

    console.log('\nMigration Summary');
    const successful = results.filter((r) => r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.success && r.skipped).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Tenant successful: ${successful}`);
    console.log(`Tenant already migrated (skipped): ${skipped}`);
    console.log(`Tenant failed: ${failed}`);
    console.log(`Tenant total: ${results.length}`);
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
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
