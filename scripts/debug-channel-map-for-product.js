#!/usr/bin/env node
// Debug: channel_product_map för en produkt
// PHASE1_PILOT_USER_ID=1 node scripts/debug-channel-map-for-product.js [productId]

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const { Database } = require('@homebase/core');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const PRODUCT_ID = process.argv[2] || '100';

async function run() {
  const ServiceManager = require('../server/core/ServiceManager');
  Bootstrap.initializeServices();
  const req = {
    session: { user: { id: USER_ID }, currentTenantUserId: USER_ID },
    tenantPool: undefined,
  };
  ServiceManager.initialize(req);

  const db = Database.get(req);
  const rows = await db.query(
    `
    SELECT m.id, m.product_id, m.channel, m.channel_instance_id, m.enabled, ci.instance_key, ci.market
    FROM channel_product_map m
    LEFT JOIN channel_instances ci ON ci.id = m.channel_instance_id
    WHERE m.user_id = $1 AND m.product_id::text = $2
    ORDER BY m.channel, ci.instance_key
    `,
    [USER_ID, PRODUCT_ID],
  );

  console.log(`channel_product_map för produkt ${PRODUCT_ID} (används av Kanaler-kryssrutan):`);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
