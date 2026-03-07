#!/usr/bin/env node
// scripts/run-build-channel-map-sello.js
// Kör Bygg kanalkarta från Sello för alla produkter.
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
  const req = {
    session: { user: { id: USER_ID }, currentTenantUserId: USER_ID },
    tenantPool: undefined,
    body: { maxProducts: 5000, maxPages: 100 },
    query: {},
    params: {},
  };
  ServiceManager.initialize(req);

  const controller = new ProductController(new ProductModel(), new SelloModel());
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
