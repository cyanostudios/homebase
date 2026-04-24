// plugins/tasks/model.js
// Tasks model - V3 with @homebase/core SDK
const crypto = require('crypto');
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const {
  registerPublicShareRoute,
  unregisterPublicShareRoute,
  RESOURCE_TASK,
  resolvePublicShareTenantFromToken,
} = require('../../server/core/services/publicShareRouting');

/**
 * PostgreSQLAdapter wraps pg errors in AppError (top-level code is DATABASE_ERROR).
 * Raw SQLSTATE 42703 is on details.errorCode for insert; update often only sets details.originalError.
 */
function isMissingAssignedToIdsColumnError(err) {
  if (!err) return false;
  const details = err.details || {};
  const pgCode = details.errorCode;
  const combined = `${err.message || ''} ${details.originalError || ''}`;
  if (pgCode === '42703' && combined.includes('assigned_to_ids')) return true;
  return combined.includes('assigned_to_ids') && combined.includes('does not exist');
}

// Module-level cache: null=unknown, true=column exists, false=column missing.
// Avoids querying information_schema (which is incompatible with tenant-isolated
// db.query) on every operation. Resolved on first actual write attempt.
let _supportsAssignedToIds = null;

class TaskModel {
  constructor() {
    // No pool needed - ServiceManager provides database service
  }

  _getContext(req) {
    if (!req) {
      throw new Error('Request object is required');
    }
    const pool = req.tenantPool;
    if (!pool) {
      throw new Error('Tenant pool not found in request. Ensure auth middleware is applied.');
    }
    return { pool, userId: req.session?.currentTenantUserId || req.session?.user?.id };
  }

  async getById(req, taskId) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(taskId), 10);
      if (Number.isNaN(id)) {
        return null;
      }
      const rows = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
      if (!rows.length) {
        return null;
      }
      return this.transformRow(rows[0]);
    } catch (error) {
      Logger.error('Failed to get task by id', error, { taskId });
      throw new AppError('Failed to get task', 500, AppError.CODES.DATABASE_ERROR);
    }
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
        assigned_to_ids,
      } = taskData;
      const normalizedAssignedToIds = Array.isArray(assigned_to_ids)
        ? assigned_to_ids.map((id) => String(id))
        : assigned_to
          ? [String(assigned_to)]
          : [];

      const basePayload = {
        title: title || '',
        content: content || '',
        mentions: JSON.stringify(mentions || []),
        status: status || 'not started',
        priority: priority ?? 'Medium',
        due_date: due_date || null,
        assigned_to: normalizedAssignedToIds[0] || assigned_to || null,
        created_from_note: created_from_note || null,
      };

      let result;
      if (_supportsAssignedToIds !== false) {
        try {
          result = await db.insert('tasks', {
            ...basePayload,
            assigned_to_ids: JSON.stringify(normalizedAssignedToIds),
          });
          _supportsAssignedToIds = true;
        } catch (colError) {
          if (isMissingAssignedToIdsColumnError(colError)) {
            _supportsAssignedToIds = false;
            result = await db.insert('tasks', basePayload);
          } else {
            throw colError;
          }
        }
      } else {
        result = await db.insert('tasks', basePayload);
      }

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

      const { title, content, mentions, status, priority, due_date, assigned_to, assigned_to_ids } =
        taskData;
      const normalizedAssignedToIds = Array.isArray(assigned_to_ids)
        ? assigned_to_ids.map((id) => String(id))
        : assigned_to
          ? [String(assigned_to)]
          : [];

      const basePayload = {
        title: title || '',
        content: content || '',
        mentions: JSON.stringify(mentions || []),
        status: status || 'not started',
        priority: priority ?? 'Medium',
        due_date: due_date || null,
        assigned_to: normalizedAssignedToIds[0] || assigned_to || null,
      };

      let result;
      if (_supportsAssignedToIds !== false) {
        try {
          result = await db.update('tasks', taskId, {
            ...basePayload,
            assigned_to_ids: JSON.stringify(normalizedAssignedToIds),
          });
          _supportsAssignedToIds = true;
        } catch (colError) {
          if (isMissingAssignedToIdsColumnError(colError)) {
            _supportsAssignedToIds = false;
            result = await db.update('tasks', taskId, basePayload);
          } else {
            throw colError;
          }
        }
      } else {
        result = await db.update('tasks', taskId, basePayload);
      }

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
      // Use core BulkOperationsHelper for generic bulk delete logic
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

  generateShareToken() {
    const bytes = crypto.randomBytes(24);
    return this.base62Encode(bytes);
  }

  base62Encode(buffer) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    let num = BigInt(`0x${buffer.toString('hex')}`);

    while (num > 0n) {
      result = chars[Number(num % 62n)] + result;
      num = num / 62n;
    }

    return result.padStart(32, '0');
  }

  async createShare(req, taskId, validUntil) {
    try {
      const context = this._getContext(req);
      const pool = context.pool;

      const task = await this.getById(req, taskId);
      if (!task) {
        throw new AppError('Task not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      const shareToken = this.generateShareToken();
      const id = parseInt(String(taskId), 10);

      const result = await pool.query(
        `
        INSERT INTO task_shares (task_id, share_token, valid_until)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
        [id, shareToken, validUntil],
      );

      Logger.info('Task share created', { taskId: id, shareId: result.rows[0].id });

      const createdToken = result.rows[0].share_token;
      let tenantConnectionString = req.session?.tenantConnectionString;
      if (!tenantConnectionString && req.session?.user?.id) {
        try {
          const TenantContextService = require('../../server/core/services/tenant/TenantContextService');
          const tctx = new TenantContextService();
          const ctx = await tctx.getTenantContextByUserId(req.session.user.id);
          tenantConnectionString = ctx?.tenantConnectionString ?? null;
        } catch (e) {
          Logger.warn('Could not resolve tenant connection string for task share registration', {
            taskId: id,
            message: e?.message,
          });
        }
      }
      if (tenantConnectionString) {
        try {
          await registerPublicShareRoute(createdToken, RESOURCE_TASK, tenantConnectionString);
        } catch (routeErr) {
          Logger.error('public_share_routing register failed', routeErr, {
            taskId: id,
            tokenPrefix: createdToken.substring(0, 8),
          });
        }
      } else {
        Logger.warn(
          'Task share created in tenant DB but public_share_routing not registered (no tenant connection string)',
          {
            taskId: id,
          },
        );
      }

      return {
        id: result.rows[0].id.toString(),
        taskId: result.rows[0].task_id.toString(),
        shareToken: result.rows[0].share_token,
        validUntil: result.rows[0].valid_until,
        createdAt: result.rows[0].created_at,
        accessedCount: result.rows[0].accessed_count,
        lastAccessedAt: result.rows[0].last_accessed_at,
      };
    } catch (error) {
      Logger.error('Failed to create task share', error, { taskId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create share', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getTaskByShareToken(req, shareToken) {
    try {
      await resolvePublicShareTenantFromToken(req, RESOURCE_TASK, shareToken);
      if (!req.tenantPool) {
        return null;
      }
      const pool = req.tenantPool;

      const result = await pool.query(
        `
        SELECT
          t.*,
          ts.accessed_count,
          ts.valid_until AS share_valid_until
        FROM tasks t
        JOIN task_shares ts ON t.id = ts.task_id
        WHERE ts.share_token = $1 AND ts.valid_until > NOW()
      `,
        [shareToken],
      );

      if (!result.rows.length) {
        return null;
      }

      const row = result.rows[0];
      const currentAccessCount = row.accessed_count;

      await pool.query(
        `
        UPDATE task_shares
        SET accessed_count = accessed_count + 1, last_accessed_at = NOW()
        WHERE share_token = $1
      `,
        [shareToken],
      );

      const task = this.transformRow(row);
      task.shareValidUntil = row.share_valid_until;
      task.accessedCount = currentAccessCount + 1;

      return task;
    } catch (error) {
      Logger.error('Failed to get task by share token', error, {
        shareToken: shareToken.substring(0, 10),
      });
      throw new AppError('Failed to get task by share token', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getSharesForTask(req, taskId) {
    try {
      const context = this._getContext(req);
      const pool = context.pool;

      const task = await this.getById(req, taskId);
      if (!task) {
        throw new AppError('Task not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      const id = parseInt(String(taskId), 10);
      const result = await pool.query(
        `
        SELECT * FROM task_shares
        WHERE task_id = $1
        ORDER BY created_at DESC
      `,
        [id],
      );

      return result.rows.map((row) => ({
        id: row.id.toString(),
        taskId: row.task_id.toString(),
        shareToken: row.share_token,
        validUntil: row.valid_until,
        createdAt: row.created_at,
        accessedCount: row.accessed_count,
        lastAccessedAt: row.last_accessed_at,
      }));
    } catch (error) {
      Logger.error('Failed to get shares for task', error, { taskId });

      if (error instanceof AppError) {
        throw error;
      }

      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        throw new AppError(
          'Shares table not found. Please run database migrations.',
          500,
          AppError.CODES.DATABASE_ERROR,
        );
      }

      throw new AppError('Failed to get shares for task', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async revokeShare(req, shareId) {
    try {
      const context = this._getContext(req);
      const pool = context.pool;

      const shareCheck = await pool.query('SELECT task_id FROM task_shares WHERE id = $1', [
        shareId,
      ]);

      if (!shareCheck.rows.length) {
        throw new AppError('Share not found', 404, AppError.CODES.NOT_FOUND);
      }

      const taskId = shareCheck.rows[0].task_id;
      const task = await this.getById(req, taskId);

      if (!task) {
        throw new AppError('Share not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      const deleteResult = await pool.query('DELETE FROM task_shares WHERE id = $1 RETURNING *', [
        shareId,
      ]);

      if (!deleteResult.rows.length) {
        throw new AppError('Share not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('Task share revoked', { shareId, taskId });

      const revokedToken = deleteResult.rows[0].share_token;
      try {
        await unregisterPublicShareRoute(revokedToken);
      } catch (routeErr) {
        Logger.error('public_share_routing unregister failed', routeErr, {
          shareId,
          tokenPrefix: revokedToken.substring(0, 8),
        });
      }

      return {
        id: deleteResult.rows[0].id.toString(),
        taskId: deleteResult.rows[0].task_id.toString(),
        shareToken: deleteResult.rows[0].share_token,
      };
    } catch (error) {
      Logger.error('Failed to revoke task share', error, { shareId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to revoke share', 500, AppError.CODES.DATABASE_ERROR);
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

    let assignedToIds = [];
    if (Array.isArray(row.assigned_to_ids)) {
      assignedToIds = row.assigned_to_ids.map((id) => String(id));
    } else if (typeof row.assigned_to_ids === 'string' && row.assigned_to_ids.trim()) {
      try {
        const parsed = JSON.parse(row.assigned_to_ids);
        assignedToIds = Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
      } catch (e) {
        assignedToIds = [];
      }
    }
    if (assignedToIds.length === 0 && row.assigned_to) {
      assignedToIds = [String(row.assigned_to)];
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
      assigned_to_ids: assignedToIds,
      created_from_note: row.created_from_note,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = TaskModel;
