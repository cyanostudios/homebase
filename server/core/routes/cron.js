// server/core/routes/cron.js
// Internal cron endpoints — protected by x-cron-secret header, NOT behind requireAuth or CSRF.
// Intended to be called by Railway Cron (or a local curl script for dev).

const crypto = require('crypto');
const express = require('express');

const router = express.Router();

/**
 * Timing-safe string comparison so the header check is not vulnerable to
 * timing side-channels, even though CRON_SECRET is low-value.
 */
function timingSafeEqual(a, b) {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // Still do a dummy compare so timing is constant.
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * POST /api/cron/cups/refresh
 *
 * Runs the cups auto-refresh for all tenants that have opted in via
 * cups.autoRefresh = true in user_settings, or for a single user if
 * { userId } is provided in the request body.
 *
 * Required header: x-cron-secret: <CRON_SECRET env var>
 */
router.post('/cups/refresh', async (req, res) => {
  const provided = req.get('x-cron-secret') || '';
  const expected = process.env.CRON_SECRET || '';

  if (!expected) {
    return res.status(503).json({ error: 'CRON_SECRET is not configured on this server' });
  }

  if (!timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const { runCupsAutoRefresh } = require('../../../plugins/cups/services/cronRefresh');
    const { userId } = req.body || {};
    const summary = await runCupsAutoRefresh({ userId: userId ?? undefined });
    return res.json(summary);
  } catch (err) {
    const ServiceManager = require('../ServiceManager');
    const logger = ServiceManager.get('logger');
    logger.error('cups cron endpoint failed', err);
    return res.status(500).json({ error: 'Cron job failed', message: err?.message });
  }
});

module.exports = router;
