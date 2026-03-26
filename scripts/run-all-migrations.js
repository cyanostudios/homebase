// scripts/run-all-migrations.js
// Run all migrations on all tenant databases (both Neon and local)

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const {
  PUBLIC_ONLY_MIGRATIONS,
  getPublicOnlyMigrations,
  getTenantMigrations,
} = require('../server/migrations/policy');

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MIGRATIONS_DIR = path.join(__dirname, '../server/migrations');

async function runPublicMigrations(pool) {
  const client = await pool.connect();
  try {
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    const publicMigrations = getPublicOnlyMigrations(migrationFiles);
    if (publicMigrations.length === 0) return { successCount: 0, skippedCount: 0, errorCount: 0 };
    console.log('\n📦 Running public-schema migrations (once)...');
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    for (const file of publicMigrations) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      try {
        await client.query('BEGIN');
        try {
          await client.query('SET LOCAL search_path TO public');
          await client.query(sql);
          await client.query('COMMIT');
        } catch (inner) {
          try {
            await client.query('ROLLBACK');
          } catch {}
          throw inner;
        }
        console.log(`   ✅ ${file}`);
        successCount++;
      } catch (error) {
        if (error.message.includes('already exists') || error.code === '42P07') {
          console.log(`   ⚠️  ${file} (already exists)`);
          skippedCount++;
        } else {
          console.error(`   ❌ ${file}: ${error.message}`);
          errorCount++;
        }
      }
    }
    console.log(
      `   Summary: ${successCount} successful, ${skippedCount} skipped, ${errorCount} failed`,
    );
    return { successCount, skippedCount, errorCount };
  } finally {
    client.release();
  }
}

async function runMigrationOnTenant(connectionString, tenantInfo) {
  // Clean connection string - remove duplicate search_path options
  let cleanConnectionString = connectionString;
  if (cleanConnectionString.includes('?options=') && cleanConnectionString.includes('&options=')) {
    cleanConnectionString = cleanConnectionString.split('&options=')[0];
  }

  const pool = new Pool({ connectionString: cleanConnectionString });
  const client = await pool.connect();

  try {
    const tenantLabel = tenantInfo.schemaName
      ? `${tenantInfo.email || tenantInfo.userId} (${tenantInfo.schemaName})`
      : tenantInfo.email || tenantInfo.userId;
    console.log(`\n📦 Running migrations on tenant: ${tenantLabel}...`);

    // For LocalTenantProvider, set search_path to tenant schema
    // Get all migration files sorted (exclude public-only; those run once in runPublicMigrations)
    const allFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    const migrationFiles = getTenantMigrations(allFiles);

    console.log(
      `   Found ${migrationFiles.length} migration file(s) (${PUBLIC_ONLY_MIGRATIONS.size} public-only skipped)`,
    );

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const file of migrationFiles) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
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
        console.log(`   ✅ ${file}`);
        successCount++;
      } catch (error) {
        // Check if table already exists (idempotent check)
        if (error.message.includes('already exists') || error.code === '42P07') {
          console.log(`   ⚠️  ${file} (already exists)`);
          skippedCount++;
        } else {
          console.error(`   ❌ ${file}: ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log(
      `   Summary: ${successCount} successful, ${skippedCount} skipped, ${errorCount} failed`,
    );

    return {
      success: errorCount === 0,
      tenantInfo,
      successCount,
      skippedCount,
      errorCount,
    };
  } catch (error) {
    console.error(`   ❌ Migration failed:`, error.message);
    return { success: false, tenantInfo, error: error.message };
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`❌ Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  console.log('📄 Migrations directory:', MIGRATIONS_DIR);
  console.log('🔍 Reading migration files...\n');

  const mainPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Fetching all tenants from main database...');

    let tenants = [];
    const tenantProvider = process.env.TENANT_PROVIDER || 'neon';

    if (tenantProvider === 'local') {
      console.log(`   TENANT_PROVIDER=local → using schema-per-tenant`);
      const usersResult = await mainPool.query(`
        SELECT id as user_id, email
        FROM public.users
        ORDER BY id
      `);

      const mainConnectionString = process.env.DATABASE_URL;
      tenants = usersResult.rows.map((user) => ({
        user_id: user.user_id,
        email: user.email,
        // IMPORTANT: Neon pooler does NOT support setting search_path via startup "options".
        // We connect with the base DATABASE_URL and explicitly SET search_path per tenant schema in runMigrationOnTenant().
        connection_string: `${mainConnectionString}`,
        schema_name: `tenant_${user.user_id}`,
      }));
    } else {
      // Neon (database-per-tenant)
      const neonResult = await mainPool.query(`
        SELECT 
          t.user_id,
          t.neon_connection_string as connection_string,
          u.email
        FROM public.tenants t
        INNER JOIN public.users u ON t.user_id = u.id
        WHERE t.neon_connection_string IS NOT NULL
        ORDER BY t.user_id
      `);
      console.log(`   Found ${neonResult.rows.length} Neon tenant(s)`);
      tenants = neonResult.rows;
    }

    if (tenants.length === 0) {
      console.log('⚠️  No tenants found in database');
      await mainPool.end();
      return;
    }

    console.log(`📊 Found ${tenants.length} tenant(s) to migrate\n`);

    // Phase 1: Run public-schema migrations once (user_settings, user_mfa reference users in public)
    await runPublicMigrations(mainPool);

    // Phase 2: Run tenant migrations on each tenant
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

    const successful = results.filter((r) => r.success && r.errorCount === 0).length;
    const withErrors = results.filter((r) => !r.success || r.errorCount > 0).length;

    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed/Errors: ${withErrors}`);
    console.log(`📦 Total: ${results.length}`);

    if (withErrors > 0) {
      console.log('\n❌ Tenants with errors:');
      results
        .filter((r) => !r.success || r.errorCount > 0)
        .forEach((r) => {
          console.log(
            `   - User ${r.tenantInfo.userId} (${r.tenantInfo.email}): ${r.error || `${r.errorCount} errors`}`,
          );
        });
    }

    console.log('\n✅ Migration process completed');
  } catch (error) {
    console.error('❌ Error running migrations:', error);
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
