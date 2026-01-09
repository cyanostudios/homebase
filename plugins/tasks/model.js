// plugins/tasks/model.js
// Tasks model - V2 with ServiceManager
const ServiceManager = require('../../server/core/ServiceManager');
const { AppError } = require('../../server/core/errors/AppError');

class TaskModel {
  constructor() {
    // No pool needed - ServiceManager provides database service
  }

  _getContext(req) {
    return {
      userId: req?.session?.currentTenantUserId || req?.session?.user?.id,
      pool: req?.tenantPool,
    };
  }

  async getAll(req) {
    try {
      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);
      
      // Tenant isolation automatic
      const rows = await database.query(
        'SELECT * FROM tasks ORDER BY created_at DESC',
        [],
        context
      );
      
      return rows.map(this.transformRow);
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to fetch tasks', error);
      throw new AppError('Failed to fetch tasks', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, taskData) {
    try {
      const database = ServiceManager.get('database', req);
      const logger = ServiceManager.get('logger');
      const context = this._getContext(req);
      
      const { 
        title, 
        content, 
        mentions, 
        status, 
        priority, 
        due_date, 
        assigned_to, 
        created_from_note 
      } = taskData;
      
      // Use database.insert for automatic tenant isolation
      const result = await database.insert('tasks', {
        title: title || '',
        content: content || '',
        mentions: JSON.stringify(mentions || []),
        status: status || 'not started',
        priority: priority || 'Medium',
        due_date: due_date || null,
        assigned_to: assigned_to || null,
        created_from_note: created_from_note || null,
      }, context);
      
      logger.info('Task created', { taskId: result.id, userId: context.userId });
      
      return this.transformRow(result);
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to create task', error, { taskData: { title: taskData.title } });
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create task', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, taskId, taskData) {
    try {
      const database = ServiceManager.get('database', req);
      const logger = ServiceManager.get('logger');
      const context = this._getContext(req);
      
      // Verify task exists (ownership check automatic)
      const existing = await database.query(
        'SELECT * FROM tasks WHERE id = $1',
        [taskId],
        context
      );
      
      if (existing.length === 0) {
        throw new AppError('Task not found', 404, AppError.CODES.NOT_FOUND);
      }
      
      const { 
        title, 
        content, 
        mentions, 
        status, 
        priority, 
        due_date, 
        assigned_to 
      } = taskData;
      
      // Use database.update for automatic tenant isolation
      const result = await database.update('tasks', taskId, {
        title: title || '',
        content: content || '',
        mentions: JSON.stringify(mentions || []),
        status: status || 'not started',
        priority: priority || 'Medium',
        due_date: due_date || null,
        assigned_to: assigned_to || null,
      }, context);
      
      logger.info('Task updated', { taskId, userId: context.userId });
      
      return this.transformRow(result);
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to update task', error, { taskId });
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update task', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, taskId) {
    try {
      const database = ServiceManager.get('database', req);
      const logger = ServiceManager.get('logger');
      const context = this._getContext(req);
      
      // Delete the task (tenant isolation automatic)
      await database.delete('tasks', taskId, context);
      
      logger.info('Task deleted', { taskId, userId: context.userId });
      
      return { id: taskId };
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to delete task', error, { taskId });
      
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
