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

function isValidImageUrl(s) {
  if (typeof s !== 'string' || !s.trim()) return false;
  const t = s.trim();
  return (t.startsWith('http://') || t.startsWith('https://')) && t.length > 8;
}

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
    const tenantId = req.session?.tenantId;
    if (!tenantId || !Array.isArray(productIds) || productIds.length === 0) return new Map();

    const db = Database.get(req);
    const rows = await db.query(
      `
      SELECT product_id::text AS product_id, category
      FROM channel_product_overrides
      WHERE channel = 'woocommerce'
        AND channel_instance_id = $1
        AND product_id::text = ANY($2::text[])
      `,
      [Number(channelInstanceId), productIds],
    );

    const out = new Map();
    for (const row of rows || []) {
      out.set(String(row.product_id), this.parseOverrideCategoryIds(row.category));
    }
    return out;
  }

  async getWooOverridePriceAndSaleByProduct(req, { productIds, channelInstanceId }) {
    const tenantId = req.session?.tenantId;
    if (!tenantId || !Array.isArray(productIds) || productIds.length === 0) return new Map();

    const db = Database.get(req);
    const rows = await db.query(
      `
      SELECT product_id::text AS product_id, price_amount, sale_price
      FROM channel_product_overrides
      WHERE channel = 'woocommerce'
        AND channel_instance_id = $1
        AND product_id::text = ANY($2::text[])
      `,
      [Number(channelInstanceId), productIds],
    );

    const out = new Map();
    for (const row of rows || []) {
      out.set(String(row.product_id), {
        priceAmount:
          row.price_amount != null && Number.isFinite(Number(row.price_amount))
            ? Number(row.price_amount)
            : null,
        salePrice:
          row.sale_price != null &&
          Number.isFinite(Number(row.sale_price)) &&
          Number(row.sale_price) > 0
            ? Number(row.sale_price)
            : null,
      });
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

      const { grouped, standalone } = this.partitionProductsByWooGroup(products);

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

        const instanceCategories = await this.getWooOverrideCategoriesByProduct(req, {
          productIds,
          channelInstanceId: instanceId,
        });
        const instanceOverrides = await this.getWooOverridePriceAndSaleByProduct(req, {
          productIds,
          channelInstanceId: instanceId,
        });

        const items = [];

        // ---- Grouped: variable product + variations (SKU = groupId, V+id) ----
        for (const [groupId, groupProducts] of grouped) {
          const variationType = String(
            groupProducts[0]?.groupVariationType || 'color',
          ).toLowerCase();
          const variableResult = await this.ensureWooVariableProduct(
            base,
            settings,
            groupId,
            groupProducts,
            instanceCategories,
          );
          if (!variableResult?.wooParentId) {
            for (const p of groupProducts) {
              const pid = String(p?.id || '');
              await this.model.upsertChannelMap(req, {
                productId: pid,
                channel,
                channelInstanceId: instanceId,
                externalId: null,
                status: 'error',
                error: 'Variable product create/update failed',
              });
              items.push({
                productId: pid,
                sku: `V${p?.id ?? ''}`,
                status: 'error',
                error: 'Variable product create/update failed',
              });
              aggregated.counts.error += 1;
            }
            continue;
          }
          const wooParentId = variableResult.wooParentId;
          for (const p of groupProducts) {
            const pid = String(p?.id || '');
            const wooVariationId = await this.ensureWooVariation(
              base,
              settings,
              wooParentId,
              p,
              variationType,
              instanceOverrides,
            );
            if (wooVariationId != null) {
              await this.model.upsertChannelMap(req, {
                productId: pid,
                channel,
                channelInstanceId: instanceId,
                externalId: String(wooVariationId),
                status: 'success',
                error: null,
              });
              items.push({
                productId: pid,
                sku: `V${p?.id ?? ''}`,
                status: 'success',
                externalId: wooVariationId,
              });
              aggregated.counts.success += 1;
            } else {
              await this.model.upsertChannelMap(req, {
                productId: pid,
                channel,
                channelInstanceId: instanceId,
                externalId: null,
                status: 'error',
                error: 'Variation create/update failed',
              });
              items.push({
                productId: pid,
                sku: `V${p?.id ?? ''}`,
                status: 'error',
                error: 'Variation create/update failed',
              });
              aggregated.counts.error += 1;
            }
          }
        }

        // ---- Standalone: simple products (batch create/update by SKU = product.id) ----
        const existingBySku = new Map();
        for (const p of standalone) {
          const pid = String(p?.id || '');
          if (mapByProductId.has(pid)) continue;
          const exportSku = p?.id != null ? String(p.id) : null;
          if (!exportSku) continue;
          const found = await this.findWooProductBySku(base, exportSku, settings).catch(() => null);
          if (found?.id) existingBySku.set(exportSku, found.id);
        }

        const createPayload = [];
        const updatePayload = [];
        const standaloneValidationErrors = new Map();
        for (const p of standalone) {
          const pid = String(p?.id || '');
          const exportSku = p?.id != null ? String(p.id) : null;
          const ov = instanceOverrides.get(pid);
          const priceAmount =
            ov?.priceAmount != null && Number.isFinite(ov.priceAmount)
              ? Number(ov.priceAmount)
              : p?.priceAmount != null
                ? Number(p.priceAmount)
                : null;
          if (priceAmount === null || priceAmount === undefined) {
            standaloneValidationErrors.set(pid, {
              productId: pid,
              sku: exportSku,
              status: 'validation_error',
              reason: 'missing_or_invalid_effective_price',
            });
            aggregated.counts.error += 1;
            continue;
          }
          if (p?.mainImage && !isValidImageUrl(p.mainImage)) {
            standaloneValidationErrors.set(pid, {
              productId: pid,
              sku: exportSku,
              status: 'validation_error',
              reason: 'invalid_main_image_url',
            });
            aggregated.counts.error += 1;
            continue;
          }
          const images = Array.isArray(p?.images) ? p.images : [];
          const invalidImage = images.find(
            (u) => u != null && String(u).trim() && !isValidImageUrl(String(u).trim()),
          );
          if (invalidImage) {
            standaloneValidationErrors.set(pid, {
              productId: pid,
              sku: exportSku,
              status: 'validation_error',
              reason: 'invalid_images_url',
            });
            aggregated.counts.error += 1;
            continue;
          }
          const payload = this.mapProductToWoo(p, instanceCategories.get(pid) || [], {
            priceAmount: ov?.priceAmount != null ? Number(ov.priceAmount) : undefined,
            salePrice: ov?.salePrice != null ? Number(ov.salePrice) : undefined,
          });
          const mappedId =
            mapByProductId.get(pid) || (exportSku ? existingBySku.get(exportSku) : null);
          if (mappedId) {
            updatePayload.push({ id: mappedId, ...payload });
          } else {
            createPayload.push(payload);
          }
        }
        for (const [, item] of standaloneValidationErrors) items.push(item);

        if (createPayload.length > 0 || updatePayload.length > 0) {
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

          for (const p of standalone) {
            const pid = String(p?.id || '');
            if (standaloneValidationErrors.has(pid)) continue;
            const exportSku = p?.id != null ? String(p.id) : null;
            const viaSku = exportSku ? successes.get(exportSku) : null;
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
                sku: exportSku || null,
                status: 'success',
                externalId: found.wooId,
              });
              aggregated.counts.success += 1;
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
                sku: exportSku || null,
                status: 'error',
                error: message || 'Export failed',
              });
              aggregated.counts.error += 1;
            }
          }
          if (Array.isArray(json?.create)) aggregated.result.create.push(...json.create);
          if (Array.isArray(json?.update)) aggregated.result.update.push(...json.update);
        }

        const successCount = items.filter((i) => i.status === 'success').length;
        const errorCount = items.filter(
          (i) => i.status === 'error' || i.status === 'validation_error',
        ).length;
        aggregated.instances.push({
          instanceId: instanceId,
          label: instance.label,
          ok: true,
          endpoint: `${base}/wp-json/wc/v3/products`,
          result: aggregated.result,
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
    const tenantId = req.session?.tenantId;
    const db = Database.get(req);
    if (!tenantId) return res.status(401).json({ error: 'Tenant not resolved' });

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
            SELECT product_id::text AS product_id, price_amount, sale_price
            FROM channel_product_overrides
            WHERE channel = 'woocommerce'
              AND channel_instance_id = $1
              AND product_id::text = ANY($2::text[])
            `,
            [Number(instanceId), productIds],
          )
        : [];
      const overrideByProductId = new Map();
      for (const row of overrideRows || []) {
        overrideByProductId.set(String(row.product_id), {
          priceAmount: row.price_amount != null ? Number(row.price_amount) : null,
          salePrice:
            row.sale_price != null &&
            Number.isFinite(Number(row.sale_price)) &&
            Number(row.sale_price) > 0
              ? Number(row.sale_price)
              : null,
        });
      }

      const updatePayload = [];
      const validForInstance = [];
      for (const p of products) {
        const productId = String(p?.id || '').trim();
        const exportSku = p?.id != null ? String(p.id) : null;
        const mappedExternalId = mapByProductId.get(productId);
        if (!mappedExternalId) {
          report.skipped_no_map += 1;
          report.expected_skip += 1;
          report.rows.push({
            productId,
            sku: exportSku || null,
            channel: 'woocommerce',
            instanceKey: instance.instanceKey || null,
            status: 'skipped_no_map',
            reason: 'no_mapped_target',
            classification: 'expected_skip',
          });
          continue;
        }

        const quantity = Number(p?.quantity);
        const ov = overrideByProductId.get(productId);
        const overridePrice =
          ov?.priceAmount != null && Number.isFinite(ov.priceAmount) && ov.priceAmount >= 0
            ? ov.priceAmount
            : null;
        const baseRaw = Number(p?.priceAmount);
        const basePrice = Number.isFinite(baseRaw) && baseRaw >= 0 ? baseRaw : null;
        const priceAmount = overridePrice != null ? overridePrice : basePrice;
        if (
          !Number.isFinite(quantity) ||
          quantity < 0 ||
          priceAmount === null ||
          priceAmount === undefined ||
          !Number.isFinite(priceAmount)
        ) {
          report.validation_error += 1;
          report.rows.push({
            productId,
            sku: exportSku || null,
            channel: 'woocommerce',
            instanceKey: instance.instanceKey || null,
            status: 'validation_error',
            reason: 'missing_or_invalid_effective_price',
          });
          continue;
        }

        const payload = {
          id: Number(mappedExternalId),
          manage_stock: true,
          stock_quantity: Math.trunc(quantity),
          regular_price: String(priceAmount),
        };
        if (ov?.salePrice != null && Number.isFinite(ov.salePrice) && ov.salePrice > 0) {
          payload.sale_price = String(ov.salePrice);
        }
        updatePayload.push(payload);
        validForInstance.push({ productId, sku: exportSku || null });
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

  /**
   * POST /api/woocommerce-products/category-cache/sync
   * Manual sync: fetch categories from WooCommerce API and upsert to category_cache.
   * Body: { instanceId: string }
   */
  async syncCategoryCache(req, res) {
    try {
      const inst = await this._getInstanceOrThrow(req);
      const credentials = {
        storeUrl: inst.credentials?.storeUrl || inst.credentials?.store_url,
        consumerKey: inst.credentials?.consumerKey || inst.credentials?.consumer_key || '',
        consumerSecret: inst.credentials?.consumerSecret || inst.credentials?.consumer_secret || '',
        useQueryAuth: !!inst.credentials?.useQueryAuth,
      };
      const items = await fetchWooCategoriesFromApi(credentials, 200);
      const cacheKey = `woo:${inst.id}`;
      const db = Database.get(req);
      const fetchedAt = new Date();
      const payload = JSON.stringify(items);

      const updated = await db.query(
        `UPDATE category_cache SET payload = $2, fetched_at = $3 WHERE cache_key = $1 RETURNING cache_key`,
        [cacheKey, payload, fetchedAt],
      );
      if (!updated.length) {
        await db.query(
          `INSERT INTO category_cache (cache_key, payload, fetched_at) VALUES ($1, $2::jsonb, $3)`,
          [cacheKey, payload, fetchedAt],
        );
      }
      return res.json({ ok: true, count: items.length });
    } catch (error) {
      Logger.error('Woo syncCategoryCache error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError)
        return res.status(error.statusCode).json({ error: error.message });
      return res.status(502).json({ ok: false, error: 'Failed to sync categories' });
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
  normalizeWooOrderToHomebase(instance, settings, order, productIdByExternalId = new Map()) {
    const channelOrderId = order?.id != null ? String(order.id) : '';
    if (!channelOrderId) return null;

    const rawClean = { ...order };
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
      platformOrderNumber: order?.number != null ? String(order.number) : null,
      placedAt: order?.date_created_gmt || order?.date_created || null,
      totalAmount: order?.total != null ? Number(order.total) : null,
      currency: order?.currency || null,
      status: this.mapWooOrderStatusToHomebase(order?.status),
      shippingAddress: order?.shipping || null,
      billingAddress: order?.billing || null,
      customer: {
        email: order?.billing?.email || null,
        firstName: order?.billing?.first_name || null,
        lastName: order?.billing?.last_name || null,
        phone: order?.billing?.phone || null,
        shippingAddress: order?.shipping || null,
        billingAddress: order?.billing || null,
      },
      items: [],
      raw: rawClean,
    };

    const lineItems = Array.isArray(order?.line_items) ? order.line_items : [];
    for (const li of lineItems) {
      const qty = Number(li?.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const wooProductId = li?.product_id != null ? String(li.product_id) : null;
      const platformProductId =
        wooProductId && productIdByExternalId.has(wooProductId)
          ? productIdByExternalId.get(wooProductId)
          : null;
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
        productId: platformProductId || null,
        title: li?.name != null ? String(li.name) : null,
        quantity: Math.trunc(qty),
        unitPrice: Number.isFinite(unitPriceInclVat) ? unitPriceInclVat : null,
        vatRate: Number.isFinite(vatRate) ? vatRate : null,
        raw: li,
      });
    }

    const shippingLines = Array.isArray(order?.shipping_lines) ? order.shipping_lines : [];
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

    return normalized;
  }

  async syncOpenOrdersForInstance(req, instance, after = null) {
    const credentials = instance.credentials || {};
    const storeUrl = credentials.storeUrl || credentials.store_url;
    if (!storeUrl) return { fetched: 0, created: 0 };

    const base = this.normalizeBaseUrl(storeUrl);
    const settings = {
      storeUrl,
      consumerKey: credentials.consumerKey || credentials.consumer_key || '',
      consumerSecret: credentials.consumerSecret || credentials.consumer_secret || '',
      useQueryAuth: credentials.useQueryAuth || false,
    };

    let created = 0;
    let changed = 0;
    let skipped = 0;
    let fetched = 0;
    let pagesFetched = 0;
    let lastCursor = null;
    const inventoryAdjustments = new Map();
    const perPage = 100;
    let page = 1;

    while (true) {
      const url = new URL(`${base}/wp-json/wc/v3/orders`);
      url.searchParams.set('per_page', String(perPage));
      url.searchParams.set('page', String(page));
      url.searchParams.set('orderby', 'date');
      url.searchParams.set('order', 'desc');
      url.searchParams.set('status', 'processing,pending,on-hold');
      if (after) url.searchParams.set('after', after);

      const resp = await this.fetchWithWooAuth(url.toString(), { method: 'GET' }, settings);
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        return { fetched, created: -1, error: (text || resp.statusText).slice(0, 500) };
      }

      const orders = await resp.json().catch(() => null);
      if (!Array.isArray(orders) || orders.length === 0) break;
      fetched += orders.length;
      pagesFetched += 1;

      const wooProductIds = [];
      for (const order of orders) {
        for (const li of Array.isArray(order?.line_items) ? order.line_items : []) {
          if (li?.product_id != null) wooProductIds.push(String(li.product_id));
        }
        const placed = order?.date_created_gmt || order?.date_created;
        if (placed && (!lastCursor || placed > lastCursor)) lastCursor = placed;
      }

      const productIdByExternalId = await this.ordersModel.loadWooProductIdsByExternalId(
        req,
        instance.id,
        wooProductIds,
      );
      const normalizedOrders = orders
        .map((order) =>
          this.normalizeWooOrderToHomebase(instance, settings, order, productIdByExternalId),
        )
        .filter(Boolean);
      const ingestRes = await this.ordersModel.ingestBatch(req, normalizedOrders);
      created += ingestRes.createdCount;
      changed += ingestRes.changedCount;
      skipped += ingestRes.skippedCount;
      for (const adj of ingestRes.inventoryAdjustments || []) {
        const pid = Number(adj?.productId);
        const qty = Number(adj?.quantity);
        if (!Number.isFinite(pid) || !Number.isFinite(qty) || qty <= 0) continue;
        inventoryAdjustments.set(pid, (inventoryAdjustments.get(pid) || 0) + qty);
      }

      if (orders.length < perPage) break;
      page += 1;
    }

    await this.applyInventoryAdjustments(
      req,
      Array.from(inventoryAdjustments.entries()).map(([productId, quantity]) => ({
        productId,
        quantity,
      })),
    ).catch(() => {});

    return {
      fetched,
      created,
      changed,
      skipped,
      lastCursor,
      pagesFetched,
      inventoryUpdatedProducts: inventoryAdjustments.size,
    };
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

      const allResults = [];
      let totalFetched = 0;
      let totalCreated = 0;
      let totalChanged = 0;
      let totalSkipped = 0;

      // Fetch orders from all instances
      for (const instance of instances) {
        const credentials = instance.credentials || {};
        const storeUrl = credentials.storeUrl || credentials.store_url;
        if (!storeUrl) {
          Logger.warn('Skipping WooCommerce instance without storeUrl', {
            tenantId: req.session?.tenantId,
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
            Logger.warn('Failed to fetch Woo orders from instance', {
              tenantId: req.session?.tenantId,
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
              tenantId: req.session?.tenantId,
              instanceId: instance.id,
              instanceKey: instance.instanceKey,
              storeUrl,
            });
            continue;
          }

          totalFetched += orders.length;
          const wooProductIds = [];
          for (const order of orders) {
            for (const li of Array.isArray(order?.line_items) ? order.line_items : []) {
              if (li?.product_id != null) wooProductIds.push(String(li.product_id));
            }
          }
          const productIdByExternalId = await this.ordersModel.loadWooProductIdsByExternalId(
            req,
            instance.id,
            wooProductIds,
          );
          const normalizedOrders = [];
          const channelOrderIds = [];
          for (const order of orders) {
            const normalized = this.normalizeWooOrderToHomebase(
              instance,
              settings,
              order,
              productIdByExternalId,
            );
            if (!normalized) continue;
            normalizedOrders.push(normalized);
            channelOrderIds.push(String(normalized.channelOrderId));
          }

          const ingestRes = await this.ordersModel.ingestBatch(req, normalizedOrders);
          totalCreated += ingestRes.createdCount;
          totalChanged += ingestRes.changedCount;
          totalSkipped += ingestRes.skippedCount;
          await this.applyInventoryAdjustments(req, ingestRes.inventoryAdjustments || []).catch(
            (err) => {
              Logger.warn('Inventory sync failed (non-fatal)', err, {
                instanceId: instance.id,
                instanceKey: instance.instanceKey,
              });
            },
          );

          ingestRes.results.forEach((result, idx) => {
            allResults.push({
              channelOrderId: channelOrderIds[idx],
              ...result,
            });
          });
        } catch (instanceError) {
          Logger.error('Error processing WooCommerce instance', instanceError, {
            tenantId: req.session?.tenantId,
            instanceId: instance.id,
            instanceKey: instance.instanceKey,
            storeUrl,
          });
          // Continue with next instance
        }
      }

      const shouldRenumber = req.body?.renumber !== false;
      if (shouldRenumber) {
        await this.ordersModel.renumberOrderNumbersByPlacedAt(req);
      }

      return res.json({
        ok: true,
        fetched: totalFetched,
        ingested: allResults.length,
        created: totalCreated,
        changed: totalChanged,
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
  async applyInventoryAdjustments(req, adjustments) {
    const db = Database.get(req);
    const tenantId = req.session?.tenantId;
    if (!tenantId || !Array.isArray(adjustments) || adjustments.length === 0) return;

    for (const adj of adjustments) {
      const pid = adj?.productId != null ? Number(adj.productId) : null;
      const qty = Number(adj?.quantity);
      if (pid == null || !Number.isFinite(pid) || !Number.isFinite(qty) || qty <= 0) continue;
      const updated = await db.query(
        `
        UPDATE products
        SET quantity = GREATEST(quantity - $2, 0),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, sku, quantity
        `,
        [pid, qty],
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

  async applyInventoryFromOrderId(req, orderId) {
    const db = Database.get(req);
    const tenantId = req.session?.tenantId;
    if (!tenantId) return;

    const items = await db.query(
      `SELECT oi.sku, oi.product_id, oi.quantity
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [Number(orderId)],
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

    await this.applyInventoryAdjustments(
      req,
      Array.from(byProductId.entries()).map(([productId, quantity]) => ({ productId, quantity })),
    );
  }

  // ---- Template parity CRUD (kept) ----

  /**
   * Push stock quantity to WooCommerce for one product (used by Products pushStockToChannels).
   * @param {object} req - request with session
   * @param {{ productId: string, sku: string, quantity: number, externalId: string|null, channelInstanceId: string|null }} opts
   */
  async syncStock(req, { productId, sku, quantity, externalId, channelInstanceId }) {
    let settings = null;
    if (channelInstanceId) {
      const instance = await this.model.getInstanceById(req, channelInstanceId);
      settings = instance?.credentials || null;
    }
    if (!settings) {
      await this.model.upsertChannelMap(req, {
        productId,
        channel: 'woocommerce',
        channelInstanceId: channelInstanceId || null,
        externalId: externalId || null,
        status: 'error',
        error: 'Woo instance missing for this mapping; cannot sync stock',
      });
      return;
    }
    if (!settings?.storeUrl || !settings?.consumerKey || !settings?.consumerSecret) {
      await this.model.upsertChannelMap(req, {
        productId,
        channel: 'woocommerce',
        channelInstanceId: channelInstanceId || null,
        externalId: externalId || null,
        status: 'error',
        error: 'Woo settings missing; cannot sync stock',
      });
      return;
    }

    const base = this.normalizeBaseUrl(settings.storeUrl);
    const wooSettings = {
      storeUrl: settings.storeUrl,
      consumerKey: settings.consumerKey,
      consumerSecret: settings.consumerSecret,
      useQueryAuth: settings.useQueryAuth,
    };

    // Look up by variation SKU (V+productId) first, then by productId for standalone
    const variationSku = `V${productId}`;
    let existing = await this.findWooProductBySku(base, variationSku, wooSettings);
    if (!existing?.id) {
      existing = await this.findWooProductBySku(base, String(productId), wooSettings);
    }
    if (!existing?.id) {
      await this.model.upsertChannelMap(req, {
        productId,
        channel: 'woocommerce',
        channelInstanceId: channelInstanceId || null,
        externalId: externalId || null,
        status: 'error',
        error: `Product not found in WooCommerce (SKU V${productId} or ${productId})`,
      });
      await this.model.logChannelError(req, {
        channel: 'woocommerce',
        productId,
        payload: { productId, quantity },
        response: null,
        message: 'Product not found in WooCommerce',
      });
      return;
    }

    const wooId = Number(existing.id);
    const parentId = existing.parent_id != null ? Number(existing.parent_id) : null;
    const isVariation = parentId != null && parentId > 0;

    const url = isVariation
      ? `${base}/wp-json/wc/v3/products/${parentId}/variations/${wooId}`
      : `${base}/wp-json/wc/v3/products/${wooId}`;
    const putInit = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manage_stock: true, stock_quantity: Number(quantity) }),
    };
    const maxAttempts = 5;
    let resp = null;
    let lastErrorBody = '';
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      resp = await this.fetchWithWooAuth(url, putInit, wooSettings);
      if (resp.ok) {
        break;
      }
      const retryable = resp.status === 429 || resp.status >= 500;
      lastErrorBody = await resp.text().catch(() => '');
      if (!retryable || attempt === maxAttempts - 1) {
        break;
      }
      const retryAfterRaw = resp.headers?.get?.('retry-after');
      const retryAfterSec = Number(retryAfterRaw);
      const backoffMs =
        Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? Math.min(120000, retryAfterSec * 1000)
          : Math.min(60000, 1000 * 2 ** attempt);
      await new Promise((r) => setTimeout(r, backoffMs));
    }

    if (!resp.ok) {
      const text = lastErrorBody || (await resp.text().catch(() => ''));
      await this.model.upsertChannelMap(req, {
        productId,
        channel: 'woocommerce',
        channelInstanceId: channelInstanceId || null,
        externalId: wooId,
        status: 'error',
        error: text || 'Stock sync failed',
      });
      await this.model.logChannelError(req, {
        channel: 'woocommerce',
        productId,
        payload: { sku, quantity, wooId },
        response: { status: resp.status, statusText: resp.statusText, body: text },
        message: 'Woo stock sync failed',
      });
      return;
    }

    await this.model.upsertChannelMap(req, {
      productId,
      channel: 'woocommerce',
      channelInstanceId: channelInstanceId || null,
      externalId: wooId,
      status: 'success',
      error: null,
    });
  }

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

  /** Partition products into grouped (by groupId) and standalone. Group = same groupId + groupVariationType color/size/model. */
  partitionProductsByWooGroup(products) {
    const grouped = new Map();
    const standalone = [];
    const VARIATION_TYPES = ['color', 'size', 'model'];
    for (const p of products) {
      const gid = p?.groupId != null && String(p.groupId).trim() ? String(p.groupId).trim() : null;
      const vt =
        p?.groupVariationType &&
        VARIATION_TYPES.includes(String(p.groupVariationType).toLowerCase())
          ? String(p.groupVariationType).toLowerCase()
          : null;
      if (gid && vt) {
        if (!grouped.has(gid)) grouped.set(gid, []);
        grouped.get(gid).push(p);
      } else {
        standalone.push(p);
      }
    }
    return { grouped, standalone };
  }

  /** Get attribute value for a product by variation type (color/size/model). */
  getVariationAttributeValue(p, variationType) {
    const v = String(variationType || '').toLowerCase();
    if (v === 'color') return (p?.color ?? p?.colorText ?? '').trim() || null;
    if (v === 'size') return (p?.size ?? p?.sizeText ?? '').trim() || null;
    if (v === 'model') return (p?.model ?? '').trim() || null;
    return null;
  }

  /** Ensure variable product exists in Woo (SKU = groupId). Returns { wooParentId } or null on failure. */
  async ensureWooVariableProduct(
    base,
    settings,
    groupId,
    groupProducts,
    overrideCategoriesByProductId,
  ) {
    const existing = await this.findWooProductBySku(base, groupId, settings);
    if (existing?.id && existing.type === 'variable') {
      return { wooParentId: Number(existing.id), created: false };
    }
    if (existing?.id && existing.type !== 'variable') {
      Logger.warn('WooCommerce: product with SKU equal to groupId is not variable', {
        groupId,
        wooType: existing.type,
      });
      return null;
    }
    const mainProduct =
      groupProducts.find((p) => !p.parentProductId || String(p.parentProductId).trim() === '') ||
      groupProducts[0];
    const variationType = String(mainProduct?.groupVariationType || 'color').toLowerCase();
    const attrName = variationType;
    const options = [];
    const seen = new Set();
    for (const p of groupProducts) {
      const val = this.getVariationAttributeValue(p, variationType);
      if (val && !seen.has(val)) {
        seen.add(val);
        options.push(val);
      }
    }
    if (options.length === 0) options.push('Default');
    const categories = overrideCategoriesByProductId.get(String(mainProduct?.id || '')) || [];
    const payload = {
      type: 'variable',
      sku: groupId,
      name: mainProduct?.title ?? 'Variable product',
      status: this.mapStatusToWoo(mainProduct?.status),
      description: mainProduct?.description ?? '',
      manage_stock: false,
      attributes: [
        {
          name: attrName,
          variation: true,
          visible: true,
          options,
        },
      ],
      categories: Array.isArray(categories) && categories.length ? categories : undefined,
    };
    if (mainProduct?.mainImage && isValidImageUrl(mainProduct.mainImage)) {
      payload.images = [{ src: mainProduct.mainImage }];
    }
    const url = `${base}/wp-json/wc/v3/products`;
    const resp = await this.fetchWithWooAuth(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      settings,
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      Logger.warn('WooCommerce variable product create failed', {
        groupId,
        status: resp.status,
        body: text,
      });
      return null;
    }
    const created = await resp.json().catch(() => null);
    const wooParentId = created?.id != null ? Number(created.id) : null;
    return wooParentId != null ? { wooParentId, created: true } : null;
  }

  /** Build variation payload for Woo (one variant). options: priceAmount, salePrice from overrides. */
  buildWooVariationPayload(p, variationType, options = {}) {
    const attrName = String(variationType || 'color').toLowerCase();
    const attrValue = this.getVariationAttributeValue(p, variationType) || 'Default';
    const regularPrice =
      options.priceAmount != null && Number.isFinite(options.priceAmount)
        ? String(options.priceAmount)
        : p?.priceAmount != null
          ? String(p.priceAmount)
          : undefined;
    const salePrice =
      options.salePrice != null && Number.isFinite(options.salePrice) && options.salePrice > 0
        ? String(options.salePrice)
        : undefined;
    const payload = {
      sku: `V${p?.id ?? ''}`,
      attributes: [{ name: attrName, option: attrValue }],
      regular_price: regularPrice,
      ...(salePrice != null ? { sale_price: salePrice } : {}),
      manage_stock: true,
      stock_quantity: p?.quantity != null ? Math.max(0, Math.floor(Number(p.quantity))) : 0,
    };
    if (p?.mainImage && isValidImageUrl(p.mainImage)) {
      payload.image = { src: p.mainImage };
    }
    return payload;
  }

  /** Ensure variation exists (SKU = V+productId). Returns wooVariationId or null. */
  async ensureWooVariation(
    base,
    settings,
    wooParentId,
    product,
    variationType,
    overrideByProductId,
  ) {
    const variationSku = `V${product?.id ?? ''}`;
    const existing = await this.findWooProductBySku(base, variationSku, settings);
    const pid = String(product?.id || '');
    const ov = overrideByProductId.get(pid) || {};
    const options = {
      priceAmount: ov.priceAmount != null ? Number(ov.priceAmount) : undefined,
      salePrice:
        ov.salePrice != null && Number.isFinite(ov.salePrice) ? Number(ov.salePrice) : undefined,
    };
    const body = this.buildWooVariationPayload(product, variationType, options);
    if (existing?.id && existing?.parent_id === wooParentId) {
      const variationId = Number(existing.id);
      const url = `${base}/wp-json/wc/v3/products/${wooParentId}/variations/${variationId}`;
      const resp = await this.fetchWithWooAuth(
        url,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        settings,
      );
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        Logger.warn('WooCommerce variation update failed', {
          variationSku,
          status: resp.status,
          body: text,
        });
        return null;
      }
      return variationId;
    }
    const url = `${base}/wp-json/wc/v3/products/${wooParentId}/variations`;
    const resp = await this.fetchWithWooAuth(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      settings,
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      Logger.warn('WooCommerce variation create failed', {
        variationSku,
        status: resp.status,
        body: text,
      });
      return null;
    }
    const created = await resp.json().catch(() => null);
    return created?.id != null ? Number(created.id) : null;
  }

  mapStatusToWoo(status) {
    const s = String(status || '')
      .trim()
      .toLowerCase();
    if (s === 'paused' || s === 'private') return 'private';
    if (s === 'for sale' || s === 'active' || s === 'publish') return 'publish';
    return 'publish';
  }

  mapWooStatusToHomebase(status) {
    const s = String(status || '')
      .trim()
      .toLowerCase();
    if (s === 'private') return 'paused';
    if (s === 'publish') return 'for sale';
    return 'for sale';
  }

  // Transform MVP Product -> Woo product payload
  // options: { priceAmount?: number, salePrice?: number } for per-instance override (regular_price, sale_price)
  mapProductToWoo(p, overrideCategories = [], options = {}) {
    const images = [];
    if (p?.mainImage && isValidImageUrl(p.mainImage)) images.push({ src: p.mainImage });
    if (Array.isArray(p?.images)) {
      for (const src of p.images) {
        if (src && isValidImageUrl(String(src).trim())) images.push({ src: String(src).trim() });
      }
    }

    const attrs = [];
    if (p?.brand) attrs.push({ name: 'brand', options: [String(p.brand)] });
    const colorVal = (p?.color ?? p?.colorText ?? '').trim();
    if (colorVal) attrs.push({ name: 'color', options: [colorVal] });
    const sizeVal = (p?.size ?? p?.sizeText ?? '').trim();
    if (sizeVal) attrs.push({ name: 'size', options: [sizeVal] });
    const modelVal = (p?.model ?? '').trim();
    if (modelVal) attrs.push({ name: 'model', options: [modelVal] });
    const materialVal = (p?.material ?? '').trim();
    if (materialVal) attrs.push({ name: 'material', options: [materialVal] });

    const cs = p?.channelSpecific && typeof p.channelSpecific === 'object' ? p.channelSpecific : {};
    const standardMarket = ['se', 'dk', 'fi', 'no'].includes(
      String(cs.textsStandard || '').toLowerCase(),
    )
      ? String(cs.textsStandard).toLowerCase()
      : 'se';
    const textsExtended =
      cs.textsExtended && typeof cs.textsExtended === 'object' ? cs.textsExtended : {};
    const standardText = textsExtended[standardMarket] || textsExtended.se || {};

    const metaData = [];
    const ean = (p?.ean ?? '').trim();
    const gtin = (p?.gtin ?? '').trim();
    const mpn = (p?.mpn ?? '').trim();
    if (ean) metaData.push({ key: 'ean', value: ean });
    if (gtin) metaData.push({ key: 'gtin', value: gtin });
    if (mpn) metaData.push({ key: 'mpn', value: mpn });
    const titleSeo = (standardText.titleSeo ?? '').trim();
    if (titleSeo) metaData.push({ key: 'seo_title', value: titleSeo });
    const metaDesc = (standardText.metaDesc ?? '').trim();
    if (metaDesc) metaData.push({ key: 'seo_meta_desc', value: metaDesc });
    const metaKw = (standardText.metaKeywords ?? '').trim();
    if (metaKw) metaData.push({ key: 'seo_meta_keywords', value: metaKw });
    const conditionValue =
      p?.condition === 'refurb' ? 'refurbished' : p?.condition === 'used' ? 'used' : 'new';
    metaData.push({ key: 'condition', value: conditionValue });

    const regularPrice =
      options.priceAmount != null && Number.isFinite(options.priceAmount)
        ? String(options.priceAmount)
        : p?.priceAmount != null
          ? String(p.priceAmount)
          : undefined;
    const salePrice =
      options.salePrice != null && Number.isFinite(options.salePrice) && options.salePrice > 0
        ? String(options.salePrice)
        : undefined;

    const description = p?.description ?? '';
    const shortDescription =
      metaDesc || (description.length > 160 ? description.slice(0, 157) + '...' : description);

    const weightUnit = (p?.channelSpecific?.weightUnit ?? 'g').toString().trim().toLowerCase();
    const weightKg =
      p?.weight != null && Number.isFinite(Number(p.weight))
        ? weightUnit === 'kg'
          ? String(Number(p.weight))
          : String(Number(p.weight) / 1000)
        : undefined;

    const lengthCm =
      p?.lengthCm != null && Number.isFinite(Number(p.lengthCm)) ? Number(p.lengthCm) : null;
    const widthCm =
      p?.widthCm != null && Number.isFinite(Number(p.widthCm)) ? Number(p.widthCm) : null;
    const heightCm =
      p?.heightCm != null && Number.isFinite(Number(p.heightCm)) ? Number(p.heightCm) : null;
    const dimensions =
      lengthCm != null || widthCm != null || heightCm != null
        ? {
            length: lengthCm != null ? String(lengthCm) : '',
            width: widthCm != null ? String(widthCm) : '',
            height: heightCm != null ? String(heightCm) : '',
          }
        : undefined;

    const woo =
      p?.channelSpecific?.woocommerce && typeof p.channelSpecific.woocommerce === 'object'
        ? p.channelSpecific.woocommerce
        : {};
    const backorders =
      woo.backorders === 'yes' || woo.backorders === 'notify' ? woo.backorders : 'no';

    return {
      sku: p?.id != null ? String(p.id) : null,
      name: p?.title ?? '',
      status: this.mapStatusToWoo(p?.status),
      regular_price: regularPrice,
      ...(salePrice != null ? { sale_price: salePrice } : {}),
      manage_stock: true,
      backorders,
      stock_quantity: p?.quantity != null ? Number(p.quantity) : undefined,
      description: description || '',
      short_description: shortDescription || undefined,
      ...(weightKg != null ? { weight: weightKg } : {}),
      ...(dimensions ? { dimensions } : {}),
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

    // find brand and model (and other variant attrs) from attributes
    let brand = null;
    let model = null;
    if (Array.isArray(w?.attributes)) {
      const brandAttr = w.attributes.find((a) => String(a?.name || '').toLowerCase() === 'brand');
      if (brandAttr && Array.isArray(brandAttr?.options) && brandAttr.options.length) {
        brand = String(brandAttr.options[0]);
      }
      const modelAttr = w.attributes.find((a) => String(a?.name || '').toLowerCase() === 'model');
      if (modelAttr && Array.isArray(modelAttr?.options) && modelAttr.options.length) {
        model = String(modelAttr.options[0]);
      }
    }

    return {
      id: undefined,
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
      model: model || undefined,
      gtin: null,
      createdAt: w?.date_created || null,
      updatedAt: w?.date_modified || null,
    };
  }
}

module.exports = WooCommerceController;
