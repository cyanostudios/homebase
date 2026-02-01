// plugins/products/controller.js

class ProductController {
  constructor(model) {
    this.model = model;
  }

  // ---- Helpers ----
  getUserId(req) {
    const id = req?.session?.user?.id;
    if (id == null) throw new Error('Not authenticated');
    return id; // i din setup verkar detta vara numeriskt (int/bigint)
  }

  // Helper: map PG 23505 unique violation to { field, message }
  mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;

    const constraint = String(error.constraint || '').toLowerCase();
    const detail = String(error.detail || '');
    const match = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
    const cols = match ? match[1].split(',').map((s) => s.trim()) : [];
    const val = match ? match[2] : undefined;

    const hasCol = (name) => constraint.includes(name) || cols.includes(name);

    if (hasCol('product_number')) {
      return {
        field: 'productNumber',
        message: val ? `Product number "${val}" already exists` : 'Product number already exists',
      };
    }

    if (hasCol('sku')) {
      return {
        field: 'sku',
        message: val ? `SKU "${val}" already exists` : 'SKU already exists',
      };
    }

    return { field: 'general', message: 'Unique constraint violated' };
  }

  requireSku(req, res) {
    const data = req.body || {};
    const sku = String(data.sku || '').trim();
    if (!sku) {
      res.status(400).json({ error: 'SKU is required' });
      return null;
    }
    return data;
  }

  // ---- CRUD ----

  async getAll(req, res) {
    try {
      const userId = this.getUserId(req);
      const products = await this.model.getAll(userId);
      return res.json(products);
    } catch (error) {
      console.error('Get products error:', error);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }
  }

  async create(req, res) {
    try {
      const userId = this.getUserId(req);
      const data = this.requireSku(req, res);
      if (!data) return;

      const product = await this.model.create(userId, data);
      return res.json(product);
    } catch (error) {
      console.error('Create product error:', error);
      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      return res.status(500).json({ error: 'Failed to create product' });
    }
  }

  async update(req, res) {
    try {
      const userId = this.getUserId(req);
      const data = this.requireSku(req, res);
      if (!data) return;

      const product = await this.model.update(userId, req.params.id, data);
      return res.json(product);
    } catch (error) {
      console.error('Update product error:', error);
      if (/not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Product not found' });
      }
      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      return res.status(500).json({ error: 'Failed to update product' });
    }
  }

  async delete(req, res) {
    try {
      const userId = this.getUserId(req);
      await this.model.delete(userId, req.params.id);
      return res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      console.error('Delete product error:', error);
      if (/not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Product not found' });
      }
      return res.status(500).json({ error: 'Failed to delete product' });
    }
  }

  // ---- Bulk delete ----
  // DELETE /api/products/batch
  // body: { ids: string[] }
  async bulkDelete(req, res) {
    try {
      const userId = this.getUserId(req);

      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res.status(400).json({ error: 'ids[] required (must be an array)' });
      }

      const ids = Array.from(
        new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)),
      );

      if (!ids.length) {
        return res.json({ ok: true, requested: 0, deleted: 0 });
      }

      if (ids.length > 500) {
        return res.status(400).json({ error: 'Too many ids (max 500 per request)' });
      }

      const result = await this.model.bulkDelete(userId, ids);

      const deleted =
        typeof result?.deletedCount === 'number'
          ? result.deletedCount
          : Array.isArray(result?.deletedIds)
            ? result.deletedIds.length
            : 0;

      return res.json({
        ok: true,
        requested: ids.length,
        deleted,
        deletedIds: result?.deletedIds || [],
      });
    } catch (error) {
      console.error('Bulk delete error:', error);
      return res.status(500).json({ error: 'Bulk delete failed' });
    }
  }
}

module.exports = ProductController;
