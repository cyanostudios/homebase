// templates/plugin-backend-template/controller.js

class TemplateController {
  constructor(model) {
    this.model = model;
  }

  // Optional helper: map PG unique violation (23505) -> 409 with { errors: [{ field, message }] }
  mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;
    const detail = String(error.detail || '');
    const m = detail.match(/\(([^)]+)\)=\(([^)]+)\)/); // e.g. (user_id, sku)=(1, ABC)
    const cols = m ? m[1].split(',').map((s) => s.trim()) : [];
    const val = m ? m[2] : undefined;
    const field = cols[1] || cols[0] || 'general'; // prefer the non-user_id column when present
    return {
      field,
      message: val
        ? `Unique value "${val}" already exists for ${field}`
        : 'Unique constraint violated',
    };
  }

  async getAll(req, res, next) {
    try {
      const items = await this.model.getAll(req);
      res.json(items);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const item = await this.model.create(req, req.body);
      res.json(item);
    } catch (error) {
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const item = await this.model.update(req, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TemplateController;
