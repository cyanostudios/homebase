const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const ProductModel = require('../plugins/products/model');
const SelloModel = require('../plugins/products/selloModel');
const ProductController = require('../plugins/products/controller');
const CdonProductsModel = require('../plugins/cdon-products/model');
const CdonProductsController = require('../plugins/cdon-products/controller');
const FyndiqProductsModel = require('../plugins/fyndiq-products/model');
const FyndiqProductsController = require('../plugins/fyndiq-products/controller');
const WooModel = require('../plugins/woocommerce-products/model');
const WooController = require('../plugins/woocommerce-products/controller');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const START_OFFSET = Number.isFinite(Number(process.env.PHASE1_PILOT_START_OFFSET))
  ? Math.max(0, Math.trunc(Number(process.env.PHASE1_PILOT_START_OFFSET)))
  : 0;
const MAX_PRODUCTS = Number.isFinite(Number(process.env.PHASE1_PILOT_MAX_PRODUCTS))
  ? Math.max(1, Math.trunc(Number(process.env.PHASE1_PILOT_MAX_PRODUCTS)))
  : 2;
const MAX_PER_OFFSET = Number.isFinite(Number(process.env.PHASE1_PILOT_MAX_PER_OFFSET))
  ? Math.max(1, Math.trunc(Number(process.env.PHASE1_PILOT_MAX_PER_OFFSET)))
  : MAX_PRODUCTS;
const OFFSETS = String(process.env.PHASE1_PILOT_OFFSETS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean)
  .map((x) => Number(x))
  .filter((x) => Number.isFinite(x) && x >= 0)
  .map((x) => Math.trunc(x));
const TENANT_SCHEMA = `tenant_${USER_ID}`;

function makeMockRes(label) {
  return {
    _label: label,
    _status: 200,
    _json: null,
    _sent: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(payload) {
      this._json = payload;
      return this;
    },
    send(payload) {
      this._sent = payload;
      return this;
    },
  };
}

async function buildTenantReq() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing');
  }
  const tenantPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const req = {
    tenantPool,
    session: {
      user: { id: USER_ID },
      currentTenantUserId: USER_ID,
    },
    body: {},
    query: {},
    params: {},
  };
  return req;
}

function mapProductsForExport(rows) {
  return rows.map((r) => ({
    id: String(r.id),
    sku: String(r.sku || ''),
    title: String(r.title || ''),
    quantity: Number(r.quantity) || 0,
    priceAmount: Number(r.price_amount) || 0,
    currency: String(r.currency || 'SEK'),
    vatRate: Number(r.vat_rate) || 25,
  }));
}

async function run() {
  const req = await buildTenantReq();
  try {
    const productController = new ProductController(new ProductModel(), new SelloModel());
    const cdonController = new CdonProductsController(new CdonProductsModel());
    const fyndiqController = new FyndiqProductsController(new FyndiqProductsModel());
    const wooController = new WooController(new WooModel());

    const offsets = OFFSETS.length ? OFFSETS : [START_OFFSET];
    const importRuns = [];
    const mapRuns = [];
    const importedSkuSet = new Set();

    for (const offset of offsets) {
      const remaining = MAX_PRODUCTS - importedSkuSet.size;
      if (remaining <= 0) break;
      const requestCount = Math.min(remaining, MAX_PER_OFFSET);

      const importRes = makeMockRes(`import_${offset}`);
      req.body = { maxProducts: requestCount, maxPages: 1, startOffset: offset };
      await productController.importFromSelloApi(req, importRes);
      importRuns.push({
        offset,
        status: importRes._status,
        body: importRes._json || importRes._sent || null,
      });

      const importRows = Array.isArray(importRes?._json?.rows) ? importRes._json.rows : [];
      for (const row of importRows) {
        if (!row || (row.status !== 'created' && row.status !== 'updated')) continue;
        const sku = String(row.sku || '').trim();
        if (sku) importedSkuSet.add(sku);
      }

      const mapRes = makeMockRes(`map_${offset}`);
      req.body = { maxProducts: requestCount, maxPages: 1, startOffset: offset };
      await productController.buildChannelMapFromSello(req, mapRes);
      mapRuns.push({ offset, status: mapRes._status, body: mapRes._json || mapRes._sent || null });
    }

    const importedSkus = Array.from(importedSkuSet).slice(0, MAX_PRODUCTS);

    const rows = importedSkus.length
      ? await req.tenantPool.query(
          `
          SELECT id, sku, title, quantity, price_amount, currency, vat_rate
          FROM ${TENANT_SCHEMA}.products
          WHERE user_id = $1
            AND sku = ANY($2::text[])
          ORDER BY updated_at DESC NULLS LAST, id DESC
          `,
          [USER_ID, importedSkus],
        )
      : { rows: [] };
    const products = mapProductsForExport(rows.rows || []);

    const wooInstances = await req.tenantPool.query(
      `
      SELECT id::text AS id
      FROM ${TENANT_SCHEMA}.channel_instances
      WHERE user_id = $1 AND channel = 'woocommerce'
      ORDER BY id ASC
      `,
      [USER_ID],
    );
    const instanceIds = (wooInstances.rows || []).map((r) => String(r.id));

    const cdonRes = makeMockRes('cdon');
    req.body = { mode: 'update_only_strict', products };
    await cdonController.exportProducts(req, cdonRes);

    const fyndiqRes = makeMockRes('fyndiq');
    req.body = { mode: 'update_only_strict', products, markets: ['se', 'fi'] };
    await fyndiqController.exportProducts(req, fyndiqRes);

    const wooRes = makeMockRes('woo');
    req.body = { mode: 'update_only_strict', products, instanceIds };
    await wooController.exportProducts(req, wooRes);

    const output = {
      userId: USER_ID,
      startOffset: START_OFFSET,
      offsets,
      maxProducts: MAX_PRODUCTS,
      maxPerOffset: MAX_PER_OFFSET,
      productsPilotCount: products.length,
      importedSkus,
      importRuns,
      mapRuns,
      exports: {
        cdon: { status: cdonRes._status, body: cdonRes._json || cdonRes._sent || null },
        fyndiq: { status: fyndiqRes._status, body: fyndiqRes._json || fyndiqRes._sent || null },
        woo: { status: wooRes._status, body: wooRes._json || wooRes._sent || null },
      },
    };
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await req.tenantPool.end();
  }
}

run().catch((error) => {
  console.error('Phase 1 pilot failed:', error?.message || error);
  process.exit(1);
});
