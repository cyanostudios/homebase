#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Bootstrap = require('../server/core/Bootstrap');
const { Database } = require('@homebase/core');

async function run() {
  Bootstrap.initializeServices();
  const ServiceManager = require('../server/core/ServiceManager');
  const req = { session: { user: { id: 1 } }, tenantPool: undefined };
  ServiceManager.initialize(req);
  const db = Database.get(req);

  const overrides = await db.query(`
    SELECT o.product_id, o.channel, o.instance, o.active, ci.label, ci.sello_integration_id
    FROM channel_product_overrides o
    LEFT JOIN channel_instances ci ON ci.id = o.channel_instance_id
    WHERE o.product_id::text = '107' AND o.user_id = 1
    ORDER BY o.channel, o.instance
  `);
  console.log('=== Overrides for product 107 (80073580) ===');
  console.log(JSON.stringify(overrides, null, 2));

  const instances = await db.query(`
    SELECT id, channel, instance_key, market, label, sello_integration_id
    FROM channel_instances
    WHERE user_id = 1 AND sello_integration_id IS NOT NULL AND TRIM(sello_integration_id) <> ''
    ORDER BY channel, instance_key
  `);
  console.log('\n=== All channel_instances with sello_integration_id ===');
  console.log(JSON.stringify(instances, null, 2));
  process.exit(0);
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
