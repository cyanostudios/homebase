// plugins/requests/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const {
  coerceRequestTypes,
  toPublicRequestType,
  findRequestTypeConfig,
} = require('./requestTypeConfig');
const { getAdapter } = require('./pluginTargets/registry');
const garmentsAdapter = require('./pluginTargets/garments');

/**
 * Resolve plugin routing from the authenticated user's request type settings.
 * Ignores any client-supplied plugin_target* — snapshots from settings only.
 */
async function resolvePluginRoutingForUser(userId, requestType, extraData) {
  if (!Number.isFinite(userId)) {
    return { plugin_target: null, plugin_target_id: null, extra_data: null };
  }

  const ServiceManager = require('../../server/core/ServiceManager');
  const SettingsModel = require('../settings/model');
  const settingsModel = new SettingsModel(ServiceManager.getMainPool());
  const requestsSettings = await settingsModel.getCategory(userId, 'requests');
  const typeConfig = findRequestTypeConfig(requestsSettings?.requestTypes, requestType);

  if (!typeConfig?.plugin) {
    return { plugin_target: null, plugin_target_id: null, extra_data: null };
  }

  const adapter = getAdapter(typeConfig.plugin);
  if (!adapter) {
    throw new AppError(
      `Unsupported plugin target: ${typeConfig.plugin}`,
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }

  const intakeSchema = garmentsAdapter.filterIntakeSchema(typeConfig.intakeSchema);
  const sanitizedExtra = adapter.validateExtraData(
    extraData == null ? {} : extraData,
    intakeSchema,
  );
  const plugin_target_id = typeConfig.targetListId || null;
  if (!plugin_target_id) {
    throw new AppError(
      'Request type is missing target list configuration',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }

  return {
    plugin_target: typeConfig.plugin,
    plugin_target_id,
    extra_data: sanitizedExtra,
  };
}

class RequestController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const requests = await this.model.getAll(req);
      res.json(requests);
    } catch (error) {
      Logger.error('Get requests failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch requests' });
    }
  }

  async getById(req, res) {
    try {
      const request = await this.model.getById(req, req.params.id);
      res.json(request);
    } catch (error) {
      Logger.error('Get request failed', error, {
        requestId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch request' });
    }
  }

  async markViewed(req, res) {
    try {
      const request = await this.model.markViewed(req, req.params.id);
      res.json(request);
    } catch (error) {
      Logger.error('Mark request viewed failed', error, {
        requestId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to mark request viewed' });
    }
  }

  async create(req, res) {
    try {
      const userId = Context.getUserId(req);
      const routing = await resolvePluginRoutingForUser(
        userId,
        req.body?.request_type,
        req.body?.extra_data,
      );
      const request = await this.model.create(req, {
        ...req.body,
        plugin_target: routing.plugin_target,
        plugin_target_id: routing.plugin_target_id,
        extra_data: routing.extra_data,
      });
      res.json(request);
    } catch (error) {
      Logger.error('Create request failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create request' });
    }
  }

  async update(req, res) {
    try {
      const existing = await this.model.getById(req, req.params.id);
      // Do not rewrite plugin snapshot after a successful send-to-list
      let routingPatch = {};
      const touchesRouting =
        req.body?.request_type !== undefined || req.body?.extra_data !== undefined;
      if (touchesRouting && !existing.pluginRoutedAt && !existing.pluginRoutedEntityId) {
        const userId = Context.getUserId(req);
        const requestType =
          req.body?.request_type !== undefined ? req.body.request_type : existing.requestType;
        const extraData =
          req.body?.extra_data !== undefined ? req.body.extra_data : existing.extraData;
        const routing = await resolvePluginRoutingForUser(userId, requestType, extraData);
        routingPatch = {
          plugin_target: routing.plugin_target,
          plugin_target_id: routing.plugin_target_id,
          extra_data: routing.extra_data,
        };
      }

      const request = await this.model.update(req, req.params.id, {
        ...req.body,
        ...routingPatch,
      });
      if (request._changeSummary) {
        req.activityLogMetadata = { changeSummary: request._changeSummary };
        delete request._changeSummary;
      }
      res.json(request);
    } catch (error) {
      Logger.error('Update request failed', error, {
        requestId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update request' });
    }
  }

  async delete(req, res) {
    try {
      const request = await this.model.getById(req, req.params.id);
      req.activityLogEntityName = request.title;
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Request deleted successfully' });
    } catch (error) {
      Logger.error('Delete request failed', error, {
        requestId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete request' });
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
      if (!ids.length) return res.json({ ok: true, requested: 0, deleted: 0 });
      if (ids.length > 500) {
        return res
          .status(400)
          .json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }
      const result = await this.model.bulkDelete(req, ids);
      const deleted =
        typeof result?.deletedCount === 'number'
          ? result.deletedCount
          : (result?.deletedIds?.length ?? 0);
      return res.json({
        ok: true,
        requested: ids.length,
        deleted,
        deletedIds: result?.deletedIds || [],
      });
    } catch (error) {
      Logger.error('Bulk delete requests failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Bulk delete failed' });
    }
  }

  async publicGetTeams(req, res) {
    try {
      const pool = req.publicRequestsPool;
      if (!pool) {
        return res.status(503).json({ error: 'Public requests not configured' });
      }
      const teams = await this.model.getPublicTeams(pool);
      res.json(teams);
    } catch (error) {
      Logger.error('Public get teams failed', error);
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  }

  async publicGetBranding(req, res) {
    try {
      const userIdRaw = process.env.PUBLIC_REQUESTS_USER_ID;
      if (!userIdRaw) {
        return res.status(503).json({ error: 'Public requests not configured' });
      }
      const userId = parseInt(userIdRaw, 10);
      if (!Number.isFinite(userId)) {
        return res.status(503).json({ error: 'Public requests not configured' });
      }

      const ServiceManager = require('../../server/core/ServiceManager');
      const TenantContextService = require('../../server/core/services/tenant/TenantContextService');
      const {
        OrganizationService,
      } = require('../../server/core/services/organization/OrganizationService');
      const SettingsModel = require('../settings/model');

      const mainPool = ServiceManager.getMainPool();
      const tenantContext = await new TenantContextService().getTenantContextByUserId(userId);

      let name = '';
      let logoUrl = '';
      let website = '';
      let email = '';
      if (tenantContext?.tenantId) {
        const organizationService = new OrganizationService(mainPool);
        const organization = await organizationService.getOrganization(tenantContext.tenantId);
        name = organization.name || '';
        logoUrl = organization.logoUrl || '';
        website = organization.website || '';
        email = organization.email || '';
      }

      const settingsModel = new SettingsModel(mainPool);
      const requestsSettings = await settingsModel.getCategory(userId, 'requests');
      const requestTypes = coerceRequestTypes(requestsSettings?.requestTypes)
        .map((config) => {
          if (config.plugin === 'garments' && Array.isArray(config.intakeSchema)) {
            config = {
              ...config,
              intakeSchema: garmentsAdapter.filterIntakeSchema(config.intakeSchema),
            };
          }
          return toPublicRequestType(config);
        })
        .filter(Boolean);

      res.json({
        name,
        logoUrl,
        website,
        email,
        requestTypes,
      });
    } catch (error) {
      Logger.error('Public get branding failed', error);
      res.status(500).json({ error: 'Failed to fetch branding' });
    }
  }

  async publicSubmit(req, res) {
    try {
      const pool = req.publicRequestsPool;
      if (!pool) {
        return res.status(503).json({ error: 'Public requests not configured' });
      }
      const {
        title,
        description,
        request_type,
        team_id,
        submitter_name,
        submitter_email,
        extra_data,
      } = req.body;

      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'Title is required' });
      }

      // Tenant ownership for public inserts (NOT NULL on requests.user_id).
      // Authenticated create gets user_id via Database adapter; public pool does not.
      const userIdRaw = process.env.PUBLIC_REQUESTS_USER_ID;
      const userId = userIdRaw ? parseInt(userIdRaw, 10) : NaN;
      if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(503).json({ error: 'Public requests not configured' });
      }

      // Resolve type config server-side; ignore any client-supplied plugin_target*
      let plugin_target = null;
      let plugin_target_id = null;
      let sanitizedExtra = null;

      const ServiceManager = require('../../server/core/ServiceManager');
      const SettingsModel = require('../settings/model');
      const settingsModel = new SettingsModel(ServiceManager.getMainPool());
      const requestsSettings = await settingsModel.getCategory(userId, 'requests');
      const typeConfig = findRequestTypeConfig(requestsSettings?.requestTypes, request_type);

      if (typeConfig?.plugin) {
        const adapter = getAdapter(typeConfig.plugin);
        if (!adapter) {
          throw new AppError(
            `Unsupported plugin target: ${typeConfig.plugin}`,
            400,
            AppError.CODES.VALIDATION_ERROR,
          );
        }
        const intakeSchema = garmentsAdapter.filterIntakeSchema(typeConfig.intakeSchema);
        sanitizedExtra = adapter.validateExtraData(extra_data, intakeSchema);
        plugin_target = typeConfig.plugin;
        plugin_target_id = typeConfig.targetListId || null;
        if (!plugin_target_id) {
          throw new AppError(
            'Request type is missing target list configuration',
            400,
            AppError.CODES.VALIDATION_ERROR,
          );
        }
      }

      await this.model.createPublic(pool, {
        user_id: userId,
        title,
        description,
        request_type,
        team_id,
        submitter_name,
        submitter_email,
        plugin_target,
        plugin_target_id,
        extra_data: sanitizedExtra,
      });

      // Anonymous clients must not receive transformRow / routing internals
      res.json({ success: true });
    } catch (error) {
      Logger.error('Public submit request failed', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to submit request' });
    }
  }

  async sendToList(req, res) {
    try {
      const request = await this.model.getById(req, req.params.id);

      if (request.pluginRoutedAt || request.pluginRoutedEntityId) {
        throw new AppError('Request already routed', 409, AppError.CODES.CONFLICT);
      }

      if (!request.pluginTarget) {
        throw new AppError('Request has no plugin target', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const adapter = getAdapter(request.pluginTarget);
      if (!adapter) {
        throw new AppError(
          `Unsupported plugin target: ${request.pluginTarget}`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      // Garments must be available to the current user/tenant
      if (request.pluginTarget === 'garments') {
        const isSuperuser = req.session?.user?.role === 'superuser';
        if (!isSuperuser && !Context.hasPluginAccess(req, 'garments')) {
          throw new AppError('Access denied to garments plugin', 403, AppError.CODES.FORBIDDEN);
        }
      }

      const { person, entityId } = await adapter.createFromRequest(req, {
        targetListId: request.pluginTargetId,
        extraData: request.extraData,
        intakeSchema: null,
      });

      const updated = await this.model.markPluginRouted(req, request.id, { entityId });
      res.json({ request: updated, person });
    } catch (error) {
      Logger.error('Send request to list failed', error, {
        requestId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to send request to list' });
    }
  }
}

module.exports = RequestController;
