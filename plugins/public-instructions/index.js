const { Pool } = require('pg');
const PublicInstructionsModel = require('./model');
const PublicInstructionsController = require('./controller');
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
 * Which Homebase user's tenant DB the public instructions API reads.
 * Prefer explicit numeric id; otherwise resolve email on the main DB.
 * @returns {Promise<number | null>}
 */
async function resolvePublicInstructionsUserId() {
  const rawId = process.env.PUBLIC_INSTRUCTIONS_USER_ID;
  if (rawId && String(rawId).trim() !== '') {
    const n = parseInt(String(rawId).trim(), 10);
    if (!Number.isNaN(n) && n > 0) {
      return n;
    }
  }

  const email = process.env.PUBLIC_INSTRUCTIONS_USER_EMAIL;
  if (email && String(email).trim() !== '') {
    try {
      const main = ServiceManager.getMainPool();
      if (!main) {
        console.warn(
          'public-instructions: ServiceManager.getMainPool() unavailable; cannot resolve email',
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
            `public-instructions: resolved PUBLIC_INSTRUCTIONS_USER_EMAIL=${String(email).trim()} → user_id=${id}`,
          );
          return id;
        }
      }
      console.warn(
        `public-instructions: no user found for PUBLIC_INSTRUCTIONS_USER_EMAIL=${String(email).trim()}`,
      );
    } catch (e) {
      console.error('public-instructions: email lookup failed', e?.message || e);
    }
    return null;
  }

  return null;
}

async function ensurePublicInstructionsPool() {
  if (cachedPool && cachedOwnerUserId) {
    return { pool: cachedPool, ownerUserId: cachedOwnerUserId };
  }
  if (!poolInitPromise) {
    poolInitPromise = (async () => {
      const ownerUserId = await resolvePublicInstructionsUserId();
      if (!ownerUserId) {
        console.warn(
          'public-instructions: set PUBLIC_INSTRUCTIONS_USER_ID (or PUBLIC_INSTRUCTIONS_USER_EMAIL) — public instructions API disabled',
        );
        return null;
      }
      const tenantService = ServiceManager.get('tenant');
      const connectionString = await tenantService.getTenantConnection(ownerUserId);
      const pool = new Pool({ connectionString });
      await pool.query('SELECT 1');
      console.log(`public-instructions: tenant pool ready (user_id=${ownerUserId})`);
      cachedPool = pool;
      cachedOwnerUserId = ownerUserId;
      return { pool: cachedPool, ownerUserId: cachedOwnerUserId };
    })().catch((err) => {
      console.error('public-instructions: failed to open tenant pool', err?.message || err);
      return null;
    });
  }
  return poolInitPromise;
}

async function shutdownPublicInstructionsPool() {
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
    console.warn('public-instructions: pool.end() during shutdown', e?.message || e);
  } finally {
    cachedPool = null;
    cachedOwnerUserId = null;
    poolInitPromise = null;
  }
}

function initializePublicInstructionsPlugin(_context) {
  const model = new PublicInstructionsModel();
  const controller = new PublicInstructionsController(model);

  const express = require('express');
  const router = express.Router();

  router.use(publicEndpointLimiter);

  router.use(async (req, res, next) => {
    try {
      const ctx = await ensurePublicInstructionsPool();
      req.publicInstructionsPool = ctx?.pool ?? null;
      req.publicInstructionsOwnerUserId = ctx?.ownerUserId ?? null;
    } catch (e) {
      console.error('public-instructions: middleware pool error', e?.message || e);
      req.publicInstructionsPool = null;
      req.publicInstructionsOwnerUserId = null;
    }
    next();
  });

  router.get('/', (req, res) => controller.listInstructions(req, res));
  router.get('/:slugOrId', (req, res) => controller.getInstruction(req, res));

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
function __resetPublicInstructionsPoolForTests() {
  cachedPool = null;
  cachedOwnerUserId = null;
  poolInitPromise = null;
}

module.exports = initializePublicInstructionsPlugin;
module.exports.__resetPublicInstructionsPoolForTests = __resetPublicInstructionsPoolForTests;
module.exports.shutdownPublicInstructionsPool = shutdownPublicInstructionsPool;
