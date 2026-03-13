// scripts/run-quantity-push-test.js
// Minskar lagerantal med 1 på första produkten, triggar push till kanaler, visar API- och kanalrespons.
// Kör: node scripts/run-quantity-push-test.js
// Kräver: DATABASE_URL och TENANT_PROVIDER=local (eller att tenant_1 finns).

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const ProductModel = require('../plugins/products/model');
const ProductController = require('../plugins/products/controller');
const SelloModel = require('../plugins/products/selloModel');
const { Database } = require('@homebase/core');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL saknas');
    process.exit(1);
  }

  Bootstrap.initializeServices();

  const req = {
    session: { user: { id: 1 }, currentTenantUserId: 1 },
    body: {},
  };

  const model = new ProductModel();
  const controller = new ProductController(model, new SelloModel());

  // Hämta produkter
  const products = await model.getAll(req);
  const list = Array.isArray(products) ? products : [];
  if (list.length === 0) {
    console.error('Inga produkter i tenant. Avslutar.');
    await Bootstrap.shutdown();
    process.exit(1);
  }

  const first = list[0];
  const productId = first.id != null ? String(first.id) : first.productId;
  const currentQty = Number(first.quantity) || 0;
  const newQty = 4;
  console.log('Produkt:', {
    id: productId,
    title: (first.title || '').slice(0, 50),
    quantity: currentQty,
    '->': newQty,
  });

  req.body = { ids: [productId], updates: { quantity: newQty } };

  const res = { statusCode: null, body: null };
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (data) {
    this.body = data;
    return this;
  };

  await controller.batchUpdate(req, res);

  console.log('\n--- API-svar (batchUpdate) ---');
  console.log('Status:', res.statusCode);
  console.log('Body:', JSON.stringify(res.body, null, 2));

  const db = Database.get(req);
  const mapRows = await db.query(
    `SELECT channel, channel_instance_id, enabled, external_id, last_sync_status, last_error, product_id
     FROM channel_product_map
     WHERE user_id = $1 AND (product_id::text = $2 OR TRIM(product_id::text) = $2)`,
    [1, productId],
  );
  const overrideRows = await db.query(
    `SELECT o.channel, o.channel_instance_id, o.active, o.product_id
     FROM channel_product_overrides o
     WHERE o.user_id = $1 AND (o.product_id::text = $2 OR TRIM(o.product_id::text) = $2)`,
    [1, productId],
  );
  console.log('\n--- channel_product_map ---');
  if (mapRows.length === 0) {
    console.log(
      '  Inga rader. (Kontrollera product_id-format - kör med product_id som du ser i products)',
    );
  } else {
    mapRows.forEach((r) => {
      console.log(
        `  ${r.channel} (inst=${r.channel_instance_id}): enabled=${r.enabled} external_id=${r.external_id || '—'} status=${r.last_sync_status || '—'} product_id="${r.product_id}"`,
      );
    });
  }
  console.log('\n--- channel_product_overrides ---');
  if (overrideRows.length === 0) {
    console.log('  Inga rader.');
  } else {
    overrideRows.forEach((r) => {
      console.log(
        `  ${r.channel} (inst=${r.channel_instance_id}): active=${r.active} product_id="${r.product_id}"`,
      );
    });
  }

  await Bootstrap.shutdown();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
