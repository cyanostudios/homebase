// scripts/sync-public-schema.js
// Lägger till saknade kolumner i public så att den matchar kanoniska schemat.
// Kör före migrate-public-to-tenant om public saknar kolumner (t.ex. kvitto, share_token).
// Inga fallbacklösningar – schemat synkas.
//
// Kör: node scripts/sync-public-schema.js

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

  const alters = [
    ['contacts', 'kvitto', 'VARCHAR(50)'],
    ['estimates', 'share_token', 'VARCHAR(64) UNIQUE'],
  ];

  for (const [table, col, def] of alters) {
    try {
      const r = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
        [table, col]
      );
      if (r.rows.length === 0) {
        await client.query(`ALTER TABLE public.${table} ADD COLUMN ${col} ${def}`);
        console.log(`✅ public.${table}.${col} tillagd`);
      } else {
        console.log(`⏭️  public.${table}.${col} finns redan`);
      }
    } catch (e) {
      console.error(`❌ public.${table}.${col}:`, e.message);
    }
  }

  await client.end();
  console.log('\nKlart.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
