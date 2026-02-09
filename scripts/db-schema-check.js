// scripts/db-schema-check.js
// Quick DB sanity check: verify which schema has expected tables.
// Intentionally does not print DATABASE_URL.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Missing DATABASE_URL in .env.local');
    process.exitCode = 2;
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  const one = async (sql) => (await client.query(sql)).rows[0] || null;

  const result = {
    search_path: (await one("show search_path"))?.search_path ?? null,
    current_schema: (await one('select current_schema() as v'))?.v ?? null,
    public_orders: (await one("select to_regclass('public.orders') as v"))?.v ?? null,
    tenant_1_orders: (await one("select to_regclass('tenant_1.orders') as v"))?.v ?? null,
    tenant_1_channel_error_log: (await one("select to_regclass('tenant_1.channel_error_log') as v"))?.v ?? null,
  };

  // Also show where the app will route tenant connections (sanitized).
  const tenantRow = await one('select user_id, neon_connection_string from tenants where user_id = 1 limit 1');
  const sanitize = (conn) => {
    if (!conn) return null;
    try {
      const u = new URL(conn);
      // redact credentials
      u.username = '***';
      u.password = '***';
      return {
        host: u.host,
        db: u.pathname?.replace(/^\//, '') || null,
        hasOptions: u.searchParams.has('options'),
        options: u.searchParams.get('options'),
      };
    } catch {
      return { raw: 'unparseable' };
    }
  };
  result.tenant_connection_user_1 = tenantRow ? sanitize(tenantRow.neon_connection_string) : null;

  console.log(JSON.stringify(result, null, 2));
  await client.end();
}

main().catch((e) => {
  console.error(e?.message || String(e));
  process.exitCode = 1;
});

