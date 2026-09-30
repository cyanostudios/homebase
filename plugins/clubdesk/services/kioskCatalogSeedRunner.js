// plugins/clubdesk/services/kioskCatalogSeedRunner.js
// Resolve tenant DB connection and run kiosk catalog seed (best-effort hooks + CLI).

const { Pool } = require('pg');
const { Logger } = require('@homebase/core');
const { runKioskCatalogSeed } = require('./kioskCatalogSeed');

function isLocalTenantProvider() {
  return (process.env.TENANT_PROVIDER || 'neon') === 'local';
}

function localTenantConnection(ownerUserId) {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('DATABASE_URL is required for local tenant seed');
  }
  return {
    connectionString: `${base}?options=-csearch_path%3Dtenant_${ownerUserId}`,
    schemaName: `tenant_${ownerUserId}`,
  };
}

/**
 * @param {{ query: Function }} mainPool
 * @param {{ ownerUserId: number, tenantId?: number }} args
 */
async function resolveTenantConnection(mainPool, { ownerUserId, tenantId }) {
  if (isLocalTenantProvider()) {
    return localTenantConnection(ownerUserId);
  }

  let rows;
  if (tenantId != null) {
    rows = (
      await mainPool.query(
        `SELECT neon_connection_string AS connection_string, user_id
         FROM tenants WHERE id = $1`,
        [tenantId],
      )
    ).rows;
  } else {
    rows = (
      await mainPool.query(
        `SELECT neon_connection_string AS connection_string, user_id
         FROM tenants
         WHERE COALESCE(owner_user_id, user_id) = $1 OR user_id = $1
         ORDER BY id ASC
         LIMIT 1`,
        [ownerUserId],
      )
    ).rows;
  }

  const row = rows[0];
  if (!row?.connection_string) {
    throw new Error(`No tenant connection string for owner user ${ownerUserId}`);
  }
  return { connectionString: row.connection_string, schemaName: null };
}

/**
 * Best-effort seed after Clubdesk enable. Logs and swallows errors.
 * @param {{ query: Function }} mainPool
 * @param {{ ownerUserId: number, tenantId?: number }} args
 */
async function runKioskCatalogSeedForOwnerBestEffort(mainPool, args) {
  try {
    return await runKioskCatalogSeedForOwner(mainPool, args);
  } catch (error) {
    Logger.error('Kiosk catalog seed failed (best-effort)', error, {
      ownerUserId: args.ownerUserId,
      tenantId: args.tenantId,
    });
    return null;
  }
}

/**
 * @param {{ query: Function }} mainPool
 * @param {{ ownerUserId: number, tenantId?: number }} args
 */
async function runKioskCatalogSeedForOwner(mainPool, args) {
  const { connectionString, schemaName } = await resolveTenantConnection(mainPool, args);
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    if (schemaName) {
      await client.query(`SET search_path TO ${schemaName}`);
    }
    return await runKioskCatalogSeed(client, args.ownerUserId);
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = {
  runKioskCatalogSeedForOwner,
  runKioskCatalogSeedForOwnerBestEffort,
  resolveTenantConnection,
};
