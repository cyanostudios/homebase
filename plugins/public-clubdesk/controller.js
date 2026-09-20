const { Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class PublicClubdeskController {
  constructor(model) {
    this.model = model;
  }

  getPoolContext(req) {
    const pool = req.publicClubdeskPool;
    const ownerUserId = req.publicClubdeskOwnerUserId;
    if (!pool || !ownerUserId) {
      return null;
    }
    return { pool, ownerUserId };
  }

  async listGuides(req, res) {
    try {
      const ctx = this.getPoolContext(req);
      if (!ctx) {
        return res.status(500).json({ error: 'Public clubdesk service not configured' });
      }

      const [guides, categoryOrder] = await Promise.all([
        this.model.listPublishedGuides(ctx.pool, ctx.ownerUserId),
        this.model.listGuideCategoryOrder(ctx.pool, ctx.ownerUserId),
      ]);
      return res.json({ guides, categoryOrder });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('List public clubdesk guides failed', error);
      return res.status(500).json({ error: 'Failed to fetch guides' });
    }
  }

  async getGuide(req, res) {
    try {
      const ctx = this.getPoolContext(req);
      if (!ctx) {
        return res.status(500).json({ error: 'Public clubdesk service not configured' });
      }

      const item = await this.model.getPublishedGuideBySlugOrId(
        ctx.pool,
        ctx.ownerUserId,
        req.params.slugOrId,
      );
      if (!item) {
        return res.status(404).json({ error: 'Guide not found' });
      }
      return res.json(item);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('Get public clubdesk guide failed', error, {
        slugOrId: req.params.slugOrId,
      });
      return res.status(500).json({ error: 'Failed to fetch guide' });
    }
  }

  async listPriceLists(req, res) {
    try {
      const ctx = this.getPoolContext(req);
      if (!ctx) {
        return res.status(500).json({ error: 'Public clubdesk service not configured' });
      }

      const priceLists = await this.model.listPublishedPriceLists(ctx.pool, ctx.ownerUserId);
      return res.json({ priceLists });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('List public clubdesk price lists failed', error);
      return res.status(500).json({ error: 'Failed to fetch price lists' });
    }
  }

  async getPriceList(req, res) {
    try {
      const ctx = this.getPoolContext(req);
      if (!ctx) {
        return res.status(500).json({ error: 'Public clubdesk service not configured' });
      }

      const item = await this.model.getPublishedPriceListBySlugOrId(
        ctx.pool,
        ctx.ownerUserId,
        req.params.slugOrId,
      );
      if (!item) {
        return res.status(404).json({ error: 'Price list not found' });
      }
      return res.json(item);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('Get public clubdesk price list failed', error, {
        slugOrId: req.params.slugOrId,
      });
      return res.status(500).json({ error: 'Failed to fetch price list' });
    }
  }

  async getSiteContent(req, res) {
    try {
      const ctx = this.getPoolContext(req);
      if (!ctx) {
        return res.status(500).json({ error: 'Public clubdesk service not configured' });
      }

      const siteContent = await this.model.getPublicSiteContent(ctx.pool, ctx.ownerUserId);
      return res.json(siteContent);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('Get public clubdesk site content failed', error);
      return res.status(500).json({ error: 'Failed to fetch site content' });
    }
  }

  /**
   * Org name + logo from main-DB tenants.organization (Settings → Profile).
   * Does not require the tenant pool.
   */
  async getBranding(req, res) {
    try {
      let ownerUserId = req.publicClubdeskOwnerUserId;
      if (!ownerUserId) {
        const { resolvePublicClubdeskUserId } = require('./resolveOwner');
        ownerUserId = await resolvePublicClubdeskUserId();
      }
      if (!ownerUserId) {
        return res.status(503).json({ error: 'Public clubdesk not configured' });
      }

      const ServiceManager = require('../../server/core/ServiceManager');
      const TenantContextService = require('../../server/core/services/tenant/TenantContextService');
      const {
        OrganizationService,
      } = require('../../server/core/services/organization/OrganizationService');

      const mainPool = ServiceManager.getMainPool();
      if (!mainPool) {
        return res.status(503).json({ error: 'Public clubdesk not configured' });
      }

      const tenantContext = await new TenantContextService().getTenantContextByUserId(ownerUserId);
      let name = '';
      let logoUrl = '';
      if (tenantContext?.tenantId) {
        const organizationService = new OrganizationService(mainPool);
        const organization = await organizationService.getOrganization(tenantContext.tenantId);
        name = organization.name || '';
        const rawLogo = String(organization.logoUrl || '').trim();
        logoUrl = /^https?:\/\//i.test(rawLogo) ? rawLogo : '';
      }

      return res.json({ name, logoUrl });
    } catch (error) {
      Logger.error('Get public clubdesk branding failed', error);
      return res.status(500).json({ error: 'Failed to fetch branding' });
    }
  }
}

module.exports = PublicClubdeskController;
