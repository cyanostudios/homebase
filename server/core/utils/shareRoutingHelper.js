// Resolve tenant connection string for public_share_routing registration.

const TenantContextService = require('../services/tenant/TenantContextService');
const { Logger } = require('@homebase/core');

/**
 * @param {import('express').Request} req
 * @returns {Promise<string|null>}
 */
async function resolveTenantConnectionStringForShare(req) {
  let tenantConnectionString = req.session?.tenantConnectionString ?? null;
  if (tenantConnectionString) {
    return tenantConnectionString;
  }
  const userId = req.session?.user?.id;
  if (!userId) {
    return null;
  }
  try {
    const tctx = new TenantContextService();
    const ctx = await tctx.getTenantContextByUserId(userId);
    return ctx?.tenantConnectionString ?? null;
  } catch (error) {
    Logger.warn('Could not resolve tenant connection string for share registration', {
      userId,
      message: error?.message,
    });
    return null;
  }
}

module.exports = { resolveTenantConnectionStringForShare };
