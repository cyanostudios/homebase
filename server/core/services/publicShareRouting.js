// server/core/services/publicShareRouting.js
// Main-DB registry so anonymous users can open task/note share links (no session tenant).

const ServiceManager = require('../ServiceManager');
const { Logger } = require('@homebase/core');

const RESOURCE_TASK = 'task';
const RESOURCE_NOTE = 'note';

function isMissingRoutingTableError(err) {
  if (!err) return false;
  return err.code === '42P01' || String(err.message || '').includes('public_share_routing');
}

/**
 * @param {string} shareToken
 * @param {'task'|'note'} resourceType
 * @param {string} tenantConnectionString
 */
async function registerPublicShareRoute(shareToken, resourceType, tenantConnectionString) {
  const pool = ServiceManager.getMainPool();
  try {
    await pool.query(
      `INSERT INTO public_share_routing (share_token, resource_type, tenant_connection_string)
       VALUES ($1, $2, $3)
       ON CONFLICT (share_token) DO UPDATE SET
         tenant_connection_string = EXCLUDED.tenant_connection_string,
         resource_type = EXCLUDED.resource_type`,
      [shareToken, resourceType, tenantConnectionString],
    );
  } catch (err) {
    if (isMissingRoutingTableError(err)) {
      Logger.warn('public_share_routing missing — run: npm run migrate:public-share-routing');
      return;
    }
    throw err;
  }
}

/** @param {string} shareToken */
async function unregisterPublicShareRoute(shareToken) {
  const pool = ServiceManager.getMainPool();
  try {
    await pool.query('DELETE FROM public_share_routing WHERE share_token = $1', [shareToken]);
  } catch (err) {
    if (isMissingRoutingTableError(err)) {
      return;
    }
    throw err;
  }
}

/**
 * Resolve tenant pool for a public share token (main-DB public_share_routing).
 * Used by GET middleware and by note/task models when req.tenantPool is still missing.
 * Does not override an existing req.tenantPool.
 * @param {import('express').Request} req
 * @param {'task'|'note'} resourceType
 * @param {string} shareToken
 */
async function resolvePublicShareTenantFromToken(req, resourceType, shareToken) {
  if (req.tenantPool) {
    return;
  }
  if (!shareToken || typeof shareToken !== 'string') {
    return;
  }

  const mainPool = ServiceManager.getMainPool();
  let result;
  try {
    result = await mainPool.query(
      `SELECT tenant_connection_string FROM public_share_routing
       WHERE share_token = $1 AND resource_type = $2`,
      [shareToken, resourceType],
    );
  } catch (err) {
    if (isMissingRoutingTableError(err)) {
      Logger.warn('public_share_routing missing — anonymous share links unavailable');
      return;
    }
    throw err;
  }

  if (!result.rows.length) {
    return;
  }

  ServiceManager.initialize(req);
  const connectionPool = ServiceManager.get('connectionPool');
  req.tenantPool = connectionPool.getTenantPool(result.rows[0].tenant_connection_string);
}

/**
 * For GET /api/tasks|notes/public/:token — sets req.tenantPool when routing row exists.
 * Does not override an existing req.tenantPool.
 * @param {import('express').Request} req
 */
async function attachPublicShareTenantPool(req) {
  if (req.tenantPool) {
    return;
  }
  if (req.method !== 'GET') {
    return;
  }

  const path = req.path || '';
  const match = path.match(/^\/api\/(tasks|notes)\/public\/([^/]+)\/?$/);
  if (!match) {
    return;
  }

  const resourceType = match[1] === 'tasks' ? RESOURCE_TASK : RESOURCE_NOTE;
  const token = decodeURIComponent(match[2]);
  await resolvePublicShareTenantFromToken(req, resourceType, token);
}

module.exports = {
  RESOURCE_TASK,
  RESOURCE_NOTE,
  registerPublicShareRoute,
  unregisterPublicShareRoute,
  attachPublicShareTenantPool,
  resolvePublicShareTenantFromToken,
};
