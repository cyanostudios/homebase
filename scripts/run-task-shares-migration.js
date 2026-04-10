#!/usr/bin/env node
// scripts/run-task-shares-migration.js — server/migrations/068-task-shares.sql on all tenant DBs

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MIGRATION_FILE = path.join(__dirname, '../server/migrations/068-task-shares.sql');

async function runMigrationOnTenant(connectionString, tenantInfo) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const tenantLabel = tenantInfo.schemaName
      ? `${tenantInfo.email || tenantInfo.userId} (${tenantInfo.schemaName})`
      : tenantInfo.email || tenantInfo.userId;
    console.log(`\n📦 task_shares migration: ${tenantLabel}...`);

    if (tenantInfo.schemaName) {
      await client.query(`SET search_path TO ${tenantInfo.schemaName}`);
    }

    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    await client.query(sql);

    console.log(`   ✅ OK`);
    return { success: true, tenantInfo };
  } catch (error) {
    if (error.message.includes('already exists') || error.code === '42P07') {
      console.log(`   ⚠️  Already applied`);
      return { success: true, tenantInfo, skipped: true };
    }
    console.error(`   ❌`, error.message);
    return { success: false, tenantInfo, error: error.message };
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error(`❌ Migration file not found: ${MIGRATION_FILE}`);
    process.exit(1);
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
      console.log('⚠️  No tenants found — running migration on DATABASE_URL only');
      const result = await runMigrationOnTenant(process.env.DATABASE_URL, {
        email: 'default',
      });
      process.exit(result.success ? 0 : 1);
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

      const result = await runMigrationOnTenant(connectionString, {
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

module.exports = { main, runMigrationOnTenant };
