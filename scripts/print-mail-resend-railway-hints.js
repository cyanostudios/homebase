#!/usr/bin/env node
/**
 * Print RESEND_FROM hints from mail_settings (main DB) for Railway Variables.
 * Does not print API keys — copy RESEND_API_KEY from Mail settings UI or Resend dashboard.
 */
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: true });

const dbUrl = process.env.DATABASE_URL;

async function main() {
  if (!dbUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  try {
    const hasTable = await pool.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'mail_settings'`,
    );
    if (!hasTable.rows.length) {
      console.log(
        'mail_settings table not found — run mail migrations or configure Mail plugin first.',
      );
      return;
    }

    const r = await pool.query(
      `SELECT user_id, provider, resend_from_address, from_address
       FROM mail_settings
       WHERE provider = 'resend' OR resend_from_address IS NOT NULL
       ORDER BY user_id`,
    );

    console.log('=== Railway Variables (copy from Mail / Resend) ===\n');
    console.log(
      'RESEND_API_KEY=re_...   ← from Mail plugin settings or https://resend.com/api-keys',
    );
    console.log('FRONTEND_URL=https://<your-railway-service>.up.railway.app');
    console.log('APP_URL=<same as FRONTEND_URL>\n');

    if (!r.rows.length) {
      console.log('No Resend rows in mail_settings. Set Mail → Settings → Resend locally first.');
      console.log('RESEND_FROM=noreply@<your-verified-domain>');
      return;
    }

    console.log('Suggested RESEND_FROM from mail_settings:');
    for (const row of r.rows) {
      const from =
        row.resend_from_address || row.from_address || '(not set — set in Mail settings)';
      console.log(`  user_id=${row.user_id}  RESEND_FROM=${from}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
