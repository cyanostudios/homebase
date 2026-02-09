// scripts/add-plugins-to-users.js
// Script to add new plugins (channels, products, woocommerce-products, cdon-products, fyndiq-products) to all existing users

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const NEW_PLUGINS = ['channels', 'products', 'woocommerce-products', 'cdon-products', 'fyndiq-products', 'orders'];

async function addPluginsToUsers() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔌 Adding new plugins to all users...');
    console.log('📦 Plugins:', NEW_PLUGINS.join(', '));
    
    // Get all users
    const usersResult = await client.query('SELECT id, email FROM users');
    const users = usersResult.rows;
    
    console.log(`👥 Found ${users.length} users`);
    
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const user of users) {
      for (const pluginName of NEW_PLUGINS) {
        // Check if user already has this plugin
        const existing = await client.query(
          'SELECT 1 FROM user_plugin_access WHERE user_id = $1 AND plugin_name = $2',
          [user.id, pluginName]
        );
        
        if (existing.rows.length === 0) {
          // Add plugin access
          await client.query(
            'INSERT INTO user_plugin_access (user_id, plugin_name, enabled) VALUES ($1, $2, true)',
            [user.id, pluginName]
          );
          addedCount++;
          console.log(`  ✅ Added ${pluginName} to ${user.email}`);
        } else {
          skippedCount++;
        }
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Plugin access update complete!');
    console.log('='.repeat(60));
    console.log(`✅ Added: ${addedCount} plugin access entries`);
    console.log(`⏭️  Skipped (already exists): ${skippedCount} entries`);
    console.log('='.repeat(60));
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to add plugins:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addPluginsToUsers()
  .then(() => {
    console.log('\n💡 Users need to log out and log back in to see the new plugins in the sidebar.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
