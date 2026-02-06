// plugins/woocommerce-products/controller.js
// Derived from neutral template. Adds settings storage, connection test,
// batch export to WooCommerce (create OR update prioritizing channel map external_id, fallback to SKU),
// and a read-only import endpoint to fetch a Woo product by SKU and map it to MVP Product.

const { Logger, Context, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const OrdersModel = require('../orders/model');
const CdonProductsModel = require('../cdon-products/model');
const FyndiqProductsModel = require('../fyndiq-products/model');

class WooCommerceController {
  constructor(model) {
    this.model = model;
    this.ordersModel = new OrdersModel();
    this.cdonModel = new CdonProductsModel();
    this.fyndiqModel = new FyndiqProductsModel();
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
      const settings = await this.model.getSettings(req);
      res.json(settings || null);
    } catch (error) {
      Logger.error('Get Woo settings error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to fetch WooCommerce settings' });
    }
  }

  async putSettings(req, res) {
    try {
      const saved = await this.model.upsertSettings(req, req.body);
      res.json(saved);
    } catch (error) {
      Logger.error('Save Woo settings error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        const mapped = this.mapUniqueViolation(error);
        if (mapped) return res.status(409).json({ errors: [mapped] });
        return res.status(error.statusCode).json(error.toJSON());
      }

      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      res.status(500).json({ error: 'Failed to save WooCommerce settings' });
    }
  }

  // ---- Instances (multi-store support) ----

  async listInstances(req, res) {
    try {
      const instances = await this.model.listInstances(req);
      res.json({ ok: true, items: instances });
    } catch (error) {
      Logger.error('List Woo instances error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to list WooCommerce instances' });
    }
  }

  async createInstance(req, res) {
    try {
      const { instanceKey, label, storeUrl, consumerKey, consumerSecret, useQueryAuth } = req.body || {};

      // Extract store name from URL for label if not provided
      let finalLabel = label;
      if (!finalLabel && storeUrl) {
        try {
          const url = new URL(storeUrl);
          finalLabel = url.hostname.replace('www.', '');
        } catch (e) {
          finalLabel = 'WooCommerce Store';
        }
      }

      const instance = await this.model.upsertInstance(req, {
        instanceKey,
        label: finalLabel,
        credentials: {
          storeUrl,
          consumerKey,
          consumerSecret,
          useQueryAuth: !!useQueryAuth,
        },
      });

      res.json({ ok: true, instance });
    } catch (error) {
      Logger.error('Create Woo instance error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        const mapped = this.mapUniqueViolation(error);
        if (mapped) return res.status(409).json({ errors: [mapped] });
        return res.status(error.statusCode).json(error.toJSON());
      }

      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      res.status(500).json({ error: 'Failed to create WooCommerce instance' });
    }
  }

  async updateInstance(req, res) {
    try {
      const instanceId = req.params?.id;
      const { label, storeUrl, consumerKey, consumerSecret, useQueryAuth } = req.body || {};

      const existing = await this.model.getInstanceById(req, instanceId);
      if (!existing) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      // Merge with existing credentials
      const existingCreds = existing.credentials || {};
      const updatedCreds = {
        storeUrl: storeUrl !== undefined ? storeUrl : existingCreds.storeUrl,
        consumerKey: consumerKey !== undefined ? consumerKey : existingCreds.consumerKey,
        consumerSecret: consumerSecret !== undefined ? consumerSecret : existingCreds.consumerSecret,
        useQueryAuth: useQueryAuth !== undefined ? !!useQueryAuth : existingCreds.useQueryAuth,
      };

      // Extract store name from URL for label if not provided
      let finalLabel = label;
      if (!finalLabel && updatedCreds.storeUrl) {
        try {
          const url = new URL(updatedCreds.storeUrl);
          finalLabel = url.hostname.replace('www.', '');
        } catch (e) {
          finalLabel = existing.label || 'WooCommerce Store';
        }
      }

      const instance = await this.model.upsertInstance(req, {
        instanceKey: existing.instanceKey,
        label: finalLabel || existing.label,
        credentials: updatedCreds,
      });

      res.json({ ok: true, instance });
    } catch (error) {
      Logger.error('Update Woo instance error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to update WooCommerce instance' });
    }
  }

  async deleteInstance(req, res) {
    try {
      const instanceId = req.params?.id;
      const result = await this.model.deleteInstance(req, instanceId);
      res.json({ ok: true, deleted: result });
    } catch (error) {
      Logger.error('Delete Woo instance error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to delete WooCommerce instance' });
    }
  }

  // ---- Connection test ----

  async testConnection(req, res) {
    try {
      const inBody = req.body || {};
      const settings = inBody.storeUrl ? {
        storeUrl: String(inBody.storeUrl || '').trim(),
        consumerKey: String(inBody.consumerKey || '').trim(),
        consumerSecret: String(inBody.consumerSecret || '').trim(),
        useQueryAuth: !!inBody.useQueryAuth,
      } : await this.model.getSettings(req);

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
      Logger.error('Woo test connection error', error, { userId: Context.getUserId(req) });
      res.status(502).json({ error: 'Failed to reach WooCommerce API', detail: String(error?.message || error) });
    }
  }

  // ---- IMPORT (read-only) by SKU ----
  async importProductBySku(req, res) {
    try {
      const settings = await this.model.getSettings(req);
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
      Logger.error('Woo import error', error, { userId: Context.getUserId(req) });
      res.status(502).json({ error: 'Import from WooCommerce failed', detail: String(error?.message || error) });
    }
  }

  // ---- Batch export (create OR update: prefer channel map external_id, fallback to SKU) ----
  async exportProducts(req, res) {
    try {
      const settings = await this.model.getSettings(req);
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
      const mapByProductId = await this.model.getChannelMapForProducts(req, channel, productIds);

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
          await this.model.upsertChannelMap(req, {
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
          await this.model.upsertChannelMap(req, {
            productId: pid,
            channel,
            externalId: null,
            status: 'error',
            error: message || 'Export failed',
          });
          await this.model.logChannelError(req, {
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
      Logger.error('Woo export error', error, { userId: Context.getUserId(req) });
      res.status(502).json({ error: 'Export to WooCommerce failed', detail: String(error?.message || error) });
    }
  }

  // ---- Batch delete (Woo) ----
  // DELETE /api/woocommerce-products/batch?op=delete
  // body: { externalIds?: number[], skus?: string[] }
  async batchDelete(req, res) {
    try {
      const settings = await this.model.getSettings(req);
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
        await this.model.clearChannelMapByExternalId(req, {
          channel: 'woocommerce',
          externalId: id,
          status: 'idle',
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
      Logger.error('Woo batch delete error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ error: 'Delete from WooCommerce failed', detail: String(error?.message || error) });
    }
  }

  // ---- Categories (read-only) ----
  // GET /api/woocommerce-products/categories?perPage=100&search=...
  async getCategories(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings) return res.status(400).json({ error: 'WooCommerce settings not found. Save settings first.' });

      const base = this.normalizeBaseUrl(settings.storeUrl);
      const perPageRaw = req.query?.perPage != null ? Number(req.query.perPage) : 100;
      const perPage = Number.isFinite(perPageRaw) ? Math.min(Math.max(Math.trunc(perPageRaw), 1), 100) : 100;
      const search = req.query?.search != null ? String(req.query.search).trim() : '';

      const url = new URL(`${base}/wp-json/wc/v3/products/categories`);
      url.searchParams.set('per_page', String(perPage));
      if (search) url.searchParams.set('search', search);

      const resp = await this.fetchWithWooAuth(url.toString(), { method: 'GET' }, settings);
      const text = await resp.text().catch(() => '');
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }

      if (!resp.ok) {
        return res.status(resp.status).json({ ok: false, error: 'Failed to fetch Woo categories', endpoint: url.toString(), detail: json || text || resp.statusText });
      }

      return res.json({ ok: true, endpoint: url.toString(), items: json ?? [] });
    } catch (error) {
      Logger.error('Woo getCategories error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to fetch Woo categories' });
    }
  }

  // ---- Orders pull (session-auth) -> normalized ingest + inventory sync (MVP) ----
  // POST /api/woocommerce-products/orders/pull
  async pullOrders(req, res) {
    try {
      // Get all WooCommerce instances, not just default
      const instances = await this.model.listInstances(req);
      if (!instances || instances.length === 0) {
        return res.status(400).json({ error: 'No WooCommerce stores configured. Add a store first.' });
      }

      const perPage = req.body?.perPage != null ? Math.min(Math.max(Number(req.body.perPage) || 20, 1), 100) : 20;
      const after = req.body?.after ? String(req.body.after) : null;

      const userId = req.session?.user?.id || req.session?.user?.uuid;
      const db = Database.get(req);

      const allResults = [];
      let totalFetched = 0;
      let totalCreated = 0;
      let totalSkipped = 0;

      // Fetch orders from all instances
      for (const instance of instances) {
        const credentials = instance.credentials || {};
        const storeUrl = credentials.storeUrl || credentials.store_url;
        if (!storeUrl) {
          Logger.warn('Skipping WooCommerce instance without storeUrl', {
            userId,
            instanceId: instance.id,
            instanceKey: instance.instanceKey,
          });
          continue;
        }

        try {
          const base = this.normalizeBaseUrl(storeUrl);
          const url = new URL(`${base}/wp-json/wc/v3/orders`);
          url.searchParams.set('per_page', String(perPage));
          url.searchParams.set('orderby', 'date');
          url.searchParams.set('order', 'desc');
          if (after) url.searchParams.set('after', after);

          const settings = {
            storeUrl,
            consumerKey: credentials.consumerKey || credentials.consumer_key || '',
            consumerSecret: credentials.consumerSecret || credentials.consumer_secret || '',
            useQueryAuth: credentials.useQueryAuth || false,
          };

          const resp = await this.fetchWithWooAuth(url.toString(), { method: 'GET' }, settings);
          if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            Logger.warn('Failed to fetch Woo orders from instance', {
              userId,
              instanceId: instance.id,
              instanceKey: instance.instanceKey,
              storeUrl,
              status: resp.status,
              error: text || resp.statusText,
            });
            continue;
          }

          const orders = await resp.json().catch(() => null);
          if (!Array.isArray(orders)) {
            Logger.warn('Unexpected Woo orders response from instance', {
              userId,
              instanceId: instance.id,
              instanceKey: instance.instanceKey,
              storeUrl,
            });
            continue;
          }

          totalFetched += orders.length;

          // Process orders from this instance
          for (const o of orders) {
            const channelOrderId = o?.id != null ? String(o.id) : '';
            if (!channelOrderId) continue;

            // Clean up raw data to reduce SQL log size and storage
            const rawClean = { ...o };
            delete rawClean._links;
            delete rawClean.meta_data;
            delete rawClean.cart_hash;
            delete rawClean.user_agent;
            delete rawClean.customer_ip_address;
            delete rawClean.version;
            rawClean._homebase_store_url = settings.storeUrl;

            const normalized = {
              channel: 'woocommerce',
              channelOrderId,
              platformOrderNumber: o?.number != null ? String(o.number) : null,
              placedAt: o?.date_created || o?.date_created_gmt || null,
              totalAmount: o?.total != null ? Number(o.total) : null,
              currency: o?.currency || null,
              status: this.mapWooOrderStatusToHomebase(o?.status),
              shippingAddress: o?.shipping || null,
              billingAddress: o?.billing || null,
              customer: {
                email: o?.billing?.email || null,
                firstName: o?.billing?.first_name || null,
                lastName: o?.billing?.last_name || null,
                phone: o?.billing?.phone || null,
                shippingAddress: o?.shipping || null,
                billingAddress: o?.billing || null,
              },
              items: [],
              raw: rawClean,
            };

            // Map Woo line_items.product_id -> platform product_id via channel_product_map.external_id
            const lineItems = Array.isArray(o?.line_items) ? o.line_items : [];
            for (const li of lineItems) {
              const qty = Number(li?.quantity);
              if (!Number.isFinite(qty) || qty <= 0) continue;

              const wooProductId = li?.product_id != null ? String(li.product_id) : null;
              let platformProductId = null;

              if (wooProductId && userId) {
                const mapRes = await db.query(
                  `
              SELECT product_id
              FROM channel_product_map
              WHERE user_id = $1
                AND channel = 'woocommerce'
                AND external_id = $2
              LIMIT 1
              `,
                  [userId, wooProductId],
                );
                if (mapRes.length) platformProductId = String(mapRes[0].product_id);
              }

              // WooCommerce line item pricing structure (from API docs and actual data):
              // - price: unit price ex VAT (read-only)
              // - subtotal: line subtotal ex VAT (quantity * price)
              // - subtotal_tax: tax on subtotal
              // - total: line total ex VAT (same as subtotal if no discounts)
              // - total_tax: same as subtotal_tax for line items
              // 
              // To get unit price incl VAT: (subtotal + subtotal_tax) / quantity
              const subtotal = li?.subtotal != null ? Number(li.subtotal) : null;
              const subtotalTax = li?.subtotal_tax != null ? Number(li.subtotal_tax) : null;

              // Calculate unit price including VAT: (subtotal + tax) / quantity
              let unitPriceInclVat = null;
              if (Number.isFinite(subtotal) && Number.isFinite(subtotalTax) && qty > 0) {
                unitPriceInclVat = (subtotal + subtotalTax) / qty;
              }

              // Calculate VAT rate from subtotal and tax
              let vatRate = null;
              if (Number.isFinite(subtotal) && Number.isFinite(subtotalTax) && subtotal > 0) {
                vatRate = (subtotalTax / subtotal) * 100;
              } else if (Array.isArray(li?.taxes) && li.taxes.length > 0) {
                // Fallback: try to get from taxes array
                const tax = li.taxes[0];
                const taxTotal = tax?.total != null ? Number(tax.total) : tax?.subtotal != null ? Number(tax.subtotal) : null;
                const priceExVat = li?.price != null ? Number(li.price) : null;
                if (Number.isFinite(taxTotal) && Number.isFinite(priceExVat) && priceExVat > 0) {
                  vatRate = (taxTotal / priceExVat) * 100;
                }
              }

              // If still no price incl VAT, calculate from price + default VAT
              if (!Number.isFinite(unitPriceInclVat)) {
                const priceExVat = li?.price != null ? Number(li.price) : null;
                if (Number.isFinite(priceExVat)) {
                  vatRate = vatRate || 25;
                  unitPriceInclVat = priceExVat * (1 + vatRate / 100);
                }
              }

              normalized.items.push({
                sku: li?.sku || null,
                productId: platformProductId,
                title: li?.name != null ? String(li.name) : null,
                quantity: Math.trunc(qty),
                unitPrice: Number.isFinite(unitPriceInclVat) ? unitPriceInclVat : null,
                vatRate: Number.isFinite(vatRate) ? vatRate : null,
                raw: li,
              });
            }

            // Add shipping as a line item
            // WooCommerce shipping_lines structure (same as line_items):
            // - total: shipping cost ex VAT
            // - total_tax: tax on shipping
            // To get shipping cost incl VAT: total + total_tax
            const shippingLines = Array.isArray(o?.shipping_lines) ? o.shipping_lines : [];
            for (const sl of shippingLines) {
              const shippingTotalExVat = sl?.total != null ? Number(sl.total) : null;
              const shippingTax = sl?.total_tax != null ? Number(sl.total_tax) : null;

              // Calculate shipping cost including VAT
              let shippingTotalInclVat = null;
              if (Number.isFinite(shippingTotalExVat) && Number.isFinite(shippingTax)) {
                shippingTotalInclVat = shippingTotalExVat + shippingTax;
              } else if (Number.isFinite(shippingTotalExVat)) {
                // If no tax info, assume shippingTotalExVat is actually incl VAT (fallback)
                shippingTotalInclVat = shippingTotalExVat;
              }

              if (Number.isFinite(shippingTotalInclVat) && shippingTotalInclVat > 0) {
                // Calculate VAT rate from shipping total and tax
                let shippingVatRate = null;
                if (Number.isFinite(shippingTotalExVat) && Number.isFinite(shippingTax) && shippingTotalExVat > 0) {
                  shippingVatRate = (shippingTax / shippingTotalExVat) * 100;
                } else if (Array.isArray(sl?.taxes) && sl.taxes.length > 0) {
                  // Fallback: try to get from taxes array
                  const tax = sl.taxes[0];
                  const taxTotal = tax?.total != null ? Number(tax.total) : tax?.subtotal != null ? Number(tax.subtotal) : null;
                  if (Number.isFinite(taxTotal) && Number.isFinite(shippingTotalExVat) && shippingTotalExVat > 0) {
                    shippingVatRate = (taxTotal / shippingTotalExVat) * 100;
                  }
                }

                // If no VAT rate found, default to 25% for shipping in Sweden
                if (!Number.isFinite(shippingVatRate)) {
                  shippingVatRate = 25;
                }

                normalized.items.push({
                  sku: null,
                  productId: null,
                  title: sl?.method_title || 'Shipping',
                  quantity: 1,
                  unitPrice: shippingTotalInclVat, // Shipping cost including VAT
                  vatRate: shippingVatRate,
                  raw: sl,
                });
              }
            }

            const ingestRes = await this.ordersModel.ingest(req, normalized);

            // Apply inventory sync only when we created a new order record
            if (ingestRes.created && ingestRes.orderId) {
              await this.applyInventoryFromOrderId(req, ingestRes.orderId).catch((err) => {
                Logger.warn('Inventory sync failed (non-fatal)', err, { orderId: ingestRes.orderId });
              });
            }

            if (ingestRes.created) {
              totalCreated++;
            } else {
              totalSkipped++;
            }

            allResults.push({ channelOrderId, ...ingestRes });
          }
        } catch (instanceError) {
          Logger.error('Error processing WooCommerce instance', instanceError, {
            userId,
            instanceId: instance.id,
            instanceKey: instance.instanceKey,
            storeUrl,
          });
          // Continue with next instance
        }
      }

      return res.json({
        ok: true,
        fetched: totalFetched,
        ingested: allResults.length,
        created: totalCreated,
        skippedExisting: totalSkipped,
        results: allResults,
      });
    } catch (error) {
      Logger.error('Woo orders pull error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ error: 'Failed to pull Woo orders', detail: String(error?.message || error) });
    }
  }

  mapWooOrderStatusToHomebase(status) {
    switch (String(status || '').toLowerCase()) {
      case 'processing':
      case 'on-hold':
      case 'pending':
        return 'processing';
      case 'completed':
        return 'delivered';
      case 'cancelled':
      case 'refunded':
      case 'failed':
        return 'cancelled';
      default:
        return 'processing';
    }
  }

  // Source channel is Woo, so we only update platform inventory and (optionally) other channels.
  async applyInventoryFromOrderId(req, orderId) {
    const db = Database.get(req);
    const userId = req.session?.user?.id || req.session?.user?.uuid;
    if (!userId) return;

    const items = await db.query(
      `SELECT oi.sku, oi.product_id, oi.quantity
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id AND o.user_id = $1
       WHERE oi.order_id = $2
       ORDER BY oi.id`,
      [userId, Number(orderId)],
    );
    if (!items.length) return;

    const byProductId = new Map();
    for (const it of items) {
      const qty = Number(it?.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const pid = it?.product_id != null ? Number(it.product_id) : null;
      if (pid != null && Number.isFinite(pid)) {
        byProductId.set(pid, (byProductId.get(pid) || 0) + Math.trunc(qty));
      }
    }

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

      // Mark other channels as needing work (stock sync not implemented yet)
      await this.cdonModel.logChannelError(req, {
        channel: 'cdon',
        productId,
        payload: { sku, quantity: newQty },
        response: null,
        message: 'Stock sync triggered by Woo order (not implemented yet)',
      });
      await this.fyndiqModel.logChannelError(req, {
        channel: 'fyndiq',
        productId,
        payload: { sku, quantity: newQty },
        response: null,
        message: 'Stock sync triggered by Woo order (not implemented yet)',
      });
    }
  }

  // ---- Template parity CRUD (kept) ----

  async getAll(req, res) {
    try {
      const items = await this.model.getAll(req);
      res.json(items);
    } catch (error) {
      Logger.error('Get items error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to fetch items' });
    }
  }

  async create(req, res) {
    try {
      const item = await this.model.create(req, req.body);
      res.json(item);
    } catch (error) {
      Logger.error('Create item error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        const mapped = this.mapUniqueViolation(error);
        if (mapped) return res.status(409).json({ errors: [mapped] });
        return res.status(error.statusCode).json(error.toJSON());
      }

      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      res.status(500).json({ error: 'Failed to create item' });
    }
  }

  async update(req, res) {
    try {
      const item = await this.model.update(req, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      Logger.error('Update item error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        if (error.code === 'NOT_FOUND') {
          return res.status(404).json(error.toJSON());
        }
        const mapped = this.mapUniqueViolation(error);
        if (mapped) return res.status(409).json({ errors: [mapped] });
        return res.status(error.statusCode).json(error.toJSON());
      }

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
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Item deleted successfully' });
    } catch (error) {
      Logger.error('Delete item error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        if (error.code === 'NOT_FOUND') {
          return res.status(404).json(error.toJSON());
        }
        return res.status(error.statusCode).json(error.toJSON());
      }

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
