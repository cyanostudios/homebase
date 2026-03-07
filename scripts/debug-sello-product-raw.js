#!/usr/bin/env node
// scripts/debug-sello-product-raw.js
// Debug: visa rå Sello API-svar för manufacturer och integrations.
// Kör: PHASE1_PILOT_USER_ID=1 node scripts/debug-sello-product-raw.js 132797129

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const SelloModel = require('../plugins/products/selloModel');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const productId = process.argv[2] || '132797129';

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

  // List fetch (filter[id][]=X)
  let listRaw = null;
  try {
    const filterQuery = `filter[id][]=${encodeURIComponent(productId)}`;
    listRaw = await selloModel.fetchSelloJson({
      apiKey,
      path: `/v5/products?${filterQuery}`,
    });
  } catch (e) {
    console.error('List fetch failed:', e?.message);
  }

  const listProducts = Array.isArray(listRaw?.products)
    ? listRaw.products
    : Array.isArray(listRaw?.data?.products)
      ? listRaw.data.products
      : [];
  const fromList = listProducts.find((p) => String(p?.id ?? '') === String(productId));

  console.log('=== LIST response (filter[id]) ===');
  console.log('products count:', listProducts.length);
  if (fromList) {
    console.log('manufacturer:', fromList.manufacturer);
    console.log('manufacturer_id:', fromList.manufacturer_id);
    console.log('integrations keys:', fromList.integrations ? Object.keys(fromList.integrations) : 'N/A');
    if (fromList.integrations) {
      const sample = {};
      for (const [k, v] of Object.entries(fromList.integrations)) {
        sample[k] = typeof v === 'object' ? v : v;
        if (Object.keys(sample).length >= 3) break;
      }
      console.log('integrations sample:', JSON.stringify(sample, null, 2));
    }
  } else {
    console.log('Product not found in list');
  }

  // Single product fetch
  let singleRaw = null;
  try {
    singleRaw = await selloModel.fetchSelloJson({
      apiKey,
      path: `/v5/products/${encodeURIComponent(productId)}`,
    });
  } catch (e) {
    console.error('Single fetch failed:', e?.message);
  }

  // Search for Wrebbit in full payload
  const fullRaw = singleRaw || fromList || {};
  const jsonStr = JSON.stringify(fullRaw);
  const wrebbitIdx = jsonStr.toLowerCase().indexOf('wrebbit');
  if (wrebbitIdx >= 0) {
    const start = Math.max(0, wrebbitIdx - 200);
    const end = Math.min(jsonStr.length, wrebbitIdx + 200);
    console.log('\n=== Wrebbit context ===');
    console.log(jsonStr.substring(start, end));
  }
  if (fullRaw.properties && Array.isArray(fullRaw.properties)) {
    const mfr = fullRaw.properties.find((p) =>
      String(JSON.stringify(p)).toLowerCase().includes('wrebbit')
    );
    if (mfr) console.log('\nProperty containing Wrebbit:', JSON.stringify(mfr, null, 2));
  }

  console.log('\n=== SINGLE product response (GET /v5/products/{id}) ===');
  if (singleRaw) {
    const topKeys = Object.keys(singleRaw).filter((k) =>
      ['manufacturer', 'manufacturer_id', 'integrations', 'product', 'id'].includes(k),
    );
    console.log('Top-level keys (relevant):', topKeys);
    console.log('manufacturer:', singleRaw.manufacturer);
    console.log('manufacturer_id:', singleRaw.manufacturer_id);
    if (singleRaw.product && typeof singleRaw.product === 'object') {
      console.log('product.manufacturer:', singleRaw.product.manufacturer);
      console.log('product.manufacturer_id:', singleRaw.product.manufacturer_id);
      console.log('product.integrations keys:', singleRaw.product.integrations
        ? Object.keys(singleRaw.product.integrations) : 'N/A');
    }
    console.log('integrations keys:', singleRaw.integrations ? Object.keys(singleRaw.integrations) : 'N/A');
    if (singleRaw.integrations) {
      const sample = {};
      for (const [k, v] of Object.entries(singleRaw.integrations)) {
        sample[k] = typeof v === 'object' ? v : v;
        if (Object.keys(sample).length >= 3) break;
      }
      console.log('integrations sample:', JSON.stringify(sample, null, 2));
    }
  } else {
    console.log('No single response');
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
