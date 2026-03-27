// scripts/run-files-migration.js
// Run the files migration (005-files.sql) on all tenant databases

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (try .env.local first, then .env)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MIGRATION_FILE = path.join(__dirname, '../server/migrations/005-files.sql');

async function runMigrationOnTenant(connectionString, tenantInfo) {
  // Clean connection string - remove duplicate search_path options
  let cleanConnectionString = connectionString;
  if (cleanConnectionString.includes('?options=') && cleanConnectionString.includes('&options=')) {
    // Remove duplicate options parameter
    cleanConnectionString = cleanConnectionString.split('&options=')[0];
  }

  const pool = new Pool({ connectionString: cleanConnectionString });
  const client = await pool.connect();

  try {
    const tenantLabel = tenantInfo.schemaName
      ? `${tenantInfo.email || tenantInfo.userId} (${tenantInfo.schemaName})`
      : tenantInfo.email || tenantInfo.userId;
    console.log(`\n📦 Running files migration on tenant: ${tenantLabel}...`);

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

    console.log(`   ✅ Files migration completed successfully`);
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
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('📄 Migration file:', MIGRATION_FILE);
  console.log('🔍 Reading migration SQL...\n');

  const mainPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Fetching all tenants from main database...');

    let tenants = [];

    // First, check for Neon tenants (they take priority)
    const neonResult = await mainPool.query(`
      SELECT 
        t.owner_user_id,
        t.neon_connection_string as connection_string,
        u.email
      FROM public.tenants t
      INNER JOIN public.users u ON t.owner_user_id = u.id
      WHERE t.neon_connection_string IS NOT NULL
      ORDER BY t.owner_user_id
    `);

    if (neonResult.rows.length > 0) {
      console.log(`   Found ${neonResult.rows.length} Neon tenant(s)`);
      tenants = neonResult.rows.map((row) => ({
        owner_user_id: row.owner_user_id,
        connection_string: row.connection_string,
        email: row.email,
      }));
    } else {
      // Fallback to local tenants (schema-per-tenant)
      console.log(`   No Neon tenants found, using local schema-per-tenant`);
      const usersResult = await mainPool.query(`
        SELECT id, email
        FROM public.users
        ORDER BY id
      `);

      const mainConnectionString = process.env.DATABASE_URL;
      tenants = usersResult.rows.map((user) => ({
        owner_user_id: user.id,
        email: user.email,
        connection_string: `${mainConnectionString}?options=-csearch_path%3Dtenant_${user.id}`,
        schema_name: `tenant_${user.id}`,
      }));
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
          `⚠️  Skipping tenant ${tenant.owner_user_id} (${tenant.email}): No connection string`,
        );
        results.push({
          success: false,
          tenantInfo: { tenantOwnerUserId: tenant.owner_user_id, email: tenant.email },
          error: 'No connection string',
        });
        continue;
      }

      const result = await runMigrationOnTenant(connectionString, {
        userId: tenant.owner_user_id,
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

module.exports = { runMigrationOnTenant };
