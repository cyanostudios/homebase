#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Bootstrap = require('../server/core/Bootstrap');
Bootstrap.initializeServices();
const ServiceManager = require('../server/core/ServiceManager');
const req = { session: { user: { id: 1 } }, tenantPool: undefined };
ServiceManager.initialize(req);
const { Database } = require('@homebase/core');
const db = Database.get(req);

async function run() {
  const rows = await db.query(`
    SELECT id, channel, instance_key, market, sello_integration_id, enabled
    FROM channel_instances
    WHERE user_id = 1
    ORDER BY channel, instance_key
  `);
  console.log('channel_instances:', JSON.stringify(rows, null, 2));
  process.exit(0);
}
run();
