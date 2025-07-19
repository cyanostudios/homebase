// plugins/estimates/controller.js
class EstimateController {
    constructor(model) {
      this.model = model;
    }
  
    async getAll(req, res) {
      try {
        const estimates = await this.model.getAll(req.session.user.id);
        res.json(estimates);
      } catch (error) {
        console.error('Get estimates error:', error);
        res.status(500).json({ error: 'Failed to fetch estimates' });
      }
    }
  
    async create(req, res) {
      try {
        const estimate = await this.model.create(req.session.user.id, req.body);
        res.json(estimate);
      } catch (error) {
        console.error('Create estimate error:', error);
        res.status(500).json({ error: 'Failed to create estimate' });
      }
    }
  
    async update(req, res) {
      try {
        const estimate = await this.model.update(
          req.session.user.id,
          req.params.id,
          req.body
        );
        res.json(estimate);
      } catch (error) {
        console.error('Update estimate error:', error);
        if (error.message === 'Estimate not found') {
          res.status(404).json({ error: 'Estimate not found' });
        } else {
          res.status(500).json({ error: 'Failed to update estimate' });
        }
      }
    }
  
    async delete(req, res) {
      try {
        await this.model.delete(req.session.user.id, req.params.id);
        res.json({ message: 'Estimate deleted successfully' });
      } catch (error) {
        console.error('Delete estimate error:', error);
        if (error.message === 'Estimate not found') {
          res.status(404).json({ error: 'Estimate not found' });
        } else {
          res.status(500).json({ error: 'Failed to delete estimate' });
        }
      }
    }
  
    async getNextNumber(req, res) {
      try {
        const nextNumber = await this.model.getNextEstimateNumber(req.session.user.id);
        res.json({ estimateNumber: nextNumber });
      } catch (error) {
        console.error('Get next estimate number error:', error);
        res.status(500).json({ error: 'Failed to get next estimate number' });
      }
    }
  }
  
  module.exports = EstimateController;