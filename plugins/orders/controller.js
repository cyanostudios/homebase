// plugins/orders/controller.js
// Orders API: list, get, status update, and normalized ingest + inventory sync (MVP).

const { Logger, Context, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const WooCommerceModel = require('../woocommerce-products/model');
const WooCommerceController = require('../woocommerce-products/controller');
const CdonProductsController = require('../cdon-products/controller');
const CdonProductsModel = require('../cdon-products/model');
const FyndiqProductsController = require('../fyndiq-products/controller');
const FyndiqProductsModel = require('../fyndiq-products/model');

const orderSyncState = require('./orderSyncState');
const orderSyncService = require('./orderSyncService');
const puppeteer = require('puppeteer');
const { generatePlocklistaHTML } = require('./plocklistaPdfTemplate');

class OrdersController {
  constructor(model) {
    this.model = model;

    // Cross-plugin helpers (server-side only)
    this.wooModel = new WooCommerceModel();
    this.wooController = new WooCommerceController(this.wooModel);
    this.cdonModel = new CdonProductsModel();
    this.cdonController = new CdonProductsController(this.cdonModel);
    this.fyndiqModel = new FyndiqProductsModel();
    this.fyndiqController = new FyndiqProductsController(this.fyndiqModel);
  }

  normalizeUrlForMatch(url) {
    let s = String(url || '').trim();
    if (!s) return '';
    s = s.replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
    try {
      const u = new URL(s);
      const host = u.hostname.replace(/^www\./i, '').toLowerCase();
      const path = (u.pathname || '/').replace(/\/$/, '');
      const port = u.port ? `:${u.port}` : '';
      return `${host}${port}${path}`;
    } catch {
      // last resort: strip protocol + www + trailing slash
      return s
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '');
    }
  }

  extractWooStoreUrlFromOrder(order) {
    let raw = order?.raw ?? null;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }
    if (!raw || typeof raw !== 'object') return null;
    const u =
      raw?._homebase_store_url ||
      raw?.store_url ||
      raw?.storeUrl ||
      raw?.store ||
      null;
    return u != null ? String(u).trim() : null;
  }

  async getWooSettingsForOrder(req, order) {
    const instances = await this.wooModel.listInstances(req).catch(() => []);
    const hintedStoreUrl = this.extractWooStoreUrlFromOrder(order);

    if (hintedStoreUrl && instances.length > 0) {
      const targetKey = this.normalizeUrlForMatch(hintedStoreUrl);
      const match = instances.find((inst) => {
        const storeUrl = inst?.credentials?.storeUrl || inst?.credentials?.store_url;
        if (!storeUrl) return false;
        return this.normalizeUrlForMatch(storeUrl) === targetKey;
      });

      if (match?.credentials) {
        const creds = match.credentials;
        return {
          storeUrl: creds.storeUrl || creds.store_url || hintedStoreUrl,
          consumerKey: creds.consumerKey || creds.consumer_key || '',
          consumerSecret: creds.consumerSecret || creds.consumer_secret || '',
          useQueryAuth: !!creds.useQueryAuth,
          _homebase: { instanceId: match.id, instanceKey: match.instanceKey, label: match.label || null },
        };
      }
    }

    // If only one store is configured, use it (even if not marked as default).
    if (!hintedStoreUrl && instances.length === 1 && instances[0]?.credentials) {
      const creds = instances[0].credentials;
      return {
        storeUrl: creds.storeUrl || creds.store_url || '',
        consumerKey: creds.consumerKey || creds.consumer_key || '',
        consumerSecret: creds.consumerSecret || creds.consumer_secret || '',
        useQueryAuth: !!creds.useQueryAuth,
        _homebase: { instanceId: instances[0].id, instanceKey: instances[0].instanceKey, label: instances[0].label || null },
      };
    }

    // Backwards compatibility: default instance / legacy table.
    return await this.wooModel.getSettings(req);
  }

  normalizeStatusForStorage(status) {
    const s = String(status || '').trim().toLowerCase();
    if (!s) return null;
    // Internal canonical status: shipped is treated as delivered (UI only shows Delivered)
    if (s === 'shipped') return 'delivered';
    return s;
  }

  getCdonBaseUrl() {
    return 'https://merchants-api.cdon.com/api';
  }

  async validateCdonTrackingRequirement({ order, nextStatus, nextTrackingNumber }) {
    const channel = String(order?.channel || '').trim().toLowerCase();
    const status = String(nextStatus || '').trim().toLowerCase();
    if (channel !== 'cdon') return null;
    if (status !== 'delivered' && status !== 'shipped') return null;

    const total = Number(order?.totalAmount);
    const needsTracking = Number.isFinite(total) && total >= 299;
    if (!needsTracking) return null;

    const tracking = String(nextTrackingNumber || '').trim();
    if (tracking) return null;

    return {
      field: 'trackingNumber',
      message: 'Tracking number is required for CDON orders >= 299 SEK when marking as Delivered.',
    };
  }

  buildCdonTrackingInformation({ carrier, trackingNumber }) {
    const t = String(trackingNumber || '').trim();
    if (!t) return [];

    // Allow multiple tracking numbers separated by comma/semicolon/newline.
    const parts = t.split(/[,;\n]+/g).map((x) => x.trim()).filter(Boolean);
    const unique = Array.from(new Set(parts));
    const c = carrier != null && String(carrier).trim() !== '' ? String(carrier).trim() : null;

    return unique.map((num) => ({
      ...(c != null ? { carrier_name: c } : {}),
      tracking_number: num,
    }));
  }

  buildFyndiqTrackingInformation({ carrier, trackingNumber }) {
    const t = String(trackingNumber || '').trim();
    if (!t) return [];

    // Allow multiple tracking numbers separated by comma/semicolon/newline.
    const parts = t.split(/[,;\n]+/g).map((x) => x.trim()).filter(Boolean);
    const unique = Array.from(new Set(parts));
    const c = carrier != null && String(carrier).trim() !== '' ? String(carrier).trim() : null;

    return unique.map((num) => ({
      ...(c != null ? { carrier_name: c } : {}),
      tracking_number: num,
    }));
  }

  async syncStatusToCdon(req, { channelOrderId, status, carrier, trackingNumber }) {
    const settings = await this.cdonModel.getSettings(req);
    const merchantId = String(settings?.apiKey ?? '').trim();
    const apiToken = String(settings?.apiSecret ?? '').trim();
    if (!merchantId || !apiToken) {
      await this.cdonModel.logChannelError(req, {
        channel: 'cdon',
        productId: null,
        payload: { channelOrderId, status },
        response: null,
        message: 'CDON settings missing; cannot sync order status',
      });
      return;
    }

    const s = String(status || '').trim().toLowerCase();
    const base = this.getCdonBaseUrl();

    if (s === 'cancelled') {
      const url = `${base}/v1/orders/${encodeURIComponent(channelOrderId)}/cancel`;
      const { resp, text, json } = await this.cdonController.cdonRequest(url, {
        merchantId,
        apiToken,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        await this.cdonModel.logChannelError(req, {
          channel: 'cdon',
          productId: null,
          payload: { channelOrderId, status: s },
          response: { status: resp.status, statusText: resp.statusText, body: json || text },
          message: 'CDON cancel failed',
        });
      }
      return;
    }

    if (s === 'delivered' || s === 'shipped') {
      const tracking_information = this.buildCdonTrackingInformation({ carrier, trackingNumber });
      const url = `${base}/v1/orders/${encodeURIComponent(channelOrderId)}/fulfill`;
      const { resp, text, json } = await this.cdonController.cdonRequest(url, {
        merchantId,
        apiToken,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_information }),
      });
      if (!resp.ok) {
        await this.cdonModel.logChannelError(req, {
          channel: 'cdon',
          productId: null,
          payload: { channelOrderId, status: s, tracking_information },
          response: { status: resp.status, statusText: resp.statusText, body: json || text },
          message: 'CDON fulfill failed',
        });
      }
    }
  }

  async syncStatusToFyndiq(req, { channelOrderId, status, carrier, trackingNumber }, order = null) {
    const settings = await this.fyndiqModel.getSettings(req);
    const username = String(settings?.apiKey ?? '').trim();
    const password = String(settings?.apiSecret ?? '').trim();
    if (!username || !password) {
      await this.fyndiqModel.logChannelError(req, {
        channel: 'fyndiq',
        productId: null,
        payload: { channelOrderId, status },
        response: null,
        message: 'Fyndiq settings missing; cannot sync order status',
      });
      return;
    }

    const s = String(status || '').trim().toLowerCase();

    if (s === 'delivered' || s === 'shipped') {
      const tracking_information = this.buildFyndiqTrackingInformation({ carrier, trackingNumber });
      const url = `https://merchants-api.fyndiq.se/api/v1/orders/${encodeURIComponent(channelOrderId)}/fulfill`;
      Logger.info('Fyndiq fulfill', { channelOrderId, url });
      const { resp, text, json } = await this.fyndiqController.fyndiqRequest(
        `/api/v1/orders/${encodeURIComponent(channelOrderId)}/fulfill`,
        {
          username,
          password,
          method: 'PUT',
          body: JSON.stringify({ tracking_information }),
        },
      );

      if (resp.ok) {
        Logger.info('Fyndiq fulfill succeeded', { channelOrderId });
        return;
      }

      Logger.warn('Fyndiq fulfill failed', {
        channelOrderId,
        status: resp.status,
        statusText: resp.statusText,
        body: json || text,
        url,
      });
      await this.fyndiqModel.logChannelError(req, {
        channel: 'fyndiq',
        productId: null,
        payload: { channelOrderId, status: s, tracking_information },
        response: { endpoint: url, status: resp.status, statusText: resp.statusText, body: json || text },
        message: 'Fyndiq fulfill failed',
      });
      return;
    }

    if (s === 'cancelled') {
      const { url, resp, text, json } = await this.fyndiqController.fyndiqRequest(
        `/api/v1/orders/${encodeURIComponent(channelOrderId)}/cancel`,
        {
          username,
          password,
          method: 'PUT',
          body: JSON.stringify({}),
        },
      );

      if (!resp.ok) {
        Logger.warn('Fyndiq cancel failed', { channelOrderId, status: resp.status, body: json || text, url });
        await this.fyndiqModel.logChannelError(req, {
          channel: 'fyndiq',
          productId: null,
          payload: { channelOrderId, status: s },
          response: { endpoint: url, status: resp.status, statusText: resp.statusText, body: json || text },
          message: 'Fyndiq cancel failed',
        });
      }
    }
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

  /** POST /api/orders/plocklista/pdf - Generate pick list PDF for batch-selected orders. */
  async generatePlocklistaPdf(req, res) {
    let browser = null;
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw) || idsRaw.length === 0) {
        return res.status(400).json({ error: 'ids[] required (non-empty array)' });
      }

      const orders = [];
      for (const id of idsRaw) {
        try {
          const order = await this.model.getById(req, id);
          if (order) orders.push(order);
        } catch (err) {
          if (err instanceof AppError && err.statusCode === 404) continue;
          throw err;
        }
      }

      if (orders.length === 0) {
        return res.status(404).json({ error: 'No orders found for the given ids' });
      }

      const channelLabels = req.body?.channelLabels && typeof req.body.channelLabels === 'object' ? req.body.channelLabels : null;

      const payload = orders.map((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        const channel = String(order.channel || '').toLowerCase();

        const isWooShippingItem = (it) => {
          if (channel !== 'woocommerce') return false;
          const hasProductId = it.productId != null || it.product_id != null;
          if (hasProductId) return false;
          const raw = it.raw && typeof it.raw === 'object' ? it.raw : {};
          return raw.method_id != null;
        };

        const productItems = items.filter((it) => !isWooShippingItem(it));
        const shippingItems = items.filter(isWooShippingItem);

        let ordersumma = 0;
        for (const it of productItems) {
          const qty = Number(it.quantity);
          const unit = it.unitPrice != null ? Number(it.unitPrice) : 0;
          if (Number.isFinite(qty) && Number.isFinite(unit)) ordersumma += qty * unit;
        }

        const total = order.totalAmount != null ? Number(order.totalAmount) : null;
        let frakt = null;
        if (channel === 'woocommerce' && shippingItems.length > 0) {
          let shippingSum = 0;
          for (const it of shippingItems) {
            const qty = Number(it.quantity);
            const unit = it.unitPrice != null ? Number(it.unitPrice) : 0;
            if (Number.isFinite(qty) && Number.isFinite(unit)) shippingSum += qty * unit;
          }
          frakt = Number.isFinite(shippingSum) ? shippingSum : null;
        } else if (total != null && Number.isFinite(total)) {
          frakt = total - ordersumma;
          if (frakt < 0) frakt = 0;
        }

        const platformLabel = channelLabels != null && order.id != null ? (channelLabels[String(order.id)] ?? null) : null;
        const orderForTemplate = { ...order, items: productItems, platformLabel: platformLabel || undefined };
        return { order: orderForTemplate, ordersumma, frakt };
      });

      const html = generatePlocklistaHTML(payload);

      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '12mm', bottom: '16mm', left: '12mm' },
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      Logger.info('Plocklista PDF generated', { userId: Context.getUserId(req), orderCount: orders.length });

      const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="plocklista-${dateStr}.pdf"`);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (error) {
      Logger.error('Plocklista PDF generation failed', error, { userId: Context.getUserId(req) });
      return res.status(500).json({ error: 'Failed to generate plocklista PDF' });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {}
      }
    }
  }

  /** POST /api/orders/sync - Start quick-sync in background. Returns { started: true|false, reason?: 'fresh'|'locked' }. */
  async quickSync(req, res) {
    try {
      const busy = await orderSyncState.isBusyForUser(req);
      if (busy) {
        return res.json({ started: false, reason: 'locked' });
      }
      const shouldRun = await orderSyncState.shouldRunQuickSync(req);
      if (!shouldRun) {
        return res.json({ started: false, reason: 'fresh' });
      }
      setImmediate(() => {
        orderSyncService.runSync(req).catch((err) => {
          Logger.error('Quick-sync background run failed', err, { userId: Context.getUserId(req) });
        });
      });
      return res.json({ started: true });
    } catch (error) {
      Logger.error('Orders quickSync error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to start sync' });
    }
  }

  /** GET /api/orders/sync/status - { busy: boolean } for UI spinner. */
  async syncStatus(req, res) {
    try {
      const busy = await orderSyncState.isBusyForUser(req);
      return res.json({ busy: !!busy });
    } catch (error) {
      Logger.error('Orders syncStatus error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ busy: false });
    }
  }

  /** Renumber order_number by placed_at (oldest = 1, newest = highest) across all channels. */
  async renumber(req, res) {
    try {
      const result = await this.model.renumberOrderNumbersByPlacedAt(req);
      return res.json({ ok: true, ...result });
    } catch (error) {
      Logger.error('Orders renumber error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to renumber orders' });
    }
  }

  async updateStatus(req, res) {
    try {
      const statusRaw = req.body?.status ? String(req.body.status).trim().toLowerCase() : null;
      const status = this.normalizeStatusForStorage(statusRaw);
      const carrier = req.body?.carrier ? String(req.body.carrier).trim() : null;
      const trackingNumber = req.body?.trackingNumber ? String(req.body.trackingNumber).trim() : null;

      // CDON: for Delivered on orders >= 299 SEK, require tracking number (either existing or provided).
      const current = await this.model.getById(req, req.params.id);
      const effectiveTracking = trackingNumber || current?.shippingTrackingNumber || null;
      const cdonErr = await this.validateCdonTrackingRequirement({
        order: current,
        nextStatus: status,
        nextTrackingNumber: effectiveTracking,
      });
      if (cdonErr) {
        return res.status(400).json({ errors: [cdonErr] });
      }

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
      SELECT channel, enabled, external_id, channel_instance_id
      FROM channel_product_map
      WHERE user_id = $1
        AND product_id = $2
        AND (enabled = TRUE OR external_id IS NOT NULL)
      `,
      [userId, String(productId)],
    );

    for (const r of rows) {
      const channel = String(r.channel || '').trim().toLowerCase();
      if (!channel || channel === sourceChannel) continue;

      if (channel === 'woocommerce') {
        const channelInstanceId = r.channel_instance_id != null ? String(r.channel_instance_id) : null;
        await this.syncWooStock(req, {
          productId: String(productId),
          sku,
          quantity,
          externalId: r.external_id != null ? String(r.external_id) : null,
          channelInstanceId,
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

  async syncWooStock(req, { productId, sku, quantity, externalId, channelInstanceId }) {
    let settings = null;
    if (channelInstanceId) {
      const instance = await this.wooModel.getInstanceById(req, channelInstanceId);
      settings = instance?.credentials || null;
    }
    if (!settings) {
      settings = await this.wooModel.getSettings(req);
    }
    if (!settings?.storeUrl || !settings?.consumerKey || !settings?.consumerSecret) {
      await this.wooModel.upsertChannelMap(req, {
        productId,
        channel: 'woocommerce',
        channelInstanceId: channelInstanceId || null,
        externalId: externalId || null,
        status: 'error',
        error: 'Woo settings missing; cannot sync stock',
      });
      return;
    }

    const base = this.wooController.normalizeBaseUrl(settings.storeUrl);

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
        channelInstanceId: channelInstanceId || null,
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
        channelInstanceId: channelInstanceId || null,
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
      channelInstanceId: channelInstanceId || null,
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
      const settings = await this.getWooSettingsForOrder(req, order);
      if (!settings?.storeUrl || !settings?.consumerKey || !settings?.consumerSecret) {
        await this.wooModel.logChannelError(req, {
          channel: 'woocommerce',
          productId: null,
          payload: {
            channelOrderId,
            status,
            hintedStoreUrl: this.extractWooStoreUrlFromOrder(order),
          },
          response: null,
          message: 'Woo settings missing for this order; cannot sync status (check instances/default store).',
        });
        return;
      }

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
          payload: {
            channelOrderId,
            status,
            storeUrl: settings.storeUrl,
            instance: settings?._homebase || null,
          },
          response: { status: resp.status, statusText: resp.statusText, body: text },
          message: 'Woo order status sync failed',
        });
      }
      return;
    }

    if (channel === 'cdon') {
      await this.syncStatusToCdon(req, {
        channelOrderId,
        status,
        carrier: order?.shippingCarrier || null,
        trackingNumber: order?.shippingTrackingNumber || null,
      });
    }
    if (channel === 'fyndiq') {
      await this.syncStatusToFyndiq(req, {
        channelOrderId,
        status,
        carrier: order?.shippingCarrier || null,
        trackingNumber: order?.shippingTrackingNumber || null,
      }, order);
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

  // DELETE /api/orders/batch - Delete selected orders (body: { ids: string[] })
  async deleteByIds(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res.status(400).json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }
      const result = await this.model.deleteByIds(req, idsRaw);
      return res.json({ ok: true, ...result });
    } catch (error) {
      Logger.error('Delete orders by ids error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to delete selected orders' });
    }
  }

  // PUT /api/orders/batch/status - Batch update status for multiple orders
  async batchUpdateStatus(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res.status(400).json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const statusRaw = req.body?.status ? String(req.body.status).trim().toLowerCase() : null;
      const status = this.normalizeStatusForStorage(statusRaw);
      const carrier = req.body?.carrier ? String(req.body.carrier).trim() : null;
      const trackingNumber = req.body?.trackingNumber ? String(req.body.trackingNumber).trim() : null;

      if (!status) {
        return res.status(400).json({ error: 'status is required', code: 'VALIDATION_ERROR' });
      }

      // CDON: for Delivered on orders >= 299 SEK, require trackingNumber (either provided, or already on each order).
      if (status === 'delivered') {
        const userId = req.session?.user?.id || req.session?.user?.uuid;
        if (!userId) return res.status(401).json({ error: 'User not authenticated' });

        const validIds = idsRaw
          .map((id) => {
            const num = Number(id);
            return Number.isFinite(num) && num > 0 ? num : null;
          })
          .filter((id) => id !== null);

        if (validIds.length > 0) {
          const db = Database.get(req);
          const rows = await db.query(
            `
            SELECT id, order_number, channel, total_amount, shipping_tracking_number
            FROM orders
            WHERE user_id = $1
              AND id = ANY($2::int[])
            `,
            [userId, validIds],
          );

          const offenders = [];
          for (const r of rows) {
            const ch = String(r.channel || '').trim().toLowerCase();
            if (ch !== 'cdon') continue;
            const total = Number(r.total_amount);
            const needs = Number.isFinite(total) && total >= 299;
            if (!needs) continue;
            const effective = String(trackingNumber || r.shipping_tracking_number || '').trim();
            if (!effective) offenders.push(r.order_number != null ? `#${r.order_number}` : `id:${r.id}`);
          }

          if (offenders.length) {
            return res.status(400).json({
              errors: [
                {
                  field: 'trackingNumber',
                  message: `Tracking number is required for CDON orders >= 299 SEK when marking as Delivered. Missing for: ${offenders.join(', ')}`,
                },
              ],
            });
          }
        }
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

