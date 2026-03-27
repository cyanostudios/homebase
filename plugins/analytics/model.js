const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class AnalyticsModel {
  /**
   * Appends filter params to the given params array and returns WHERE clauses.
   * params are appended in call order for optional filters.
   */
  buildFilters(filters, params) {
    const clauses = [];

    if (filters?.status) {
      params.push(String(filters.status).trim().toLowerCase());
      clauses.push(`o.status = $${params.length}`);
    }

    if (filters?.channel) {
      const channelRaw = String(filters.channel).trim().toLowerCase();
      const [baseChannel, market] = channelRaw.split(':');
      if ((baseChannel === 'cdon' || baseChannel === 'fyndiq') && market) {
        params.push(baseChannel);
        clauses.push(`o.channel = $${params.length}`);
        params.push(market);
        clauses.push(`o.channel_market_norm = $${params.length}`);
      } else {
        params.push(channelRaw);
        clauses.push(`o.channel = $${params.length}`);
      }
    }

    if (filters?.channelInstanceId != null) {
      const instanceId = Number(filters.channelInstanceId);
      if (!Number.isInteger(instanceId) || instanceId < 1) {
        throw new AppError(
          'channelInstanceId must be a positive integer',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      params.push(instanceId);
      clauses.push(`o.channel_instance_id = $${params.length}`);
    }

    if (filters?.from) {
      params.push(filters.from);
      clauses.push(`o.placed_at >= $${params.length}`);
    }

    if (filters?.to) {
      params.push(filters.to);
      clauses.push(`o.placed_at <= $${params.length}`);
    }

    return clauses;
  }

  getBucketExpression(granularity) {
    if (granularity === 'week') return `date_trunc('week', o.placed_at)`;
    if (granularity === 'month') return `date_trunc('month', o.placed_at)`;
    return `date_trunc('day', o.placed_at)`;
  }

  async getSummary(req, filters, granularity = 'day') {
    const hasChannelFilter =
      (filters?.channel != null && String(filters.channel).trim() !== '') ||
      filters?.channelInstanceId != null;
    const filtersWithoutChannel = hasChannelFilter
      ? {
          ...(filters || {}),
          channel: null,
          channelInstanceId: null,
        }
      : null;
    const [
      overview,
      timeSeries,
      statusDistribution,
      customerSegments,
      channels,
      allChannelsForDropdown,
    ] = await Promise.all([
      this.getOverview(req, filters),
      this.getTimeSeries(req, filters, granularity),
      this.getStatusDistribution(req, filters, granularity),
      this.getCustomerSegments(req, filters),
      this.getChannels(req, filters),
      hasChannelFilter ? this.getChannels(req, filtersWithoutChannel) : Promise.resolve(null),
    ]);

    return {
      overview,
      timeSeries,
      statusDistribution,
      customerSegments,
      channels,
      allChannelsForDropdown: allChannelsForDropdown || channels,
    };
  }

  async getOverview(req, filters) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const params = [];
      const clauses = this.buildFilters(filters || {}, params);
      const where = clauses.length ? clauses.join(' AND ') : 'TRUE';

      const currencyExpr = `COALESCE(nullif(trim(upper(o.currency_norm)), ''), 'SEK')`;

      const sql = `
        WITH filtered_orders AS (
          SELECT o.id, o.total_amount, (${currencyExpr}) AS currency
          FROM orders o
          WHERE ${where}
        ),
        by_currency AS (
          SELECT
            currency,
            SUM(total_amount)::numeric AS revenue,
            COUNT(*)::int AS order_count
          FROM filtered_orders
          GROUP BY currency
        ),
        filtered_items AS (
          SELECT oi.quantity
          FROM order_items oi
          INNER JOIN filtered_orders fo ON fo.id = oi.order_id
        )
        SELECT
          (SELECT jsonb_object_agg(currency, jsonb_build_object('revenue', revenue, 'orderCount', order_count, 'aov', CASE WHEN order_count = 0 THEN 0 ELSE revenue / order_count END))
           FROM by_currency) AS by_currency,
          COALESCE((SELECT SUM(quantity) FROM filtered_items), 0)::int AS units_sold
      `;

      const rows = await db.query(sql, params);
      const row = rows[0] || {};
      const byCurrency = row.by_currency || {};
      const byCurrencyList = Object.entries(byCurrency).map(([cur, obj]) => ({
        currency: cur,
        revenue: Number(obj?.revenue || 0),
        orderCount: Number(obj?.orderCount || 0),
        aov: Number(obj?.aov || 0),
      }));
      return {
        byCurrency: byCurrencyList,
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
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const params = [];
      const clauses = this.buildFilters(filters || {}, params);
      const where = clauses.length ? clauses.join(' AND ') : 'TRUE';
      const bucketExpr = this.getBucketExpression(granularity);

      const marketExpr = `o.channel_market_norm`;
      const channelKeyExpr = `
        CASE
          WHEN o.channel IN ('cdon', 'fyndiq') AND ${marketExpr} IS NOT NULL
            THEN o.channel || ':' || ${marketExpr}
          ELSE o.channel
        END
      `;
      const channelLabelExpr = `
        CASE
          WHEN o.channel_label IS NOT NULL AND trim(o.channel_label) <> '' THEN trim(o.channel_label)
          WHEN o.channel = 'cdon' AND ${marketExpr} IS NOT NULL THEN 'CDON ' || upper(${marketExpr})
          WHEN o.channel = 'fyndiq' AND ${marketExpr} IS NOT NULL THEN 'Fyndiq ' || upper(${marketExpr})
          ELSE NULL
        END
      `;
      const channelCurrencyExpr = `COALESCE(nullif(trim(upper(o.currency_norm)), ''), 'SEK')`;

      const sql = `
        SELECT
          ${bucketExpr} AS bucket,
          ${channelKeyExpr} AS channel_key,
          ${channelLabelExpr} AS channel_display_label,
          ${channelCurrencyExpr} AS currency,
          COUNT(*)::int AS order_count,
          COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
        FROM orders o
        WHERE ${where}
        GROUP BY bucket, 2, 3, 4
        ORDER BY bucket ASC, channel_display_label ASC NULLS LAST, channel_key ASC
      `;

      const rows = await db.query(sql, params);
      return rows
        .filter((r) => {
          const label =
            r.channel_display_label != null && String(r.channel_display_label).trim() !== ''
              ? String(r.channel_display_label).trim()
              : r.channel_key;
          return label && label.trim() !== '';
        })
        .map((r) => ({
          bucket: r.bucket,
          channel: r.channel_key,
          channelLabel:
            r.channel_display_label != null && String(r.channel_display_label).trim() !== ''
              ? String(r.channel_display_label).trim()
              : String(r.channel_key || ''),
          currency: r.currency || 'SEK',
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

  async getStatusDistribution(req, filters, granularity = 'day') {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const params = [];
      const clauses = this.buildFilters(filters || {}, params);
      const where = clauses.length ? clauses.join(' AND ') : 'TRUE';
      const bucketExpr = this.getBucketExpression(granularity);

      const sql = `
        SELECT
          ${bucketExpr} AS bucket,
          o.status,
          COUNT(*)::int AS order_count,
          COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
        FROM orders o
        WHERE ${where}
        GROUP BY bucket, o.status
        ORDER BY bucket ASC, o.status ASC
      `;

      const rows = await db.query(sql, params);
      return rows.map((r) => ({
        bucket: r.bucket,
        status: r.status,
        orderCount: Number(r.order_count || 0),
        revenue: Number(r.revenue || 0),
      }));
    } catch (error) {
      Logger.error('Failed to fetch analytics status distribution', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to fetch analytics status distribution',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async getCustomerSegments(req, filters) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const params = [];
      const clauses = this.buildFilters(filters || {}, params);
      const where = clauses.length ? clauses.join(' AND ') : 'TRUE';

      const sql = `
        WITH filtered_orders AS (
          SELECT
            o.id,
            o.customer_identifier_norm
          FROM orders o
          WHERE ${where}
        )
        SELECT
          COUNT(
            DISTINCT CASE
              WHEN fo.customer_identifier_norm IS NOT NULL AND cfo.first_order_id = fo.id
                THEN fo.customer_identifier_norm
              ELSE NULL
            END
          )::int AS new_customers,
          COUNT(
            DISTINCT CASE
              WHEN fo.customer_identifier_norm IS NOT NULL AND cfo.first_order_id IS DISTINCT FROM fo.id
                THEN fo.customer_identifier_norm
              ELSE NULL
            END
          )::int AS returning_customers,
          COALESCE(
            SUM(
              CASE
                WHEN fo.customer_identifier_norm IS NOT NULL AND cfo.first_order_id = fo.id THEN 1
                ELSE 0
              END
            ),
            0
          )::int AS new_customer_orders,
          COALESCE(
            SUM(
              CASE
                WHEN fo.customer_identifier_norm IS NOT NULL AND cfo.first_order_id IS DISTINCT FROM fo.id
                  THEN 1
                ELSE 0
              END
            ),
            0
          )::int AS returning_customer_orders,
          COALESCE(
            SUM(CASE WHEN fo.customer_identifier_norm IS NULL THEN 1 ELSE 0 END),
            0
          )::int AS unidentified_orders
        FROM filtered_orders fo
        LEFT JOIN customer_first_orders cfo
          ON cfo.customer_identifier_norm = fo.customer_identifier_norm
      `;

      const rows = await db.query(sql, params);
      const row = rows[0] || {};
      return {
        newCustomers: Number(row.new_customers || 0),
        returningCustomers: Number(row.returning_customers || 0),
        newCustomerOrders: Number(row.new_customer_orders || 0),
        returningCustomerOrders: Number(row.returning_customer_orders || 0),
        unidentifiedOrders: Number(row.unidentified_orders || 0),
      };
    } catch (error) {
      Logger.error('Failed to fetch analytics customer segments', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to fetch analytics customer segments',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async getChannels(req, filters) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const params = [];
      const clauses = this.buildFilters(filters || {}, params);
      const where = clauses.length ? clauses.join(' AND ') : 'TRUE';

      const marketExpr = `o.channel_market_norm`;
      const channelKeyExpr = `
        CASE
          WHEN o.channel IN ('cdon', 'fyndiq') AND ${marketExpr} IS NOT NULL
            THEN o.channel || ':' || ${marketExpr}
          ELSE o.channel
        END
      `;
      const channelLabelExpr = `
        CASE
          WHEN o.channel_label IS NOT NULL AND trim(o.channel_label) <> '' THEN trim(o.channel_label)
          WHEN o.channel = 'cdon' AND ${marketExpr} IS NOT NULL THEN 'CDON ' || upper(${marketExpr})
          WHEN o.channel = 'fyndiq' AND ${marketExpr} IS NOT NULL THEN 'Fyndiq ' || upper(${marketExpr})
          ELSE NULL
        END
      `;
      const channelCurrencyExpr = `COALESCE(nullif(trim(upper(o.currency_norm)), ''), 'SEK')`;

      const sql = `
        SELECT
          ${channelKeyExpr} AS channel_key,
          o.channel AS base_channel,
          o.channel_instance_id,
          ${channelLabelExpr} AS channel_display_label,
          ${channelCurrencyExpr} AS currency,
          COUNT(*)::int AS order_count,
          COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
        FROM orders o
        WHERE ${where}
        GROUP BY 1, 2, 3, 4, 5
        ORDER BY revenue DESC, order_count DESC, channel_key ASC
      `;

      const rows = await db.query(sql, params);
      return rows.map((r) => ({
        channel: r.channel_key,
        channelInstanceId: r.channel_instance_id != null ? Number(r.channel_instance_id) : null,
        channelLabel:
          r.channel_display_label != null && String(r.channel_display_label).trim() !== ''
            ? String(r.channel_display_label).trim()
            : null,
        currency: r.currency || 'SEK',
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
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const params = [];
      const clauses = this.buildFilters(filters || {}, params);
      params.push(Math.min(Math.max(Number(limit) || 20, 1), 100));
      const limitParam = `$${params.length}`;
      const where = clauses.length ? clauses.join(' AND ') : 'TRUE';

      // Exclude shipping cost line items (WooCommerce frakt) from top products
      const excludeShipping =
        "AND NOT (o.channel = 'woocommerce' AND oi.product_id IS NULL AND oi.raw->>'method_id' IS NOT NULL)";

      const currencyExpr = `COALESCE(nullif(trim(upper(o.currency_norm)), ''), 'SEK')`;

      const sql = `
        WITH filtered AS (
          SELECT oi.order_id, oi.sku, oi.title, oi.quantity, oi.unit_price, (${currencyExpr}) AS currency
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          WHERE ${where}
          ${excludeShipping}
        ),
        by_currency AS (
          SELECT sku, title, currency,
                 SUM(quantity * COALESCE(unit_price, 0))::numeric AS revenue
          FROM filtered
          GROUP BY sku, title, currency
        ),
        totals AS (
          SELECT sku, title,
                 COUNT(DISTINCT order_id)::int AS order_count,
                 SUM(quantity)::int AS units_sold,
                 SUM(quantity * COALESCE(unit_price, 0))::numeric AS total_revenue
          FROM filtered
          GROUP BY sku, title
        )
        SELECT t.sku, t.title, t.order_count, t.units_sold,
               (SELECT jsonb_object_agg(bc.currency, bc.revenue)
                FROM by_currency bc
                WHERE bc.sku = t.sku AND bc.title = t.title) AS revenue_by_currency
        FROM totals t
        ORDER BY t.total_revenue DESC, t.units_sold DESC
        LIMIT ${limitParam}
      `;

      const rows = await db.query(sql, params);
      return rows.map((r) => {
        const byCur = r.revenue_by_currency || {};
        const revenueByCurrency = Object.fromEntries(
          Object.entries(byCur).map(([cur, rev]) => [cur, Number(rev || 0)]),
        );
        return {
          sku: r.sku || null,
          title: r.title || null,
          orderCount: Number(r.order_count || 0),
          unitsSold: Number(r.units_sold || 0),
          revenueByCurrency,
        };
      });
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
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const params = [];
      const clauses = this.buildFilters(filters || {}, params);

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
      const where = clauses.length ? clauses.join(' AND ') : 'TRUE';

      const sql = `
        SELECT
          o.id,
          o.order_number,
          o.channel,
          o.channel_market_norm AS channel_market,
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
        channelLabel: (() => {
          if (r.channel_label != null && String(r.channel_label).trim() !== '') {
            return String(r.channel_label).trim();
          }
          if ((r.channel === 'cdon' || r.channel === 'fyndiq') && r.channel_market) {
            return `${r.channel === 'cdon' ? 'CDON' : 'Fyndiq'} ${String(r.channel_market).toUpperCase()}`;
          }
          return null;
        })(),
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
