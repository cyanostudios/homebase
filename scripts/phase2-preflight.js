#!/usr/bin/env node
// scripts/phase2-preflight.js
// Phase 2 preflight gate: kör CDON och Fyndiq export med dryRun=true.
// Stop/Go: endast expected_skip tillåtna; inga contract_validation_failed.
// Kör: PHASE1_PILOT_USER_ID=1 node scripts/phase2-preflight.js
//      PHASE2_PREFLIGHT_LIMIT=20 node scripts/phase2-preflight.js  (default 20)

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const ProductModel = require('../plugins/products/model');
const CdonProductsController = require('../plugins/cdon-products/controller');
const CdonProductsModel = require('../plugins/cdon-products/model');
const FyndiqProductsController = require('../plugins/fyndiq-products/controller');
const FyndiqProductsModel = require('../plugins/fyndiq-products/model');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const LIMIT = Number.isFinite(Number(process.env.PHASE2_PREFLIGHT_LIMIT))
  ? Math.max(1, Math.min(100, Math.trunc(Number(process.env.PHASE2_PREFLIGHT_LIMIT))))
  : 20;
const MARKETS = (process.env.PHASE2_PREFLIGHT_MARKETS || 'se,fi')
  .split(',')
  .map((m) => m.trim().toLowerCase())
  .filter((m) => ['se', 'dk', 'fi', 'no'].includes(m));
const MARKETS_FILTER = MARKETS.length ? MARKETS : ['se', 'fi'];

function makeMockRes() {
  return {
    _status: 200,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(payload) {
      this._json = payload;
      return this;
    },
  };
}

async function buildReq() {
  const ServiceManager = require('../server/core/ServiceManager');
  Bootstrap.initializeServices();
  const req = {
    session: { user: { id: USER_ID }, currentTenantUserId: USER_ID },
    tenantPool: undefined,
    body: {},
    query: {},
    params: {},
  };
  ServiceManager.initialize(req);
  return req;
}

async function run() {
  const req = await buildReq();
  const productModel = new ProductModel();
  const cdonController = new CdonProductsController(new CdonProductsModel());
  const fyndiqController = new FyndiqProductsController(new FyndiqProductsModel());

  const allProducts = await productModel.getAll(req);
  const products = allProducts.slice(0, LIMIT);

  if (!products.length) {
    console.log(JSON.stringify({ ok: false, error: 'No products in DB', userId: USER_ID }, null, 2));
    process.exit(1);
  }

  const productsForExport = products.map((p) => ({
    id: String(p.id),
    sku: p.sku,
    mpn: p.mpn,
    title: p.title,
    description: p.description,
    status: p.status,
    quantity: p.quantity,
    priceAmount: p.priceAmount,
    currency: p.currency,
    vatRate: p.vatRate,
    mainImage: p.mainImage,
    images: p.images || [],
    categories: p.categories || [],
    brand: p.brand,
    gtin: p.gtin,
    channelSpecific: p.channelSpecific,
  }));

  req.body = {
    products: productsForExport,
    markets: MARKETS_FILTER,
    dryRun: true,
  };

  const cdonRes = makeMockRes();
  await cdonController.exportProducts(req, cdonRes);

  const fyndiqRes = makeMockRes();
  await fyndiqController.exportProducts(req, fyndiqRes);

  const cdonBody = cdonRes._json || {};
  const fyndiqBody = fyndiqRes._json || {};

  const cdonCounts = cdonBody.counts || {};
  const fyndiqCounts = fyndiqBody.counts || {};
  const cdonItems = cdonBody.items || [];
  const fyndiqItems = fyndiqBody.items || [];

  const validationErrors = [
    ...cdonItems.filter((i) => i.status === 'error').map((i) => ({ channel: 'cdon', ...i })),
    ...fyndiqItems.filter((i) => i.status === 'error').map((i) => ({ channel: 'fyndiq', ...i })),
  ];
  const hasValidationError = validationErrors.length > 0;
  const go = !hasValidationError;

  const report = {
    ok: go,
    gate: go ? 'GO' : 'STOP',
    reason: hasValidationError
      ? `contract_validation_failed or mapper_rejected: ${validationErrors.length} item(s)`
      : 'No validation errors',
    userId: USER_ID,
    limit: LIMIT,
    markets: MARKETS_FILTER,
    requested: products.length,
    cdon: {
      status: cdonRes._status,
      counts: cdonCounts,
      ready: cdonCounts.ready || 0,
      validation_error: cdonCounts.validation_error || 0,
      expected_skip: cdonCounts.expected_skip || 0,
    },
    fyndiq: {
      status: fyndiqRes._status,
      counts: fyndiqCounts,
      ready: fyndiqCounts.ready || 0,
      validation_error: fyndiqCounts.validation_error || 0,
      expected_skip: fyndiqCounts.expected_skip || 0,
    },
    validationErrors: validationErrors.slice(0, 20),
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(go ? 0 : 1);
}

run().catch((err) => {
  console.error('Phase 2 preflight failed:', err?.message || err);
  process.exit(1);
});
