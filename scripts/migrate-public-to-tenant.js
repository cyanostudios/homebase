// scripts/migrate-public-to-tenant.js
// Migrerar data från public till tenant-scheman (tenant_1, tenant_2, ...).
// Efter kopiering töms de migrerade tabellerna i public automatiskt (FK-säker ordning).
// Kör efter att run-all-migrations har kört (så tenant-tabeller finns).
// Synkar automatiskt public-schema först (kvitto, share_token m.m.).
//
// Kör: node scripts/migrate-public-to-tenant.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Client } = require('pg');

// Tabeller att migrera, i beroendeordning (order_items efter orders)
const TENANT_TABLES = [
  'contacts',
  'notes',
  'tasks',
  'estimates',
  'invoices',
  'invoice_shares',
  'user_files',
  'activity_log',
  'products',
  'channel_product_map',
  'channel_product_overrides',
  'channel_instances',
  'woocommerce_settings',
  'channel_error_log',
  'dropbox_settings',
  'onedrive_settings',
  'googledrive_settings',
  'cdon_settings',
  'fyndiq_settings',
  'orders',
  'order_items',
  'order_number_counter',
  'inspection_projects',
  'inspection_project_files',
  'mail_log',
  'mail_settings',
  'user_settings',
];

// Ordning för att tömma public efter migrering (barn före föräldrar pga FK)
const PUBLIC_CLEANUP_ORDER = [
  'order_items',
  'orders',
  'order_number_counter',
  'invoice_shares',
  'invoices',
  'estimates',
  'inspection_project_files',
  'inspection_projects',
  'mail_log',
  'activity_log',
  'user_files',
  'notes',
  'tasks',
  'channel_product_overrides',
  'channel_product_map',
  'products',
  'contacts',
  'channel_instances',
  'woocommerce_settings',
  'channel_error_log',
  'dropbox_settings',
  'onedrive_settings',
  'googledrive_settings',
  'cdon_settings',
  'fyndiq_settings',
  'mail_settings',
  'user_settings',
];

async function syncPublicSchema(client) {
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
        console.log(`   public.${table}.${col} tillagd`);
      }
    } catch (e) {
      console.error(`   public.${table}.${col}:`, e.message);
    }
  }
}

async function tableExists(client, schema, table) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
    [schema, table]
  );
  return r.rows.length > 0;
}

async function hasUserColumn(client, schema, table) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = 'user_id'`,
    [schema, table]
  );
  return r.rows.length > 0;
}

async function getRowCount(client, schema, table, userId) {
  const hasUser = await hasUserColumn(client, schema, table);
  let sql = `SELECT COUNT(*) as c FROM ${schema}.${table}`;
  if (hasUser) sql += ` WHERE user_id = $1`;
  const r = await client.query(hasUser ? sql : sql.replace(/\$1/, '1'), hasUser ? [userId] : []);
  return parseInt(r.rows[0].c, 10);
}

async function copyTable(client, schema, table, userId) {
  const existsPublic = await tableExists(client, 'public', table);
  const existsTenant = await tableExists(client, schema, table);
  if (!existsPublic || !existsTenant) return { copied: 0, skipped: true };

  const hasUser = await hasUserColumn(client, 'public', table);

  // contacts: cast tax_rate/payment_terms varchar->int
  if (table === 'contacts') {
    await client.query(
      `INSERT INTO ${schema}.contacts (
        id, user_id, contact_number, contact_type, company_name, company_type,
        organization_number, vat_number, personal_number, contact_persons, addresses,
        email, phone, phone2, website, tax_rate, payment_terms, currency, kvitto, notes,
        f_tax, created_at, updated_at
      ) SELECT
        id, user_id, contact_number, contact_type, company_name, company_type,
        organization_number, vat_number, personal_number, contact_persons, addresses,
        email, phone, phone2, website,
        NULLIF(TRIM(tax_rate::text), '')::int,
        NULLIF(TRIM(payment_terms::text), '')::int,
        currency, kvitto, notes, f_tax, created_at, updated_at
      FROM public.contacts WHERE user_id = $1
      ON CONFLICT (id) DO NOTHING`,
      [userId]
    );
    const count = await getRowCount(client, schema, table, userId);
    return { copied: count, skipped: false };
  }

  // estimates: acceptance_reasons, rejection_reasons text->jsonb
  if (table === 'estimates') {
    await client.query(
      `INSERT INTO ${schema}.estimates (
        id, user_id, estimate_number, contact_id, contact_name, organization_number,
        currency, line_items, estimate_discount, notes, valid_to, subtotal, total_discount,
        subtotal_after_discount, estimate_discount_amount, subtotal_after_estimate_discount,
        total_vat, total, status, acceptance_reasons, rejection_reasons, status_changed_at,
        share_token, created_at, updated_at
      ) SELECT
        id, user_id, estimate_number, contact_id, contact_name, organization_number,
        currency, line_items, estimate_discount, notes, valid_to, subtotal, total_discount,
        subtotal_after_discount, estimate_discount_amount, subtotal_after_estimate_discount,
        total_vat, total, status,
        CASE WHEN acceptance_reasons IS NULL OR TRIM(acceptance_reasons::text) = '' THEN NULL ELSE acceptance_reasons::text::jsonb END,
        CASE WHEN rejection_reasons IS NULL OR TRIM(rejection_reasons::text) = '' THEN NULL ELSE rejection_reasons::text::jsonb END,
        status_changed_at, share_token, created_at, updated_at
      FROM public.estimates WHERE user_id = $1
      ON CONFLICT (id) DO NOTHING`,
      [userId]
    );
    const count = await getRowCount(client, schema, table, userId);
    return { copied: count, skipped: false };
  }

  if (table === 'order_items') {
    const orderIds = await client.query(`SELECT id FROM ${schema}.orders`);
    const ids = orderIds.rows.map((r) => r.id);
    if (ids.length === 0) return { copied: 0, skipped: false };
    await client.query(
      `INSERT INTO ${schema}.order_items (order_id, sku, product_id, title, quantity, unit_price, vat_rate, raw, created_at)
       SELECT oi.order_id, oi.sku, oi.product_id, oi.title, oi.quantity, oi.unit_price, oi.vat_rate, oi.raw, oi.created_at
       FROM public.order_items oi
       WHERE oi.order_id IN (SELECT id FROM ${schema}.orders)`
    );
    const r = await client.query(`SELECT COUNT(*) as c FROM ${schema}.order_items`);
    return { copied: parseInt(r.rows[0].c, 10), skipped: false };
  }

  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
    ['public', table]
  );
  const colList = cols.rows.map((r) => r.column_name).join(', ');
  const hasId = cols.rows.some((r) => r.column_name === 'id');

  let sql = `INSERT INTO ${schema}.${table} (${colList}) SELECT ${colList} FROM public.${table}`;
  if (hasUser) sql += ` WHERE user_id = $1`;
  if (table === 'order_number_counter') sql += ` ON CONFLICT (user_id) DO UPDATE SET next_number = EXCLUDED.next_number`;
  else if (hasId) sql += ` ON CONFLICT (id) DO NOTHING`;

  await client.query(hasUser ? sql : sql, hasUser ? [userId] : []);

  const count = await getRowCount(client, schema, table, userId);
  return { copied: count, skipped: false };
}

async function resetSequence(client, schema, table) {
  try {
    await client.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${schema}.${table}), 1))`,
      [`${schema}.${table}`]
    );
  } catch (e) {
    // Ingen id-kolumn eller annat – ignorerar
  }
}

/** Töm de migrerade tabellerna i public efter lyckad kopiering (barn före föräldrar). */
async function emptyPublicMigratedTables(client) {
  console.log('\n🧹 Tömmer migrerade tabeller i public ...\n');
  for (const table of PUBLIC_CLEANUP_ORDER) {
    try {
      const r = await client.query(
        `DELETE FROM public.${table}`
      );
      if (r.rowCount > 0) {
        console.log(`   public.${table}: ${r.rowCount} rader borttagna`);
      }
    } catch (e) {
      if (e.code === '42P01') {
        // Tabell finns inte i public – hoppa över
      } else {
        console.error(`   public.${table}: ${e.message}`);
      }
    }
  }
  console.log('✅ Public rensat.\n');
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL saknas');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const userIds = await client.query(
    `SELECT DISTINCT id FROM users ORDER BY id`
  );

  if (userIds.rows.length === 0) {
    console.log('Inga användare hittades.');
    await client.end();
    return;
  }

  console.log('\n📦 Migrerar public → tenant ...\n');
  console.log('Synkar public-schema...');
  await syncPublicSchema(client);
  console.log('');

  for (const { id: userId } of userIds.rows) {
    const schema = `tenant_${userId}`;
    const schemaExists = await client.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
      [schema]
    );
    if (schemaExists.rows.length === 0) {
      console.log(`⏭️  ${schema} finns inte, hoppar över`);
      continue;
    }

    console.log(`--- ${schema} (user_id=${userId}) ---`);
    let total = 0;

    for (const table of TENANT_TABLES) {
      try {
        const { copied, skipped } = await copyTable(client, schema, table, userId);
        if (!skipped && copied > 0) {
          console.log(`   ${table}: ${copied} rader`);
          total += copied;
        }
        if (['contacts', 'notes', 'products', 'orders', 'estimates', 'invoices'].includes(table)) {
          await resetSequence(client, schema, table);
        }
      } catch (e) {
        if (e.code === '42P01') {
          // Tabell saknas
        } else {
          console.error(`   ${table}: ${e.message}`);
        }
      }
    }

    console.log(`   Totalt: ${total} rader\n`);
  }

  await emptyPublicMigratedTables(client);

  console.log('✅ Migrering klar.\n');
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
