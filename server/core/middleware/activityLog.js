// server/core/middleware/activityLog.js
// Middleware for automatic activity logging

const ActivityLogService = require('../services/activity-log/ActivityLogService');

const activityLogService = new ActivityLogService();

/**
 * Extract entity name from response based on entity type
 * @param {Object} responseData - Response data from API
 * @param {string} entityType - Entity type (contact, note, task, etc.)
 * @returns {string|null} Entity name or null
 */
function extractEntityName(responseData, entityType) {
  if (!responseData || typeof responseData !== 'object') {
    return null;
  }

  // 1. Try specific mappings first
  const specificMap = {
    contact: responseData.companyName || responseData.name,
    note: responseData.title,
    task: responseData.title,
    estimate: responseData.estimateNumber,
    invoice: responseData.invoiceNumber,
    file: responseData.name || responseData.fileName,
    settings: responseData.category || 'settings',
  };

  if (specificMap[entityType]) {
    return specificMap[entityType];
  }

  // 2. Fallback to common name fields
  return (
    responseData.name ||
    responseData.title ||
    responseData.label ||
    responseData.subject ||
    responseData.companyName ||
    responseData.description ||
    responseData.code ||
    null
  );
}

/**
 * Extract entity type from request path
 * @param {string} path - Request path (e.g., '/api/contacts/123')
 * @returns {string|null} Entity type or null
 */
function extractEntityType(path) {
  // Match /api/:plugin or /api/:plugin/:id
  const match = path.match(/^\/api\/([^\/]+)/);
  if (!match) {
    return null;
  }

  const plugin = match[1];

  // 1. Check strict mappings first
  const entityTypeMap = {
    contacts: 'contact',
    notes: 'note',
    tasks: 'task',
    estimates: 'estimate',
    invoices: 'invoice',
    files: 'file',
  };

  if (entityTypeMap[plugin]) {
    return entityTypeMap[plugin];
  }

  // 2. Dynamic fallback: single-ize the plugin name
  // e.g. "products" -> "product", "inventory" -> "inventory"
  if (plugin.endsWith('s')) {
    return plugin.slice(0, -1);
  }

  return plugin;
}

/**
 * Extract action from HTTP method and path
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @returns {string|null} Action type or null
 */
function extractAction(method, path) {
  // Check for export endpoints
  if (path.includes('/export')) {
    return 'export';
  }

  // Map HTTP methods to actions
  const actionMap = {
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };

  return actionMap[method] || null;
}

/**
 * Extract entity ID from request path
 * @param {string} path - Request path (e.g., '/api/contacts/123')
 * @returns {number|null} Entity ID or null
 */
function extractEntityId(path) {
  // Match /api/:plugin/:id
  const match = path.match(/^\/api\/[^\/]+\/(\d+)$/);
  if (!match) {
    return null;
  }

  const id = parseInt(match[1], 10);
  return isNaN(id) ? null : id;
}

/**
 * Activity log middleware
 * Automatically logs create, update, delete, and export actions
 */
function activityLogMiddleware(req, res, next) {
  // Only log authenticated requests
  if (!req.session?.user?.id) {
    return next();
  }

  // Only log API routes
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Skip activity log routes to avoid recursion
  if (req.path.startsWith('/api/activity-log')) {
    return next();
  }

  // Extract action and entity info
  const action = extractAction(req.method, req.path);
  if (!action) {
    // Not an action we want to log
    return next();
  }

  const entityType = extractEntityType(req.path);
  if (!entityType) {
    // Not a plugin route we recognize
    return next();
  }

  // Try to get ID from URL (will be null for create)
  let entityId = extractEntityId(req.path);

  // For DELETE requests, we need to get entity name before deletion
  // Use a closure to capture the name
  const getEntityNameForDelete = (() => {
    let cachedName = null;
    let promise = null;

    if (action === 'delete' && entityId && req.tenantPool) {
      // Get entity name from database before delete
      const getEntityNameQuery = {
        contact: 'SELECT company_name FROM contacts WHERE id = $1',
        note: 'SELECT title FROM notes WHERE id = $1',
        task: 'SELECT title FROM tasks WHERE id = $1',
        estimate: 'SELECT estimate_number FROM estimates WHERE id = $1',
        invoice: 'SELECT invoice_number FROM invoices WHERE id = $1',
        file: 'SELECT name FROM user_files WHERE id = $1',
      };

      // Try specific query, or fallback to generic if table exists (harder to know table name dynamically)
      // For now, we stick to safe mapped queries to avoid SQL errors on unknown tables
      const query = getEntityNameQuery[entityType];

      if (query) {
        promise = req.tenantPool
          .query(query, [entityId])
          .then((result) => {
            if (result.rows.length > 0) {
              const row = result.rows[0];
              if (entityType === 'contact') {
                cachedName = row.company_name;
              } else if (entityType === 'note' || entityType === 'task') {
                cachedName = row.title;
              } else if (entityType === 'estimate') {
                cachedName = row.estimate_number;
              } else if (entityType === 'invoice') {
                cachedName = row.invoice_number;
              } else if (entityType === 'file') {
                cachedName = row.name;
              }
            }
            return cachedName;
          })
          .catch(() => {
            // Silently fail - we'll log without name
            return null;
          });
      }
    }

    return () => promise || Promise.resolve(null);
  })();

  // Store original json method
  const originalJson = res.json.bind(res);

  // Override res.json to capture response data
  res.json = function (data) {
    // Restore original method
    res.json = originalJson;

    // Log activity after response is sent (non-blocking)
    res.on('finish', () => {
      // Only log successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // For delete, wait for name fetch
        if (action === 'delete') {
          getEntityNameForDelete().then((entityName) => {
            const metadata = {};
            activityLogService
              .logActivity(req, action, entityType, entityId, entityName, metadata)
              .catch((error) => {
                // Silently fail - don't break the request
                const ServiceManager = require('../ServiceManager');
                const logger = ServiceManager.get('logger');
                logger.error('Activity log middleware error (delete)', error, {
                  path: req.path,
                  method: req.method,
                });
              });
          });
          return;
        }

        // For non-delete actions (Create/Update), extract info from response
        const entityName = extractEntityName(data, entityType);

        // IMPORTANT: If we didn't have an ID (e.g. Create), try to get it from response
        if (!entityId && data && data.id) {
          entityId = data.id;
        }

        // Extract export format from metadata if it's an export
        const metadata = {};
        if (action === 'export') {
          metadata.exportFormat = req.query.format || req.body.format || 'unknown';
        }

        // Log activity (non-blocking, fire and forget)
        activityLogService
          .logActivity(req, action, entityType, entityId, entityName, metadata)
          .catch((error) => {
            // Silently fail - don't break the request
            const ServiceManager = require('../ServiceManager');
            const logger = ServiceManager.get('logger');
            logger.error('Activity log middleware error', error, {
              path: req.path,
              method: req.method,
            });
          });
      }
    });

    // Call original json method
    return originalJson(data);
  };

  next();
}

module.exports = { activityLogMiddleware };
