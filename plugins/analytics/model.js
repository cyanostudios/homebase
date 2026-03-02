const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class AnalyticsModel {
  buildFilters({ status, channel, channelInstanceId, from, to }) {
    const clauses = [];
    const params = [];

    if (status) {
      params.push(String(status).trim().toLowerCase());
      clauses.push(`o.status = $${params.length}`);
    }

    if (channel) {
      params.push(String(channel).trim().toLowerCase());
      clauses.push(`o.channel = $${params.length}`);
    }

    if (channelInstanceId != null) {
      params.push(Number(channelInstanceId));
      clauses.push(`o.channel_instance_id = $${params.length}`);
    }

    if (from) {
      params.push(from);
      clauses.push(`o.placed_at >= $${params.length}`);
    }

    if (to) {
      params.push(to);
      clauses.push(`o.placed_at <= $${params.length}`);
    }

    return { clauses, params };
  }

  getBucketExpression(granularity) {
    if (granularity === 'week') return `date_trunc('week', o.placed_at)`;
    if (granularity === 'month') return `date_trunc('month', o.placed_at)`;
    return `date_trunc('day', o.placed_at)`;
  }

  async getOverview(req, filters) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const { clauses, params } = this.buildFilters(filters || {});
      params.unshift(userId);
      const where = [`o.user_id = $1`, ...clauses].join(' AND ');

      const sql = `
        WITH filtered_orders AS (
          SELECT o.id, o.total_amount
          FROM orders o
          WHERE ${where}
        ),
        filtered_items AS (
          SELECT oi.quantity
          FROM order_items oi
          INNER JOIN filtered_orders fo ON fo.id = oi.order_id
        )
        SELECT
          COALESCE((SELECT SUM(fo.total_amount) FROM filtered_orders fo), 0)::numeric AS revenue,
          COALESCE((SELECT COUNT(*) FROM filtered_orders), 0)::int AS order_count,
          CASE
            WHEN (SELECT COUNT(*) FROM filtered_orders) = 0 THEN 0::numeric
            ELSE COALESCE((SELECT SUM(fo.total_amount) FROM filtered_orders fo), 0)::numeric
                 / (SELECT COUNT(*) FROM filtered_orders)::numeric
          END AS aov,
          COALESCE((SELECT SUM(fi.quantity) FROM filtered_items fi), 0)::int AS units_sold
      `;

      const rows = await db.query(sql, params);
      const row = rows[0] || {};
      return {
        revenue: Number(row.revenue || 0),
        orderCount: Number(row.order_count || 0),
        aov: Number(row.aov || 0),
        unitsSold: Number(row.units_sold || 0),
      };
    } catch (error) {
      Logger.error('Failed to fetch analytics overview', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch analytics overview', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getTimeSeries(req, filters, granularity = 'day') {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const { clauses, params } = this.buildFilters(filters || {});
      params.unshift(userId);
      const where = [`o.user_id = $1`, ...clauses].join(' AND ');
      const bucketExpr = this.getBucketExpression(granularity);

      const sql = `
        SELECT
          ${bucketExpr} AS bucket,
          COUNT(*)::int AS order_count,
          COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
        FROM orders o
        WHERE ${where}
        GROUP BY bucket
        ORDER BY bucket ASC
      `;

      const rows = await db.query(sql, params);
      return rows.map((r) => ({
        bucket: r.bucket,
        orderCount: Number(r.order_count || 0),
        revenue: Number(r.revenue || 0),
      }));
    } catch (error) {
      Logger.error('Failed to fetch analytics time series', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to fetch analytics time series',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async getChannels(req, filters) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const { clauses, params } = this.buildFilters(filters || {});
      params.unshift(userId);
      const where = [`o.user_id = $1`, ...clauses].join(' AND ');

      const sql = `
        SELECT
          o.channel,
          o.channel_instance_id,
          o.channel_label,
          COUNT(*)::int AS order_count,
          COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
        FROM orders o
        WHERE ${where}
        GROUP BY o.channel, o.channel_instance_id, o.channel_label
        ORDER BY revenue DESC, order_count DESC, o.channel ASC
      `;

      const rows = await db.query(sql, params);
      return rows.map((r) => ({
        channel: r.channel,
        channelInstanceId: r.channel_instance_id != null ? Number(r.channel_instance_id) : null,
        channelLabel:
          r.channel_label != null && String(r.channel_label).trim() !== ''
            ? String(r.channel_label).trim()
            : null,
        orderCount: Number(r.order_count || 0),
        revenue: Number(r.revenue || 0),
      }));
    } catch (error) {
      Logger.error('Failed to fetch analytics channels', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch analytics channels', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getTopProducts(req, filters, limit = 20) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const { clauses, params } = this.buildFilters(filters || {});
      params.unshift(userId);
      params.push(Math.min(Math.max(Number(limit) || 20, 1), 100));
      const limitParam = `$${params.length}`;
      const where = [`o.user_id = $1`, ...clauses].join(' AND ');

      const sql = `
        SELECT
          oi.sku,
          oi.title,
          COUNT(DISTINCT oi.order_id)::int AS order_count,
          COALESCE(SUM(oi.quantity), 0)::int AS units_sold,
          COALESCE(SUM(oi.quantity * COALESCE(oi.unit_price, 0)), 0)::numeric AS revenue
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE ${where}
        GROUP BY oi.sku, oi.title
        ORDER BY revenue DESC, units_sold DESC
        LIMIT ${limitParam}
      `;

      const rows = await db.query(sql, params);
      return rows.map((r) => ({
        sku: r.sku || null,
        title: r.title || null,
        orderCount: Number(r.order_count || 0),
        unitsSold: Number(r.units_sold || 0),
        revenue: Number(r.revenue || 0),
      }));
    } catch (error) {
      Logger.error('Failed to fetch analytics top products', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to fetch analytics top products',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async getDrilldownOrders(req, filters, { sku, limit = 50, offset = 0 } = {}) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const { clauses, params } = this.buildFilters(filters || {});
      params.unshift(userId);

      if (sku) {
        params.push(String(sku).trim());
        clauses.push(
          `EXISTS (
            SELECT 1
            FROM order_items oi
            WHERE oi.order_id = o.id
              AND oi.sku = $${params.length}
          )`,
        );
      }

      params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
      const limitParam = `$${params.length}`;
      params.push(Math.max(Number(offset) || 0, 0));
      const offsetParam = `$${params.length}`;
      const where = [`o.user_id = $1`, ...clauses].join(' AND ');

      const sql = `
        SELECT
          o.id,
          o.order_number,
          o.channel,
          o.channel_instance_id,
          o.channel_label,
          o.placed_at,
          o.status,
          o.total_amount,
          o.currency
        FROM orders o
        WHERE ${where}
        ORDER BY o.placed_at DESC NULLS LAST, o.id DESC
        LIMIT ${limitParam}
        OFFSET ${offsetParam}
      `;

      const rows = await db.query(sql, params);
      return rows.map((r) => ({
        id: String(r.id),
        orderNumber: r.order_number != null ? Number(r.order_number) : null,
        channel: r.channel,
        channelInstanceId: r.channel_instance_id != null ? Number(r.channel_instance_id) : null,
        channelLabel:
          r.channel_label != null && String(r.channel_label).trim() !== ''
            ? String(r.channel_label).trim()
            : null,
        placedAt: r.placed_at,
        status: r.status,
        totalAmount: r.total_amount != null ? Number(r.total_amount) : null,
        currency: r.currency || null,
      }));
    } catch (error) {
      Logger.error('Failed to fetch analytics drilldown orders', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to fetch analytics drilldown orders',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }
}

module.exports = AnalyticsModel;
