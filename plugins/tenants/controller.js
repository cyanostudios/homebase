// plugins/tenants/controller.js
class TenantsController {
  /**
   * @param {import('./model')} model
   * @param {{ info?: Function, warn?: Function, error?: Function }} logger
   */
  constructor(model, logger) {
    this.model = model;
    this.logger = logger;
  }

  list = async (_req, res) => {
    try {
      const tenants = await this.model.listTenants();
      res.json({ tenants });
    } catch (err) {
      this.logger?.error?.('tenants list failed', err);
      res.status(500).json({ error: 'Failed to list tenants' });
    }
  };

  get = async (req, res) => {
    try {
      const tenant = await this.model.getTenant(req.params.tenantId);
      res.json({ tenant });
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) {
        this.logger?.error?.('tenants get failed', err);
      }
      res.status(status).json({ error: err.message || 'Failed to get tenant' });
    }
  };

  updatePlugins = async (req, res) => {
    try {
      const enable = req.body?.enable;
      const disable = req.body?.disable;
      const tenant = await this.model.updatePlugins(req.params.tenantId, {
        enable,
        disable,
        grantedByUserId: req.session.user.id,
      });
      this.logger?.info?.('Platform tenants admin updated plugins', {
        actorUserId: req.session.user.id,
        actorEmail: req.session.user.email,
        tenantId: tenant.id,
        enable: enable || [],
        disable: disable || [],
      });
      res.json({ tenant });
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) {
        this.logger?.error?.('tenants updatePlugins failed', err);
      }
      res.status(status).json({ error: err.message || 'Failed to update plugins' });
    }
  };
}

module.exports = TenantsController;
