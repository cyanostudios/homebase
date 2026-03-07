#!/usr/bin/env node
// Debug: vilka integrations har varje produkt i Sello, och matchar de våra channel_instances?
// PHASE1_PILOT_USER_ID=1 node scripts/debug-sello-integrations-per-product.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const ProductModel = require('../plugins/products/model');
const SelloModel = require('../plugins/products/selloModel');
const { Database } = require('@homebase/core');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const SELLO_FYNDIQ_SE = '53270';
const SELLO_FYNDIQ_FI = '64015';
const SELLO_MERCHBUTIKEN = '59961';

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

  const db = Database.get(req);
  const selloModel = new SelloModel();
  const apiKey = await selloModel.getApiKeyForJobs(req);

  const products = await db.query(
    `SELECT id, sku, title FROM products WHERE user_id = $1 ORDER BY id`,
    [USER_ID],
  );

  console.log(`\n=== ${products.length} produkter ===\n`);

  for (const p of products) {
    const sku = String(p.sku || '').trim();
    if (!sku) continue;
    let raw;
    try {
      raw = await selloModel.fetchSelloJson({
        apiKey,
        path: `/v5/products/${encodeURIComponent(sku)}`,
      });
    } catch (e) {
      console.log(`${sku} (${p.title?.slice(0, 30)}): fetch failed`);
      continue;
    }
    const integrations = raw?.integrations && typeof raw.integrations === 'object' ? raw.integrations : {};
    const fyndiqSe = integrations[SELLO_FYNDIQ_SE];
    const fyndiqFi = integrations[SELLO_FYNDIQ_FI];
    const merch = integrations[SELLO_MERCHBUTIKEN];
    const activeFySe = fyndiqSe?.active === true;
    const activeFyFi = fyndiqFi?.active === true;
    const activeMerch = merch?.active === true;
    console.log(
      `SKU ${sku} (id ${p.id}): Fyndiq SE(53270)=${activeFySe}, Fyndiq FI(64015)=${activeFyFi}, Merchbutiken(59961)=${activeMerch}`,
    );
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
