#!/usr/bin/env node
// scripts/sget.js – Hämta produkter från Sello till Homebase.
// Kör: npm run sget -- 109512000 124732609 124732610 124732611
// Eller: SGET=109512000,124732609 node scripts/sget.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ProductModel = require('../plugins/products/model');
const ProductController = require('../plugins/products/controller');
const SelloModel = require('../plugins/products/selloModel');
const { createScriptRequest } = require('./scriptTenantContext');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);

const idsFromArgs = process.argv.slice(2).flatMap((s) => s.split(/[\s,]+/).filter(Boolean));
const idsFromEnv = (process.env.SGET || '')
  .split(/[\s,]+/)
  .map((s) => s.trim())
  .filter(Boolean);
const selloProductIds = idsFromArgs.length ? idsFromArgs : idsFromEnv;

if (!selloProductIds.length) {
  console.error(
    'Ange Sello-produkt-ID:n:\n  npm run sget -- 109512000 124732609\n  SGET=109512000,124732609 node scripts/sget.js',
  );
  process.exit(1);
}

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
    reqExtra: { body: { selloProductIds }, query: {}, params: {} },
  });

  const controller = new ProductController(new ProductModel(), new SelloModel());
  const res = makeMockRes();
  await controller.importFromSelloApi(req, res);

  const summary = res._json || {};
  if (res._status >= 400) {
    console.error('Import misslyckades:', JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  console.log(`sget: ${selloProductIds.length} produkt(er)\n`);
  const rows = summary.rows || [];
  for (const r of rows) {
    console.log(`  ${r.status}: ${r.sku || r.id} ${r.title ? `– ${r.title.slice(0, 50)}…` : ''}`);
  }
  console.log(`\n${summary.created || 0} skapade, ${summary.updated || 0} uppdaterade`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
