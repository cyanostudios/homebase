const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { Client } = require('pg');
async function run() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  for (const t of ['contacts', 'estimates', 'channel_error_log', 'mail_log', 'mail_settings']) {
    const pub = await c.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
      [t]
    );
    const ten = await c.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='tenant_1' AND table_name=$1 ORDER BY ordinal_position",
      [t]
    );
    const pubCols = new Map(pub.rows.map((r) => [r.column_name, r.data_type]));
    const tenCols = new Map(ten.rows.map((r) => [r.column_name, r.data_type]));
    const inPubNotTen = [...pubCols.keys()].filter((k) => !tenCols.has(k));
    const typeDiff = [...pubCols.keys()].filter((k) => tenCols.has(k) && pubCols.get(k) !== tenCols.get(k));
    console.log(t + ':');
    if (inPubNotTen.length) console.log('  public has, tenant lacks:', inPubNotTen.map((k) => k + ' ' + pubCols.get(k)));
    if (typeDiff.length) console.log('  type diff:', typeDiff.map((k) => k + ': pub=' + pubCols.get(k) + ' ten=' + tenCols.get(k)));
    if (!inPubNotTen.length && !typeDiff.length) console.log('  OK');
    console.log('');
  }
  await c.end();
}
if (process.argv[2]) {
  const table = process.argv[2];
  (async () => {
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    const ten = await c.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='tenant_1' AND table_name=$1 ORDER BY ordinal_position",
      [table]
    );
    console.log('tenant_1.' + table + ':', ten.rows.map((r) => r.column_name).join(', '));
    const pub = await c.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
      [table]
    );
    console.log('public.' + table + ':', pub.rows.map((r) => r.column_name).join(', '));
    await c.end();
  })().catch((e) => { console.error(e); process.exit(1); });
} else {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
