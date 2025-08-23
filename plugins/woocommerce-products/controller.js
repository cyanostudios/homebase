// Derived from neutral template. Adds settings storage, connection test,
// and batch export to WooCommerce.

class WooCommerceController {
  constructor(model) {
    this.model = model;
  }

  // ---- Utility: map PG 23505 -> 409 field error ----
  mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;
    const detail = String(error.detail || '');
    const m = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
    const cols = m ? m[1].split(',').map(s => s.trim()) : [];
    const val = m ? m[2] : undefined;
    const field = cols[1] || cols[0] || 'general';
    return {
      field,
      message: val ? `Unique value "${val}" already exists for ${field}` : 'Unique constraint violated',
    };
  }

  // ---- Settings endpoints ----

  async getSettings(req, res) {
    try {
      const settings = await this.model.getSettings(req.session.user.id);
      res.json(settings || null);
    } catch (error) {
      console.error('Get Woo settings error:', error);
      res.status(500).json({ error: 'Failed to fetch WooCommerce settings' });
    }
  }

  async putSettings(req, res) {
    try {
      const saved = await this.model.upsertSettings(req.session.user.id, req.body);
      res.json(saved);
    } catch (error) {
      console.error('Save Woo settings error:', error);
      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      res.status(500).json({ error: 'Failed to save WooCommerce settings' });
    }
  }

  // ---- Connection test ----

  async testConnection(req, res) {
    try {
      const userId = req.session.user.id;
      const inBody = req.body || {};
      const settings = inBody.storeUrl ? {
        storeUrl: String(inBody.storeUrl || '').trim(),
        consumerKey: String(inBody.consumerKey || '').trim(),
        consumerSecret: String(inBody.consumerSecret || '').trim(),
        useQueryAuth: !!inBody.useQueryAuth,
      } : await this.model.getSettings(userId);

      if (!settings?.storeUrl || !settings?.consumerKey || !settings?.consumerSecret) {
        return res.status(400).json({ error: 'Missing WooCommerce credentials (storeUrl, consumerKey, consumerSecret).' });
      }

      const base = this.normalizeBaseUrl(settings.storeUrl);
      const endpoint = `${base}/wp-json/wc/v3`;

      const response = await this.fetchWithWooAuth(endpoint, { method: 'GET' }, settings);
      const ok = response.ok;
      const text = await response.text().catch(() => '');
      let json;
      try { json = JSON.parse(text); } catch (_) { json = { raw: text }; }

      res.json({
        ok,
        status: response.status,
        statusText: response.statusText,
        endpoint,
        body: json,
      });
    } catch (error) {
      console.error('Woo test connection error:', error);
      res.status(502).json({ error: 'Failed to reach WooCommerce API', detail: String(error?.message || error) });
    }
  }

  // ---- Batch export ----
  async exportProducts(req, res) {
    try {
      const userId = req.session.user.id;
      const settings = await this.model.getSettings(userId);
      if (!settings) {
        return res.status(400).json({ error: 'WooCommerce settings not found. Save settings first.' });
      }

      const products = Array.isArray(req.body?.products) ? req.body.products : null;
      if (!products || products.length === 0) {
        return res.status(400).json({ error: 'Request must include products: [] with MVP product fields.' });
      }

      // 1) request: map SKU -> { productId, payloadForWoo }
      const channel = 'woocommerce';
      const bySku = new Map();
      const createPayload = products.map((p) => {
        const payload = this.mapProductToWoo(p);
        const sku = (p?.sku || payload?.sku || '').trim();
        if (sku) bySku.set(sku, { productId: p.id, input: p, payload });
        return payload;
      });

      const base = this.normalizeBaseUrl(settings.storeUrl);
      const endpoint = `${base}/wp-json/wc/v3/products/batch`;
      const response = await this.fetchWithWooAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ create: createPayload }),
      }, settings);

      const rawText = await response.text().catch(() => '');
      let json;
      try { json = JSON.parse(rawText); } catch (_) { json = { raw: rawText }; }

      // 2) Tolka svar – samla success via sku
      const successes = new Map(); // sku -> { wooId }
      const markSuccess = (wooItem) => {
        const sku = (wooItem?.sku || '').trim();
        if (!sku) return;
        successes.set(sku, { wooId: wooItem.id });
      };
      if (Array.isArray(json?.create)) json.create.forEach(markSuccess);
      if (Array.isArray(json?.update)) json.update.forEach(markSuccess);

      // 3) Upsert per rad + eventuell fel-logg
      const items = [];
      for (const p of products) {
        const sku = (p?.sku || '').trim();
        const found = sku ? successes.get(sku) : null;
        if (found) {
          await this.model.upsertChannelMap(userId, {
            productId: p.id,
            channel,
            externalId: found.wooId,
            status: 'success',
            error: null,
          });
          items.push({ productId: p.id, sku, status: 'success', externalId: found.wooId });
        } else {
          let message = null;
          if (Array.isArray(json?.errors)) {
            message = json.errors.map(e => e?.message).filter(Boolean).join('; ') || null;
          }
          await this.model.upsertChannelMap(userId, {
            productId: p.id,
            channel,
            externalId: null,
            status: 'error',
            error: message || 'Export failed',
          });
          await this.model.logChannelError(userId, {
            channel,
            productId: p.id,
            payload: p,
            response: json,
            message: message || 'Export failed',
          });
          items.push({ productId: p.id, sku, status: 'error', error: message || 'Export failed' });
        }
      }

      const summary = {
        ok: response.ok,
        endpoint,
        counts: {
          requested: products.length,
          success: items.filter(i => i.status === 'success').length,
          error: items.filter(i => i.status === 'error').length,
        },
        items,
      };

      if (!response.ok) {
        return res.status(response.status).json({ error: 'WooCommerce batch export failed', ...summary, raw: json });
      }
      return res.json(summary);

    } catch (error) {
      console.error('Woo export error:', error);
      res.status(502).json({ error: 'Export to WooCommerce failed', detail: String(error?.message || error) });
    }
  }

  // ---- Template parity CRUD (kept) ----

  async getAll(req, res) {
    try {
      const items = await this.model.getAll(req.session.user.id);
      res.json(items);
    } catch (error) {
      console.error('Get items error:', error);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  }

  async create(req, res) {
    try {
      const item = await this.model.create(req.session.user.id, req.body);
      res.json(item);
    } catch (error) {
      console.error('Create item error:', error);
      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      res.status(500).json({ error: 'Failed to create item' });
    }
  }

  async update(req, res) {
    try {
      const item = await this.model.update(req.session.user.id, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      console.error('Update item error:', error);
      if (/not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Item not found' });
      }
      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      res.status(500).json({ error: 'Failed to update item' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req.session.user.id, req.params.id);
      res.json({ message: 'Item deleted successfully' });
    } catch (error) {
      console.error('Delete item error:', error);
      if (/not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.status(500).json({ error: 'Failed to delete item' });
    }
  }

  // ---- Helpers ----

  normalizeBaseUrl(url) {
    const trimmed = String(url || '').trim().replace(/\/+$/, '');
    return trimmed;
  }

  async fetchWithWooAuth(url, init, settings) {
    const { consumerKey, consumerSecret, useQueryAuth } = settings;
    let finalUrl = url;
    let headers = { ...(init?.headers || {}) };

    if (useQueryAuth) {
      const u = new URL(finalUrl);
      u.searchParams.set('consumer_key', consumerKey);
      u.searchParams.set('consumer_secret', consumerSecret);
      finalUrl = u.toString();
    } else {
      const token = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${token}`;
    }

    const fetchFn = typeof fetch === 'function'
      ? fetch
      : async (...args) => {
          const mod = await import('node-fetch').catch(() => null);
          if (!mod?.default) throw new Error('fetch is not available (Node <18) and node-fetch is not installed');
          return mod.default(...args);
        };

    return fetchFn(finalUrl, { ...init, headers });
  }

  mapStatusToWoo(status) {
    switch (String(status || '').toLowerCase()) {
      case 'for sale':
      case 'active':
      case 'publish':
        return 'publish';
      case 'draft':
        return 'draft';
      case 'archived':
      case 'private':
        return 'private';
      default:
        return 'draft';
    }
  }

  // Transform MVP Product -> Woo product payload
  mapProductToWoo(p) {
    const images = [];
    if (p?.mainImage) images.push({ src: p.mainImage });
    if (Array.isArray(p?.images)) {
      for (const src of p.images) {
        if (src) images.push({ src });
      }
    }

    const attrs = [];
    if (p?.brand) {
      attrs.push({ name: 'brand', options: [String(p.brand)] });
    }

    return {
      sku: p?.sku ?? null,
      name: p?.title ?? '',
      status: this.mapStatusToWoo(p?.status),
      regular_price: p?.priceAmount != null ? String(p.priceAmount) : undefined,
      manage_stock: true,
      stock_quantity: p?.quantity != null ? Number(p.quantity) : undefined,
      description: p?.description || '',
      images: images.length ? images : undefined,
      attributes: attrs.length ? attrs : undefined,
    };
  }
}

module.exports = WooCommerceController;
