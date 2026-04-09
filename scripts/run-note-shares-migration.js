#!/usr/bin/env node
// scripts/run-note-shares-migration.js — 007-note-shares.sql on tenant DBs

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MIGRATION_FILE = path.join(__dirname, '../server/migrations/067-note-shares.sql');

async function runMigrationOnTenant(connectionString, tenantInfo) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const tenantLabel = tenantInfo.schemaName
      ? `${tenantInfo.email || tenantInfo.userId} (${tenantInfo.schemaName})`
      : tenantInfo.email || tenantInfo.userId;
    console.log(`\n📦 note_shares migration: ${tenantLabel}...`);

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
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const result = await runMigrationOnTenant(connectionString, { email: 'default' });
  process.exit(result.success ? 0 : 1);
}

main();
