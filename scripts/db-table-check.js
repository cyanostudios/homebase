// scripts/db-table-check.js
// Checks whether key tables exist in public and tenant schemas.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL');
    process.exitCode = 2;
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const one = async (sql) => (await client.query(sql)).rows[0] || null;

  const keys = ['orders', 'products', 'channel_instances', 'channel_product_map', 'dropbox_settings', 'mail_settings'];
  const out = { public: {}, tenant_1: {} };

  for (const k of keys) {
    out.public[k] = (await one(`select to_regclass('public.${k}') as v`))?.v ?? null;
    out.tenant_1[k] = (await one(`select to_regclass('tenant_1.${k}') as v`))?.v ?? null;
  }

  console.log(JSON.stringify(out, null, 2));
  await client.end();
}

main().catch((e) => {
  console.error(e?.message || String(e));
  process.exitCode = 1;
});

