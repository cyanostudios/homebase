// plugins/woocommerce-products/controller.js
// Derived from neutral template. Adds settings storage, connection test,
// batch export to WooCommerce (create OR update prioritizing channel map external_id, fallback to SKU),
// and a read-only import endpoint to fetch a Woo product by SKU and map it to MVP Product.

const { Logger, Context, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const OrdersModel = require('../orders/model');
const CdonProductsModel = require('../cdon-products/model');
const FyndiqProductsModel = require('../fyndiq-products/model');
const { fetchCategoriesFromApi: fetchWooCategoriesFromApi } = require('./fetchCategories');

class WooCommerceController {
  constructor(model) {
    this.model = model;
    this.ordersModel = new OrdersModel();
    this.cdonModel = new CdonProductsModel();
    this.fyndiqModel = new FyndiqProductsModel();
  }

  requireStoreLabel(label) {
    const normalized = typeof label === 'string' ? label.trim() : '';
    if (!normalized) {
      throw new AppError('Missing required field: label', 400, AppError.CODES.VALIDATION_ERROR);
    }
    return normalized;
  }

  async _getInstanceOrThrow(req) {
    const instanceId = String(req.query?.instanceId || req.body?.instanceId || '').trim();
    if (!instanceId) {
      throw new AppError(
        'instanceId is required (WooCommerce is multi-store)',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    const inst = await this.model.getInstanceById(req, instanceId);
    if (
      !inst?.credentials?.storeUrl ||
      !inst?.credentials?.consumerKey ||
      !inst?.credentials?.consumerSecret
    ) {
      throw new AppError(
        'WooCommerce instance credentials not found',
        404,
        AppError.CODES.NOT_FOUND,
      );
    }
    return inst;
  }

  async _getInstancesFromBodyOrThrow(req) {
    const rawInstanceIds = req.body?.instanceIds;
    if (!Array.isArray(rawInstanceIds) || rawInstanceIds.length === 0) {
      throw new AppError(
        'instanceIds is required (select one or more WooCommerce stores)',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    const instances = [];
    for (const id of rawInstanceIds) {
      const inst = await this.model.getInstanceById(req, id);
      if (
        inst?.credentials?.storeUrl &&
        inst?.credentials?.consumerKey &&
        inst?.credentials?.consumerSecret
      ) {
        instances.push(inst);
      }
    }
    if (instances.length === 0) {
      throw new AppError(
        'No valid WooCommerce instances found for instanceIds',
        404,
        AppError.CODES.NOT_FOUND,
      );
    }
    return instances;
  }

  // ---- Utility: map PG 23505 -> 409 field error ----
  mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;
    const detail = String(error.detail || '');
    const m = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
    const cols = m ? m[1].split(',').map((s) => s.trim()) : [];
    const val = m ? m[2] : undefined;
    const field = cols[1] || cols[0] || 'general';
    return {
      field,
      message: val
        ? `Unique value "${val}" already exists for ${field}`
        : 'Unique constraint violated',
    };
  }

  parseOverrideCategoryIds(rawCategory) {
    if (rawCategory == null) return [];
    const value = String(rawCategory).trim();
    if (!value) return [];

    const toIds = (items) =>
      items
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0)
        .map((x) => ({ id: x }));

    if (value.startsWith('[')) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? toIds(parsed) : toIds([value]);
      } catch {
        return toIds([value]);
      }
    }

    return toIds([value]);
  }

  async getWooOverrideCategoriesByProduct(req, { productIds, channelInstanceId }) {
    const userId = req.session?.user?.id;
    if (!userId || !Array.isArray(productIds) || productIds.length === 0) return new Map();

    const db = Database.get(req);
    const rows = await db.query(
      `
      SELECT product_id::text AS product_id, category
      FROM channel_product_overrides
      WHERE user_id = $1
        AND channel = 'woocommerce'
        AND channel_instance_id = $2
        AND product_id::text = ANY($3::text[])
      `,
      [userId, Number(channelInstanceId), productIds],
    );

    const out = new Map();
    for (const row of rows || []) {
      out.set(String(row.product_id), this.parseOverrideCategoryIds(row.category));
    }
    return out;
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
      const { instanceKey, label, storeUrl, consumerKey, consumerSecret, useQueryAuth } =
        req.body || {};
      const finalLabel = this.requireStoreLabel(label);

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
        consumerSecret:
          consumerSecret !== undefined ? consumerSecret : existingCreds.consumerSecret,
        useQueryAuth: useQueryAuth !== undefined ? !!useQueryAuth : existingCreds.useQueryAuth,
      };

      const finalLabel = this.requireStoreLabel(label !== undefined ? label : existing.label);

      const instance = await this.model.upsertInstance(req, {
        instanceKey: existing.instanceKey,
        label: finalLabel,
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
      // Either test explicit credentials (from form) OR test a saved instance by instanceId.
      const settings = inBody.storeUrl
        ? {
            storeUrl: String(inBody.storeUrl || '').trim(),
            consumerKey: String(inBody.consumerKey || '').trim(),
            consumerSecret: String(inBody.consumerSecret || '').trim(),
            useQueryAuth: !!inBody.useQueryAuth,
          }
        : (await this._getInstanceOrThrow(req)).credentials;

      if (!settings?.storeUrl || !settings?.consumerKey || !settings?.consumerSecret) {
        return res.status(400).json({
          error: 'Missing WooCommerce credentials (storeUrl, consumerKey, consumerSecret).',
        });
      }

      const base = this.normalizeBaseUrl(settings.storeUrl);
      const endpoint = `${base}/wp-json/wc/v3`;

      const response = await this.fetchWithWooAuth(endpoint, { method: 'GET' }, settings);
      const ok = response.ok;
      const text = await response.text().catch(() => '');
      let json;
      try {
        json = JSON.parse(text);
      } catch (_) {
        json = { raw: text };
      }

      res.json({
        ok,
        status: response.status,
        statusText: response.statusText,
        endpoint,
        body: json,
      });
    } catch (error) {
      Logger.error('Woo test connection error', error, { userId: Context.getUserId(req) });
      res.status(502).json({
        error: 'Failed to reach WooCommerce API',
        detail: String(error?.message || error),
      });
    }
  }

  // ---- IMPORT (read-only) by SKU ----
  async importProductBySku(req, res) {
    try {
      const inst = await this._getInstanceOrThrow(req);
      const settings = inst.credentials;

      const sku = String(req.query?.sku || '').trim();
      if (!sku) return res.status(400).json({ error: 'Missing required query param: sku' });

      const base = this.normalizeBaseUrl(settings.storeUrl);
      const found = await this.findWooProductBySku(base, sku, settings);
      if (!found?.id)
        return res.status(404).json({ ok: false, sku, error: 'Product not found in WooCommerce' });

      const mapped = this.mapWooToMvpProduct(found);
      return res.json({
        ok: true,
        source: 'woocommerce',
        wooId: found.id,
        product: mapped,
      });
    } catch (error) {
      Logger.error('Woo import error', error, { userId: Context.getUserId(req) });
      res
        .status(502)
        .json({ error: 'Import from WooCommerce failed', detail: String(error?.message || error) });
    }
  }

  // ---- Batch export (create OR update: prefer channel map external_id, fallback to SKU) ----
  // body: { products: MVPProduct[], instanceIds: string[] }
  async exportProducts(req, res) {
    try {
      const mode = String(req.body?.mode || '')
        .trim()
        .toLowerCase();
      if (mode === 'update_only_strict') {
        return this.exportProductsUpdateOnlyStrict(req, res);
      }

      const products = Array.isArray(req.body?.products) ? req.body.products : null;
      if (!products || products.length === 0) {
        return res
          .status(400)
          .json({ error: 'Request must include products: [] with MVP product fields.' });
      }

      const instances = await this._getInstancesFromBodyOrThrow(req);

      const channel = 'woocommerce';
      const productIds = products.map((p) => String(p.id));
      const aggregated = {
        ok: true,
        instances: [],
        result: { create: [], update: [] },
        counts: { requested: products.length, success: 0, error: 0 },
        items: [],
      };

      for (const instance of instances) {
        const settings = instance.credentials;
        const instanceId = instance.id;
        const base = this.normalizeBaseUrl(settings.storeUrl);

        const mapByProductId = await this.model.getChannelMapForProducts(
          req,
          channel,
          productIds,
          instanceId,
        );

        const existingBySku = new Map();
        for (const p of products) {
          const pid = String(p?.id || '');
          if (mapByProductId.has(pid)) continue;
          const sku = String(p?.sku || '').trim();
          if (!sku) continue;
          const found = await this.findWooProductBySku(base, sku, settings).catch(() => null);
          if (found?.id) existingBySku.set(sku, found.id);
        }

        const createPayload = [];
        const updatePayload = [];
        const categoriesByProductId = await this.getWooOverrideCategoriesByProduct(req, {
          productIds,
          channelInstanceId: instanceId,
        });

        for (const p of products) {
          const pid = String(p?.id || '');
          const payload = this.mapProductToWoo(p, categoriesByProductId.get(pid) || []);
          const sku = String(p?.sku || payload?.sku || '').trim();
          const mappedId = mapByProductId.get(pid) || (sku ? existingBySku.get(sku) : null);
          if (mappedId) {
            updatePayload.push({ id: mappedId, ...payload });
          } else {
            createPayload.push(payload);
          }
        }

        if (createPayload.length === 0 && updatePayload.length === 0) {
          aggregated.instances.push({
            instanceId: instanceId,
            label: instance.label,
            ok: true,
            endpoint: `${base}/wp-json/wc/v3/products/batch`,
            result: { create: [], update: [] },
            counts: { requested: products.length, success: 0, error: 0 },
            items: products.map((p) => ({ productId: p.id, sku: p.sku || null, status: 'noop' })),
          });
          continue;
        }

        const endpoint = `${base}/wp-json/wc/v3/products/batch`;
        const response = await this.fetchWithWooAuth(
          endpoint,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              create: createPayload.length ? createPayload : undefined,
              update: updatePayload.length ? updatePayload : undefined,
            }),
          },
          settings,
        );

        const rawText = await response.text().catch(() => '');
        let json;
        try {
          json = JSON.parse(rawText);
        } catch (_) {
          json = { raw: rawText };
        }

        const successes = new Map();
        const markSuccess = (wooItem) => {
          const sku = (wooItem?.sku || '').trim();
          if (!sku) return;
          successes.set(sku, { wooId: wooItem.id });
        };
        if (Array.isArray(json?.create)) json.create.forEach(markSuccess);
        if (Array.isArray(json?.update)) json.update.forEach(markSuccess);

        const items = [];
        for (const p of products) {
          const pid = String(p?.id || '');
          const sku = (p?.sku || '').trim();
          const viaSku = sku ? successes.get(sku) : null;
          const viaMapId = mapByProductId.get(pid);
          const found = viaSku || (viaMapId ? { wooId: viaMapId } : null);

          if (found) {
            await this.model.upsertChannelMap(req, {
              productId: pid,
              channel,
              channelInstanceId: instanceId,
              externalId: found.wooId,
              status: 'success',
              error: null,
            });
            items.push({
              productId: pid,
              sku: sku || null,
              status: 'success',
              externalId: found.wooId,
            });
          } else {
            let message = null;
            if (Array.isArray(json?.errors)) {
              message =
                json.errors
                  .map((e) => e?.message)
                  .filter(Boolean)
                  .join('; ') || null;
            }
            await this.model.upsertChannelMap(req, {
              productId: pid,
              channel,
              channelInstanceId: instanceId,
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
            items.push({
              productId: pid,
              sku: sku || null,
              status: 'error',
              error: message || 'Export failed',
            });
          }
        }

        const successCount = items.filter((i) => i.status === 'success').length;
        const errorCount = items.filter((i) => i.status === 'error').length;
        aggregated.counts.success += successCount;
        aggregated.counts.error += errorCount;
        if (Array.isArray(json?.create)) aggregated.result.create.push(...json.create);
        if (Array.isArray(json?.update)) aggregated.result.update.push(...json.update);
        aggregated.instances.push({
          instanceId: instanceId,
          label: instance.label,
          ok: response.ok,
          endpoint,
          result: {
            create: json?.create || [],
            update: json?.update || [],
            delete: json?.delete || [],
          },
          counts: { requested: products.length, success: successCount, error: errorCount },
          items,
        });
        aggregated.items = items;
      }

      if (aggregated.instances.length === 1) {
        const single = aggregated.instances[0];
        const summary = {
          ok: single.ok,
          endpoint: single.endpoint,
          result: single.result,
          counts: aggregated.counts,
          items: single.items,
        };
        if (!single.ok) {
          return res.status(500).json({ error: 'WooCommerce batch export failed', ...summary });
        }
        return res.json(summary);
      }
      return res.json(aggregated);
    } catch (error) {
      Logger.error('Woo export error', error, { userId: Context.getUserId(req) });
      res
        .status(502)
        .json({ error: 'Export to WooCommerce failed', detail: String(error?.message || error) });
    }
  }

  async exportProductsUpdateOnlyStrict(req, res) {
    const products = Array.isArray(req.body?.products) ? req.body.products : [];
    if (!products.length) {
      return res
        .status(400)
        .json({ error: 'Request must include products: [] with MVP product fields.' });
    }
    const instances = await this._getInstancesFromBodyOrThrow(req);
    const channel = 'woocommerce';
    const productIds = products.map((p) => String(p?.id || '').trim()).filter(Boolean);
    const userId = Context.getUserId(req);
    const db = Database.get(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const report = {
      channel: 'woocommerce',
      mode: 'update_only_strict',
      requested: products.length,
      updated: 0,
      skipped_no_map: 0,
      expected_skip: 0,
      validation_error: 0,
      channel_error: 0,
      rows: [],
      instances: [],
    };

    for (const instance of instances) {
      const settings = instance.credentials;
      const instanceId = instance.id;
      const base = this.normalizeBaseUrl(settings.storeUrl);
      const mapByProductId = await this.model.getChannelMapForProducts(
        req,
        channel,
        productIds,
        instanceId,
      );
      const overrideRows = productIds.length
        ? await db.query(
            `
            SELECT product_id::text AS product_id, price_amount
            FROM channel_product_overrides
            WHERE user_id = $1
              AND channel = 'woocommerce'
              AND channel_instance_id = $2
              AND product_id::text = ANY($3::text[])
            `,
            [userId, Number(instanceId), productIds],
          )
        : [];
      const priceByProductId = new Map();
      for (const row of overrideRows || []) {
        priceByProductId.set(
          String(row.product_id),
          row.price_amount != null ? Number(row.price_amount) : null,
        );
      }

      const updatePayload = [];
      const validForInstance = [];
      for (const p of products) {
        const productId = String(p?.id || '').trim();
        const sku = String(p?.sku || '').trim();
        const mappedExternalId = mapByProductId.get(productId);
        if (!mappedExternalId) {
          report.skipped_no_map += 1;
          report.expected_skip += 1;
          report.rows.push({
            productId,
            sku: sku || null,
            channel: 'woocommerce',
            instanceKey: instance.instanceKey || null,
            status: 'skipped_no_map',
            reason: 'no_mapped_target',
            classification: 'expected_skip',
          });
          continue;
        }

        const quantity = Number(p?.quantity);
        const overrideRaw = Number(priceByProductId.get(productId));
        const overridePrice = Number.isFinite(overrideRaw) && overrideRaw > 0 ? overrideRaw : null;
        const baseRaw = Number(p?.priceAmount);
        const basePrice = Number.isFinite(baseRaw) && baseRaw > 0 ? baseRaw : null;
        const priceAmount = overridePrice != null ? overridePrice : basePrice;
        if (
          !Number.isFinite(quantity) ||
          quantity < 0 ||
          !Number.isFinite(priceAmount) ||
          priceAmount <= 0
        ) {
          report.validation_error += 1;
          report.rows.push({
            productId,
            sku: sku || null,
            channel: 'woocommerce',
            instanceKey: instance.instanceKey || null,
            status: 'validation_error',
            reason: 'missing_or_invalid_effective_price',
          });
          continue;
        }

        updatePayload.push({
          id: Number(mappedExternalId),
          manage_stock: true,
          stock_quantity: Math.trunc(quantity),
          regular_price: String(priceAmount),
        });
        validForInstance.push({ productId, sku: sku || null });
      }

      if (!updatePayload.length) {
        report.instances.push({
          instanceId: instance.id,
          instanceKey: instance.instanceKey,
          requested: products.length,
          updated: 0,
        });
        continue;
      }

      const endpoint = `${base}/wp-json/wc/v3/products/batch`;
      const response = await this.fetchWithWooAuth(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ update: updatePayload }),
        },
        settings,
      );
      const text = await response.text().catch(() => '');
      if (!response.ok) {
        report.channel_error += validForInstance.length;
        for (const item of validForInstance) {
          report.rows.push({
            productId: item.productId,
            sku: item.sku,
            channel: 'woocommerce',
            instanceKey: instance.instanceKey || null,
            status: 'channel_error',
            reason: `channel_error_${response.status}`,
          });
        }
        report.instances.push({
          instanceId: instance.id,
          instanceKey: instance.instanceKey,
          requested: products.length,
          updated: 0,
          detail: text || null,
        });
        continue;
      }

      report.updated += validForInstance.length;
      for (const item of validForInstance) {
        report.rows.push({
          productId: item.productId,
          sku: item.sku,
          channel: 'woocommerce',
          instanceKey: instance.instanceKey || null,
          status: 'updated',
          reason: null,
        });
      }
      report.instances.push({
        instanceId: instance.id,
        instanceKey: instance.instanceKey,
        requested: products.length,
        updated: validForInstance.length,
      });
    }

    return res.json({ ok: true, ...report });
  }

  // ---- Batch delete (Woo) ----
  // DELETE /api/woocommerce-products/batch
  // body: { productIds?: string[], externalIds?: number[], skus?: string[], instanceIds?: string[] }
  // When instanceIds present: resolve external_id per instance from channel map using productIds; ignore externalIds/skus.
  async batchDelete(req, res) {
    try {
      const body = req.body || {};
      const inProductIds = Array.isArray(body.productIds) ? body.productIds.map(String) : [];
      const inExternalIds = Array.isArray(body.externalIds) ? body.externalIds : [];
      const inSkus = Array.isArray(body.skus) ? body.skus : [];

      const instances = await this._getInstancesFromBodyOrThrow(req);

      const channel = 'woocommerce';
      let totalDeleted = 0;
      const allItems = [];

      for (const instance of instances) {
        const settings = instance.credentials;
        const instanceId = instance.id;
        const base = this.normalizeBaseUrl(settings.storeUrl);

        let ids = [];
        if (inProductIds.length > 0 && instances.length > 0) {
          const mapByProductId = await this.model.getChannelMapForProducts(
            req,
            channel,
            inProductIds,
            instanceId,
          );
          for (const pid of inProductIds) {
            const ext = mapByProductId.get(pid);
            if (ext != null) {
              const n = Number(ext);
              if (Number.isFinite(n)) ids.push(n);
            }
          }
        }
        if (ids.length === 0) {
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
        }
        const uniqueIds = Array.from(new Set(ids));

        for (const id of uniqueIds) {
          const url = `${base}/wp-json/wc/v3/products/${id}?force=true`;
          const resp = await this.fetchWithWooAuth(url, { method: 'DELETE' }, settings);
          const isNotFound = resp.status === 404;
          let message = null;
          if (!resp.ok && !isNotFound) {
            message = await resp.text().catch(() => null);
          }
          const status = resp.ok ? 'deleted' : isNotFound ? 'not_found' : 'error';

          await this.model.clearChannelMapByExternalId(req, {
            channel: 'woocommerce',
            channelInstanceId: instanceId,
            externalId: id,
            status: 'idle',
            error: status === 'error' ? message || 'Delete failed' : null,
          });

          allItems.push({ externalId: id, status, message: message || undefined });
          if (status === 'deleted' || status === 'not_found') totalDeleted += 1;
        }
      }

      return res.json({
        ok: true,
        endpoint: 'per-instance',
        deleted: totalDeleted,
        items: allItems,
      });
    } catch (error) {
      Logger.error('Woo batch delete error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ error: 'Delete from WooCommerce failed', detail: String(error?.message || error) });
    }
  }

  // ---- Categories (read-only) ----
  // GET /api/woocommerce-products/categories?perPage=100&search=...
  // Fetches all pages and concatenates results so the full category tree is returned.
  async getCategories(req, res) {
    try {
      const inst = await this._getInstanceOrThrow(req);
      const perPageRaw = req.query?.perPage != null ? Number(req.query.perPage) : 100;
      const perPage = Number.isFinite(perPageRaw)
        ? Math.min(Math.max(Math.trunc(perPageRaw), 1), 100)
        : 100;

      const items = await fetchWooCategoriesFromApi(inst.credentials, perPage);
      return res.json({ ok: true, items });
    } catch (error) {
      Logger.error('Woo getCategories error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to fetch Woo categories' });
    }
  }

  /**
   * Internal: sync open WooCommerce orders for one instance (processing/pending), with after cursor.
   * Used by OrderSyncService. Returns { fetched, created, lastCursor?, error? }.
   * lastCursor: ISO date of newest order's date_created for next run (with 1–2 min overlap).
   */
  async syncOpenOrdersForInstance(req, instance, after = null) {
    const userId = req.session?.user?.id;
    const db = Database.get(req);
    const credentials = instance.credentials || {};
    const storeUrl = credentials.storeUrl || credentials.store_url;
    if (!storeUrl) return { fetched: 0, created: 0 };

    const base = this.normalizeBaseUrl(storeUrl);
    const url = new URL(`${base}/wp-json/wc/v3/orders`);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('orderby', 'date');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('status', 'processing,pending,on-hold');
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
      return { fetched: 0, created: -1, error: (text || resp.statusText).slice(0, 500) };
    }

    const orders = await resp.json().catch(() => null);
    if (!Array.isArray(orders)) return { fetched: 0, created: 0 };

    let created = 0;
    let lastCursor = null;

    for (const o of orders) {
      const channelOrderId = o?.id != null ? String(o.id) : '';
      if (!channelOrderId) continue;

      const rawClean = { ...o };
      delete rawClean._links;
      delete rawClean.meta_data;
      delete rawClean.cart_hash;
      delete rawClean.user_agent;
      delete rawClean.customer_ip_address;
      delete rawClean.version;
      rawClean._homebase_store_url = settings.storeUrl;

      const channelLabel =
        instance && typeof instance.label === 'string' && instance.label.trim() !== ''
          ? instance.label.trim()
          : null;
      const normalized = {
        channel: 'woocommerce',
        channelOrderId,
        channelInstanceId: instance.id != null ? String(instance.id) : null,
        channelLabel,
        platformOrderNumber: o?.number != null ? String(o.number) : null,
        placedAt: o?.date_created_gmt || o?.date_created || null,
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

      const lineItems = Array.isArray(o?.line_items) ? o.line_items : [];
      for (const li of lineItems) {
        const qty = Number(li?.quantity);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        const wooProductId = li?.product_id != null ? String(li.product_id) : null;
        let platformProductId = null;
        if (wooProductId && userId) {
          const mapRes = await db.query(
            `SELECT product_id FROM channel_product_map WHERE user_id = $1 AND channel = 'woocommerce' AND external_id = $2 LIMIT 1`,
            [userId, wooProductId],
          );
          if (mapRes.length) platformProductId = String(mapRes[0].product_id);
        }
        const subtotal = li?.subtotal != null ? Number(li.subtotal) : null;
        const subtotalTax = li?.subtotal_tax != null ? Number(li.subtotal_tax) : null;
        let unitPriceInclVat = null;
        let vatRate = null;
        if (Number.isFinite(subtotal) && Number.isFinite(subtotalTax) && qty > 0) {
          unitPriceInclVat = (subtotal + subtotalTax) / qty;
          if (subtotal > 0) vatRate = (subtotalTax / subtotal) * 100;
        } else if (Number.isFinite(Number(li?.price))) {
          unitPriceInclVat = Number(li.price) * 1.25;
          vatRate = 25;
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

      const shippingLines = Array.isArray(o?.shipping_lines) ? o.shipping_lines : [];
      for (const sl of shippingLines) {
        const shippingTotalExVat = sl?.total != null ? Number(sl.total) : null;
        const shippingTax = sl?.total_tax != null ? Number(sl.total_tax) : null;
        let shippingTotalInclVat = null;
        if (Number.isFinite(shippingTotalExVat) && Number.isFinite(shippingTax))
          shippingTotalInclVat = shippingTotalExVat + shippingTax;
        else if (Number.isFinite(shippingTotalExVat)) shippingTotalInclVat = shippingTotalExVat;
        if (Number.isFinite(shippingTotalInclVat) && shippingTotalInclVat > 0) {
          normalized.items.push({
            sku: null,
            productId: null,
            title: sl?.method_title || 'Shipping',
            quantity: 1,
            unitPrice: shippingTotalInclVat,
            vatRate: 25,
            raw: sl,
          });
        }
      }

      const ingestRes = await this.ordersModel.ingest(req, normalized);
      if (ingestRes.created) created += 1;
      if (ingestRes.created && ingestRes.orderId) {
        await this.applyInventoryFromOrderId(req, ingestRes.orderId).catch(() => {});
      }

      const placed = o?.date_created_gmt || o?.date_created;
      if (placed && (!lastCursor || placed > lastCursor)) lastCursor = placed;
    }

    return { fetched: orders.length, created, lastCursor };
  }

  // ---- Orders pull (session-auth) -> normalized ingest + inventory sync (MVP) ----
  // POST /api/woocommerce-products/orders/pull
  async pullOrders(req, res) {
    try {
      // Get all WooCommerce instances, not just default
      const instances = await this.model.listInstances(req);
      if (!instances || instances.length === 0) {
        return res
          .status(400)
          .json({ error: 'No WooCommerce stores configured. Add a store first.' });
      }

      const perPage =
        req.body?.perPage != null ? Math.min(Math.max(Number(req.body.perPage) || 20, 1), 100) : 20;
      const after = req.body?.after ? String(req.body.after) : null;

      const userId = req.session?.user?.id;
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

            const channelLabel =
              instance && typeof instance.label === 'string' && instance.label.trim() !== ''
                ? instance.label.trim()
                : null;
            const normalized = {
              channel: 'woocommerce',
              channelOrderId,
              channelInstanceId: instance.id != null ? String(instance.id) : null,
              channelLabel,
              platformOrderNumber: o?.number != null ? String(o.number) : null,
              placedAt: o?.date_created_gmt || o?.date_created || null,
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
                const taxTotal =
                  tax?.total != null
                    ? Number(tax.total)
                    : tax?.subtotal != null
                      ? Number(tax.subtotal)
                      : null;
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
                if (
                  Number.isFinite(shippingTotalExVat) &&
                  Number.isFinite(shippingTax) &&
                  shippingTotalExVat > 0
                ) {
                  shippingVatRate = (shippingTax / shippingTotalExVat) * 100;
                } else if (Array.isArray(sl?.taxes) && sl.taxes.length > 0) {
                  // Fallback: try to get from taxes array
                  const tax = sl.taxes[0];
                  const taxTotal =
                    tax?.total != null
                      ? Number(tax.total)
                      : tax?.subtotal != null
                        ? Number(tax.subtotal)
                        : null;
                  if (
                    Number.isFinite(taxTotal) &&
                    Number.isFinite(shippingTotalExVat) &&
                    shippingTotalExVat > 0
                  ) {
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
                Logger.warn('Inventory sync failed (non-fatal)', err, {
                  orderId: ingestRes.orderId,
                });
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
      return res
        .status(502)
        .json({ error: 'Failed to pull Woo orders', detail: String(error?.message || error) });
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
    const userId = req.session?.user?.id;
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

  // ---- Helpers ----

  normalizeBaseUrl(url) {
    let trimmed = String(url || '')
      .trim()
      .replace(/\/+$/, '');
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

    const fetchFn =
      typeof fetch === 'function'
        ? fetch
        : async (...args) => {
            const mod = await import('node-fetch').catch(() => null);
            if (!mod?.default)
              throw new Error('fetch is not available (Node <18) and node-fetch is not installed');
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
      case 'publish':
        return 'for sale';
      case 'draft':
        return 'draft';
      case 'private':
        return 'archived';
      default:
        return 'draft';
    }
  }

  // Transform MVP Product -> Woo product payload
  mapProductToWoo(p, overrideCategories = []) {
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

    const metaData = [];
    const ean = (p?.ean ?? '').trim();
    const gtin = (p?.gtin ?? '').trim();
    if (ean) metaData.push({ key: 'ean', value: ean });
    if (gtin) metaData.push({ key: 'gtin', value: gtin });

    return {
      sku: p?.sku ?? null,
      name: p?.title ?? '',
      status: this.mapStatusToWoo(p?.status),
      regular_price: p?.priceAmount != null ? String(p.priceAmount) : undefined,
      manage_stock: true,
      stock_quantity: p?.quantity != null ? Number(p.quantity) : undefined,
      description: p?.description || '',
      categories:
        Array.isArray(overrideCategories) && overrideCategories.length > 0
          ? overrideCategories
          : undefined,
      images: images.length ? images : undefined,
      attributes: attrs.length ? attrs : undefined,
      meta_data: metaData.length ? metaData : undefined,
    };
  }

  // Transform Woo product -> MVP Product (read-only import mapping)
  mapWooToMvpProduct(w) {
    const images = Array.isArray(w?.images) ? w.images.map((i) => i?.src).filter(Boolean) : [];
    const mainImage = images.length ? images[0] : null;

    // find brand attribute
    let brand = null;
    if (Array.isArray(w?.attributes)) {
      const attr = w.attributes.find((a) => String(a?.name || '').toLowerCase() === 'brand');
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
      priceAmount:
        w?.regular_price != null && w.regular_price !== '' ? Number(w.regular_price) : null,
      currency: null, // store currency not present on product payload
      vatRate: null,
      description: w?.description || null,
      mainImage,
      images,
      categories: Array.isArray(w?.categories)
        ? w.categories.map((c) => c?.name).filter(Boolean)
        : [],
      brand,
      gtin: null,
      createdAt: w?.date_created || null,
      updatedAt: w?.date_modified || null,
    };
  }
}

module.exports = WooCommerceController;
