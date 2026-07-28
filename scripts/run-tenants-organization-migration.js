#!/usr/bin/env node
// Apply 112-tenants-organization.sql on main DB (local and/or prod).

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true });

const MIGRATION_FILE = path.join(__dirname, '..', 'server/migrations/112-tenants-organization.sql');

function resolveTargets() {
  const both = process.argv.includes('--both');
  const localUrl = process.env.DATABASE_URL;
  const prodUrl = process.env.PROD_MAIN_DATABASE_URL || process.env.TARGET_DATABASE_URL;

  if (both) {
    const targets = [];
    if (localUrl) {
      targets.push({ label: 'local', url: localUrl });
    }
    if (prodUrl) {
      targets.push({ label: 'prod', url: prodUrl });
    }
    return targets;
  }

  const url = process.env.TARGET_DATABASE_URL || process.env.PROD_MAIN_DATABASE_URL || localUrl;
  if (!url) {
    return [];
  }
  return [{ label: 'default', url }];
}

async function apply(label, connectionString) {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const pool = new Pool({ connectionString });
  try {
    await pool.query(sql);
    console.log(`✅ tenants.organization migration applied (${label})`);
  } finally {
    await pool.end();
  }
}

async function main() {
  const targets = resolveTargets();
  if (targets.length === 0) {
    console.error('DATABASE_URL (or TARGET_DATABASE_URL / PROD_MAIN_DATABASE_URL) is required');
    process.exit(1);
  }
  for (const target of targets) {
    await apply(target.label, target.url);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
