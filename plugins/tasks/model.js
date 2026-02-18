// plugins/tasks/model.js
// Tasks model - V3 with @homebase/core SDK
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class TaskModel {
  constructor() {
    // No pool needed - ServiceManager provides database service
  }

  async getAll(req) {
    try {
      const db = Database.get(req);

      // Tenant isolation automatic
      const rows = await db.query('SELECT * FROM tasks ORDER BY created_at DESC', []);

      return rows.map(this.transformRow);
    } catch (error) {
      Logger.error('Failed to fetch tasks', error);
      throw new AppError('Failed to fetch tasks', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, taskData) {
    try {
      const db = Database.get(req);

      const {
        title,
        content,
        mentions,
        status,
        priority,
        due_date,
        assigned_to,
        created_from_note,
      } = taskData;

      // Use database.insert for automatic tenant isolation
      const result = await db.insert('tasks', {
        title: title || '',
        content: content || '',
        mentions: JSON.stringify(mentions || []),
        status: status || 'not started',
        priority: priority ?? 'Medium', // Use nullish coalescing to preserve 'Low' if set
        due_date: due_date || null,
        assigned_to: assigned_to || null,
        created_from_note: created_from_note || null,
      });

      Logger.info('Task created', { taskId: result.id });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to create task', error, { taskData: { title: taskData.title } });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create task', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, taskId, taskData) {
    try {
      const db = Database.get(req);

      // Verify user context exists
      const userId = req.session?.currentTenantUserId || req.session?.user?.id;
      if (!userId) {
        Logger.error('User context missing in update request', { taskId, session: req.session });
        throw new AppError('User context required for update', 401, AppError.CODES.UNAUTHORIZED);
      }

      // Verify task exists (ownership check automatic)
      const existing = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);

      if (!existing || existing.length === 0) {
        throw new AppError('Task not found', 404, AppError.CODES.NOT_FOUND);
      }

      const { title, content, mentions, status, priority, due_date, assigned_to } = taskData;

      // Use database.update for automatic tenant isolation
      const result = await db.update('tasks', taskId, {
        title: title || '',
        content: content || '',
        mentions: JSON.stringify(mentions || []),
        status: status || 'not started',
        priority: priority ?? 'Medium', // Use nullish coalescing to preserve 'Low' if set
        due_date: due_date || null,
        assigned_to: assigned_to || null,
      });

      Logger.info('Task updated', { taskId });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to update task', error, {
        taskId,
        taskData: {
          title: taskData.title,
          status: taskData.status,
          priority: taskData.priority,
          due_date: taskData.due_date,
        },
        errorMessage: error.message,
        errorStack: error.stack?.substring(0, 500),
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Failed to update task: ${error.message || 'Unknown error'}`,
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
      return await BulkOperationsHelper.bulkDelete(req, 'tasks', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete tasks', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to bulk delete tasks', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, taskId) {
    try {
      const db = Database.get(req);

      // Delete the task (tenant isolation automatic)
      await db.deleteRecord('tasks', taskId);

      Logger.info('Task deleted', { taskId });

      return { id: taskId };
    } catch (error) {
      Logger.error('Failed to delete task', error, { taskId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete task', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformRow(row) {
    let mentions = row.mentions || [];
    if (typeof mentions === 'string') {
      try {
        mentions = JSON.parse(mentions);
      } catch (e) {
        mentions = [];
      }
    }

    return {
      id: row.id.toString(),
      title: row.title,
      content: row.content || '',
      mentions: mentions,
      status: row.status || 'not started',
      priority: row.priority || 'Medium',
      due_date: row.due_date,
      assigned_to: row.assigned_to,
      created_from_note: row.created_from_note,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = TaskModel;
