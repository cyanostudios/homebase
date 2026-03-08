#!/usr/bin/env node
// Debug: vilka integrations har varje produkt i Sello, och matchar de våra channel_instances?
// Hämtar alla mappade sello_integration_id från channel_instances.
// PHASE1_PILOT_USER_ID=1 node scripts/debug-sello-integrations-per-product.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const SelloModel = require('../plugins/products/selloModel');
const { Database } = require('@homebase/core');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);

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

  const mappedInstances = await db.query(
    `SELECT id, channel, instance_key, label, sello_integration_id
     FROM channel_instances
     WHERE user_id = $1 AND sello_integration_id IS NOT NULL AND TRIM(sello_integration_id) <> ''
     ORDER BY channel ASC, instance_key ASC`,
    [USER_ID],
  );

  const integrationList = (mappedInstances || []).map((r) => ({
    id: String(r.sello_integration_id || '').trim(),
    label: `${r.channel}/${r.instance_key}`,
  }));

  console.log(`\n=== ${integrationList.length} mappade integrationer ===`);
  integrationList.forEach((i) => console.log(`  ${i.id}: ${i.label}`));

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
    const integrations =
      raw?.integrations && typeof raw.integrations === 'object' ? raw.integrations : {};
    const parts = integrationList.map((i) => {
      const state = integrations[i.id];
      const active = state?.active === true;
      return `${i.label}(${i.id})=${active}`;
    });
    console.log(`SKU ${sku} (id ${p.id}): ${parts.join(', ')}`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
