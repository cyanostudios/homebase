const { Logger } = require('@homebase/core');

class PublicCupsController {
  constructor(model) {
    this.model = model;
  }

  async getCups(req, res) {
    try {
      const pool = req.publicCupsPool;
      if (!pool) {
        return res.status(500).json({ error: 'Public cups service not configured' });
      }
      const cups = await this.model.getPublicCups(pool);
      return res.json({ cups });
    } catch (error) {
      Logger.error('Get public cups failed', error);
      return res.status(500).json({ error: 'Failed to fetch cups' });
    }
  }
}

module.exports = PublicCupsController;
