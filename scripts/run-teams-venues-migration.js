#!/usr/bin/env node
// scripts/run-teams-venues-migration.js
// LOCAL ONLY: apply 134-teams-venues.sql to local tenant schemas.
// Never uses PROD_MAIN_DATABASE_URL or Neon tenant connection strings.

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MIGRATION_FILE = path.join(__dirname, '../server/migrations/134-teams-venues.sql');

function isLocalDatabaseUrl(url) {
  if (!url) return false;
  return /@(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes('localhost:');
}

async function runMigrationOnTenant(connectionString, tenantInfo) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const tenantLabel = tenantInfo.schemaName
      ? `${tenantInfo.email || tenantInfo.userId} (${tenantInfo.schemaName})`
      : tenantInfo.email || tenantInfo.userId;
    console.log(`\nRunning migration on tenant: ${tenantLabel}...`);

    if (tenantInfo.schemaName) {
      const schemas = await client.query(
        'SELECT 1 FROM information_schema.schemata WHERE schema_name = $1',
        [tenantInfo.schemaName],
      );
      if (!schemas.rows.length) {
        console.log('   Skipping: tenant schema does not exist');
        return { success: true, tenantInfo, skipped: true };
      }
      await client.query(`SET search_path TO ${tenantInfo.schemaName}`);
    }

    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    await client.query(sql);

    console.log('   Migration completed successfully');
    return { success: true, tenantInfo };
  } catch (error) {
    if (
      error.message.includes('already exists') ||
      error.code === '42P07' ||
      error.code === '42710' ||
      error.code === '42701'
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

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  if (
    process.env.PROD_MAIN_DATABASE_URL &&
    process.env.DATABASE_URL === process.env.PROD_MAIN_DATABASE_URL
  ) {
    console.error(
      'Refusing to run: DATABASE_URL matches PROD_MAIN_DATABASE_URL. This migration is local-only.',
    );
    process.exit(1);
  }

  if (!isLocalDatabaseUrl(process.env.DATABASE_URL)) {
    console.error(
      'Refusing to run: DATABASE_URL is not a localhost Postgres URL. 134-teams-venues.sql is local-only.',
    );
    process.exit(1);
  }

  const tenantProvider = process.env.TENANT_PROVIDER || 'local';
  if (tenantProvider !== 'local') {
    console.error(
      `Refusing to run: TENANT_PROVIDER=${tenantProvider}. This migration applies only to local schema-per-tenant DBs.`,
    );
    process.exit(1);
  }

  const mainPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Fetching local tenants from main database...');

    const usersResult = await mainPool.query(`
        SELECT id as user_id, email
        FROM users
        ORDER BY id
      `);

    const mainConnectionString = process.env.DATABASE_URL;
    const tenants = usersResult.rows.map((user) => ({
      user_id: user.user_id,
      email: user.email,
      connection_string: `${mainConnectionString}?options=-csearch_path%3Dtenant_${user.user_id}`,
      schema_name: `tenant_${user.user_id}`,
    }));

    if (tenants.length === 0) {
      console.log('No tenants found in database');
      await mainPool.end();
      return;
    }

    console.log(`Found ${tenants.length} tenant(s) to migrate`);

    const results = [];
    for (const tenant of tenants) {
      const result = await runMigrationOnTenant(tenant.connection_string, {
        userId: tenant.user_id,
        email: tenant.email,
        schemaName: tenant.schema_name,
      });
      results.push(result);
    }

    console.log('\nMigration Summary');
    const successful = results.filter((r) => r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.success && r.skipped).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Successful: ${successful}`);
    console.log(`Already migrated (skipped): ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${results.length}`);

    if (failed > 0) {
      console.log('\nFailed tenants:');
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`- User ${r.tenantInfo.userId} (${r.tenantInfo.email}): ${r.error}`);
        });
      process.exitCode = 1;
    }

    console.log('\nMigration process completed');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    await mainPool.end();
  }
}

if (require.main === module) {
  main()
    .then(() => {
      if (process.exitCode) process.exit(process.exitCode);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
