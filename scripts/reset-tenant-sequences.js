// scripts/reset-tenant-sequences.js
// Reset SERIAL/identity sequences in all tenant_* schemas (schema-per-tenant).
// Useful after copying rows between schemas where sequences are not updated.
//
// Run: node scripts/reset-tenant-sequences.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Client } = require('pg');

const TABLES_WITH_ID = [
  'channel_instances',
  'products',
  'orders',
  'contacts',
  'notes',
  'tasks',
  'estimates',
  'invoices',
  'user_files',
  'inspection_projects',
  'inspection_project_files',
  'mail_log',
  // Some installs also have these as SERIAL; include best-effort:
  'channel_product_map',
  'channel_product_overrides',
  'activity_log',
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL saknas');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const schemasRes = await client.query(
      `SELECT schema_name
       FROM information_schema.schemata
       WHERE schema_name LIKE 'tenant\\_%' ESCAPE '\\'
       ORDER BY schema_name`,
    );
    const schemas = schemasRes.rows.map((r) => r.schema_name);
    if (!schemas.length) {
      console.log('Inga tenant_* scheman hittades.');
      return;
    }

    console.log(`🔧 Reset sequences in ${schemas.length} tenant schema(s)...`);

    for (const schemaName of schemas) {
      console.log(`\n--- ${schemaName} ---`);
      await client.query('BEGIN');
      try {
        await client.query(`SET LOCAL search_path TO ${schemaName}`);
        for (const table of TABLES_WITH_ID) {
          try {
            // Only reset if the table exists and has a sequence for "id"
            const seqRes = await client.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [
              `${schemaName}.${table}`,
            ]);
            const seq = seqRes.rows?.[0]?.seq;
            if (!seq) continue;

            await client.query(
              `SELECT setval($1, GREATEST(COALESCE((SELECT MAX(id) FROM ${table}), 1), 1))`,
              [seq],
            );
            console.log(`   ✅ ${table}`);
          } catch (_e) {
            // best-effort: ignore per-table failures
          }
        }
        await client.query('COMMIT');
      } catch (inner) {
        try {
          await client.query('ROLLBACK');
        } catch {}
        throw inner;
      }
    }

    console.log('\n✅ Done.');
  } finally {
    try {
      await client.query('RESET search_path');
    } catch {}
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
