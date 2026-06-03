#!/usr/bin/env node
/**
 * Copy a user (+ tenant link + plugin access) from production Neon main → local main.
 *
 *   SOURCE_DATABASE_URL = TARGET_DATABASE_URL or PROD_MAIN_DATABASE_URL (prod Neon main)
 *   TARGET_DATABASE_URL defaults to .env.local DATABASE_URL (localhost)
 *
 *   TARGET_DATABASE_URL='postgresql://...@....neon.tech/neondb?sslmode=require' \
 *     node scripts/copy-user-from-production-main.js --email=user@homebase.se
 *
 * Or set PROD_MAIN_DATABASE_URL in .env.local (gitignored) and run:
 *   npm run copy:user-from-prod -- --email=user@homebase.se
 */
const path = require('path');
const { Pool } = require('pg');

const {
  upsertTenantRecord,
  ensureTenantMembership,
  hasTable,
} = require('../server/core/utils/tenantMainDb');

const emailArg = process.argv.find((a) => a.startsWith('--email='));
const email = emailArg ? emailArg.split('=')[1] : 'user@homebase.se';

const injected = {
  SOURCE_DATABASE_URL: process.env.SOURCE_DATABASE_URL,
  TARGET_DATABASE_URL: process.env.TARGET_DATABASE_URL,
  PROD_MAIN_DATABASE_URL: process.env.PROD_MAIN_DATABASE_URL,
};

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: true });

if (injected.SOURCE_DATABASE_URL) process.env.SOURCE_DATABASE_URL = injected.SOURCE_DATABASE_URL;
if (injected.TARGET_DATABASE_URL) process.env.TARGET_DATABASE_URL = injected.TARGET_DATABASE_URL;
if (injected.PROD_MAIN_DATABASE_URL)
  process.env.PROD_MAIN_DATABASE_URL = injected.PROD_MAIN_DATABASE_URL;

const sourceUrl =
  process.env.SOURCE_DATABASE_URL ||
  process.env.PROD_MAIN_DATABASE_URL ||
  process.env.TARGET_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;

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

  for (const { plugin_name, enabled } of plugins) {
    if (enabled) continue;
    if (await hasTable(targetPool, 'tenant_plugin_access')) {
      await targetPool.query(
        `UPDATE tenant_plugin_access SET enabled = false WHERE tenant_id = $1 AND plugin_name = $2`,
        [tenantId, plugin_name],
      );
    }
    if (await hasTable(targetPool, 'user_plugin_access')) {
      await targetPool.query(
        `UPDATE user_plugin_access SET enabled = false WHERE user_id = $1 AND plugin_name = $2`,
        [targetUserId, plugin_name],
      );
    }
  }
}

async function main() {
  if (!sourceUrl) {
    console.error(
      'SOURCE_DATABASE_URL, PROD_MAIN_DATABASE_URL, or TARGET_DATABASE_URL (prod Neon main) is required',
    );
    process.exit(1);
  }
  if (!targetUrl) {
    console.error('DATABASE_URL in .env.local is required (local main)');
    process.exit(1);
  }
  if (/@(localhost|127\.0\.0\.1)/.test(sourceUrl)) {
    console.error(
      'Source must be production Neon main, not localhost. Set PROD_MAIN_DATABASE_URL in .env.local.',
    );
    process.exit(1);
  }

  console.log('=== Copy user from production main → local main ===\n');
  console.log(`Email: ${email}`);
  console.log(`Source (prod): ${maskUrl(sourceUrl)}`);
  console.log(`Target (local): ${maskUrl(targetUrl)}\n`);

  const source = new Pool({ connectionString: sourceUrl });
  const target = new Pool({ connectionString: targetUrl });

  try {
    const userRes = await source.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email],
    );
    const sourceUser = rows(userRes)[0];
    if (!sourceUser) {
      console.error(`❌ User not found in production: ${email}`);
      process.exit(1);
    }

    const tenantRes = await source.query(
      `SELECT neon_project_id, neon_database_name, neon_connection_string
       FROM tenants WHERE user_id = $1 OR owner_user_id = $1
       ORDER BY id LIMIT 1`,
      [sourceUser.id],
    );
    const sourceTenant = rows(tenantRes)[0];
    if (!sourceTenant?.neon_connection_string) {
      console.error('❌ Production user has no tenant with neon_connection_string');
      process.exit(1);
    }

    const tenantIdRes = await source.query(
      `SELECT id FROM tenants WHERE user_id = $1 OR owner_user_id = $1 ORDER BY id LIMIT 1`,
      [sourceUser.id],
    );
    const sourceTenantId = rows(tenantIdRes)[0]?.id;

    let plugins = [];
    if (sourceTenantId && (await hasTable(source, 'tenant_plugin_access'))) {
      const pluginsRes = await source.query(
        'SELECT plugin_name, enabled FROM tenant_plugin_access WHERE tenant_id = $1',
        [sourceTenantId],
      );
      plugins = rows(pluginsRes);
    }
    if (!plugins.length) {
      const legacy = await source.query(
        'SELECT plugin_name, enabled FROM user_plugin_access WHERE user_id = $1',
        [sourceUser.id],
      );
      plugins = rows(legacy);
    }

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
    console.log(
      `✅ User on local: id=${targetUser.id} ${targetUser.email} (prod id=${sourceUser.id})`,
    );

    const tenantId = await upsertTenantRecord(target, {
      userId: targetUser.id,
      projectId: sourceTenant.neon_project_id,
      databaseName: sourceTenant.neon_database_name || 'neondb',
      connectionString: sourceTenant.neon_connection_string,
    });
    await ensureTenantMembership(target, tenantId, targetUser.id);
    console.log(`✅ Tenant linked: tenant_id=${tenantId} project=${sourceTenant.neon_project_id}`);

    await copyPluginAccess(target, targetUser.id, tenantId, plugins);
    const enabledCount = plugins.filter((p) => p.enabled).length;
    console.log(`✅ Plugin access synced (${enabledCount} enabled on prod)`);

    if (sourceUser.id !== targetUser.id) {
      console.log(
        `\n--- Remapping tenant DB user_id ${sourceUser.id} → ${targetUser.id} (local login id) ---`,
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

    console.log('\nDone. Local login uses the same password as production.');
    console.log('Recommended .env.local:');
    console.log(`  TENANT_PROVIDER=neon`);
    console.log(`  PUBLIC_CUPS_USER_ID=${sourceUser.id}`);
    console.log('  (same Neon tenant DB as production — cup data is shared)');
  } finally {
    await source.end().catch(() => {});
    await target.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Copy failed:', err.message);
  process.exit(1);
});
