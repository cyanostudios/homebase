#!/usr/bin/env node
/**
 * Re-run kiosk master catalog seed for tenant(s) that already have Clubdesk.
 * Local-first: uses DATABASE_URL main + tenant connection (see run-clubdesk-migration.js).
 *
 *   node scripts/seed-clubdesk-kiosk-catalog.js --email=user@homebase.se
 *   node scripts/seed-clubdesk-kiosk-catalog.js --tenant-id=7
 */

const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const {
  runKioskCatalogSeedForOwner,
} = require('../plugins/clubdesk/services/kioskCatalogSeedRunner');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true });

function parseArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function resolveOwner(mainPool, { email, tenantId }) {
  if (tenantId) {
    const r = await mainPool.query(
      `SELECT id, COALESCE(owner_user_id, user_id) AS owner_user_id
       FROM tenants WHERE id = $1`,
      [tenantId],
    );
    if (!r.rows.length) throw new Error(`No tenant with id=${tenantId}`);
    return { tenantId: r.rows[0].id, ownerUserId: r.rows[0].owner_user_id };
  }
  if (!email) throw new Error('Provide --email=... or --tenant-id=...');

  const r = await mainPool.query(
    `SELECT t.id, COALESCE(t.owner_user_id, t.user_id) AS owner_user_id, u.email
     FROM users u
     JOIN tenants t ON t.user_id = u.id OR t.owner_user_id = u.id
     WHERE LOWER(u.email) = LOWER($1)
     ORDER BY t.id
     LIMIT 1`,
    [email],
  );
  if (!r.rows.length) throw new Error(`No tenant for email ${email}`);
  return { tenantId: r.rows[0].id, ownerUserId: r.rows[0].owner_user_id, email: r.rows[0].email };
}

async function listClubdeskTenants(mainPool) {
  const tenantProvider = process.env.TENANT_PROVIDER || 'neon';
  if (tenantProvider === 'local') {
    const users = await mainPool.query(`SELECT id AS user_id, email FROM users ORDER BY id`);
    const enabled = [];
    for (const user of users.rows) {
      const access = await mainPool.query(
        `SELECT 1 FROM user_plugin_access
         WHERE user_id = $1 AND plugin_name = 'clubdesk' AND enabled = true
         LIMIT 1`,
        [user.user_id],
      );
      if (access.rows.length) {
        enabled.push({ ownerUserId: user.user_id, email: user.email, tenantId: null });
      }
    }
    return enabled;
  }

  const rows = await mainPool.query(
    `SELECT t.id AS tenant_id, COALESCE(t.owner_user_id, t.user_id) AS owner_user_id, u.email
     FROM tenants t
     INNER JOIN users u ON u.id = COALESCE(t.owner_user_id, t.user_id)
     INNER JOIN tenant_plugin_access tpa ON tpa.tenant_id = t.id
     WHERE tpa.plugin_name = 'clubdesk' AND tpa.enabled = true
     ORDER BY t.id`,
  );
  return rows.rows.map((r) => ({
    tenantId: r.tenant_id,
    ownerUserId: r.owner_user_id,
    email: r.email,
  }));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required (local main DB only for this script)');
    process.exit(1);
  }

  const email = parseArg('email');
  const tenantIdArg = parseArg('tenant-id');
  const tenantId = tenantIdArg ? parseInt(tenantIdArg, 10) : null;

  const mainPool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const targets =
      email || tenantId
        ? [await resolveOwner(mainPool, { email, tenantId })]
        : await listClubdeskTenants(mainPool);

    if (!targets.length) {
      console.log('No tenants with Clubdesk enabled.');
      return;
    }

    for (const target of targets) {
      const label = target.email || `tenant ${target.tenantId || target.ownerUserId}`;
      console.log(`Seeding kiosk catalog for ${label} (owner_user_id=${target.ownerUserId})...`);
      const stats = await runKioskCatalogSeedForOwner(mainPool, {
        ownerUserId: target.ownerUserId,
        tenantId: target.tenantId ?? undefined,
      });
      console.log('  Done:', stats);
    }
  } finally {
    await mainPool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { main };
