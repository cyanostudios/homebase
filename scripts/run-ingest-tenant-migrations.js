#!/usr/bin/env node
// scripts/run-ingest-tenant-migrations.js
// Run 054-ingest-sources-and-runs.sql and 056-ingest-runs-updated-at-and-rss-cleanup.sql on all tenant DBs.

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MIGRATION_FILES = [
  path.join(__dirname, '../server/migrations/054-ingest-sources-and-runs.sql'),
  path.join(__dirname, '../server/migrations/056-ingest-runs-updated-at-and-rss-cleanup.sql'),
];

async function runMigrationsOnTenant(connectionString, tenantInfo) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const tenantLabel = tenantInfo.schemaName
      ? `${tenantInfo.email || tenantInfo.userId} (${tenantInfo.schemaName})`
      : tenantInfo.email || tenantInfo.userId;
    console.log(`\n📦 Ingest migrations on tenant: ${tenantLabel}...`);

    if (tenantInfo.schemaName) {
      await client.query(`SET search_path TO ${tenantInfo.schemaName}`);
    }

    for (const file of MIGRATION_FILES) {
      const name = path.basename(file);
      const sql = fs.readFileSync(file, 'utf8');
      try {
        await client.query(sql);
        console.log(`   ✅ ${name}`);
      } catch (error) {
        if (
          error.message.includes('already exists') ||
          error.code === '42P07' ||
          error.code === '42710'
        ) {
          console.log(`   ⚠️  ${name} (already applied / skip)`);
        } else {
          throw error;
        }
      }
    }

    return { success: true, tenantInfo };
  } catch (error) {
    console.error(`   ❌ Failed:`, error.message);
    return { success: false, tenantInfo, error: error.message };
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  for (const f of MIGRATION_FILES) {
    if (!fs.existsSync(f)) {
      console.error(`❌ Migration file not found: ${f}`);
      process.exit(1);
    }
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const mainPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Fetching tenants from main database...');

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
      console.log('⚠️  No tenants found — nothing to migrate on tenant DBs');
      await mainPool.end();
      return;
    }

    console.log(`📊 ${tenants.length} tenant(s)\n`);

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

      const result = await runMigrationsOnTenant(connectionString, {
        userId: tenant.user_id,
        email: tenant.email,
        schemaName: tenant.schema_name,
      });
      results.push(result);
    }

    const failed = results.filter((r) => !r.success).length;
    console.log('\n' + '='.repeat(60));
    console.log(
      failed > 0
        ? `❌ Failed: ${failed} / ${results.length}`
        : `✅ All ${results.length} tenant(s) OK`,
    );
    console.log('='.repeat(60));

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mainPool.end();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { main };
