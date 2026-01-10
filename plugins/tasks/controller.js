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
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to update task' });
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
