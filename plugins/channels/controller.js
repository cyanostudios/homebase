// plugins/channels/controller.js
// Channels Controller — read-only for MVP (list channel summaries).
// Keeps template structure; non-GET ops return 501 (not implemented).

class ChannelsController {
  constructor(model) {
    this.model = model;
  }

  // Optional helper kept from template (not used in read-only MVP)
  mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;
    const detail = String(error.detail || '');
    const m = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
    const cols = m ? m[1].split(',').map(s => s.trim()) : [];
    const val = m ? m[2] : undefined;
    const field = cols[1] || cols[0] || 'general';
    return {
      field,
      message: val ? `Unique value "${val}" already exists for ${field}` : 'Unique constraint violated',
    };
  }

  // GET /api/channels
  async getAll(req, res) {
    try {
      const items = await this.model.getAll(req.session.user.id);
      res.json(items);
    } catch (error) {
      console.error('Channels getAll error:', error);
      res.status(500).json({ error: 'Failed to fetch channels' });
    }
  }

  // POST/PUT/DELETE — not part of MVP
  async create(_req, res) { res.status(501).json({ error: 'Not implemented' }); }
  async update(_req, res) { res.status(501).json({ error: 'Not implemented' }); }
  async delete(_req, res) { res.status(501).json({ error: 'Not implemented' }); }
}

module.exports = ChannelsController;
