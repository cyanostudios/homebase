// plugins/tasks/controller.js
// Tasks controller - V3 with @homebase/core SDK
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class TaskController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const tasks = await this.model.getAll(req);
      res.json(tasks);
    } catch (error) {
      Logger.error('Get tasks failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  async create(req, res) {
    try {
      const task = await this.model.create(req, req.body);
      res.json(task);
    } catch (error) {
      Logger.error('Create task failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to create task' });
    }
  }

  async update(req, res) {
    try {
      const task = await this.model.update(req, req.params.id, req.body);
      res.json(task);
    } catch (error) {
      Logger.error('Update task failed', error, {
        taskId: req.params.id,
        userId: Context.getUserId(req),
        requestBody: req.body,
        errorMessage: error.message,
        errorStack: error.stack?.substring(0, 500),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({
        error: 'Failed to update task',
        message: error.message || 'Unknown error',
      });
    }
  }

  async bulkDelete(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res
          .status(400)
          .json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const ids = Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)));

      if (!ids.length) {
        return res.json({ ok: true, requested: 0, deleted: 0 });
      }

      if (ids.length > 500) {
        return res
          .status(400)
          .json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }

      // Use model's bulkDelete which uses BulkOperationsHelper
      const result = await this.model.bulkDelete(req, ids);

      const deleted =
        typeof result?.deletedCount === 'number'
          ? result.deletedCount
          : Array.isArray(result?.deletedIds)
            ? result.deletedIds.length
            : 0;

      return res.json({
        ok: true,
        requested: ids.length,
        deleted,
        deletedIds: result?.deletedIds || [],
      });
    } catch (error) {
      Logger.error('Bulk delete error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({ error: 'Bulk delete failed' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Task deleted successfully' });
    } catch (error) {
      Logger.error('Delete task failed', error, {
        taskId: req.params.id,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to delete task' });
    }
  }
}

module.exports = TaskController;
