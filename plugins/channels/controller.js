// plugins/channels/controller.js
// Channels Controller — read-only list + safe per-product enable/disable,
// plus GET /map to read the current mapping for a given product/channel.

class ChannelsController {
  constructor(model) {
    this.model = model;
  }

  // Optional helper kept from template (not used by toggle/read)
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

  // GET /api/channels — list summaries for the current user
  async getAll(req, res) {
    try {
      const items = await this.model.getAll(req.session.user.id);
      res.json(items);
    } catch (error) {
      console.error('Channels getAll error:', error);
      res.status(500).json({ error: 'Failed to fetch channels' });
    }
  }

  /**
   * GET /api/channels/map?productId=...&channel=...
   * Returns the single channel mapping row (or null) for the given product/channel.
   */
  async getProductMap(req, res) {
    try {
      const userId = req.session.user.id;
      const productId = String(req.query?.productId || '').trim();
      const channel = String(req.query?.channel || '').trim();

      if (!productId || !channel) {
        return res.status(400).json({
          error: 'Missing required query params',
          details: 'Expected: ?productId=<id>&channel=<key>',
        });
      }

      const row = await this.model.getProductMapRow(userId, productId, channel);
      res.json({ ok: true, row: row || null });
    } catch (error) {
      console.error('Channels getProductMap error:', error);
      res.status(500).json({ error: 'Failed to fetch channel mapping' });
    }
  }

  /**
   * PUT /api/channels/map
   * Body: { productId: string, channel: string, enabled: boolean }
   * Sets the enabled flag for (user, product, channel) using a safe SELECT→INSERT/UPDATE pattern.
   * Returns the updated row and the refreshed summary for that channel.
   */
  async setProductEnabled(req, res) {
    try {
      const userId = req.session.user.id;
      const { productId, channel, enabled } = req.body || {};

      if (!productId || !channel || typeof enabled !== 'boolean') {
        return res.status(400).json({
          error: 'Missing or invalid fields',
          details: 'Expected body: { productId: string, channel: string, enabled: boolean }',
        });
      }

      const row = await this.model.setProductEnabled(userId, { productId, channel, enabled });

      // also return the refreshed single-channel summary so UI can update counts
      const summaries = await this.model.getAll(userId);
      const summary =
        summaries.find(s => String(s.channel).toLowerCase() === String(channel).toLowerCase()) || null;

      res.json({ ok: true, row, summary });
    } catch (error) {
      console.error('Channels setProductEnabled error:', error);
      res.status(500).json({ error: 'Failed to update channel mapping' });
    }
  }

  // POST/other PUT/DELETE — not part of MVP
  async create(_req, res) { res.status(501).json({ error: 'Not implemented' }); }
  async update(_req, res) { res.status(501).json({ error: 'Not implemented' }); }
  async delete(_req, res) { res.status(501).json({ error: 'Not implemented' }); }
}

module.exports = ChannelsController;
