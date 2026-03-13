const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Bootstrap = require('../server/core/Bootstrap');
const { Database } = require('@homebase/core');
const ProductModel = require('../plugins/products/model');
const ProductController = require('../plugins/products/controller');
const SelloModel = require('../plugins/products/selloModel');

async function run() {
  Bootstrap.initializeServices();
  const req = {
    session: { user: { id: 1 }, currentTenantUserId: 1 },
    body: { ids: ['109512000'], updates: { quantity: 2 } },
  };
  const controller = new ProductController(new ProductModel(), new SelloModel());
  const res = {
    statusCode: null,
    status: (c) => ((res.statusCode = c), res),
    json: (d) => (res.body = d),
  };
  await controller.batchUpdate(req, res);
  console.log('Batch update status:', res.statusCode);
  console.log('Batch update body:', JSON.stringify(res.body));

  const db = Database.get(req);
  const rows = await db.query(
    'SELECT channel, channel_instance_id, last_sync_status, last_error FROM channel_product_map WHERE user_id = $1 AND product_id::text = $2',
    [1, '109512000'],
  );
  console.log('channel_product_map efter push:', rows);

  await Bootstrap.shutdown();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
