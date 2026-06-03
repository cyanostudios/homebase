#!/usr/bin/env node
/**
 * Enable/disable plugins for a tenant on the MAIN database (tenant_plugin_access + owner user_plugin_access).
 *
 * Examples:
 *   node scripts/set-tenant-plugin-access.js --email=user@homebase.se --disable=matches,slots --enable=tasks
 *   node scripts/set-tenant-plugin-access.js --tenant-id=7 --disable=matches,slots --enable=tasks
 *
 * Requires DATABASE_URL or TARGET_DATABASE_URL (.env.local is often localhost — use TARGET for prod).
 */
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

const injected = {
  DATABASE_URL: process.env.DATABASE_URL,
  TARGET_DATABASE_URL: process.env.TARGET_DATABASE_URL,
};

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true });

if (injected.TARGET_DATABASE_URL) process.env.TARGET_DATABASE_URL = injected.TARGET_DATABASE_URL;
if (injected.DATABASE_URL) process.env.DATABASE_URL = injected.DATABASE_URL;

function parseList(arg) {
  if (!arg) return [];
  const raw = arg.includes('=') ? arg.split('=').slice(1).join('=') : arg;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function hasTable(pool, table) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return r.rows.length > 0;
}

async function resolveTenant(pool, { email, tenantId }) {
  if (tenantId) {
    const r = await pool.query(
      `SELECT id, COALESCE(owner_user_id, user_id) AS owner_user_id, user_id
       FROM tenants WHERE id = $1`,
      [tenantId],
    );
    if (!r.rows.length) throw new Error(`No tenant with id=${tenantId}`);
    return r.rows[0];
  }
  if (!email) throw new Error('Provide --email=... or --tenant-id=...');

  const r = await pool.query(
    `SELECT t.id, COALESCE(t.owner_user_id, t.user_id) AS owner_user_id, t.user_id, u.email
     FROM users u
     JOIN tenants t ON t.user_id = u.id OR t.owner_user_id = u.id
     WHERE LOWER(u.email) = LOWER($1)
     ORDER BY t.id
     LIMIT 1`,
    [email],
  );
  if (!r.rows.length) throw new Error(`No tenant for email ${email}`);
  return r.rows[0];
}

async function setPluginAccess(pool, tables, { tenantId, ownerUserId, pluginName, enabled }) {
  if (tables.tenantPlugin) {
    await pool.query(
      `INSERT INTO tenant_plugin_access (tenant_id, plugin_name, enabled, granted_by_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, plugin_name)
       DO UPDATE SET enabled = EXCLUDED.enabled, granted_at = CURRENT_TIMESTAMP`,
      [tenantId, pluginName, enabled, ownerUserId],
    );
  }
  if (tables.userPlugin) {
    await pool.query(
      `INSERT INTO user_plugin_access (user_id, plugin_name, enabled, granted_by)
       VALUES ($1, $2, $3, $1)
       ON CONFLICT (user_id, plugin_name)
       DO UPDATE SET enabled = EXCLUDED.enabled`,
      [ownerUserId, pluginName, enabled],
    );
  }
}

async function listEnabled(pool, tables, tenantId, ownerUserId) {
  if (tables.tenantPlugin) {
    const r = await pool.query(
      `SELECT plugin_name, enabled FROM tenant_plugin_access WHERE tenant_id = $1 ORDER BY plugin_name`,
      [tenantId],
    );
    return r.rows;
  }
  if (tables.userPlugin) {
    const r = await pool.query(
      `SELECT plugin_name, enabled FROM user_plugin_access WHERE user_id = $1 ORDER BY plugin_name`,
      [ownerUserId],
    );
    return r.rows;
  }
  return [];
}

async function main() {
  const email = parseArg('email');
  const tenantIdArg = parseArg('tenant-id');
  const tenantId = tenantIdArg ? parseInt(tenantIdArg, 10) : null;
  const enable = parseList(parseArg('enable'));
  const disable = parseList(parseArg('disable'));

  if (!enable.length && !disable.length) {
    console.error('Provide at least one of --enable=plugin1,plugin2 or --disable=plugin1,plugin2');
    process.exit(1);
  }
  const dbUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('TARGET_DATABASE_URL or DATABASE_URL is required');
    process.exit(1);
  }
  if (/@(localhost|127\.0\.0\.1)/.test(dbUrl) && !process.env.TARGET_DATABASE_URL) {
    console.error(
      'DATABASE_URL points at localhost. Set TARGET_DATABASE_URL to Neon main for production.',
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  try {
    const tables = {
      tenantPlugin: await hasTable(pool, 'tenant_plugin_access'),
      userPlugin: await hasTable(pool, 'user_plugin_access'),
    };
    if (!tables.tenantPlugin && !tables.userPlugin) {
      throw new Error(
        'Neither tenant_plugin_access nor user_plugin_access exists — run migrations first',
      );
    }

    const tenant = await resolveTenant(pool, { email, tenantId });
    const ownerUserId = tenant.owner_user_id ?? tenant.user_id;

    console.log(
      `Tenant id=${tenant.id}, owner_user_id=${ownerUserId}${tenant.email ? `, email=${tenant.email}` : ''}`,
    );

    for (const name of disable) {
      await setPluginAccess(pool, tables, {
        tenantId: tenant.id,
        ownerUserId,
        pluginName: name,
        enabled: false,
      });
      console.log(`Disabled: ${name}`);
    }
    for (const name of enable) {
      await setPluginAccess(pool, tables, {
        tenantId: tenant.id,
        ownerUserId,
        pluginName: name,
        enabled: true,
      });
      console.log(`Enabled: ${name}`);
    }

    const rows = await listEnabled(pool, tables, tenant.id, ownerUserId);
    const active = rows.filter((r) => r.enabled).map((r) => r.plugin_name);
    console.log('\nEnabled plugins now:', active.length ? active.join(', ') : '(none)');
    console.log('Log out and log in again (or hard refresh) so /api/auth/me picks up plugin list.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
