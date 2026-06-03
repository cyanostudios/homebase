#!/usr/bin/env node
/**
 * Remap user_id in tenant database (all tables with user_id column).
 * Use after copy-user-to-production-main when prod user id differs from local.
 *
 *   TENANT_DATABASE_URL='postgresql://...@tenant.neon.tech/...' \
 *     node scripts/remap-tenant-user-id.js --from=7 --to=2
 *
 * Or resolve connection from main DB:
 *   MAIN_DATABASE_URL='...' TENANT_EMAIL=user@homebase.se \
 *     node scripts/remap-tenant-user-id.js --from=7 --to=2
 */
const path = require('path');
const { Pool } = require('pg');

const fromArg = process.argv.find((a) => a.startsWith('--from='));
const toArg = process.argv.find((a) => a.startsWith('--to='));
const emailArg = process.argv.find((a) => a.startsWith('--email='));

const fromId = fromArg ? parseInt(fromArg.split('=')[1], 10) : NaN;
const toId = toArg ? parseInt(toArg.split('=')[1], 10) : NaN;
const email = emailArg ? emailArg.split('=')[1] : null;

const injected = {
  MAIN_DATABASE_URL: process.env.MAIN_DATABASE_URL,
  TENANT_DATABASE_URL: process.env.TENANT_DATABASE_URL,
  TARGET_DATABASE_URL: process.env.TARGET_DATABASE_URL,
};

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: true });
Object.assign(process.env, Object.fromEntries(Object.entries(injected).filter(([, v]) => v)));

async function resolveTenantUrl() {
  if (process.env.TENANT_DATABASE_URL) return process.env.TENANT_DATABASE_URL;

  const mainUrl =
    process.env.MAIN_DATABASE_URL || process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
  if (!mainUrl || !email) {
    throw new Error('Set TENANT_DATABASE_URL or MAIN_DATABASE_URL + --email=...');
  }

  const pool = new Pool({ connectionString: mainUrl });
  const res = await pool.query(
    `SELECT t.neon_connection_string
     FROM tenants t
     INNER JOIN users u ON u.id = t.user_id
     WHERE u.email = $1
     LIMIT 1`,
    [email],
  );
  await pool.end();
  const conn = res.rows[0]?.neon_connection_string;
  if (!conn) throw new Error(`No tenant connection for ${email}`);
  return conn;
}

async function main() {
  if (!Number.isFinite(fromId) || !Number.isFinite(toId)) {
    console.error('Usage: --from=<oldUserId> --to=<newUserId> [--email=...]');
    process.exit(1);
  }
  if (fromId === toId) {
    console.log('from and to are the same — nothing to do');
    return;
  }

  const tenantUrl = await resolveTenantUrl();
  const host = tenantUrl.match(/@([^/]+)/)?.[1] || '?';
  console.log(`=== Remap tenant user_id ${fromId} → ${toId} ===`);
  console.log(`Tenant host: ${host}\n`);

  const pool = new Pool({ connectionString: tenantUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tables = await client.query(`
      SELECT DISTINCT c.table_name
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.column_name = 'user_id'
      ORDER BY c.table_name
    `);

    let total = 0;
    for (const { table_name: table } of tables.rows) {
      const countRes = await client.query(
        `SELECT COUNT(*)::int AS n FROM "${table}" WHERE user_id = $1`,
        [fromId],
      );
      const n = countRes.rows[0]?.n ?? 0;
      if (n === 0) continue;

      await client.query(`UPDATE "${table}" SET user_id = $1 WHERE user_id = $2`, [toId, fromId]);
      console.log(`✅ ${table}: ${n} row(s)`);
      total += n;
    }

    await client.query('COMMIT');
    console.log(`\n✅ Remapped ${total} row(s) across ${tables.rows.length} table(s) with user_id`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Remap failed:', err.message);
  process.exit(1);
});
