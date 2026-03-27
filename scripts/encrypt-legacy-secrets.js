// scripts/encrypt-legacy-secrets.js
// One-time migration: encrypt any plain-text secrets in settings tables.
// Run after removing migrateLegacy* from CDON, Fyndiq, files, mail, shipping.
// Uses same tenant resolution as run-all-migrations / backfill (local = schema, neon = connection).

const { Pool } = require('pg');
const dotenv = require('dotenv');
const CredentialsCrypto = require('../server/core/services/security/CredentialsCrypto');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const PREFIX = 'enc:v1:';

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

const TABLE_CONFIGS = [
  {
    table: 'cdon_settings',
    keyColumn: 'user_id',
    secretColumns: ['api_key', 'api_secret'],
  },
  {
    table: 'fyndiq_settings',
    keyColumn: 'user_id',
    secretColumns: ['api_key', 'api_secret'],
  },
  {
    table: 'googledrive_settings',
    keyColumn: 'user_id',
    secretColumns: ['client_secret', 'access_token', 'refresh_token'],
  },
  {
    table: 'mail_settings',
    keyColumn: 'id',
    secretColumns: ['auth_pass', 'resend_api_key'],
  },
  {
    table: 'postnord_settings',
    keyColumn: 'user_id',
    secretColumns: ['api_key', 'api_secret'],
  },
];

async function encryptTable(client, table, keyColumn, secretColumns, tenantLabel) {
  const selectCols = [keyColumn, ...secretColumns].join(', ');
  const whereParts = secretColumns.map(
    (c, i) => `(${c} IS NOT NULL AND ${c} != '' AND ${c} NOT LIKE 'enc:v1:%')`,
  );
  const where = whereParts.join(' OR ');
  const sql = `SELECT ${selectCols} FROM ${table} WHERE ${where}`;
  const { rows } = await client.query(sql);
  if (rows.length === 0) return 0;

  let updated = 0;
  for (const row of rows) {
    const updates = [];
    const params = [];
    let idx = 1;
    for (const col of secretColumns) {
      const val = row[col];
      if (val != null && val !== '' && !isEncrypted(val)) {
        updates.push(`${col} = $${idx++}`);
        params.push(CredentialsCrypto.encrypt(String(val)));
      }
    }
    if (updates.length === 0) continue;
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(row[keyColumn]);
    await client.query(
      `UPDATE ${table} SET ${updates.join(', ')} WHERE ${keyColumn} = $${idx}`,
      params,
    );
    updated += 1;
  }
  return updated;
}

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
    await client.query('BEGIN');
    try {
      if (tenantInfo.schemaName) {
        await client.query(`SET LOCAL search_path TO ${tenantInfo.schemaName}`);
      } else {
        await client.query('SET LOCAL search_path TO public');
      }
      let total = 0;
      for (const cfg of TABLE_CONFIGS) {
        const count = await encryptTable(
          client,
          cfg.table,
          cfg.keyColumn,
          cfg.secretColumns,
          label,
        );
        if (count > 0) {
          console.log(`   ${label} ${cfg.table}: ${count} row(s) encrypted`);
          total += count;
        }
      }
      await client.query('COMMIT');
      return { total, tenantInfo };
    } catch (inner) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw inner;
    }
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
        SELECT id as user_id, email FROM public.users ORDER BY id
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
        SELECT t.owner_user_id, t.neon_connection_string as connection_string, u.email
        FROM public.tenants t
        INNER JOIN public.users u ON t.owner_user_id = u.id
        WHERE t.neon_connection_string IS NOT NULL
        ORDER BY t.owner_user_id
      `);
      tenants = neonResult.rows.map((row) => ({
        owner_user_id: row.owner_user_id,
        connection_string: row.connection_string,
        email: row.email,
      }));
    }

    if (tenants.length === 0) {
      console.log('No tenants found');
      return;
    }

    console.log(`Encrypting legacy secrets for ${tenants.length} tenant(s)...\n`);
    let totalUpdated = 0;
    for (const tenant of tenants) {
      const connectionString = tenant.connection_string || tenant.neon_connection_string;
      if (!connectionString) continue;
      const result = await runOnTenant(connectionString, {
        userId: tenant.owner_user_id ?? tenant.user_id,
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

module.exports = { runOnTenant, encryptTable };
