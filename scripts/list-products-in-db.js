// scripts/list-products-in-db.js
// Listar produkter i public och tenant_1 för att hitta dubletter/konflikter.
// Kör: node scripts/list-products-in-db.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL saknas');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const schemas = ['public', 'tenant_1'];
  const userId = 1; // anpassa om du har annat user_id

  for (const schema of schemas) {
    try {
      const res = await client.query(
        `SELECT id, user_id, product_number, sku, title, created_at
         FROM ${schema}.products
         WHERE user_id = $1
         ORDER BY product_number NULLS LAST, id`,
        [userId]
      );
      console.log(`\n--- ${schema}.products (user_id=${userId}) ---`);
      if (res.rows.length === 0) {
        console.log('  (inga produkter)');
      } else {
        res.rows.forEach((r) => {
          console.log(`  id=${r.id} product_number=${JSON.stringify(r.product_number)} sku=${JSON.stringify(r.sku)} title=${(r.title || '').slice(0, 40)}`);
        });
      }
    } catch (e) {
      if (e.code === '42P01') {
        console.log(`\n--- ${schema}.products --- tabellen finns inte`);
      } else {
        console.error(`\n--- ${schema}.products --- fel:`, e.message);
      }
    }
  }

  console.log('\n');
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
