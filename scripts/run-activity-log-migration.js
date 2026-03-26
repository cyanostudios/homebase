#!/usr/bin/env node
// scripts/run-activity-log-migration.js
// Run activity log migration (006-activity-log.sql) on all existing tenant databases

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (try .env.local first, then .env)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MIGRATION_FILE = path.join(__dirname, '../server/migrations/006-activity-log.sql');

async function runMigrationOnTenant(connectionString, tenantInfo) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const tenantLabel = tenantInfo.schemaName
      ? `${tenantInfo.email || tenantInfo.userId} (${tenantInfo.schemaName})`
      : tenantInfo.email || tenantInfo.userId;
    console.log(`\n📦 Running migration on tenant: ${tenantLabel}...`);

    // For LocalTenantProvider, set search_path to tenant schema
    // Read migration file
    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

    // Execute migration
    await client.query('BEGIN');
    try {
      if (tenantInfo.schemaName) {
        await client.query(`SET LOCAL search_path TO ${tenantInfo.schemaName}`);
      } else {
        await client.query('SET LOCAL search_path TO public');
      }
      await client.query(sql);
      await client.query('COMMIT');
    } catch (inner) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw inner;
    }

    console.log(`   ✅ Migration completed successfully`);
    return { success: true, tenantInfo };
  } catch (error) {
    // Check if table already exists (idempotent check)
    if (error.message.includes('already exists') || error.code === '42P07') {
      console.log(`   ⚠️  Table already exists (migration already run)`);
      return { success: true, tenantInfo, skipped: true };
    }

    console.error(`   ❌ Migration failed:`, error.message);
    return { success: false, tenantInfo, error: error.message };
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  // Check if migration file exists
  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error(`❌ Migration file not found: ${MIGRATION_FILE}`);
    process.exit(1);
  }

  // Connect to main database
  const mainPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('🔍 Fetching all tenants from main database...');

    // Check if using LocalTenantProvider (schema-per-tenant) or NeonTenantProvider (database-per-tenant)
    const tenantProvider = process.env.TENANT_PROVIDER || 'neon';
    const isLocalProvider = tenantProvider === 'local';

    let tenants = [];

    if (isLocalProvider) {
      // For LocalTenantProvider: Get all users and create schema-based connection strings
      const usersResult = await mainPool.query(`
        SELECT id as user_id, email
        FROM public.users
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
      // For NeonTenantProvider: Get tenants with connection strings
      const result = await mainPool.query(`
        SELECT 
          t.user_id,
          t.neon_connection_string as connection_string,
          u.email
        FROM public.tenants t
        INNER JOIN public.users u ON t.user_id = u.id
        WHERE t.neon_connection_string IS NOT NULL
        ORDER BY t.user_id
      `);

      tenants = result.rows;
    }

    if (tenants.length === 0) {
      console.log('⚠️  No tenants found in database');
      await mainPool.end();
      return;
    }

    console.log(`📊 Found ${tenants.length} tenant(s) to migrate\n`);

    // Run migration on each tenant
    const results = [];
    for (const tenant of tenants) {
      const connectionString = tenant.connection_string || tenant.neon_connection_string;

      if (!connectionString) {
        console.log(
          `⚠️  Skipping tenant ${tenant.user_id} (${tenant.email}): No connection string`,
        );
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

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));

    const successful = results.filter((r) => r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.success && r.skipped).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`✅ Successful: ${successful}`);
    console.log(`⚠️  Already migrated (skipped): ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📦 Total: ${results.length}`);

    if (failed > 0) {
      console.log('\n❌ Failed tenants:');
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`   - User ${r.tenantInfo.userId} (${r.tenantInfo.email}): ${r.error}`);
        });
    }

    console.log('\n✅ Migration process completed');
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  } finally {
    await mainPool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runMigrationOnTenant, main };
