// scripts/backfill-orders-channel-label.js
// One-time backfill: set orders.channel_label from channel_instances.label
// for WooCommerce orders where channel_label IS NULL and we have a match by channel_instance_id.
// Run after migration 055. No fallbacks: only set when instance has non-empty label.

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const BACKFILL_SQL = `
  UPDATE orders o
  SET channel_label = TRIM(ci.label), updated_at = NOW()
  FROM channel_instances ci
  WHERE o.channel = 'woocommerce'
    AND o.channel_label IS NULL
    AND o.channel_instance_id IS NOT NULL
    AND o.channel_instance_id = ci.id
    AND ci.channel = 'woocommerce'
    AND ci.label IS NOT NULL
    AND TRIM(ci.label) != ''
`;

async function runBackfillOnTenant(connectionString, tenantInfo) {
  let cleanConnectionString = connectionString;
  if (cleanConnectionString.includes('?options=') && cleanConnectionString.includes('&options=')) {
    cleanConnectionString = cleanConnectionString.split('&options=')[0];
  }
  const pool = new Pool({ connectionString: cleanConnectionString });
  const client = await pool.connect();
  try {
    const label = tenantInfo.schemaName
      ? `${tenantInfo.email || tenantInfo.userId} (${tenantInfo.schemaName})`
      : tenantInfo.email || tenantInfo.userId;
    if (tenantInfo.schemaName) {
      await client.query(`SET search_path TO ${tenantInfo.schemaName}`);
    }
    const res = await client.query(BACKFILL_SQL);
    const updated = res.rowCount || 0;
    console.log(`   ${label}: ${updated} order(s) updated`);
    return { updated, tenantInfo };
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const mainPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const tenantProvider = process.env.TENANT_PROVIDER || 'neon';
  let tenants = [];

  try {
    if (tenantProvider === 'local') {
      const usersResult = await mainPool.query(`
        SELECT id as user_id, email FROM users ORDER BY id
      `);
      const mainConnectionString = process.env.DATABASE_URL;
      tenants = usersResult.rows.map((user) => ({
        user_id: user.user_id,
        email: user.email,
        connection_string: mainConnectionString,
        schema_name: `tenant_${user.user_id}`,
      }));
    } else {
      const neonResult = await mainPool.query(`
        SELECT t.user_id, t.neon_connection_string as connection_string, u.email
        FROM tenants t
        INNER JOIN users u ON t.user_id = u.id
        WHERE t.neon_connection_string IS NOT NULL
        ORDER BY t.user_id
      `);
      tenants = neonResult.rows;
    }

    if (tenants.length === 0) {
      console.log('No tenants found');
      return;
    }

    console.log(`Backfilling channel_label for ${tenants.length} tenant(s)...\n`);
    let totalUpdated = 0;
    for (const tenant of tenants) {
      const connectionString = tenant.connection_string || tenant.neon_connection_string;
      if (!connectionString) continue;
      const result = await runBackfillOnTenant(connectionString, {
        userId: tenant.user_id,
        email: tenant.email,
        schemaName: tenant.schema_name,
      });
      totalUpdated += result.updated;
    }
    console.log(`\nDone. Total orders updated: ${totalUpdated}`);
  } finally {
    await mainPool.end();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runBackfillOnTenant, main };
