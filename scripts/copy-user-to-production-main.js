#!/usr/bin/env node
/**
 * Copy a user (+ tenant link + plugin access) from local main DB to production Neon main.
 *
 *   SOURCE_DATABASE_URL defaults to .env.local DATABASE_URL (localhost)
 *   TARGET_DATABASE_URL = Railway Neon main (required)
 *
 *   TARGET_DATABASE_URL='postgresql://...@....neon.tech/neondb?sslmode=require' \
 *     node scripts/copy-user-to-production-main.js --email=user@homebase.se
 */
const path = require('path');
const { Pool } = require('pg');

const {
  upsertTenantRecord,
  ensureTenantMembership,
  hasTable,
  firstRow,
} = require('../server/core/utils/tenantMainDb');

const emailArg = process.argv.find((a) => a.startsWith('--email='));
const email = emailArg ? emailArg.split('=')[1] : 'user@homebase.se';

const injected = {
  SOURCE_DATABASE_URL: process.env.SOURCE_DATABASE_URL,
  TARGET_DATABASE_URL: process.env.TARGET_DATABASE_URL,
};

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: true });

if (injected.SOURCE_DATABASE_URL) process.env.SOURCE_DATABASE_URL = injected.SOURCE_DATABASE_URL;
if (injected.TARGET_DATABASE_URL) process.env.TARGET_DATABASE_URL = injected.TARGET_DATABASE_URL;

const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;

function maskUrl(url) {
  if (!url) return '(missing)';
  try {
    const u = new URL(url.replace(/^postgresql:/, 'http:'));
    return `${u.hostname}${u.pathname}`;
  } catch {
    return '(invalid)';
  }
}

function rows(result) {
  return result?.rows ?? (Array.isArray(result) ? result : []);
}

async function copyPluginAccess(targetPool, targetUserId, tenantId, plugins) {
  for (const { plugin_name, enabled } of plugins) {
    if (!enabled) continue;
    if (await hasTable(targetPool, 'tenant_plugin_access')) {
      await targetPool.query(
        `INSERT INTO tenant_plugin_access (tenant_id, plugin_name, enabled, granted_by_user_id)
         VALUES ($1, $2, true, $3)
         ON CONFLICT (tenant_id, plugin_name) DO UPDATE SET enabled = true`,
        [tenantId, plugin_name, targetUserId],
      );
    }
    if (await hasTable(targetPool, 'user_plugin_access')) {
      await targetPool.query(
        `INSERT INTO user_plugin_access (user_id, plugin_name, enabled, granted_by)
         VALUES ($1, $2, true, $1)
         ON CONFLICT (user_id, plugin_name) DO UPDATE SET enabled = true`,
        [targetUserId, plugin_name],
      );
    }
  }
}

async function main() {
  if (!sourceUrl) {
    console.error('SOURCE_DATABASE_URL or .env.local DATABASE_URL is required');
    process.exit(1);
  }
  if (!targetUrl) {
    console.error('TARGET_DATABASE_URL is required (Railway Neon main connection string)');
    process.exit(1);
  }

  console.log('=== Copy user to production main ===\n');
  console.log(`Email: ${email}`);
  console.log(`Source: ${maskUrl(sourceUrl)}`);
  console.log(`Target: ${maskUrl(targetUrl)}\n`);

  const source = new Pool({ connectionString: sourceUrl });
  const target = new Pool({ connectionString: targetUrl });

  try {
    const userRes = await source.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email],
    );
    const sourceUser = rows(userRes)[0];
    if (!sourceUser) {
      console.error(`❌ User not found in source: ${email}`);
      process.exit(1);
    }

    const tenantRes = await source.query(
      `SELECT neon_project_id, neon_database_name, neon_connection_string
       FROM tenants WHERE user_id = $1 LIMIT 1`,
      [sourceUser.id],
    );
    const sourceTenant = rows(tenantRes)[0];
    if (!sourceTenant?.neon_connection_string) {
      console.error('❌ Source user has no tenant with neon_connection_string');
      process.exit(1);
    }

    const pluginsRes = await source.query(
      'SELECT plugin_name, enabled FROM user_plugin_access WHERE user_id = $1',
      [sourceUser.id],
    );
    const plugins = rows(pluginsRes);

    const upsertUser = await target.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role
       RETURNING id, email, role`,
      [sourceUser.email, sourceUser.password_hash, sourceUser.role],
    );
    const targetUser = rows(upsertUser)[0];
    console.log(`✅ User on target: id=${targetUser.id} ${targetUser.email}`);

    const tenantId = await upsertTenantRecord(target, {
      userId: targetUser.id,
      projectId: sourceTenant.neon_project_id,
      databaseName: sourceTenant.neon_database_name || 'neondb',
      connectionString: sourceTenant.neon_connection_string,
    });
    await ensureTenantMembership(target, tenantId, targetUser.id);
    console.log(`✅ Tenant linked: tenant_id=${tenantId} project=${sourceTenant.neon_project_id}`);

    await copyPluginAccess(target, targetUser.id, tenantId, plugins);
    console.log(`✅ Plugin access copied (${plugins.filter((p) => p.enabled).length} enabled)`);

    if (sourceUser.id !== targetUser.id) {
      console.log(
        `\n--- Remapping tenant DB user_id ${sourceUser.id} → ${targetUser.id} (required for data visibility) ---`,
      );
      const { spawnSync } = require('child_process');
      const remap = spawnSync(
        'node',
        [
          path.join(__dirname, 'remap-tenant-user-id.js'),
          `--from=${sourceUser.id}`,
          `--to=${targetUser.id}`,
        ],
        {
          stdio: 'inherit',
          env: {
            ...process.env,
            TENANT_DATABASE_URL: sourceTenant.neon_connection_string,
          },
        },
      );
      if (remap.status !== 0) {
        console.error('❌ Tenant user_id remap failed — run manually:');
        console.error(
          `   TENANT_DATABASE_URL='...' node scripts/remap-tenant-user-id.js --from=${sourceUser.id} --to=${targetUser.id}`,
        );
        process.exit(remap.status || 1);
      }
    }

    console.log('\nDone. Log in on Railway with the same email and password as locally.');
    console.log(
      `(Neon workspace project stays ${sourceTenant.neon_project_id}; target user id is ${targetUser.id})`,
    );
  } finally {
    await source.end().catch(() => {});
    await target.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Copy failed:', err.message);
  process.exit(1);
});
