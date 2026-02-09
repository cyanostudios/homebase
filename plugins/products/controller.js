// plugins/products/controller.js

const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const XLSX = require('xlsx');
const csvParser = require('csv-parser');
const { Readable } = require('stream');

const lookupsModel = require('./lookupsModel');

const IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const IMPORT_MAX_ROWS = 5000;

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[_-]+/g, '')
    // Keep dots so we can parse standard headers like "cdon.se.price"
    // Also strips external suffixes like "#53270".
    .replace(/[^a-z0-9.]+/g, '');
}

function toIntOrUndef(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

function toFloatOrUndef(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function toStrOrUndef(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

function mergeForUpdate(existing, incoming) {
  const merged = { ...existing };

  const setIf = (key, val) => {
    if (val !== undefined && val !== null && !(typeof val === 'string' && val.trim() === '')) {
      merged[key] = val;
    }
  };

  setIf('productNumber', incoming.productNumber);
  setIf('title', incoming.title);
  setIf('description', incoming.description);
  setIf('status', incoming.status);
  setIf('quantity', incoming.quantity);
  setIf('priceAmount', incoming.priceAmount);
  setIf('currency', incoming.currency);
  setIf('vatRate', incoming.vatRate);
  setIf('brand', incoming.brand);
  setIf('mpn', incoming.mpn);
  setIf('gtin', incoming.gtin);

  // Always keep SKU stable (unique key)
  merged.sku = existing.sku;
  return merged;
}

async function parseCsvBuffer(buffer) {
  return await new Promise((resolve, reject) => {
    const rows = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(
        csvParser({
          mapHeaders: ({ header }) => normalizeHeader(header),
          skipLines: 0,
          strict: false,
        }),
      )
      .on('data', (row) => {
        rows.push(row);
        if (rows.length > IMPORT_MAX_ROWS) {
          stream.destroy(new Error(`Too many rows (max ${IMPORT_MAX_ROWS})`));
        }
      })
      .on('error', (err) => reject(err))
      .on('end', () => resolve(rows));
  });
}

function parseXlsxBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!Array.isArray(json)) return [];

  // Normalize keys to match CSV path
  return json.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row || {})) {
      out[normalizeHeader(k)] = v;
    }
    return out;
  });
}

class ProductController {
  constructor(model) {
    this.model = model;
  }

  async getBrands(req, res) {
    try {
      const items = await lookupsModel.getAll(req, 'brands');
      res.json({ items });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message, code: err.code });
      Logger.error('getBrands failed', err);
      res.status(500).json({ error: 'Failed to fetch brands' });
    }
  }

  async createBrand(req, res) {
    try {
      const { name } = req.body || {};
      const item = await lookupsModel.create(req, 'brands', name);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message, code: err.code });
      Logger.error('createBrand failed', err);
      res.status(500).json({ error: 'Failed to create brand' });
    }
  }

  async getSuppliers(req, res) {
    try {
      const items = await lookupsModel.getAll(req, 'suppliers');
      res.json({ items });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message, code: err.code });
      Logger.error('getSuppliers failed', err);
      res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
  }

  async createSupplier(req, res) {
    try {
      const { name } = req.body || {};
      const item = await lookupsModel.create(req, 'suppliers', name);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message, code: err.code });
      Logger.error('createSupplier failed', err);
      res.status(500).json({ error: 'Failed to create supplier' });
    }
  }

  async getManufacturers(req, res) {
    try {
      const items = await lookupsModel.getAll(req, 'manufacturers');
      res.json({ items });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message, code: err.code });
      Logger.error('getManufacturers failed', err);
      res.status(500).json({ error: 'Failed to fetch manufacturers' });
    }
  }

  async createManufacturer(req, res) {
    try {
      const { name } = req.body || {};
      const item = await lookupsModel.create(req, 'manufacturers', name);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message, code: err.code });
      Logger.error('createManufacturer failed', err);
      res.status(500).json({ error: 'Failed to create manufacturer' });
    }
  }

  async upsertChannelOverride(req, { productId, channel, instance, active, priceAmount, currency, vatRate, category }) {
    const { Database } = require('@homebase/core');
    const db = Database.get(req);
    const userId = req.session?.user?.id || req.session?.user?.uuid;
    if (!userId) return;

    const channelKey = String(channel).toLowerCase();
    const instanceKey = String(instance || '').trim();
    if (!instanceKey) return;

    // Ensure instance exists (future-proof: multiple stores / markets)
    const inferredMarket =
      (channelKey === 'cdon' || channelKey === 'fyndiq') && ['se', 'dk', 'fi'].includes(instanceKey.toLowerCase())
        ? instanceKey.toLowerCase()
        : null;

    const instRows = await db.query(
      `
      INSERT INTO channel_instances (user_id, channel, instance_key, market, label, credentials, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, channel, instance_key) DO UPDATE SET
        market = COALESCE(channel_instances.market, EXCLUDED.market),
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
      `,
      [userId, channelKey, instanceKey, inferredMarket],
    );
    const channelInstanceId = instRows?.[0]?.id;

    const sql = `
      INSERT INTO channel_product_overrides
        (user_id, product_id, channel, instance, channel_instance_id, active, price_amount, currency, vat_rate, category, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, product_id, channel, instance) DO UPDATE SET
        channel_instance_id = COALESCE(EXCLUDED.channel_instance_id, channel_product_overrides.channel_instance_id),
        active = EXCLUDED.active,
        price_amount = EXCLUDED.price_amount,
        currency = EXCLUDED.currency,
        vat_rate = EXCLUDED.vat_rate,
        category = EXCLUDED.category,
        updated_at = CURRENT_TIMESTAMP
    `;

    await db.query(sql, [
      userId,
      String(productId),
      channelKey,
      instanceKey,
      channelInstanceId || null,
      !!active,
      priceAmount != null && Number.isFinite(Number(priceAmount)) ? Number(priceAmount) : null,
      currency ? String(currency) : null,
      vatRate != null && Number.isFinite(Number(vatRate)) ? Number(vatRate) : null,
      category != null && String(category).trim() ? String(category).trim() : null,
    ]);
  }

  parseSelloOverridesFromRow(r) {
    // r is already normalized by normalizeHeader()
    const entries = Object.entries(r || {});
    const out = [];

    // Standard template format: "<channel>.<instance>.<field>"
    // Examples:
    // - cdon.se.price, cdon.se.active, cdon.se.category
    // - fyndiq.fi.price, fyndiq.fi.active, fyndiq.fi.category
    // - woocommerce.shopA.price, woocommerce.shopA.active, woocommerce.shopA.categories
    for (const [k, v] of entries) {
      const m = String(k).match(/^([a-z0-9]+)\.([a-z0-9]+)\.(price|active|category|categories)$/);
      if (!m) continue;
      const channel = m[1];
      const instance = m[2];
      const field = m[3];

      // Find existing aggregate for (channel, instance)
      let rec = out.find((x) => x.channel === channel && x.instance === instance);
      if (!rec) {
        rec = { channel, instance, active: false, priceAmount: null, category: null };
        out.push(rec);
      }

      if (field === 'price') rec.priceAmount = v;
      if (field === 'active') rec.active = Number(v) === 1 || String(v).trim() === '1' || String(v).toLowerCase() === 'true';
      if (field === 'category' || field === 'categories') rec.category = v;
    }

    // CDON: cdonseprice55616, cdonseactive55616, cdondkprice..., cdonfiprice...
    const cdonMarkets = ['se', 'dk', 'fi'];
    for (const m of cdonMarkets) {
      const priceKey = entries.find(([k]) => k.startsWith(`cdon${m}price`))?.[0];
      const activeKey = entries.find(([k]) => k.startsWith(`cdon${m}active`))?.[0];
      if (!priceKey && !activeKey) continue;

      const priceRaw = r[priceKey] ?? null;
      const activeRaw = r[activeKey] ?? null;

      out.push({
        channel: 'cdon',
        instance: m, // market instance
        priceAmount: priceRaw,
        active: Number(activeRaw) === 1 || String(activeRaw).trim() === '1' || String(activeRaw).toLowerCase() === 'true',
      });
    }

    // Fyndiq: fyndiq3price53270, fyndiq3active53270 (instance is the numeric code)
    for (const [k, v] of entries) {
      const m = k.match(/^fyndiq3price(\d+)$/);
      if (!m) continue;
      const code = m[1];
      const activeKey = `fyndiq3active${code}`;
      out.push({
        channel: 'fyndiq',
        instance: code,
        priceAmount: v,
        active: Number(r[activeKey]) === 1 || String(r[activeKey]).trim() === '1' || String(r[activeKey]).toLowerCase() === 'true',
      });
    }

    // WooCommerce: woocommerceprice55051 (store instance code)
    for (const [k, v] of entries) {
      const m = k.match(/^woocommerceprice(\d+)$/);
      if (!m) continue;
      const code = m[1];
      out.push({
        channel: 'woocommerce',
        instance: code,
        priceAmount: v,
        active: true,
      });
    }

    return out;
  }

  // Helper: map PG 23505 unique violation to { field, message }
  mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;

    const constraint = String(error.constraint || '').toLowerCase();
    const detail = String(error.detail || '');
    const match = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
    const cols = match ? match[1].split(',').map((s) => s.trim()) : [];
    const val = match ? match[2] : undefined;

    const hasCol = (name) => constraint.includes(name) || cols.includes(name);

    if (hasCol('product_number')) {
      return {
        field: 'productNumber',
        message: val ? `Product number "${val}" already exists` : 'Product number already exists',
      };
    }

    if (hasCol('sku')) {
      return {
        field: 'sku',
        message: val ? `SKU "${val}" already exists` : 'SKU already exists',
      };
    }

    return { field: 'general', message: 'Unique constraint violated' };
  }

  requireSku(req, res) {
    const data = req.body || {};
    const sku = String(data.sku || '').trim();
    if (!sku) {
      res.status(400).json({ error: 'SKU is required', code: 'VALIDATION_ERROR' });
      return null;
    }
    return data;
  }

  // ---- CRUD ----

  async getAll(req, res) {
    try {
      const products = await this.model.getAll(req);
      return res.json(products);
    } catch (error) {
      Logger.error('Get products error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({ error: 'Failed to fetch products' });
    }
  }

  async create(req, res) {
    try {
      const data = this.requireSku(req, res);
      if (!data) return;

      const product = await this.model.create(req, data);
      return res.json(product);
    } catch (error) {
      Logger.error('Create product error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        const mapped = this.mapUniqueViolation(error);
        if (mapped) {
          return res.status(409).json({ errors: [mapped] });
        }
        return res.status(error.statusCode).json(error.toJSON());
      }

      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      return res.status(500).json({ error: 'Failed to create product' });
    }
  }

  async getStats(req, res) {
    try {
      const productId = String(req.params?.id || '').trim();
      const range = String(req.query?.range || '30d').toLowerCase();
      if (!productId) {
        return res.status(400).json({ error: 'Product ID required', code: 'VALIDATION_ERROR' });
      }
      const stats = await this.model.getProductStats(req, productId, range);
      return res.json(stats);
    } catch (error) {
      Logger.error('Get product stats error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to fetch product stats' });
    }
  }

  async update(req, res) {
    try {
      const data = this.requireSku(req, res);
      if (!data) return;

      const product = await this.model.update(req, req.params.id, data);
      return res.json(product);
    } catch (error) {
      Logger.error('Update product error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        if (error.code === 'NOT_FOUND') {
          return res.status(404).json(error.toJSON());
        }
        const mapped = this.mapUniqueViolation(error);
        if (mapped) {
          return res.status(409).json({ errors: [mapped] });
        }
        return res.status(error.statusCode).json(error.toJSON());
      }

      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      return res.status(500).json({ error: 'Failed to update product' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      return res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      Logger.error('Delete product error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        if (error.code === 'NOT_FOUND') {
          return res.status(404).json(error.toJSON());
        }
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({ error: 'Failed to delete product' });
    }
  }

  // ---- Batch update ----
  // PATCH /api/products/batch
  // body: { ids: string[], updates: { priceAmount?: number, quantity?: number, status?: string, vatRate?: number, currency?: string } }
  async batchUpdate(req, res) {
    try {
      const idsRaw = req.body?.ids;
      const updates = req.body?.updates || {};
      if (!Array.isArray(idsRaw)) {
        return res.status(400).json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const ids = Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)));
      if (!ids.length) {
        return res.json({ ok: true, updatedCount: 0, updatedIds: [] });
      }
      if (ids.length > 500) {
        return res.status(400).json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }

      const result = await this.model.batchUpdate(req, ids, updates);
      return res.json({
        ok: true,
        updatedCount: result.updatedCount ?? 0,
        updatedIds: result.updatedIds ?? [],
      });
    } catch (error) {
      Logger.error('Batch update products error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to batch update products' });
    }
  }

  // ---- Bulk delete ----
  // DELETE /api/products/batch
  // body: { ids: string[] }
  async bulkDelete(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res.status(400).json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const ids = Array.from(
        new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)),
      );

      if (!ids.length) {
        return res.json({ ok: true, requested: 0, deleted: 0 });
      }

      if (ids.length > 500) {
        return res.status(400).json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }

      const result = await this.model.bulkDelete(req, ids);

      const deleted =
        typeof result?.deletedCount === 'number'
          ? result.deletedCount
          : Array.isArray(result?.deletedIds)
            ? result.deletedIds.length
            : 0;

      return res.json({
        ok: true,
        requested: ids.length,
        deleted,
        deletedIds: result?.deletedIds || [],
      });
    } catch (error) {
      Logger.error('Bulk delete error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({ error: 'Bulk delete failed' });
    }
  }

  // ---- Import ----
  // POST /api/products/import (multipart/form-data)
  // fields: mode = 'update-only' | 'create-only' | 'upsert'
  // file: file
  async import(req, res) {
    try {
      const modeRaw = String(req.body?.mode || 'upsert').trim().toLowerCase();
      const mode =
        modeRaw === 'update-only' || modeRaw === 'create-only' || modeRaw === 'upsert'
          ? modeRaw
          : null;
      if (!mode) {
        return res.status(400).json({ error: 'Invalid mode (use update-only, create-only, or upsert)', code: 'VALIDATION_ERROR' });
      }

      const file = req.file;
      if (!file || !file.buffer) {
        return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });
      }
      if (file.size > IMPORT_MAX_FILE_BYTES) {
        return res.status(400).json({ error: `File too large (max ${Math.round(IMPORT_MAX_FILE_BYTES / 1024 / 1024)}MB)`, code: 'VALIDATION_ERROR' });
      }

      const originalName = String(file.originalname || '').toLowerCase();
      const isCsv =
        file.mimetype === 'text/csv' ||
        file.mimetype === 'application/csv' ||
        originalName.endsWith('.csv');
      const isXlsx =
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        originalName.endsWith('.xlsx');
      if (!isCsv && !isXlsx) {
        return res.status(400).json({ error: 'Unsupported file type (use .csv or .xlsx)', code: 'VALIDATION_ERROR' });
      }

      const rawRows = isCsv ? await parseCsvBuffer(file.buffer) : parseXlsxBuffer(file.buffer);
      if (rawRows.length > IMPORT_MAX_ROWS) {
        return res.status(400).json({ error: `Too many rows (max ${IMPORT_MAX_ROWS})`, code: 'VALIDATION_ERROR' });
      }

      const result = {
        ok: true,
        mode,
        totalRows: rawRows.length,
        created: 0,
        updated: 0,
        skippedMissingSku: [],
        skippedInvalid: [],
        conflicts: [],
        notFound: [],
        rows: [],
      };

      for (let i = 0; i < rawRows.length; i++) {
        const rowNum = i + 1;
        const r = rawRows[i] || {};

        // Expected normalized keys (no spaces/underscores):
        // Default import: sku, title, description, quantity, priceamount, currency, vatrate, productnumber, status, brand, mpn, gtin
        // Sello export: sku, standardnamesv, standarddescriptionsv, tax, brand, manufacturerno, propertygtin/propertyean,
        // plus per-channel columns like cdonseprice####, cdonseactive####, fyndiq3price####, fyndiq3active####.
        const sku = toStrOrUndef(r.sku);
        if (!sku) {
          result.skippedMissingSku.push({ row: rowNum });
          result.rows.push({ row: rowNum, action: 'skipped', reason: 'missing_sku' });
          continue;
        }

        const isSello = r.standardnamesv != null || r.standarddescriptionsv != null || r.manufacturerno != null;
        const selloVat = toFloatOrUndef(r.tax);
        const selloGtin = toStrOrUndef(r.propertygtin) || toStrOrUndef(r.propertyean);
        const selloMpn = toStrOrUndef(r.manufacturerno);

        // Base fields (Sello takes precedence when present)
        const incoming = {
          sku,
          productNumber: toStrOrUndef(r.productnumber),
          title: isSello ? (toStrOrUndef(r.standardnamesv) || toStrOrUndef(r.title)) : toStrOrUndef(r.title),
          description: isSello ? (toStrOrUndef(r.standarddescriptionsv) || toStrOrUndef(r.description)) : toStrOrUndef(r.description),
          status: toStrOrUndef(r.status),
          quantity: toIntOrUndef(r.quantity),
          priceAmount: toFloatOrUndef(r.priceamount),
          currency: toStrOrUndef(r.currency),
          vatRate: isSello && selloVat != null ? selloVat : toFloatOrUndef(r.vatrate),
          brand: toStrOrUndef(r.brand),
          mpn: isSello ? (selloMpn || undefined) : toStrOrUndef(r.mpn),
          gtin: isSello ? (selloGtin || undefined) : toStrOrUndef(r.gtin),
        };

        // Basic bounds / normalization (security + sanity)
        if (incoming.title && incoming.title.length > 255) incoming.title = incoming.title.slice(0, 255);
        if (incoming.productNumber && incoming.productNumber.length > 50) incoming.productNumber = incoming.productNumber.slice(0, 50);
        if (incoming.currency) incoming.currency = incoming.currency.toUpperCase();
        if (incoming.quantity !== undefined && incoming.quantity < 0) incoming.quantity = 0;
        if (incoming.priceAmount !== undefined && incoming.priceAmount < 0) incoming.priceAmount = 0;
        if (incoming.vatRate !== undefined && (incoming.vatRate < 0 || incoming.vatRate > 50)) {
          incoming.vatRate = undefined;
        }

        const existing = await this.model.getBySku(req, sku);

        if (mode === 'update-only') {
          if (!existing) {
            result.notFound.push({ row: rowNum, sku });
            result.rows.push({ row: rowNum, sku, action: 'skipped', reason: 'sku_not_found' });
            continue;
          }
          const merged = mergeForUpdate(existing, incoming);
          const saved = await this.model.update(req, existing.id, merged);
          result.updated++;
          result.rows.push({ row: rowNum, sku, action: 'updated', id: saved?.id });
          continue;
        }

        if (mode === 'create-only') {
          if (existing) {
            result.conflicts.push({ row: rowNum, sku, existingId: existing.id });
            result.rows.push({ row: rowNum, sku, action: 'skipped', reason: 'sku_conflict', id: existing.id });
            continue;
          }
          const title = incoming.title;
          if (!title) {
            result.skippedInvalid.push({ row: rowNum, sku, reason: 'missing_title' });
            result.rows.push({ row: rowNum, sku, action: 'skipped', reason: 'missing_title' });
            continue;
          }
          const payload = {
            productNumber: incoming.productNumber,
            sku,
            mpn: incoming.mpn ?? '',
            title,
            description: incoming.description ?? '',
            status: incoming.status ?? 'for sale',
            quantity: incoming.quantity ?? 0,
            priceAmount: incoming.priceAmount ?? 0,
            currency: incoming.currency ?? 'SEK',
            vatRate: incoming.vatRate ?? 25,
            brand: incoming.brand ?? '',
            mpn: incoming.mpn ?? '',
            gtin: incoming.gtin ?? '',
            images: [],
            categories: [],
            mainImage: '',
          };
          const created = await this.model.create(req, payload);

          // Sello-style per-channel overrides (price/active per channel instance)
          if (isSello) {
            const overrides = this.parseSelloOverridesFromRow(r);
            for (const o of overrides) {
              // market default currencies for CDON
              const currency =
                o.channel === 'cdon'
                  ? (o.instance === 'se' ? 'SEK' : o.instance === 'dk' ? 'DKK' : o.instance === 'fi' ? 'EUR' : null)
                  : (incoming.currency ?? null);

              await this.upsertChannelOverride(req, {
                productId: created?.id,
                channel: o.channel,
                instance: o.instance,
                active: o.active,
                priceAmount: o.priceAmount,
                currency,
                vatRate: incoming.vatRate ?? 25,
              });
            }
          }

          result.created++;
          result.rows.push({ row: rowNum, sku, action: 'created', id: created?.id });
          continue;
        }

        // upsert
        if (existing) {
          const merged = mergeForUpdate(existing, incoming);
          const saved = await this.model.update(req, existing.id, merged);

          if (isSello) {
            const overrides = this.parseSelloOverridesFromRow(r);
            for (const o of overrides) {
              const currency =
                o.channel === 'cdon'
                  ? (o.instance === 'se' ? 'SEK' : o.instance === 'dk' ? 'DKK' : o.instance === 'fi' ? 'EUR' : null)
                  : (incoming.currency ?? null);

              await this.upsertChannelOverride(req, {
                productId: saved?.id ?? existing.id,
                channel: o.channel,
                instance: o.instance,
                active: o.active,
                priceAmount: o.priceAmount,
                currency,
                vatRate: incoming.vatRate ?? 25,
              });
            }
          }

          result.updated++;
          result.rows.push({ row: rowNum, sku, action: 'updated', id: saved?.id });
        } else {
          const title = incoming.title;
          if (!title) {
            result.skippedInvalid.push({ row: rowNum, sku, reason: 'missing_title' });
            result.rows.push({ row: rowNum, sku, action: 'skipped', reason: 'missing_title' });
            continue;
          }
          const payload = {
            productNumber: incoming.productNumber,
            sku,
            mpn: incoming.mpn ?? '',
            title,
            description: incoming.description ?? '',
            status: incoming.status ?? 'for sale',
            quantity: incoming.quantity ?? 0,
            priceAmount: incoming.priceAmount ?? 0,
            currency: incoming.currency ?? 'SEK',
            vatRate: incoming.vatRate ?? 25,
            brand: incoming.brand ?? '',
            mpn: incoming.mpn ?? '',
            gtin: incoming.gtin ?? '',
            images: [],
            categories: [],
            mainImage: '',
          };
          const created = await this.model.create(req, payload);

          if (isSello) {
            const overrides = this.parseSelloOverridesFromRow(r);
            for (const o of overrides) {
              const currency =
                o.channel === 'cdon'
                  ? (o.instance === 'se' ? 'SEK' : o.instance === 'dk' ? 'DKK' : o.instance === 'fi' ? 'EUR' : null)
                  : (incoming.currency ?? null);

              await this.upsertChannelOverride(req, {
                productId: created?.id,
                channel: o.channel,
                instance: o.instance,
                active: o.active,
                priceAmount: o.priceAmount,
                currency,
                vatRate: incoming.vatRate ?? 25,
              });
            }
          }

          result.created++;
          result.rows.push({ row: rowNum, sku, action: 'created', id: created?.id });
        }
      }

      return res.json(result);
    } catch (error) {
      Logger.error('Import products error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      return res.status(500).json({ error: 'Failed to import products' });
    }
  }
}

module.exports = ProductController;
