// Derived from neutral template. Adds settings storage, connection test,
// batch export to WooCommerce (create OR update prioritizing channel map external_id, fallback to SKU),
// and a read-only import endpoint to fetch a Woo product by SKU and map it to MVP Product.

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
      const userId = req.session.user.uuid || req.session.user.id;
      const settings = await this.model.getSettings(userId);
      res.json(settings || null);
    } catch (error) {
      console.error('Get Woo settings error:', error);
      res.status(500).json({ error: 'Failed to fetch WooCommerce settings' });
    }
  }

  async putSettings(req, res) {
    try {
      const userId = req.session.user.uuid || req.session.user.id;
      const saved = await this.model.upsertSettings(userId, req.body);
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
      const userId = req.session.user.uuid || req.session.user.id;
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

  // ---- IMPORT (read-only) by SKU ----
  async importProductBySku(req, res) {
    try {
      const userId = req.session.user.uuid || req.session.user.id;
      const settings = await this.model.getSettings(userId);
      if (!settings) return res.status(400).json({ error: 'WooCommerce settings not found. Save settings first.' });

      const sku = String(req.query?.sku || '').trim();
      if (!sku) return res.status(400).json({ error: 'Missing required query param: sku' });

      const base = this.normalizeBaseUrl(settings.storeUrl);
      const found = await this.findWooProductBySku(base, sku, settings);
      if (!found?.id) return res.status(404).json({ ok: false, sku, error: 'Product not found in WooCommerce' });

      const mapped = this.mapWooToMvpProduct(found);
      return res.json({
        ok: true,
        source: 'woocommerce',
        wooId: found.id,
        product: mapped,
      });
    } catch (error) {
      console.error('Woo import error:', error);
      res.status(502).json({ error: 'Import from WooCommerce failed', detail: String(error?.message || error) });
    }
  }

  // ---- Batch export (create OR update: prefer channel map external_id, fallback to SKU) ----
  async exportProducts(req, res) {
    try {
      const userId = req.session.user.uuid || req.session.user.id;
      const settings = await this.model.getSettings(userId);
      if (!settings) {
        return res.status(400).json({ error: 'WooCommerce settings not found. Save settings first.' });
      }

      const products = Array.isArray(req.body?.products) ? req.body.products : null;
      if (!products || products.length === 0) {
        return res.status(400).json({ error: 'Request must include products: [] with MVP product fields.' });
      }

      const base = this.normalizeBaseUrl(settings.storeUrl);
      const channel = 'woocommerce';

      // 1a) Use existing channel map first (productId -> external_id)
      const productIds = products.map(p => String(p.id));
      const mapByProductId = await this.model.getChannelMapForProducts(userId, channel, productIds);

      // 1b) Discover Woo product IDs by SKU only for those missing external_id in map
      const existingBySku = new Map(); // sku -> wooId
      for (const p of products) {
        const pid = String(p?.id || '');
        if (mapByProductId.has(pid)) continue; // we already know the Woo ID
        const sku = String(p?.sku || '').trim();
        if (!sku) continue;
        const found = await this.findWooProductBySku(base, sku, settings).catch(() => null);
        if (found?.id) existingBySku.set(sku, found.id);
      }

      // 2) Build batch payloads
      const createPayload = [];
      const updatePayload = [];
      for (const p of products) {
        const payload = this.mapProductToWoo(p);
        const pid = String(p?.id || '');
        const sku = String(p?.sku || payload?.sku || '').trim();
        const mappedId = mapByProductId.get(pid) || (sku ? existingBySku.get(sku) : null);

        if (mappedId) {
          updatePayload.push({ id: mappedId, ...payload });
        } else {
          createPayload.push(payload);
        }
      }

      // If nothing to send, short-circuit
      if (createPayload.length === 0 && updatePayload.length === 0) {
        return res.json({
          ok: true,
          endpoint: `${base}/wp-json/wc/v3/products/batch`,
          result: { create: [], update: [], delete: [] },
          counts: { requested: products.length, success: 0, error: 0 },
          items: products.map(p => ({ productId: p.id, sku: p.sku || null, status: 'noop' })),
        });
      }

      // 3) Send batch
      const endpoint = `${base}/wp-json/wc/v3/products/batch`;
      const response = await this.fetchWithWooAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          create: createPayload.length ? createPayload : undefined,
          update: updatePayload.length ? updatePayload : undefined,
        }),
      }, settings);

      const rawText = await response.text().catch(() => '');
      let json;
      try { json = JSON.parse(rawText); } catch (_) { json = { raw: rawText }; }

      // 4) Collect successes by SKU from Woo response
      const successes = new Map(); // sku -> { wooId }
      const markSuccess = (wooItem) => {
        const sku = (wooItem?.sku || '').trim();
        if (!sku) return;
        successes.set(sku, { wooId: wooItem.id });
      };
      if (Array.isArray(json?.create)) json.create.forEach(markSuccess);
      if (Array.isArray(json?.update)) json.update.forEach(markSuccess);

      // 5) Upsert channel map and build item summaries
      const items = [];
      for (const p of products) {
        const pid = String(p?.id || '');
        const sku = (p?.sku || '').trim();

        // prefer sku success; otherwise use mapped external_id as success if present
        const viaSku = sku ? successes.get(sku) : null;
        const viaMapId = mapByProductId.get(pid);
        const found = viaSku || (viaMapId ? { wooId: viaMapId } : null);

        if (found) {
          await this.model.upsertChannelMap(userId, {
            productId: pid,
            channel,
            externalId: found.wooId,
            status: 'success',
            error: null,
          });
          items.push({ productId: pid, sku: sku || null, status: 'success', externalId: found.wooId });
        } else {
          let message = null;
          if (Array.isArray(json?.errors)) {
            message = json.errors.map(e => e?.message).filter(Boolean).join('; ') || null;
          }
          await this.model.upsertChannelMap(userId, {
            productId: pid,
            channel,
            externalId: null,
            status: 'error',
            error: message || 'Export failed',
          });
          await this.model.logChannelError(userId, {
            channel,
            productId: pid,
            payload: p,
            response: json,
            message: message || 'Export failed',
          });
          items.push({ productId: pid, sku: sku || null, status: 'error', error: message || 'Export failed' });
        }
      }

      const summary = {
        ok: response.ok,
        endpoint,
        result: {
          create: Array.isArray(json?.create) ? json.create : [],
          update: Array.isArray(json?.update) ? json.update : [],
          delete: Array.isArray(json?.delete) ? json.delete : [],
        },
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

  // ---- Batch delete (Woo) ----
  // DELETE /api/woocommerce-products/batch?op=delete
  // body: { externalIds?: number[], skus?: string[] }
  async batchDelete(req, res) {
    try {
      const userId = req.session.user.uuid || req.session.user.id;
      const settings = await this.model.getSettings(userId);
      if (!settings) {
        return res.status(400).json({ error: 'WooCommerce settings not found. Save settings first.' });
      }

      const body = req.body || {};
      const inExternalIds = Array.isArray(body.externalIds) ? body.externalIds : [];
      const inSkus = Array.isArray(body.skus) ? body.skus : [];

      const base = this.normalizeBaseUrl(settings.storeUrl);

      // 1) Resolve Woo IDs
      const ids = [];

      for (const x of inExternalIds) {
        const n = Number(x);
        if (Number.isFinite(n)) ids.push(n);
      }

      for (const skuRaw of inSkus) {
        const sku = String(skuRaw || '').trim();
        if (!sku) continue;
        const found = await this.findWooProductBySku(base, sku, settings).catch(() => null);
        if (found?.id) ids.push(Number(found.id));
      }

      // unique
      const uniqueIds = Array.from(new Set(ids));

      if (uniqueIds.length === 0) {
        return res.json({
          ok: true,
          endpoint: `${base}/wp-json/wc/v3/products/{id}?force=true`,
          deleted: 0,
          items: [],
        });
      }

      const items = [];
      for (const id of uniqueIds) {
        const url = `${base}/wp-json/wc/v3/products/${id}?force=true`;
        const resp = await this.fetchWithWooAuth(url, { method: 'DELETE' }, settings);

        // Woo kan svara 404 om den redan är borta
        const isNotFound = resp.status === 404;

        let message = null;
        if (!resp.ok && !isNotFound) {
          message = await resp.text().catch(() => null);
        }

        const status = resp.ok ? 'deleted' : isNotFound ? 'not_found' : 'error';

        // Städa channel map så toggles blir off och Remote ID försvinner i UI
        // (Vi uppdaterar via external_id-match; om den raden inte finns är det ok/no-op)
        await this.model.clearChannelMapByExternalId(userId, {
          channel: 'woocommerce',
          externalId: id,
          status: 'idle',          // använder befintlig status-kod för kompatibilitet
          error: status === 'error' ? (message || 'Delete failed') : null,
        });

        items.push({
          externalId: id,
          status,
          message: message || undefined,
        });
      }

      const deleted = items.filter((x) => x.status === 'deleted' || x.status === 'not_found').length;

      return res.json({
        ok: true,
        endpoint: `${base}/wp-json/wc/v3/products/{id}?force=true`,
        deleted,
        items,
      });
    } catch (error) {
      console.error('Woo batch delete error:', error);
      return res.status(502).json({ error: 'Delete from WooCommerce failed', detail: String(error?.message || error) });
    }
  }


  // ---- Template parity CRUD (kept) ----

  async getAll(req, res) {
    try {
      const items = await this.model.getAll(req.session.user.uuid || req.session.user.id);
      res.json(items);
    } catch (error) {
      console.error('Get items error:', error);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  }

  async create(req, res) {
    try {
      const item = await this.model.create(req.session.user.uuid || req.session.user.id, req.body);
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
      const item = await this.model.update(
        req.session.user.uuid || req.session.user.id,
        req.params.id,
        req.body
      );
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
      await this.model.delete(req.session.user.uuid || req.session.user.id, req.params.id);
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
    let trimmed = String(url || '').trim().replace(/\/+$/, '');
    if (!trimmed) return trimmed;

    // Om användaren sparat utan schema, defaulta till https://
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
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

  async findWooProductBySku(base, sku, settings) {
    const url = `${base}/wp-json/wc/v3/products?sku=${encodeURIComponent(sku)}`;
    const resp = await this.fetchWithWooAuth(url, { method: 'GET' }, settings);
    if (!resp.ok) return null;
    const arr = await resp.json().catch(() => null);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr[0]; // expect unique SKU
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

  mapWooStatusToHomebase(status) {
    switch (String(status || '').toLowerCase()) {
      case 'publish': return 'for sale';
      case 'draft': return 'draft';
      case 'private': return 'archived';
      default: return 'draft';
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

  // Transform Woo product -> MVP Product (read-only import mapping)
  mapWooToMvpProduct(w) {
    const images = Array.isArray(w?.images) ? w.images.map(i => i?.src).filter(Boolean) : [];
    const mainImage = images.length ? images[0] : null;

    // find brand attribute
    let brand = null;
    if (Array.isArray(w?.attributes)) {
      const attr = w.attributes.find(a => String(a?.name || '').toLowerCase() === 'brand');
      const opts = Array.isArray(attr?.options) ? attr.options : [];
      brand = opts.length ? String(opts[0]) : null;
    }

    return {
      id: undefined,
      productNumber: null,
      sku: w?.sku || null,
      title: w?.name || '',
      status: this.mapWooStatusToHomebase(w?.status),
      quantity: Number.isFinite(w?.stock_quantity) ? Number(w.stock_quantity) : null,
      priceAmount: w?.regular_price != null && w.regular_price !== '' ? Number(w.regular_price) : null,
      currency: null, // store currency not present on product payload
      vatRate: null,
      description: w?.description || null,
      mainImage,
      images,
      categories: Array.isArray(w?.categories) ? w.categories.map(c => c?.name).filter(Boolean) : [],
      brand,
      gtin: null,
      createdAt: w?.date_created || null,
      updatedAt: w?.date_modified || null,
    };
  }
}

module.exports = WooCommerceController;
