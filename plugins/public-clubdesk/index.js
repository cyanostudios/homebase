const { Pool } = require('pg');
const PublicClubdeskModel = require('./model');
const PublicClubdeskController = require('./controller');
const config = require('./plugin.config');
const ServiceManager = require('../../server/core/ServiceManager');
const { publicEndpointLimiter } = require('../../server/core/middleware/rateLimit');

/** @type {import('pg').Pool | null} */
let cachedPool = null;
/** @type {number | null} */
let cachedOwnerUserId = null;
/** @type {Promise<{ pool: import('pg').Pool, ownerUserId: number } | null> | null} */
let poolInitPromise = null;

/**
 * Which Homebase user's tenant DB the public clubdesk API reads.
 * Prefer explicit numeric id; otherwise resolve email on the main DB.
 * @returns {Promise<number | null>}
 */
async function resolvePublicClubdeskUserId() {
  const rawId = process.env.PUBLIC_CLUBDESK_USER_ID;
  if (rawId && String(rawId).trim() !== '') {
    const n = parseInt(String(rawId).trim(), 10);
    if (!Number.isNaN(n) && n > 0) {
      return n;
    }
  }

  const email = process.env.PUBLIC_CLUBDESK_USER_EMAIL;
  if (email && String(email).trim() !== '') {
    try {
      const main = ServiceManager.getMainPool();
      if (!main) {
        console.warn(
          'public-clubdesk: ServiceManager.getMainPool() unavailable; cannot resolve email',
        );
        return null;
      }
      const { rows } = await main.query(
        'SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1',
        [String(email).trim()],
      );
      if (rows.length) {
        const id = Number(rows[0].id);
        if (Number.isFinite(id) && id > 0) {
          console.log(
            `public-clubdesk: resolved PUBLIC_CLUBDESK_USER_EMAIL=${String(email).trim()} → user_id=${id}`,
          );
          return id;
        }
      }
      console.warn(
        `public-clubdesk: no user found for PUBLIC_CLUBDESK_USER_EMAIL=${String(email).trim()}`,
      );
    } catch (e) {
      console.error('public-clubdesk: email lookup failed', e?.message || e);
    }
    return null;
  }

  return null;
}

async function ensurePublicClubdeskPool() {
  if (cachedPool && cachedOwnerUserId) {
    return { pool: cachedPool, ownerUserId: cachedOwnerUserId };
  }
  if (!poolInitPromise) {
    poolInitPromise = (async () => {
      const ownerUserId = await resolvePublicClubdeskUserId();
      if (!ownerUserId) {
        console.warn(
          'public-clubdesk: set PUBLIC_CLUBDESK_USER_ID (or PUBLIC_CLUBDESK_USER_EMAIL) — public clubdesk API disabled',
        );
        return null;
      }
      const tenantService = ServiceManager.get('tenant');
      const connectionString = await tenantService.getTenantConnection(ownerUserId);
      const pool = new Pool({ connectionString });
      await pool.query('SELECT 1');
      console.log(`public-clubdesk: tenant pool ready (user_id=${ownerUserId})`);
      cachedPool = pool;
      cachedOwnerUserId = ownerUserId;
      return { pool: cachedPool, ownerUserId: cachedOwnerUserId };
    })().catch((err) => {
      console.error('public-clubdesk: failed to open tenant pool', err?.message || err);
      return null;
    });
  }
  return poolInitPromise;
}

async function shutdownPublicClubdeskPool() {
  try {
    if (poolInitPromise) {
      const resolved = await poolInitPromise;
      if (resolved?.pool) {
        await resolved.pool.end();
      }
    } else if (cachedPool) {
      await cachedPool.end();
    }
  } catch (e) {
    console.warn('public-clubdesk: pool.end() during shutdown', e?.message || e);
  } finally {
    cachedPool = null;
    cachedOwnerUserId = null;
    poolInitPromise = null;
  }
}

function initializePublicClubdeskPlugin(_context) {
  const model = new PublicClubdeskModel();
  const controller = new PublicClubdeskController(model);

  const express = require('express');
  const router = express.Router();

  router.use(publicEndpointLimiter);

  router.use(async (req, res, next) => {
    try {
      const ctx = await ensurePublicClubdeskPool();
      req.publicClubdeskPool = ctx?.pool ?? null;
      req.publicClubdeskOwnerUserId = ctx?.ownerUserId ?? null;
    } catch (e) {
      console.error('public-clubdesk: middleware pool error', e?.message || e);
      req.publicClubdeskPool = null;
      req.publicClubdeskOwnerUserId = null;
    }
    next();
  });

  router.get('/guides', (req, res) => controller.listGuides(req, res));
  router.get('/guides/:slugOrId', (req, res) => controller.getGuide(req, res));
  router.get('/price-lists', (req, res) => controller.listPriceLists(req, res));
  router.get('/price-lists/:slugOrId', (req, res) => controller.getPriceList(req, res));
  router.get('/site-content', (req, res) => controller.getSiteContent(req, res));

  return {
    config,
    router,
    model,
    controller,
  };
}

/**
 * @deprecated Test-only: reset cached pool between tests.
 */
function __resetPublicClubdeskPoolForTests() {
  cachedPool = null;
  cachedOwnerUserId = null;
  poolInitPromise = null;
}

module.exports = initializePublicClubdeskPlugin;
module.exports.__resetPublicClubdeskPoolForTests = __resetPublicClubdeskPoolForTests;
module.exports.shutdownPublicClubdeskPool = shutdownPublicClubdeskPool;
