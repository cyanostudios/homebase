#!/usr/bin/env node
// Debug: visa brand och color från Sello API för angivna produkter.
// Kör: node scripts/debug-sello-brand-and-color.js 132797129 134584082 134584083 134584133

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const SelloModel = require('../plugins/products/selloModel');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const productIds = process.argv.slice(2).filter(Boolean) || ['134584082', '134584133'];

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

  for (const pid of productIds) {
    let raw = null;
    try {
      raw = await selloModel.fetchSelloJson({
        apiKey,
        path: `/v5/products/${encodeURIComponent(pid)}`,
      });
    } catch (e) {
      console.error(`\n=== ${pid} fetch failed:`, e?.message);
      continue;
    }
    const productData = raw?.product ?? raw;
    const brandId = raw?.brand_id ?? productData?.brand_id;
    const brandName = raw?.brand_name ?? productData?.brand_name;
    console.log(`\n=== ${pid} (single product) ===`);
    console.log('raw has product?', !!raw?.product);
    console.log('brand_id (raw):', raw?.brand_id, '| brand_id (product):', productData?.brand_id);
    console.log('brand_name (raw):', raw?.brand_name, '| brand_name (product):', productData?.brand_name);
    console.log('Resolved brand_id:', brandId, '| brand_name:', brandName);

    const props = productData?.properties ?? raw?.properties ?? [];
    const colorProps = Array.isArray(props)
      ? props.filter(
          (p) =>
            String(p?.property ?? '')
              .toLowerCase()
              .match(/color|färg|colortext|färgtext/),
        )
      : [];
    console.log('Color-related properties:', colorProps.length);
    colorProps.forEach((p) => {
      console.log('  -', p.property, ':', JSON.stringify(p.value));
    });
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
