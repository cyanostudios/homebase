// plugins/settings/routes.js
// Mounted at /api/settings - use requireAuth only (settings is always-on)

const express = require('express');
const router = express.Router();

function createSettingsRoutes(controller, context) {
  const requireAuth = context?.middleware?.requireAuth;
  if (!requireAuth) {
    throw new Error('Settings plugin requires requireAuth in context.middleware');
  }

  // GET /api/settings/activity-log (must be before /:category)
  router.get('/activity-log', requireAuth, (req, res) => {
    controller.getActivityLogs(req, res);
  });

  // DELETE /api/settings/activity-log – delete all activity logs for the current user
  router.delete('/activity-log', requireAuth, (req, res) => {
    controller.deleteActivityLogs(req, res);
  });

  // GET /api/settings - all categories
  router.get('/', requireAuth, (req, res) => {
    controller.getAll(req, res);
  });

  // GET /api/settings/:category
  router.get('/:category', requireAuth, (req, res) => {
    controller.getCategory(req, res);
  });

  // PUT /api/settings/:category
  router.put('/:category', requireAuth, (req, res) => {
    controller.updateCategory(req, res);
  });

  return router;
}

module.exports = createSettingsRoutes;
