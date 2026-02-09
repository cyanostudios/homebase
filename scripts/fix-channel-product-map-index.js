// scripts/fix-channel-product-map-index.js
// Tillämpar 022+030 på public (och tenant) så att ON CONFLICT fungerar.
// Orders använder channel_instance_id – vi byter bara unikt index, inte kolumnanvändning.
// Kör: node scripts/fix-channel-product-map-index.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Client } = require('pg');

async function fixSchema(client, schema) {
  await client.query(`SET search_path TO ${schema}`);

  // 022: säkerställ channel_instance_id
  await client.query(`ALTER TABLE channel_product_map ADD COLUMN IF NOT EXISTS channel_instance_id INT`);

  // 030: byt unikt index så ON CONFLICT (user_id, product_id, channel, channel_instance_id) fungerar
  await client.query(`DROP INDEX IF EXISTS ux_channel_product_map_user_product_channel`);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_product_map_user_product_channel_instance
    ON channel_product_map (user_id, product_id, channel, channel_instance_id) NULLS NOT DISTINCT
  `);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL saknas');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const schemas = ['public'];
  const tenantRows = await client.query(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
    ORDER BY schema_name
  `);
  tenantRows.rows.forEach((r) => schemas.push(r.schema_name));

  for (const schema of schemas) {
    try {
      await client.query(`SELECT 1 FROM ${schema}.channel_product_map LIMIT 1`);
    } catch (e) {
      if (e.code === '42P01') {
        console.log(`⏭️  ${schema} – tabellen finns inte, hoppar över`);
        continue;
      }
      throw e;
    }

    try {
      await fixSchema(client, schema);
      console.log(`✅ ${schema}.channel_product_map – index uppdaterat`);
    } catch (e) {
      console.error(`❌ ${schema}:`, e.message);
    }
  }

  await client.end();
  console.log('\nKlart.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
