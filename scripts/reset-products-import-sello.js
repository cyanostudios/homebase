#!/usr/bin/env node
// scripts/reset-products-import-sello.js
// Rensar alla produkter i Homebase och importerar angivna produkter från Sello.
// Kör: node scripts/reset-products-import-sello.js 134584082 134584083 ...
//      SELLO_PRODUCT_IDS="134584082,134584083" node scripts/reset-products-import-sello.js
//      PHASE1_PILOT_USER_ID=1 node scripts/reset-products-import-sello.js 134584082 134584083

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const ProductModel = require('../plugins/products/model');
const ProductController = require('../plugins/products/controller');
const SelloModel = require('../plugins/products/selloModel');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);

const SELLO_IDS =
  process.env.SELLO_PRODUCT_IDS
    ? process.env.SELLO_PRODUCT_IDS.split(',')
        .map((x) => String(x).trim())
        .filter(Boolean)
    : process.argv.slice(2).map((x) => String(x).trim()).filter(Boolean);

const DEFAULT_IDS = [
  '134584082',
  '134584083',
  '134584084',
  '134584087',
  '134584130',
  '134584133',
];

const selloIds = SELLO_IDS.length ? SELLO_IDS : DEFAULT_IDS;

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
  if (!selloIds.length) {
    console.error('Ange Sello-produkt-ID:n som argument eller SELLO_PRODUCT_IDS');
    process.exit(1);
  }

  const req = await buildReq();
  const productModel = new ProductModel();
  const selloModel = new SelloModel();
  const controller = new ProductController(productModel, selloModel);

  const allProducts = await productModel.getAll(req);
  const ids = allProducts.map((p) => String(p.id));

  if (ids.length > 0) {
    const { deletedCount } = await productModel.bulkDelete(req, ids);
    console.log(`Rensat: ${deletedCount} produkter borttagna`);
  } else {
    console.log('Inga produkter att rensa');
  }

  req.body = { selloProductIds: selloIds };
  const res = makeMockRes();
  await controller.importFromSelloApi(req, res);

  const summary = res._json || {};
  if (res._status >= 400) {
    console.error('Import misslyckades:', JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(summary, null, 2));
  console.log(
    `\nImporterat: ${summary.created || 0} skapade, ${summary.updated || 0} uppdaterade, ${summary.skipped_invalid || 0} hoppade över`,
  );
  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
