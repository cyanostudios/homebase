// server/core/services/activity-log/ActivityLogService.js
// Activity Log Service for audit trail logging

const ServiceManager = require('../../ServiceManager');

class ActivityLogService {
  /**
   * Log an activity to the activity_log table
   * @param {Object} req - Express request object (for tenant pool and user info)
   * @param {string} action - Action type: 'create', 'update', 'delete', 'export', 'settings'
   * @param {string} entityType - Entity type: 'contact', 'note', 'task', 'estimate', 'invoice', 'file', 'settings'
   * @param {number|null} entityId - ID of the affected entity (null for bulk operations)
   * @param {string|null} entityName - Human-readable name of the entity
   * @param {Object} additionalMetadata - Additional metadata to store (optional)
   * @returns {Promise<void>}
   */
  async logActivity(
    req,
    action,
    entityType,
    entityId = null,
    entityName = null,
    additionalMetadata = {},
  ) {
    try {
      console.log('[ActivityLogService] logActivity called:', {
        action,
        entityType,
        entityId,
        entityName,
      });

      // Get tenant pool from request
      const tenantPool = req.tenantPool;
      if (!tenantPool) {
        console.log('[ActivityLogService] No tenant pool, skipping log');
        // Silently fail if no tenant pool (e.g., during auth)
        return;
      }

      // Get user ID from session
      const userId = req.session?.user?.id;
      if (!userId) {
        console.log('[ActivityLogService] No user ID, skipping log');
        // Silently fail if no user (e.g., during signup)
        return;
      }

      console.log('[ActivityLogService] Inserting log:', {
        userId,
        action,
        entityType,
        entityId,
        entityName,
      });

      // Extract IP and user agent from request
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';

      // Build metadata object
      const metadata = {
        ip,
        userAgent,
        ...additionalMetadata,
      };

      // Insert activity log (non-blocking, fire and forget)
      // Use a promise but don't await to avoid blocking the request
      tenantPool
        .query(
          `INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
          [userId, action, entityType, entityId, entityName, JSON.stringify(metadata)],
        )
        .then(() => {
          console.log('[ActivityLogService] ✅ Successfully logged activity');
        })
        .catch((error) => {
          // Log error but don't throw (don't break the request)
          console.error('[ActivityLogService] ❌ Failed to log activity:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            table: error.table,
            userId,
            action,
            entityType,
            entityId,
          });

          // Check if table doesn't exist
          if (error.code === '42P01' || error.message.includes('does not exist')) {
            console.error(
              '[ActivityLogService] ⚠️  Table "activity_log" does not exist! Run migration: npm run migrate:activity-log',
            );
          }

          const logger = ServiceManager.get('logger');
          logger.error('Failed to log activity', error, {
            userId,
            action,
            entityType,
            entityId,
          });
        });
    } catch (error) {
      // Silently fail - activity logging should never break the application
      const logger = ServiceManager.get('logger');
      logger.error('Activity log service error', error, {
        action,
        entityType,
      });
    }
  }

  /**
   * Get activity logs with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of records to return (default: 50)
   * @param {number} options.offset - Offset for pagination (default: 0)
   * @param {string} options.entityType - Filter by entity type (optional)
   * @param {string} options.action - Filter by action (optional)
   * @param {string} options.startDate - Start date filter (ISO string, optional)
   * @param {string} options.endDate - End date filter (ISO string, optional)
   * @returns {Promise<{logs: Array, total: number}>}
   */
  async getActivityLogs(req, options = {}) {
    const tenantPool = req.tenantPool;
    if (!tenantPool) {
      throw new Error('No tenant pool available');
    }

    const userId = req.session?.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    console.log('[ActivityLogService] getActivityLogs called:', { userId, options });

    const {
      limit = 50,
      offset = 0,
      entityType = null,
      action = null,
      startDate = null,
      endDate = null,
    } = options;

    // Build WHERE clause
    const conditions = ['user_id = $1'];
    const params = [userId];
    let paramIndex = 2;

    if (entityType) {
      conditions.push(`entity_type = $${paramIndex}`);
      params.push(entityType);
      paramIndex++;
    }

    if (action) {
      conditions.push(`action = $${paramIndex}`);
      params.push(action);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Check if table exists first
    try {
      const tableCheck = await tenantPool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = current_schema()
          AND table_name = 'activity_log'
        )
      `);

      if (!tableCheck.rows[0].exists) {
        console.error(
          '[ActivityLogService] ⚠️  Table "activity_log" does not exist! Run migration: npm run migrate:activity-log',
        );
        throw new Error(
          'Activity log table does not exist. Please run migration: npm run migrate:activity-log',
        );
      }
    } catch (error) {
      if (error.message.includes('does not exist')) {
        throw error;
      }
      // If we can't check (e.g., permission issue), continue and let the query fail
      console.warn('[ActivityLogService] Could not check if table exists:', error.message);
    }

    // Get total count
    const countResult = await tenantPool.query(
      `SELECT COUNT(*) as total FROM activity_log ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated logs
    params.push(limit, offset);

    try {
      const logsResult = await tenantPool.query(
        `SELECT id, user_id, action, entity_type, entity_id, entity_name, metadata, created_at
         FROM activity_log
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
      );

      console.log('[ActivityLogService] Found', logsResult.rows.length, 'logs, total:', total);

      return {
        logs: logsResult.rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          entityName: row.entity_name,
          metadata: row.metadata || {},
          createdAt: row.created_at,
        })),
        total,
      };
    } catch (error) {
      console.error('[ActivityLogService] Error fetching logs:', {
        message: error.message,
        code: error.code,
        detail: error.detail,
      });

      // Check if table doesn't exist
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        console.error(
          '[ActivityLogService] ⚠️  Table "activity_log" does not exist! Run migration: npm run migrate:activity-log',
        );
        throw new Error(
          'Activity log table does not exist. Please run migration: npm run migrate:activity-log',
        );
      }

      throw error;
    }
  }
}

module.exports = ActivityLogService;
