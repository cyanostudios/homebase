/**
 * Add Pulse plugin access for existing users (main DB).
 * Run: node scripts/add-pulses-to-admin.js
 * Requires: DATABASE_URL in .env or .env.local
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addPulsesAccess() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO user_plugin_access (user_id, plugin_name, enabled)
       SELECT u.id, 'pulses', true
       FROM users u
       WHERE NOT EXISTS (
         SELECT 1 FROM user_plugin_access upa
         WHERE upa.user_id = u.id AND upa.plugin_name = 'pulses'
       )`,
    );
    console.log('Pulse plugin access added for users who did not have it.');
    if (result.rowCount > 0) {
      console.log(`Rows affected: ${result.rowCount}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

addPulsesAccess().catch((err) => {
  console.error(err);
  process.exit(1);
});
