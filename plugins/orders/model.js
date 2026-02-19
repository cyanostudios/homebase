// plugins/orders/model.js
// Orders storage + normalized ingest (idempotent) + inventory adjustments (MVP)
// Uses @homebase/core SDK for database access with tenant isolation.

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class OrdersModel {
  static ORDERS_TABLE = 'orders';
  static ITEMS_TABLE = 'order_items';
  static ORDER_NUMBER_COUNTER_TABLE = 'order_number_counter';

  async list(req, { status, channel, from, to, limit = 50, offset = 0 } = {}) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const clauses = ['user_id = $1'];
      const params = [userId];

      if (status) {
        if (status === 'delivered') {
          clauses.push(`status IN ('delivered', 'shipped')`);
        } else {
          params.push(String(status));
          clauses.push(`status = $${params.length}`);
        }
      }
      if (channel) {
        params.push(String(channel));
        clauses.push(`channel = $${params.length}`);
      }
      if (from) {
        params.push(from);
        clauses.push(`placed_at >= $${params.length}`);
      }
      if (to) {
        params.push(to);
        clauses.push(`placed_at <= $${params.length}`);
      }

      params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
      const limitIdx = params.length;
      params.push(Math.max(Number(offset) || 0, 0));
      const offsetIdx = params.length;

      const sql = `
        SELECT
          id,
          user_id,
          channel,
          channel_order_id,
          platform_order_number,
          order_number,
          placed_at,
          total_amount,
          currency,
          status,
          shipping_carrier,
          shipping_tracking_number,
          shipping_address,
          customer,
          raw,
          created_at,
          updated_at
        FROM ${OrdersModel.ORDERS_TABLE}
        WHERE ${clauses.join(' AND ')}
        ORDER BY placed_at DESC NULLS LAST, id DESC
        LIMIT $${limitIdx}
        OFFSET $${offsetIdx}
      `;
      const rows = await db.query(sql, params);
      return rows.map((r) => this.transformOrderRow(r));
    } catch (error) {
      Logger.error('Failed to list orders', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to list orders', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, id) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const orderRes = await db.query(
        `SELECT * FROM ${OrdersModel.ORDERS_TABLE} WHERE user_id = $1 AND id = $2 LIMIT 1`,
        [userId, Number(id)],
      );
      if (!orderRes.length) throw new AppError('Order not found', 404, AppError.CODES.NOT_FOUND);

      // order_items has no user_id; filter via JOIN so adapter doesn't inject user_id
      const itemsRes = await db.query(
        `SELECT oi.* FROM ${OrdersModel.ITEMS_TABLE} oi
         INNER JOIN ${OrdersModel.ORDERS_TABLE} o ON o.id = oi.order_id AND o.user_id = $1
         WHERE oi.order_id = $2
         ORDER BY oi.id`,
        [userId, Number(id)],
      );

      return {
        ...this.transformOrderRow(orderRes[0]),
        items: itemsRes.map((r) => this.transformItemRow(r)),
      };
    } catch (error) {
      Logger.error('Failed to fetch order', error, { id });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch order', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateStatus(req, id, { status, carrier, trackingNumber } = {}) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const res = await db.query(
        `
        UPDATE ${OrdersModel.ORDERS_TABLE}
        SET
          status = COALESCE($3, status),
          shipping_carrier = COALESCE($4, shipping_carrier),
          shipping_tracking_number = COALESCE($5, shipping_tracking_number),
          updated_at = NOW()
        WHERE user_id = $1 AND id = $2
        RETURNING *
        `,
        [userId, Number(id), status ? String(status) : null, carrier ? String(carrier) : null, trackingNumber ? String(trackingNumber) : null],
      );
      if (!res.length) throw new AppError('Order not found', 404, AppError.CODES.NOT_FOUND);
      return this.transformOrderRow(res[0]);
    } catch (error) {
      Logger.error('Failed to update order status', error, { id });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update order status', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Batch update status for multiple orders.
   * Returns count of updated orders.
   */
  async batchUpdateStatus(req, ids, { status, carrier, trackingNumber } = {}) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      if (!Array.isArray(ids) || ids.length === 0) {
        return { updated: 0, updatedIds: [] };
      }

      // Validate and sanitize IDs
      const validIds = ids
        .map((id) => {
          const num = Number(id);
          return Number.isFinite(num) && num > 0 ? num : null;
        })
        .filter((id) => id !== null);

      if (validIds.length === 0) {
        return { updated: 0, updatedIds: [] };
      }

      // Limit to 500 orders per batch
      if (validIds.length > 500) {
        throw new AppError('Too many orders (max 500 per request)', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const res = await db.query(
        `
        UPDATE ${OrdersModel.ORDERS_TABLE}
        SET
          status = COALESCE($3, status),
          shipping_carrier = COALESCE($4, shipping_carrier),
          shipping_tracking_number = COALESCE($5, shipping_tracking_number),
          updated_at = NOW()
        WHERE user_id = $1 AND id = ANY($2::int[])
        RETURNING id
        `,
        [
          userId,
          validIds,
          status ? String(status) : null,
          carrier ? String(carrier) : null,
          trackingNumber ? String(trackingNumber) : null,
        ],
      );

      const updatedIds = res.map((row) => Number(row.id));

      return {
        updated: updatedIds.length,
        updatedIds,
      };
    } catch (error) {
      Logger.error('Failed to batch update order status', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to batch update order status', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Allocate next order_number for the user (atomic increment).
   * Returns the allocated number.
   */
  async allocateNextOrderNumber(req) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const res = await db.query(
        `
        INSERT INTO ${OrdersModel.ORDER_NUMBER_COUNTER_TABLE} (user_id, next_number)
        VALUES ($1, 1)
        ON CONFLICT (user_id) DO UPDATE
        SET next_number = order_number_counter.next_number + 1
        RETURNING next_number
        `,
        [userId],
      );
      if (!res.length) throw new AppError('Failed to allocate order number', 500, AppError.CODES.DATABASE_ERROR);
      return Number(res[0].next_number);
    } catch (error) {
      Logger.error('Failed to allocate order number', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to allocate order number', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Normalized ingest: creates an order if not seen before (idempotent via unique index),
   * inserts items, and returns { created, orderId }.
   *
   * NOTE: Inventory sync is orchestrated at controller level (so it can call other plugins).
   */
  async ingest(req, order) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const channel = String(order?.channel || '').trim().toLowerCase();
      const channelOrderId = String(order?.channelOrderId || '').trim();
      if (!channel || !channelOrderId) {
        throw new AppError('channel and channelOrderId are required', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const channelInstanceId =
        order?.channelInstanceId != null && Number.isFinite(Number(order.channelInstanceId))
          ? Number(order.channelInstanceId)
          : null;

      const placedAtStr = this.toISOUTC(order?.placedAt);
      const placedAt = placedAtStr ? new Date(placedAtStr) : null;
      const totalAmount = order?.totalAmount != null ? Number(order.totalAmount) : null;
      const currency = order?.currency ? String(order.currency).trim().toUpperCase() : null;
      const status = order?.status ? String(order.status).trim().toLowerCase() : null;

      // If order already exists (same channel + instance + channel_order_id), update it and return.
      const existing = await db.query(
        `SELECT id FROM ${OrdersModel.ORDERS_TABLE}
         WHERE user_id = $1 AND channel = $2 AND (channel_instance_id IS NOT DISTINCT FROM $4) AND channel_order_id = $3
         LIMIT 1`,
        [userId, channel, channelOrderId, channelInstanceId],
      );
      if (existing.length) {
        const orderId = Number(existing[0].id);
        await db.query(
          `UPDATE ${OrdersModel.ORDERS_TABLE}
           SET
             platform_order_number = COALESCE($3, platform_order_number),
             total_amount = COALESCE($4, total_amount),
             currency = COALESCE($5, currency),
             status = COALESCE($6, status),
             shipping_address = COALESCE($7, shipping_address),
             billing_address = COALESCE($8, billing_address),
             customer = COALESCE($9, customer),
             raw = $10,
             updated_at = NOW()
           WHERE user_id = $1 AND id = $2`,
          [
            userId,
            orderId,
            order?.platformOrderNumber != null ? String(order.platformOrderNumber) : null,
            Number.isFinite(totalAmount) ? totalAmount : null,
            currency || null,
            status || null,
            order?.shippingAddress ? JSON.stringify(order.shippingAddress) : null,
            order?.billingAddress ? JSON.stringify(order.billingAddress) : null,
            order?.customer ? JSON.stringify(order.customer) : null,
            order?.raw ? JSON.stringify(order.raw) : null,
          ],
        );
        return { created: false, orderId };
      }

      // New order: allocate order_number and insert
      const counterRes = await db.query(
        `
        INSERT INTO ${OrdersModel.ORDER_NUMBER_COUNTER_TABLE} (user_id, next_number)
        VALUES ($1, 1)
        ON CONFLICT (user_id) DO UPDATE SET next_number = ${OrdersModel.ORDER_NUMBER_COUNTER_TABLE}.next_number + 1
        RETURNING next_number
        `,
        [userId],
      );
      const orderNumber = Number(counterRes[0]?.next_number ?? 1);

      let orderId;
      try {
        const createRes = await db.query(
          `
          INSERT INTO ${OrdersModel.ORDERS_TABLE} (
            user_id, channel, channel_order_id, channel_instance_id, platform_order_number, order_number,
            placed_at, total_amount, currency, status,
            shipping_address, billing_address, customer, raw,
            created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, COALESCE($9, 'SEK'), COALESCE($10, 'processing'),
            $11, $12, $13, $14,
            NOW(), NOW()
          )
          RETURNING id
          `,
          [
            userId,
            channel,
            channelOrderId,
            channelInstanceId,
            order?.platformOrderNumber != null ? String(order.platformOrderNumber) : null,
            orderNumber,
            placedAt,
            Number.isFinite(totalAmount) ? totalAmount : null,
            currency || null,
            status || null,
            order?.shippingAddress ? JSON.stringify(order.shippingAddress) : null,
            order?.billingAddress ? JSON.stringify(order.billingAddress) : null,
            order?.customer ? JSON.stringify(order.customer) : null,
            order?.raw ? JSON.stringify(order.raw) : null,
          ],
        );
        orderId = Number(createRes[0].id);
      } catch (err) {
        const pgCode = err?.details?.code ?? err?.code;
        const rawMsg = String(err?.details?.originalError ?? err?.message ?? '');
        const isDuplicate =
          pgCode === '23505' &&
          (rawMsg.includes('ux_orders_user_order_number') ||
            rawMsg.includes('channel_order_id') ||
            rawMsg.includes('ux_orders_user_channel_instance_order'));
        if (isDuplicate) {
          const recheck = await db.query(
            `SELECT id FROM ${OrdersModel.ORDERS_TABLE}
             WHERE user_id = $1 AND channel = $2 AND (channel_instance_id IS NOT DISTINCT FROM $4) AND channel_order_id = $3
             LIMIT 1`,
            [userId, channel, channelOrderId, channelInstanceId],
          );
          if (recheck.length) return { created: false, orderId: Number(recheck[0].id) };
        }
        throw err;
      }

      // Insert items (new order only)
      const items = Array.isArray(order?.items) ? order.items : [];
      for (const it of items) {
        const sku = it?.sku != null ? String(it.sku).trim() : null;
        const title = it?.title != null ? String(it.title).trim() : null;
        const qty = Number(it?.quantity);
        const unitPrice = it?.unitPrice != null ? Number(it.unitPrice) : null;
        const vatRate = it?.vatRate != null ? Number(it.vatRate) : null;

        if (!Number.isFinite(qty) || qty <= 0) continue;

        await db.query(
          `
          INSERT INTO ${OrdersModel.ITEMS_TABLE} (
            order_id, sku, product_id, title, quantity, unit_price, vat_rate, raw, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `,
          [
            orderId,
            sku || null,
            it?.productId != null ? Number(it.productId) : null,
            title || null,
            Math.trunc(qty),
            Number.isFinite(unitPrice) ? unitPrice : null,
            Number.isFinite(vatRate) ? vatRate : null,
            it?.raw ? JSON.stringify(it.raw) : null,
          ],
        );
      }

      return { created: true, orderId };
    } catch (error) {
      Logger.error('Order ingest failed', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Order ingest failed', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Delete all orders for the current user (including items and reset counter).
   * Cleans both current tenant schema and public schema so no order data remains anywhere.
   * Returns count of deleted orders (from current schema only for the number).
   */
  async deleteAll(req) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      // Count in current schema first (search_path = tenant_X, public)
      const countRes = await db.query(
        `SELECT COUNT(*)::int AS count FROM ${OrdersModel.ORDERS_TABLE} WHERE user_id = $1`,
        [userId],
      );
      const deletedCount = countRes[0]?.count || 0;

      // --- Current schema (tenant or public depending on search_path) ---
      await db.query(
        `DELETE FROM ${OrdersModel.ITEMS_TABLE}
         WHERE order_id IN (SELECT id FROM ${OrdersModel.ORDERS_TABLE} WHERE user_id = $1)`,
        [userId],
      );
      await db.query(
        `DELETE FROM ${OrdersModel.ORDERS_TABLE} WHERE user_id = $1`,
        [userId],
      );
      await db.query(
        `DELETE FROM ${OrdersModel.ORDER_NUMBER_COUNTER_TABLE} WHERE user_id = $1`,
        [userId],
      );

      // --- Public schema: clear any leftover order data (e.g. after migration public → tenant) ---
      await db.query(
        `DELETE FROM public.${OrdersModel.ITEMS_TABLE}
         WHERE order_id IN (SELECT id FROM public.${OrdersModel.ORDERS_TABLE} WHERE user_id = $1)`,
        [userId],
      );
      await db.query(
        `DELETE FROM public.${OrdersModel.ORDERS_TABLE} WHERE user_id = $1`,
        [userId],
      );
      await db.query(
        `DELETE FROM public.${OrdersModel.ORDER_NUMBER_COUNTER_TABLE} WHERE user_id = $1`,
        [userId],
      );

      Logger.info('All orders deleted (tenant + public)', { userId, deletedCount });
      return { deletedCount };
    } catch (error) {
      Logger.error('Failed to delete all orders', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete all orders', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Delete selected orders for the current user (and their items). Does not reset order_number_counter.
   * @param {string[]} ids - order ids (must belong to user)
   * @returns {{ deletedCount: number }}
   */
  async deleteByIds(req, ids) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const idList = ids
        .map((id) => (id != null && Number.isFinite(Number(id)) ? Number(id) : null))
        .filter((id) => id != null);
      if (idList.length === 0) return { deletedCount: 0 };

      await db.query(
        `DELETE FROM ${OrdersModel.ITEMS_TABLE}
         WHERE order_id IN (SELECT id FROM ${OrdersModel.ORDERS_TABLE} WHERE user_id = $1 AND id = ANY($2))`,
        [userId, idList],
      );
      const del = await db.query(
        `DELETE FROM ${OrdersModel.ORDERS_TABLE} WHERE user_id = $1 AND id = ANY($2) RETURNING id`,
        [userId, idList],
      );
      const deletedCount = del.length;
      if (deletedCount > 0) {
        Logger.info('Orders deleted by ids', { userId, deletedCount, ids: idList });
      }
      return { deletedCount };
    } catch (error) {
      Logger.error('Failed to delete orders by ids', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete orders', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /** Normalize date to ISO 8601 with Z so client displays correct local time (avoids 1h off with TIMESTAMP WITHOUT TZ). */
  toISOUTC(val) {
    if (val == null) return null;
    if (val instanceof Date) return val.toISOString();
    const s = String(val).trim();
    if (!s) return null;
    if (s.endsWith('Z') || s.endsWith('z') || /[+-]\d{2}:?\d{2}$/.test(s)) return s;
    const d = new Date(s.replace(' ', 'T') + 'Z');
    return Number.isNaN(d.getTime()) ? s : d.toISOString();
  }

  /**
   * Renumber order_number by placed_at so oldest = 1, newest = highest. One sequence across all channels.
   */
  async renumberOrderNumbersByPlacedAt(req) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      await db.query('DROP INDEX IF EXISTS ux_orders_user_order_number');
      await db.query(
        `
        WITH ranked AS (
          SELECT id, user_id,
                 ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY placed_at ASC NULLS LAST, id ASC) AS rn
          FROM ${OrdersModel.ORDERS_TABLE}
          WHERE user_id = $1
        )
        UPDATE ${OrdersModel.ORDERS_TABLE} o
        SET order_number = r.rn
        FROM ranked r
        WHERE o.id = r.id AND o.user_id = r.user_id AND o.user_id = $1
        `,
        [userId],
      );
      await db.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_user_order_number ON ${OrdersModel.ORDERS_TABLE}(user_id, order_number)`,
      );
      await db.query(
        `
        INSERT INTO ${OrdersModel.ORDER_NUMBER_COUNTER_TABLE} (user_id, next_number)
        SELECT $1, COALESCE(MAX(order_number), 0) + 1
        FROM ${OrdersModel.ORDERS_TABLE}
        WHERE user_id = $1
        GROUP BY user_id
        ON CONFLICT (user_id) DO UPDATE
        SET next_number = GREATEST(
          ${OrdersModel.ORDER_NUMBER_COUNTER_TABLE}.next_number,
          (SELECT COALESCE(MAX(order_number), 0) + 1 FROM ${OrdersModel.ORDERS_TABLE} WHERE user_id = $1)
        )
        `,
        [userId],
      );

      const countRes = await db.query(
        `SELECT COUNT(*)::int AS count FROM ${OrdersModel.ORDERS_TABLE} WHERE user_id = $1`,
        [userId],
      );
      const count = countRes[0]?.count ?? 0;
      Logger.info('Orders renumbered by placed_at', { userId, count });
      return { renumbered: count };
    } catch (error) {
      Logger.error('Failed to renumber order numbers', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to renumber order numbers', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformOrderRow(row) {
    return {
      id: String(row.id),
      channel: row.channel,
      channelOrderId: row.channel_order_id,
      platformOrderNumber: row.platform_order_number,
      orderNumber: row.order_number != null ? Number(row.order_number) : null,
      placedAt: this.toISOUTC(row.placed_at),
      totalAmount: row.total_amount != null ? Number(row.total_amount) : null,
      currency: row.currency,
      status: row.status,
      shippingCarrier: row.shipping_carrier || null,
      shippingTrackingNumber: row.shipping_tracking_number || null,
      shippingAddress: row.shipping_address || null,
      billingAddress: row.billing_address || null,
      customer: row.customer || null,
      raw: row.raw || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  transformItemRow(row) {
    return {
      id: String(row.id),
      orderId: String(row.order_id),
      sku: row.sku || null,
      productId: row.product_id != null ? String(row.product_id) : null,
      title: row.title || null,
      quantity: row.quantity != null ? Number(row.quantity) : 0,
      unitPrice: row.unit_price != null ? Number(row.unit_price) : null,
      vatRate: row.vat_rate != null ? Number(row.vat_rate) : null,
      raw: row.raw || null,
      createdAt: row.created_at,
    };
  }
}

module.exports = OrdersModel;

