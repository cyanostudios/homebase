// scripts/check-migration-status.js
// Kontrollera om migrationer 022, 030, 031 är applicerade i dina tenant-scheman.
// Kör: node scripts/check-migration-status.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Client } = require('pg');

async function checkSchema(client, schemaName) {
  const setSearchPath = `SET search_path TO ${schemaName}`;
  await client.query(setSearchPath);

  const result = {
    schema: schemaName,
    '022_channel_product_map.channel_instance_id': null,
    '022_orders.channel_instance_id': null,
    '030_unique_index': null,
    '031_products.channel_specific': null,
  };

  // 022: channel_product_map har channel_instance_id?
  try {
    const cpmCol = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'channel_product_map' AND column_name = 'channel_instance_id'
    `, [schemaName]);
    result['022_channel_product_map.channel_instance_id'] = cpmCol.rows.length > 0 ? 'JA' : 'NEJ';
  } catch (e) {
    result['022_channel_product_map.channel_instance_id'] = 'fel: ' + e.message;
  }

  // 022: orders har channel_instance_id?
  try {
    const ordCol = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'orders' AND column_name = 'channel_instance_id'
    `, [schemaName]);
    result['022_orders.channel_instance_id'] = ordCol.rows.length > 0 ? 'JA' : 'NEJ';
  } catch (e) {
    result['022_orders.channel_instance_id'] = 'fel: ' + e.message;
  }

  // 030: Ny unik index finns?
  try {
    const idx = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = $1 AND tablename = 'channel_product_map'
        AND indexname = 'ux_channel_product_map_user_product_channel_instance'
    `, [schemaName]);
    result['030_unique_index'] = idx.rows.length > 0 ? 'JA' : 'NEJ';
  } catch (e) {
    result['030_unique_index'] = 'fel: ' + e.message;
  }

  // 031: products har channel_specific?
  try {
    const psCol = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'products' AND column_name = 'channel_specific'
    `, [schemaName]);
    result['031_products.channel_specific'] = psCol.rows.length > 0 ? 'JA' : 'NEJ';
  } catch (e) {
    result['031_products.channel_specific'] = 'fel: ' + e.message;
  }

  return result;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL saknas. Kontrollera .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // Hitta tenant-scheman (tenant_1, tenant_2, ...)
    const schemas = await client.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name LIKE 'tenant_%'
      ORDER BY schema_name
    `);

    const tenantSchemas = schemas.rows.map((r) => r.schema_name);
    if (tenantSchemas.length === 0) {
      console.log('⚠️  Inga tenant-scheman hittades. Testar public...');
      tenantSchemas.push('public');
    }

    console.log('\n📋 Migration status per schema:\n');

    for (const schema of tenantSchemas) {
      const status = await checkSchema(client, schema);
      console.log(`\n--- ${schema} ---`);
      console.log('  022 channel_product_map.channel_instance_id:', status['022_channel_product_map.channel_instance_id']);
      console.log('  022 orders.channel_instance_id:             ', status['022_orders.channel_instance_id']);
      console.log('  030 ux_channel_product_map_..._instance:    ', status['030_unique_index']);
      console.log('  031 products.channel_specific:              ', status['031_products.channel_specific']);
    }

    console.log('\n\n📌 Tolkning:');
    console.log('  - Om 022 visar NEJ: Kolumnerna saknas. Kör "node scripts/run-all-migrations.js"');
    console.log('  - 022 använder ADD COLUMN IF NOT EXISTS, så den går att köra även om delvis applicerad');
    console.log('  - 030 och 031 använder också idempotenta kommandon (IF NOT EXISTS)');
    console.log('\n');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('❌', e?.message || String(e));
  process.exit(1);
});
