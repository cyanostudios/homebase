#!/usr/bin/env node
// scripts/run-build-channel-map-sello.js
// Bygger channel_product_map från Sello för produkter i Homebase.
// Endast Homebase-produkter (sku = Sello id) processas – inte hela Sello-katalogen.
// PHASE1_PILOT_USER_ID=1 node scripts/run-build-channel-map-sello.js

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
  const model = new ProductModel();
  const req = {
    session: { user: { id: USER_ID }, tenantOwnerUserId: USER_ID },
    tenantPool: undefined,
    body: {},
    query: {},
    params: {},
  };
  ServiceManager.initialize(req);

  const products = await model.getAll(req);
  const selloIds = (Array.isArray(products) ? products : [])
    .map((p) => (p.id != null ? String(p.id).trim() : null))
    .filter(Boolean);
  req.body = { selloProductIds: selloIds };
  console.log(
    `Bygger kanalkarta för ${selloIds.length} produkt(er) i Homebase (Sello id = product.id):`,
    selloIds,
  );

  const controller = new ProductController(model, new SelloModel());
  const res = makeMockRes();
  await controller.buildChannelMapFromSello(req, res);

  const summary = res._json || {};
  if (res._status >= 400) {
    console.error('Bygg kanalkarta misslyckades:', JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  console.log('Bygg kanalkarta klar:', JSON.stringify(summary, null, 2));
  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
