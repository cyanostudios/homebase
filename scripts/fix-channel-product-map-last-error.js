// scripts/fix-channel-product-map-last-error.js
// Lägger till last_error i channel_product_map (public + tenant-scheman).
// Används när tabellen skapades från äldre schema utan last_error.
// Påverkar INTE Orders – den kolumnen används bara för sync-status.
// Kör: node scripts/fix-channel-product-map-last-error.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Client } = require('pg');

const ALTER_SQL = `ALTER TABLE channel_product_map ADD COLUMN IF NOT EXISTS last_error TEXT`;

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
      await client.query(`SET search_path TO ${schema}`);
      await client.query(ALTER_SQL);
      console.log(`✅ ${schema}.channel_product_map – last_error tillagd`);
    } catch (e) {
      if (e.code === '42P01') {
        console.log(`⏭️  ${schema} – tabellen finns inte, hoppar över`);
      } else {
        console.error(`❌ ${schema}:`, e.message);
      }
    }
  }

  await client.end();
  console.log('\nKlart.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
