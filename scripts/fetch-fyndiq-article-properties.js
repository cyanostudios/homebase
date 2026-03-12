#!/usr/bin/env node
// Fetch one Fyndiq article to inspect properties (e.g. find "Intern notering" key).
// PHASE1_PILOT_USER_ID=1 node scripts/fetch-fyndiq-article-properties.js [productId]
// If productId omitted, picks first fyndiq-mapped product.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const { Database } = require('@homebase/core');
const FyndiqProductsController = require('../plugins/fyndiq-products/controller');
const FyndiqProductsModel = require('../plugins/fyndiq-products/model');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);

async function run() {
  const ServiceManager = require('../server/core/ServiceManager');
  Bootstrap.initializeServices();
  const req = {
    session: { user: { id: USER_ID }, currentTenantUserId: USER_ID },
    tenantPool: undefined,
  };
  ServiceManager.initialize(req);

  const db = Database.get(req);
  const model = new FyndiqProductsModel();
  const settings = await model.getSettings(req);
  if (!settings || !settings.apiKey || !settings.apiSecret) {
    console.error('Fyndiq not configured for user', USER_ID);
    process.exit(1);
  }

  const productId = process.argv[2];
  let sku;
  if (productId) {
    const row = await db.query(
      `SELECT external_id FROM channel_product_map
       WHERE user_id = $1 AND channel = $2 AND product_id::text = $3 AND external_id IS NOT NULL
       LIMIT 1`,
      [USER_ID, 'fyndiq', productId],
    );
    if (!row.length) {
      console.error('No fyndiq-mapped product with external_id for productId', productId);
      process.exit(1);
    }
    sku = String(row[0].external_id).trim();
  } else {
    let row = await db.query(
      `SELECT product_id, external_id FROM channel_product_map
       WHERE user_id = $1 AND channel = $2 AND external_id IS NOT NULL
       ORDER BY product_id LIMIT 1`,
      [USER_ID, 'fyndiq'],
    );
    if (row.length) {
      sku = String(row[0].external_id).trim();
      console.log('Using product_id:', row[0].product_id, 'external_id (Fyndiq SKU):', sku);
    } else {
      // Fallback: use first product id as Fyndiq SKU (we send product.id as article sku)
      const pRow = await db.query(
        `SELECT id FROM products WHERE user_id = $1 ORDER BY id LIMIT 1`,
        [USER_ID],
      );
      if (!pRow.length) {
        console.error('No products for user', USER_ID);
        process.exit(1);
      }
      sku = String(pRow[0].id);
      console.log('No fyndiq map; trying product id as Fyndiq SKU:', sku);
    }
  }

  const controller = new FyndiqProductsController(model);
  const { resp, json } = await controller.fyndiqRequest(
    `/api/v1/articles/sku/${encodeURIComponent(sku)}`,
    {
      username: settings.apiKey,
      password: settings.apiSecret,
      method: 'GET',
    },
  );

  if (!resp.ok) {
    console.error('Fyndiq API error:', resp.status, json || resp.statusText);
    process.exit(1);
  }

  const article = json?.content?.article || json?.article || json;
  console.log('\n--- Article (full) ---');
  console.log(JSON.stringify(article, null, 2));
  if (Array.isArray(article?.properties) && article.properties.length) {
    console.log('\n--- Properties (look for Intern notering / internal_note) ---');
    article.properties.forEach((p) => {
      console.log(
        `  name="${p.name}" value="${p.value}"${p.language ? ` language=${p.language}` : ''}`,
      );
    });
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
