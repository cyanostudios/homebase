#!/usr/bin/env node
// Debug: fetch one product from Sello and print response structure (keys + images).
// Run: node scripts/sello-fetch-one.js 109512000
// Requires: .env.local with DB, and sello_settings with api_key for user 1.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const SelloModel = require('../plugins/products/selloModel');

const productId = process.argv[2] || '109512000';

async function run() {
  Bootstrap.initializeServices();
  const ServiceManager = require('../server/core/ServiceManager');
  const req = {
    session: { user: { id: 1 }, currentTenantUserId: 1 },
    tenantPool: undefined,
  };
  ServiceManager.initialize(req);
  const selloModel = new SelloModel();
  const apiKey = await selloModel.getApiKeyForJobs(req);
  const raw = await selloModel.fetchSelloJson({
    apiKey,
    path: `/v5/products/${encodeURIComponent(productId)}`,
  });
  console.log('Top-level keys:', raw ? Object.keys(raw) : []);
  console.log('raw.images type:', Array.isArray(raw?.images) ? 'array' : typeof raw?.images);
  if (raw?.images) {
    console.log('raw.images length:', raw.images.length);
    if (raw.images[0]) console.log('raw.images[0]:', JSON.stringify(raw.images[0], null, 2));
  }
  if (raw?.product != null) {
    console.log('raw.product exists. raw.product.images type:', Array.isArray(raw.product?.images) ? 'array' : typeof raw.product?.images);
    if (raw.product?.images?.[0]) console.log('raw.product.images[0]:', JSON.stringify(raw.product.images[0], null, 2));
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
