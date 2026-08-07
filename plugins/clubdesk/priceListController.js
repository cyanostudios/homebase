// plugins/clubdesk/priceListController.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class PriceListController {
  constructor(model) {
    this.model = model;
  }

  mapUniqueViolation(error) {
    const code = error?.code || error?.details?.errorCode;
    if (code !== '23505') return null;
    const detail = String(error.detail || error?.details?.errorDetail || '');
    const m = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
    const cols = m ? m[1].split(',').map((s) => s.trim()) : [];
    const val = m ? m[2] : undefined;
    let field = cols[1] || cols[0] || 'general';
    if (field === 'lower' || /slug/i.test(detail) || cols.some((c) => /slug/i.test(c))) {
      field = 'slug';
    }
    if (/title/i.test(detail) || cols.some((c) => /title/i.test(c))) {
      field = 'title';
    }
    if (/name/i.test(detail) || cols.some((c) => /name/i.test(c))) {
      field = 'name';
    }
    if (/sequence_order/i.test(detail) || cols.some((c) => /sequence/i.test(c))) {
      field = 'sequenceOrder';
    }
    return {
      field,
      message: val
        ? `Unique value "${val}" already exists for ${field}`
        : 'Unique constraint violated',
    };
  }

  /**
   * Field-level validation → { errors: [{ field, message }] } (same shape as unique violations).
   * Also includes details[] (path/msg) so the client API mapper can surface field errors.
   */
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
      Logger.error('Get price lists failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch price lists' });
    }
  }

  async getById(req, res) {
    try {
      const item = await this.model.getById(req, req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Price list not found', code: 'NOT_FOUND' });
      }
      res.json(item);
    } catch (error) {
      Logger.error('Get price list failed', error, {
        priceListId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch price list' });
    }
  }

  async create(req, res) {
    try {
      const item = await this.model.create(req, req.body);
      res.json(item);
    } catch (error) {
      Logger.error('Create price list failed', error, { userId: Context.getUserId(req) });
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to create price list' });
    }
  }

  async update(req, res) {
    try {
      const item = await this.model.update(req, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      Logger.error('Update price list failed', error, {
        priceListId: req.params.id,
        userId: Context.getUserId(req),
      });
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to update price list' });
    }
  }

  async reorder(req, res) {
    try {
      const orderedIds = req.body?.orderedIds;
      const items = await this.model.reorder(req, orderedIds);
      res.json(items);
    } catch (error) {
      Logger.error('Reorder price lists failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to reorder price lists' });
    }
  }

  async listCategories(req, res) {
    try {
      const items = await this.model.listCategories(req, req.params.id);
      res.json(items);
    } catch (error) {
      Logger.error('List price list categories failed', error, {
        priceListId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to list categories' });
    }
  }

  async createCategory(req, res) {
    try {
      const item = await this.model.createCategory(req, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      Logger.error('Create price list category failed', error, {
        priceListId: req.params.id,
        userId: Context.getUserId(req),
      });
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to create category' });
    }
  }

  async reorderCategories(req, res) {
    try {
      const items = await this.model.reorderCategories(req, req.params.id, req.body?.orderedIds);
      res.json(items);
    } catch (error) {
      Logger.error('Reorder price list categories failed', error, {
        priceListId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to reorder categories' });
    }
  }

  async deleteCategory(req, res) {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const options = Object.prototype.hasOwnProperty.call(body, 'moveToCategory')
        ? { moveToCategory: body.moveToCategory }
        : {};
      const result = await this.model.deleteCategory(
        req,
        req.params.id,
        req.params.categoryId,
        options,
      );
      res.json({ message: 'Category deleted successfully', ...result });
    } catch (error) {
      Logger.error('Delete price list category failed', error, {
        priceListId: req.params.id,
        categoryId: req.params.categoryId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to delete category' });
    }
  }

  async reorderItems(req, res) {
    try {
      const category =
        req.body?.category === undefined
          ? null
          : req.body.category === null || req.body.category === ''
            ? null
            : String(req.body.category);
      const item = await this.model.reorderItemsInCategory(
        req,
        req.params.id,
        category,
        req.body?.orderedIds,
      );
      res.json(item);
    } catch (error) {
      Logger.error('Reorder price list items failed', error, {
        priceListId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to reorder items' });
    }
  }

  async delete(req, res) {
    try {
      const result = await this.model.delete(req, req.params.id);

      req.activityLogEntityName = result.backup?.title || 'Unknown Price list';
      req.activityLogMetadata = {
        backup: result.backup,
      };

      res.json({ message: 'Price list deleted successfully' });
    } catch (error) {
      Logger.error('Delete price list failed', error, {
        priceListId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to delete price list' });
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

      req.activityLogEntityName = `${deleted} price list`;
      req.activityLogMetadata = {
        count: deleted,
        ids: result.deletedIds || ids,
        backups: result.backups || [],
      };

      return res.json({
        ok: true,
        requested: ids.length,
        deleted,
        deletedIds: result?.deletedIds || [],
      });
    } catch (error) {
      Logger.error('Bulk delete price lists failed', error, {
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      return res.status(500).json({ error: 'Bulk delete failed' });
    }
  }
}

module.exports = PriceListController;
