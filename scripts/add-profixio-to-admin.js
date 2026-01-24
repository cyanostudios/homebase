// scripts/add-profixio-to-admin.js
// Add profixio plugin access to admin@homebase.se

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addProfixioToAdmin() {
  const client = await pool.connect();

  try {
    console.log('🔧 Adding profixio plugin to admin@homebase.se...');

    // Find admin user
    const userResult = await client.query('SELECT id, email FROM users WHERE email = $1', [
      'admin@homebase.se',
    ]);

    if (!userResult.rows.length) {
      console.error('❌ User admin@homebase.se not found');
      process.exit(1);
    }

    const userId = userResult.rows[0].id;
    console.log(`✅ Found user: ${userResult.rows[0].email} (ID: ${userId})`);

    // Check if profixio already exists
    const existingResult = await client.query(
      'SELECT * FROM user_plugin_access WHERE user_id = $1 AND plugin_name = $2',
      [userId, 'profixio'],
    );

    if (existingResult.rows.length > 0) {
      // Update to enabled if it exists but is disabled
      if (!existingResult.rows[0].enabled) {
        await client.query(
          'UPDATE user_plugin_access SET enabled = true WHERE user_id = $1 AND plugin_name = $2',
          [userId, 'profixio'],
        );
        console.log('✅ Profixio plugin was disabled, now enabled');
      } else {
        console.log('ℹ️  Profixio plugin already enabled for this user');
      }
    } else {
      // Insert new plugin access
      await client.query(
        'INSERT INTO user_plugin_access (user_id, plugin_name, enabled) VALUES ($1, $2, true) ON CONFLICT (user_id, plugin_name) DO UPDATE SET enabled = true',
        [userId, 'profixio'],
      );
      console.log('✅ Profixio plugin access granted');
    }

    // Verify
    const verifyResult = await client.query(
      'SELECT plugin_name FROM user_plugin_access WHERE user_id = $1 AND enabled = true ORDER BY plugin_name',
      [userId],
    );
    console.log('\n📋 Current enabled plugins:');
    verifyResult.rows.forEach((row) => {
      console.log(`   - ${row.plugin_name}`);
    });

    console.log('\n✅ Done! User needs to log out and log in again to see the plugin in sidebar.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addProfixioToAdmin();
