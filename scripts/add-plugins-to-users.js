// scripts/add-plugins-to-users.js
// Script to add new plugins to all existing tenants (tenant_plugin_access).

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const NEW_PLUGINS = [
  'channels',
  'products',
  'woocommerce-products',
  'cdon-products',
  'fyndiq-products',
  'orders',
];

async function addPluginsToUsers() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔌 Adding new plugins to all tenants...');
    console.log('📦 Plugins:', NEW_PLUGINS.join(', '));

    // Get all tenants (by owner)
    const tenantsResult = await client.query(
      `SELECT t.id AS tenant_id, t.owner_user_id, u.email
       FROM public.tenants t
       INNER JOIN public.users u ON u.id = t.owner_user_id
       ORDER BY t.id`,
    );
    const tenants = tenantsResult.rows;

    console.log(`🏢 Found ${tenants.length} tenant(s)`);

    let addedCount = 0;
    let skippedCount = 0;

    for (const tenant of tenants) {
      for (const pluginName of NEW_PLUGINS) {
        // Check if tenant already has this plugin
        const existing = await client.query(
          'SELECT 1 FROM public.tenant_plugin_access WHERE tenant_id = $1 AND plugin_name = $2',
          [tenant.tenant_id, pluginName],
        );

        if (existing.rows.length === 0) {
          // Add plugin access
          await client.query(
            `INSERT INTO public.tenant_plugin_access (tenant_id, plugin_name, enabled, granted_by_user_id)
             VALUES ($1, $2, true, $3)
             ON CONFLICT (tenant_id, plugin_name) DO NOTHING`,
            [tenant.tenant_id, pluginName, tenant.owner_user_id],
          );
          addedCount++;
          console.log(`  ✅ Added ${pluginName} to tenant ${tenant.tenant_id} (${tenant.email})`);
        } else {
          skippedCount++;
        }
      }
    }

    await client.query('COMMIT');

    console.log('\n' + '='.repeat(60));
    console.log('✅ Plugin access update complete!');
    console.log('='.repeat(60));
    console.log(`✅ Added: ${addedCount} plugin access entries`);
    console.log(`⏭️  Skipped (already exists): ${skippedCount} entries`);
    console.log('='.repeat(60));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to add plugins:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addPluginsToUsers()
  .then(() => {
    console.log('\n💡 Users may need to refresh after plugin updates.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
