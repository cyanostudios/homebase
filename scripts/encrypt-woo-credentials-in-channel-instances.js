// scripts/encrypt-woo-credentials-in-channel-instances.js
// One-time: encrypt WooCommerce credentials in channel_instances that are stored as plain JSON.
// After this, parseCredentials only reads { v: encryptedString }. No fallback in app code.

const { Pool } = require('pg');
const dotenv = require('dotenv');
const CredentialsCrypto = require('../server/core/services/security/CredentialsCrypto');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const TABLE = 'channel_instances';

async function runOnTenant(connectionString, tenantInfo) {
  let cleanConnectionString = connectionString;
  if (cleanConnectionString.includes('?options=') && cleanConnectionString.includes('&options=')) {
    cleanConnectionString = cleanConnectionString.split('&options=')[0];
  }
  const pool = new Pool({ connectionString: cleanConnectionString });
  const client = await pool.connect();
  const label = tenantInfo.schemaName
    ? `${tenantInfo.email || tenantInfo.userId} (${tenantInfo.schemaName})`
    : tenantInfo.email || tenantInfo.userId;

  try {
    if (tenantInfo.schemaName) {
      await client.query(`SET search_path TO ${tenantInfo.schemaName}`);
    }

    const { rows } = await client.query(
      `SELECT id, credentials FROM ${TABLE} WHERE channel = 'woocommerce' AND credentials IS NOT NULL`,
    );
    let updated = 0;
    for (const row of rows) {
      const creds = row.credentials;
      if (typeof creds !== 'object' || creds === null || 'v' in creds) continue;
      const encrypted = CredentialsCrypto.encrypt(JSON.stringify(creds));
      const payload = { v: encrypted };
      await client.query(
        `UPDATE ${TABLE} SET credentials = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [payload, row.id],
      );
      updated += 1;
    }
    if (updated > 0) {
      console.log(`   ${label} channel_instances (woo): ${updated} row(s) encrypted`);
    }
    return { total: updated, tenantInfo };
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
      const usersResult = await mainPool.query(
        `SELECT id as user_id, email FROM users ORDER BY id`,
      );
      tenants = usersResult.rows.map((user) => ({
        user_id: user.user_id,
        email: user.email,
        connection_string: process.env.DATABASE_URL,
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

    console.log(
      `Encrypting WooCommerce credentials in channel_instances for ${tenants.length} tenant(s)...\n`,
    );
    let totalUpdated = 0;
    for (const tenant of tenants) {
      const connectionString = tenant.connection_string || tenant.neon_connection_string;
      if (!connectionString) continue;
      const result = await runOnTenant(connectionString, {
        userId: tenant.user_id,
        email: tenant.email,
        schemaName: tenant.schema_name,
      });
      totalUpdated += result.total;
    }
    console.log(`\nDone. Total rows updated: ${totalUpdated}`);
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

module.exports = { runOnTenant };
