// templates/plugin-backend-template/controller.js
class TemplateController {
  constructor(model) {
    this.model = model;
  }

  // Optional helper: map PG unique violation (23505) -> 409 with { errors: [{ field, message }] }
  mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;
    const constraint = String(error.constraint || '').toLowerCase();
    const detail = String(error.detail || '');
    const m = detail.match(/\(([^)]+)\)=\(([^)]+)\)/); // e.g. (user_id, sku)=(1, ABC)
    const cols = m ? m[1].split(',').map(s => s.trim()) : [];
    const val = m ? m[2] : undefined;
    const field = cols[1] || cols[0] || 'general'; // prefer the non-user_id column when present
    return {
      field,
      message: val ? `Unique value "${val}" already exists for ${field}` : 'Unique constraint violated'
    };
  }

  async getAll(req, res) {
    try {
      const items = await this.model.getAll(req.session.user.id);
      res.json(items);
    } catch (error) {
      console.error('Get items error:', error);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  }

  async create(req, res) {
    try {
      const item = await this.model.create(req.session.user.id, req.body);
      res.json(item);
    } catch (error) {
      console.error('Create item error:', error);
      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      res.status(500).json({ error: 'Failed to create item' });
    }
  }

  async update(req, res) {
    try {
      const item = await this.model.update(req.session.user.id, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      console.error('Update item error:', error);
      if (/not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Item not found' });
      }
      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      res.status(500).json({ error: 'Failed to update item' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req.session.user.id, req.params.id);
      res.json({ message: 'Item deleted successfully' });
    } catch (error) {
      console.error('Delete item error:', error);
      if (/not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.status(500).json({ error: 'Failed to delete item' });
    }
  }
}

module.exports = TemplateController;
