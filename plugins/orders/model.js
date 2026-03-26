// plugins/orders/model.js
// Orders storage + normalized ingest (idempotent) + inventory adjustments (MVP)
// Uses @homebase/core SDK for database access with tenant isolation.

const crypto = require('crypto');

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class OrdersModel {
  static ORDERS_TABLE = 'orders';
  static ITEMS_TABLE = 'order_items';
  static ORDER_NUMBER_COUNTER_TABLE = 'order_number_counter';
  static CUSTOMER_FIRST_ORDERS_TABLE = 'customer_first_orders';
  static SYNC_BATCH_SIZE = 100;

  getChannelMarket(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const marketRaw = raw.market != null ? String(raw.market).trim().toLowerCase() : '';
    return marketRaw || null;
  }

  normalizeCurrencyForAnalytics(channel, currency, channelMarketNorm) {
    const c = currency ? String(currency).trim().toUpperCase() : '';
    if (channel === 'cdon' || channel === 'fyndiq') {
      if (channelMarketNorm === 'se') return 'SEK';
      if (channelMarketNorm === 'dk') return 'DKK';
      if (channelMarketNorm === 'fi') return 'EUR';
      if (channelMarketNorm === 'no') return 'NOK';
    }
    return c || 'SEK';
  }

  normalizeCustomerIdentifierForAnalytics(channel, customer) {
    const c = customer && typeof customer === 'object' ? customer : null;
    if (!c) return null;
    if (channel === 'cdon' || channel === 'fyndiq') {
      const phone = c.phone != null ? String(c.phone) : '';
      const normalized = phone.replace(/[^0-9+]/g, '').trim();
      return normalized || null;
    }
    const email = c.email != null ? String(c.email).trim().toLowerCase() : '';
    return email || null;
  }

  stableStringify(value) {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    if (value instanceof Date) {
      return JSON.stringify(value.toISOString());
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value).sort();
      return `{${keys
        .map((key) => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value);
  }

  buildSyncFingerprint(record) {
    return crypto.createHash('sha256').update(this.stableStringify(record)).digest('hex');
  }

  normalizeOrderForStorage(order) {
    const channel = String(order?.channel || '')
      .trim()
      .toLowerCase();
    const channelOrderId = String(order?.channelOrderId || '').trim();
    if (!channel || !channelOrderId) {
      throw new AppError(
        'channel and channelOrderId are required',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
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

    let orderRaw = null;
    if (order?.raw && typeof order.raw === 'object') {
      orderRaw = order.raw;
    } else if (typeof order?.raw === 'string') {
      try {
        orderRaw = JSON.parse(order.raw);
      } catch {
        orderRaw = null;
      }
    }

    const channelLabel =
      typeof order?.channelLabel === 'string' && order.channelLabel.trim() !== ''
        ? order.channelLabel.trim()
        : null;
    const channelMarketNorm = this.getChannelMarket(orderRaw);
    const currencyNorm = this.normalizeCurrencyForAnalytics(channel, currency, channelMarketNorm);
    const customerIdentifierNorm = this.normalizeCustomerIdentifierForAnalytics(
      channel,
      order?.customer,
    );

    const items = Array.isArray(order?.items)
      ? order.items
          .map((item) => {
            const qty = Number(item?.quantity);
            if (!Number.isFinite(qty) || qty <= 0) return null;
            const sku = item?.sku != null ? String(item.sku).trim() : null;
            const title = item?.title != null ? String(item.title).trim() : null;
            const unitPrice = item?.unitPrice != null ? Number(item.unitPrice) : null;
            const vatRate = item?.vatRate != null ? Number(item.vatRate) : null;
            return {
              sku: sku || null,
              productId: item?.productId != null ? Number(item.productId) : null,
              title: title || null,
              quantity: Math.trunc(qty),
              unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
              vatRate: Number.isFinite(vatRate) ? vatRate : null,
              raw: item?.raw ?? null,
            };
          })
          .filter(Boolean)
      : [];

    return {
      channel,
      channelOrderId,
      channelInstanceId,
      platformOrderNumber:
        order?.platformOrderNumber != null ? String(order.platformOrderNumber) : null,
      placedAt,
      totalAmount: Number.isFinite(totalAmount) ? totalAmount : null,
      currency: currency || null,
      status: status || null,
      shippingAddress: order?.shippingAddress || null,
      billingAddress: order?.billingAddress || null,
      customer: order?.customer || null,
      raw: orderRaw,
      channelLabel,
      channelMarketNorm,
      currencyNorm,
      customerIdentifierNorm,
      items,
    };
  }

  buildEffectiveSyncRecord(record) {
    return {
      channel: record.channel,
      channelOrderId: record.channelOrderId,
      channelInstanceId: record.channelInstanceId ?? null,
      platformOrderNumber: record.platformOrderNumber ?? null,
      placedAt: record.placedAt ? this.toISOUTC(record.placedAt) : null,
      totalAmount: record.totalAmount ?? null,
      currency: record.currency ?? null,
      status: record.status ?? null,
      shippingAddress: record.shippingAddress ?? null,
      billingAddress: record.billingAddress ?? null,
      customer: record.customer ?? null,
      channelLabel: record.channelLabel ?? null,
      channelMarketNorm: record.channelMarketNorm ?? null,
      currencyNorm: record.currencyNorm ?? null,
      customerIdentifierNorm: record.customerIdentifierNorm ?? null,
    };
  }

  buildPreparedFingerprint(prepared) {
    return this.buildSyncFingerprint(this.buildEffectiveSyncRecord(prepared));
  }

  mergePreparedWithExisting(existing, prepared) {
    return {
      channel: prepared.channel,
      channelOrderId: prepared.channelOrderId,
      channelInstanceId: prepared.channelInstanceId,
      platformOrderNumber:
        prepared.platformOrderNumber != null
          ? prepared.platformOrderNumber
          : (existing.platform_order_number ?? null),
      placedAt: existing.placed_at || prepared.placedAt || null,
      totalAmount:
        prepared.totalAmount != null ? prepared.totalAmount : (existing.total_amount ?? null),
      currency: prepared.currency != null ? prepared.currency : (existing.currency ?? null),
      status: prepared.status != null ? prepared.status : (existing.status ?? null),
      shippingAddress:
        prepared.shippingAddress != null
          ? prepared.shippingAddress
          : (existing.shipping_address ?? null),
      billingAddress:
        prepared.billingAddress != null
          ? prepared.billingAddress
          : (existing.billing_address ?? null),
      customer: prepared.customer != null ? prepared.customer : (existing.customer ?? null),
      raw: prepared.raw != null ? prepared.raw : (existing.raw ?? null),
      channelLabel:
        prepared.channelLabel != null ? prepared.channelLabel : (existing.channel_label ?? null),
      channelMarketNorm:
        prepared.channelMarketNorm != null
          ? prepared.channelMarketNorm
          : (existing.channel_market_norm ?? null),
      currencyNorm:
        prepared.currencyNorm != null ? prepared.currencyNorm : (existing.currency_norm ?? null),
      customerIdentifierNorm:
        prepared.customerIdentifierNorm != null
          ? prepared.customerIdentifierNorm
          : (existing.customer_identifier_norm ?? null),
    };
  }

  chunkArray(items, size = OrdersModel.SYNC_BATCH_SIZE) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  async allocateOrderNumbers(tx, userId, count) {
    if (!count) return [];
    const res = await tx.query(
      `
      INSERT INTO ${OrdersModel.ORDER_NUMBER_COUNTER_TABLE} (user_id, next_number)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE
      SET next_number = ${OrdersModel.ORDER_NUMBER_COUNTER_TABLE}.next_number + $2
      RETURNING next_number
      `,
      [userId, count],
    );
    const latest = Number(res[0]?.next_number ?? count);
    const first = latest - count + 1;
    return Array.from({ length: count }, (_, idx) => first + idx);
  }

  async insertOrderItems(tx, orderId, items) {
    if (!items.length) return;
    const values = [];
    const params = [];
    for (const item of items) {
      params.push(
        Number(orderId),
        item.sku || null,
        item.productId != null ? Number(item.productId) : null,
        item.title || null,
        Math.trunc(item.quantity),
        item.unitPrice != null ? item.unitPrice : null,
        item.vatRate != null ? item.vatRate : null,
        item.raw ? JSON.stringify(item.raw) : null,
      );
      const offset = params.length - 7;
      values.push(
        `($${offset}, $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, NOW())`,
      );
    }
    await tx.query(
      `
      INSERT INTO ${OrdersModel.ITEMS_TABLE} (
        order_id, sku, product_id, title, quantity, unit_price, vat_rate, raw, created_at
      )
      VALUES ${values.join(', ')}
      `,
      params,
    );
  }

  async loadProductIdsByChannelExternalId(req, channel, externalIds, instanceId = null) {
    const db = Database.get(req);
    const userId = req.session?.user?.id;
    if (!userId || !Array.isArray(externalIds) || externalIds.length === 0) return new Map();
    const ch = String(channel || '')
      .trim()
      .toLowerCase();
    if (!ch) return new Map();
    const ids = Array.from(
      new Set(externalIds.map((id) => String(id || '').trim()).filter(Boolean)),
    );
    if (!ids.length) return new Map();
    const rows = await db.query(
      `SELECT external_id, product_id
       FROM channel_product_map
       WHERE user_id = $1
         AND channel = $2
         AND (channel_instance_id IS NOT DISTINCT FROM $3)
         AND external_id = ANY($4::text[])`,
      [userId, ch, instanceId != null ? Number(instanceId) : null, ids],
    );
    return new Map(
      rows
        .filter((row) => row.external_id != null && row.product_id != null)
        .map((row) => [String(row.external_id), String(row.product_id)]),
    );
  }

  async loadWooProductIdsByExternalId(req, instanceId, externalIds) {
    const db = Database.get(req);
    const userId = req.session?.user?.id;
    if (!userId || !Array.isArray(externalIds) || externalIds.length === 0) return new Map();
    const ids = Array.from(
      new Set(externalIds.map((id) => String(id || '').trim()).filter(Boolean)),
    );
    if (!ids.length) return new Map();
    const rows = await db.query(
      `SELECT external_id, product_id
       FROM channel_product_map
       WHERE user_id = $1
         AND channel = 'woocommerce'
         AND channel_instance_id = $2
         AND external_id = ANY($3::text[])`,
      [userId, Number(instanceId), ids],
    );
    return new Map(
      rows
        .filter((row) => row.external_id != null)
        .map((row) => [String(row.external_id), String(row.product_id)]),
    );
  }

  async ingestBatch(req, orders) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const prepared = Array.isArray(orders)
        ? orders.map((order) => this.normalizeOrderForStorage(order))
        : [];
      if (!prepared.length) {
        return {
          results: [],
          createdCount: 0,
          changedCount: 0,
          skippedCount: 0,
          inventoryAdjustments: [],
        };
      }

      const groups = new Map();
      prepared.forEach((item, index) => {
        const key = `${item.channel}::${item.channelInstanceId ?? 'null'}`;
        const list = groups.get(key) || [];
        list.push({ index, item });
        groups.set(key, list);
      });

      return await db.transaction(async (tx) => {
        const existingByKey = new Map();
        for (const [groupKey, entries] of groups.entries()) {
          const [channel, instanceKey] = groupKey.split('::');
          const channelInstanceId = instanceKey === 'null' ? null : Number(instanceKey);
          const channelOrderIds = Array.from(
            new Set(entries.map((entry) => entry.item.channelOrderId).filter(Boolean)),
          );
          const rows = await tx.query(
            `SELECT id, channel_order_id, platform_order_number, placed_at, total_amount, currency, status,
                    shipping_address, billing_address, customer, raw, channel_label,
                    channel_market_norm, currency_norm, customer_identifier_norm, sync_fingerprint
             FROM ${OrdersModel.ORDERS_TABLE}
             WHERE user_id = $1
               AND channel = $2
               AND (channel_instance_id IS NOT DISTINCT FROM $3)
               AND channel_order_id = ANY($4::text[])`,
            [userId, channel, channelInstanceId, channelOrderIds],
          );
          for (const row of rows) {
            existingByKey.set(`${groupKey}::${String(row.channel_order_id)}`, row);
          }
        }

        const results = new Array(prepared.length);
        const creates = [];
        const updates = [];

        prepared.forEach((item, index) => {
          const key = `${item.channel}::${item.channelInstanceId ?? 'null'}::${item.channelOrderId}`;
          const existing = existingByKey.get(key);
          if (!existing) {
            creates.push({ index, item });
            return;
          }
          const merged = this.mergePreparedWithExisting(existing, item);
          const nextFingerprint = this.buildSyncFingerprint(this.buildEffectiveSyncRecord(merged));
          if (existing.sync_fingerprint && existing.sync_fingerprint === nextFingerprint) {
            results[index] = {
              created: false,
              changed: false,
              unchanged: true,
              orderId: Number(existing.id),
            };
            return;
          }
          updates.push({ index, existing, merged, nextFingerprint });
        });

        const allocatedNumbers = await this.allocateOrderNumbers(tx, userId, creates.length);
        creates.forEach((entry, idx) => {
          entry.orderNumber = allocatedNumbers[idx];
          entry.fingerprint = this.buildPreparedFingerprint(entry.item);
        });

        const inventoryAdjustments = new Map();
        let createdCount = 0;
        let changedCount = 0;
        let skippedCount = 0;

        for (const entry of updates) {
          const { index, existing, merged, nextFingerprint } = entry;
          await tx.query(
            `UPDATE ${OrdersModel.ORDERS_TABLE}
             SET
               platform_order_number = $3,
               total_amount = $4,
               currency = $5,
               status = $6,
               shipping_address = $7,
               billing_address = $8,
               customer = $9,
               raw = $10,
               channel_label = $11,
               channel_market_norm = $12,
               currency_norm = $13,
               customer_identifier_norm = $14,
               sync_fingerprint = $15,
               updated_at = NOW()
             WHERE user_id = $1 AND id = $2`,
            [
              userId,
              Number(existing.id),
              merged.platformOrderNumber,
              merged.totalAmount,
              merged.currency,
              merged.status,
              merged.shippingAddress ? JSON.stringify(merged.shippingAddress) : null,
              merged.billingAddress ? JSON.stringify(merged.billingAddress) : null,
              merged.customer ? JSON.stringify(merged.customer) : null,
              merged.raw ? JSON.stringify(merged.raw) : null,
              merged.channelLabel,
              merged.channelMarketNorm,
              merged.currencyNorm,
              merged.customerIdentifierNorm,
              nextFingerprint,
            ],
          );
          results[index] = {
            created: false,
            changed: true,
            unchanged: false,
            orderId: Number(existing.id),
          };
          changedCount += 1;
        }

        for (const entry of creates) {
          const { index, item, orderNumber, fingerprint } = entry;
          try {
            const createRes = await tx.query(
              `
              INSERT INTO ${OrdersModel.ORDERS_TABLE} (
                user_id, channel, channel_order_id, channel_instance_id, channel_label, platform_order_number,
                order_number, placed_at, total_amount, currency, status, shipping_address, billing_address,
                customer, raw, channel_market_norm, currency_norm, customer_identifier_norm, sync_fingerprint,
                created_at, updated_at
              )
              VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, COALESCE($10, 'SEK'), COALESCE($11, 'processing'), $12, $13,
                $14, $15, $16, $17, $18, $19,
                NOW(), NOW()
              )
              RETURNING id
              `,
              [
                userId,
                item.channel,
                item.channelOrderId,
                item.channelInstanceId,
                item.channelLabel,
                item.platformOrderNumber,
                orderNumber,
                item.placedAt,
                item.totalAmount,
                item.currency,
                item.status,
                item.shippingAddress ? JSON.stringify(item.shippingAddress) : null,
                item.billingAddress ? JSON.stringify(item.billingAddress) : null,
                item.customer ? JSON.stringify(item.customer) : null,
                item.raw ? JSON.stringify(item.raw) : null,
                item.channelMarketNorm,
                item.currencyNorm,
                item.customerIdentifierNorm,
                fingerprint,
              ],
            );
            const orderId = Number(createRes[0].id);
            await this.insertOrderItems(tx, orderId, item.items);
            for (const orderItem of item.items) {
              const pid =
                orderItem.productId != null && Number.isFinite(Number(orderItem.productId))
                  ? Number(orderItem.productId)
                  : null;
              if (pid == null) continue;
              inventoryAdjustments.set(
                pid,
                (inventoryAdjustments.get(pid) || 0) + orderItem.quantity,
              );
            }
            results[index] = {
              created: true,
              changed: false,
              unchanged: false,
              orderId,
            };
            createdCount += 1;
          } catch (err) {
            const pgCode = err?.details?.code ?? err?.code;
            const rawMsg = String(err?.details?.originalError ?? err?.message ?? '');
            const isDuplicate =
              pgCode === '23505' &&
              (rawMsg.includes('ux_orders_user_order_number') ||
                rawMsg.includes('channel_order_id') ||
                rawMsg.includes('ux_orders_user_channel_instance_order'));
            if (!isDuplicate) throw err;
            const recheck = await tx.query(
              `SELECT id FROM ${OrdersModel.ORDERS_TABLE}
               WHERE user_id = $1 AND channel = $2 AND (channel_instance_id IS NOT DISTINCT FROM $4) AND channel_order_id = $3
               LIMIT 1`,
              [userId, item.channel, item.channelOrderId, item.channelInstanceId],
            );
            if (!recheck.length) throw err;
            results[index] = {
              created: false,
              changed: false,
              unchanged: true,
              orderId: Number(recheck[0].id),
            };
            skippedCount += 1;
          }
        }

        skippedCount +=
          results.filter((result) => result && result.unchanged).length - skippedCount;

        return {
          results,
          createdCount,
          changedCount,
          skippedCount,
          inventoryAdjustments: Array.from(inventoryAdjustments.entries()).map(
            ([productId, quantity]) => ({
              productId,
              quantity,
            }),
          ),
        };
      });
    } catch (error) {
      Logger.error('Order batch ingest failed', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Order batch ingest failed', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async upsertCustomerFirstOrder(db, { userId, orderId, placedAt, customerIdentifierNorm }) {
    if (!customerIdentifierNorm) return;
    await db.query(
      `
      INSERT INTO ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE} (
        user_id,
        customer_identifier_norm,
        first_order_id,
        first_order_at
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, customer_identifier_norm) DO UPDATE
      SET
        first_order_id = CASE
          WHEN EXCLUDED.first_order_at IS NULL THEN ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE}.first_order_id
          WHEN ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE}.first_order_at IS NULL THEN EXCLUDED.first_order_id
          WHEN EXCLUDED.first_order_at < ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE}.first_order_at THEN EXCLUDED.first_order_id
          WHEN EXCLUDED.first_order_at = ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE}.first_order_at
            AND EXCLUDED.first_order_id < ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE}.first_order_id THEN EXCLUDED.first_order_id
          ELSE ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE}.first_order_id
        END,
        first_order_at = CASE
          WHEN EXCLUDED.first_order_at IS NULL THEN ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE}.first_order_at
          WHEN ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE}.first_order_at IS NULL THEN EXCLUDED.first_order_at
          WHEN EXCLUDED.first_order_at < ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE}.first_order_at THEN EXCLUDED.first_order_at
          WHEN EXCLUDED.first_order_at = ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE}.first_order_at
            AND EXCLUDED.first_order_id < ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE}.first_order_id THEN EXCLUDED.first_order_at
          ELSE ${OrdersModel.CUSTOMER_FIRST_ORDERS_TABLE}.first_order_at
        END,
        updated_at = NOW()
      `,
      [userId, customerIdentifierNorm, orderId, placedAt],
    );
  }

  /**
   * Whitelist ORDER BY for list (no user SQL fragments).
   * @param {'placed'|'channel'|'order_number'|'customer'|'total'|'status'} sortKey
   * @param {'asc'|'desc'} orderDir
   */
  static buildListOrderBy(sortKey, orderDir) {
    const dir = orderDir === 'asc' ? 'ASC' : 'DESC';
    const idDir = orderDir === 'asc' ? 'ASC' : 'DESC';
    switch (sortKey) {
      case 'channel':
        return `lower(coalesce(nullif(trim(channel_label::text), ''), channel::text)) ${dir}, id ${idDir}`;
      case 'order_number':
        return `order_number ${dir}, id ${idDir}`;
      case 'customer':
        return `lower(coalesce(
          nullif(trim(shipping_address->>'full_name'), ''),
          nullif(trim(concat_ws(' ', shipping_address->>'first_name', shipping_address->>'last_name')), ''),
          nullif(trim(customer->>'email'), ''),
          ''
        )) ${dir} NULLS LAST, id ${idDir}`;
      case 'total':
        return `total_amount ${dir} NULLS LAST, id ${idDir}`;
      case 'status':
        return `status ${dir}, id ${idDir}`;
      case 'placed':
      default:
        return `placed_at ${dir} NULLS LAST, id ${idDir}`;
    }
  }

  /**
   * Full-text-ish search across persisted order fields (DB), not only the current page.
   * Uses case-insensitive substring match via position(lower(needle) in lower(haystack)).
   */
  async list(
    req,
    {
      status,
      channel,
      from,
      to,
      limit = 100,
      offset = 0,
      q: qRaw = null,
      sort: sortRaw = 'placed',
      order: orderRaw = 'desc',
    } = {},
  ) {
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

      const ALLOWED_SORT = new Set([
        'placed',
        'channel',
        'order_number',
        'customer',
        'total',
        'status',
      ]);
      const sortKey = ALLOWED_SORT.has(String(sortRaw).trim().toLowerCase())
        ? String(sortRaw).trim().toLowerCase()
        : 'placed';
      const orderDir = String(orderRaw).trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
      const orderBySql = OrdersModel.buildListOrderBy(sortKey, orderDir);

      const qStr = qRaw != null ? String(qRaw).trim() : '';
      if (qStr.length > 0) {
        const needle = qStr.slice(0, 200).toLowerCase();
        params.push(needle);
        const qIdx = params.length;
        clauses.push(`(
          position($${qIdx}::text in lower(coalesce(channel_order_id::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(platform_order_number::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(order_number::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(shipping_tracking_number::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(channel_label::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(status::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(channel::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(currency::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(shipping_carrier::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(total_amount::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(customer::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(shipping_address::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(billing_address::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(raw::text, ''))) > 0
          OR position($${qIdx}::text in lower(coalesce(channel_instance_id::text, ''))) > 0
        )`);
      }

      const allowedLimits = new Set([25, 50, 100, 150, 200, 250]);
      const limitNum = Number(limit);
      const limitVal = allowedLimits.has(limitNum) ? limitNum : 100;
      params.push(limitVal);
      const limitIdx = params.length;
      params.push(Math.max(Number(offset) || 0, 0));
      const offsetIdx = params.length;

      const countSql = `
        SELECT COUNT(*)::int AS total
        FROM ${OrdersModel.ORDERS_TABLE}
        WHERE ${clauses.join(' AND ')}
      `;
      const dataSql = `
        SELECT
          id,
          user_id,
          channel,
          channel_order_id,
          channel_instance_id,
          channel_label,
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
        ORDER BY ${orderBySql}
        LIMIT $${limitIdx}
        OFFSET $${offsetIdx}
      `;
      const [countRes, dataRes] = await Promise.all([
        db.query(countSql, params.slice(0, params.length - 2)),
        db.query(dataSql, params),
      ]);
      const total = (countRes[0]?.total ?? 0) || 0;
      const items = dataRes.map((r) => this.transformOrderRow(r));
      return { items, total };
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
      // Join products to get sku for display (SKU column). Product-ID comes from order_items.product_id only.
      const itemsRes = await db.query(
        `SELECT oi.*, p.sku AS product_sku
         FROM ${OrdersModel.ITEMS_TABLE} oi
         INNER JOIN ${OrdersModel.ORDERS_TABLE} o ON o.id = oi.order_id AND o.user_id = $1
         LEFT JOIN products p ON p.user_id = o.user_id AND p.id = oi.product_id
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
        [
          userId,
          Number(id),
          status ? String(status) : null,
          carrier ? String(carrier) : null,
          trackingNumber ? String(trackingNumber) : null,
        ],
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
        throw new AppError(
          'Too many orders (max 500 per request)',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
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
      if (!res.length)
        throw new AppError('Failed to allocate order number', 500, AppError.CODES.DATABASE_ERROR);
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
    const batch = await this.ingestBatch(req, [order]);
    return batch.results[0] || { created: false, changed: false, unchanged: true, orderId: null };
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
      await db.query(`DELETE FROM ${OrdersModel.ORDERS_TABLE} WHERE user_id = $1`, [userId]);
      await db.query(`DELETE FROM ${OrdersModel.ORDER_NUMBER_COUNTER_TABLE} WHERE user_id = $1`, [
        userId,
      ]);

      // --- Public schema: clear any leftover order data (e.g. after migration public → tenant) ---
      await db.query(
        `DELETE FROM public.${OrdersModel.ITEMS_TABLE}
         WHERE order_id IN (SELECT id FROM public.${OrdersModel.ORDERS_TABLE} WHERE user_id = $1)`,
        [userId],
      );
      await db.query(`DELETE FROM public.${OrdersModel.ORDERS_TABLE} WHERE user_id = $1`, [userId]);
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
        SET next_number = (
          SELECT COALESCE(MAX(order_number), 0) + 1
          FROM ${OrdersModel.ORDERS_TABLE}
          WHERE user_id = $1
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
    const channelLabel =
      row.channel_label != null && String(row.channel_label).trim() !== ''
        ? String(row.channel_label).trim()
        : null;
    return {
      id: String(row.id),
      channel: row.channel,
      channelOrderId: row.channel_order_id,
      channelInstanceId: row.channel_instance_id != null ? Number(row.channel_instance_id) : null,
      channelLabel,
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
    // SKU in UI = Egen referens. Single source: products.sku (from joined product).
    const sku =
      row.product_sku != null && String(row.product_sku).trim() !== ''
        ? String(row.product_sku).trim()
        : null;
    return {
      id: String(row.id),
      orderId: String(row.order_id),
      sku,
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
