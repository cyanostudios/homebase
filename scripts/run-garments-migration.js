#!/usr/bin/env node
// scripts/run-garments-migration.js
// Run garments migrations: 131 (tenant) + 132 grant + 133 public share CHECK (main)

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const TENANT_MIGRATIONS = [
  path.join(__dirname, '../server/migrations/131-garments.sql'),
  path.join(__dirname, '../server/migrations/136-garment-inventory-product-fields.sql'),
  path.join(__dirname, '../server/migrations/137-garment-inventory-variants.sql'),
  path.join(__dirname, '../server/migrations/138-garment-inventory-variant-sku-unique.sql'),
  path.join(__dirname, '../server/migrations/139-garments-grouped-checkbox-columns.sql'),
  path.join(__dirname, '../server/migrations/140-garments-person-level-checkbox-columns.sql'),
  path.join(__dirname, '../server/migrations/141-garment-list-persons-jersey-name-initials.sql'),
  path.join(__dirname, '../server/migrations/142-garments-checkbox-columns-english-labels.sql'),
  path.join(__dirname, '../server/migrations/143-garment-list-persons-contact-id.sql'),
  path.join(__dirname, '../server/migrations/149-garment-inventory-variant-audience.sql'),
  path.join(__dirname, '../server/migrations/150-garment-inventory-variant-sku-nonunique.sql'),
  path.join(__dirname, '../server/migrations/151-garment-inventory-recommended-sale-price.sql'),
  path.join(__dirname, '../server/migrations/152-garment-inventory-variant-identity-nonunique.sql'),
  path.join(__dirname, '../server/migrations/153-garment-list-inventory.sql'),
  path.join(__dirname, '../server/migrations/154-garment-list-persons-ct-audiences.sql'),
  path.join(__dirname, '../server/migrations/155-garment-list-persons-team-id.sql'),
];
const MAIN_MIGRATIONS = [
  path.join(__dirname, '../server/migrations/132-grant-garments-plugin-access.sql'),
  path.join(__dirname, '../server/migrations/133-public-share-routing-garment-list.sql'),
];

async function runSqlFileOnClient(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
  console.log(`   Applied ${path.basename(filePath)}`);
}

function resolveTenantSchema(connectionString) {
  const match = String(connectionString || '').match(/search_path%3D([^&]+)/i);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  // Legacy local admin tenant rows store a bare DATABASE_URL → public schema.
  return 'public';
}

async function runMigrationOnTenant(connectionString, tenantInfo) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  const schemaName = tenantInfo.schemaName || resolveTenantSchema(connectionString);

  try {
    const tenantLabel = tenantInfo.email
      ? `${tenantInfo.email} (${schemaName})`
      : tenantInfo.userId || schemaName;
    console.log(`\nRunning tenant migration on: ${tenantLabel}...`);

    await client.query(`SET search_path TO ${schemaName}`);

    let applied = 0;
    let skipped = 0;
    let failed = 0;
    for (const filePath of TENANT_MIGRATIONS) {
      try {
        await runSqlFileOnClient(client, filePath);
        applied += 1;
      } catch (error) {
        if (
          error.message.includes('already exists') ||
          error.code === '42P07' ||
          error.code === '42710' ||
          error.code === '42701' ||
          // Re-running older migrations after later ones dropped columns (e.g. 136 after 137).
          error.code === '42703'
        ) {
          console.log(`   Skipped ${path.basename(filePath)} (already applied)`);
          skipped += 1;
          continue;
        }
        console.error(`   Failed ${path.basename(filePath)}: ${error.message}`);
        failed += 1;
      }
    }
    return { success: failed === 0, tenantInfo, applied, skipped, failed };
  } catch (error) {
    console.error(`   Migration failed:`, error.message);
    return { success: false, tenantInfo, error: error.message };
  } finally {
    client.release();
    await pool.end();
  }
}

async function runMainMigrations(connectionString, label) {
  const pool = new Pool({ connectionString });
  try {
    for (const filePath of MAIN_MIGRATIONS) {
      const sql = fs.readFileSync(filePath, 'utf8');
      await pool.query(sql);
      console.log(`✅ Applied ${path.basename(filePath)} (${label})`);
    }
    return { success: true };
  } catch (error) {
    console.error(`❌ Main migration failed (${label}):`, error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

async function main() {
  for (const filePath of [...TENANT_MIGRATIONS, ...MAIN_MIGRATIONS]) {
    if (!fs.existsSync(filePath)) {
      console.error(`Migration file not found: ${filePath}`);
      process.exit(1);
    }
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const mainPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

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
    } else {
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

      console.log('\nTenant migration summary');
      const successful = results.filter((r) => r.success).length;
      const partial = results.filter((r) => !r.success && (r.failed ?? 0) > 0).length;
      const failed = results.filter((r) => !r.success && !(r.failed ?? 0)).length;
      console.log(`Successful: ${successful}`);
      if (partial > 0) {
        console.log(`Partial (some files failed): ${partial}`);
      }
      console.log(`Failed: ${failed}`);

      if (failed > 0 || partial > 0) {
        results
          .filter((r) => !r.success)
          .forEach((r) => {
            const detail =
              r.failed != null
                ? `${r.failed} file(s) failed (applied ${r.applied}, skipped ${r.skipped})`
                : r.error;
            console.log(`- User ${r.tenantInfo.userId} (${r.tenantInfo.email}): ${detail}`);
          });
        if (failed > 0) {
          process.exitCode = 1;
        }
      }
    }

    await runMainMigrations(process.env.DATABASE_URL, 'local');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
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
