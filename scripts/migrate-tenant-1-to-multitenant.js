#!/usr/bin/env node
// scripts/migrate-tenant-1-to-multitenant.js
//
// One-time cutover for the current local dev account (tenant_1).
// Moves "account identity" to the new canonical model in main DB:
// - tenants.owner_user_id
// - tenant_memberships
// - tenant_plugin_access (derived from available plugins)
//
// This does NOT move tenant data tables (they already live in schema tenant_1).

const dotenv = require('dotenv');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  // For your current setup: tenant_1 belongs to user id 1.
  const ownerUserId = 1;

  // Derive available plugins from the repo (same directories PluginLoader uses).
  function listAvailablePluginNames() {
    const possibleDirs = [
      path.join(process.cwd(), 'plugins'),
      path.join(process.cwd(), 'server', 'plugins'),
    ];
    const pluginsDir = possibleDirs.find((d) => fs.existsSync(d)) || null;
    if (!pluginsDir) return [];
    return fs
      .readdirSync(pluginsDir)
      .filter((name) => {
        const p = path.join(pluginsDir, name);
        if (!fs.statSync(p).isDirectory()) return false;
        if (name === '__tests__') return false;
        return (
          fs.existsSync(path.join(p, 'index.js')) && fs.existsSync(path.join(p, 'plugin.config.js'))
        );
      })
      .sort();
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure tenant row exists in the canonical owner_user_id model.
    const t = await client.query(
      `SELECT id, owner_user_id
       FROM public.tenants
       WHERE owner_user_id = $1
       ORDER BY id
       LIMIT 1`,
      [ownerUserId],
    );

    let tenantId;
    if (t.rows.length) {
      tenantId = t.rows[0].id;
      await client.query('UPDATE public.tenants SET owner_user_id = $1 WHERE id = $2', [
        ownerUserId,
        tenantId,
      ]);
    } else {
      const inserted = await client.query(
        `INSERT INTO public.tenants (owner_user_id, neon_project_id, neon_database_name, neon_connection_string)
         VALUES ($1, NULL, NULL, NULL)
         RETURNING id`,
        [ownerUserId],
      );
      tenantId = inserted.rows[0].id;
    }

    // Membership: owner is admin.
    await client.query(
      `INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status, created_by)
       VALUES ($1, $2, 'admin', 'active', $2)
       ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, role = 'admin', status = 'active'`,
      [tenantId, ownerUserId],
    );

    const pluginNames = listAvailablePluginNames();
    for (const pluginName of pluginNames) {
      await client.query(
        `INSERT INTO public.tenant_plugin_access (tenant_id, plugin_name, enabled, granted_by_user_id)
         VALUES ($1, $2, true, $3)
         ON CONFLICT (tenant_id, plugin_name) DO UPDATE SET enabled = EXCLUDED.enabled`,
        [tenantId, String(pluginName), ownerUserId],
      );
    }

    await client.query('COMMIT');

    console.log('✅ Tenant cutover complete');
    console.log(JSON.stringify({ ownerUserId, tenantId, plugins: pluginNames.length }, null, 2));
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error('❌ Tenant cutover failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
