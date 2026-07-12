const { Pool } = require('pg');
const PublicGuidesModel = require('./model');
const PublicGuidesController = require('./controller');
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
 * Which Homebase user's tenant DB the public guides API reads.
 * Prefer explicit numeric id; otherwise resolve email on the main DB.
 * @returns {Promise<number | null>}
 */
async function resolvePublicGuidesUserId() {
  const rawId = process.env.PUBLIC_GUIDES_USER_ID;
  if (rawId && String(rawId).trim() !== '') {
    const n = parseInt(String(rawId).trim(), 10);
    if (!Number.isNaN(n) && n > 0) {
      return n;
    }
  }

  const email = process.env.PUBLIC_GUIDES_USER_EMAIL;
  if (email && String(email).trim() !== '') {
    try {
      const main = ServiceManager.getMainPool();
      if (!main) {
        console.warn(
          'public-guides: ServiceManager.getMainPool() unavailable; cannot resolve email',
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
            `public-guides: resolved PUBLIC_GUIDES_USER_EMAIL=${String(email).trim()} → user_id=${id}`,
          );
          return id;
        }
      }
      console.warn(
        `public-guides: no user found for PUBLIC_GUIDES_USER_EMAIL=${String(email).trim()}`,
      );
    } catch (e) {
      console.error('public-guides: email lookup failed', e?.message || e);
    }
    return null;
  }

  return null;
}

async function ensurePublicGuidesPool() {
  if (cachedPool && cachedOwnerUserId) {
    return { pool: cachedPool, ownerUserId: cachedOwnerUserId };
  }
  if (!poolInitPromise) {
    poolInitPromise = (async () => {
      const ownerUserId = await resolvePublicGuidesUserId();
      if (!ownerUserId) {
        console.warn(
          'public-guides: set PUBLIC_GUIDES_USER_ID (or PUBLIC_GUIDES_USER_EMAIL) — public guides API disabled',
        );
        return null;
      }
      const tenantService = ServiceManager.get('tenant');
      const connectionString = await tenantService.getTenantConnection(ownerUserId);
      const pool = new Pool({ connectionString });
      await pool.query('SELECT 1');
      console.log(`public-guides: tenant pool ready (user_id=${ownerUserId})`);
      cachedPool = pool;
      cachedOwnerUserId = ownerUserId;
      return { pool: cachedPool, ownerUserId: cachedOwnerUserId };
    })().catch((err) => {
      console.error('public-guides: failed to open tenant pool', err?.message || err);
      return null;
    });
  }
  return poolInitPromise;
}

async function shutdownPublicGuidesPool() {
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
    console.warn('public-guides: pool.end() during shutdown', e?.message || e);
  } finally {
    cachedPool = null;
    cachedOwnerUserId = null;
    poolInitPromise = null;
  }
}

function initializePublicGuidesPlugin(_context) {
  const model = new PublicGuidesModel();
  const controller = new PublicGuidesController(model);

  const express = require('express');
  const router = express.Router();

  router.use(publicEndpointLimiter);

  router.use(async (req, res, next) => {
    try {
      const ctx = await ensurePublicGuidesPool();
      req.publicGuidesPool = ctx?.pool ?? null;
      req.publicGuidesOwnerUserId = ctx?.ownerUserId ?? null;
    } catch (e) {
      console.error('public-guides: middleware pool error', e?.message || e);
      req.publicGuidesPool = null;
      req.publicGuidesOwnerUserId = null;
    }
    next();
  });

  router.get('/', (req, res) => controller.listGuides(req, res));
  router.get('/:placeId/stops/:stopId/variants/:variantId/audio', (req, res) =>
    controller.streamAudio(req, res),
  );
  router.get('/:placeId/stops', (req, res) => controller.getStops(req, res));
  router.get('/:placeId', (req, res) => controller.getGuide(req, res));

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
function __resetPublicGuidesPoolForTests() {
  cachedPool = null;
  cachedOwnerUserId = null;
  poolInitPromise = null;
}

module.exports = initializePublicGuidesPlugin;
module.exports.__resetPublicGuidesPoolForTests = __resetPublicGuidesPoolForTests;
module.exports.shutdownPublicGuidesPool = shutdownPublicGuidesPool;
