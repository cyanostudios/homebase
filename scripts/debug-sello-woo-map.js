#!/usr/bin/env node
// scripts/debug-sello-woo-map.js
// Diagnostik: varför fylls inte channel_product_map för WooCommerce vid Sello-import?
// Kör: node scripts/debug-sello-woo-map.js 51786284

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const SelloModel = require('../plugins/products/selloModel');
const { Database } = require('@homebase/core');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const productId = process.argv[2] || '51786284';

async function run() {
  const ServiceManager = require('../server/core/ServiceManager');
  Bootstrap.initializeServices();
  const req = {
    session: { user: { id: USER_ID }, currentTenantUserId: USER_ID },
    tenantPool: undefined,
  };
  ServiceManager.initialize(req);

  const db = Database.get(req);

  // 1) Channel instances med sello_integration_id
  const instances = await db.query(
    `SELECT id, channel, instance_key, sello_integration_id
     FROM channel_instances
     WHERE user_id = $1
     ORDER BY channel, id`,
    [USER_ID],
  );
  console.log('=== channel_instances (user_id=' + USER_ID + ') ===');
  instances.forEach((r) => {
    console.log(
      `  id=${r.id} channel=${r.channel} instance_key=${r.instance_key} sello_integration_id=${r.sello_integration_id ?? 'NULL'}`,
    );
  });

  const wooInstances = instances.filter(
    (r) => String(r.channel || '').toLowerCase() === 'woocommerce',
  );
  const wooIntegrationIds = [
    ...new Set(
      wooInstances.map((r) => String(r.sello_integration_id || '').trim()).filter(Boolean),
    ),
  ];
  console.log('\nWooCommerce instance integration IDs from DB:', wooIntegrationIds);

  // 2) Hämta produkten från Sello (samma anrop som importen)
  const selloModel = new SelloModel();
  let apiKey;
  try {
    apiKey = await selloModel.getApiKeyForJobs(req);
  } catch (e) {
    console.error('Sello API key saknas:', e?.message);
    process.exit(1);
  }

  let raw;
  try {
    raw = await selloModel.fetchSelloJson({
      apiKey,
      path: `/v5/products/${encodeURIComponent(productId)}`,
    });
  } catch (e) {
    console.error('Sello fetch misslyckades:', e?.message);
    process.exit(1);
  }

  console.log('\n=== Sello GET /v5/products/' + productId + ' ===');
  console.log(
    'Top-level keys:',
    raw && typeof raw === 'object' ? Object.keys(raw).sort().join(', ') : 'N/A',
  );

  // Om API:et returnerar { product: { ... } } har importen använt fel nivå
  const productLevel = raw?.product && typeof raw.product === 'object' ? raw.product : raw;
  const integrationsSource = raw?.integrations ?? productLevel?.integrations;
  const integrations =
    integrationsSource && typeof integrationsSource === 'object' ? integrationsSource : {};

  console.log('raw.integrations finns:', !!raw?.integrations);
  console.log('raw.product.integrations finns:', !!(raw?.product && raw.product.integrations));
  console.log('Antal integrationer i payload:', Object.keys(integrations).length);

  console.log('\n--- integrations: item_id, active, wouldWriteMap (samma logik som import) ---');
  for (const [intId, state] of Object.entries(integrations)) {
    const obj = state && typeof state === 'object' ? state : {};
    const externalId = String(obj?.item_id ?? '').trim();
    const wouldWriteMap = !!externalId; // if (externalId) upsertChannelProductMap
    const isWoo = wooIntegrationIds.includes(String(intId).trim());
    console.log(
      `  ${intId}: active=${obj.active} item_id=${obj?.item_id} (typ=${typeof obj?.item_id}) → externalId="${externalId}" wouldWriteMap=${wouldWriteMap} ${isWoo ? '<-- WOO' : ''}`,
    );
  }

  await Bootstrap.shutdown();
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
