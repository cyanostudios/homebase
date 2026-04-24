const { Pool } = require('pg');
const PublicCupsModel = require('./model');
const PublicCupsController = require('./controller');
const config = require('./plugin.config');
const ServiceManager = require('../../server/core/ServiceManager');

/** @type {import('pg').Pool | null} */
let cachedPool = null;
/** @type {Promise<import('pg').Pool | null> | null} */
let poolInitPromise = null;

/**
 * Which Homebase user’s tenant DB Cupappen reads. Prefer explicit numeric id; otherwise resolve email
 * on the main DB. Falls back to PUBLIC_BOOKING_USER_ID for backwards compatibility.
 * @returns {Promise<number | null>}
 */
async function resolvePublicCupsUserId() {
  const rawId = process.env.PUBLIC_CUPS_USER_ID;
  if (rawId && String(rawId).trim() !== '') {
    const n = parseInt(String(rawId).trim(), 10);
    if (!Number.isNaN(n) && n > 0) {
      return n;
    }
  }

  const email = process.env.PUBLIC_CUPS_USER_EMAIL;
  if (email && String(email).trim() !== '') {
    try {
      const main = ServiceManager.getMainPool();
      if (!main) {
        console.warn('public-cups: ServiceManager.getMainPool() unavailable; cannot resolve email');
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
            `public-cups: resolved PUBLIC_CUPS_USER_EMAIL=${String(email).trim()} → user_id=${id}`,
          );
          return id;
        }
      }
      console.warn(`public-cups: no user found for PUBLIC_CUPS_USER_EMAIL=${String(email).trim()}`);
    } catch (e) {
      console.error('public-cups: email lookup failed', e?.message || e);
    }
    return null;
  }

  const bookingFallback = process.env.PUBLIC_BOOKING_USER_ID;
  if (bookingFallback && String(bookingFallback).trim() !== '') {
    const n = parseInt(String(bookingFallback).trim(), 10);
    if (!Number.isNaN(n) && n > 0) {
      return n;
    }
  }

  return null;
}

async function ensurePublicCupsPool() {
  if (cachedPool) {
    return cachedPool;
  }
  if (!poolInitPromise) {
    poolInitPromise = (async () => {
      const userId = await resolvePublicCupsUserId();
      if (!userId) {
        console.warn(
          'public-cups: set PUBLIC_CUPS_USER_ID (or PUBLIC_CUPS_USER_EMAIL) — public cups API disabled',
        );
        return null;
      }
      const tenantService = ServiceManager.get('tenant');
      const connectionString = await tenantService.getTenantConnection(userId);
      const pool = new Pool({ connectionString });
      await pool.query('SELECT 1');
      console.log(`public-cups: tenant pool ready (user_id=${userId})`);
      cachedPool = pool;
      return cachedPool;
    })().catch((err) => {
      console.error('public-cups: failed to open tenant pool', err?.message || err);
      return null;
    });
  }
  return poolInitPromise;
}

function initializePublicCupsPlugin() {
  const model = new PublicCupsModel();
  const controller = new PublicCupsController(model);

  const express = require('express');
  const router = express.Router();

  router.use(async (req, res, next) => {
    try {
      req.publicCupsPool = await ensurePublicCupsPool();
    } catch (e) {
      console.error('public-cups: middleware pool error', e?.message || e);
      req.publicCupsPool = null;
    }
    next();
  });

  router.get('/', (req, res) => controller.getCups(req, res));

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
function __resetPublicCupsPoolForTests() {
  cachedPool = null;
  poolInitPromise = null;
}

module.exports = initializePublicCupsPlugin;
module.exports.__resetPublicCupsPoolForTests = __resetPublicCupsPoolForTests;
