// plugins/site-audits/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const runAuditService = require('./services/runAudit');

class SiteAuditController {
  constructor(model) {
    this.model = model;
  }

  mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;
    const detail = String(error.detail || '');
    const m = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
    const cols = m ? m[1].split(',').map((s) => s.trim()) : [];
    const val = m ? m[2] : undefined;
    const field = cols[1] || cols[0] || 'general';
    return {
      field,
      message: val
        ? `Unique value "${val}" already exists for ${field}`
        : 'Unique constraint violated',
    };
  }

  /** Field-level validation -> { errors: [{ field, message }] } (consistent with other plugins). */
  sendAppError(res, error) {
    if (
      (error.code === AppError.CODES.VALIDATION_ERROR || error.code === AppError.CODES.CONFLICT) &&
      Array.isArray(error.details) &&
      error.details.length > 0 &&
      error.details[0]?.field
    ) {
      const errors = error.details.map((d) => ({
        field: d.field,
        message: d.message || error.message,
      }));
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        errors,
        details: errors.map((e) => ({
          path: e.field,
          msg: e.message,
          field: e.field,
          message: e.message,
        })),
      });
    }
    return res.status(error.statusCode).json(error.toJSON());
  }

  async getAll(req, res) {
    try {
      const items = await this.model.getAll(req);
      res.json(items);
    } catch (error) {
      Logger.error('Get site audits failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch site audits' });
    }
  }

  async create(req, res) {
    try {
      const item = await this.model.create(req, req.body);
      req.activityLogEntityName = item.name || 'Site audit';
      res.json(item);
    } catch (error) {
      Logger.error('Create site audit failed', error, { userId: Context.getUserId(req) });
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to create site audit' });
    }
  }

  async update(req, res) {
    try {
      const item = await this.model.update(req, req.params.id, req.body);
      req.activityLogEntityName = item.name || 'Site audit';
      res.json(item);
    } catch (error) {
      Logger.error('Update site audit failed', error, {
        id: req.params.id,
        userId: Context.getUserId(req),
      });
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to update site audit' });
    }
  }

  async delete(req, res) {
    try {
      const result = await this.model.delete(req, req.params.id);
      req.activityLogEntityName = result.backup?.name || 'Site audit';
      req.activityLogMetadata = { backup: result.backup };
      res.json({ message: 'Site audit deleted successfully' });
    } catch (error) {
      Logger.error('Delete site audit failed', error, {
        id: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to delete site audit' });
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

      const result = await this.model.bulkDelete(req, ids);
      const deleted =
        typeof result?.deletedCount === 'number'
          ? result.deletedCount
          : Array.isArray(result?.deletedIds)
            ? result.deletedIds.length
            : 0;

      req.activityLogEntityName = `${deleted} site audits`;
      req.activityLogMetadata = {
        count: deleted,
        ids: result.deletedIds || ids,
        backups: result.backups || [],
      };

      res.json({ ok: true, requested: ids.length, deleted, deletedIds: result?.deletedIds || [] });
    } catch (error) {
      Logger.error('Bulk delete site audits failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Bulk delete failed' });
    }
  }

  async startRun(req, res) {
    // activityLog maps every POST to "create". This route starts a run (202), it does not
    // create a site, so skip the automatic log instead of recording "Created site".
    req.skipActivityLog = true;
    try {
      const mode = req.body && req.body.mode === 'quick' ? 'quick' : 'full';
      const result = await runAuditService.startRun(this.model, req, req.params.id, { mode });
      req.activityLogEntityName = result.site?.name || 'Site audit';
      res.status(202).json(result);
    } catch (error) {
      Logger.error('Start site audit run failed', error, {
        id: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to start audit run' });
    }
  }

  async listRuns(req, res) {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const runs = await this.model.getRunsForSite(req, req.params.id, limit);
      res.json(runs);
    } catch (error) {
      Logger.error('List site audit runs failed', error, {
        id: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch audit runs' });
    }
  }

  async getRun(req, res) {
    try {
      const run = await this.model.getRunById(req, req.params.id, req.params.runId);
      res.json(run);
    } catch (error) {
      Logger.error('Get site audit run failed', error, {
        id: req.params.id,
        runId: req.params.runId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch audit run' });
    }
  }

  async cancelRun(req, res) {
    req.skipActivityLog = true;
    try {
      const result = await runAuditService.cancelRun(
        this.model,
        req,
        req.params.id,
        req.params.runId,
      );
      res.status(200).json(result);
    } catch (error) {
      Logger.error('Cancel site audit run failed', error, {
        id: req.params.id,
        runId: req.params.runId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to cancel audit run' });
    }
  }
}

module.exports = SiteAuditController;
