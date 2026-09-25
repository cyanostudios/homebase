// plugins/clubdesk/inventoryController.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class InventoryController {
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
    if (/article_name/i.test(detail) || cols.some((c) => /article/i.test(c))) {
      field = 'articleName';
    }
    if (/brand/i.test(detail) || cols.some((c) => /brand/i.test(c))) {
      field = 'articleName';
    }
    if (/audience|color|size/i.test(detail)) {
      field = 'variants';
    }
    return {
      field,
      message: val
        ? `Unique value "${val}" already exists for ${field}`
        : field === 'articleName'
          ? 'An inventory item with this article and brand already exists'
          : 'Unique constraint violated',
    };
  }

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
      Logger.error('Get clubdesk inventory failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to fetch inventory' });
    }
  }

  async getById(req, res) {
    try {
      const item = await this.model.getById(req, req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Inventory item not found', code: 'NOT_FOUND' });
      }
      res.json(item);
    } catch (error) {
      Logger.error('Get clubdesk inventory item failed', error, {
        itemId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to fetch inventory item' });
    }
  }

  async create(req, res) {
    try {
      const item = await this.model.create(req, req.body);
      res.json(item);
    } catch (error) {
      Logger.error('Create clubdesk inventory item failed', error, {
        userId: Context.getUserId(req),
      });
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to create inventory item' });
    }
  }

  async update(req, res) {
    try {
      const item = await this.model.update(req, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      Logger.error('Update clubdesk inventory item failed', error, {
        itemId: req.params.id,
        userId: Context.getUserId(req),
      });
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to update inventory item' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ deleted: true });
    } catch (error) {
      Logger.error('Delete clubdesk inventory item failed', error, {
        itemId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to delete inventory item' });
    }
  }

  async importItems(req, res) {
    try {
      const result = await this.model.importItems(req, req.body?.items);
      res.json(result);
    } catch (error) {
      Logger.error('Import clubdesk inventory failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to import inventory' });
    }
  }

  async createVariant(req, res) {
    try {
      const variant = await this.model.createVariant(req, req.params.id, req.body);
      res.json(variant);
    } catch (error) {
      Logger.error('Create clubdesk inventory variant failed', error, {
        itemId: req.params.id,
        userId: Context.getUserId(req),
      });
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to create variant' });
    }
  }

  async updateVariant(req, res) {
    try {
      const variant = await this.model.updateVariant(
        req,
        req.params.id,
        req.params.variantId,
        req.body,
      );
      res.json(variant);
    } catch (error) {
      Logger.error('Update clubdesk inventory variant failed', error, {
        itemId: req.params.id,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to update variant' });
    }
  }

  async updateVariantQuantity(req, res) {
    try {
      const variant = await this.model.updateVariantQuantity(
        req,
        req.params.id,
        req.params.variantId,
        req.body?.quantity,
      );
      res.json(variant);
    } catch (error) {
      Logger.error('Update clubdesk inventory variant quantity failed', error, {
        itemId: req.params.id,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to update variant quantity' });
    }
  }

  async deleteVariant(req, res) {
    try {
      await this.model.deleteVariant(req, req.params.id, req.params.variantId);
      res.json({ deleted: true });
    } catch (error) {
      Logger.error('Delete clubdesk inventory variant failed', error, {
        itemId: req.params.id,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to delete variant' });
    }
  }
}

module.exports = InventoryController;
