#!/usr/bin/env node
// scripts/run-sportadmin-migration.js
// Run sportadmin migrations: 167+169 (tenant) + 168 grant (main). Local-first.

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const TENANT_MIGRATIONS = [
  path.join(__dirname, '../server/migrations/167-sportadmin-connector.sql'),
  path.join(__dirname, '../server/migrations/169-sportadmin-cron-opt-in.sql'),
  path.join(__dirname, '../server/migrations/170-sportadmin-page-type.sql'),
];
const MAIN_MIGRATION = path.join(
  __dirname,
  '../server/migrations/168-grant-sportadmin-plugin-access.sql',
);

async function runSqlFileOnClient(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
  console.log(`   Applied ${path.basename(filePath)}`);
}

async function runMigrationOnTenant(connectionString, tenantInfo) {
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

    for (const filePath of TENANT_MIGRATIONS) {
      try {
        await runSqlFileOnClient(client, filePath);
      } catch (error) {
        if (
          error.message.includes('already exists') ||
          error.code === '42P07' ||
          error.code === '42710' ||
          error.code === '42701'
        ) {
          console.log(`   Skipped ${path.basename(filePath)} (already applied)`);
          continue;
        }
        throw error;
      }
    }
    return { success: true, tenantInfo };
  } catch (error) {
    console.error(`   Migration failed:`, error.message);
    return { success: false, tenantInfo, error: error.message };
  } finally {
    client.release();
    await pool.end();
  }
}

async function runMainGrant(connectionString, label) {
  const pool = new Pool({ connectionString });
  try {
    const sql = fs.readFileSync(MAIN_MIGRATION, 'utf8');
    await pool.query(sql);
    console.log(`✅ Main grant 168 applied (${label})`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Grant migration failed (${label}):`, error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

async function main() {
  for (const filePath of TENANT_MIGRATIONS) {
    if (!fs.existsSync(filePath)) {
      console.error(`Migration file not found: ${filePath}`);
      process.exit(1);
    }
  }
  if (!fs.existsSync(MAIN_MIGRATION)) {
    console.error('Main grant migration not found');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const grant = await runMainGrant(process.env.DATABASE_URL, 'DATABASE_URL');
  if (!grant.success) {
    process.exit(1);
  }

  const mainPool = new Pool({ connectionString: process.env.DATABASE_URL });
  let tenants = [];
  try {
    const tenantProvider = process.env.TENANT_PROVIDER || 'neon';
    const isLocalProvider = tenantProvider === 'local';

    if (isLocalProvider) {
      const usersResult = await mainPool.query(`
        SELECT id as user_id, email
        FROM users
        ORDER BY id
      `);
      const mainConnectionString = process.env.DATABASE_URL;
      tenants = usersResult.rows.map((user) => ({
        userId: user.user_id,
        email: user.email,
        connectionString: `${mainConnectionString}?options=-csearch_path%3Dtenant_${user.user_id}`,
        schemaName: `tenant_${user.user_id}`,
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
      tenants = result.rows.map((row) => ({
        userId: row.user_id,
        email: row.email,
        connectionString: row.connection_string,
        schemaName: null,
      }));
    }
  } finally {
    await mainPool.end();
  }

  if (tenants.length === 0) {
    console.log('No tenants found — tenant table SQL was not applied to tenant schemas.');
    console.log('Grant 168 is still applied on main DB.');
    return;
  }

  console.log(`Found ${tenants.length} tenant(s) to migrate`);
  let ok = 0;
  let fail = 0;
  for (const t of tenants) {
    const result = await runMigrationOnTenant(t.connectionString, {
      userId: t.userId,
      email: t.email,
      schemaName: t.schemaName,
    });
    if (result.success) ok += 1;
    else fail += 1;
  }

  console.log(`\nSportAdmin migrations done. ok=${ok} fail=${fail}`);
  console.log('Log out/in after enabling the plugin for the session to pick up access.');
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
