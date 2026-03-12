#!/usr/bin/env node
// scripts/fetch-sello-products-inspect.js
// Hämtar Sello-produkter för inspektion (group_id, groups, properties).
// Kör: PHASE1_PILOT_USER_ID=1 node scripts/fetch-sello-products-inspect.js 49558203 49558213 49558216

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const SelloModel = require('../plugins/products/selloModel');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const ids = process.argv.slice(2).filter(Boolean).map(String);
if (!ids.length) {
  console.error('Ange minst ett Sello produkt-ID');
  process.exit(1);
}

async function run() {
  const ServiceManager = require('../server/core/ServiceManager');
  Bootstrap.initializeServices();
  const req = {
    session: { user: { id: USER_ID }, currentTenantUserId: USER_ID },
    tenantPool: undefined,
  };
  ServiceManager.initialize(req);

  const selloModel = new SelloModel();
  const apiKey = await selloModel.getApiKeyForJobs(req);
  if (!apiKey) {
    console.error('Ingen Sello API-nyckel. Konfigurera sello_settings först.');
    process.exit(1);
  }

  // Lista med filter för att få groups-array
  const listPath = `/v5/products?size=100&${ids.map((id) => `filter[id][]=${encodeURIComponent(id)}`).join('&')}`;
  const listRes = await selloModel.fetchSelloJson({
    apiKey,
    path: listPath,
  });

  const productsList = Array.isArray(listRes?.products) ? listRes.products : [];
  const groups = Array.isArray(listRes?.groups) ? listRes.groups : [];

  const fullProducts = [];
  for (const p of productsList) {
    const full = await selloModel.fetchSelloJson({
      apiKey,
      path: `/v5/products/${encodeURIComponent(p.id)}`,
    });
    fullProducts.push(full);
  }

  const output = {
    listResponse: { products: productsList.length, groups },
    groups,
    productsFromList: productsList.map((p) => ({
      id: p.id,
      group_id: p.group_id,
      private_reference: p.private_reference,
      private_name: p.private_name,
    })),
    fullProducts: fullProducts.map((p) => ({
      id: p.id,
      group_id: p.group_id,
      private_reference: p.private_reference,
      private_name: p.private_name,
      properties: p.properties,
      texts: p.texts ? { default: p.texts.default } : null,
      categories: p.categories,
      prices: p.prices,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
