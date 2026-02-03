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

  // Fallback to common name fields (generic)
  return (
    responseData.name ||
    responseData.title ||
    responseData.label ||
    responseData.subject ||
    responseData.companyName ||
    responseData.company_name ||
    responseData.description ||
    responseData.code ||
    responseData.estimateNumber ||
    responseData.invoiceNumber ||
    responseData.fileName ||
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

  // No more hardcoded mappings - use dynamic fallback

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

  // For DELETE requests, we no longer fetch the name centrally.
  // Plugins should log deletions manually if they want to include the name or backup.
  const getEntityNameForDelete = () => Promise.resolve(null);

  // Store original json method
  const originalJson = res.json.bind(res);

  // Override res.json to capture response data
  res.json = function (data) {
    // Restore original method
    res.json = originalJson;

    // Log activity after response is sent (non-blocking)
    res.on('finish', () => {
      // Skip if marked as skipped by the controller
      if (req.skipActivityLog) {
        return;
      }

      // Only log successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // For delete, wait for name fetch
        if (action === 'delete') {
          getEntityNameForDelete().then((preFetchedName) => {
            const entityName = req.activityLogEntityName || preFetchedName;
            const metadata = {
              ...(req.activityLogMetadata || {}),
            };
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

        // Merge custom metadata from request
        const metadata = {
          ...(req.activityLogMetadata || {}),
        };

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
