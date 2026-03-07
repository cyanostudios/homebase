#!/usr/bin/env node
// Debug: vilka overrides finns för en produkt?
// PHASE1_PILOT_USER_ID=1 node scripts/debug-overrides-for-product.js [productId]

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
    SELECT o.id, o.product_id, o.channel, o.instance, o.channel_instance_id, o.active, ci.instance_key, ci.market
    FROM channel_product_overrides o
    LEFT JOIN channel_instances ci ON ci.id = o.channel_instance_id
    WHERE o.user_id = $1 AND o.product_id::text = $2
    ORDER BY o.channel, o.instance
    `,
    [USER_ID, PRODUCT_ID],
  );

  console.log(`Overrides för produkt ${PRODUCT_ID}:`);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});
