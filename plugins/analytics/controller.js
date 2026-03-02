const { Context, Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class AnalyticsController {
  constructor(model) {
    this.model = model;
  }

  parseFilters(req) {
    const status = req.query?.status ? String(req.query.status).trim().toLowerCase() : null;
    const channel = req.query?.channel ? String(req.query.channel).trim().toLowerCase() : null;
    const channelInstanceId =
      req.query?.channelInstanceId != null && req.query.channelInstanceId !== ''
        ? Number(req.query.channelInstanceId)
        : null;
    const from = req.query?.from ? new Date(String(req.query.from)) : null;
    const to = req.query?.to ? new Date(String(req.query.to)) : null;
    return { status, channel, channelInstanceId, from, to };
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
      const granularity = req.query?.granularity
        ? String(req.query.granularity).trim().toLowerCase()
        : 'day';
      const data = await this.model.getTimeSeries(req, this.parseFilters(req), granularity);
      return res.json({ items: data });
    } catch (error) {
      Logger.error('Analytics timeSeries error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to load analytics time series' });
    }
  }

  async channels(req, res) {
    try {
      const data = await this.model.getChannels(req, this.parseFilters(req));
      return res.json({ items: data });
    } catch (error) {
      Logger.error('Analytics channels error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to load analytics channels' });
    }
  }

  async topProducts(req, res) {
    try {
      const limit = req.query?.limit != null ? Number(req.query.limit) : 20;
      const data = await this.model.getTopProducts(req, this.parseFilters(req), limit);
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
      const header = ['sku', 'title', 'order_count', 'units_sold', 'revenue'].join(',');
      const lines = items.map((row) =>
        [row.sku ?? '', row.title ?? '', row.orderCount, row.unitsSold, row.revenue]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      );
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
