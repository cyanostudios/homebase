#!/usr/bin/env node
// Debug: hämta Sello-produkt och visa properties (särskilt Color/Red/Röd).
// Kör: PHASE1_PILOT_USER_ID=1 node scripts/debug-sello-color.js 134584082

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const SelloModel = require('../plugins/products/selloModel');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const productId = process.argv[2] || '134584082';

async function run() {
  const ServiceManager = require('../server/core/ServiceManager');
  Bootstrap.initializeServices();
  const req = {
    session: { user: { id: USER_ID }, tenantOwnerUserId: USER_ID },
    tenantPool: undefined,
  };
  ServiceManager.initialize(req);

  const selloModel = new SelloModel();
  const apiKey = await selloModel.getApiKeyForJobs(req);

  let raw = null;
  try {
    raw = await selloModel.fetchSelloJson({
      apiKey,
      path: `/v5/products/${encodeURIComponent(productId)}`,
    });
  } catch (e) {
    console.error('Fetch failed:', e?.message);
    process.exit(1);
  }

  const product = raw?.product || raw;
  console.log('=== Top-level keys ===');
  console.log(Object.keys(product || {}).join(', '));

  const props = product?.properties;
  console.log('\n=== properties (full) ===');
  console.log(JSON.stringify(props, null, 2));

  if (Array.isArray(props)) {
    const colorLike = props.filter(
      (p) =>
        String(JSON.stringify(p)).toLowerCase().includes('red') ||
        String(JSON.stringify(p)).toLowerCase().includes('röd') ||
        String(p?.property ?? '')
          .toLowerCase()
          .includes('color') ||
        String(p?.property ?? '')
          .toLowerCase()
          .includes('färg'),
    );
    console.log('\n=== Properties containing Red/Röd/Color/Färg ===');
    console.log(JSON.stringify(colorLike, null, 2));
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
