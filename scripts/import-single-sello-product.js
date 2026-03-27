#!/usr/bin/env node
// scripts/import-single-sello-product.js
// Importerar en produkt från Sello (utan att rensa befintliga).
// Kör: PHASE1_PILOT_USER_ID=1 node scripts/import-single-sello-product.js 132797129

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ProductModel = require('../plugins/products/model');
const ProductController = require('../plugins/products/controller');
const SelloModel = require('../plugins/products/selloModel');
const { createScriptRequest } = require('./scriptTenantContext');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const productId = process.argv[2] || '132797129';

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
  const { req } = await createScriptRequest(USER_ID, {
    reqExtra: {
      body: { selloProductIds: [String(productId).trim()] },
      query: {},
      params: {},
    },
  });

  const productModel = new ProductModel();
  const selloModel = new SelloModel();
  const controller = new ProductController(productModel, selloModel);

  const res = makeMockRes();
  await controller.importFromSelloApi(req, res);

  const summary = res._json || {};
  if (res._status >= 400) {
    console.error('Import misslyckades:', JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(summary, null, 2));
  const product = summary.rows?.[0];
  if (product) {
    console.log(`\nStatus: ${product.status} (${product.sku})`);
  }
  console.log(`\nImporterat: ${summary.created || 0} skapade, ${summary.updated || 0} uppdaterade`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
