const { Context, Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const analyticsCache = require('./cache');

class AnalyticsController {
  constructor(model) {
    this.model = model;
  }

  parseIsoDate(value) {
    if (!value) return null;
    const dt = new Date(String(value));
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }

  parseFilters(req) {
    const status = req.query?.status ? String(req.query.status).trim().toLowerCase() : null;
    const channel = req.query?.channel ? String(req.query.channel).trim().toLowerCase() : null;
    const channelInstanceId =
      req.query?.channelInstanceId != null && req.query.channelInstanceId !== ''
        ? Number(req.query.channelInstanceId)
        : null;
    const from = this.parseIsoDate(req.query?.from);
    const to = this.parseIsoDate(req.query?.to);
    return { status, channel, channelInstanceId, from, to };
  }

  getGranularity(req) {
    const raw = req.query?.granularity ? String(req.query.granularity).trim().toLowerCase() : 'day';
    return raw === 'week' || raw === 'month' ? raw : 'day';
  }

  buildCachePayload(filters, granularity = null) {
    const payload = {
      status: filters?.status || null,
      channel: filters?.channel || null,
      channelInstanceId:
        filters?.channelInstanceId != null ? Number(filters.channelInstanceId) : null,
      from: filters?.from || null,
      to: filters?.to || null,
    };
    if (granularity != null) {
      payload.granularity = granularity;
    }
    return payload;
  }

  getCachedOrLoad(req, endpointName, payload, loader, ttlMs = 30000) {
    const userId = Context.getUserId(req);
    if (!userId) {
      return loader();
    }
    const key = analyticsCache.buildKey(userId, endpointName, payload);
    const hit = analyticsCache.get(key);
    if (hit != null) {
      return Promise.resolve(hit);
    }
    return loader().then((value) => {
      analyticsCache.set(key, value, ttlMs);
      return value;
    });
  }

  async summary(req, res) {
    const startedAt = Date.now();
    try {
      const filters = this.parseFilters(req);
      const granularity = this.getGranularity(req);
      const payload = this.buildCachePayload(filters, granularity);
      const data = await this.getCachedOrLoad(
        req,
        'summary',
        payload,
        () => this.model.getSummary(req, filters, granularity),
        30000,
      );
      res.setHeader('X-Analytics-Summary-Ms', String(Date.now() - startedAt));
      Logger.info('analytics.summary.timing', {
        userId: Context.getUserId(req),
        ms: Date.now() - startedAt,
      });
      return res.json(data);
    } catch (error) {
      Logger.error('Analytics summary error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to load analytics summary' });
    }
  }

  async overview(req, res) {
    try {
      const data = await this.model.getOverview(req, this.parseFilters(req));
      return res.json(data);
    } catch (error) {
      Logger.error('Analytics overview error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to load analytics overview' });
    }
  }

  async timeSeries(req, res) {
    try {
      const granularity = this.getGranularity(req);
      const data = await this.model.getTimeSeries(req, this.parseFilters(req), granularity);
      return res.json({ items: data });
    } catch (error) {
      Logger.error('Analytics timeSeries error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to load analytics time series' });
    }
  }

  async statusDistribution(req, res) {
    try {
      const granularity = this.getGranularity(req);
      const items = await this.model.getStatusDistribution(
        req,
        this.parseFilters(req),
        granularity,
      );
      return res.json({ items });
    } catch (error) {
      Logger.error('Analytics statusDistribution error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to load status distribution' });
    }
  }

  async customerSegments(req, res) {
    const startedAt = Date.now();
    try {
      const filters = this.parseFilters(req);
      const data = await this.getCachedOrLoad(
        req,
        'customerSegments',
        this.buildCachePayload(filters),
        () => this.model.getCustomerSegments(req, filters),
        45000,
      );
      Logger.info('analytics.customerSegments.timing', {
        userId: Context.getUserId(req),
        ms: Date.now() - startedAt,
      });
      return res.json(data);
    } catch (error) {
      Logger.error('Analytics customerSegments error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to load customer segments' });
    }
  }

  async channels(req, res) {
    const startedAt = Date.now();
    try {
      const filters = this.parseFilters(req);
      const data = await this.getCachedOrLoad(
        req,
        'channels',
        this.buildCachePayload(filters),
        () => this.model.getChannels(req, filters),
        30000,
      );
      Logger.info('analytics.channels.timing', {
        userId: Context.getUserId(req),
        ms: Date.now() - startedAt,
      });
      return res.json({ items: data });
    } catch (error) {
      Logger.error('Analytics channels error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to load analytics channels' });
    }
  }

  async topProducts(req, res) {
    const startedAt = Date.now();
    try {
      const limit = req.query?.limit != null ? Number(req.query.limit) : 20;
      const filters = this.parseFilters(req);
      const data = await this.getCachedOrLoad(
        req,
        'topProducts',
        {
          ...this.buildCachePayload(filters),
          limit,
        },
        () => this.model.getTopProducts(req, filters, limit),
        30000,
      );
      Logger.info('analytics.topProducts.timing', {
        userId: Context.getUserId(req),
        ms: Date.now() - startedAt,
      });
      return res.json({ items: data });
    } catch (error) {
      Logger.error('Analytics topProducts error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to load top products' });
    }
  }

  async drilldownOrders(req, res) {
    try {
      const limit = req.query?.limit != null ? Number(req.query.limit) : 50;
      const offset = req.query?.offset != null ? Number(req.query.offset) : 0;
      const sku = req.query?.sku ? String(req.query.sku).trim() : null;
      const items = await this.model.getDrilldownOrders(req, this.parseFilters(req), {
        sku,
        limit,
        offset,
      });
      return res.json({ items });
    } catch (error) {
      Logger.error('Analytics drilldownOrders error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to load drilldown orders' });
    }
  }

  async exportTopProductsCsv(req, res) {
    try {
      const limit = req.query?.limit != null ? Number(req.query.limit) : 200;
      const items = await this.model.getTopProducts(req, this.parseFilters(req), limit);
      const currencies = [
        ...new Set(items.flatMap((r) => Object.keys(r.revenueByCurrency || {}))),
      ].sort();
      const header = [
        'sku',
        'title',
        'order_count',
        'units_sold',
        ...currencies.map((c) => `revenue_${c}`),
      ].join(',');
      const lines = items.map((row) => {
        const base = [row.sku ?? '', row.title ?? '', row.orderCount, row.unitsSold];
        const revByCur = row.revenueByCurrency || {};
        const revCols = currencies.map((c) => revByCur[c] ?? 0);
        return [...base, ...revCols]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(',');
      });
      const csv = [header, ...lines].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics-top-products.csv"');
      return res.status(200).send(csv);
    } catch (error) {
      Logger.error('Analytics exportTopProductsCsv error', error, {
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to export top products' });
    }
  }
}

module.exports = AnalyticsController;
