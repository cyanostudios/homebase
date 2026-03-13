// plugins/settings/controller.js
const ServiceManager = require('../../server/core/ServiceManager');
const ActivityLogService = require('../../server/core/services/activity-log/ActivityLogService');

class SettingsController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const userId = req.session.user.id;
      const settings = await this.model.getAll(userId);
      res.json({ settings });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to fetch settings', error, { userId: req.session.user.id });
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  async getCategory(req, res) {
    try {
      const userId = req.session.user.id;
      const { category } = req.params;
      const settings = await this.model.getCategory(userId, category);
      res.json({ settings });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to fetch settings category', error, {
        userId: req.session.user.id,
        category: req.params.category,
      });
      res.status(500).json({ error: 'Failed to fetch settings category' });
    }
  }

  async updateCategory(req, res) {
    try {
      const userId = req.session.user.id;
      const { category } = req.params;
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Settings must be an object' });
      }

      const updated = await this.model.updateCategory(userId, category, settings);

      const logger = ServiceManager.get('logger');
      logger.info('Settings updated', { userId, category });

      const activityLogService = new ActivityLogService();
      activityLogService
        .logActivity(req, 'settings', 'settings', null, category, {})
        .catch((error) => {
          logger.error('Failed to log settings activity', error, { userId, category });
        });

      res.json({ settings: updated });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to update settings', error, {
        userId: req.session.user.id,
        category: req.params.category,
      });
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  async getActivityLogs(req, res) {
    try {
      const activityLogService = new ActivityLogService();
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;
      const validLimit = Math.min(Math.max(limit, 1), 200);
      const validOffset = Math.max(offset, 0);

      const result = await activityLogService.getActivityLogs(req, {
        limit: validLimit,
        offset: validOffset,
        entityType: req.query.entity_type || null,
        entityId: req.query.entity_id ?? null,
        action: req.query.action || null,
        startDate: req.query.start_date || null,
        endDate: req.query.end_date || null,
      });

      res.json({
        logs: result.logs,
        total: result.total,
        limit: validLimit,
        offset: validOffset,
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to fetch activity logs', error, { userId: req.session?.user?.id });
      res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
  }

  async deleteActivityLogs(req, res) {
    try {
      const activityLogService = new ActivityLogService();
      const result = await activityLogService.deleteActivityLogs(req);
      res.json({ deleted: result.deleted });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to delete activity logs', error, { userId: req.session?.user?.id });
      res.status(500).json({ error: error.message || 'Failed to delete activity logs' });
    }
  }
}

module.exports = SettingsController;
