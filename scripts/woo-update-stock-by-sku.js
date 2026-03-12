#!/usr/bin/env node
// scripts/woo-update-stock-by-sku.js
// Ökar lager med 1 på WooCommerce-varianter utan att använda sparade Woo-ID:n.
// Lookup by SKU (V+productId), sedan PUT variation med stock_quantity = nuvarande + 1.
// Kör: PHASE1_PILOT_USER_ID=1 node scripts/woo-update-stock-by-sku.js
// Eller: node scripts/woo-update-stock-by-sku.js 124732563 124732564 124732565

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const WooCommerceModel = require('../plugins/woocommerce-products/model');
const WooCommerceController = require('../plugins/woocommerce-products/controller');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const DEFAULT_IDS = ['124732563', '124732564', '124732565'];
const ids =
  process.argv.slice(2).filter(Boolean).length > 0
    ? process.argv.slice(2).filter(Boolean).map(String)
    : DEFAULT_IDS;

async function run() {
  const ServiceManager = require('../server/core/ServiceManager');
  Bootstrap.initializeServices();
  const req = {
    session: { user: { id: USER_ID }, currentTenantUserId: USER_ID },
    tenantPool: undefined,
  };
  ServiceManager.initialize(req);

  const wooModel = new WooCommerceModel();
  const wooController = new WooCommerceController(wooModel);
  const instances = await wooModel.listInstances(req);
  const mobilhallen =
    instances.find((i) => /mobilhallen/i.test(String(i.label || ''))) || instances[0];

  const creds = mobilhallen.credentials;
  const storeUrl = creds?.storeUrl ?? creds?.store_url;
  if (!storeUrl) {
    console.error('Ingen WooCommerce-instans (Mobilhallen) med storeUrl.');
    process.exit(1);
  }

  const base = wooController.normalizeBaseUrl(storeUrl);
  const settings = {
    storeUrl,
    consumerKey: creds?.consumerKey ?? creds?.consumer_key ?? '',
    consumerSecret: creds?.consumerSecret ?? creds?.consumer_secret ?? '',
    useQueryAuth: creds?.useQueryAuth ?? false,
  };

  const results = [];
  for (const productId of ids) {
    const sku = `V${productId}`;
    const existing = await wooController.findWooProductBySku(base, sku, settings);
    if (!existing?.id) {
      const url = `${base}/wp-json/wc/v3/products?sku=${encodeURIComponent(sku)}`;
      const debugResp = await wooController.fetchWithWooAuth(url, { method: 'GET' }, settings);
      const debugBody = await debugResp.text().catch(() => '');
      const isServerError = debugResp.status >= 500;
      results.push({
        productId,
        sku,
        status: isServerError ? 'store_error' : 'not_found',
        error: isServerError
          ? `Butiken svarade ${debugResp.status} (t.ex. Database Error – försök igen eller kontrollera WooCommerce/WordPress)`
          : 'Produkt hittades inte',
        ...(isServerError ? { httpStatus: debugResp.status } : {}),
      });
      continue;
    }
    const parentId = existing.parent_id != null ? Number(existing.parent_id) : null;
    const variationId = Number(existing.id);
    const currentStock =
      existing.stock_quantity != null && Number.isFinite(Number(existing.stock_quantity))
        ? Math.max(0, Math.floor(Number(existing.stock_quantity)))
        : 0;
    const newStock = currentStock + 1;

    if (parentId == null || !Number.isFinite(parentId)) {
      results.push({
        productId,
        sku,
        status: 'skip',
        error: 'Inte en variation (saknar parent_id)',
      });
      continue;
    }

    const url = `${base}/wp-json/wc/v3/products/${parentId}/variations/${variationId}`;
    const resp = await wooController.fetchWithWooAuth(
      url,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_quantity: newStock }),
      },
      settings,
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      results.push({
        productId,
        sku,
        status: 'error',
        wooVariationId: variationId,
        wooParentId: parentId,
        error: `HTTP ${resp.status}: ${(text || '').slice(0, 200)}`,
      });
      continue;
    }

    results.push({
      productId,
      sku,
      status: 'updated',
      wooVariationId: variationId,
      wooParentId: parentId,
      previousStock: currentStock,
      newStock,
    });
  }

  console.log(JSON.stringify({ instance: mobilhallen.label, results }, null, 2));
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
