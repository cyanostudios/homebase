// plugins/orders/controller.js
// Orders API: list, get, status update, and normalized ingest + inventory sync (MVP).

const { Logger, Context, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const WooCommerceModel = require('../woocommerce-products/model');
const WooCommerceController = require('../woocommerce-products/controller');
const CdonProductsModel = require('../cdon-products/model');
const FyndiqProductsModel = require('../fyndiq-products/model');

class OrdersController {
  constructor(model) {
    this.model = model;

    // Cross-plugin helpers (server-side only)
    this.wooModel = new WooCommerceModel();
    this.wooController = new WooCommerceController(this.wooModel);
    this.cdonModel = new CdonProductsModel();
    this.fyndiqModel = new FyndiqProductsModel();
  }

  async list(req, res) {
    try {
      const status = req.query?.status ? String(req.query.status).trim().toLowerCase() : null;
      const channel = req.query?.channel ? String(req.query.channel).trim().toLowerCase() : null;
      const from = req.query?.from ? new Date(String(req.query.from)) : null;
      const to = req.query?.to ? new Date(String(req.query.to)) : null;
      const limit = req.query?.limit != null ? Number(req.query.limit) : undefined;
      const offset = req.query?.offset != null ? Number(req.query.offset) : undefined;

      const items = await this.model.list(req, { status, channel, from, to, limit, offset });
      return res.json(items);
    } catch (error) {
      Logger.error('Orders list error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to list orders' });
    }
  }

  async getById(req, res) {
    try {
      const order = await this.model.getById(req, req.params.id);
      return res.json(order);
    } catch (error) {
      Logger.error('Orders get error', error, { userId: Context.getUserId(req), id: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to fetch order' });
    }
  }

  async updateStatus(req, res) {
    try {
      const status = req.body?.status ? String(req.body.status).trim().toLowerCase() : null;
      const carrier = req.body?.carrier ? String(req.body.carrier).trim() : null;
      const trackingNumber = req.body?.trackingNumber ? String(req.body.trackingNumber).trim() : null;

      const updated = await this.model.updateStatus(req, req.params.id, {
        status,
        carrier,
        trackingNumber,
      });

      // Best-effort push to channel (Woo implemented; others stubbed)
      await this.syncStatusToChannel(req, updated).catch((err) => {
        Logger.warn('Order status sync failed (non-fatal)', err, { orderId: updated?.id, channel: updated?.channel });
      });

      return res.json(updated);
    } catch (error) {
      Logger.error('Orders status update error', error, { userId: Context.getUserId(req), id: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to update order status' });
    }
  }

  /**
   * Normalized ingest endpoint (internal): creates order idempotently, then applies inventory sync.
   */
  async ingest(req, res) {
    try {
      const payload = req.body || {};
      const created = await this.model.ingest(req, payload);

      if (created.created && created.orderId) {
        await this.applyInventoryFromOrder(req, created.orderId, String(payload.channel || '').trim().toLowerCase());
      }

      return res.json({ ok: true, ...created });
    } catch (error) {
      Logger.error('Orders ingest error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to ingest order' });
    }
  }

  // ----------------- Inventory sync (MVP) -----------------

  async applyInventoryFromOrder(req, orderId, sourceChannel) {
    const db = Database.get(req);
    const userId = req.session?.user?.id || req.session?.user?.uuid;
    if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

    const items = await db.query(
      `SELECT oi.sku, oi.product_id, oi.quantity
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id AND o.user_id = $1
       WHERE oi.order_id = $2
       ORDER BY oi.id`,
      [userId, Number(orderId)],
    );
    if (!items.length) return;

    // Aggregate qty by product_id (preferred) or SKU
    const byProductId = new Map(); // productId -> qty
    const bySku = new Map(); // sku -> qty
    for (const it of items) {
      const qty = Number(it?.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const pid = it?.product_id != null ? Number(it.product_id) : null;
      if (pid != null && Number.isFinite(pid)) {
        byProductId.set(pid, (byProductId.get(pid) || 0) + Math.trunc(qty));
        continue;
      }

      const sku = String(it?.sku || '').trim();
      if (!sku) continue;
      bySku.set(sku, (bySku.get(sku) || 0) + Math.trunc(qty));
    }
    if (!byProductId.size && !bySku.size) return;

    for (const [pid, qty] of byProductId.entries()) {
      const updated = await db.query(
        `
        UPDATE products
        SET quantity = GREATEST(quantity - $3, 0),
            updated_at = NOW()
        WHERE user_id = $1 AND id = $2
        RETURNING id, sku, quantity
        `,
        [userId, pid, qty],
      );
      if (!updated.length) continue;

      const productId = String(updated[0].id);
      const sku = String(updated[0].sku || '').trim();
      const newQty = Number(updated[0].quantity);

      // Push new stock to other enabled channels for this product
      await this.pushStockToChannels(req, {
        productId,
        sku,
        quantity: newQty,
        sourceChannel,
      });
    }

    for (const [sku, qty] of bySku.entries()) {
      const updated = await db.query(
        `
        UPDATE products
        SET quantity = GREATEST(quantity - $3, 0),
            updated_at = NOW()
        WHERE user_id = $1 AND sku = $2
        RETURNING id, sku, quantity
        `,
        [userId, sku, qty],
      );
      if (!updated.length) continue;

      const productId = String(updated[0].id);
      const newQty = Number(updated[0].quantity);

      await this.pushStockToChannels(req, {
        productId,
        sku,
        quantity: newQty,
        sourceChannel,
      });
    }
  }

  async pushStockToChannels(req, { productId, sku, quantity, sourceChannel }) {
    const db = Database.get(req);
    const userId = req.session?.user?.id || req.session?.user?.uuid;
    if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

    const rows = await db.query(
      `
      SELECT channel, enabled, external_id
      FROM channel_product_map
      WHERE user_id = $1
        AND product_id = $2
        AND enabled = TRUE
      `,
      [userId, String(productId)],
    );

    for (const r of rows) {
      const channel = String(r.channel || '').trim().toLowerCase();
      if (!channel || channel === sourceChannel) continue;

      if (channel === 'woocommerce') {
        await this.syncWooStock(req, {
          productId: String(productId),
          sku,
          quantity,
          externalId: r.external_id != null ? String(r.external_id) : null,
        });
        continue;
      }

      if (channel === 'cdon') {
        await this.cdonModel.upsertChannelMap(req, {
          productId,
          channel: 'cdon',
          enabled: true,
          externalId: r.external_id != null ? String(r.external_id) : null,
          status: 'error',
          error: 'Stock sync not implemented yet',
        });
        await this.cdonModel.logChannelError(req, {
          channel: 'cdon',
          productId,
          payload: { sku, quantity },
          response: null,
          message: 'Stock sync not implemented yet',
        });
        continue;
      }

      if (channel === 'fyndiq') {
        await this.fyndiqModel.upsertChannelMap(req, {
          productId,
          channel: 'fyndiq',
          enabled: true,
          externalId: r.external_id != null ? String(r.external_id) : null,
          status: 'error',
          error: 'Stock sync not implemented yet',
        });
        await this.fyndiqModel.logChannelError(req, {
          channel: 'fyndiq',
          productId,
          payload: { sku, quantity },
          response: null,
          message: 'Stock sync not implemented yet',
        });
      }
    }
  }

  async syncWooStock(req, { productId, sku, quantity, externalId }) {
    const settings = await this.wooModel.getSettings(req);
    if (!settings?.storeUrl || !settings?.consumerKey || !settings?.consumerSecret) {
      await this.wooModel.upsertChannelMap(req, {
        productId,
        channel: 'woocommerce',
        externalId: externalId || null,
        status: 'error',
        error: 'Woo settings missing; cannot sync stock',
      });
      return;
    }

    const base = this.wooController.normalizeBaseUrl(settings.storeUrl);

    // Resolve Woo product ID
    let wooId = null;
    if (externalId && Number.isFinite(Number(externalId))) wooId = Number(externalId);
    if (!wooId) {
      const found = await this.wooController.findWooProductBySku(base, sku, settings).catch(() => null);
      if (found?.id) wooId = Number(found.id);
    }

    if (!wooId) {
      await this.wooModel.upsertChannelMap(req, {
        productId,
        channel: 'woocommerce',
        externalId: null,
        status: 'error',
        error: `Woo product not found for SKU "${sku}"`,
      });
      await this.wooModel.logChannelError(req, {
        channel: 'woocommerce',
        productId,
        payload: { sku, quantity },
        response: null,
        message: `Woo product not found for SKU "${sku}"`,
      });
      return;
    }

    const url = `${base}/wp-json/wc/v3/products/${wooId}`;
    const resp = await this.wooController.fetchWithWooAuth(
      url,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manage_stock: true, stock_quantity: Number(quantity) }),
      },
      settings,
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      await this.wooModel.upsertChannelMap(req, {
        productId,
        channel: 'woocommerce',
        externalId: wooId,
        status: 'error',
        error: text || 'Stock sync failed',
      });
      await this.wooModel.logChannelError(req, {
        channel: 'woocommerce',
        productId,
        payload: { sku, quantity, wooId },
        response: { status: resp.status, statusText: resp.statusText, body: text },
        message: 'Woo stock sync failed',
      });
      return;
    }

    await this.wooModel.upsertChannelMap(req, {
      productId,
      channel: 'woocommerce',
      externalId: wooId,
      status: 'success',
      error: null,
    });
  }

  // ----------------- Status push to channels (MVP) -----------------

  mapHomebaseStatusToWoo(status) {
    switch (String(status || '').toLowerCase()) {
      case 'processing':
      case 'behandlas':
        return 'processing';
      case 'shipped':
      case 'skickad':
        return 'completed';
      case 'delivered':
      case 'levererad':
        return 'completed';
      case 'cancelled':
      case 'annulerad':
        return 'cancelled';
      default:
        return 'processing';
    }
  }

  async syncStatusToChannel(req, order) {
    const channel = String(order?.channel || '').trim().toLowerCase();
    const channelOrderId = String(order?.channelOrderId || '').trim();
    const status = String(order?.status || '').trim().toLowerCase();

    if (!channel || !channelOrderId) return;

    if (channel === 'woocommerce') {
      const settings = await this.wooModel.getSettings(req);
      if (!settings?.storeUrl || !settings?.consumerKey || !settings?.consumerSecret) return;

      const base = this.wooController.normalizeBaseUrl(settings.storeUrl);
      const url = `${base}/wp-json/wc/v3/orders/${encodeURIComponent(channelOrderId)}`;
      const resp = await this.wooController.fetchWithWooAuth(
        url,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: this.mapHomebaseStatusToWoo(status) }),
        },
        settings,
      );
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        await this.wooModel.logChannelError(req, {
          channel: 'woocommerce',
          productId: null,
          payload: { channelOrderId, status },
          response: { status: resp.status, statusText: resp.statusText, body: text },
          message: 'Woo order status sync failed',
        });
      }
      return;
    }

    // CDON/Fyndiq: placeholder (will be implemented in connector plugins)
    if (channel === 'cdon') {
      await this.cdonModel.logChannelError(req, {
        channel: 'cdon',
        productId: null,
        payload: { channelOrderId, status },
        response: null,
        message: 'CDON order status sync not implemented yet',
      });
    }
    if (channel === 'fyndiq') {
      await this.fyndiqModel.logChannelError(req, {
        channel: 'fyndiq',
        productId: null,
        payload: { channelOrderId, status },
        response: null,
        message: 'Fyndiq order status sync not implemented yet',
      });
    }
  }

  // DELETE /api/orders (delete all orders for current user)
  async deleteAll(req, res) {
    try {
      const result = await this.model.deleteAll(req);
      return res.json({ ok: true, ...result });
    } catch (error) {
      Logger.error('Delete all orders error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to delete all orders' });
    }
  }

  // PUT /api/orders/batch/status - Batch update status for multiple orders
  async batchUpdateStatus(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res.status(400).json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const status = req.body?.status ? String(req.body.status).trim().toLowerCase() : null;
      const carrier = req.body?.carrier ? String(req.body.carrier).trim() : null;
      const trackingNumber = req.body?.trackingNumber ? String(req.body.trackingNumber).trim() : null;

      if (!status) {
        return res.status(400).json({ error: 'status is required', code: 'VALIDATION_ERROR' });
      }

      const result = await this.model.batchUpdateStatus(req, idsRaw, {
        status,
        carrier,
        trackingNumber,
      });

      // Best-effort sync to channels for updated orders
      if (result.updatedIds && result.updatedIds.length > 0) {
        // Fetch updated orders and sync to channels
        for (const orderId of result.updatedIds) {
          try {
            const order = await this.model.getById(req, orderId);
            if (order) {
              await this.syncStatusToChannel(req, order).catch((err) => {
                Logger.warn('Order status sync failed (non-fatal)', err, { orderId, channel: order?.channel });
              });
            }
          } catch (err) {
            Logger.warn('Failed to sync order status to channel (non-fatal)', err, { orderId });
          }
        }
      }

      return res.json({
        ok: true,
        requested: idsRaw.length,
        updated: result.updated,
        updatedIds: result.updatedIds || [],
      });
    } catch (error) {
      Logger.error('Batch update status error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to batch update order status' });
    }
  }
}

module.exports = OrdersController;

