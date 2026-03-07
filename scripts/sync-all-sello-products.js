#!/usr/bin/env node
// scripts/sync-all-sello-products.js
// Synkar alla befintliga produkter från Sello (uppdaterar, skapar inte nya).
// Kör: PHASE1_PILOT_USER_ID=1 node scripts/sync-all-sello-products.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const ProductModel = require('../plugins/products/model');
const ProductController = require('../plugins/products/controller');
const SelloModel = require('../plugins/products/selloModel');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);

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

async function run() {
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

  const productModel = new ProductModel();
  const selloModel = new SelloModel();
  const controller = new ProductController(productModel, selloModel);

  const allProducts = await productModel.getAll(req);
  const selloIds = allProducts.map((p) => String(p.sku ?? p.id ?? '')).filter(Boolean);

  if (!selloIds.length) {
    console.log('Inga produkter att synka.');
    process.exit(0);
  }

  console.log(`Synkar ${selloIds.length} produkter från Sello...`);

  req.body = { selloProductIds: selloIds };
  const res = makeMockRes();
  await controller.importFromSelloApi(req, res);

  const summary = res._json || {};
  if (res._status >= 400) {
    console.error('Import misslyckades:', JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  console.log(
    `\nKlar: ${summary.created || 0} skapade, ${summary.updated || 0} uppdaterade, ${summary.skipped_invalid || 0} hoppade över`,
  );
  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
