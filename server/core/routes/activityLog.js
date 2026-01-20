// server/core/routes/activityLog.js
// Activity log routes: retrieve activity logs

const express = require('express');
const router = express.Router();
const ServiceManager = require('../ServiceManager');
const ActivityLogService = require('../services/activity-log/ActivityLogService');

// Dependencies will be injected by setupActivityLogRoutes()
let requireAuth = null;

/**
 * Setup activity log routes with dependencies
 * @param {Function} authMiddleware - Auth middleware
 */
function setupActivityLogRoutes(authMiddleware) {
  requireAuth = authMiddleware;
}

/**
 * GET /api/activity-log
 * Get activity logs with filtering and pagination
 * Query params:
 *   - limit: Number of records (default: 50)
 *   - offset: Offset for pagination (default: 0)
 *   - entity_type: Filter by entity type (optional)
 *   - action: Filter by action (optional)
 *   - start_date: Start date filter ISO string (optional)
 *   - end_date: End date filter ISO string (optional)
 */
router.get(
  '/',
  (req, res, next) => requireAuth(req, res, next),
  async (req, res) => {
    try {
      const activityLogService = new ActivityLogService();

      // Parse query parameters
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;
      const entityType = req.query.entity_type || null;
      const action = req.query.action || null;
      const startDate = req.query.start_date || null;
      const endDate = req.query.end_date || null;

      // Validate limit (max 200)
      const validLimit = Math.min(Math.max(limit, 1), 200);
      const validOffset = Math.max(offset, 0);

      const result = await activityLogService.getActivityLogs(req, {
        limit: validLimit,
        offset: validOffset,
        entityType,
        action,
        startDate,
        endDate,
      });

      res.json({
        logs: result.logs,
        total: result.total,
        limit: validLimit,
        offset: validOffset,
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to fetch activity logs', error, {
        userId: req.session?.user?.id,
      });
      res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
  },
);

module.exports = router;
module.exports.setupActivityLogRoutes = setupActivityLogRoutes;
