#!/usr/bin/env node
// scripts/run-tenant-memberships-migration.js
// Run on MAIN database only. Creates tenant_memberships, tenant_plugin_access,
// adds owner_user_id to tenants, and backfills existing tenants.

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log('Running tenant memberships migration on main database...\n');

    // 1) Add owner_user_id to tenants (backward compat: keep user_id for now)
    const hasOwnerColumn = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'owner_user_id'
    `);
    if (hasOwnerColumn.rows.length === 0) {
      await client.query(
        'ALTER TABLE tenants ADD COLUMN owner_user_id INTEGER REFERENCES users(id)',
      );
      await client.query('UPDATE tenants SET owner_user_id = user_id WHERE owner_user_id IS NULL');
      await client.query('ALTER TABLE tenants ALTER COLUMN owner_user_id SET NOT NULL');
      await client.query('CREATE UNIQUE INDEX idx_tenants_owner_user_id ON tenants(owner_user_id)');
      console.log('Added owner_user_id to tenants and backfilled.');
    } else {
      console.log('tenants.owner_user_id already exists.');
    }

    // 2) Create tenant_memberships
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_memberships (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'editor', 'admin')),
        status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'invited')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        UNIQUE(user_id)
      )
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_id ON tenant_memberships(tenant_id)',
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_id ON tenant_memberships(user_id)',
    );
    console.log('tenant_memberships table ready.');

    // 3) Create tenant_plugin_access
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_plugin_access (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plugin_name VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        granted_by_user_id INTEGER REFERENCES users(id),
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, plugin_name)
      )
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_tenant_plugin_access_tenant_id ON tenant_plugin_access(tenant_id)',
    );
    console.log('tenant_plugin_access table ready.');

    // 4) Backfill: memberships for each tenant (owner = admin)
    const tenants = await client.query(`
      SELECT id, owner_user_id, user_id FROM tenants
    `);
    for (const t of tenants.rows) {
      const ownerId = t.owner_user_id ?? t.user_id;
      const exists = await client.query('SELECT 1 FROM tenant_memberships WHERE user_id = $1', [
        ownerId,
      ]);
      if (exists.rows.length === 0) {
        await client.query(
          `INSERT INTO tenant_memberships (tenant_id, user_id, role, status, created_by)
           VALUES ($1, $2, 'admin', 'active', $2)`,
          [t.id, ownerId],
        );
        console.log(`Backfilled membership: tenant_id=${t.id} user_id=${ownerId} role=admin`);
      }
    }

    // 5) Backfill: tenant_plugin_access from user_plugin_access (per tenant owner)
    for (const t of tenants.rows) {
      const ownerId = t.owner_user_id ?? t.user_id;
      const plugins = await client.query(
        'SELECT plugin_name, enabled FROM user_plugin_access WHERE user_id = $1 AND enabled = true',
        [ownerId],
      );
      for (const row of plugins.rows) {
        await client.query(
          `INSERT INTO tenant_plugin_access (tenant_id, plugin_name, enabled, granted_by_user_id)
           VALUES ($1, $2, true, $3)
           ON CONFLICT (tenant_id, plugin_name) DO NOTHING`,
          [t.id, row.plugin_name, ownerId],
        );
      }
      if (plugins.rows.length > 0) {
        console.log(
          `Backfilled tenant_plugin_access: tenant_id=${t.id} (${plugins.rows.length} plugins)`,
        );
      }
    }

    console.log('\nTenant memberships migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
module.exports = { main };
