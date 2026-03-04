// plugins/channels/controller.js
// Channels Controller — read-only list + safe per-product enable/disable,
// plus GET /map to read the current mapping for a given product/channel.

const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class ChannelsController {
  constructor(model) {
    this.model = model;
  }

  // GET /api/channels — list summaries for the current user
  async getAll(req, res) {
    try {
      const items = await this.model.getAll(req);
      res.json(items);
    } catch (error) {
      Logger.error('Channels getAll error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to fetch channels' });
    }
  }

  /**
   * GET /api/channels/product-targets?productId=...
   * Returns list of { channel, channelInstanceId } where this product is published (for sync-on-save).
   */
  async getProductTargets(req, res) {
    try {
      const productId = String(req.query?.productId || '').trim();
      if (!productId) {
        return res.status(400).json({ error: 'productId is required', code: 'VALIDATION_ERROR' });
      }
      const targets = await this.model.getProductChannelTargets(req, productId);
      return res.json({ ok: true, targets });
    } catch (error) {
      Logger.error('Channels getProductTargets error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch product channel targets' });
    }
  }

  /**
   * GET /api/channels/map?productId=...&channel=...
   * Returns the single channel mapping row (or null) for the given product/channel.
   */
  async getProductMap(req, res) {
    try {
      const productId = String(req.query?.productId || '').trim();
      const channel = String(req.query?.channel || '').trim();

      if (!productId || !channel) {
        return res.status(400).json({
          error: 'Missing required query params',
          code: 'VALIDATION_ERROR',
          details: 'Expected: ?productId=<id>&channel=<key>',
        });
      }

      const row = await this.model.getProductMapRow(req, productId, channel);
      res.json({ ok: true, row: row || null });
    } catch (error) {
      Logger.error('Channels getProductMap error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to fetch channel mapping' });
    }
  }

  /**
   * PUT /api/channels/map
   * Body: { productId: string, channel: string, enabled: boolean, channelInstanceId?: number }
   * Sets the enabled flag for (user, product, channel[, channelInstanceId]) using a safe SELECT→INSERT/UPDATE pattern.
   * Returns the updated row and the refreshed summary for that channel.
   */
  async setProductEnabled(req, res) {
    try {
      const { productId, channel, enabled, channelInstanceId } = req.body || {};

      if (!productId || !channel || typeof enabled !== 'boolean') {
        return res.status(400).json({
          error: 'Missing or invalid fields',
          code: 'VALIDATION_ERROR',
          details: 'Expected body: { productId: string, channel: string, enabled: boolean }',
        });
      }

      const row = await this.model.setProductEnabled(req, {
        productId,
        channel,
        enabled,
        channelInstanceId,
      });

      // also return the refreshed single-channel summary so UI can update counts
      const summaries = await this.model.getAll(req);
      const summary =
        summaries.find((s) => String(s.channel).toLowerCase() === String(channel).toLowerCase()) ||
        null;

      res.json({ ok: true, row, summary });
    } catch (error) {
      Logger.error('Channels setProductEnabled error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to update channel mapping' });
    }
  }

  /**
   * PUT /api/channels/map/bulk
   * Body: { productId: string, updates: Array<{ channel: string, channelInstanceId?: number, enabled: boolean }> }
   */
  async setProductMapBulk(req, res) {
    try {
      const { productId, updates } = req.body || {};
      const result = await this.model.setProductMapBulk(req, { productId, updates });
      return res.json({ ok: true, ...result });
    } catch (error) {
      Logger.error('Channels setProductMapBulk error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to update channel mapping' });
    }
  }

  /**
   * GET /api/channels/errors?channel=...&limit=...
   * Returns recent rows from channel_error_log for this user + channel.
   */
  async getErrors(req, res) {
    try {
      const channel = String(req.query?.channel || '').trim();
      const limit = req.query?.limit != null ? Number(req.query.limit) : 50;
      const items = await this.model.getErrors(req, { channel, limit });
      res.json({ ok: true, items });
    } catch (error) {
      Logger.error('Channels getErrors error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch channel errors' });
    }
  }

  // ---- Channel instances ----
  async listInstances(req, res) {
    try {
      const channel = req.query?.channel != null ? String(req.query.channel) : undefined;
      const raw = req.query?.includeDisabled;
      const includeDisabled = raw === 'true' || raw === '1';
      const items = await this.model.listInstances(req, { channel, includeDisabled });
      return res.json({ ok: true, items });
    } catch (error) {
      Logger.error('Channels listInstances error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to list channel instances' });
    }
  }

  async upsertInstance(req, res) {
    try {
      const data = req.body || {};
      const row = await this.model.upsertInstance(req, {
        channel: data.channel,
        instanceKey: data.instanceKey,
        market: data.market,
        label: data.label,
        credentials: data.credentials,
      });
      return res.json({ ok: true, row });
    } catch (error) {
      Logger.error('Channels upsertInstance error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to save channel instance' });
    }
  }

  async updateInstance(req, res) {
    try {
      const id = String(req.params?.id || '').trim();
      const data = req.body || {};
      const row = await this.model.updateInstance(req, id, {
        market: data.market,
        label: data.label,
        credentials: data.credentials,
        enabled: data.enabled,
        selloIntegrationId: data.selloIntegrationId,
      });
      return res.json({ ok: true, row });
    } catch (error) {
      Logger.error('Channels updateInstance error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to update channel instance' });
    }
  }

  // ---- Per-product overrides ----
  async listOverrides(req, res) {
    try {
      const productId = String(req.query?.productId || '').trim();
      const channel = req.query?.channel != null ? String(req.query.channel) : undefined;
      const items = await this.model.listProductOverrides(req, { productId, channel });
      return res.json({ ok: true, items });
    } catch (error) {
      Logger.error('Channels listOverrides error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to list overrides' });
    }
  }

  async upsertOverride(req, res) {
    try {
      const data = req.body || {};
      const result = await this.model.upsertProductOverride(req, {
        productId: data.productId,
        channelInstanceId: data.channelInstanceId,
        active: data.active,
        priceAmount: data.priceAmount,
        currency: data.currency,
        vatRate: data.vatRate,
        category: data.category,
      });
      return res.json({ ok: true, ...result });
    } catch (error) {
      Logger.error('Channels upsertOverride error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to save override' });
    }
  }

  /**
   * PUT /api/channels/overrides/bulk
   * Body: { productId: string, items: Array<{ channelInstanceId: number, active?: boolean, priceAmount?: number, category?: string }> }
   */
  async upsertOverridesBulk(req, res) {
    try {
      const { productId, items } = req.body || {};
      const result = await this.model.upsertProductOverridesBulk(req, { productId, items });
      return res.json({ ok: true, ...result });
    } catch (error) {
      Logger.error('Channels upsertOverridesBulk error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to save overrides' });
    }
  }

  // GET /api/channels/template (CSV)
  async getImportTemplate(req, res) {
    try {
      const csv = await this.model.buildImportTemplateCsv(req);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="homebase-import-template.csv"');
      return res.status(200).send(csv);
    } catch (error) {
      Logger.error('Channels getImportTemplate error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to generate template' });
    }
  }
}

module.exports = ChannelsController;
