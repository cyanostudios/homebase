// scripts/check-channel-map.js
// Kontrollerar channel_product_map för en produkt. Kör: node scripts/check-channel-map.js 51786284

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const { Database } = require('@homebase/core');

const productId = process.argv[2] || '51786284';
const userId = 1;

async function main() {
  Bootstrap.initializeServices();
  const req = { session: { user: { id: userId } } };
  const db = Database.get(req);

  const mapRows = await db.query(
    `SELECT channel, channel_instance_id, enabled, external_id, last_sync_status, last_error
     FROM channel_product_map
     WHERE user_id = $1 AND product_id::text = $2`,
    [userId, String(productId).trim()],
  );
  const overrideRows = await db.query(
    `SELECT o.channel, o.channel_instance_id, o.active
     FROM channel_product_overrides o
     WHERE o.user_id = $1 AND o.product_id::text = $2`,
    [userId, String(productId).trim()],
  );

  console.log('channel_product_map för produkt', productId, ':');
  if (mapRows.length === 0) {
    console.log(
      '  Inga rader. Produkten har ingen kanalmappning – lager pushas inte till någon kanal.',
    );
    console.log('  Kör buildChannelMapFromSello eller exportera produkten till kanalerna först.');
  } else {
    mapRows.forEach((r) => {
      console.log(
        `  ${r.channel} (inst=${r.channel_instance_id}): enabled=${r.enabled} external_id=${r.external_id || '—'} status=${r.last_sync_status || '—'}`,
      );
    });
  }
  console.log('\nchannel_product_overrides:');
  if (overrideRows.length === 0) console.log('  Inga rader.');
  else
    overrideRows.forEach((r) =>
      console.log(`  ${r.channel} (inst=${r.channel_instance_id}): active=${r.active}`),
    );

  await Bootstrap.shutdown();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
