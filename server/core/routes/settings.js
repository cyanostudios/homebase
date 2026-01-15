// server/core/routes/settings.js
// Settings routes: user settings management

const express = require('express');
const router = express.Router();
const ServiceManager = require('../ServiceManager');

// Dependencies will be injected by setupSettingsRoutes()
let pool = null;
let requireAuth = null;

/**
 * Setup settings routes with dependencies
 * @param {Pool} mainPool - Main database pool
 * @param {Function} authMiddleware - Auth middleware
 */
function setupSettingsRoutes(mainPool, authMiddleware) {
  pool = mainPool;
  requireAuth = authMiddleware;
}

/**
 * GET /api/settings
 * Get all settings for the authenticated user
 */
router.get(
  '/',
  (req, res, next) => requireAuth(req, res, next),
  async (req, res) => {
    try {
      const userId = req.session.user.id;

      const result = await pool.query(
        'SELECT category, settings FROM user_settings WHERE user_id = $1',
        [userId],
      );

      // Convert array of rows to object keyed by category
      const settings = {};
      result.rows.forEach((row) => {
        settings[row.category] = row.settings;
      });

      res.json({ settings });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to fetch settings', error, { userId: req.session.user.id });
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  },
);

/**
 * GET /api/settings/:category
 * Get settings for a specific category
 */
router.get(
  '/:category',
  (req, res, next) => requireAuth(req, res, next),
  async (req, res) => {
    try {
      const userId = req.session.user.id;
      const { category } = req.params;

      const result = await pool.query(
        'SELECT settings FROM user_settings WHERE user_id = $1 AND category = $2',
        [userId, category],
      );

      if (!result.rows.length) {
        return res.json({ settings: {} });
      }

      res.json({ settings: result.rows[0].settings });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to fetch settings category', error, {
        userId: req.session.user.id,
        category: req.params.category,
      });
      res.status(500).json({ error: 'Failed to fetch settings category' });
    }
  },
);

/**
 * PUT /api/settings/:category
 * Update settings for a specific category
 */
router.put(
  '/:category',
  (req, res, next) => requireAuth(req, res, next),
  async (req, res) => {
    try {
      const userId = req.session.user.id;
      const { category } = req.params;
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Settings must be an object' });
      }

      // Upsert settings
      const result = await pool.query(
        `INSERT INTO user_settings (user_id, category, settings, updated_at)
         VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, category)
         DO UPDATE SET settings = $3::jsonb, updated_at = CURRENT_TIMESTAMP
         RETURNING settings`,
        [userId, category, JSON.stringify(settings)],
      );

      const logger = ServiceManager.get('logger');
      logger.info('Settings updated', {
        userId,
        category,
      });

      res.json({ settings: result.rows[0].settings });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to update settings', error, {
        userId: req.session.user.id,
        category: req.params.category,
      });
      res.status(500).json({ error: 'Failed to update settings' });
    }
  },
);

module.exports = router;
module.exports.setupSettingsRoutes = setupSettingsRoutes;
